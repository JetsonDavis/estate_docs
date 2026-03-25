package handlers

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/estate-docs/go-backend/internal/middleware"
	"github.com/estate-docs/go-backend/internal/services"
	"github.com/estate-docs/go-backend/internal/utils"
)

type TemplateHandler struct {
	Service *services.TemplateService
}

func NewTemplateHandler(svc *services.TemplateService) *TemplateHandler {
	return &TemplateHandler{Service: svc}
}

func (h *TemplateHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.GetUserID(r)

	var input services.TemplateCreateInput
	if err := utils.DecodeJSON(r, &input); err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	tmpl, err := h.Service.Create(input, userID)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	utils.JSON(w, http.StatusCreated, tmpl)
}

func (h *TemplateHandler) List(w http.ResponseWriter, r *http.Request) {
	skip := utils.QueryInt(r, "skip", 0)
	limit := utils.QueryInt(r, "limit", 100)
	search := r.URL.Query().Get("search")

	var searchPtr *string
	if search != "" {
		searchPtr = &search
	}

	templates, total, err := h.Service.List(skip, limit, searchPtr)
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, "Failed to list templates")
		return
	}

	utils.JSON(w, http.StatusOK, map[string]interface{}{
		"templates": templates,
		"total":     total,
	})
}

func (h *TemplateHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "template_id"))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid template ID")
		return
	}

	tmpl, err := h.Service.GetByID(id)
	if err != nil {
		utils.Error(w, http.StatusNotFound, "Template not found")
		return
	}

	utils.JSON(w, http.StatusOK, tmpl)
}

func (h *TemplateHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "template_id"))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid template ID")
		return
	}

	var input services.TemplateUpdateInput
	if err := utils.DecodeJSON(r, &input); err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	tmpl, err := h.Service.Update(id, input)
	if err != nil {
		utils.Error(w, http.StatusNotFound, err.Error())
		return
	}

	utils.JSON(w, http.StatusOK, tmpl)
}

func (h *TemplateHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "template_id"))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid template ID")
		return
	}

	if err := h.Service.Delete(id); err != nil {
		utils.Error(w, http.StatusNotFound, err.Error())
		return
	}

	utils.JSON(w, http.StatusOK, map[string]string{"message": "Template deleted"})
}

func (h *TemplateHandler) Duplicate(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "template_id"))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid template ID")
		return
	}

	userID, _ := middleware.GetUserID(r)

	tmpl, err := h.Service.Duplicate(id, userID)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	utils.JSON(w, http.StatusCreated, tmpl)
}

func (h *TemplateHandler) GetIdentifiers(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "template_id"))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid template ID")
		return
	}

	ids, err := h.Service.GetIdentifiers(id)
	if err != nil {
		utils.Error(w, http.StatusNotFound, err.Error())
		return
	}

	utils.JSON(w, http.StatusOK, map[string]interface{}{"identifiers": ids})
}

func (h *TemplateHandler) Upload(w http.ResponseWriter, r *http.Request) {
	// Parse multipart form (max 10MB)
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		utils.Error(w, http.StatusBadRequest, "File too large or invalid form data")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "No file uploaded")
		return
	}
	defer file.Close()

	// TODO: Convert uploaded file to markdown
	// For now, return the filename as a placeholder
	utils.JSON(w, http.StatusOK, map[string]interface{}{
		"filename":         header.Filename,
		"markdown_content": "<!-- Uploaded file: " + header.Filename + " -->\n\nFile content conversion pending.",
		"message":          "File uploaded successfully. Conversion to markdown is pending.",
	})
}
