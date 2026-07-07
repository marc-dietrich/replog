#!/bin/bash

# Start database and run migrations
docker-compose up -d postgres

# Wait for database to be ready
echo "Waiting for database to be ready..."
sleep 10

# Run migrations
docker-compose run --rm backend alembic upgrade head

# Start backend
docker-compose up backend
