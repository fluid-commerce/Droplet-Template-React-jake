#!/bin/bash

# Production deployment script for Fluid Droplet Template

set -e

echo "🚀 Deploying Fluid Droplet to Production..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if .env.prod exists
if [ ! -f .env.prod ]; then
    echo "❌ .env.prod file not found. Creating from example..."
    cp .env.prod.example .env.prod
    echo "📝 Please edit .env.prod with your production configuration values."
    echo "   Required variables:"
    echo "   - POSTGRES_PASSWORD"
    echo "   - FLUID_API_KEY"
    echo "   - FLUID_WEBHOOK_SECRET"
    echo "   - DROPLET_ID"
    echo "   - FRONTEND_URL"
    echo "   - WEBHOOK_BASE_URL"
    echo "   - JWT_SECRET"
    exit 1
fi

# Load environment variables
export $(cat .env.prod | grep -v '^#' | xargs)

# Validate required environment variables
required_vars=("POSTGRES_PASSWORD" "FLUID_API_KEY" "FLUID_WEBHOOK_SECRET" "DROPLET_ID" "JWT_SECRET")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Required environment variable $var is not set in .env.prod"
        exit 1
    fi
done

echo "🔧 Building production images..."

# Build production images
docker-compose -f docker-compose.prod.yml build --no-cache

echo "🗄️  Running database migrations..."

# Start database first
docker-compose -f docker-compose.prod.yml up -d postgres

# Wait for database to be ready
echo "   Waiting for PostgreSQL..."
until docker-compose -f docker-compose.prod.yml exec -T postgres pg_isready -U ${POSTGRES_USER:-droplet_user} -d ${POSTGRES_DB:-droplet_prod} > /dev/null 2>&1; do
    sleep 2
done

# Run database migrations
docker-compose -f docker-compose.prod.yml run --rm backend npx prisma db push

echo "🚀 Starting all production services..."

# Start all services
docker-compose -f docker-compose.prod.yml up -d

echo "⏳ Waiting for services to be ready..."

# Wait for backend to be ready
echo "   Waiting for Backend API..."
until docker-compose -f docker-compose.prod.yml exec -T backend curl -f http://localhost:3001/health > /dev/null 2>&1; do
    sleep 2
done

echo "✅ Production deployment complete!"
echo ""
echo "🌐 Your Fluid Droplet is now running at:"
echo "   HTTP:  http://localhost (port 80)"
echo "   HTTPS: https://localhost (port 443) - configure SSL certificates"
echo ""
echo "📝 To view logs: docker-compose -f docker-compose.prod.yml logs -f"
echo "🛑 To stop: docker-compose -f docker-compose.prod.yml down"
echo ""
echo "🔒 Next steps for production:"
echo "   1. Configure SSL certificates in ./ssl/ directory"
echo "   2. Update nginx configuration for your domain"
echo "   3. Set up automated backups"
echo "   4. Configure monitoring and alerts"
