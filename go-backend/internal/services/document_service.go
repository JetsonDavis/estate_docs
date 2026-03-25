package services

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/estate-docs/go-backend/internal/models"
	"gorm.io/gorm"
)

type DocumentService struct {
	DB *gorm.DB
}

func NewDocumentService(db *gorm.DB) *DocumentService {
	return &DocumentService{DB: db}
}

type GenerateDocumentInput struct {
	SessionID    int    `json:"session_id"`
	TemplateID   int    `json:"template_id"`
	DocumentName string `json:"document_name"`
}

func (s *DocumentService) Generate(input GenerateDocumentInput, userID int) (*models.GeneratedDocument, error) {
	// Verify session
	var session models.InputForm
	if err := s.DB.Where("id = ? AND user_id = ?", input.SessionID, userID).First(&session).Error; err != nil {
		return nil, errors.New("session not found")
	}

	// Get template
	var tmpl models.Template
	if err := s.DB.First(&tmpl, input.TemplateID).Error; err != nil {
		return nil, errors.New("template not found")
	}

	// Get answers
	identifiers := s.getSessionIdentifiers(input.SessionID)

	// Merge template
	merged := s.mergeContent(tmpl.MarkdownContent, identifiers)

	docName := input.DocumentName
	if docName == "" {
		docName = fmt.Sprintf("%s - %s", tmpl.Name, session.ClientIdentifier)
	}

	s3Key := fmt.Sprintf("documents/%d/%d/%s.md", userID, input.SessionID, docName)

	doc := models.GeneratedDocument{
		SessionID:       input.SessionID,
		TemplateID:      &input.TemplateID,
		DocumentName:    docName,
		S3Key:           s3Key,
		MarkdownContent: &merged,
		GeneratedBy:     &userID,
		GeneratedAt:     time.Now().UTC(),
		CreatedAt:       time.Now().UTC(),
		UpdatedAt:       time.Now().UTC(),
	}

	if err := s.DB.Create(&doc).Error; err != nil {
		return nil, fmt.Errorf("failed to save document: %w", err)
	}
	return &doc, nil
}

func (s *DocumentService) Preview(sessionID, templateID, userID int) (map[string]interface{}, error) {
	var session models.InputForm
	if err := s.DB.Where("id = ? AND user_id = ?", sessionID, userID).First(&session).Error; err != nil {
		return nil, errors.New("session not found")
	}

	var tmpl models.Template
	if err := s.DB.First(&tmpl, templateID).Error; err != nil {
		return nil, errors.New("template not found")
	}

	identifiers := s.getSessionIdentifiers(sessionID)
	merged := s.mergeContent(tmpl.MarkdownContent, identifiers)

	// Find missing identifiers
	templateIDs := tmpl.ExtractIdentifiers()
	var missing []string
	for _, id := range templateIDs {
		if _, ok := identifiers[id]; !ok {
			missing = append(missing, id)
		}
	}

	return map[string]interface{}{
		"merged_content":      merged,
		"missing_identifiers": missing,
		"template_name":       tmpl.Name,
	}, nil
}

func (s *DocumentService) List(userID, skip, limit int) ([]models.GeneratedDocument, int64, error) {
	var docs []models.GeneratedDocument
	var total int64

	q := s.DB.Model(&models.GeneratedDocument{}).Where("generated_by = ?", userID)
	q.Count(&total)

	if err := q.Order("created_at DESC").Offset(skip).Limit(limit).Find(&docs).Error; err != nil {
		return nil, 0, err
	}
	return docs, total, nil
}

func (s *DocumentService) GetByID(docID, userID int) (*models.GeneratedDocument, error) {
	var doc models.GeneratedDocument
	if err := s.DB.Where("id = ? AND generated_by = ?", docID, userID).First(&doc).Error; err != nil {
		return nil, err
	}
	return &doc, nil
}

func (s *DocumentService) Delete(docID, userID int) error {
	result := s.DB.Where("id = ? AND generated_by = ?", docID, userID).Delete(&models.GeneratedDocument{})
	if result.RowsAffected == 0 {
		return errors.New("document not found")
	}
	return result.Error
}

// MergeDocument generates a Word document (returns bytes).
// For now returns merged markdown as bytes — full .docx generation
// can be added later with a Go docx library.
func (s *DocumentService) MergeDocument(sessionID, templateID, userID int) ([]byte, string, error) {
	var session models.InputForm
	if err := s.DB.Where("id = ? AND user_id = ?", sessionID, userID).First(&session).Error; err != nil {
		return nil, "", errors.New("session not found")
	}

	var tmpl models.Template
	if err := s.DB.First(&tmpl, templateID).Error; err != nil {
		return nil, "", errors.New("template not found")
	}

	identifiers := s.getSessionIdentifiers(sessionID)
	merged := s.mergeContent(tmpl.MarkdownContent, identifiers)

	filename := fmt.Sprintf("merged_document_%d_%d.md", sessionID, templateID)
	return []byte(merged), filename, nil
}

func (s *DocumentService) getSessionIdentifiers(sessionID int) map[string]string {
	var answers []models.SessionAnswer
	s.DB.Where("session_id = ?", sessionID).Find(&answers)

	result := map[string]string{}
	for _, a := range answers {
		var q models.Question
		if err := s.DB.First(&q, a.QuestionID).Error; err == nil {
			result[q.Identifier] = a.AnswerValue
		}
	}
	return result
}

var identifierPattern = regexp.MustCompile(`<<([^>]+)>>`)

func (s *DocumentService) mergeContent(content string, identifiers map[string]string) string {
	return identifierPattern.ReplaceAllStringFunc(content, func(match string) string {
		key := strings.TrimPrefix(strings.TrimSuffix(match, ">>"), "<<")

		// Check for person dot notation (e.g., person.name)
		if strings.Contains(key, ".") {
			parts := strings.SplitN(key, ".", 2)
			personIdentifier := parts[0]
			field := parts[1]

			// Look up the person identifier value (should be a person ID)
			if personIDStr, ok := identifiers[personIdentifier]; ok {
				person := s.lookupPersonField(personIDStr, field)
				if person != "" {
					return person
				}
			}
		}

		if val, ok := identifiers[key]; ok {
			return val
		}
		return match // Leave unresolved
	})
}

func (s *DocumentService) lookupPersonField(personIDStr, field string) string {
	var personID int
	if _, err := fmt.Sscanf(personIDStr, "%d", &personID); err != nil {
		return ""
	}

	var person models.Person
	if err := s.DB.First(&person, personID).Error; err != nil {
		return ""
	}

	switch strings.ToLower(field) {
	case "name":
		return person.Name
	case "email":
		if person.Email != nil {
			return *person.Email
		}
	case "phone", "phone_number":
		if person.PhoneNumber != nil {
			return *person.PhoneNumber
		}
	case "employer":
		if person.Employer != nil {
			return *person.Employer
		}
	case "occupation":
		if person.Occupation != nil {
			return *person.Occupation
		}
	case "date_of_birth", "dob":
		if person.DateOfBirth != nil {
			return *person.DateOfBirth
		}
	}
	return ""
}
