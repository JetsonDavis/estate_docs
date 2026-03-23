package services

import (
	"errors"
	"fmt"
	"time"

	"github.com/estate-docs/go-backend/internal/config"
	"github.com/estate-docs/go-backend/internal/models"
	"github.com/estate-docs/go-backend/internal/utils"
	"gorm.io/gorm"
)

type AuthService struct {
	DB  *gorm.DB
	Cfg *config.Config
}

func NewAuthService(db *gorm.DB, cfg *config.Config) *AuthService {
	return &AuthService{DB: db, Cfg: cfg}
}

type RegisterInput struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
	FullName string `json:"full_name"`
}

type LoginInput struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func (s *AuthService) Register(input RegisterInput) (*models.User, error) {
	// Check existing username
	var count int64
	s.DB.Model(&models.User{}).Where("username = ?", input.Username).Count(&count)
	if count > 0 {
		return nil, errors.New("username already exists")
	}

	// Check existing email
	s.DB.Model(&models.User{}).Where("email = ?", input.Email).Count(&count)
	if count > 0 {
		return nil, errors.New("email already exists")
	}

	hashed, err := utils.HashPassword(input.Password)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	user := models.User{
		Username:       input.Username,
		Email:          input.Email,
		HashedPassword: hashed,
		Role:           models.RoleUser,
		IsActive:       true,
		CreatedAt:      time.Now().UTC(),
		UpdatedAt:      time.Now().UTC(),
	}
	if input.FullName != "" {
		user.FullName = &input.FullName
	}

	if err := s.DB.Create(&user).Error; err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}
	return &user, nil
}

// Login returns (user, accessToken, refreshToken, error)
func (s *AuthService) Login(input LoginInput) (*models.User, string, string, error) {
	var user models.User
	if err := s.DB.Where("username = ? AND is_active = true", input.Username).First(&user).Error; err != nil {
		return nil, "", "", errors.New("invalid username or password")
	}

	if !utils.VerifyPassword(input.Password, user.HashedPassword) {
		return nil, "", "", errors.New("invalid username or password")
	}

	// Update last login
	now := time.Now().UTC()
	user.LastLogin = &now
	s.DB.Save(&user)

	tokenData := map[string]interface{}{
		"sub":      fmt.Sprintf("%d", user.ID),
		"username": user.Username,
		"role":     string(user.Role),
	}

	accessToken, err := utils.CreateAccessToken(s.Cfg, tokenData)
	if err != nil {
		return nil, "", "", fmt.Errorf("failed to create access token: %w", err)
	}

	refreshJWT, jti, expiresAt, err := utils.CreateRefreshToken(s.Cfg, tokenData)
	if err != nil {
		return nil, "", "", fmt.Errorf("failed to create refresh token: %w", err)
	}

	// Store refresh token server-side
	rt := models.RefreshToken{
		UserID:    user.ID,
		TokenJTI:  jti,
		ExpiresAt: expiresAt,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	s.DB.Create(&rt)

	return &user, accessToken, refreshJWT, nil
}

func (s *AuthService) ForgotPassword(email string) error {
	var user models.User
	if err := s.DB.Where("email = ?", email).First(&user).Error; err != nil {
		// Don't reveal whether email exists
		return nil
	}

	token := utils.GeneratePasswordResetToken()
	prt := models.PasswordResetToken{
		UserID:    user.ID,
		Token:     token,
		ExpiresAt: time.Now().UTC().Add(1 * time.Hour),
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	s.DB.Create(&prt)

	// TODO: Send email with reset token
	return nil
}

func (s *AuthService) ResetPassword(token, newPassword string) error {
	var prt models.PasswordResetToken
	if err := s.DB.Where("token = ?", token).First(&prt).Error; err != nil {
		return errors.New("invalid or expired reset token")
	}

	if !prt.IsValid() {
		return errors.New("invalid or expired reset token")
	}

	hashed, err := utils.HashPassword(newPassword)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	// Update password
	s.DB.Model(&models.User{}).Where("id = ?", prt.UserID).Update("hashed_password", hashed)

	// Mark token as used
	prt.IsUsed = true
	s.DB.Save(&prt)

	return nil
}

func (s *AuthService) ChangePassword(userID int, currentPassword, newPassword string) error {
	var user models.User
	if err := s.DB.First(&user, userID).Error; err != nil {
		return errors.New("user not found")
	}

	if !utils.VerifyPassword(currentPassword, user.HashedPassword) {
		return errors.New("current password is incorrect")
	}

	hashed, err := utils.HashPassword(newPassword)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	user.HashedPassword = hashed
	user.UpdatedAt = time.Now().UTC()
	return s.DB.Save(&user).Error
}
