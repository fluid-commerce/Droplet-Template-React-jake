# 🌐 Google Cloud Platform Deployment Guide

Complete guide to deploy your Fluid Droplet Template to Google Cloud Platform using Cloud Run and Cloud SQL.

## 🎯 GCP Architecture Overview

Your application will be deployed as:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Cloud Run     │    │   Cloud Run     │    │   Cloud SQL     │
│   Frontend      │────│   Backend       │────│   PostgreSQL    │
│   (React App)   │    │   (Node.js API) │    │   (Managed DB)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │ Secret Manager  │
                    │ (Environment    │
                    │  Variables)     │
                    └─────────────────┘
```

## 🔑 Environment Variables in GCP

**GCP uses Google Secret Manager** for secure environment variable storage:

- **Secrets are encrypted** and managed by Google
- **Automatic rotation** capabilities
- **Fine-grained access control** with IAM
- **Audit logging** for all secret access
- **No plaintext storage** in your code or configs

## 📋 Prerequisites

1. **Google Cloud Account** with billing enabled
2. **gcloud CLI** installed and configured
3. **Docker** installed locally
4. **Project with required APIs** enabled

## 🚀 Step-by-Step Deployment

### Step 1: Initial GCP Setup

```bash
# Install gcloud CLI (if not already installed)
# Visit: https://cloud.google.com/sdk/docs/install

# Authenticate with Google Cloud
gcloud auth login

# Create a new project (or use existing)
gcloud projects create your-droplet-project-id
gcloud config set project your-droplet-project-id

# Enable billing for your project (required for Cloud Run)
# Visit: https://console.cloud.google.com/billing
```

### Step 2: Set Up Environment Variables (Secrets)

```bash
# Run the interactive secret setup
./gcp/setup-secrets.sh
```

This script will:
- Enable required GCP APIs
- Create secrets in Secret Manager
- Prompt you for each required value:
  - `FLUID_API_KEY` - Your Fluid API key
  - `FLUID_WEBHOOK_SECRET` - Your webhook secret
  - `DROPLET_ID` - Your droplet UUID
  - `JWT_SECRET` - Generate a secure random string
  - `DATABASE_URL` - Will be set up in next step

### Step 3: Set Up Cloud SQL Database

```bash
# Create and configure PostgreSQL database
./gcp/setup-database.sh
```

This script will:
- Create a Cloud SQL PostgreSQL instance
- Set up database and user
- Generate secure connection string
- Update the `DATABASE_URL` secret

### Step 4: Deploy to Cloud Run

```bash
# Deploy your application
./gcp/deploy.sh
```

This script will:
- Build Docker images using Cloud Build
- Deploy frontend and backend to Cloud Run
- Configure environment variables from Secret Manager
- Provide you with live URLs

## 🔐 How Environment Variables Work in GCP

### Secret Manager Integration

Your `cloudbuild.yaml` configuration shows how secrets are injected:

```yaml
--set-secrets
DATABASE_URL=DATABASE_URL:latest,FLUID_API_KEY=FLUID_API_KEY:latest,FLUID_WEBHOOK_SECRET=FLUID_WEBHOOK_SECRET:latest,DROPLET_ID=DROPLET_ID:latest,JWT_SECRET=JWT_SECRET:latest
```

### Runtime Access

In your application code, you access them normally:
```javascript
const fluidApiKey = process.env.FLUID_API_KEY;
const databaseUrl = process.env.DATABASE_URL;
```

### Security Benefits

- **No plaintext secrets** in your repository
- **Encrypted at rest** and in transit
- **Audit trails** for all secret access
- **Automatic rotation** capabilities
- **IAM-based access control**

## 💰 Cost Estimation

**Cloud Run (Pay-per-use):**
- Frontend: ~$0-5/month (static serving)
- Backend: ~$5-20/month (depending on traffic)

**Cloud SQL:**
- db-f1-micro: ~$7/month (smallest instance)
- db-g1-small: ~$25/month (recommended for production)

**Secret Manager:**
- $0.06 per 10,000 secret versions
- Essentially free for most applications

**Total estimated cost: $12-50/month** depending on usage and database size.

## 🔧 Configuration Options

### Scaling Configuration

Edit `gcp/cloudbuild.yaml` to adjust:

```yaml
--memory '1Gi'           # Memory allocation
--cpu '1'                # CPU allocation  
--max-instances '10'     # Maximum instances
--min-instances '0'      # Minimum instances (0 = scale to zero)
```

### Database Configuration

Edit `gcp/setup-database.sh` to change:

```bash
TIER="db-f1-micro"      # Instance size
REGION="us-central1"    # Geographic region
```

### Regional Deployment

Edit `gcp/deploy.sh` to change region:

```bash
REGION="us-central1"    # Change to your preferred region
```

## 🌐 Custom Domain Setup

### Step 1: Domain Mapping

```bash
# Map your domain to Cloud Run service
gcloud run domain-mappings create \
  --service droplet-frontend-prod \
  --domain your-domain.com \
  --region us-central1
```

### Step 2: DNS Configuration

Add the DNS records provided by the domain mapping command to your domain registrar.

### Step 3: Update Fluid Configuration

Update your Fluid droplet with the new URLs:
- Frontend URL: `https://your-domain.com`
- Webhook URL: `https://your-backend-domain.com/webhook`

## 📊 Monitoring and Maintenance

### View Logs

```bash
# Backend logs
gcloud run services logs read droplet-backend-prod --region=us-central1

# Frontend logs  
gcloud run services logs read droplet-frontend-prod --region=us-central1
```

### Monitor Performance

```bash
# Service status
gcloud run services list --region=us-central1

# Database status
gcloud sql instances list
```

### Update Secrets

```bash
# Update a secret value
echo -n "new-secret-value" | gcloud secrets versions add SECRET_NAME --data-file=-
```

### Redeploy Application

```bash
# Redeploy with latest code
./gcp/deploy.sh
```

## 🔄 CI/CD Integration

### GitHub Actions Integration

Create `.github/workflows/deploy-gcp.yml`:

```yaml
name: Deploy to GCP
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - id: 'auth'
        uses: 'google-github-actions/auth@v1'
        with:
          credentials_json: '${{ secrets.GCP_SA_KEY }}'
          
      - name: 'Set up Cloud SDK'
        uses: 'google-github-actions/setup-gcloud@v1'
        
      - name: 'Deploy to Cloud Run'
        run: |
          gcloud builds submit --config=gcp/cloudbuild.yaml
```

## 🛠️ Troubleshooting

### Common Issues

**Build Failures:**
```bash
# Check build logs
gcloud builds log [BUILD_ID]
```

**Service Not Starting:**
```bash
# Check service logs
gcloud run services logs read [SERVICE_NAME] --region=[REGION]
```

**Database Connection Issues:**
```bash
# Test database connection
gcloud sql connect droplet-postgres --user=droplet_user
```

**Secret Access Issues:**
```bash
# Check secret permissions
gcloud secrets get-iam-policy SECRET_NAME
```

### Performance Optimization

**Cold Start Reduction:**
- Set minimum instances > 0
- Use smaller Docker images
- Optimize application startup time

**Database Performance:**
- Use connection pooling
- Upgrade to larger Cloud SQL instance
- Enable query insights

## 🔒 Security Best Practices

1. **Use Secret Manager** for all sensitive data
2. **Enable IAM policies** for service accounts
3. **Use HTTPS only** (automatic with Cloud Run)
4. **Regular security updates** for dependencies
5. **Monitor access logs** in Cloud Logging

## 📈 Scaling Considerations

**Automatic Scaling:**
- Cloud Run scales automatically based on requests
- Database connections managed by Cloud SQL Proxy
- No manual intervention required

**Performance Monitoring:**
- Use Cloud Monitoring for metrics
- Set up alerting for errors or high latency
- Monitor database performance

## 🎉 Deployment Complete!

After following this guide, you'll have:

✅ **Secure environment variable management** with Secret Manager  
✅ **Managed PostgreSQL database** with Cloud SQL  
✅ **Auto-scaling web services** with Cloud Run  
✅ **HTTPS by default** with automatic certificates  
✅ **Pay-per-use pricing** with no idle costs  
✅ **Professional monitoring** and logging  

Your Fluid Droplet is now running on enterprise-grade Google Cloud infrastructure! 🚀

## 📋 Example Deployment

**Live Example URLs:**
- Frontend: `https://fluid-droplet-jake-frontend-prod-3h47nfle6q-uc.a.run.app`
- Backend: `https://fluid-droplet-jake-backend-prod-3h47nfle6q-uc.a.run.app`
- Health Check: `https://fluid-droplet-jake-backend-prod-3h47nfle6q-uc.a.run.app/health`

**Your URLs will be similar but with different random suffixes.**

## 📞 Support

- **GCP Documentation**: https://cloud.google.com/docs
- **Cloud Run Docs**: https://cloud.google.com/run/docs
- **Secret Manager Docs**: https://cloud.google.com/secret-manager/docs
- **Fluid Documentation**: https://docs.fluid.app/
