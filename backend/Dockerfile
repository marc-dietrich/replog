FROM python:3.13-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy project
COPY pyproject.toml .
COPY app/ app/
COPY main.py .
COPY alembic/ alembic/
COPY alembic.ini .

# Install dependencies
RUN uv pip install -q -r <(uv pip compile pyproject.toml 2>/dev/null || uv pip compile --no-dev pyproject.toml) --python-version 313

EXPOSE 8000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health')"

# Run application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
