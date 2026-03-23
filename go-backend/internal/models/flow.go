package models

import (
	"encoding/json"
	"time"
)

type DocumentFlow struct {
	ID              int              `gorm:"primaryKey" json:"id"`
	Name            string           `gorm:"size:255;uniqueIndex;not null" json:"name"`
	Description     *string          `gorm:"type:text" json:"description"`
	FlowLogic       *json.RawMessage `gorm:"type:jsonb" json:"flow_logic"`
	StartingGroupID *int             `gorm:"column:starting_group_id" json:"starting_group_id"`
	CreatedBy       *int             `gorm:"column:created_by" json:"created_by"`
	IsActive        bool             `gorm:"default:true;not null" json:"is_active"`
	CreatedAt       time.Time        `gorm:"not null" json:"created_at"`
	UpdatedAt       time.Time        `gorm:"not null" json:"updated_at"`

	StartingGroup  *QuestionGroup  `gorm:"foreignKey:StartingGroupID;constraint:OnDelete:SET NULL" json:"-"`
	QuestionGroups []QuestionGroup `gorm:"many2many:flow_question_groups;" json:"-"`
}

func (DocumentFlow) TableName() string { return "document_flows" }

type FlowQuestionGroup struct {
	FlowID          int `gorm:"primaryKey;column:flow_id"`
	QuestionGroupID int `gorm:"primaryKey;column:question_group_id"`
	OrderIndex      int `gorm:"not null;default:0;column:order_index"`
}

func (FlowQuestionGroup) TableName() string { return "flow_question_groups" }
