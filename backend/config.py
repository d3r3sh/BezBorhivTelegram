from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./bezborhiv.db"
    BOT_TOKEN: str = "test_token_placeholder"
    # Seconds within which Telegram auth_date is considered fresh (0 = disable check)
    AUTH_MAX_AGE: int = 86400

    class Config:
        env_file = ".env"


settings = Settings()
