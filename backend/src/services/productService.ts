import { prisma } from '../db'

export interface FluidProduct {
  id: number
  title: string
  sku?: string
  description?: string
  image_url?: string
  status?: string
  price?: string
  in_stock?: boolean
  public?: boolean
}

export interface FluidProductsResponse {
  products: FluidProduct[]
  meta: {
    request_id: string
    timestamp: string
    pagination?: {
      page: number
      per_page: number
      total_pages: number
      total_count: number
    }
  }
}

export class ProductService {
  /**
   * Fetch products from Fluid API
   */
  static async fetchProductsFromFluid(
    companyShop: string,
    authToken: string,
    page: number = 1,
    perPage: number = 50
  ): Promise<FluidProductsResponse> {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
      status: 'active' // Only fetch active products
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    try {
      // Try multiple API endpoints to find the correct one
      const possibleEndpoints = [
        `https://${companyShop}.fluid.app/api/company/v1/products?${queryParams}`, // Original
        `https://app.nexui.com/api/company/v1/products?company=${companyShop}&${queryParams}`, // New API base from dashboard
        `https://app.nexui.com/api/companies/${companyShop}/products?${queryParams}`, // Alternative structure
        `https://api.fluid.app/api/company/v1/products?company=${companyShop}&${queryParams}` // Global API fallback
      ];

      let response = null;

      for (const endpoint of possibleEndpoints) {
        console.log(`🔍 Trying products API endpoint: ${endpoint}`);

        try {
          response = await fetch(endpoint, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            },
            signal: controller.signal
          });

          if (response.ok) {
            console.log(`✅ Success with products endpoint: ${endpoint}`);
            break;
          } else {
            console.log(`❌ Failed with ${endpoint}: ${response.status} ${response.statusText}`);
          }
        } catch (endpointError) {
          console.log(`❌ Error with ${endpoint}: ${endpointError}`);
        }
      }

      if (!response || !response.ok) {
        throw new Error(`All product API endpoints failed. Last status: ${response?.status || 'No response'}`);
      }

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`Failed to fetch products from Fluid: ${response.status} ${response.statusText}`)
      }

      return await response.json()
    } catch (error: any) {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        throw new Error('Request timeout: Fluid API took too long to respond')
      }
      throw error
    }
  }

  /**
   * Sync products from Fluid to our database
   */
  static async syncProductsFromFluid(
    installationId: string,
    companyShop: string,
    authToken: string
  ): Promise<{ synced: number; errors: number }> {
    try {
      // Fetch all products from Fluid (with pagination)
      let page = 1
      let hasMorePages = true
      let syncedCount = 0
      let errorCount = 0

      while (hasMorePages) {
        const fluidResponse = await this.fetchProductsFromFluid(companyShop, authToken, page, 50)
        
        // Process each product
        for (const fluidProduct of fluidResponse.products) {
          try {
            await prisma.$executeRaw`
              INSERT INTO products (
                id, "installationId", "fluidProductId", title, sku, description, 
                "imageUrl", status, price, "inStock", public, "createdAt", "updatedAt"
              ) VALUES (
                gen_random_uuid(), ${installationId}, ${fluidProduct.id.toString()}, 
                ${fluidProduct.title}, ${fluidProduct.sku || null}, ${fluidProduct.description || null},
                ${fluidProduct.image_url || null}, ${fluidProduct.status || null}, 
                ${fluidProduct.price || null}, ${fluidProduct.in_stock ?? true}, 
                ${fluidProduct.public ?? true}, NOW(), NOW()
              )
              ON CONFLICT ("installationId", "fluidProductId") 
              DO UPDATE SET
                title = EXCLUDED.title,
                sku = EXCLUDED.sku,
                description = EXCLUDED.description,
                "imageUrl" = EXCLUDED."imageUrl",
                status = EXCLUDED.status,
                price = EXCLUDED.price,
                "inStock" = EXCLUDED."inStock",
                public = EXCLUDED.public,
                "updatedAt" = NOW()
            `
            syncedCount++
          } catch (error) {
            console.error(`Error syncing product ${fluidProduct.id}:`, error)
            errorCount++
          }
        }

        // Check if there are more pages
        if (fluidResponse.meta.pagination) {
          hasMorePages = page < fluidResponse.meta.pagination.total_pages
          page++
        } else {
          hasMorePages = false
        }
      }

      return { synced: syncedCount, errors: errorCount }
    } catch (error) {
      console.error('Error syncing products from Fluid:', error)
      throw error
    }
  }

  /**
   * Get products from our database for an installation
   */
  static async getProductsForInstallation(installationId: string) {
    return await prisma.$queryRaw`
      SELECT * FROM products 
      WHERE "installationId" = ${installationId}
      ORDER BY "updatedAt" DESC
    `
  }

  /**
   * Get a single product by Fluid ID
   */
  static async getProductByFluidId(installationId: string, fluidProductId: string) {
    const result = await prisma.$queryRaw`
      SELECT * FROM products 
      WHERE "installationId" = ${installationId} AND "fluidProductId" = ${fluidProductId}
      LIMIT 1
    `
    return Array.isArray(result) && result.length > 0 ? result[0] : null
  }
}
