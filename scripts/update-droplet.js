#!/usr/bin/env node

/**
 * 🔄 Fluid Droplet Update Script
 * 
 * This script updates an existing droplet in the Fluid platform with webhook URL configuration.
 * Use this to fix droplets that were created without webhook URLs.
 * 
 * Usage:
 *   FLUID_API_KEY=your_key DROPLET_ID=your_droplet_id WEBHOOK_URL=https://your-backend.com/api/webhooks/fluid node scripts/update-droplet.js
 */

import axios from 'axios'

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

// Get configuration from environment variables
function getConfiguration() {
  const config = {
    fluidApiKey: process.env.FLUID_API_KEY,
    dropletId: process.env.DROPLET_ID,
    webhookUrl: process.env.WEBHOOK_URL,
    fluidApiUrl: process.env.FLUID_API_URL || 'https://api.fluid.app',
    dropletName: process.env.DROPLET_NAME,
    embedUrl: process.env.EMBED_URL,
    description: process.env.DROPLET_DESCRIPTION,
    logoUrl: process.env.LOGO_URL,
    categories: (process.env.DROPLET_CATEGORIES || '').split(',').map(s => s.trim()).filter(Boolean),
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

  if (!config.dropletId) {
    errors.push('DROPLET_ID environment variable is required')
  }

  if (!config.webhookUrl) {
    errors.push('WEBHOOK_URL environment variable is required')
  } else {
    try {
      new URL(config.webhookUrl)
    } catch (error) {
      errors.push('WEBHOOK_URL must be a valid URL')
    }
  }

  return errors
}

async function updateDroplet(config) {
  const client = axios.create({
    baseURL: `${config.fluidApiUrl}/api`,
    headers: {
      'Authorization': `Bearer ${config.fluidApiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    timeout: 30000,
  })

  // First, get the current droplet configuration
  logInfo('Fetching current droplet configuration...')
  let currentDroplet
  try {
    const getResponse = await client.get(`/droplets/${config.dropletId}`)
    currentDroplet = getResponse.data.droplet || getResponse.data
  } catch (error) {
    if (error.response?.status === 404) {
      throw new Error(`Droplet with ID ${config.dropletId} not found`)
    }
    throw error
  }

  logSuccess(`Found droplet: ${currentDroplet.name}`)
  logInfo(`Current embed URL: ${currentDroplet.embed_url}`)
  logInfo(`Current webhook URL: ${currentDroplet.webhook_url || 'NOT SET'}`)

  const mergedName = config.dropletName || currentDroplet.name || 'Fluid Droplet Guide'
  const mergedEmbed = config.embedUrl || currentDroplet.embed_url
  const mergedDesc = config.description || '🚀 Complete guide and template for building Fluid droplets. Connect any service to the Fluid platform with our production-ready template including React frontend, Node.js backend, PostgreSQL database, and enterprise security.'
  const mergedLogo = config.logoUrl === "" ? null : (config.logoUrl || currentDroplet.settings?.marketplace_page?.logo_url)
  const mergedCategories = (config.categories && config.categories.length > 0) ? config.categories : ['development', 'templates', 'integration', 'automation', 'api']

  const updatedDropletData = {
    name: mergedName,
    embed_url: mergedEmbed,
    webhook_url: config.webhookUrl,
    webhookUrl: config.webhookUrl,
    webhook_endpoint: config.webhookUrl,
    webhookEndpoint: config.webhookUrl,
    categories: mergedCategories,
    settings: {
      ...currentDroplet.settings,
      marketplace_page: (() => {
        const page = { ...(currentDroplet.settings?.marketplace_page || {}) }
        page.title = mergedName
        page.summary = 'Complete guide setup for building Fluid droplets.'
        if (mergedLogo) {
          page.logo_url = mergedLogo
        } else {
          delete page.logo_url
        }
        return page
      })(),
      details_page: (() => {
        const page = { ...(currentDroplet.settings?.details_page || {}) }
        page.title = mergedName
        page.summary = 'Complete guide setup for building Fluid droplets.'
        if (mergedLogo) {
          page.logo_url = mergedLogo
        } else {
          delete page.logo_url
        }
        page.image_url = 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&h=400&fit=crop&auto=format'
        page.features = [
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
        return page
      })(),
      service_operational_countries: currentDroplet.settings?.service_operational_countries || ['USA']
    }
  }

  logInfo(`Updating droplet metadata and branding...`)
  logInfo(`Sending update data: ${JSON.stringify({ droplet: updatedDropletData }, null, 2)}`)

  try {
    // Try PUT first for full updates, then PATCH as fallback
    let response
    try {
      logInfo('Trying PUT request...')
      response = await client.put(`/droplets/${config.dropletId}`, {
        droplet: updatedDropletData
      })
    } catch (putError) {
      logInfo('PUT failed, trying PATCH...')
      response = await client.patch(`/droplets/${config.dropletId}`, {
        droplet: updatedDropletData
      })
    }

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

// Main function
async function main() {
  log('🔄 Fluid Droplet Update Script', 'bright')
  log('=================================', 'bright')
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
      logInfo('  FLUID_API_KEY=your_key DROPLET_ID=your_droplet_id WEBHOOK_URL=https://your-backend.com/api/webhooks/fluid node scripts/update-droplet.js')
      console.log()
      logInfo('Required environment variables:')
      logInfo('  FLUID_API_KEY=your_fluid_api_key')
      logInfo('  DROPLET_ID=your_droplet_id')
      logInfo('  WEBHOOK_URL=https://your-backend.com/api/webhooks/fluid')
      console.log()
      logInfo('Optional environment variables:')
      logInfo('  FLUID_API_URL=https://api.fluid.app (default)')
      process.exit(1)
    }

    // Update the droplet
    logInfo('Updating droplet in Fluid platform...')
    const result = await updateDroplet(config)

    // Extract droplet information
    const droplet = result.droplet || result.data || result

    // Success!
    console.log()
    logSuccess('🎉 Droplet updated successfully!')
    console.log()
    log('📋 Updated Droplet Details:', 'cyan')
    log(`   ID: ${config.dropletId}`, 'bright')
    log(`   Name: ${droplet.name || 'Unknown'}`)
    log(`   Embed URL: ${droplet.embed_url || 'Not set'}`)
    log(`   Webhook URL: ${droplet.webhook_url || 'Not set'}`)
    log(`   Status: ${droplet.active ? 'Active' : 'Inactive'}`)
    
    // Verify the webhook URL was actually set
    if (!droplet.webhook_url || droplet.webhook_url === 'undefined') {
      logWarning('⚠️  Webhook URL may not have been set properly')
      logInfo('Note: Some Fluid API versions may not return webhook_url in the response')
      logInfo('Check your Fluid dashboard to verify the webhook URL was set')
      logInfo('If webhook URL cannot be updated, you may need to recreate the droplet')
    } else {
      logSuccess('✅ Webhook URL successfully configured!')
    }
    
    console.log()
    log('🚀 Next Steps:', 'cyan')
    log('1. Test your droplet by uninstalling and reinstalling it in Fluid')
    log('2. Check your backend logs to confirm webhook events are being received')
    log('3. Verify that uninstall now properly removes the installation')
    console.log()
    log('🔗 Your droplet should now properly handle uninstall webhooks!', 'green')

  } catch (error) {
    console.log()
    logError('Failed to update droplet:')
    logError(error.message)
    
    if (error.message.includes('401') || error.message.includes('authentication')) {
      console.log()
      logInfo('Authentication issues? Check that:')
      logInfo('• Your FLUID_API_KEY is correct and starts with "PT-"')
      logInfo('• Your API key has droplet update permissions')
      logInfo('• You are using the correct FLUID_API_URL')
    } else if (error.message.includes('404')) {
      console.log()
      logInfo('Droplet not found? Check that:')
      logInfo('• Your DROPLET_ID is correct')
      logInfo('• The droplet exists in your Fluid account')
      logInfo('• You have permission to access this droplet')
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