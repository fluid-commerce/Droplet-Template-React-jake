import { FastifyInstance } from 'fastify'
import { ProductService } from '../services/productService'
import { prisma } from '../db'

export async function productRoutes(fastify: FastifyInstance) {
  // Simple in-memory cache for product images to avoid repeated API calls
  const imageCache = new Map<string, { url: string | null; cachedAt: number }>()
  const IMAGE_CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes
  // Get products for an installation (from our database)
  fastify.get('/api/products/:installationId', async (request, reply) => {
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

      const products = await ProductService.getProductsForInstallation(installation.id)
      
      return reply.send({
        success: true,
        data: {
          products,
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
        message: 'Failed to fetch products'
      })
    }
  })

  // Get product image by product ID
  fastify.get('/api/products/:installationId/image/:productId', async (request, reply) => {
    try {
      const { installationId, productId } = request.params as { installationId: string, productId: string }
      
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

      // Check DB first
      const existingProduct = await ProductService.getProductByFluidId(installation.id, productId)
      if (existingProduct && (existingProduct as any).imageUrl) {
        return reply.send({ success: true, imageUrl: (existingProduct as any).imageUrl })
      }

      // Check cache next
      const cacheKey = `${installationId}:${productId}`
      const cached = imageCache.get(cacheKey)
      if (cached && Date.now() - cached.cachedAt < IMAGE_CACHE_TTL_MS) {
        return reply.send({ success: true, imageUrl: cached.url })
      }

      // Fetch product image from Fluid API on cache miss
      try {
        // Ensure we pass the subdomain (e.g., "tacobell") not the full domain
        const fluidShop = (installation as any).fluidShop
        const companyShop = fluidShop?.replace?.('.fluid.app', '') || fluidShop

        const imageUrl = await ProductService.fetchProductImages(
          companyShop,
          (installation as any).authenticationToken,
          parseInt(productId)
        )

        // Update DB if we found an imageUrl
        if (imageUrl) {
          await prisma.$executeRaw`
            UPDATE products SET "imageUrl" = ${imageUrl}, "updatedAt" = NOW()
            WHERE "installationId" = ${installation.id} AND "fluidProductId" = ${productId}
          `
        }

        // Update cache
        imageCache.set(cacheKey, { url: imageUrl, cachedAt: Date.now() })

        return reply.send({
          success: true,
          imageUrl: imageUrl
        })
      } catch (error) {
        // Do not spam logs; log a concise error once
        fastify.log.error({ err: error, productId }, 'Failed to fetch product image from Fluid API')
        return reply.send({
          success: false,
          imageUrl: null,
          message: 'Failed to fetch product image from Fluid API'
        })
      }
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        success: false,
        message: 'Failed to fetch product image'
      })
    }
  })

  // Sync products from Fluid API to our database
  fastify.post('/api/products/:installationId/sync', async (request, reply) => {
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

      // Sync products from Fluid
      const syncResult = await ProductService.syncProductsFromFluid(
        installation.id,
        companyShop,
        (installation as any).authenticationToken
      )

      return reply.send({
        success: true,
        data: {
          message: `Successfully synced ${syncResult.synced} products from Fluid`,
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
        message: 'Failed to sync products from Fluid'
      })
    }
  })

  // Get products directly from Fluid API (for testing)
  fastify.get('/api/products/:installationId/fluid', async (request, reply) => {
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

      // Fetch products directly from Fluid API
      const fluidResponse = await ProductService.fetchProductsFromFluid(
        companyShop,
        (installation as any).authenticationToken,
        1,
        10 // Limit to 10 for testing
      )

      return reply.send({
        success: true,
        data: {
          products: fluidResponse.products,
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
        message: 'Failed to fetch products from Fluid API'
      })
    }
  })

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

      const orders = await ProductService.getOrdersForInstallation(installation.id)
      
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
      const syncResult = await ProductService.syncOrdersFromFluid(
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

  // Test products API with dit_ token (debugging endpoint)
  fastify.get('/api/products/:installationId/test-dit-token', async (request, reply) => {
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
      const companyShop = fluidShop.replace('.fluid.app', '')
      const authToken = (installation as any).authenticationToken

      // Test the exact API call
      const testUrl = `https://${companyShop}.fluid.app/api/company/v1/products?status=active`

      fastify.log.info(`🧪 Testing dit_ token with URL: ${testUrl}`)
      fastify.log.info(`🧪 Using token: ${authToken?.substring(0, 15)}...`)

      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      })

      const responseText = await response.text()

      fastify.log.info(`🧪 Response status: ${response.status}`)
      fastify.log.info(`🧪 Response body: ${responseText}`)

      return reply.send({
        success: true,
        test_results: {
          url: testUrl,
          status: response.status,
          statusText: response.statusText,
          response: responseText,
          token_prefix: authToken?.substring(0, 15)
        }
      })

    } catch (error) {
      fastify.log.error(`Test endpoint error: ${error instanceof Error ? error.message : String(error)}`)
      return reply.status(500).send({
        success: false,
        message: 'Test failed',
        error: error instanceof Error ? error.message : String(error)
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
      const fluidResponse = await ProductService.fetchOrdersFromFluid(
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
