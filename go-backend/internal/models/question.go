package models

import (
	"encoding/json"
	"time"
)

type QuestionGroup struct {
	ID             int              `gorm:"primaryKey" json:"id"`
	Name           string           `gorm:"size:255;not null" json:"name"`
	Description    *string          `gorm:"type:text" json:"description"`
	Identifier     string           `gorm:"size:100;uniqueIndex;not null" json:"identifier"`
	DisplayOrder   int              `gorm:"default:0;not null" json:"display_order"`
	QuestionLogic  *json.RawMessage `gorm:"type:jsonb" json:"question_logic"`
	CollapsedItems *json.RawMessage `gorm:"type:jsonb" json:"collapsed_items"`
	IsActive       bool             `gorm:"default:true;not null" json:"is_active"`
	CreatedAt      time.Time        `gorm:"not null" json:"created_at"`
	UpdatedAt      time.Time        `gorm:"not null" json:"updated_at"`

	Questions []Question `gorm:"foreignKey:QuestionGroupID;constraint:OnDelete:CASCADE" json:"questions,omitempty"`
}

func (QuestionGroup) TableName() string { return "question_groups" }

type QuestionGroupResponse struct {
	ID             int              `json:"id"`
	Name           string           `json:"name"`
	Description    *string          `json:"description"`
	Identifier     string           `json:"identifier"`
	DisplayOrder   int              `json:"display_order"`
	QuestionLogic  *json.RawMessage `json:"question_logic,omitempty"`
	CollapsedItems *json.RawMessage `json:"collapsed_items,omitempty"`
	IsActive       bool             `json:"is_active"`
	CreatedAt      time.Time        `json:"created_at"`
	UpdatedAt      time.Time        `json:"updated_at"`
	QuestionCount  int              `json:"question_count"`
	Questions      interface{}      `json:"questions,omitempty"`
}

type Question struct {
	ID                int              `gorm:"primaryKey" json:"id"`
	QuestionGroupID   int              `gorm:"index;not null" json:"question_group_id"`
	QuestionText      string           `gorm:"type:text;not null" json:"question_text"`
	QuestionType      string           `gorm:"size:50;not null" json:"question_type"`
	Identifier        string           `gorm:"size:100;index;not null" json:"identifier"`
	Repeatable        bool             `gorm:"default:false;not null" json:"repeatable"`
	RepeatableGroupID *string          `gorm:"size:100" json:"repeatable_group_id"`
	DisplayOrder      int              `gorm:"default:0;not null" json:"display_order"`
	IsRequired        bool             `gorm:"default:true;not null" json:"is_required"`
	HelpText          *string          `gorm:"type:text" json:"help_text"`
	Options           *json.RawMessage `gorm:"type:jsonb" json:"options"`
	DatabaseTable     *string          `gorm:"size:100" json:"database_table"`
	DatabaseValueCol  *string          `gorm:"column:database_value_column;size:100" json:"database_value_column"`
	DatabaseLabelCol  *string          `gorm:"column:database_label_column;size:100" json:"database_label_column"`
	PersonDisplayMode *string          `gorm:"size:20" json:"person_display_mode"`
	IncludeTime       *bool            `gorm:"default:false" json:"include_time"`
	ValidationRules   *json.RawMessage `gorm:"type:jsonb" json:"validation_rules"`
	IsActive          bool             `gorm:"default:true;not null" json:"is_active"`
	CreatedAt         time.Time        `gorm:"not null" json:"created_at"`
	UpdatedAt         time.Time        `gorm:"not null" json:"updated_at"`
}

func (Question) TableName() string { return "questions" }
