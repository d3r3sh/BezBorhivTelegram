FROM python:3.11-slim

WORKDIR /app

# Install dependencies as a separate layer for caching
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend source
COPY backend/ ./backend/

# backend.* imports require /app on PYTHONPATH
ENV PYTHONPATH=/app

EXPOSE 8000

# 1. Run Alembic migrations (alembic.ini lives in /app/backend/)
# 2. Start uvicorn; Railway injects $PORT automatically
CMD sh -c "cd /app/backend && alembic upgrade head && cd /app && exec uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"
