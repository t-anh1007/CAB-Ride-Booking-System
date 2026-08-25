from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # MongoDB
    mongo_uri: str = 'mongodb://localhost:27017'
    mongo_db: str = 'cab_matching_service'

    # Redis
    redis_url: str = 'redis://localhost:6379'

    # Matching service runtime
    model_store_path: str = '/app/model_store'

    # Matching service eventing
    kafka_bootstrap_servers: str = 'localhost:9092'
    ride_assigned_topic: str = 'driver.assigned'

    # Container-internal service contracts used by agent MCP tools.
    driver_service_url: str = 'http://driver-service:3107/api/v1/drivers/available'
    eta_service_url: str = 'http://eta-service:3110/api/v1/eta/calculate'
    pricing_service_url: str = 'http://pricing-service:3101/api/v1/pricing/quote'

    class Config:
        env_file = '.env'


settings = Settings()
