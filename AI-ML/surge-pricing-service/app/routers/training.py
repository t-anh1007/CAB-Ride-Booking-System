import uuid
import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException

router = APIRouter()
logger = logging.getLogger(__name__)

# In-memory job registry (sufficient for single-replica local dev)
_training_jobs: dict[str, dict[str, Any]] = {}


async def _run_training(job_id: str) -> None:
    """Async training task executed in the background."""
    _training_jobs[job_id] = {
        "status": "running",
        "startedAt": datetime.now(tz=timezone.utc).isoformat(),
    }
    try:
        from app.trainers.surge_trainer import run_surge_training

        result = await run_surge_training()
        _training_jobs[job_id] = {
            "status": "completed",
            "result": result,
            "completedAt": datetime.now(tz=timezone.utc).isoformat(),
        }
        logger.info("Surge training job %s completed: %s", job_id, result)

    except Exception as exc:
        _training_jobs[job_id] = {
            "status": "failed",
            "error": str(exc),
            "failedAt": datetime.now(tz=timezone.utc).isoformat(),
        }
        logger.error("Surge training job %s failed: %s", job_id, exc, exc_info=True)


@router.post(
    "/trigger",
    status_code=202,
    summary="Kick-off một training job cho surge-pricing-service model",
)
async def trigger_training(background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    background_tasks.add_task(_run_training, job_id)
    return {
        "jobId": job_id,
        "status": "started",
        "message": "Training job queued. Poll /api/v1/training/jobs/{jobId} for status.",
    }


@router.get("/jobs", summary="Liệt kê tất cả training jobs")
async def list_jobs():
    return {"jobs": _training_jobs}


@router.get("/jobs/{job_id}", summary="Trạng thái của một training job")
async def get_job_status(job_id: str):
    if job_id not in _training_jobs:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    return _training_jobs[job_id]
