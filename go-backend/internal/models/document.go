package models

import (
	"time"
)

type GeneratedDocument struct {
	ID              int       `gorm:"primaryKey" json:"id"`
	SessionID       int       `gorm:"index;not null" json:"session_id"`
	TemplateID      *int      `json:"template_id"`
	DocumentName    string    `gorm:"size:255;not null" json:"document_name"`
	S3Key           string    `gorm:"size:500;not null" json:"s3_key"`
	MarkdownContent *string   `gorm:"type:text" json:"markdown_content"`
	PDFContent      []byte    `gorm:"type:bytea" json:"-"`
	PDFFilePath     *string   `gorm:"size:500" json:"pdf_file_path"`
	GeneratedBy     *int      `gorm:"column:generated_by" json:"generated_by"`
	GeneratedAt     time.Time `gorm:"not null" json:"generated_at"`
	CreatedAt       time.Time `gorm:"not null" json:"created_at"`
	UpdatedAt       time.Time `gorm:"not null" json:"updated_at"`

	Session  InputForm `gorm:"foreignKey:SessionID;constraint:OnDelete:CASCADE" json:"-"`
	Template *Template `gorm:"foreignKey:TemplateID;constraint:OnDelete:SET NULL" json:"-"`
}

func (GeneratedDocument) TableName() string { return "generated_documents" }
