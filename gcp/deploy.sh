#!/bin/bash

# GCP Cloud Run deployment script for Fluid Droplet Template

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Deploying Fluid Droplet to Google Cloud Run${NC}"

# Configuration
REGION="us-central1"
SERVICE_SUFFIX="prod"
APP_NAME="Fluid Droplet"

# Get current project
PROJECT_ID=$(gcloud config get-value project)
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}❌ No GCP project set. Please run: gcloud config set project YOUR_PROJECT_ID${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 Using GCP Project: ${PROJECT_ID}${NC}"
echo -e "${YELLOW}📋 Region: ${REGION}${NC}"
echo -e "${YELLOW}📋 Service Suffix: ${SERVICE_SUFFIX}${NC}"

# Check prerequisites
echo -e "${YELLOW}🔍 Checking prerequisites...${NC}"

# Check if gcloud is installed and authenticated
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI is not installed${NC}"
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    exit 1
fi

# Check if required APIs are enabled
echo -e "${YELLOW}🔧 Enabling required APIs...${NC}"
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com

# Check if secrets exist
echo -e "${YELLOW}🔐 Checking required secrets...${NC}"
required_secrets=("fluid-droplet-jake-DATABASE_URL" "fluid-droplet-jake-FLUID_API_KEY" "fluid-droplet-jake-FLUID_WEBHOOK_SECRET" "fluid-droplet-jake-DROPLET_ID" "fluid-droplet-jake-JWT_SECRET")
missing_secrets=()

for secret in "${required_secrets[@]}"; do
    if ! gcloud secrets describe "$secret" &>/dev/null; then
        missing_secrets+=("$secret")
    fi
done

if [ ${#missing_secrets[@]} -ne 0 ]; then
    echo -e "${RED}❌ Missing required secrets:${NC}"
    for secret in "${missing_secrets[@]}"; do
        echo "  - $secret"
    done
    echo -e "${YELLOW}💡 Run ./gcp/setup-secrets.sh to create them${NC}"
    exit 1
fi

echo -e "${GREEN}✓ All prerequisites met${NC}"

# Build and deploy using Cloud Build
echo -e "${YELLOW}🏗️ Starting Cloud Build deployment...${NC}"
echo -e "${YELLOW}⏳ This may take 5-10 minutes...${NC}"

gcloud builds submit \
    --config=gcp/cloudbuild.yaml \
    --substitutions=_REGION="$REGION",_SERVICE_SUFFIX="$SERVICE_SUFFIX",_APP_NAME="$APP_NAME" \
    .

# Get service URLs
echo -e "${YELLOW}🔍 Getting service URLs...${NC}"
BACKEND_URL=$(gcloud run services describe "fluid-droplet-jake-backend-${SERVICE_SUFFIX}" --region="$REGION" --format="value(status.url)")
FRONTEND_URL=$(gcloud run services describe "fluid-droplet-jake-frontend-${SERVICE_SUFFIX}" --region="$REGION" --format="value(status.url)")

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo
echo -e "${BLUE}🌐 Your Fluid Droplet is now live:${NC}"
echo -e "${YELLOW}Frontend:${NC} $FRONTEND_URL"
echo -e "${YELLOW}Backend:${NC}  $BACKEND_URL"
echo
echo -e "${YELLOW}📝 Next steps:${NC}"
echo "1. Test your application: curl $BACKEND_URL/health"
echo "2. Visit your frontend: $FRONTEND_URL"
echo "3. Update your Fluid droplet configuration with the new URLs"
echo
echo -e "${YELLOW}🔧 To update your Fluid droplet:${NC}"
echo "- Frontend URL: $FRONTEND_URL"
echo "- Webhook URL: $BACKEND_URL/webhook"
echo
echo -e "${YELLOW}📊 To monitor your services:${NC}"
echo "gcloud run services list --region=$REGION"
echo
echo -e "${YELLOW}📋 To view logs:${NC}"
echo "gcloud run services logs read fluid-droplet-jake-backend-${SERVICE_SUFFIX} --region=$REGION"
echo "gcloud run services logs read fluid-droplet-jake-frontend-${SERVICE_SUFFIX} --region=$REGION"
