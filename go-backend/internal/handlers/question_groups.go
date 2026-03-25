package handlers

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/estate-docs/go-backend/internal/services"
	"github.com/estate-docs/go-backend/internal/utils"
)

type QuestionGroupHandler struct {
	GroupService    *services.QuestionGroupService
	QuestionService *services.QuestionService
}

func NewQuestionGroupHandler(gs *services.QuestionGroupService, qs *services.QuestionService) *QuestionGroupHandler {
	return &QuestionGroupHandler{GroupService: gs, QuestionService: qs}
}

func (h *QuestionGroupHandler) List(w http.ResponseWriter, r *http.Request) {
	skip := utils.QueryInt(r, "skip", 0)
	limit := utils.QueryInt(r, "limit", 100)
	includeInactive := utils.QueryBool(r, "include_inactive", false)

	groups, total, err := h.GroupService.List(skip, limit, includeInactive)
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, "Failed to list question groups")
		return
	}

	// Build response with question counts
	var resp []map[string]interface{}
	for _, g := range groups {
		questions, _ := h.QuestionService.ListByGroup(g.ID, false)
		qCount := 0
		if questions != nil {
			qCount = len(questions)
		}
		resp = append(resp, map[string]interface{}{
			"id":              g.ID,
			"name":            g.Name,
			"description":     g.Description,
			"identifier":      g.Identifier,
			"display_order":   g.DisplayOrder,
			"question_logic":  g.QuestionLogic,
			"collapsed_items": g.CollapsedItems,
			"is_active":       g.IsActive,
			"created_at":      g.CreatedAt,
			"updated_at":      g.UpdatedAt,
			"question_count":  qCount,
		})
	}

	utils.JSON(w, http.StatusOK, map[string]interface{}{
		"question_groups": resp,
		"total":           total,
	})
}

func (h *QuestionGroupHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "group_id"))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	group, err := h.GroupService.GetByID(id)
	if err != nil {
		utils.Error(w, http.StatusNotFound, "Question group not found")
		return
	}

	questions, _ := h.QuestionService.ListByGroup(id, false)

	utils.JSON(w, http.StatusOK, map[string]interface{}{
		"id":              group.ID,
		"name":            group.Name,
		"description":     group.Description,
		"identifier":      group.Identifier,
		"display_order":   group.DisplayOrder,
		"question_logic":  group.QuestionLogic,
		"collapsed_items": group.CollapsedItems,
		"is_active":       group.IsActive,
		"created_at":      group.CreatedAt,
		"updated_at":      group.UpdatedAt,
		"questions":       questions,
	})
}

func (h *QuestionGroupHandler) Create(w http.ResponseWriter, r *http.Request) {
	var input services.QuestionGroupCreateInput
	if err := utils.DecodeJSON(r, &input); err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	group, err := h.GroupService.Create(input)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	utils.JSON(w, http.StatusCreated, group)
}

func (h *QuestionGroupHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "group_id"))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	var input services.QuestionGroupUpdateInput
	if err := utils.DecodeJSON(r, &input); err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	group, err := h.GroupService.Update(id, input)
	if err != nil {
		utils.Error(w, http.StatusNotFound, err.Error())
		return
	}

	utils.JSON(w, http.StatusOK, group)
}

func (h *QuestionGroupHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "group_id"))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	if err := h.GroupService.Delete(id); err != nil {
		utils.Error(w, http.StatusNotFound, err.Error())
		return
	}

	utils.JSON(w, http.StatusOK, map[string]string{"message": "Question group deleted"})
}

func (h *QuestionGroupHandler) Copy(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "group_id"))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	group, err := h.GroupService.Copy(id)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	utils.JSON(w, http.StatusCreated, group)
}

// Question endpoints within a group

func (h *QuestionGroupHandler) ListQuestions(w http.ResponseWriter, r *http.Request) {
	groupID, err := strconv.Atoi(chi.URLParam(r, "group_id"))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	questions, err := h.QuestionService.ListByGroup(groupID, false)
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, "Failed to list questions")
		return
	}

	utils.JSON(w, http.StatusOK, questions)
}

func (h *QuestionGroupHandler) CreateQuestion(w http.ResponseWriter, r *http.Request) {
	groupID, err := strconv.Atoi(chi.URLParam(r, "group_id"))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid group ID")
		return
	}

	var input services.QuestionCreateInput
	if err := utils.DecodeJSON(r, &input); err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	input.QuestionGroupID = groupID

	question, err := h.QuestionService.Create(input)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	utils.JSON(w, http.StatusCreated, question)
}

func (h *QuestionGroupHandler) UpdateQuestion(w http.ResponseWriter, r *http.Request) {
	questionID, err := strconv.Atoi(chi.URLParam(r, "question_id"))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid question ID")
		return
	}

	var input services.QuestionUpdateInput
	if err := utils.DecodeJSON(r, &input); err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	question, err := h.QuestionService.Update(questionID, input)
	if err != nil {
		utils.Error(w, http.StatusNotFound, err.Error())
		return
	}

	utils.JSON(w, http.StatusOK, question)
}

func (h *QuestionGroupHandler) DeleteQuestion(w http.ResponseWriter, r *http.Request) {
	questionID, err := strconv.Atoi(chi.URLParam(r, "question_id"))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid question ID")
		return
	}

	if err := h.QuestionService.Delete(questionID); err != nil {
		utils.Error(w, http.StatusNotFound, err.Error())
		return
	}

	utils.JSON(w, http.StatusOK, map[string]string{"message": "Question deleted"})
}

func (h *QuestionGroupHandler) CheckIdentifier(w http.ResponseWriter, r *http.Request) {
	identifier := utils.QueryString(r, "identifier", "")
	if identifier == "" {
		utils.Error(w, http.StatusBadRequest, "Identifier is required")
		return
	}

	_, err := h.QuestionService.GetByIdentifier(identifier)
	exists := err == nil

	utils.JSON(w, http.StatusOK, map[string]interface{}{
		"identifier": identifier,
		"exists":     exists,
	})
}
