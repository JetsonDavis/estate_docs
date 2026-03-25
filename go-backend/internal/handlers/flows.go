package handlers

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/estate-docs/go-backend/internal/middleware"
	"github.com/estate-docs/go-backend/internal/services"
	"github.com/estate-docs/go-backend/internal/utils"
)

type FlowHandler struct {
	Service *services.FlowService
}

func NewFlowHandler(svc *services.FlowService) *FlowHandler {
	return &FlowHandler{Service: svc}
}

func (h *FlowHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.GetUserID(r)

	var input services.FlowCreateInput
	if err := utils.DecodeJSON(r, &input); err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	flow, err := h.Service.Create(input, userID)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	utils.JSON(w, http.StatusCreated, flow)
}

func (h *FlowHandler) List(w http.ResponseWriter, r *http.Request) {
	skip := utils.QueryInt(r, "skip", 0)
	limit := utils.QueryInt(r, "limit", 100)
	search := r.URL.Query().Get("search")

	var searchPtr *string
	if search != "" {
		searchPtr = &search
	}

	flows, total, err := h.Service.List(skip, limit, searchPtr)
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, "Failed to list flows")
		return
	}

	utils.JSON(w, http.StatusOK, map[string]interface{}{
		"flows": flows,
		"total": total,
	})
}

func (h *FlowHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "flow_id"))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid flow ID")
		return
	}

	result, err := h.Service.GetWithGroups(id)
	if err != nil {
		utils.Error(w, http.StatusNotFound, "Flow not found")
		return
	}

	utils.JSON(w, http.StatusOK, result)
}

func (h *FlowHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "flow_id"))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid flow ID")
		return
	}

	var input services.FlowUpdateInput
	if err := utils.DecodeJSON(r, &input); err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	flow, err := h.Service.Update(id, input)
	if err != nil {
		utils.Error(w, http.StatusNotFound, err.Error())
		return
	}

	utils.JSON(w, http.StatusOK, flow)
}

func (h *FlowHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "flow_id"))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid flow ID")
		return
	}

	if err := h.Service.Delete(id); err != nil {
		utils.Error(w, http.StatusNotFound, err.Error())
		return
	}

	utils.JSON(w, http.StatusOK, map[string]string{"message": "Flow deleted"})
}
