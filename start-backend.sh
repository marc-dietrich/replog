#!/bin/bash
set -e

echo "🚀 Starting Gym Tracker Backend Development..."

# Check if .env exists
if [ ! -f "backend/.env" ]; then
    echo "📝 Creating .env from .env.example..."
    cp backend/.env.example backend/.env
    echo "⚠️  Please update backend/.env with your database credentials"
fi

# Check if venv exists
if [ ! -d "backend/venv" ]; then
    echo "📦 Creating virtual environment..."
    python -m venv backend/venv
fi

# Activate venv
source backend/venv/bin/activate

# Install dependencies
echo "📚 Installing dependencies..."
cd backend
pip install -q -r requirements-dev.txt

# Database setup
echo "🗄️  Starting PostgreSQL..."
docker compose up -d postgres
sleep 5

# Run migrations
echo "🔄 Running database migrations..."
alembic upgrade head || python dev_utils.py

# Start server
echo "✅ Backend is running at http://localhost:8000"
echo "📖 API docs available at http://localhost:8000/docs"
echo ""
echo "📌 Quick commands:"
echo "   - Run tests: pytest"
echo "   - Format code: black app/ tests/ && isort app/ tests/"
echo "   - Lint: ruff check app/ tests/"
echo "   - Type check: mypy app/"
echo ""
echo "🛑 Press Ctrl+C to stop"
echo ""

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
