package models

import (
	"regexp"
	"time"
)

type Template struct {
	ID               int       `gorm:"primaryKey" json:"id"`
	Name             string    `gorm:"size:255;index;not null" json:"name"`
	Description      *string   `gorm:"type:text" json:"description"`
	TemplateType     string    `gorm:"size:50;not null" json:"template_type"`
	OriginalFilename *string   `gorm:"size:255" json:"original_filename"`
	OriginalFilePath *string   `gorm:"size:500" json:"original_file_path"`
	MarkdownContent  string    `gorm:"type:text;not null" json:"markdown_content"`
	Identifiers      *string   `gorm:"type:text" json:"identifiers"`
	CreatedBy        *int      `gorm:"column:created_by" json:"created_by"`
	IsActive         bool      `gorm:"default:true;not null" json:"is_active"`
	CreatedAt        time.Time `gorm:"not null" json:"created_at"`
	UpdatedAt        time.Time `gorm:"not null" json:"updated_at"`
}

func (Template) TableName() string { return "templates" }

var identifierRegex = regexp.MustCompile(`<<([^>]+)>>`)

func (t *Template) ExtractIdentifiers() []string {
	matches := identifierRegex.FindAllStringSubmatch(t.MarkdownContent, -1)
	seen := map[string]bool{}
	var result []string
	for _, m := range matches {
		if !seen[m[1]] {
			seen[m[1]] = true
			result = append(result, m[1])
		}
	}
	return result
}
