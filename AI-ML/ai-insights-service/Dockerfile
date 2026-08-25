FROM python:3.10-slim
WORKDIR /app
COPY AI-ML/ai-insights-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY AI-ML/ai-insights-service/app ./app
ENV PORT=8002
EXPOSE 8002
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002"]
