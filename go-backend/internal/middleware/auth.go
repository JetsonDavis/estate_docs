package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strconv"

	"github.com/estate-docs/go-backend/internal/config"
	"github.com/estate-docs/go-backend/internal/database"
	"github.com/estate-docs/go-backend/internal/models"
	"github.com/estate-docs/go-backend/internal/utils"
	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const UserContextKey contextKey = "user"

// RequireAuth reads the access_token cookie, verifies it, checks the user
// is still active in the DB, and injects the claims into the request context.
func RequireAuth(cfg *config.Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie("access_token")
			if err != nil || cookie.Value == "" {
				utils.Error(w, http.StatusUnauthorized, "Authentication required")
				return
			}

			claims, err := utils.VerifyToken(cfg, cookie.Value)
			if err != nil {
				utils.Error(w, http.StatusUnauthorized, "Invalid or expired token")
				return
			}

			// Re-check user is still active
			subStr, _ := claims["sub"].(string)
			if subStr == "" {
				// sub might be a float from JSON
				if subFloat, ok := claims["sub"].(float64); ok {
					subStr = fmt.Sprintf("%d", int(subFloat))
				}
			}
			userID, err := strconv.Atoi(subStr)
			if err != nil {
				utils.Error(w, http.StatusUnauthorized, "Invalid token payload")
				return
			}

			var user models.User
			if err := database.DB.First(&user, userID).Error; err != nil || !user.IsActive {
				utils.Error(w, http.StatusUnauthorized, "Account has been deactivated")
				return
			}

			ctx := context.WithValue(r.Context(), UserContextKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireAdmin checks the role claim is "admin".
func RequireAdmin(cfg *config.Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return RequireAuth(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := GetClaims(r)
			if claims == nil {
				utils.Error(w, http.StatusUnauthorized, "Authentication required")
				return
			}
			role, _ := claims["role"].(string)
			if role != "admin" {
				utils.Error(w, http.StatusForbidden, "Admin access required")
				return
			}
			next.ServeHTTP(w, r)
		}))
	}
}

func GetClaims(r *http.Request) jwt.MapClaims {
	v := r.Context().Value(UserContextKey)
	if v == nil {
		return nil
	}
	claims, _ := v.(jwt.MapClaims)
	return claims
}

func GetUserID(r *http.Request) (int, error) {
	claims := GetClaims(r)
	if claims == nil {
		return 0, fmt.Errorf("no claims in context")
	}
	subStr, _ := claims["sub"].(string)
	if subStr == "" {
		if subFloat, ok := claims["sub"].(float64); ok {
			return int(subFloat), nil
		}
		return 0, fmt.Errorf("missing sub claim")
	}
	return strconv.Atoi(subStr)
}
