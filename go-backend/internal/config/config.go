package config

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	// Database
	DatabaseURL     string
	TestDatabaseURL string

	// JWT
	JWTSecretKey              string
	JWTAlgorithm              string
	JWTAccessTokenExpireMin   int
	JWTRefreshTokenExpireDays int

	// AWS
	AWSAccessKeyID     string
	AWSSecretAccessKey string
	AWSRegion          string

	// Email
	SMTPHost     string
	SMTPPort     int
	SMTPUser     string
	SMTPPassword string
	EmailFrom    string

	// File Storage
	UploadDir          string
	GeneratedDir       string
	DocumentUploadsDir string
	MaxUploadSizeMB    int

	// OpenAI
	OpenAIAPIKey string

	// Environment
	Environment string
	Debug       bool

	// Cookie security
	CookieSecure bool

	// CORS
	CORSOrigins []string

	// Server
	Port string
}

func Load() *Config {
	return &Config{
		DatabaseURL:     getEnv("DATABASE_URL", "postgresql://localhost:5432/estate_docs_dev"),
		TestDatabaseURL: getEnv("TEST_DATABASE_URL", "postgresql://localhost:5432/estate_docs_test"),

		JWTSecretKey:              getEnv("JWT_SECRET_KEY", ""),
		JWTAlgorithm:              getEnv("JWT_ALGORITHM", "HS256"),
		JWTAccessTokenExpireMin:   getEnvInt("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", 60),
		JWTRefreshTokenExpireDays: getEnvInt("JWT_REFRESH_TOKEN_EXPIRE_DAYS", 7),

		AWSAccessKeyID:     getEnv("AWS_ACCESS_KEY_ID", ""),
		AWSSecretAccessKey: getEnv("AWS_SECRET_ACCESS_KEY", ""),
		AWSRegion:          getEnv("AWS_REGION", "us-east-1"),

		SMTPHost:     getEnv("SMTP_HOST", "smtp.gmail.com"),
		SMTPPort:     getEnvInt("SMTP_PORT", 587),
		SMTPUser:     getEnv("SMTP_USER", ""),
		SMTPPassword: getEnv("SMTP_PASSWORD", ""),
		EmailFrom:    getEnv("EMAIL_FROM", "noreply@example.com"),

		UploadDir:          getEnv("UPLOAD_DIR", "./temp_uploads"),
		GeneratedDir:       getEnv("GENERATED_DIR", "./generated"),
		DocumentUploadsDir: getEnv("DOCUMENT_UPLOADS_DIR", "./document_uploads"),
		MaxUploadSizeMB:    getEnvInt("MAX_UPLOAD_SIZE_MB", 10),

		OpenAIAPIKey: getEnv("OPENAI_API_KEY", ""),

		Environment: getEnv("ENVIRONMENT", "development"),
		Debug:       getEnvBool("DEBUG", true),

		CookieSecure: getEnvBool("COOKIE_SECURE", true),

		CORSOrigins: strings.Split(
			getEnv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000,http://localhost:3005,https://www.estate-doctor.com"),
			",",
		),

		Port: getEnv("PORT", "8005"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return fallback
}

func getEnvBool(key string, fallback bool) bool {
	if v := os.Getenv(key); v != "" {
		return strings.ToLower(v) == "true" || v == "1"
	}
	return fallback
}
