import { FastifyInstance } from 'fastify'
import { ProductService } from '../services/productService'
import { prisma } from '../db'

export async function productRoutes(fastify: FastifyInstance) {
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

      // Fetch product image from Fluid API
      try {
        console.log(`🔄 Backend: Fetching image for product ${productId} from Fluid API`)
        const imageUrl = await ProductService.fetchProductImages(
          installation.fluidShop,
          installation.authenticationToken,
          parseInt(productId)
        )
        
        console.log(`✅ Backend: Got image URL for product ${productId}:`, imageUrl)
        
        return reply.send({
          success: true,
          imageUrl: imageUrl
        })
      } catch (error) {
        console.error(`❌ Backend: Error fetching image for product ${productId}:`, error)
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
