# Simple Fluid Droplet Template

A clean, simple Fluid droplet that shows company name and logo when installed.

## What This Droplet Does

When a company installs this droplet, they see:
- **Clean header** with their company name and logo
- **Simple success message** confirming installation
- **No complex features** - just the essentials

## Project Structure

- `frontend/` - Simple React app that shows company info
- `backend/` - Node.js API with webhook handling
- `database/` - PostgreSQL with Prisma for company data
- `scripts/` - Tools to create and update your droplet

## Quick Start

1. **Install dependencies:**
```bash
npm install
cd frontend && npm install
cd ../backend && npm install
cd ../database && npm install
```

2. **Set up database:**
```bash
# Database is already configured for local development
npm run prisma:push
```

3. **Start development:**
```bash
npm run dev
```

This starts:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## Creating Your Droplet

1. **Deploy to production** (Render, Vercel, etc.)
2. **Get your Fluid API key** from your Fluid account
3. **Create the droplet:**
```bash
FLUID_API_KEY=your_api_key_here \
EMBED_URL=https://your-frontend-url.com/ \
DROPLET_NAME="My Simple Droplet" \
node scripts/create-droplet.js
```

## How It Works

1. **Company installs droplet** → Fluid sends webhook to your backend
2. **Backend stores company info** (name, logo) in database
3. **Frontend loads** → shows company name and logo in clean header
4. **That's it!** Simple and clean.

## Available Scripts

- `npm run dev` - Start both frontend and backend
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:push` - Push schema to database
- `npm run prisma:studio` - Open Prisma Studio

## Customizing

This template is intentionally simple. To add features:
1. Add new database models in `database/prisma/schema.prisma`
2. Add API endpoints in `backend/src/index.ts`
3. Add UI components in `frontend/src/components/`

The code is clean and organized - easy to understand and modify!
