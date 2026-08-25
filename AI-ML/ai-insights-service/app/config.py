from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    mongo_uri: str = 'mongodb://localhost:27017'
    mongo_db: str = 'cab_ai_insights'
    redis_url: str = 'redis://localhost:6379'
    kafka_bootstrap_servers: str = 'localhost:9092'
    kafka_request_timeout_ms: int = 2000
    model_version: str = 'ai-insights-1.0.0'

    class Config:
        env_file = '.env'


settings = Settings()
