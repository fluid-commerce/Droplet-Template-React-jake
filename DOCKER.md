# 🐳 Docker Setup Guide for Fluid Droplet Template

This guide covers Docker-based development and production deployment for your Fluid Droplet Template React application.

## 📋 Prerequisites

- **Docker** (20.10+) and **Docker Compose** (2.0+) installed
- **Git** for version control
- **Basic terminal/command line knowledge**

## 🚀 Quick Start

### Development Environment

1. **Clone and setup:**
   ```bash
   git clone <your-repo-url>
   cd Droplet-Template-React-jake
   ```

2. **Configure environment:**
   ```bash
   cp env.dev.example .env.dev
   # Edit .env.dev with your Fluid API credentials
   ```

3. **Start development environment:**
   ```bash
   ./scripts/dev-start.sh
   ```

4. **Access your application:**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001
   - Database Admin: http://localhost:8080

### Production Deployment

1. **Configure production environment:**
   ```bash
   cp env.prod.example .env.prod
   # Edit .env.prod with your production values
   ```

2. **Deploy to production:**
   ```bash
   ./scripts/prod-deploy.sh
   ```

3. **Access your application:**
   - Application: http://localhost (port 80)
   - HTTPS: https://localhost (port 443, after SSL setup)

## 🏗️ Architecture Overview

### Development Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   PostgreSQL    │
│   (React+Vite)  │────│   (Node.js)     │────│   Database      │
│   Port: 5173    │    │   Port: 3001    │    │   Port: 5432    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                                              ┌─────────────────┐
                                              │   Adminer       │
                                              │   (DB Admin)    │
                                              │   Port: 8080    │
                                              └─────────────────┘
```

### Production Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Nginx Proxy   │────│  Frontend       │    │   Backend API   │
│  (Port 80/443)  │    │  (Static Files) │────│  (Node.js)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                                              ┌─────────────────┐
                                              │   PostgreSQL    │
                                              │   Database      │
                                              └─────────────────┘
```

## 🔧 Configuration

### Environment Variables

#### Development (.env.dev)
```bash
# Fluid Configuration
FLUID_API_KEY=PT-your-fluid-api-key-here
FLUID_WEBHOOK_SECRET=your-webhook-secret-here
DROPLET_ID=drp_your-droplet-uuid-here

# Security
JWT_SECRET=your-jwt-secret-for-development

# App Branding
VITE_APP_NAME=My Fluid Droplet (Dev)
```

#### Production (.env.prod)
```bash
# Database
POSTGRES_DB=droplet_prod
POSTGRES_USER=droplet_user
POSTGRES_PASSWORD=your-secure-password

# Fluid Configuration
FLUID_API_KEY=PT-your-fluid-api-key-here
FLUID_WEBHOOK_SECRET=your-webhook-secret-here
DROPLET_ID=drp_your-droplet-uuid-here

# URLs (replace with your domain)
FRONTEND_URL=https://your-domain.com
WEBHOOK_BASE_URL=https://your-domain.com
VITE_API_BASE_URL=https://your-domain.com/api
VITE_FLUID_API_URL=https://your-domain.com/api

# Security
JWT_SECRET=your-very-secure-jwt-secret-here
```

## 📝 Available Scripts

### Development Scripts

```bash
# Start development environment
./scripts/dev-start.sh

# View development logs
./scripts/logs.sh dev

# Stop development environment
docker-compose -f docker-compose.dev.yml down
```

### Production Scripts

```bash
# Deploy to production
./scripts/prod-deploy.sh

# View production logs
./scripts/logs.sh prod

# Create database backup
./scripts/backup-db.sh

# Restore database from backup
./scripts/restore-db.sh ./backups/droplet_backup_YYYYMMDD_HHMMSS.sql.gz

# Stop production environment
docker-compose -f docker-compose.prod.yml down
```

## 🗄️ Database Management

### Development Database

- **Access:** localhost:5432
- **Database:** droplet_dev
- **Username:** droplet_user
- **Password:** droplet_password
- **Admin UI:** http://localhost:8080 (Adminer)

### Production Database

- **Automatic backups:** Use `./scripts/backup-db.sh`
- **Restore:** Use `./scripts/restore-db.sh`
- **Migrations:** Automatically run during deployment

### Manual Database Operations

```bash
# Connect to development database
docker-compose -f docker-compose.dev.yml exec postgres psql -U droplet_user -d droplet_dev

# Connect to production database
docker-compose -f docker-compose.prod.yml exec postgres psql -U droplet_user -d droplet_prod

# Run Prisma migrations
docker-compose -f docker-compose.dev.yml exec backend npx prisma db push
```

## 🔒 SSL/HTTPS Setup for Production

### 1. Obtain SSL Certificates

**Option A: Let's Encrypt (Recommended)**
```bash
# Install certbot
sudo apt-get install certbot

# Get certificates
sudo certbot certonly --standalone -d your-domain.com

# Copy certificates to project
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ./ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem ./ssl/key.pem
sudo chown $USER:$USER ./ssl/*.pem
```

**Option B: Self-signed (Development/Testing)**
```bash
mkdir -p ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout ssl/key.pem -out ssl/cert.pem \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
```

### 2. Enable HTTPS in Nginx

Edit `nginx/conf.d/default.conf` and uncomment the HTTPS server block, then update your domain name.

### 3. Restart Services

```bash
docker-compose -f docker-compose.prod.yml restart nginx
```

## 🚀 Personal Server Deployment

### Server Requirements

- **OS:** Ubuntu 20.04+ or similar Linux distribution
- **RAM:** 2GB minimum, 4GB recommended
- **Storage:** 20GB minimum
- **Network:** Public IP address and domain name

### Initial Server Setup

1. **Install Docker:**
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   sudo usermod -aG docker $USER
   ```

2. **Install Docker Compose:**
   ```bash
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

3. **Clone your repository:**
   ```bash
   git clone <your-repo-url>
   cd Droplet-Template-React-jake
   ```

4. **Configure and deploy:**
   ```bash
   cp env.prod.example .env.prod
   # Edit .env.prod with your production values
   ./scripts/prod-deploy.sh
   ```

### Domain and DNS Setup

1. **Point your domain to your server:**
   - Create an A record pointing to your server's IP address
   - Wait for DNS propagation (up to 24 hours)

2. **Update configuration:**
   - Edit `.env.prod` with your actual domain
   - Update `nginx/conf.d/default.conf` with your domain
   - Restart services: `docker-compose -f docker-compose.prod.yml restart`

## 🔍 Monitoring and Maintenance

### Health Checks

```bash
# Check service status
docker-compose -f docker-compose.prod.yml ps

# Check application health
curl http://localhost/health

# Check backend API health
curl http://localhost/api/health
```

### Log Management

```bash
# View all logs
./scripts/logs.sh prod

# View specific service logs
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f frontend
docker-compose -f docker-compose.prod.yml logs -f nginx
```

### Automated Backups

Add to your server's crontab:
```bash
# Daily backup at 2 AM
0 2 * * * cd /path/to/your/project && ./scripts/backup-db.sh
```

## 🛠️ Troubleshooting

### Common Issues

**Port already in use:**
```bash
# Find what's using the port
sudo lsof -i :80
sudo lsof -i :443

# Stop conflicting services
sudo systemctl stop apache2  # or nginx
```

**Database connection issues:**
```bash
# Check database logs
docker-compose -f docker-compose.prod.yml logs postgres

# Restart database
docker-compose -f docker-compose.prod.yml restart postgres
```

**SSL certificate issues:**
```bash
# Check certificate validity
openssl x509 -in ssl/cert.pem -text -noout

# Test SSL configuration
curl -I https://your-domain.com
```

### Performance Optimization

**For production servers:**

1. **Increase Docker resources:**
   ```bash
   # Edit /etc/docker/daemon.json
   {
     "log-driver": "json-file",
     "log-opts": {
       "max-size": "10m",
       "max-file": "3"
     }
   }
   ```

2. **Enable log rotation:**
   ```bash
   sudo systemctl restart docker
   ```

3. **Monitor resource usage:**
   ```bash
   docker stats
   ```

## 🔄 Updates and Maintenance

### Updating Your Application

1. **Pull latest changes:**
   ```bash
   git pull origin main
   ```

2. **Rebuild and restart:**
   ```bash
   docker-compose -f docker-compose.prod.yml up --build -d
   ```

3. **Run database migrations if needed:**
   ```bash
   docker-compose -f docker-compose.prod.yml exec backend npx prisma db push
   ```

### System Maintenance

```bash
# Clean up unused Docker resources
docker system prune -a

# Update Docker images
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

## 📞 Support

If you encounter issues:

1. Check the logs: `./scripts/logs.sh prod`
2. Verify your environment variables in `.env.prod`
3. Ensure your domain DNS is properly configured
4. Check that all required ports are open and not blocked by firewall

For Fluid-specific issues, refer to the [Fluid Documentation](https://docs.fluid.app/).
