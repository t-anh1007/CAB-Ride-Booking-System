FROM python:3.10-slim

WORKDIR /app

# System deps for pandas/numpy/xgboost compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (layer cache)
COPY AI-ML/matching-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY AI-ML/matching-service/app ./app

# Persistent volume mount point for trained model artifacts
RUN mkdir -p /app/model_store

ENV PORT=8000
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--log-level", "info"]
