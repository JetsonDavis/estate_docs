package handlers

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/estate-docs/go-backend/internal/middleware"
	"github.com/estate-docs/go-backend/internal/services"
	"github.com/estate-docs/go-backend/internal/utils"
)

type SessionHandler struct {
	Service *services.SessionService
}

func NewSessionHandler(svc *services.SessionService) *SessionHandler {
	return &SessionHandler{Service: svc}
}

func (h *SessionHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.GetUserID(r)

	var input services.SessionCreateInput
	if err := utils.DecodeJSON(r, &input); err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	session, err := h.Service.Create(input, userID)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	utils.JSON(w, http.StatusCreated, session.ToResponse())
}

func (h *SessionHandler) List(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.GetUserID(r)
	skip := utils.QueryInt(r, "skip", 0)
	limit := utils.QueryInt(r, "limit", 100)

	sessions, total, err := h.Service.List(userID, skip, limit)
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, "Failed to list sessions")
		return
	}

	var resp []interface{}
	for _, s := range sessions {
		resp = append(resp, s.ToResponse())
	}

	utils.JSON(w, http.StatusOK, map[string]interface{}{
		"sessions": resp,
		"total":    total,
	})
}

func (h *SessionHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.GetUserID(r)
	id, err := strconv.Atoi(chi.URLParam(r, "session_id"))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid session ID")
		return
	}

	session, err := h.Service.GetByID(id, userID)
	if err != nil {
		utils.Error(w, http.StatusNotFound, "Session not found")
		return
	}

	utils.JSON(w, http.StatusOK, session.ToResponse())
}

func (h *SessionHandler) GetQuestions(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.GetUserID(r)
	id, err := strconv.Atoi(chi.URLParam(r, "session_id"))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid session ID")
		return
	}

	result, err := h.Service.GetQuestions(id, userID)
	if err != nil {
		utils.Error(w, http.StatusNotFound, err.Error())
		return
	}

	utils.JSON(w, http.StatusOK, result)
}

func (h *SessionHandler) SubmitAnswers(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.GetUserID(r)
	id, err := strconv.Atoi(chi.URLParam(r, "session_id"))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid session ID")
		return
	}

	var input struct {
		Answers []services.AnswerInput `json:"answers"`
	}
	if err := utils.DecodeJSON(r, &input); err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	session, err := h.Service.SubmitAnswers(id, userID, input.Answers)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	utils.JSON(w, http.StatusOK, session.ToResponse())
}

func (h *SessionHandler) SaveAnswers(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.GetUserID(r)
	id, err := strconv.Atoi(chi.URLParam(r, "session_id"))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid session ID")
		return
	}

	var input struct {
		Answers []services.AnswerInput `json:"answers"`
	}
	if err := utils.DecodeJSON(r, &input); err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := h.Service.SaveAnswers(id, userID, input.Answers); err != nil {
		utils.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	utils.JSON(w, http.StatusOK, map[string]string{"message": "Answers saved"})
}

func (h *SessionHandler) DeleteAnswers(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.GetUserID(r)
	id, err := strconv.Atoi(chi.URLParam(r, "session_id"))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid session ID")
		return
	}

	var input services.DeleteAnswersInput
	if err := utils.DecodeJSON(r, &input); err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := h.Service.DeleteAnswers(id, userID, input.QuestionIDs); err != nil {
		utils.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	utils.JSON(w, http.StatusOK, map[string]string{"message": "Answers deleted"})
}

func (h *SessionHandler) Navigate(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.GetUserID(r)
	id, err := strconv.Atoi(chi.URLParam(r, "session_id"))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid session ID")
		return
	}

	var input services.NavigateInput
	if err := utils.DecodeJSON(r, &input); err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	session, err := h.Service.Navigate(id, userID, input.Direction, input.Answers)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	utils.JSON(w, http.StatusOK, session.ToResponse())
}

func (h *SessionHandler) GetIdentifiers(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.GetUserID(r)
	id, err := strconv.Atoi(chi.URLParam(r, "session_id"))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid session ID")
		return
	}

	ids, err := h.Service.GetIdentifiers(id, userID)
	if err != nil {
		utils.Error(w, http.StatusNotFound, err.Error())
		return
	}

	utils.JSON(w, http.StatusOK, ids)
}

func (h *SessionHandler) Copy(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.GetUserID(r)
	id, err := strconv.Atoi(chi.URLParam(r, "session_id"))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid session ID")
		return
	}

	session, err := h.Service.Copy(id, userID)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	utils.JSON(w, http.StatusCreated, session.ToResponse())
}

func (h *SessionHandler) VerifyPersistence(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.GetUserID(r)
	id, err := strconv.Atoi(chi.URLParam(r, "session_id"))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid session ID")
		return
	}

	result, err := h.Service.VerifyPersistence(id, userID)
	if err != nil {
		utils.Error(w, http.StatusNotFound, err.Error())
		return
	}

	utils.JSON(w, http.StatusOK, result)
}

func (h *SessionHandler) MarkComplete(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.GetUserID(r)
	id, err := strconv.Atoi(chi.URLParam(r, "session_id"))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid session ID")
		return
	}

	session, err := h.Service.MarkComplete(id, userID)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	utils.JSON(w, http.StatusOK, session.ToResponse())
}

func (h *SessionHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.GetUserID(r)
	id, err := strconv.Atoi(chi.URLParam(r, "session_id"))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid session ID")
		return
	}

	if err := h.Service.Delete(id, userID); err != nil {
		utils.Error(w, http.StatusNotFound, err.Error())
		return
	}

	utils.JSON(w, http.StatusOK, map[string]string{"message": "Session deleted"})
}

func (h *SessionHandler) GetProgress(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.GetUserID(r)
	id, err := strconv.Atoi(chi.URLParam(r, "session_id"))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid session ID")
		return
	}

	session, err := h.Service.GetByID(id, userID)
	if err != nil {
		utils.Error(w, http.StatusNotFound, "Session not found")
		return
	}

	answers, _ := h.Service.GetAnswers(id, userID)

	utils.JSON(w, http.StatusOK, map[string]interface{}{
		"session_id":       session.ID,
		"current_group_id": session.CurrentGroupID,
		"is_completed":     session.IsCompleted,
		"answers_count":    len(answers),
	})
}
