#!/bin/bash

# Cloud SQL PostgreSQL setup for Fluid Droplet Template

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🗄️ Setting up Cloud SQL PostgreSQL for Fluid Droplet${NC}"

# Configuration
INSTANCE_NAME="fluid-droplet-jake-postgres"
DATABASE_NAME="fluid_droplet_jake_prod"
DATABASE_USER="fluid_droplet_jake_user"
REGION="us-central1"
TIER="db-f1-micro"  # Smallest tier for development

# Get current project
PROJECT_ID=$(gcloud config get-value project)
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}❌ No GCP project set. Please run: gcloud config set project YOUR_PROJECT_ID${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 Using GCP Project: ${PROJECT_ID}${NC}"
echo -e "${YELLOW}📋 Instance Name: ${INSTANCE_NAME}${NC}"
echo -e "${YELLOW}📋 Database Name: ${DATABASE_NAME}${NC}"
echo -e "${YELLOW}📋 Region: ${REGION}${NC}"

# Enable Cloud SQL API
echo -e "${YELLOW}🔧 Enabling Cloud SQL API...${NC}"
gcloud services enable sqladmin.googleapis.com

# Check if instance already exists
if gcloud sql instances describe "$INSTANCE_NAME" &>/dev/null; then
    echo -e "${GREEN}✓ Cloud SQL instance ${INSTANCE_NAME} already exists${NC}"
else
    echo -e "${YELLOW}🚀 Creating Cloud SQL PostgreSQL instance...${NC}"
    echo -e "${YELLOW}⏳ This may take 5-10 minutes...${NC}"
    
    gcloud sql instances create "$INSTANCE_NAME" \
        --database-version=POSTGRES_15 \
        --tier="$TIER" \
        --region="$REGION" \
        --storage-type=SSD \
        --storage-size=10GB \
        --storage-auto-increase \
        --backup-start-time=03:00 \
        --maintenance-window-day=SUN \
        --maintenance-window-hour=04
    
    echo -e "${GREEN}✅ Cloud SQL instance created successfully!${NC}"
fi

# Generate a secure password
echo -e "${YELLOW}🔐 Generating secure database password...${NC}"
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)

# Create database user
echo -e "${YELLOW}👤 Creating database user...${NC}"
if gcloud sql users list --instance="$INSTANCE_NAME" --filter="name=$DATABASE_USER" --format="value(name)" | grep -q "$DATABASE_USER"; then
    echo -e "${GREEN}✓ Database user ${DATABASE_USER} already exists${NC}"
    echo -e "${YELLOW}⚠️  Updating password for existing user...${NC}"
    gcloud sql users set-password "$DATABASE_USER" \
        --instance="$INSTANCE_NAME" \
        --password="$DB_PASSWORD"
else
    gcloud sql users create "$DATABASE_USER" \
        --instance="$INSTANCE_NAME" \
        --password="$DB_PASSWORD"
    echo -e "${GREEN}✓ Database user created successfully!${NC}"
fi

# Create database
echo -e "${YELLOW}🗄️ Creating database...${NC}"
if gcloud sql databases list --instance="$INSTANCE_NAME" --filter="name=$DATABASE_NAME" --format="value(name)" | grep -q "$DATABASE_NAME"; then
    echo -e "${GREEN}✓ Database ${DATABASE_NAME} already exists${NC}"
else
    gcloud sql databases create "$DATABASE_NAME" --instance="$INSTANCE_NAME"
    echo -e "${GREEN}✓ Database created successfully!${NC}"
fi

# Get connection name
CONNECTION_NAME=$(gcloud sql instances describe "$INSTANCE_NAME" --format="value(connectionName)")

# Create DATABASE_URL
DATABASE_URL="postgresql://${DATABASE_USER}:${DB_PASSWORD}@/${DATABASE_NAME}?host=/cloudsql/${CONNECTION_NAME}"

echo -e "${GREEN}✅ Database setup complete!${NC}"
echo
echo -e "${YELLOW}📋 Database Information:${NC}"
echo "Instance Name: $INSTANCE_NAME"
echo "Database Name: $DATABASE_NAME"
echo "Database User: $DATABASE_USER"
echo "Connection Name: $CONNECTION_NAME"
echo
echo -e "${YELLOW}🔐 Database URL (save this securely):${NC}"
echo "$DATABASE_URL"
echo
echo -e "${YELLOW}📝 Next steps:${NC}"
echo "1. Update the DATABASE_URL secret in Secret Manager:"
echo "   echo -n '$DATABASE_URL' | gcloud secrets versions add fluid-droplet-jake-DATABASE_URL --data-file=-"
echo
echo "2. Your Cloud Run services will automatically connect using this URL"
echo
echo -e "${YELLOW}💡 To connect locally for testing:${NC}"
echo "gcloud sql connect $INSTANCE_NAME --user=$DATABASE_USER --database=$DATABASE_NAME"
