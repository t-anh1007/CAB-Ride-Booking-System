from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # MongoDB
    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db: str = "cab_surge_pricing_service"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # Surge pricing runtime
    model_store_path: str = "/app/model_store"
    surge_push_interval_seconds: int = 30
    surge_redis_ttl: int = 90  # seconds

    # Messaging
    kafka_bootstrap_servers: str = "localhost:9092"
    surge_retrain_interval_seconds: int = 3600

    class Config:
        env_file = ".env"


settings = Settings()
