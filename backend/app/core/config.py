from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL

BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "PriceScope API"
    environment: str = "local"  # local | test | staging | production

    # PostgreSQL / TimescaleDB
    postgres_user: str
    postgres_password: str
    postgres_db: str
    postgres_host: str = "localhost"
    postgres_port: int = 5432

    # Redis
    redis_host: str = "localhost"
    redis_port: int = 6379

    # Scraping
    scraping_enabled: bool = False

    # Stores explicitly enabled for extraction.
    scraping_allowed_stores: list[str] = Field(default_factory=list)

    # Verified own seller IDs, configured per store.
    scraping_seller_ids: dict[str, list[str]] = Field(default_factory=dict)

    # Security
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 15
    session_inactivity_minutes: int = 30
    session_max_hours: int = 12
    set_password_token_hours: int = 72
    reset_token_minutes: int = 60
    email_change_token_minutes: int = 30

    # Frontend
    frontend_url: str = "http://localhost:5173"
    cors_origins: list[str] = ["http://localhost:5173"]

    # Mail
    smtp_host: str = "localhost"
    smtp_port: int = 1025
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_tls: bool = False
    mail_sender: str = "PriceScope <no-responder@pricescope.local>"

    @property
    def database_url(self) -> URL:
        return URL.create(
            drivername="postgresql+asyncpg",
            username=self.postgres_user,
            password=self.postgres_password,
            host=self.postgres_host,
            port=self.postgres_port,
            database=self.postgres_db,
        )

    @property
    def redis_url(self) -> str:
        return f"redis://{self.redis_host}:{self.redis_port}/0"

    @property
    def secure_cookies(self) -> bool:
        # Local and test run over plain http, without https.
        return self.environment not in ("local", "test")


settings = Settings()
