#!/usr/bin/env node

/**
 * 🚀 Fluid Droplet Creation Script
 * 
 * This script creates a new droplet in the Fluid platform using the Fluid API.
 * 
 * Usage:
 *   FLUID_API_KEY=your_key EMBED_URL=https://your-frontend.com/ WEBHOOK_URL=https://your-backend.com/api/webhooks/fluid node scripts/create-droplet.js
 *   
 * Or with all options:
 *   FLUID_API_KEY=your_key EMBED_URL=https://your-frontend.com/ WEBHOOK_URL=https://your-backend.com/api/webhooks/fluid DROPLET_NAME="My Droplet" DROPLET_DESCRIPTION="My awesome integration" LOGO_URL=https://logo.com/logo.png node scripts/create-droplet.js
 */

import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.join(__dirname, '..')

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green')
}

function logError(message) {
  log(`❌ ${message}`, 'red')
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow')
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue')
}

// Get configuration from environment variables or package.json
function getConfiguration() {
  // Read package.json for defaults
  let packageJson = {}
  try {
    const packagePath = path.join(projectRoot, 'package.json')
    packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
  } catch (error) {
    logWarning('Could not read package.json, using basic defaults')
  }

  const config = {
    fluidApiKey: process.env.FLUID_API_KEY,
    embedUrl: process.env.EMBED_URL,
    webhookUrl: process.env.WEBHOOK_URL,
    dropletName: process.env.DROPLET_NAME || packageJson.name || 'Fluid Droplet Template',
    description: process.env.DROPLET_DESCRIPTION || packageJson.description || 'Complete template for building Fluid droplets - everything you need to start creating integrations',
    logoUrl: process.env.LOGO_URL || 'https://res.cloudinary.com/ddway3wcc/image/upload/v1751920946/business-logos/revb5zhzz38shehvdxlq.png',
    fluidApiUrl: process.env.FLUID_API_URL || 'https://api.fluid.app',
    categories: (process.env.DROPLET_CATEGORIES || 'integration,automation').split(',').map(s => s.trim()).filter(Boolean),
    countries: (process.env.SERVICE_COUNTRIES || 'usa,can,gbr').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  }

  return config
}

// Validate configuration
function validateConfiguration(config) {
  const errors = []

  if (!config.fluidApiKey) {
    errors.push('FLUID_API_KEY environment variable is required')
  } else if (!config.fluidApiKey.startsWith('PT-')) {
    logWarning('API key should start with "PT-" - please verify this is correct')
  }

  if (!config.embedUrl) {
    errors.push('EMBED_URL environment variable is required')
  } else {
    try {
      new URL(config.embedUrl)
    } catch (error) {
      errors.push('EMBED_URL must be a valid URL')
    }
  }

  if (!config.webhookUrl) {
    errors.push('WEBHOOK_URL environment variable is required')
  } else {
    try {
      const webhookUrl = new URL(config.webhookUrl)
      // Ensure it's HTTPS in production
      if (webhookUrl.protocol !== 'https:' && !config.webhookUrl.includes('localhost')) {
        logWarning('Webhook URL should use HTTPS for production deployments')
      }
      // Ensure it ends with the correct path
      if (!config.webhookUrl.endsWith('/api/webhook/fluid')) {
        logWarning('Webhook URL should end with "/api/webhook/fluid"')
      }
    } catch (error) {
      errors.push('WEBHOOK_URL must be a valid URL')
    }
  }

  if (!config.dropletName || config.dropletName.trim().length === 0) {
    errors.push('Droplet name cannot be empty')
  }

  return errors
}

// Create droplet via Fluid API
async function createDroplet(config) {
  const client = axios.create({
    baseURL: `${config.fluidApiUrl}/api`,
    headers: {
      'Authorization': `Bearer ${config.fluidApiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    timeout: 30000,
  })

  const defaultFeatures = [
    {
      name: 'Ready-to-Deploy Template',
      summary: 'Everything you need to build amazing droplets is already set up and ready to go. Complete React frontend, Node.js backend, and PostgreSQL database all configured and waiting for you to start building immediately.',
      details: 'Everything you need is already set up and ready to go. Complete React frontend, Node.js backend, and PostgreSQL database all configured and waiting for you. Our production-ready template includes all the code, configurations, and setup files you need to start building your Fluid droplet immediately. Just follow our simple step-by-step guide written specifically for non-developers and start building your droplet right away. No technical background required - we explain every single step clearly with screenshots and examples so you can have your droplet live in 45 minutes. The template handles all the complex setup including authentication, database connections, API integrations, and deployment configurations.',
      image_url: 'https://images.unsplash.com/photo-1556075798-4825dfaaf498?w=300&h=200&fit=crop&auto=format',
      video_url: 'data:video/mp4;base64,'
    },
    {
      name: 'Build Your Own Droplet',
      summary: 'A droplet is a mini-application that connects your business tools to Fluid. You can build anything from simple data sync tools to complex business automations that solve real problems for your customers.',
      details: 'A droplet is a mini-application that lives inside the Fluid platform and connects different business tools together. Think of it as a bridge that lets your business systems talk to each other automatically. You can build droplets that sync customer data, automate order processing, send notifications, generate reports, or create custom workflows that save hours of manual work. Once you build and deploy your droplet, it becomes available to all Fluid users worldwide through the marketplace. Perfect for agencies serving multiple clients, freelancers building custom solutions, startups needing rapid integration, and enterprise teams requiring scalable solutions. Deploy to production instantly with one-click deployment including automatic SSL certificates, database setup, global CDN for fast loading worldwide, and enterprise-grade security with multi-tenant data isolation and AES-256 encryption.',
      image_url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=300&h=200&fit=crop&auto=format',
      video_url: 'data:video/mp4;base64,'
    }
  ]

  const dropletData = {
    name: config.dropletName,
    embed_url: config.embedUrl,
    webhook_url: config.webhookUrl, // Add webhook URL to droplet creation
    active: true,
    categories: config.categories,
    settings: {
      marketplace_page: {
        title: config.dropletName,
        summary: 'Simple Fluid droplet template - clean and organized',
        logo_url: config.logoUrl
      },
      details_page: {
        title: config.dropletName,
        summary: 'Simple Fluid droplet template - clean and organized',
        logo_url: config.logoUrl,
        features: [
          {
            name: 'Simple & Clean',
            summary: 'Minimal design that shows company name and logo',
            details: 'When companies install this droplet, they see a clean header with their company name and logo. No complex features, just the essentials.',
            image_url: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=300&h=200&fit=crop&auto=format'
          },
          {
            name: 'Easy to Customize',
            summary: 'Built with React, Node.js, and PostgreSQL',
            details: 'Simple codebase that\'s easy to understand and modify. Add your own features and integrations as needed.',
            image_url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=300&h=200&fit=crop&auto=format'
          }
        ]
      },
      service_operational_countries: ['USA']
    }
  }

  logInfo(`Creating droplet: ${config.dropletName}`)
  logInfo(`Embed URL: ${config.embedUrl}`)
  logInfo(`API URL: ${config.fluidApiUrl}`)
  logInfo(`Logo URL: ${config.logoUrl}`)
  logInfo(`Categories: ${config.categories.join(', ')}`)

  logInfo(`Sending creation data: ${JSON.stringify({ droplet: dropletData }, null, 2)}`)

  try {
    const response = await client.post('/droplets', {
      droplet: dropletData
    })

    logInfo('Full API response:')
    logInfo(JSON.stringify(response.data, null, 2))

    return response.data
  } catch (error) {
    if (error.response) {
      logError(`Full error response: ${JSON.stringify(error.response.data, null, 2)}`)
      throw new Error(`API Error ${error.response.status}: ${error.response.data?.message || JSON.stringify(error.response.data) || error.response.statusText}`)
    } else if (error.request) {
      throw new Error('Network Error: Could not reach Fluid API. Please check your internet connection and API URL.')
    } else {
      throw new Error(`Request Error: ${error.message}`)
    }
  }
}

// Update environment files with droplet ID
function updateEnvironmentFiles(dropletId) {
  const backendEnvPath = path.join(projectRoot, 'backend', '.env')
  const backendEnvExamplePath = path.join(projectRoot, 'backend', 'env.example')

  // Update backend/.env if it exists
  if (fs.existsSync(backendEnvPath)) {
    try {
      let envContent = fs.readFileSync(backendEnvPath, 'utf8')
      
      // Update or add DROPLET_ID
      if (envContent.includes('DROPLET_ID=')) {
        envContent = envContent.replace(/DROPLET_ID=.*$/m, `DROPLET_ID=${dropletId}`)
      } else {
        envContent += `\nDROPLET_ID=${dropletId}\n`
      }

      fs.writeFileSync(backendEnvPath, envContent)
      logSuccess(`Updated DROPLET_ID in backend/.env`)
    } catch (error) {
      logWarning(`Could not update backend/.env: ${error.message}`)
    }
  } else {
    logWarning('backend/.env not found - you may need to run setup first')
  }

  // Also update the example file for future reference
  if (fs.existsSync(backendEnvExamplePath)) {
    try {
      let envContent = fs.readFileSync(backendEnvExamplePath, 'utf8')
      envContent = envContent.replace(/DROPLET_ID=.*$/m, `DROPLET_ID=${dropletId}`)
      fs.writeFileSync(backendEnvExamplePath, envContent)
      logInfo('Updated droplet ID in backend/env.example')
    } catch (error) {
      logWarning(`Could not update backend/env.example: ${error.message}`)
    }
  }
}

// Main function
async function main() {
  log('🚀 Fluid Droplet Creation Script', 'bright')
  log('==================================', 'bright')
  console.log()

  try {
    // Get and validate configuration
    const config = getConfiguration()
    const validationErrors = validateConfiguration(config)

    if (validationErrors.length > 0) {
      logError('Configuration errors:')
      validationErrors.forEach(error => logError(`  • ${error}`))
      console.log()
      logInfo('Usage:')
      logInfo('  FLUID_API_KEY=your_key EMBED_URL=https://your-frontend.com/ WEBHOOK_URL=https://your-backend.com/api/webhook/fluid node scripts/create-droplet.js')
      console.log()
      logInfo('Required environment variables:')
      logInfo('  FLUID_API_KEY=your_fluid_api_key')
      logInfo('  EMBED_URL=https://your-frontend.com/')
      logInfo('  WEBHOOK_URL=https://your-backend.com/api/webhook/fluid')
      console.log()
      logInfo('Optional environment variables:')
      logInfo('  DROPLET_NAME="My Droplet"')
      logInfo('  DROPLET_DESCRIPTION="My awesome integration"')
      logInfo('  LOGO_URL=https://logo.com/logo.png')
      logInfo('  FLUID_API_URL=https://api.fluid.app (default)')
      process.exit(1)
    }

    // Create the droplet
    logInfo('Creating droplet in Fluid platform...')
    const result = await createDroplet(config)

    // Extract droplet information
    const droplet = result.droplet || result.data || result
    const dropletId = droplet.uuid || droplet.id

    if (!dropletId) {
      logError('Droplet was created but no ID was returned')
      logInfo('Response:', JSON.stringify(result, null, 2))
      process.exit(1)
    }

    // Success!
    console.log()
    logSuccess('🎉 Droplet created successfully!')
    console.log()
    log('📋 Droplet Details:', 'cyan')
    log(`   ID: ${dropletId}`, 'bright')
    log(`   Name: ${droplet.name}`)
    log(`   Embed URL: ${droplet.embed_url}`)
    log(`   Webhook URL: ${droplet.webhook_url || 'Not set'}`)
    log(`   Status: ${droplet.active ? 'Active' : 'Inactive'}`)
    
    // Verify the webhook URL was actually set
    if (!droplet.webhook_url || droplet.webhook_url === 'undefined') {
      logWarning('⚠️  Webhook URL may not have been set properly')
      logInfo('Note: Some Fluid API versions may not return webhook_url in the response')
      logInfo('Check your Fluid dashboard to verify the webhook URL was set')
    } else {
      logSuccess('✅ Webhook URL successfully configured!')
    }
    
    // Update environment files
    console.log()
    logInfo('Updating environment files...')
    updateEnvironmentFiles(dropletId)

    // Next steps
    console.log()
    log('🚀 Next Steps:', 'cyan')
    log('1. Test your droplet by uninstalling and reinstalling it in Fluid')
    log('2. Check your backend logs to confirm webhook events are being received')
    log('3. Verify that uninstall now properly removes the installation')
    console.log()
    log('🔗 Your droplet should now properly handle uninstall webhooks!', 'green')

  } catch (error) {
    console.log()
    logError('Failed to create droplet:')
    logError(error.message)
    
    if (error.message.includes('401') || error.message.includes('authentication')) {
      console.log()
      logInfo('Authentication issues? Check that:')
      logInfo('• Your FLUID_API_KEY is correct and starts with "PT-"')
      logInfo('• Your API key has droplet creation permissions')
      logInfo('• You are using the correct FLUID_API_URL')
    } else if (error.message.includes('404')) {
      console.log()
      logInfo('Resource not found? Check that:')
      logInfo('• Your EMBED_URL and WEBHOOK_URL are accessible')
      logInfo('• The URLs are valid and reachable')
      logInfo('• You have the correct permissions')
    } else if (error.message.includes('Network')) {
      console.log()
      logInfo('Network issues? Check that:')
      logInfo('• You have an internet connection')
      logInfo('• The FLUID_API_URL is accessible')
      logInfo('• There are no firewall restrictions')
    }
    
    process.exit(1)
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logError(`Uncaught error: ${error.message}`)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  logError(`Unhandled rejection at: ${promise}`)
  logError(`Reason: ${reason}`)
  process.exit(1)
})

// Run the script
main()