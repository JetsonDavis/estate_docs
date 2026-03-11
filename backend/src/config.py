from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )
    
    # Database
    database_url: str = "postgresql://localhost:5432/estate_docs_dev"
    test_database_url: str = "postgresql://localhost:5432/estate_docs_test"
    
    # JWT
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60
    jwt_refresh_token_expire_days: int = 7
    
    # AWS
    aws_access_key_id: Optional[str] = None
    aws_secret_access_key: Optional[str] = None
    aws_region: str = "us-east-1"
    
    # Email
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    email_from: str = "noreply@example.com"
    
    # File Storage
    upload_dir: str = "./temp_uploads"
    generated_dir: str = "./generated"
    document_uploads_dir: str = "./document_uploads"
    max_upload_size_mb: int = 10
    
    # OpenAI
    openai_api_key: Optional[str] = None
    
    # Environment
    environment: str = "development"
    debug: bool = True
    
    # Cookie security — defaults to True; set COOKIE_SECURE=false in .env for local HTTP dev
    cookie_secure: bool = True
    
    # CORS
    cors_origins: str = "http://localhost:5173,http://localhost:3000,http://localhost:3005,https://www.estate-doctor.com"
    
    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]


settings = Settings()
