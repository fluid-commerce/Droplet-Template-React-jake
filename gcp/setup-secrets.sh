#!/bin/bash

# GCP Secret Manager setup for Fluid Droplet Template
# This script creates secrets in Google Secret Manager for your application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔐 Setting up Google Secret Manager for Fluid Droplet${NC}"

# Check if gcloud is installed and authenticated
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI is not installed. Please install it first.${NC}"
    echo "Visit: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if user is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -n 1 > /dev/null; then
    echo -e "${RED}❌ Not authenticated with gcloud. Please run: gcloud auth login${NC}"
    exit 1
fi

# Get current project
PROJECT_ID=$(gcloud config get-value project)
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}❌ No GCP project set. Please run: gcloud config set project YOUR_PROJECT_ID${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 Using GCP Project: ${PROJECT_ID}${NC}"

# Enable required APIs
echo -e "${YELLOW}🔧 Enabling required GCP APIs...${NC}"
gcloud services enable secretmanager.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable sqladmin.googleapis.com

# Function to create or update secret
create_secret() {
    local secret_name="fluid-droplet-jake-$1"
    local secret_description=$2
    
    echo -e "${YELLOW}🔑 Setting up secret: ${secret_name}${NC}"
    
    # Check if secret exists
    if gcloud secrets describe "$secret_name" &>/dev/null; then
        echo -e "${GREEN}✓ Secret ${secret_name} already exists${NC}"
    else
        # Create the secret
        gcloud secrets create "$secret_name" --replication-policy="automatic" --labels="app=fluid-droplet"
        echo -e "${GREEN}✓ Created secret: ${secret_name}${NC}"
    fi
    
    # Prompt for secret value
    echo -e "${YELLOW}Please enter the value for ${secret_name}:${NC}"
    echo -e "${YELLOW}${secret_description}${NC}"
    read -s secret_value
    
    if [ -n "$secret_value" ]; then
        # Add secret version
        echo -n "$secret_value" | gcloud secrets versions add "$secret_name" --data-file=-
        echo -e "${GREEN}✓ Added value to secret: ${secret_name}${NC}"
    else
        echo -e "${YELLOW}⚠️  Skipped empty value for: ${secret_name}${NC}"
    fi
    echo
}

# Create all required secrets
echo -e "${GREEN}🚀 Creating secrets for your Fluid Droplet application...${NC}"
echo

# Database URL (for Cloud SQL)
create_secret "DATABASE_URL" "PostgreSQL connection string (e.g., postgresql://user:password@/database?host=/cloudsql/project:region:instance)"

# Fluid API Configuration
create_secret "FLUID_API_KEY" "Your Fluid API key (starts with PT-)"
create_secret "FLUID_WEBHOOK_SECRET" "Your Fluid webhook secret (32+ characters)"
create_secret "DROPLET_ID" "Your Fluid droplet ID (starts with drp_)"

# Security
create_secret "JWT_SECRET" "JWT secret for authentication (32+ characters, random string)"

# Optional: External service URLs
echo -e "${YELLOW}📝 Optional secrets (press Enter to skip):${NC}"
create_secret "EXTERNAL_SERVICE_API_KEY" "API key for external services (optional)"

echo -e "${GREEN}✅ Secret setup complete!${NC}"
echo
echo -e "${YELLOW}📋 Next steps:${NC}"
echo "1. Set up Cloud SQL PostgreSQL database"
echo "2. Update the DATABASE_URL secret with your Cloud SQL connection string"
echo "3. Run the deployment: gcloud builds submit --config=gcp/cloudbuild.yaml"
echo
echo -e "${YELLOW}💡 To view your secrets:${NC}"
echo "gcloud secrets list --filter='labels.app=fluid-droplet'"
