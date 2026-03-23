package models

import (
	"time"
)

type UserRole string

const (
	RoleAdmin UserRole = "admin"
	RoleUser  UserRole = "user"
)

type User struct {
	ID              int        `gorm:"primaryKey" json:"id"`
	Username        string     `gorm:"size:50;uniqueIndex;not null" json:"username"`
	Email           string     `gorm:"size:255;uniqueIndex;not null" json:"email"`
	HashedPassword  string     `gorm:"size:255;not null" json:"-"`
	FullName        *string    `gorm:"size:255" json:"full_name"`
	Role            UserRole   `gorm:"type:varchar(10);default:'user';not null" json:"role"`
	IsEmailVerified bool       `gorm:"default:false;not null" json:"is_email_verified"`
	LastLogin       *time.Time `json:"last_login"`
	IsActive        bool       `gorm:"default:true;not null" json:"is_active"`
	CreatedAt       time.Time  `gorm:"not null" json:"created_at"`
	UpdatedAt       time.Time  `gorm:"not null" json:"updated_at"`
}

func (User) TableName() string { return "users" }

type PasswordResetToken struct {
	ID        int       `gorm:"primaryKey" json:"id"`
	UserID    int       `gorm:"index;not null" json:"user_id"`
	Token     string    `gorm:"size:255;uniqueIndex;not null" json:"token"`
	ExpiresAt time.Time `gorm:"not null" json:"expires_at"`
	IsUsed    bool      `gorm:"default:false;not null" json:"is_used"`
	CreatedAt time.Time `gorm:"not null" json:"created_at"`
	UpdatedAt time.Time `gorm:"not null" json:"updated_at"`

	User User `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
}

func (PasswordResetToken) TableName() string { return "password_reset_tokens" }

func (t *PasswordResetToken) IsExpired() bool {
	return time.Now().UTC().After(t.ExpiresAt)
}

func (t *PasswordResetToken) IsValid() bool {
	return !t.IsUsed && !t.IsExpired()
}

type RefreshToken struct {
	ID        int       `gorm:"primaryKey" json:"id"`
	UserID    int       `gorm:"index;not null" json:"user_id"`
	TokenJTI  string    `gorm:"column:token_jti;size:255;uniqueIndex;not null" json:"token_jti"`
	ExpiresAt time.Time `gorm:"not null" json:"expires_at"`
	IsRevoked bool      `gorm:"default:false;not null" json:"is_revoked"`
	CreatedAt time.Time `gorm:"not null" json:"created_at"`
	UpdatedAt time.Time `gorm:"not null" json:"updated_at"`

	User User `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
}

func (RefreshToken) TableName() string { return "refresh_tokens" }

func (t *RefreshToken) IsExpired() bool {
	return time.Now().UTC().After(t.ExpiresAt)
}

func (t *RefreshToken) IsValid() bool {
	return !t.IsRevoked && !t.IsExpired()
}

// UserResponse is the JSON shape returned to the frontend.
type UserResponse struct {
	ID              int        `json:"id"`
	Username        string     `json:"username"`
	Email           string     `json:"email"`
	FullName        *string    `json:"full_name"`
	Role            UserRole   `json:"role"`
	IsEmailVerified bool       `json:"is_email_verified"`
	LastLogin       *time.Time `json:"last_login"`
	IsActive        bool       `json:"is_active"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

func (u *User) ToResponse() UserResponse {
	return UserResponse{
		ID:              u.ID,
		Username:        u.Username,
		Email:           u.Email,
		FullName:        u.FullName,
		Role:            u.Role,
		IsEmailVerified: u.IsEmailVerified,
		LastLogin:       u.LastLogin,
		IsActive:        u.IsActive,
		CreatedAt:       u.CreatedAt,
		UpdatedAt:       u.UpdatedAt,
	}
}
