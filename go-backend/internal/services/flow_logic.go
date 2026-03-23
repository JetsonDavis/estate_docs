package services

import (
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"strings"

	"github.com/estate-docs/go-backend/internal/models"
	"gorm.io/gorm"
)

// ---- Flow-level logic: which groups to show ----

// FlowLogicStep represents a single step in a flow's flow_logic JSON array.
type FlowLogicStep struct {
	Type        string               `json:"type"`
	GroupID     *int                 `json:"groupId,omitempty"`
	Conditional *FlowLogicConditional `json:"conditional,omitempty"`
}

// FlowLogicConditional represents a conditional within flow_logic.
type FlowLogicConditional struct {
	Identifier    string          `json:"identifier"`
	Value         string          `json:"value"`
	TargetGroupID *int            `json:"targetGroupId,omitempty"`
	NestedSteps   []FlowLogicStep `json:"nestedSteps,omitempty"`
}

// GetGroupsFromFlowLogic evaluates flow_logic JSON and returns ordered question groups,
// filtering by conditionals based on existing session answers.
func GetGroupsFromFlowLogic(db *gorm.DB, flowLogicRaw json.RawMessage, sessionID int) []models.QuestionGroup {
	var steps []FlowLogicStep
	if err := json.Unmarshal(flowLogicRaw, &steps); err != nil {
		log.Printf("Failed to parse flow_logic: %v", err)
		return nil
	}

	// Get existing answers for conditional evaluation
	var answers []models.SessionAnswer
	db.Where("session_id = ?", sessionID).Find(&answers)

	// Batch-load questions for answer identifiers
	questionIDs := make([]int, 0, len(answers))
	for _, a := range answers {
		questionIDs = append(questionIDs, a.QuestionID)
	}
	var questions []models.Question
	if len(questionIDs) > 0 {
		db.Where("id IN ?", questionIDs).Find(&questions)
	}
	qIDToIdentifier := map[int]string{}
	for _, q := range questions {
		qIDToIdentifier[q.ID] = q.Identifier
	}

	answerMap := map[string]string{}
	for _, a := range answers {
		if ident, ok := qIDToIdentifier[a.QuestionID]; ok {
			answerMap[ident] = a.AnswerValue
		}
	}

	// Collect all group IDs referenced in flow_logic
	allGroupIDs := collectGroupIDs(steps)
	if len(allGroupIDs) == 0 {
		return nil
	}

	var allGroups []models.QuestionGroup
	db.Where("id IN ? AND is_active = true", allGroupIDs).Find(&allGroups)
	groupByID := map[int]models.QuestionGroup{}
	for _, g := range allGroups {
		groupByID[g.ID] = g
	}

	// Process steps and build ordered group list
	var groups []models.QuestionGroup
	addedIDs := map[int]bool{}

	var processSteps func(steps []FlowLogicStep)
	processSteps = func(steps []FlowLogicStep) {
		for _, step := range steps {
			if step.Type == "group" && step.GroupID != nil {
				g, ok := groupByID[*step.GroupID]
				if ok && !addedIDs[g.ID] {
					groups = append(groups, g)
					addedIDs[g.ID] = true
				}
			} else if step.Type == "conditional" && step.Conditional != nil {
				cond := step.Conditional
				if cond.Identifier != "" {
					if actualValue, exists := answerMap[cond.Identifier]; exists {
						if actualValue == cond.Value {
							// Condition met — add target group
							if cond.TargetGroupID != nil {
								g, ok := groupByID[*cond.TargetGroupID]
								if ok && !addedIDs[g.ID] {
									groups = append(groups, g)
									addedIDs[g.ID] = true
								}
							}
							// Process nested steps
							if len(cond.NestedSteps) > 0 {
								processSteps(cond.NestedSteps)
							}
						}
					}
				}
			}
		}
	}

	processSteps(steps)
	return groups
}

func collectGroupIDs(steps []FlowLogicStep) []int {
	ids := map[int]bool{}
	var collect func(steps []FlowLogicStep)
	collect = func(steps []FlowLogicStep) {
		for _, step := range steps {
			if step.Type == "group" && step.GroupID != nil {
				ids[*step.GroupID] = true
			} else if step.Type == "conditional" && step.Conditional != nil {
				if step.Conditional.TargetGroupID != nil {
					ids[*step.Conditional.TargetGroupID] = true
				}
				if len(step.Conditional.NestedSteps) > 0 {
					collect(step.Conditional.NestedSteps)
				}
			}
		}
	}
	collect(steps)

	result := make([]int, 0, len(ids))
	for id := range ids {
		result = append(result, id)
	}
	return result
}

// GetOrderedGroups resolves the ordered list of question groups for a session
// using flow_logic. Falls back to current_group_id as a single-element list.
func GetOrderedGroups(db *gorm.DB, session *models.InputForm) ([]models.QuestionGroup, string) {
	var orderedGroups []models.QuestionGroup
	flowName := ""

	if session.FlowID != nil {
		var flow models.DocumentFlow
		if err := db.First(&flow, *session.FlowID).Error; err == nil {
			flowName = flow.Name
			if flow.FlowLogic != nil {
				orderedGroups = GetGroupsFromFlowLogic(db, *flow.FlowLogic, session.ID)
			}
		}
	}

	// Fallback: use current_group_id as single-element list
	if len(orderedGroups) == 0 && session.CurrentGroupID != nil {
		var group models.QuestionGroup
		if err := db.First(&group, *session.CurrentGroupID).Error; err == nil {
			orderedGroups = []models.QuestionGroup{group}
		}
	}

	return orderedGroups, flowName
}

// ---- Question-level logic: which questions to show within a group ----

// QuestionLogicItem represents a single item in a group's question_logic JSON.
type QuestionLogicItem struct {
	Type        string                     `json:"type"`
	QuestionID  *int                       `json:"questionId,omitempty"`
	StopFlow    bool                       `json:"stopFlow,omitempty"`
	Conditional *QuestionLogicConditional  `json:"conditional,omitempty"`
}

// QuestionLogicConditional represents a conditional within question_logic.
type QuestionLogicConditional struct {
	IfIdentifier string              `json:"ifIdentifier"`
	Value        string              `json:"value"`
	Operator     string              `json:"operator,omitempty"` // equals, not_equals, any_equals, none_equals, count_*
	NextGroupID  *int                `json:"nextGroupId,omitempty"`
	NestedItems  []QuestionLogicItem `json:"nestedItems,omitempty"`
	EndFlow      bool                `json:"endFlow,omitempty"`
}

// QuestionWithDepth holds a question with its display depth and hierarchical number.
type QuestionWithDepth struct {
	Question           models.Question
	Depth              int
	HierarchicalNumber string
}

// ConditionalFollowup holds follow-up questions triggered by a specific answer value.
type ConditionalFollowup struct {
	TriggerValue string                    `json:"trigger_value"`
	Operator     string                    `json:"operator"`
	Questions    []FollowupQuestionEntry   `json:"questions"`
}

// FollowupQuestionEntry is a question + its own nested followups.
type FollowupQuestionEntry struct {
	Question     models.Question       `json:"question"`
	SubFollowups []ConditionalFollowup `json:"sub_followups,omitempty"`
}

// QuestionLogicResult holds all results from evaluating question_logic.
type QuestionLogicResult struct {
	Questions             []QuestionWithDepth
	RepeatableFollowups   map[int][]ConditionalFollowup // question_id -> followups
	QuestionNumbers       map[int]string                // question_id -> hierarchical number
	AllFollowups          map[int][]ConditionalFollowup // question_id -> followups (all questions)
	ConditionalIdentifiers []string
}

// EvaluateQuestionLogic processes the question_logic JSON for a group,
// evaluating conditionals against existing answers to determine which
// questions to display, with hierarchical numbering and followup metadata.
func EvaluateQuestionLogic(db *gorm.DB, group *models.QuestionGroup, existingAnswers map[int]string) *QuestionLogicResult {
	// Load all active questions for this group
	var allGroupQuestions []models.Question
	db.Where("question_group_id = ? AND is_active = true", group.ID).
		Order("display_order ASC").Find(&allGroupQuestions)
	questionByID := map[int]models.Question{}
	for _, q := range allGroupQuestions {
		questionByID[q.ID] = q
	}

	result := &QuestionLogicResult{
		RepeatableFollowups: map[int][]ConditionalFollowup{},
		QuestionNumbers:     map[int]string{},
		AllFollowups:        map[int][]ConditionalFollowup{},
	}

	// Parse question_logic
	if group.QuestionLogic == nil {
		// No logic — return all questions in order with depth 0
		for i, q := range allGroupQuestions {
			num := strconv.Itoa(i + 1)
			result.Questions = append(result.Questions, QuestionWithDepth{
				Question:           q,
				Depth:              0,
				HierarchicalNumber: num,
			})
			result.QuestionNumbers[q.ID] = num
		}
		return result
	}

	var logicItems []QuestionLogicItem
	if err := json.Unmarshal(*group.QuestionLogic, &logicItems); err != nil {
		log.Printf("Failed to parse question_logic for group %d: %v", group.ID, err)
		// Fallback: return all questions
		for i, q := range allGroupQuestions {
			num := strconv.Itoa(i + 1)
			result.Questions = append(result.Questions, QuestionWithDepth{
				Question:           q,
				Depth:              0,
				HierarchicalNumber: num,
			})
			result.QuestionNumbers[q.ID] = num
		}
		return result
	}

	// Build answer map by identifier
	answerByIdentifier := map[string]string{}
	for qID, answer := range existingAnswers {
		if q, ok := questionByID[qID]; ok {
			answerByIdentifier[q.Identifier] = answer
			if strings.Contains(q.Identifier, ".") {
				parts := strings.SplitN(q.Identifier, ".", 2)
				answerByIdentifier[parts[1]] = answer
			}
		}
	}

	// Pre-scan: find repeatable and all question identifiers
	repeatableIdentToQID := map[string]int{}
	allIdentToQID := map[string]int{}
	var findIdentifiers func(items []QuestionLogicItem)
	findIdentifiers = func(items []QuestionLogicItem) {
		for _, item := range items {
			if item.Type == "question" && item.QuestionID != nil {
				if q, ok := questionByID[*item.QuestionID]; ok {
					allIdentToQID[q.Identifier] = q.ID
					if strings.Contains(q.Identifier, ".") {
						stripped := strings.SplitN(q.Identifier, ".", 2)[1]
						allIdentToQID[stripped] = q.ID
					}
					if q.Repeatable {
						repeatableIdentToQID[q.Identifier] = q.ID
						if strings.Contains(q.Identifier, ".") {
							stripped := strings.SplitN(q.Identifier, ".", 2)[1]
							repeatableIdentToQID[stripped] = q.ID
						}
					}
				}
			} else if item.Type == "conditional" && item.Conditional != nil {
				if len(item.Conditional.NestedItems) > 0 {
					findIdentifiers(item.Conditional.NestedItems)
				}
			}
		}
	}
	findIdentifiers(logicItems)

	// PASS 1: Assign hierarchical numbers
	prefixCounters := map[string]int{}

	resolveNestedPrefix := func(condIdentifier, fallback string) string {
		if condIdentifier != "" {
			for _, q := range questionByID {
				ident := q.Identifier
				stripped := ident
				if strings.Contains(ident, ".") {
					stripped = strings.SplitN(ident, ".", 2)[1]
				}
				if ident == condIdentifier || stripped == condIdentifier {
					if num, ok := result.QuestionNumbers[q.ID]; ok {
						return num
					}
					break
				}
			}
		}
		return fallback
	}

	var assignNumbers func(items []QuestionLogicItem, prefix string)
	assignNumbers = func(items []QuestionLogicItem, prefix string) {
		questionCounter := prefixCounters[prefix]
		lastQuestionNumber := prefix

		i := 0
		for i < len(items) {
			item := items[i]

			if item.Type == "question" && item.QuestionID != nil {
				questionCounter++
				var num string
				if prefix != "" {
					num = fmt.Sprintf("%s-%d", prefix, questionCounter)
				} else {
					num = strconv.Itoa(questionCounter)
				}
				result.QuestionNumbers[*item.QuestionID] = num
				lastQuestionNumber = num
				i++

			} else if item.Type == "conditional" && item.Conditional != nil {
				condIdentifier := item.Conditional.IfIdentifier
				nestedPrefix := resolveNestedPrefix(condIdentifier, lastQuestionNumber)

				// Collect consecutive conditionals with same trigger
				var run []QuestionLogicItem
				j := i
				for j < len(items) {
					ci := items[j]
					if ci.Type != "conditional" || ci.Conditional == nil {
						break
					}
					if ci.Conditional.IfIdentifier != condIdentifier {
						break
					}
					run = append(run, ci)
					j++
				}

				// Process run — reset counter for each NEW value
				baseCounter := prefixCounters[nestedPrefix]
				maxCounter := baseCounter
				seenValues := map[string]bool{}

				for _, runItem := range run {
					rv := runItem.Conditional.Value
					rn := runItem.Conditional.NestedItems

					if !seenValues[rv] {
						prefixCounters[nestedPrefix] = baseCounter
						seenValues[rv] = true
					}

					if len(rn) > 0 {
						assignNumbers(rn, nestedPrefix)
					}

					branchCounter := prefixCounters[nestedPrefix]
					if branchCounter > maxCounter {
						maxCounter = branchCounter
					}
				}

				prefixCounters[nestedPrefix] = maxCounter
				i = j

			} else {
				i++
			}
		}

		prefixCounters[prefix] = questionCounter
	}

	assignNumbers(logicItems, "")

	// PASS 2: Process logic items and build question list + followups
	questionIDsAdded := map[int]bool{}

	// collectNestedQuestions gathers question objects from nested items with their sub-followups.
	var collectNestedQuestions func(items []QuestionLogicItem) []FollowupQuestionEntry
	collectNestedQuestions = func(items []QuestionLogicItem) []FollowupQuestionEntry {
		var collected []FollowupQuestionEntry

		// First pass: build identifier->question map
		questionMap := map[string]models.Question{}
		for _, item := range items {
			if item.Type == "question" && item.QuestionID != nil {
				if q, ok := questionByID[*item.QuestionID]; ok {
					questionMap[q.Identifier] = q
					if strings.Contains(q.Identifier, ".") {
						stripped := strings.SplitN(q.Identifier, ".", 2)[1]
						questionMap[stripped] = q
					}
				}
			}
		}

		// Second pass: find conditionals for sub-followups
		subFollowupsMap := map[int][]ConditionalFollowup{} // question_id -> followups
		for _, item := range items {
			if item.Type == "conditional" && item.Conditional != nil {
				cond := item.Conditional
				if cond.IfIdentifier != "" {
					if parentQ, ok := questionMap[cond.IfIdentifier]; ok {
						nestedResults := collectNestedQuestions(cond.NestedItems)
						if len(nestedResults) > 0 {
							subFollowupsMap[parentQ.ID] = append(subFollowupsMap[parentQ.ID], ConditionalFollowup{
								TriggerValue: cond.Value,
								Operator:     cond.Operator,
								Questions:    nestedResults,
							})
						}
					}
				}
			}
		}

		// Build final list
		for _, item := range items {
			if item.Type == "question" && item.QuestionID != nil {
				if q, ok := questionByID[*item.QuestionID]; ok {
					entry := FollowupQuestionEntry{Question: q}
					if subs, ok := subFollowupsMap[q.ID]; ok {
						entry.SubFollowups = subs
					}
					collected = append(collected, entry)
				}
			}
		}
		return collected
	}

	var processLogicItems func(items []QuestionLogicItem, depth int) bool
	processLogicItems = func(items []QuestionLogicItem, depth int) bool {
		for _, item := range items {
			if item.Type == "question" && item.QuestionID != nil {
				qID := *item.QuestionID
				num := result.QuestionNumbers[qID]
				if q, ok := questionByID[qID]; ok && !questionIDsAdded[qID] {
					result.Questions = append(result.Questions, QuestionWithDepth{
						Question:           q,
						Depth:              depth,
						HierarchicalNumber: num,
					})
					questionIDsAdded[qID] = true
				}

				// Check stop flag
				if item.StopFlow {
					return false
				}

			} else if item.Type == "conditional" && item.Conditional != nil {
				cond := item.Conditional
				identifier := cond.IfIdentifier
				expectedValue := cond.Value
				operator := cond.Operator
				if operator == "" {
					operator = "equals"
				}

				// Collect conditional followups as metadata
				if identifier != "" {
					if parentQID, ok := allIdentToQID[identifier]; ok {
						followupQuestions := collectNestedQuestions(cond.NestedItems)
						if len(followupQuestions) > 0 {
							fu := ConditionalFollowup{
								TriggerValue: expectedValue,
								Operator:     operator,
								Questions:    followupQuestions,
							}
							result.AllFollowups[parentQID] = append(result.AllFollowups[parentQID], fu)
							if _, isRepeatable := repeatableIdentToQID[identifier]; isRepeatable {
								result.RepeatableFollowups[parentQID] = append(result.RepeatableFollowups[parentQID], fu)
							}
						}
					}
				}

				// Check if condition is met
				if identifier != "" {
					if actualValue, exists := answerByIdentifier[identifier]; exists && actualValue != "" {
						conditionMet := evaluateCondition(operator, actualValue, expectedValue)

						if conditionMet {
							// Skip flat list for repeatable followups (except aggregate operators)
							isAggregateOp := operator == "any_equals" || operator == "none_equals"
							_, isRepeatable := repeatableIdentToQID[identifier]
							if isRepeatable && !isAggregateOp {
								// Don't add to flat list
							} else if len(cond.NestedItems) > 0 {
								if !processLogicItems(cond.NestedItems, depth+1) {
									return false
								}
							}

							// Check end flow flag
							if cond.EndFlow {
								return false
							}
						}
					}
				}
			}
		}
		return true
	}

	processLogicItems(logicItems, 0)

	// Extract conditional identifiers
	result.ConditionalIdentifiers = extractConditionalIdentifiers(logicItems)

	return result
}

// evaluateCondition checks whether an answer meets a conditional based on the operator.
func evaluateCondition(operator, actualValue, expectedValue string) bool {
	switch operator {
	case "not_equals":
		// For repeatable: check if none of the array elements match
		parsed, err := tryParseJSONArray(actualValue)
		if err == nil && parsed != nil {
			for _, v := range parsed {
				if v == expectedValue {
					return false // found a match → not_equals fails
				}
			}
			return true
		}
		return actualValue != expectedValue

	case "any_equals":
		parsed, err := tryParseJSONArray(actualValue)
		if err == nil && parsed != nil {
			for _, v := range parsed {
				if v == expectedValue {
					return true
				}
			}
			return false
		}
		return actualValue == expectedValue

	case "none_equals":
		parsed, err := tryParseJSONArray(actualValue)
		if err == nil && parsed != nil {
			for _, v := range parsed {
				if v == expectedValue {
					return false
				}
			}
			return true
		}
		return actualValue != expectedValue

	case "count_greater_than", "count_equals", "count_less_than":
		count := 1
		parsed, err := tryParseJSONArray(actualValue)
		if err == nil && parsed != nil {
			count = len(parsed)
		} else if actualValue == "" {
			count = 0
		}

		threshold, err := strconv.Atoi(expectedValue)
		if err != nil {
			threshold = 0
		}

		switch operator {
		case "count_greater_than":
			return count > threshold
		case "count_equals":
			return count == threshold
		case "count_less_than":
			return count < threshold
		}
		return false

	default: // "equals" or unspecified
		// For repeatable: check if any element in array matches
		parsed, err := tryParseJSONArray(actualValue)
		if err == nil && parsed != nil {
			for _, v := range parsed {
				if v == expectedValue {
					return true
				}
			}
			return false
		}
		return actualValue == expectedValue
	}
}

// tryParseJSONArray attempts to parse a string as a JSON array of strings.
func tryParseJSONArray(s string) ([]string, error) {
	var raw []interface{}
	if err := json.Unmarshal([]byte(s), &raw); err != nil {
		return nil, err
	}
	result := make([]string, len(raw))
	for i, v := range raw {
		if v == nil {
			result[i] = ""
		} else {
			result[i] = fmt.Sprintf("%v", v)
		}
	}
	return result, nil
}

// extractConditionalIdentifiers returns identifiers that have conditionals depending on them.
func extractConditionalIdentifiers(items []QuestionLogicItem) []string {
	seen := map[string]bool{}
	var extract func(items []QuestionLogicItem)
	extract = func(items []QuestionLogicItem) {
		for _, item := range items {
			if item.Type == "conditional" && item.Conditional != nil {
				if item.Conditional.IfIdentifier != "" {
					seen[item.Conditional.IfIdentifier] = true
				}
				if len(item.Conditional.NestedItems) > 0 {
					extract(item.Conditional.NestedItems)
				}
			}
		}
	}
	extract(items)

	result := make([]string, 0, len(seen))
	for ident := range seen {
		result = append(result, ident)
	}
	return result
}

// DetermineNextGroup evaluates question_logic conditionals and flow_logic
// to determine which group comes next after the current one.
func DetermineNextGroup(db *gorm.DB, session *models.InputForm, currentGroup *models.QuestionGroup, answers []AnswerInput) *int {
	// Build answer lookup by question ID
	answerByQID := map[int]string{}
	for _, a := range answers {
		answerByQID[a.QuestionID] = a.AnswerValue
	}

	// Check if current group has question_logic with conditionals for next-group jumps
	if currentGroup.QuestionLogic != nil {
		var logicItems []QuestionLogicItem
		if err := json.Unmarshal(*currentGroup.QuestionLogic, &logicItems); err == nil {
			// Load group's questions for identifier lookup
			var groupQuestions []models.Question
			db.Where("question_group_id = ?", currentGroup.ID).Find(&groupQuestions)

			for _, item := range logicItems {
				if item.Type == "conditional" && item.Conditional != nil {
					cond := item.Conditional
					if cond.IfIdentifier == "" || cond.NextGroupID == nil {
						continue
					}
					operator := cond.Operator
					if operator == "" {
						operator = "equals"
					}

					for _, q := range groupQuestions {
						stripped := q.Identifier
						if strings.Contains(q.Identifier, ".") {
							stripped = strings.SplitN(q.Identifier, ".", 2)[1]
						}
						if q.Identifier == cond.IfIdentifier || stripped == cond.IfIdentifier {
							actualValue, exists := answerByQID[q.ID]
							if !exists || actualValue == "" {
								break
							}

							if evaluateCondition(operator, actualValue, cond.Value) {
								nextID := *cond.NextGroupID
								return &nextID
							}
							break
						}
					}
				}
			}
		}
	}

	// If no conditional jump, find next group in flow order
	if session.FlowID != nil {
		var flow models.DocumentFlow
		if err := db.First(&flow, *session.FlowID).Error; err == nil && flow.FlowLogic != nil {
			orderedGroups := GetGroupsFromFlowLogic(db, *flow.FlowLogic, session.ID)
			for i, g := range orderedGroups {
				if g.ID == currentGroup.ID && i+1 < len(orderedGroups) {
					nextID := orderedGroups[i+1].ID
					return &nextID
				}
			}
			// Current group is last or not found
			return nil
		}
	}

	// No flow — find next active group by display_order
	var nextGroup models.QuestionGroup
	err := db.Where("display_order > ? AND is_active = true", currentGroup.DisplayOrder).
		Order("display_order ASC").First(&nextGroup).Error
	if err != nil {
		return nil
	}
	return &nextGroup.ID
}
