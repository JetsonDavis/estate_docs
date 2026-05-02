package services

import (
	"errors"
	"fmt"
	"time"

	"github.com/estate-docs/go-backend/internal/models"
	"gorm.io/gorm"
)

type SessionService struct {
	DB *gorm.DB
}

func NewSessionService(db *gorm.DB) *SessionService {
	return &SessionService{DB: db}
}

type SessionCreateInput struct {
	ClientIdentifier string `json:"client_identifier"`
	FlowID           *int   `json:"flow_id"`
	StartingGroupID  *int   `json:"starting_group_id"`
}

type AnswerInput struct {
	QuestionID  int    `json:"question_id"`
	AnswerValue string `json:"answer_value"`
}

type NavigateInput struct {
	Direction string        `json:"direction"`
	Answers   []AnswerInput `json:"answers"`
}

type DeleteAnswersInput struct {
	QuestionIDs []int `json:"question_ids"`
}

func (s *SessionService) Create(input SessionCreateInput, userID int) (*models.InputForm, error) {
	session := models.InputForm{
		ClientIdentifier: input.ClientIdentifier,
		UserID:           userID,
		FlowID:           input.FlowID,
		CurrentGroupID:   input.StartingGroupID,
		IsCompleted:      false,
		CreatedAt:        time.Now().UTC(),
		UpdatedAt:        time.Now().UTC(),
	}

	// If no starting group, get the first group from the flow or globally
	if session.CurrentGroupID == nil {
		if input.FlowID != nil {
			var flow models.DocumentFlow
			if err := s.DB.First(&flow, *input.FlowID).Error; err == nil && flow.StartingGroupID != nil {
				session.CurrentGroupID = flow.StartingGroupID
			}
		}
		if session.CurrentGroupID == nil {
			var firstGroup models.QuestionGroup
			if err := s.DB.Where("is_active = true").Order("display_order ASC").First(&firstGroup).Error; err == nil {
				session.CurrentGroupID = &firstGroup.ID
			}
		}
	}

	if err := s.DB.Create(&session).Error; err != nil {
		return nil, err
	}
	return &session, nil
}

func (s *SessionService) List(userID, skip, limit int) ([]models.InputForm, int64, error) {
	var sessions []models.InputForm
	var total int64

	q := s.DB.Model(&models.InputForm{}).Where("user_id = ?", userID)
	q.Count(&total)

	if err := q.Order("created_at DESC").Offset(skip).Limit(limit).Find(&sessions).Error; err != nil {
		return nil, 0, err
	}
	return sessions, total, nil
}

func (s *SessionService) GetByID(sessionID, userID int) (*models.InputForm, error) {
	var session models.InputForm
	if err := s.DB.Where("id = ? AND user_id = ?", sessionID, userID).First(&session).Error; err != nil {
		return nil, err
	}
	return &session, nil
}

func (s *SessionService) GetAnswers(sessionID, userID int) ([]models.SessionAnswer, error) {
	// Verify ownership
	var session models.InputForm
	if err := s.DB.Where("id = ? AND user_id = ?", sessionID, userID).First(&session).Error; err != nil {
		return nil, errors.New("session not found")
	}

	var answers []models.SessionAnswer
	s.DB.Where("session_id = ?", sessionID).Find(&answers)
	return answers, nil
}

func (s *SessionService) SaveAnswers(sessionID, userID int, answers []AnswerInput) error {
	var session models.InputForm
	if err := s.DB.Where("id = ? AND user_id = ?", sessionID, userID).First(&session).Error; err != nil {
		return errors.New("session not found")
	}

	for _, a := range answers {
		var existing models.SessionAnswer
		err := s.DB.Where("session_id = ? AND question_id = ?", sessionID, a.QuestionID).First(&existing).Error
		if err == nil {
			existing.AnswerValue = a.AnswerValue
			existing.UpdatedAt = time.Now().UTC()
			s.DB.Save(&existing)
		} else {
			newAnswer := models.SessionAnswer{
				SessionID:   sessionID,
				QuestionID:  a.QuestionID,
				AnswerValue: a.AnswerValue,
				CreatedAt:   time.Now().UTC(),
				UpdatedAt:   time.Now().UTC(),
			}
			s.DB.Create(&newAnswer)
		}

		// Create snapshot
		snapshot := models.AnswerSnapshot{
			SessionID:   sessionID,
			QuestionID:  a.QuestionID,
			AnswerValue: a.AnswerValue,
			SavedAt:     time.Now().UTC(),
		}
		s.DB.Create(&snapshot)
	}

	return nil
}

func (s *SessionService) DeleteAnswers(sessionID, userID int, questionIDs []int) error {
	var session models.InputForm
	if err := s.DB.Where("id = ? AND user_id = ?", sessionID, userID).First(&session).Error; err != nil {
		return errors.New("session not found")
	}

	return s.DB.Where("session_id = ? AND question_id IN ?", sessionID, questionIDs).
		Delete(&models.SessionAnswer{}).Error
}

func (s *SessionService) SubmitAnswers(sessionID, userID int, answers []AnswerInput) (*models.InputForm, error) {
	// Save the answers first
	if err := s.SaveAnswers(sessionID, userID, answers); err != nil {
		return nil, err
	}

	var session models.InputForm
	if err := s.DB.Where("id = ? AND user_id = ?", sessionID, userID).First(&session).Error; err != nil {
		return nil, errors.New("session not found")
	}

	// Determine next group using flow_logic and question_logic conditionals
	if session.CurrentGroupID != nil {
		var currentGroup models.QuestionGroup
		if err := s.DB.Preload("Questions").First(&currentGroup, *session.CurrentGroupID).Error; err == nil {
			nextID := DetermineNextGroup(s.DB, &session, &currentGroup, answers)
			session.CurrentGroupID = nextID
		}
	}

	session.UpdatedAt = time.Now().UTC()
	s.DB.Save(&session)

	return &session, nil
}

func (s *SessionService) Navigate(sessionID, userID int, direction string, answers []AnswerInput) (*models.InputForm, error) {
	// Save answers if provided
	if len(answers) > 0 {
		if err := s.SaveAnswers(sessionID, userID, answers); err != nil {
			return nil, err
		}
	}

	var session models.InputForm
	if err := s.DB.Where("id = ? AND user_id = ?", sessionID, userID).First(&session).Error; err != nil {
		return nil, errors.New("session not found")
	}

	if session.CurrentGroupID != nil {
		// Use flow_logic-aware ordered groups
		orderedGroups, _ := GetOrderedGroups(s.DB, &session)

		for i, g := range orderedGroups {
			if g.ID == *session.CurrentGroupID {
				if direction == "forward" {
					if i+1 < len(orderedGroups) {
						nextID := orderedGroups[i+1].ID
						session.CurrentGroupID = &nextID
					}
				} else if direction == "backward" {
					if i-1 >= 0 {
						prevID := orderedGroups[i-1].ID
						session.CurrentGroupID = &prevID
					}
				}
				break
			}
		}
	}

	session.UpdatedAt = time.Now().UTC()
	s.DB.Save(&session)
	return &session, nil
}

func (s *SessionService) Delete(sessionID, userID int) error {
	result := s.DB.Where("id = ? AND user_id = ?", sessionID, userID).Delete(&models.InputForm{})
	if result.RowsAffected == 0 {
		return errors.New("session not found")
	}
	return result.Error
}

func (s *SessionService) GetQuestions(sessionID, userID int) (map[string]interface{}, error) {
	var session models.InputForm
	if err := s.DB.Where("id = ? AND user_id = ?", sessionID, userID).First(&session).Error; err != nil {
		return nil, errors.New("session not found")
	}

	// Resolve ordered groups from flow_logic
	orderedGroups, flowName := GetOrderedGroups(s.DB, &session)

	if len(orderedGroups) == 0 {
		// Get existing answers even for empty groups
		var existingAnswers []models.SessionAnswer
		s.DB.Where("session_id = ?", sessionID).Find(&existingAnswers)
		existingAnswerMap := map[int]string{}
		for _, a := range existingAnswers {
			existingAnswerMap[a.QuestionID] = a.AnswerValue
		}

		return map[string]interface{}{
			"session_id":              sessionID,
			"client_identifier":       session.ClientIdentifier,
			"flow_id":                 session.FlowID,
			"flow_name":               flowName,
			"current_group_id":        0,
			"current_group_name":      "",
			"current_group_index":     0,
			"total_groups":            0,
			"questions":               []interface{}{},
			"current_page":            1,
			"total_pages":             1,
			"questions_per_page":      0,
			"is_completed":            session.IsCompleted,
			"is_last_group":           true,
			"is_first_group":          true,
			"can_go_back":             false,
			"existing_answers":        existingAnswerMap,
			"conditional_identifiers": []string{},
		}, nil
	}

	// Find current group index
	currentGroupIndex := 0
	var currentGroup *models.QuestionGroup
	for i, g := range orderedGroups {
		if g.ID == *session.CurrentGroupID {
			currentGroupIndex = i
			gCopy := g
			currentGroup = &gCopy
			break
		}
	}
	if currentGroup == nil {
		gCopy := orderedGroups[0]
		currentGroup = &gCopy
		currentGroupIndex = 0
	}

	// Get existing answers
	var existingAnswers []models.SessionAnswer
	s.DB.Where("session_id = ?", sessionID).Find(&existingAnswers)
	existingAnswerMap := map[int]string{}
	for _, a := range existingAnswers {
		existingAnswerMap[a.QuestionID] = a.AnswerValue
	}

	// Evaluate question_logic for conditional questions
	logicResult := EvaluateQuestionLogic(s.DB, currentGroup, existingAnswerMap)

	// Build question response list
	var questionResponses []map[string]interface{}
	for _, qwd := range logicResult.Questions {
		q := qwd.Question
		qMap := map[string]interface{}{
			"id":                  q.ID,
			"identifier":          q.Identifier,
			"question_text":       q.QuestionText,
			"question_type":       q.QuestionType,
			"is_required":         q.IsRequired,
			"repeatable":          q.Repeatable,
			"repeatable_group_id": q.RepeatableGroupID,
			"help_text":           q.HelpText,
			"options":             q.Options,
			"person_display_mode": q.PersonDisplayMode,
			"include_time":        q.IncludeTime,
			"validation_rules":    q.ValidationRules,
			"depth":               qwd.Depth,
			"hierarchical_number": qwd.HierarchicalNumber,
		}
		if val, ok := existingAnswerMap[q.ID]; ok {
			qMap["current_answer"] = val
		}

		// Attach conditional followups
		if fus, ok := logicResult.AllFollowups[q.ID]; ok {
			qMap["conditional_followups"] = fus
		}

		questionResponses = append(questionResponses, qMap)
	}

	isLastGroup := currentGroupIndex >= len(orderedGroups)-1

	return map[string]interface{}{
		"session_id":              sessionID,
		"client_identifier":       session.ClientIdentifier,
		"flow_id":                 session.FlowID,
		"flow_name":               flowName,
		"current_group_id":        currentGroup.ID,
		"current_group_name":      currentGroup.Name,
		"current_group_index":     currentGroupIndex,
		"total_groups":            len(orderedGroups),
		"questions":               questionResponses,
		"current_page":            1,
		"total_pages":             1,
		"questions_per_page":      0,
		"is_completed":            session.IsCompleted,
		"is_last_group":           isLastGroup,
		"can_go_back":             currentGroupIndex > 0,
		"existing_answers":        existingAnswerMap,
		"conditional_identifiers": logicResult.ConditionalIdentifiers,
	}, nil
}

func (s *SessionService) GetIdentifiers(sessionID, userID int) (map[string]string, error) {
	var session models.InputForm
	if err := s.DB.Where("id = ? AND user_id = ?", sessionID, userID).First(&session).Error; err != nil {
		return nil, errors.New("session not found")
	}

	var answers []models.SessionAnswer
	s.DB.Where("session_id = ?", sessionID).Find(&answers)

	result := map[string]string{}
	for _, a := range answers {
		var q models.Question
		if err := s.DB.First(&q, a.QuestionID).Error; err == nil {
			result[q.Identifier] = a.AnswerValue
		}
	}
	return result, nil
}

func (s *SessionService) Copy(sessionID, userID int) (*models.InputForm, error) {
	var orig models.InputForm
	if err := s.DB.Where("id = ? AND user_id = ?", sessionID, userID).First(&orig).Error; err != nil {
		return nil, errors.New("session not found")
	}

	newSession := models.InputForm{
		ClientIdentifier: orig.ClientIdentifier + " (Copy)",
		UserID:           userID,
		FlowID:           orig.FlowID,
		CurrentGroupID:   orig.CurrentGroupID,
		IsCompleted:      false,
		CreatedAt:        time.Now().UTC(),
		UpdatedAt:        time.Now().UTC(),
	}

	if err := s.DB.Create(&newSession).Error; err != nil {
		return nil, fmt.Errorf("failed to copy session: %w", err)
	}

	// Copy answers
	var answers []models.SessionAnswer
	s.DB.Where("session_id = ?", sessionID).Find(&answers)
	for _, a := range answers {
		newA := models.SessionAnswer{
			SessionID:   newSession.ID,
			QuestionID:  a.QuestionID,
			AnswerValue: a.AnswerValue,
			CreatedAt:   time.Now().UTC(),
			UpdatedAt:   time.Now().UTC(),
		}
		s.DB.Create(&newA)
	}

	return &newSession, nil
}

func (s *SessionService) VerifyPersistence(sessionID, userID int) (map[string]interface{}, error) {
	var session models.InputForm
	if err := s.DB.Where("id = ? AND user_id = ?", sessionID, userID).First(&session).Error; err != nil {
		return nil, errors.New("session not found")
	}

	var snapshots []models.AnswerSnapshot
	s.DB.Where("session_id = ?", sessionID).Find(&snapshots)

	var answers []models.SessionAnswer
	s.DB.Where("session_id = ?", sessionID).Find(&answers)

	answerMap := map[int]string{}
	for _, a := range answers {
		answerMap[a.QuestionID] = a.AnswerValue
	}

	var mismatches []map[string]interface{}
	for _, snap := range snapshots {
		current, exists := answerMap[snap.QuestionID]
		if !exists || current != snap.AnswerValue {
			mismatches = append(mismatches, map[string]interface{}{
				"question_id":    snap.QuestionID,
				"snapshot_value": snap.AnswerValue,
				"current_value":  current,
				"exists":         exists,
			})
		}
	}

	return map[string]interface{}{
		"ok":         len(mismatches) == 0,
		"mismatches": mismatches,
	}, nil
}

func (s *SessionService) MarkComplete(sessionID, userID int) (*models.InputForm, error) {
	var session models.InputForm
	if err := s.DB.Where("id = ? AND user_id = ?", sessionID, userID).First(&session).Error; err != nil {
		return nil, errors.New("session not found")
	}

	now := time.Now().UTC()
	session.IsCompleted = true
	session.CompletedAt = &now
	session.UpdatedAt = now

	if err := s.DB.Save(&session).Error; err != nil {
		return nil, err
	}
	return &session, nil
}
