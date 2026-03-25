package utils

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/estate-docs/go-backend/internal/config"
)

func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

func VerifyPassword(plain, hashed string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hashed), []byte(plain)) == nil
}

func CreateAccessToken(cfg *config.Config, data map[string]interface{}) (string, error) {
	claims := jwt.MapClaims{
		"iat": time.Now().Unix(),
		"exp": time.Now().Add(time.Duration(cfg.JWTAccessTokenExpireMin) * time.Minute).Unix(),
	}
	for k, v := range data {
		claims[k] = v
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(cfg.JWTSecretKey))
}

// CreateRefreshToken returns (jwt string, jti, expiresAt, error)
func CreateRefreshToken(cfg *config.Config, data map[string]interface{}) (string, string, time.Time, error) {
	jti := uuid.New().String()
	exp := time.Now().Add(time.Duration(cfg.JWTRefreshTokenExpireDays) * 24 * time.Hour)

	claims := jwt.MapClaims{
		"iat":  time.Now().Unix(),
		"exp":  exp.Unix(),
		"type": "refresh",
		"jti":  jti,
	}
	for k, v := range data {
		claims[k] = v
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(cfg.JWTSecretKey))
	if err != nil {
		return "", "", time.Time{}, err
	}
	return signed, jti, exp, nil
}

func VerifyToken(cfg *config.Config, tokenStr string) (jwt.MapClaims, error) {
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(cfg.JWTSecretKey), nil
	})
	if err != nil {
		return nil, err
	}
	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		return claims, nil
	}
	return nil, fmt.Errorf("invalid token")
}

func GeneratePasswordResetToken() string {
	b := make([]byte, 32)
	rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)
}
