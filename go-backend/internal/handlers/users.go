package handlers

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/estate-docs/go-backend/internal/services"
	"github.com/estate-docs/go-backend/internal/utils"
)

type UserHandler struct {
	Service *services.UserService
}

func NewUserHandler(svc *services.UserService) *UserHandler {
	return &UserHandler{Service: svc}
}

func (h *UserHandler) List(w http.ResponseWriter, r *http.Request) {
	skip := utils.QueryInt(r, "skip", 0)
	limit := utils.QueryInt(r, "limit", 100)
	includeInactive := utils.QueryBool(r, "include_inactive", false)

	users, total, err := h.Service.ListUsers(skip, limit, includeInactive)
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, "Failed to list users")
		return
	}

	var resp []interface{}
	for _, u := range users {
		resp = append(resp, u.ToResponse())
	}

	utils.JSON(w, http.StatusOK, map[string]interface{}{
		"users": resp,
		"total": total,
	})
}

func (h *UserHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "user_id"))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	user, err := h.Service.GetByID(id)
	if err != nil {
		utils.Error(w, http.StatusNotFound, "User not found")
		return
	}

	utils.JSON(w, http.StatusOK, user.ToResponse())
}

func (h *UserHandler) Create(w http.ResponseWriter, r *http.Request) {
	var input services.UserCreateInput
	if err := utils.DecodeJSON(r, &input); err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	user, err := h.Service.CreateUser(input)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	utils.JSON(w, http.StatusCreated, user.ToResponse())
}

func (h *UserHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "user_id"))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	var input services.UserUpdateInput
	if err := utils.DecodeJSON(r, &input); err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	user, err := h.Service.UpdateUser(id, input)
	if err != nil {
		utils.Error(w, http.StatusNotFound, err.Error())
		return
	}

	utils.JSON(w, http.StatusOK, user.ToResponse())
}

func (h *UserHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "user_id"))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	if err := h.Service.DeleteUser(id); err != nil {
		utils.Error(w, http.StatusNotFound, err.Error())
		return
	}

	utils.JSON(w, http.StatusOK, map[string]string{"message": "User deleted successfully"})
}
