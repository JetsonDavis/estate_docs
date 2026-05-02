package services

import (
	"encoding/json"
	"errors"
	"time"

	"github.com/estate-docs/go-backend/internal/models"
	"gorm.io/gorm"
)

type FlowService struct {
	DB *gorm.DB
}

func NewFlowService(db *gorm.DB) *FlowService {
	return &FlowService{DB: db}
}

type FlowCreateInput struct {
	Name             string  `json:"name"`
	Description      *string `json:"description"`
	StartingGroupID  *int    `json:"starting_group_id"`
	QuestionGroupIDs []int   `json:"question_group_ids"`
}

type FlowUpdateInput struct {
	Name             *string          `json:"name"`
	Description      *string          `json:"description"`
	StartingGroupID  *int             `json:"starting_group_id"`
	QuestionGroupIDs []int            `json:"question_group_ids"`
	FlowLogic        *json.RawMessage `json:"flow_logic"`
	IsActive         *bool            `json:"is_active"`
}

func (s *FlowService) Create(input FlowCreateInput, userID int) (*models.DocumentFlow, error) {
	f := models.DocumentFlow{
		Name:            input.Name,
		Description:     input.Description,
		StartingGroupID: input.StartingGroupID,
		CreatedBy:       &userID,
		IsActive:        true,
		CreatedAt:       time.Now().UTC(),
		UpdatedAt:       time.Now().UTC(),
	}

	if err := s.DB.Create(&f).Error; err != nil {
		return nil, err
	}

	// Associate question groups
	if len(input.QuestionGroupIDs) > 0 {
		for i, gid := range input.QuestionGroupIDs {
			fqg := models.FlowQuestionGroup{
				FlowID:          f.ID,
				QuestionGroupID: gid,
				OrderIndex:      i,
			}
			s.DB.Create(&fqg)
		}
	}

	return &f, nil
}

func (s *FlowService) List(skip, limit int, search *string) ([]models.DocumentFlow, int64, error) {
	var flows []models.DocumentFlow
	var total int64

	q := s.DB.Model(&models.DocumentFlow{}).Where("is_active = true")
	if search != nil && *search != "" {
		q = q.Where("name ILIKE ?", "%"+*search+"%")
	}
	q.Count(&total)

	if err := q.Order("id DESC").Offset(skip).Limit(limit).Find(&flows).Error; err != nil {
		return nil, 0, err
	}
	return flows, total, nil
}

func (s *FlowService) GetByID(id int) (*models.DocumentFlow, error) {
	var f models.DocumentFlow
	if err := s.DB.Where("is_active = true").First(&f, id).Error; err != nil {
		return nil, err
	}
	return &f, nil
}

func (s *FlowService) GetWithGroups(id int) (map[string]interface{}, error) {
	var f models.DocumentFlow
	if err := s.DB.Where("is_active = true").First(&f, id).Error; err != nil {
		return nil, err
	}

	// Get associated question groups in order
	var fqgs []models.FlowQuestionGroup
	s.DB.Where("flow_id = ?", f.ID).Order("order_index ASC").Find(&fqgs)

	var groups []map[string]interface{}
	for _, fqg := range fqgs {
		var g models.QuestionGroup
		if err := s.DB.First(&g, fqg.QuestionGroupID).Error; err == nil {
			groups = append(groups, map[string]interface{}{
				"id":            g.ID,
				"name":          g.Name,
				"identifier":    g.Identifier,
				"display_order": g.DisplayOrder,
				"order_index":   fqg.OrderIndex,
			})
		}
	}

	return map[string]interface{}{
		"id":                f.ID,
		"name":              f.Name,
		"description":       f.Description,
		"flow_logic":        f.FlowLogic,
		"starting_group_id": f.StartingGroupID,
		"created_by":        f.CreatedBy,
		"is_active":         f.IsActive,
		"created_at":        f.CreatedAt,
		"updated_at":        f.UpdatedAt,
		"question_groups":   groups,
	}, nil
}

func (s *FlowService) Update(id int, input FlowUpdateInput) (*models.DocumentFlow, error) {
	var f models.DocumentFlow
	if err := s.DB.First(&f, id).Error; err != nil {
		return nil, errors.New("flow not found")
	}

	if input.Name != nil {
		f.Name = *input.Name
	}
	if input.Description != nil {
		f.Description = input.Description
	}
	if input.StartingGroupID != nil {
		f.StartingGroupID = input.StartingGroupID
	}
	if input.FlowLogic != nil {
		f.FlowLogic = input.FlowLogic
	}
	if input.IsActive != nil {
		f.IsActive = *input.IsActive
	}
	f.UpdatedAt = time.Now().UTC()

	if err := s.DB.Save(&f).Error; err != nil {
		return nil, err
	}

	// Update question group associations if provided
	if input.QuestionGroupIDs != nil {
		s.DB.Where("flow_id = ?", f.ID).Delete(&models.FlowQuestionGroup{})
		for i, gid := range input.QuestionGroupIDs {
			fqg := models.FlowQuestionGroup{
				FlowID:          f.ID,
				QuestionGroupID: gid,
				OrderIndex:      i,
			}
			s.DB.Create(&fqg)
		}
	}

	return &f, nil
}

func (s *FlowService) Delete(id int) error {
	var f models.DocumentFlow
	if err := s.DB.First(&f, id).Error; err != nil {
		return errors.New("flow not found")
	}
	f.IsActive = false
	f.UpdatedAt = time.Now().UTC()
	return s.DB.Save(&f).Error
}
