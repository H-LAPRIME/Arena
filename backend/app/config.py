from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database — PostgreSQL
    DATABASE_URL: str = "postgresql://postgres:123@localhost:5432/efootball_arena"

    # JWT
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 1440  # 24 hours

    # Mistral AI
    MISTRAL_API_KEY: str = ""

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000"

    # File uploads
    UPLOAD_DIR: str = "uploads"

    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    GOOGLE_CLIENT_ID: str = ""


    class Config:
        env_file = ".env"
        str_strip_whitespace = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()
