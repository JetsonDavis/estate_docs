package handlers

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/estate-docs/go-backend/internal/middleware"
	"github.com/estate-docs/go-backend/internal/services"
	"github.com/estate-docs/go-backend/internal/utils"
)

type DocumentHandler struct {
	Service *services.DocumentService
}

func NewDocumentHandler(svc *services.DocumentService) *DocumentHandler {
	return &DocumentHandler{Service: svc}
}

func (h *DocumentHandler) Generate(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.GetUserID(r)

	var input services.GenerateDocumentInput
	if err := utils.DecodeJSON(r, &input); err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	doc, err := h.Service.Generate(input, userID)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	utils.JSON(w, http.StatusCreated, doc)
}

func (h *DocumentHandler) Preview(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.GetUserID(r)
	sessionID := utils.QueryInt(r, "session_id", 0)
	templateID := utils.QueryInt(r, "template_id", 0)

	if sessionID == 0 || templateID == 0 {
		utils.Error(w, http.StatusBadRequest, "session_id and template_id are required")
		return
	}

	result, err := h.Service.Preview(sessionID, templateID, userID)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	utils.JSON(w, http.StatusOK, result)
}

func (h *DocumentHandler) List(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.GetUserID(r)
	skip := utils.QueryInt(r, "skip", 0)
	limit := utils.QueryInt(r, "limit", 100)

	docs, total, err := h.Service.List(userID, skip, limit)
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, "Failed to list documents")
		return
	}

	utils.JSON(w, http.StatusOK, map[string]interface{}{
		"documents": docs,
		"total":     total,
	})
}

func (h *DocumentHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.GetUserID(r)
	id, err := strconv.Atoi(chi.URLParam(r, "document_id"))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid document ID")
		return
	}

	doc, err := h.Service.GetByID(id, userID)
	if err != nil {
		utils.Error(w, http.StatusNotFound, "Document not found")
		return
	}

	utils.JSON(w, http.StatusOK, doc)
}

func (h *DocumentHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.GetUserID(r)
	id, err := strconv.Atoi(chi.URLParam(r, "document_id"))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid document ID")
		return
	}

	if err := h.Service.Delete(id, userID); err != nil {
		utils.Error(w, http.StatusNotFound, err.Error())
		return
	}

	utils.JSON(w, http.StatusOK, map[string]string{"message": "Document deleted"})
}

func (h *DocumentHandler) Merge(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.GetUserID(r)

	var input struct {
		SessionID  int `json:"session_id"`
		TemplateID int `json:"template_id"`
	}
	if err := utils.DecodeJSON(r, &input); err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	content, filename, err := h.Service.MergeDocument(input.SessionID, input.TemplateID, userID)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", "attachment; filename=\""+filename+"\"")
	w.WriteHeader(http.StatusOK)
	w.Write(content)
}
