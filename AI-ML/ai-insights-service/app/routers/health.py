from fastapi import APIRouter

from app.config import settings

router = APIRouter()


@router.get('/health')
async def health():
    return {
        'status': 'ok',
        'service': 'ai-insights-service',
        'model_version': settings.model_version,
    }
