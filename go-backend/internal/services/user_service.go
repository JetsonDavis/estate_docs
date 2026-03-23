package services

import (
	"errors"
	"fmt"
	"time"

	"github.com/estate-docs/go-backend/internal/models"
	"github.com/estate-docs/go-backend/internal/utils"
	"gorm.io/gorm"
)

type UserService struct {
	DB *gorm.DB
}

func NewUserService(db *gorm.DB) *UserService {
	return &UserService{DB: db}
}

type UserCreateInput struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
	FullName string `json:"full_name"`
	Role     string `json:"role"`
}

type UserUpdateInput struct {
	Email    *string `json:"email"`
	FullName *string `json:"full_name"`
	Role     *string `json:"role"`
	IsActive *bool   `json:"is_active"`
}

func (s *UserService) GetByID(id int) (*models.User, error) {
	var user models.User
	if err := s.DB.First(&user, id).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (s *UserService) ListUsers(skip, limit int, includeInactive bool) ([]models.User, int64, error) {
	var users []models.User
	var total int64

	q := s.DB.Model(&models.User{})
	if !includeInactive {
		q = q.Where("is_active = true")
	}

	q.Count(&total)
	if err := q.Order("id ASC").Offset(skip).Limit(limit).Find(&users).Error; err != nil {
		return nil, 0, err
	}
	return users, total, nil
}

func (s *UserService) CreateUser(input UserCreateInput) (*models.User, error) {
	hashed, err := utils.HashPassword(input.Password)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	role := models.UserRole(input.Role)
	if role != models.RoleAdmin && role != models.RoleUser {
		role = models.RoleUser
	}

	user := models.User{
		Username:       input.Username,
		Email:          input.Email,
		HashedPassword: hashed,
		Role:           role,
		IsActive:       true,
		CreatedAt:      time.Now().UTC(),
		UpdatedAt:      time.Now().UTC(),
	}
	if input.FullName != "" {
		user.FullName = &input.FullName
	}

	if err := s.DB.Create(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (s *UserService) UpdateUser(id int, input UserUpdateInput) (*models.User, error) {
	var user models.User
	if err := s.DB.First(&user, id).Error; err != nil {
		return nil, errors.New("user not found")
	}

	if input.Email != nil {
		user.Email = *input.Email
	}
	if input.FullName != nil {
		user.FullName = input.FullName
	}
	if input.Role != nil {
		user.Role = models.UserRole(*input.Role)
	}
	if input.IsActive != nil {
		user.IsActive = *input.IsActive
	}
	user.UpdatedAt = time.Now().UTC()

	if err := s.DB.Save(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (s *UserService) DeleteUser(id int) error {
	var user models.User
	if err := s.DB.First(&user, id).Error; err != nil {
		return errors.New("user not found")
	}
	user.IsActive = false
	user.UpdatedAt = time.Now().UTC()
	return s.DB.Save(&user).Error
}
