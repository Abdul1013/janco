# ─────────────────────────────────────────────────────────────────────────────
# JANCO Backend — Production Dockerfile
# ─────────────────────────────────────────────────────────────────────────────
# Multi-stage build: deps layer cached separately from app code so that
# code-only changes don't reinstall all packages.
#
# Build:  docker build -t janco-backend ./backend
# Run:    docker run -p 8000:8000 --env-file .env janco-backend
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: dependency installation ─────────────────────────────────────────
FROM python:3.12-slim AS deps

WORKDIR /install

# Install build tools needed for compiled wheels (asyncpg, bcrypt, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install/pkgs -r requirements.txt


# ── Stage 2: runtime image ───────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

WORKDIR /app

# Copy installed packages from the deps stage (keeps runtime image lean)
COPY --from=deps /install/pkgs /usr/local

# Copy application source
COPY . .

# Don't run as root in production
RUN adduser --disabled-password --no-create-home appuser
USER appuser

# Expose API port
EXPOSE 8000

# Health check — Kubernetes/ECS will restart unhealthy containers
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

# uvicorn workers: 1 per CPU core; adjust via UVICORN_WORKERS env var
ENV UVICORN_WORKERS=4

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${UVICORN_WORKERS}"]
