from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.database import close_db, connect_db
from app.kafka_producer import close_kafka, connect_kafka
from app.routers import health
from app.routers.drift import router as drift_router
from app.routers.forecast import router as forecast_router
from app.routers.fraud import router as fraud_router
from app.routers.recommendations import router as recommendations_router


@asynccontextmanager
async def lifespan(_app):
    await connect_db()
    await connect_kafka()
    try:
        yield
    finally:
        await close_kafka()
        await close_db()


app = FastAPI(title='AI Insights Service', version='1.0.0', lifespan=lifespan)
app.include_router(health.router)
app.include_router(fraud_router)
app.include_router(recommendations_router)
app.include_router(forecast_router)
app.include_router(drift_router)
