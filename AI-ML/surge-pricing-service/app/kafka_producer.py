"""
kafka_producer.py
─────────────────
Module Kafka producer singleton dành cho surge-pricing-service.
Dùng thư viện `aiokafka` (async) để publish event SurgePriceUpdated
mà không block event loop của FastAPI/APScheduler.
"""

import json
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

# ── Kafka optional — không có Kafka thì service vẫn chạy ──────────────────────
try:
    from aiokafka import AIOKafkaProducer
    _KAFKA_AVAILABLE = True
except ImportError:
    _KAFKA_AVAILABLE = False
    logger.warning("⚠️  aiokafka không được cài đặt. Kafka producer bị vô hiệu hoá.")

_producer: Any = None  # AIOKafkaProducer hoặc None

KAFKA_BROKERS = os.getenv("KAFKA_BROKERS") or os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
SURGE_TOPIC   = "surge.price.updated"


async def start_kafka_producer() -> None:
    """Khởi động Kafka producer khi service start."""
    global _producer
    if not _KAFKA_AVAILABLE:
        return

    try:
        _producer = AIOKafkaProducer(
            bootstrap_servers=KAFKA_BROKERS,
            value_serializer=lambda v: json.dumps(v, ensure_ascii=False).encode("utf-8"),
            # Đảm bảo message không bị mất khi broker restart
            acks="all",
            retry_backoff_ms=200,
            request_timeout_ms=10_000,
        )
        await _producer.start()
        logger.info("✅ [Kafka] Producer khởi động thành công → brokers=%s", KAFKA_BROKERS)
    except Exception as exc:
        logger.error("❌ [Kafka] Không thể kết nối Kafka: %s — tiếp tục không có Kafka.", exc)
        _producer = None


async def stop_kafka_producer() -> None:
    """Dừng Kafka producer gracefully khi service shutdown."""
    global _producer
    if _producer:
        try:
            await _producer.stop()
            logger.info("🛑 [Kafka] Producer đã dừng.")
        except Exception as exc:
            logger.warning("⚠️  [Kafka] Lỗi khi dừng producer: %s", exc)
        finally:
            _producer = None


async def publish_surge_updated(
    zone_id: str,
    surge_multiplier: float,
    updated_at: str,
    source: str = "surge-pricing-service",
    model_version: str | None = None,
    metrics_snapshot: dict | None = None,
) -> None:
    """
    [Tiêu chí 4] Publish event SurgePriceUpdated lên Kafka topic 'surge.price.updated'.

    Consumers:
      - Dashboard analytics service
      - Notification service (thông báo cho driver về surge)
      - Audit log service

    Args:
        zone_id: Geohash zone identifier
        surge_multiplier: Hệ số surge vừa được tính (ví dụ: 1.5)
        updated_at: ISO8601 timestamp khi surge được compute
        source: Nguồn tính surge (mặc định "surge-pricing-service")
    """
    if not _producer:
        logger.debug("[Kafka] Producer chưa sẵn sàng — bỏ qua publish surge cho zone=%s", zone_id)
        return

    event = {
        "event_type": "SurgePriceUpdated",
        "zone_id": zone_id,
        "surge_multiplier": surge_multiplier,
        "updated_at": updated_at,
        "source": source,
        "model_version": model_version,
        "metrics_snapshot": metrics_snapshot or {},
    }

    try:
        await _producer.send_and_wait(SURGE_TOPIC, value=event)
        logger.info(
            "📤 [Kafka] SurgePriceUpdated → topic=%s zone=%s multiplier=%.2f",
            SURGE_TOPIC, zone_id, surge_multiplier,
        )
    except Exception as exc:
        # Kafka lỗi KHÔNG được làm crash scheduler — chỉ log warning
        logger.warning(
            "⚠️  [Kafka] Không thể publish SurgePriceUpdated cho zone=%s: %s",
            zone_id, exc,
        )
