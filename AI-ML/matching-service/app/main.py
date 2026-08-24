from contextlib import asynccontextmanager
import asyncio
import logging

from fastapi import FastAPI

from app.database import connect_db, close_db
from app.routers.features import router as feature_router
from app.routers import health
from app.routers.matching import router as matching_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup → yield → shutdown."""
    logger.info("🚀 Matching Service starting up...")
    await connect_db()
    
    # [NHIỆM VỤ 1] Start Kafka Consumer in background
    from app.tasks.consumer import start_matching_consumer
    asyncio.create_task(start_matching_consumer())
    
    yield
    logger.info("🛑 Matching Service shutting down...")
    await close_db()


app = FastAPI(
    title="Matching Service",
    version="1.0.0",
    description="AI Driver Matching service for candidate scoring and best-driver assignment",
    lifespan=lifespan,
)

# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(health.router, tags=["Health"])
# Removed: matching_router
# Removed: feature_router (following 'Xóa bỏ HTTP API Controller' instruction)
