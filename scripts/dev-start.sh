#!/bin/bash

# Development startup script for Fluid Droplet Template

set -e

echo "🚀 Starting Fluid Droplet Development Environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if .env.dev exists
if [ ! -f .env.dev ]; then
    echo "⚠️  .env.dev file not found. Creating from example..."
    cp .env.dev.example .env.dev
    echo "📝 Please edit .env.dev with your actual configuration values."
    echo "   At minimum, you need to set:"
    echo "   - FLUID_API_KEY"
    echo "   - FLUID_WEBHOOK_SECRET"
    echo "   - DROPLET_ID"
    echo ""
    read -p "Press Enter to continue after editing .env.dev..."
fi

# Load environment variables
export $(cat .env.dev | grep -v '^#' | xargs)

echo "🐳 Building and starting Docker containers..."

# Build and start services
docker-compose -f docker-compose.dev.yml up --build -d

echo "⏳ Waiting for services to be ready..."

# Wait for database to be ready
echo "   Waiting for PostgreSQL..."
until docker-compose -f docker-compose.dev.yml exec -T postgres pg_isready -U droplet_user -d droplet_dev > /dev/null 2>&1; do
    sleep 2
done

# Wait for backend to be ready
echo "   Waiting for Backend API..."
until curl -f http://localhost:3001/health > /dev/null 2>&1; do
    sleep 2
done

echo "✅ Development environment is ready!"
echo ""
echo "🌐 Services available at:"
echo "   Frontend:  http://localhost:5173"
echo "   Backend:   http://localhost:3001"
echo "   Database:  localhost:5432 (droplet_dev)"
echo "   Adminer:   http://localhost:8080"
echo ""
echo "📝 To view logs: docker-compose -f docker-compose.dev.yml logs -f"
echo "🛑 To stop: docker-compose -f docker-compose.dev.yml down"
