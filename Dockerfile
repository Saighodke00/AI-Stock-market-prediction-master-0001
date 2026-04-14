# ==========================================
# Stage 1: Build Frontend (Node.js)
# ==========================================
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ==========================================
# Stage 2: Build Backend (Python)
# ==========================================
FROM python:3.10-slim

WORKDIR /app

# System dependencies for scientific packages
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Environment variables
ENV REDIS_URL="redis://redis:6379/0"
ENV MODEL_PATH="models/tft_model.ckpt"
ENV PYTHONUNBUFFERED=1

# Copy Backend Code
COPY . .

# Copy built frontend from Stage 1 into the backend container
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

EXPOSE 7860
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-7860} --workers 4"]
