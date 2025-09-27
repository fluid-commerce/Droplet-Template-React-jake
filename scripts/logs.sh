#!/bin/bash

# Log viewing script

ENVIRONMENT=${1:-dev}

if [ "$ENVIRONMENT" = "prod" ]; then
    echo "📋 Production logs (Ctrl+C to exit):"
    docker-compose -f docker-compose.prod.yml logs -f
elif [ "$ENVIRONMENT" = "dev" ]; then
    echo "📋 Development logs (Ctrl+C to exit):"
    docker-compose -f docker-compose.dev.yml logs -f
else
    echo "Usage: $0 [dev|prod]"
    echo "Default: dev"
    exit 1
fi
