package models

import (
	"time"
)

type InputForm struct {
	ID               int        `gorm:"primaryKey" json:"id"`
	ClientIdentifier string     `gorm:"size:255;index;not null" json:"client_identifier"`
	UserID           int        `gorm:"not null" json:"user_id"`
	FlowID           *int       `json:"flow_id"`
	CurrentGroupID   *int       `gorm:"column:current_group_id" json:"current_group_id"`
	IsCompleted      bool       `gorm:"default:false;not null" json:"is_completed"`
	CompletedAt      *time.Time `json:"completed_at"`
	CreatedAt        time.Time  `gorm:"not null" json:"created_at"`
	UpdatedAt        time.Time  `gorm:"not null" json:"updated_at"`

	User         User           `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
	Flow         *DocumentFlow  `gorm:"foreignKey:FlowID;constraint:OnDelete:SET NULL" json:"-"`
	CurrentGroup *QuestionGroup `gorm:"foreignKey:CurrentGroupID;constraint:OnDelete:SET NULL" json:"-"`
	Answers      []SessionAnswer `gorm:"foreignKey:SessionID;constraint:OnDelete:CASCADE" json:"answers,omitempty"`
}

func (InputForm) TableName() string { return "document_sessions" }

type InputFormResponse struct {
	ID               int        `json:"id"`
	ClientIdentifier string     `json:"client_identifier"`
	UserID           int        `json:"user_id"`
	FlowID           *int       `json:"flow_id"`
	CurrentGroupID   *int       `json:"current_group_id"`
	CurrentGroupName *string    `json:"current_group_name,omitempty"`
	IsCompleted      bool       `json:"is_completed"`
	CompletedAt      *time.Time `json:"completed_at"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

func (s *InputForm) ToResponse() InputFormResponse {
	return InputFormResponse{
		ID:               s.ID,
		ClientIdentifier: s.ClientIdentifier,
		UserID:           s.UserID,
		FlowID:           s.FlowID,
		CurrentGroupID:   s.CurrentGroupID,
		IsCompleted:      s.IsCompleted,
		CompletedAt:      s.CompletedAt,
		CreatedAt:        s.CreatedAt,
		UpdatedAt:        s.UpdatedAt,
	}
}

type SessionAnswer struct {
	ID          int       `gorm:"primaryKey" json:"id"`
	SessionID   int       `gorm:"index;not null" json:"session_id"`
	QuestionID  int       `gorm:"index;not null" json:"question_id"`
	AnswerValue string    `gorm:"type:text;not null" json:"answer_value"`
	CreatedAt   time.Time `gorm:"not null" json:"created_at"`
	UpdatedAt   time.Time `gorm:"not null" json:"updated_at"`

	Session  InputForm `gorm:"foreignKey:SessionID;constraint:OnDelete:CASCADE" json:"-"`
	Question Question  `gorm:"foreignKey:QuestionID;constraint:OnDelete:CASCADE" json:"-"`
}

func (SessionAnswer) TableName() string { return "session_answers" }

type AnswerSnapshot struct {
	ID             int       `gorm:"primaryKey" json:"id"`
	SessionID      int       `gorm:"index;not null" json:"session_id"`
	QuestionID     int       `gorm:"index;not null" json:"question_id"`
	QuestionNumber *string   `gorm:"type:varchar" json:"question_number"`
	AnswerValue    string    `gorm:"type:text;not null" json:"answer_value"`
	SavedAt        time.Time `gorm:"not null" json:"saved_at"`
}

func (AnswerSnapshot) TableName() string { return "answer_snapshots" }
