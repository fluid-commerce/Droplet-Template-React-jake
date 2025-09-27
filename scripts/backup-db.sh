#!/bin/bash

# Database backup script for production

set -e

# Load environment variables
if [ -f .env.prod ]; then
    export $(cat .env.prod | grep -v '^#' | xargs)
fi

BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="droplet_backup_${TIMESTAMP}.sql"

echo "🗄️  Creating database backup..."

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Create database backup
docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump \
    -U ${POSTGRES_USER:-droplet_user} \
    -d ${POSTGRES_DB:-droplet_prod} \
    --clean --if-exists --create > "${BACKUP_DIR}/${BACKUP_FILE}"

# Compress the backup
gzip "${BACKUP_DIR}/${BACKUP_FILE}"

echo "✅ Database backup created: ${BACKUP_DIR}/${BACKUP_FILE}.gz"

# Keep only the last 7 backups
cd $BACKUP_DIR
ls -t droplet_backup_*.sql.gz | tail -n +8 | xargs -r rm

echo "🧹 Old backups cleaned up (keeping last 7)"
