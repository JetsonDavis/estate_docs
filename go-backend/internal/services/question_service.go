package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/estate-docs/go-backend/internal/models"
	"gorm.io/gorm"
)

type QuestionGroupService struct {
	DB *gorm.DB
}

func NewQuestionGroupService(db *gorm.DB) *QuestionGroupService {
	return &QuestionGroupService{DB: db}
}

type QuestionGroupCreateInput struct {
	Name           string           `json:"name"`
	Description    *string          `json:"description"`
	Identifier     string           `json:"identifier"`
	DisplayOrder   int              `json:"display_order"`
	QuestionLogic  *json.RawMessage `json:"question_logic"`
	CollapsedItems *json.RawMessage `json:"collapsed_items"`
}

type QuestionGroupUpdateInput struct {
	Name           *string          `json:"name"`
	Description    *string          `json:"description"`
	Identifier     *string          `json:"identifier"`
	DisplayOrder   *int             `json:"display_order"`
	QuestionLogic  *json.RawMessage `json:"question_logic"`
	CollapsedItems *json.RawMessage `json:"collapsed_items"`
	IsActive       *bool            `json:"is_active"`
}

func (s *QuestionGroupService) List(skip, limit int, includeInactive bool) ([]models.QuestionGroup, int64, error) {
	var groups []models.QuestionGroup
	var total int64

	q := s.DB.Model(&models.QuestionGroup{})
	if !includeInactive {
		q = q.Where("is_active = true")
	}
	q.Count(&total)

	if err := q.Order("display_order ASC, id ASC").Offset(skip).Limit(limit).Find(&groups).Error; err != nil {
		return nil, 0, err
	}
	return groups, total, nil
}

func (s *QuestionGroupService) GetByID(id int) (*models.QuestionGroup, error) {
	var g models.QuestionGroup
	if err := s.DB.First(&g, id).Error; err != nil {
		return nil, err
	}
	return &g, nil
}

func (s *QuestionGroupService) Create(input QuestionGroupCreateInput) (*models.QuestionGroup, error) {
	g := models.QuestionGroup{
		Name:           input.Name,
		Description:    input.Description,
		Identifier:     input.Identifier,
		DisplayOrder:   input.DisplayOrder,
		QuestionLogic:  input.QuestionLogic,
		CollapsedItems: input.CollapsedItems,
		IsActive:       true,
		CreatedAt:      time.Now().UTC(),
		UpdatedAt:      time.Now().UTC(),
	}
	if err := s.DB.Create(&g).Error; err != nil {
		return nil, err
	}
	return &g, nil
}

func (s *QuestionGroupService) Update(id int, input QuestionGroupUpdateInput) (*models.QuestionGroup, error) {
	var g models.QuestionGroup
	if err := s.DB.First(&g, id).Error; err != nil {
		return nil, errors.New("question group not found")
	}

	if input.Name != nil {
		g.Name = *input.Name
	}
	if input.Description != nil {
		g.Description = input.Description
	}
	if input.Identifier != nil {
		g.Identifier = *input.Identifier
	}
	if input.DisplayOrder != nil {
		g.DisplayOrder = *input.DisplayOrder
	}
	if input.QuestionLogic != nil {
		g.QuestionLogic = input.QuestionLogic
	}
	if input.CollapsedItems != nil {
		g.CollapsedItems = input.CollapsedItems
	}
	if input.IsActive != nil {
		g.IsActive = *input.IsActive
	}
	g.UpdatedAt = time.Now().UTC()

	if err := s.DB.Save(&g).Error; err != nil {
		return nil, err
	}
	return &g, nil
}

func (s *QuestionGroupService) Delete(id int) error {
	var g models.QuestionGroup
	if err := s.DB.First(&g, id).Error; err != nil {
		return errors.New("question group not found")
	}
	g.IsActive = false
	g.UpdatedAt = time.Now().UTC()
	return s.DB.Save(&g).Error
}

func (s *QuestionGroupService) Copy(id int) (*models.QuestionGroup, error) {
	var orig models.QuestionGroup
	if err := s.DB.First(&orig, id).Error; err != nil {
		return nil, errors.New("question group not found")
	}

	copy := models.QuestionGroup{
		Name:           orig.Name + " (Copy)",
		Description:    orig.Description,
		Identifier:     orig.Identifier + "_copy",
		DisplayOrder:   orig.DisplayOrder,
		QuestionLogic:  orig.QuestionLogic,
		CollapsedItems: orig.CollapsedItems,
		IsActive:       true,
		CreatedAt:      time.Now().UTC(),
		UpdatedAt:      time.Now().UTC(),
	}

	if err := s.DB.Create(&copy).Error; err != nil {
		return nil, fmt.Errorf("failed to copy group: %w", err)
	}

	// Copy questions
	var questions []models.Question
	s.DB.Where("question_group_id = ? AND is_active = true", id).Find(&questions)

	for _, q := range questions {
		newQ := q
		newQ.ID = 0
		newQ.QuestionGroupID = copy.ID
		newQ.CreatedAt = time.Now().UTC()
		newQ.UpdatedAt = time.Now().UTC()
		s.DB.Create(&newQ)
	}

	return &copy, nil
}

// QuestionService handles question CRUD within groups.
type QuestionService struct {
	DB *gorm.DB
}

func NewQuestionService(db *gorm.DB) *QuestionService {
	return &QuestionService{DB: db}
}

type QuestionCreateInput struct {
	QuestionGroupID   int              `json:"question_group_id"`
	QuestionText      string           `json:"question_text"`
	QuestionType      string           `json:"question_type"`
	Identifier        string           `json:"identifier"`
	Repeatable        bool             `json:"repeatable"`
	RepeatableGroupID *string          `json:"repeatable_group_id"`
	DisplayOrder      int              `json:"display_order"`
	IsRequired        bool             `json:"is_required"`
	HelpText          *string          `json:"help_text"`
	Options           *json.RawMessage `json:"options"`
	DatabaseTable     *string          `json:"database_table"`
	DatabaseValueCol  *string          `json:"database_value_column"`
	DatabaseLabelCol  *string          `json:"database_label_column"`
	PersonDisplayMode *string          `json:"person_display_mode"`
	IncludeTime       *bool            `json:"include_time"`
	ValidationRules   *json.RawMessage `json:"validation_rules"`
}

type QuestionUpdateInput struct {
	QuestionText      *string          `json:"question_text"`
	QuestionType      *string          `json:"question_type"`
	Identifier        *string          `json:"identifier"`
	Repeatable        *bool            `json:"repeatable"`
	RepeatableGroupID *string          `json:"repeatable_group_id"`
	DisplayOrder      *int             `json:"display_order"`
	IsRequired        *bool            `json:"is_required"`
	HelpText          *string          `json:"help_text"`
	Options           *json.RawMessage `json:"options"`
	DatabaseTable     *string          `json:"database_table"`
	DatabaseValueCol  *string          `json:"database_value_column"`
	DatabaseLabelCol  *string          `json:"database_label_column"`
	PersonDisplayMode *string          `json:"person_display_mode"`
	IncludeTime       *bool            `json:"include_time"`
	ValidationRules   *json.RawMessage `json:"validation_rules"`
	IsActive          *bool            `json:"is_active"`
}

func (s *QuestionService) ListByGroup(groupID int, includeInactive bool) ([]models.Question, error) {
	var questions []models.Question
	q := s.DB.Where("question_group_id = ?", groupID)
	if !includeInactive {
		q = q.Where("is_active = true")
	}
	if err := q.Order("display_order ASC").Find(&questions).Error; err != nil {
		return nil, err
	}
	return questions, nil
}

func (s *QuestionService) Create(input QuestionCreateInput) (*models.Question, error) {
	question := models.Question{
		QuestionGroupID:   input.QuestionGroupID,
		QuestionText:      input.QuestionText,
		QuestionType:      input.QuestionType,
		Identifier:        input.Identifier,
		Repeatable:        input.Repeatable,
		RepeatableGroupID: input.RepeatableGroupID,
		DisplayOrder:      input.DisplayOrder,
		IsRequired:        input.IsRequired,
		HelpText:          input.HelpText,
		Options:           input.Options,
		DatabaseTable:     input.DatabaseTable,
		DatabaseValueCol:  input.DatabaseValueCol,
		DatabaseLabelCol:  input.DatabaseLabelCol,
		PersonDisplayMode: input.PersonDisplayMode,
		IncludeTime:       input.IncludeTime,
		ValidationRules:   input.ValidationRules,
		IsActive:          true,
		CreatedAt:         time.Now().UTC(),
		UpdatedAt:         time.Now().UTC(),
	}
	if err := s.DB.Create(&question).Error; err != nil {
		return nil, err
	}
	return &question, nil
}

func (s *QuestionService) Update(id int, input QuestionUpdateInput) (*models.Question, error) {
	var q models.Question
	if err := s.DB.First(&q, id).Error; err != nil {
		return nil, errors.New("question not found")
	}

	if input.QuestionText != nil {
		q.QuestionText = *input.QuestionText
	}
	if input.QuestionType != nil {
		q.QuestionType = *input.QuestionType
	}
	if input.Identifier != nil {
		q.Identifier = *input.Identifier
	}
	if input.Repeatable != nil {
		q.Repeatable = *input.Repeatable
	}
	if input.RepeatableGroupID != nil {
		q.RepeatableGroupID = input.RepeatableGroupID
	}
	if input.DisplayOrder != nil {
		q.DisplayOrder = *input.DisplayOrder
	}
	if input.IsRequired != nil {
		q.IsRequired = *input.IsRequired
	}
	if input.HelpText != nil {
		q.HelpText = input.HelpText
	}
	if input.Options != nil {
		q.Options = input.Options
	}
	if input.DatabaseTable != nil {
		q.DatabaseTable = input.DatabaseTable
	}
	if input.DatabaseValueCol != nil {
		q.DatabaseValueCol = input.DatabaseValueCol
	}
	if input.DatabaseLabelCol != nil {
		q.DatabaseLabelCol = input.DatabaseLabelCol
	}
	if input.PersonDisplayMode != nil {
		q.PersonDisplayMode = input.PersonDisplayMode
	}
	if input.IncludeTime != nil {
		q.IncludeTime = input.IncludeTime
	}
	if input.ValidationRules != nil {
		q.ValidationRules = input.ValidationRules
	}
	if input.IsActive != nil {
		q.IsActive = *input.IsActive
	}
	q.UpdatedAt = time.Now().UTC()

	if err := s.DB.Save(&q).Error; err != nil {
		return nil, err
	}
	return &q, nil
}

func (s *QuestionService) Delete(id int) error {
	var q models.Question
	if err := s.DB.First(&q, id).Error; err != nil {
		return errors.New("question not found")
	}
	q.IsActive = false
	q.UpdatedAt = time.Now().UTC()
	return s.DB.Save(&q).Error
}

func (s *QuestionService) GetByIdentifier(identifier string) (*models.Question, error) {
	var q models.Question
	if err := s.DB.Where("identifier = ?", identifier).First(&q).Error; err != nil {
		return nil, err
	}
	return &q, nil
}
