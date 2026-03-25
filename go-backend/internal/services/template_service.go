package services

import (
	"errors"
	"strings"
	"time"

	"github.com/estate-docs/go-backend/internal/models"
	"gorm.io/gorm"
)

type TemplateService struct {
	DB *gorm.DB
}

func NewTemplateService(db *gorm.DB) *TemplateService {
	return &TemplateService{DB: db}
}

type TemplateCreateInput struct {
	Name             string  `json:"name"`
	Description      *string `json:"description"`
	TemplateType     string  `json:"template_type"`
	MarkdownContent  string  `json:"markdown_content"`
	OriginalFilename *string `json:"original_filename"`
	OriginalFilePath *string `json:"original_file_path"`
}

type TemplateUpdateInput struct {
	Name            *string `json:"name"`
	Description     *string `json:"description"`
	MarkdownContent *string `json:"markdown_content"`
}

func (s *TemplateService) Create(input TemplateCreateInput, userID int) (*models.Template, error) {
	t := models.Template{
		Name:             input.Name,
		Description:      input.Description,
		TemplateType:     input.TemplateType,
		MarkdownContent:  input.MarkdownContent,
		OriginalFilename: input.OriginalFilename,
		OriginalFilePath: input.OriginalFilePath,
		CreatedBy:        &userID,
		IsActive:         true,
		CreatedAt:        time.Now().UTC(),
		UpdatedAt:        time.Now().UTC(),
	}

	// Extract and store identifiers
	ids := t.ExtractIdentifiers()
	if len(ids) > 0 {
		joined := strings.Join(ids, ",")
		t.Identifiers = &joined
	}

	if err := s.DB.Create(&t).Error; err != nil {
		return nil, err
	}
	return &t, nil
}

func (s *TemplateService) List(skip, limit int, search *string) ([]models.Template, int64, error) {
	var templates []models.Template
	var total int64

	q := s.DB.Model(&models.Template{}).Where("is_active = true")
	if search != nil && *search != "" {
		q = q.Where("name ILIKE ?", "%"+*search+"%")
	}
	q.Count(&total)

	if err := q.Order("id DESC").Offset(skip).Limit(limit).Find(&templates).Error; err != nil {
		return nil, 0, err
	}
	return templates, total, nil
}

func (s *TemplateService) GetByID(id int) (*models.Template, error) {
	var t models.Template
	if err := s.DB.Where("is_active = true").First(&t, id).Error; err != nil {
		return nil, err
	}
	return &t, nil
}

func (s *TemplateService) Update(id int, input TemplateUpdateInput) (*models.Template, error) {
	var t models.Template
	if err := s.DB.First(&t, id).Error; err != nil {
		return nil, errors.New("template not found")
	}

	if input.Name != nil {
		t.Name = *input.Name
	}
	if input.Description != nil {
		t.Description = input.Description
	}
	if input.MarkdownContent != nil {
		t.MarkdownContent = *input.MarkdownContent
		ids := t.ExtractIdentifiers()
		if len(ids) > 0 {
			joined := strings.Join(ids, ",")
			t.Identifiers = &joined
		}
	}
	t.UpdatedAt = time.Now().UTC()

	if err := s.DB.Save(&t).Error; err != nil {
		return nil, err
	}
	return &t, nil
}

func (s *TemplateService) Delete(id int) error {
	var t models.Template
	if err := s.DB.First(&t, id).Error; err != nil {
		return errors.New("template not found")
	}
	t.IsActive = false
	t.UpdatedAt = time.Now().UTC()
	return s.DB.Save(&t).Error
}

func (s *TemplateService) Duplicate(id, userID int) (*models.Template, error) {
	var orig models.Template
	if err := s.DB.First(&orig, id).Error; err != nil {
		return nil, errors.New("template not found")
	}

	dup := models.Template{
		Name:             orig.Name + " (Copy)",
		Description:      orig.Description,
		TemplateType:     orig.TemplateType,
		MarkdownContent:  orig.MarkdownContent,
		Identifiers:      orig.Identifiers,
		OriginalFilename: orig.OriginalFilename,
		OriginalFilePath: orig.OriginalFilePath,
		CreatedBy:        &userID,
		IsActive:         true,
		CreatedAt:        time.Now().UTC(),
		UpdatedAt:        time.Now().UTC(),
	}

	if err := s.DB.Create(&dup).Error; err != nil {
		return nil, err
	}
	return &dup, nil
}

func (s *TemplateService) GetIdentifiers(id int) ([]string, error) {
	var t models.Template
	if err := s.DB.First(&t, id).Error; err != nil {
		return nil, errors.New("template not found")
	}
	return t.ExtractIdentifiers(), nil
}
