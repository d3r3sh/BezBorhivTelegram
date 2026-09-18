from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./bezborhiv.db"
    # Real token from @BotFather — must contain ":" to be treated as valid
    BOT_TOKEN: str = "test_token_placeholder"
    # Seconds within which Telegram auth_date is considered fresh (0 = disable check)
    AUTH_MAX_AGE: int = 86400
    # Deployed Mini App URL (used in bot /start Web App button)
    WEBAPP_URL: str = "https://example.com"
    # Timezone for notification scheduler (10:00 local)
    SCHEDULER_TIMEZONE: str = "Europe/Kyiv"
    # JWT signing secret — set a strong random value in production
    JWT_SECRET: str = "change-me-in-production"
    # JWT token lifetime in days
    JWT_EXPIRE_DAYS: int = 30

    class Config:
        env_file = ".env"


settings = Settings()
