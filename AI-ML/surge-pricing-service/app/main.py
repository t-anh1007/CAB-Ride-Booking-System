from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI

from app.database import close_db, connect_db
from app.kafka_producer import start_kafka_producer, stop_kafka_producer
from app.routers import features, health, training
from app.routers.surge import router as surge_router
from app.tasks.scheduler import start_scheduler, stop_scheduler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Surge Pricing Service starting up...")
    await connect_db()
    await start_kafka_producer()
    await start_scheduler()
    yield
    logger.info("🛑 Surge Pricing Service shutting down...")
    await stop_scheduler()
    await stop_kafka_producer()
    await close_db()


app = FastAPI(
    title="Surge Pricing Service",
    version="1.0.0",
    description="AI dynamic pricing service backed by the shared ML platform",
    lifespan=lifespan,
)

app.include_router(health.router, tags=["Health"])
app.include_router(features.router, prefix="/api/v1/features", tags=["Feature Store"])
app.include_router(training.router, prefix="/api/v1/training", tags=["Model Training"])
app.include_router(surge_router, prefix="/internal/surge", tags=["Surge Pricing"])

