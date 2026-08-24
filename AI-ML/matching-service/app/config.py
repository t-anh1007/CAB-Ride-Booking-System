from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # MongoDB
    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db: str = "cab_matching_service"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # Matching service runtime
    model_store_path: str = "/app/model_store"

    # Matching service
    kafka_bootstrap_servers: str = "localhost:9092"
    ride_assigned_topic: str = "driver.assigned"

    class Config:
        env_file = ".env"


settings = Settings()
