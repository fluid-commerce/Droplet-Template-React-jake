import { FastifyInstance } from 'fastify'
import { OrderService } from '../services/orderService'
import { prisma } from '../db'

export async function orderRoutes(fastify: FastifyInstance) {
  // Get orders for an installation (from our database)
  fastify.get('/api/orders/:installationId', async (request, reply) => {
    try {
      const { installationId } = request.params as { installationId: string }

      // Verify installation exists and is active
      const installationResult = await prisma.$queryRaw`
        SELECT i.*, c.name as "companyName", c."logoUrl" as "companyLogoUrl", c."fluidShop"
        FROM installations i
        JOIN companies c ON i."companyId" = c.id
        WHERE i."fluidId" = ${installationId} AND i."isActive" = true
        LIMIT 1
      `
      const installation = Array.isArray(installationResult) && installationResult.length > 0
        ? installationResult[0]
        : null

      if (!installation) {
        return reply.status(404).send({
          success: false,
          message: 'Installation not found or inactive'
        })
      }

      const orders = await OrderService.getOrdersForInstallation(installation.id)

      return reply.send({
        success: true,
        data: {
          orders,
          installation: {
            id: installation.fluidId,
            companyName: installation.companyName
          }
        }
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        message: 'Failed to fetch orders'
      })
    }
  })

  // Sync orders from Fluid API to our database
  fastify.post('/api/orders/:installationId/sync', async (request, reply) => {
    try {
      const { installationId } = request.params as { installationId: string }

      // Get installation details
      const installationResult = await prisma.$queryRaw`
        SELECT i.*, c.name as "companyName", c."logoUrl" as "companyLogoUrl", c."fluidShop"
        FROM installations i
        JOIN companies c ON i."companyId" = c.id
        WHERE i."fluidId" = ${installationId} AND i."isActive" = true
        LIMIT 1
      `
      const installation = Array.isArray(installationResult) && installationResult.length > 0
        ? installationResult[0]
        : null

      if (!installation) {
        return reply.status(404).send({
          success: false,
          message: 'Installation not found or inactive'
        })
      }

      if (!(installation as any).authenticationToken) {
        return reply.status(400).send({
          success: false,
          message: 'No authentication token available for this installation'
        })
      }

      // Get company subdomain from stored fluidShop
      const fluidShop = (installation as any).fluidShop
      if (!fluidShop) {
        return reply.status(400).send({
          success: false,
          message: 'Company Fluid shop domain not found. Please reinstall the droplet.'
        })
      }

      // Extract subdomain (e.g., "pokey" from "pokey.fluid.app")
      const companyShop = fluidShop.replace('.fluid.app', '')

      // Sync orders from Fluid
      const syncResult = await OrderService.syncOrdersFromFluid(
        installation.id,
        companyShop,
        (installation as any).authenticationToken
      )

      return reply.send({
        success: true,
        data: {
          message: `Successfully synced ${syncResult.synced} orders from Fluid`,
          synced: syncResult.synced,
          errors: syncResult.errors,
          installation: {
            id: installation.fluidId,
            companyName: installation.companyName
          }
        }
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        message: 'Failed to sync orders from Fluid'
      })
    }
  })

  // Test webhook by creating a simple order that triggers webhook
  fastify.post('/api/orders/:installationId/test-webhook', async (request, reply) => {
    try {
      const { installationId } = request.params as { installationId: string }

      // Get installation details
      const installationResult = await prisma.$queryRaw`
        SELECT i.*, c.name as "companyName", c."logoUrl" as "companyLogoUrl", c."fluidShop"
        FROM installations i
        JOIN companies c ON i."companyId" = c.id
        WHERE i."fluidId" = ${installationId} AND i."isActive" = true
        LIMIT 1
      `
      const installation = Array.isArray(installationResult) && installationResult.length > 0
        ? installationResult[0]
        : null

      if (!installation) {
        return reply.status(404).send({
          success: false,
          message: 'Installation not found or inactive'
        })
      }

      if (!(installation as any).authenticationToken) {
        return reply.status(400).send({
          success: false,
          message: 'No authentication token available for this installation'
        })
      }

      const fluidShop = (installation as any).fluidShop
      if (!fluidShop) {
        return reply.status(400).send({
          success: false,
          message: 'Company Fluid shop domain not found. Please reinstall the droplet.'
        })
      }

      const companyShop = fluidShop.replace('.fluid.app', '')

      // Create test order to trigger webhook
      fastify.log.info(`🧪 Creating test order to trigger webhook for company: ${companyShop}`)

      const orderResult = await OrderService.createTestOrder(
        companyShop,
        (installation as any).authenticationToken
      )

      fastify.log.info(`🧪 Test order created successfully`)

      return reply.send({
        success: true,
        message: 'Test order created! Check your webhook logs for the incoming webhook data.',
        data: {
          testOrder: orderResult,
          webhookExpected: 'Your backend should receive a webhook with order.created event',
          instructions: 'Monitor your backend logs to see the raw webhook JSON payload',
          installation: {
            id: installation.fluidId,
            companyName: installation.companyName
          }
        }
      })
    } catch (error) {
      fastify.log.error(`Test webhook error: ${error}`)
      return reply.status(500).send({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create test order for webhook',
        debug: {
          error: error instanceof Error ? error.message : String(error)
        }
      })
    }
  })

  // Get products for order creation (using company token if available)
  fastify.get('/api/orders/:installationId/products', async (request, reply) => {
    try {
      const { installationId } = request.params as { installationId: string }

      // Get installation details
      const installationResult = await prisma.$queryRaw`
        SELECT i.*, c.name as "companyName", c."logoUrl" as "companyLogoUrl", c."fluidShop"
        FROM installations i
        JOIN companies c ON i."companyId" = c.id
        WHERE i."fluidId" = ${installationId} AND i."isActive" = true
        LIMIT 1
      `
      const installation = Array.isArray(installationResult) && installationResult.length > 0
        ? installationResult[0]
        : null

      if (!installation) {
        return reply.status(404).send({
          success: false,
          message: 'Installation not found or inactive'
        })
      }

      const fluidShop = (installation as any).fluidShop
      const companyApiKey = (installation as any).companyApiKey

      if (!fluidShop) {
        return reply.status(400).send({
          success: false,
          message: 'Company Fluid shop domain not found. Please reinstall the droplet.'
        })
      }

      if (!companyApiKey) {
        return reply.status(400).send({
          success: false,
          message: 'Company API key not found. Please add your company API token in the dashboard to enable product selection.'
        })
      }

      const companyShop = fluidShop.replace('.fluid.app', '')

      // Fetch products using company API key
      const response = await fetch(`https://${companyShop}.fluid.app/api/company/v1/products?status=active&per_page=100`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${companyApiKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.status}`)
      }

      const data = await response.json()

      // Transform products for dropdown usage
      const productVariants = data.products.flatMap((product: any) =>
        product.variants.map((variant: any) => ({
          variantId: variant.id,
          productTitle: product.title,
          variantTitle: variant.title || 'Default',
          sku: variant.sku || product.sku,
          price: variant.variant_countries?.US?.price || product.price,
          displayPrice: variant.variant_countries?.US?.display_price || product.display_price,
          inStock: product.in_stock,
          label: `${product.title}${variant.title ? ` - ${variant.title}` : ''} (${variant.sku || product.sku || 'No SKU'}) - ${variant.variant_countries?.US?.display_price || product.display_price || 'No price'}`
        }))
      )

      return reply.send({
        success: true,
        data: {
          variants: productVariants,
          installation: {
            id: installation.fluidId,
            companyName: installation.companyName
          }
        }
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        message: 'Failed to fetch products for order creation'
      })
    }
  })

  // Create order in Fluid API
  fastify.post('/api/orders/:installationId/create', async (request, reply) => {
    try {
      const { installationId } = request.params as { installationId: string }
      const orderData = request.body as any

      // Get installation details
      const installationResult = await prisma.$queryRaw`
        SELECT i.*, c.name as "companyName", c."logoUrl" as "companyLogoUrl", c."fluidShop"
        FROM installations i
        JOIN companies c ON i."companyId" = c.id
        WHERE i."fluidId" = ${installationId} AND i."isActive" = true
        LIMIT 1
      `
      const installation = Array.isArray(installationResult) && installationResult.length > 0
        ? installationResult[0]
        : null

      if (!installation) {
        return reply.status(404).send({
          success: false,
          message: 'Installation not found or inactive'
        })
      }

      if (!(installation as any).authenticationToken) {
        return reply.status(400).send({
          success: false,
          message: 'No authentication token available for this installation'
        })
      }

      const fluidShop = (installation as any).fluidShop
      if (!fluidShop) {
        return reply.status(400).send({
          success: false,
          message: 'Company Fluid shop domain not found. Please reinstall the droplet.'
        })
      }

      const companyShop = fluidShop.replace('.fluid.app', '')

      // Create cart first
      const cartResponse = await fetch(`https://${companyShop}.fluid.app/api/carts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(installation as any).authenticationToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          country_code: orderData.countryCode || 'US',
          fluid_shop: fluidShop,
          items: orderData.items.map((item: any) => ({
            variant_id: parseInt(item.variantId),
            quantity: item.quantity
          }))
        })
      })

      if (!cartResponse.ok) {
        throw new Error(`Failed to create cart: ${cartResponse.status}`)
      }

      const cartData = await cartResponse.json()
      const cartToken = cartData.cart.cart_token

      // Update cart with email
      await fetch(`https://${companyShop}.fluid.app/api/carts/${cartToken}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${(installation as any).authenticationToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: orderData.email
        })
      })

      // Update cart with shipping address
      await fetch(`https://${companyShop}.fluid.app/api/carts/${cartToken}/address`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(installation as any).authenticationToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'ship_to',
          address: {
            first_name: orderData.firstName,
            last_name: orderData.lastName,
            address1: orderData.address1,
            address2: orderData.address2 || null,
            city: orderData.city,
            state: orderData.state,
            postal_code: orderData.postalCode,
            country_code: orderData.countryCode || 'US'
          }
        })
      })

      // Create order from cart
      const orderResponse = await fetch(`https://${companyShop}.fluid.app/api/orders?cart_token=${cartToken}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(installation as any).authenticationToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          order: {
            payment_status: 'marked_paid',
            financial_status: 'paid',
            order_status: 'draft',
            fulfillment_status: 'unfulfilled'
          }
        })
      })

      if (!orderResponse.ok) {
        const errorText = await orderResponse.text()
        throw new Error(`Failed to create order: ${orderResponse.status} - ${errorText}`)
      }

      const orderResult = await orderResponse.json()

      return reply.send({
        success: true,
        data: {
          orderNumber: orderResult.order.order_number,
          orderId: orderResult.order.id,
          total: orderResult.order.total,
          message: `Order ${orderResult.order.order_number} created successfully!`,
          installation: {
            id: installation.fluidId,
            companyName: installation.companyName
          }
        }
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create order in Fluid'
      })
    }
  })

  // Test orders from Fluid API (for testing token functionality)
  fastify.get('/api/orders/:installationId/fluid', async (request, reply) => {
    try {
      const { installationId } = request.params as { installationId: string }

      // Get installation details
      const installationResult = await prisma.$queryRaw`
        SELECT i.*, c.name as "companyName", c."logoUrl" as "companyLogoUrl", c."fluidShop"
        FROM installations i
        JOIN companies c ON i."companyId" = c.id
        WHERE i."fluidId" = ${installationId} AND i."isActive" = true
        LIMIT 1
      `
      const installation = Array.isArray(installationResult) && installationResult.length > 0
        ? installationResult[0]
        : null

      if (!installation) {
        return reply.status(404).send({
          success: false,
          message: 'Installation not found or inactive'
        })
      }

      if (!(installation as any).authenticationToken) {
        return reply.status(400).send({
          success: false,
          message: 'No authentication token available for this installation'
        })
      }

      // Get company subdomain from stored fluidShop
      const fluidShop = (installation as any).fluidShop
      if (!fluidShop) {
        return reply.status(400).send({
          success: false,
          message: 'Company Fluid shop domain not found. Please reinstall the droplet.'
        })
      }

      // Extract subdomain (e.g., "pokey" from "pokey.fluid.app")
      const companyShop = fluidShop.replace('.fluid.app', '')

      // Fetch orders directly from Fluid API
      const fluidResponse = await OrderService.fetchOrdersFromFluid(
        companyShop,
        (installation as any).authenticationToken,
        1,
        5 // Limit to 5 for testing
      )

      return reply.send({
        success: true,
        data: {
          orders: fluidResponse.orders,
          meta: fluidResponse.meta,
          installation: {
            id: installation.fluidId,
            companyName: installation.companyName
          }
        }
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        message: 'Failed to fetch orders from Fluid API'
      })
    }
  })
}