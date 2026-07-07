#!/bin/bash

# Gym Tracker - All-in-One Setup Script
# Automates project setup, database initialization, and server startup

set -e

echo "🏋️  Gym Tracker - Backend Setup"
echo "=================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check Python version
echo -e "${BLUE}📦 Checking Python version...${NC}"
if ! command -v python &> /dev/null; then
    echo -e "${RED}❌ Python 3.13 not found${NC}"
    echo "Please install Python 3.13 from https://www.python.org/"
    exit 1
fi
echo -e "${GREEN}✅ Python found${NC}"
echo ""

# Check Docker
echo -e "${BLUE}🐳 Checking Docker...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not found${NC}"
    echo "Please install Docker from https://www.docker.com/"
    exit 1
fi
echo -e "${GREEN}✅ Docker found${NC}"
echo ""

# Create .env if not exists
if [ ! -f "backend/.env" ]; then
    echo -e "${BLUE}📝 Creating .env file...${NC}"
    cp backend/.env.example backend/.env
    echo -e "${GREEN}✅ .env created${NC}"
    echo -e "${YELLOW}⚠️  Please review backend/.env and adjust if needed${NC}"
else
    echo -e "${GREEN}✅ .env already exists${NC}"
fi
echo ""

# Create venv
if [ ! -d "backend/venv" ]; then
    echo -e "${BLUE}📦 Creating virtual environment...${NC}"
    python -m venv backend/venv
    echo -e "${GREEN}✅ Virtual environment created${NC}"
else
    echo -e "${GREEN}✅ Virtual environment exists${NC}"
fi
echo ""

# Activate venv
echo -e "${BLUE}🔌 Activating virtual environment...${NC}"
source backend/venv/bin/activate
echo -e "${GREEN}✅ Virtual environment activated${NC}"
echo ""

# Install dependencies
echo -e "${BLUE}📚 Installing dependencies...${NC}"
cd backend
pip install -q -r requirements-dev.txt
cd ..
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Start database
echo -e "${BLUE}🐳 Starting PostgreSQL...${NC}"
docker-compose up -d postgres
echo -e "${GREEN}✅ PostgreSQL started${NC}"
echo -e "${YELLOW}⏳ Waiting for database to be ready...${NC}"
sleep 5
echo ""

# Run migrations
echo -e "${BLUE}🔄 Running database migrations...${NC}"
cd backend
alembic upgrade head || python dev_utils.py
cd ..
echo -e "${GREEN}✅ Database initialized${NC}"
echo ""

# Summary
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo -e "${BLUE}Quick start:${NC}"
echo "1. Start the backend:"
echo -e "   ${YELLOW}./start-backend.sh${NC}"
echo ""
echo "2. In another terminal, start the frontend:"
echo -e "   ${YELLOW}cd frontend && npm run dev${NC}"
echo ""
echo -e "${BLUE}Useful commands:${NC}"
echo "  • Run tests:        pytest"
echo "  • Format code:      black app/ tests/ && isort app/ tests/"
echo "  • Lint:             ruff check app/ tests/"
echo "  • Type check:       mypy app/"
echo "  • DB migration:     alembic revision --autogenerate -m 'description'"
echo ""
echo -e "${BLUE}Documentation:${NC}"
echo "  • Backend README:   backend/README.md"
echo "  • Development:      DEVELOPMENT.md"
echo "  • API Reference:    API_REFERENCE.md"
echo ""
echo -e "${BLUE}API Endpoints:${NC}"
echo "  • API Docs:         http://localhost:8000/docs"
echo "  • ReDoc:            http://localhost:8000/redoc"
echo "  • Health Check:     http://localhost:8000/health"
echo ""
