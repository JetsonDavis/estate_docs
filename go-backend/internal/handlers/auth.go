package handlers

import (
	"net/http"
	"time"

	"github.com/estate-docs/go-backend/internal/config"
	"github.com/estate-docs/go-backend/internal/middleware"
	"github.com/estate-docs/go-backend/internal/services"
	"github.com/estate-docs/go-backend/internal/utils"
)

type AuthHandler struct {
	Service *services.AuthService
	Cfg     *config.Config
}

func NewAuthHandler(svc *services.AuthService, cfg *config.Config) *AuthHandler {
	return &AuthHandler{Service: svc, Cfg: cfg}
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var input services.RegisterInput
	if err := utils.DecodeJSON(r, &input); err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if input.Username == "" || input.Email == "" || input.Password == "" {
		utils.Error(w, http.StatusBadRequest, "Username, email, and password are required")
		return
	}

	if len(input.Password) < 8 {
		utils.Error(w, http.StatusBadRequest, "Password must be at least 8 characters")
		return
	}

	user, err := h.Service.Register(input)
	if err != nil {
		utils.Error(w, http.StatusConflict, err.Error())
		return
	}

	utils.JSON(w, http.StatusCreated, map[string]interface{}{
		"message": "User registered successfully",
		"user":    user.ToResponse(),
	})
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var input services.LoginInput
	if err := utils.DecodeJSON(r, &input); err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	user, accessToken, refreshToken, err := h.Service.Login(input)
	if err != nil {
		utils.Error(w, http.StatusUnauthorized, err.Error())
		return
	}

	// Set cookies
	http.SetCookie(w, &http.Cookie{
		Name:     "access_token",
		Value:    accessToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   h.Cfg.CookieSecure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   h.Cfg.JWTAccessTokenExpireMin * 60,
	})

	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    refreshToken,
		Path:     "/api/auth/refresh",
		HttpOnly: true,
		Secure:   h.Cfg.CookieSecure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   h.Cfg.JWTRefreshTokenExpireDays * 86400,
	})

	utils.JSON(w, http.StatusOK, map[string]interface{}{
		"access_token": accessToken,
		"token_type":   "bearer",
		"user": map[string]interface{}{
			"id":       user.ID,
			"username": user.Username,
			"email":    user.Email,
			"role":     user.Role,
		},
	})
}

func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("refresh_token")
	if err != nil || cookie.Value == "" {
		utils.Error(w, http.StatusUnauthorized, "Refresh token required")
		return
	}

	claims, err := utils.VerifyToken(h.Cfg, cookie.Value)
	if err != nil {
		utils.Error(w, http.StatusUnauthorized, "Invalid refresh token")
		return
	}

	tokenType, _ := claims["type"].(string)
	if tokenType != "refresh" {
		utils.Error(w, http.StatusUnauthorized, "Invalid token type")
		return
	}

	sub, _ := claims["sub"].(string)
	username, _ := claims["username"].(string)
	role, _ := claims["role"].(string)

	tokenData := map[string]interface{}{
		"sub":      sub,
		"username": username,
		"role":     role,
	}

	newAccessToken, err := utils.CreateAccessToken(h.Cfg, tokenData)
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, "Failed to create token")
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "access_token",
		Value:    newAccessToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   h.Cfg.CookieSecure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   h.Cfg.JWTAccessTokenExpireMin * 60,
	})

	utils.JSON(w, http.StatusOK, map[string]interface{}{
		"access_token": newAccessToken,
		"token_type":   "bearer",
	})
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     "access_token",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
	})
	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    "",
		Path:     "/api/auth/refresh",
		HttpOnly: true,
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
	})

	utils.JSON(w, http.StatusOK, map[string]string{"message": "Logged out successfully"})
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r)
	if err != nil {
		utils.Error(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	userSvc := services.NewUserService(h.Service.DB)
	user, err := userSvc.GetByID(userID)
	if err != nil {
		utils.Error(w, http.StatusNotFound, "User not found")
		return
	}

	utils.JSON(w, http.StatusOK, user.ToResponse())
}

func (h *AuthHandler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Email string `json:"email"`
	}
	if err := utils.DecodeJSON(r, &input); err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	h.Service.ForgotPassword(input.Email)

	// Always return success to not reveal email existence
	utils.JSON(w, http.StatusOK, map[string]string{
		"message": "If an account with that email exists, a password reset link has been sent.",
	})
}

func (h *AuthHandler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Token       string `json:"token"`
		NewPassword string `json:"new_password"`
	}
	if err := utils.DecodeJSON(r, &input); err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := h.Service.ResetPassword(input.Token, input.NewPassword); err != nil {
		utils.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	utils.JSON(w, http.StatusOK, map[string]string{"message": "Password reset successfully"})
}

func (h *AuthHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r)
	if err != nil {
		utils.Error(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	var input struct {
		CurrentPassword string `json:"current_password"`
		NewPassword     string `json:"new_password"`
	}
	if err := utils.DecodeJSON(r, &input); err != nil {
		utils.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if len(input.NewPassword) < 8 {
		utils.Error(w, http.StatusBadRequest, "Password must be at least 8 characters")
		return
	}

	if err := h.Service.ChangePassword(userID, input.CurrentPassword, input.NewPassword); err != nil {
		utils.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	utils.JSON(w, http.StatusOK, map[string]string{"message": "Password changed successfully"})
}
