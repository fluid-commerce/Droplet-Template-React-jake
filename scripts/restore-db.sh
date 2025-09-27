#!/bin/bash

# Database restore script for production

set -e

if [ $# -eq 0 ]; then
    echo "Usage: $0 <backup_file.sql.gz>"
    echo "Available backups:"
    ls -la ./backups/droplet_backup_*.sql.gz 2>/dev/null || echo "No backups found"
    exit 1
fi

BACKUP_FILE=$1

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Load environment variables
if [ -f .env.prod ]; then
    export $(cat .env.prod | grep -v '^#' | xargs)
fi

echo "⚠️  WARNING: This will replace the current database with the backup!"
echo "Backup file: $BACKUP_FILE"
read -p "Are you sure you want to continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Restore cancelled."
    exit 1
fi

echo "🗄️  Restoring database from backup..."

# Stop backend to prevent connections
docker-compose -f docker-compose.prod.yml stop backend

# Restore database
gunzip -c "$BACKUP_FILE" | docker-compose -f docker-compose.prod.yml exec -T postgres psql \
    -U ${POSTGRES_USER:-droplet_user} \
    -d ${POSTGRES_DB:-droplet_prod}

# Start backend
docker-compose -f docker-compose.prod.yml start backend

echo "✅ Database restored successfully!"
