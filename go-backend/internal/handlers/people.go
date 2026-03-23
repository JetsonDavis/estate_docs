package handlers

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/estate-docs/go-backend/internal/services"
	"github.com/estate-docs/go-backend/internal/utils"
)

type PeopleHandler struct {
	Service *services.PersonService
}

func NewPeopleHandler(svc *services.PersonService) *PeopleHandler {
	return &PeopleHandler{Service: svc}
}

func (h *PeopleHandler) Create(w http.ResponseWriter, r *http.Request) {
	var input services.PersonCreateInput
	if err := utils.DecodeJSON(r, &input); err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	person, err := h.Service.Create(input)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	utils.JSON(w, http.StatusCreated, person)
}

func (h *PeopleHandler) List(w http.ResponseWriter, r *http.Request) {
	skip := utils.QueryInt(r, "skip", 0)
	limit := utils.QueryInt(r, "limit", 100)
	includeInactive := utils.QueryBool(r, "include_inactive", false)
	search := r.URL.Query().Get("search")

	var searchPtr *string
	if search != "" {
		searchPtr = &search
	}

	people, total, err := h.Service.List(skip, limit, includeInactive, searchPtr)
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, "Failed to list people")
		return
	}

	utils.JSON(w, http.StatusOK, map[string]interface{}{
		"people": people,
		"total":  total,
	})
}

func (h *PeopleHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "person_id"))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid person ID")
		return
	}

	person, err := h.Service.GetByID(id)
	if err != nil {
		utils.Error(w, http.StatusNotFound, "Person not found")
		return
	}

	utils.JSON(w, http.StatusOK, person)
}

func (h *PeopleHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "person_id"))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid person ID")
		return
	}

	var input services.PersonUpdateInput
	if err := utils.DecodeJSON(r, &input); err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	person, err := h.Service.Update(id, input)
	if err != nil {
		utils.Error(w, http.StatusNotFound, err.Error())
		return
	}

	utils.JSON(w, http.StatusOK, person)
}

func (h *PeopleHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "person_id"))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid person ID")
		return
	}

	if err := h.Service.Delete(id); err != nil {
		utils.Error(w, http.StatusNotFound, err.Error())
		return
	}

	utils.JSON(w, http.StatusOK, map[string]string{"message": "Person deleted"})
}

func (h *PeopleHandler) AddRelationship(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "person_id"))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid person ID")
		return
	}

	var input services.PersonRelationshipInput
	if err := utils.DecodeJSON(r, &input); err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := h.Service.AddRelationship(id, input); err != nil {
		utils.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	utils.JSON(w, http.StatusCreated, map[string]string{"message": "Relationship added"})
}

func (h *PeopleHandler) RemoveRelationship(w http.ResponseWriter, r *http.Request) {
	personID, err := strconv.Atoi(chi.URLParam(r, "person_id"))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid person ID")
		return
	}
	relatedID, err := strconv.Atoi(chi.URLParam(r, "related_person_id"))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid related person ID")
		return
	}

	if err := h.Service.RemoveRelationship(personID, relatedID); err != nil {
		utils.Error(w, http.StatusNotFound, err.Error())
		return
	}

	utils.JSON(w, http.StatusOK, map[string]string{"message": "Relationship removed"})
}

func (h *PeopleHandler) GetRelationships(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "person_id"))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid person ID")
		return
	}

	rels, err := h.Service.GetRelationships(id)
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, "Failed to get relationships")
		return
	}

	utils.JSON(w, http.StatusOK, map[string]interface{}{"relationships": rels})
}
