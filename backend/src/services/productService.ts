import { prisma } from '../db'

export interface FluidProduct {
  id: number
  title: string
  sku?: string
  description?: string
  image_url?: string
  imageUrl?: string
  image?: string
  images?: any[]
  status?: string
  price?: string
  in_stock?: boolean
  public?: boolean
  [key: string]: any // Allow for additional fields from Fluid API
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
   * Get the best available authentication token for API calls
   * Priority: authenticationToken > webhookVerificationToken
   */
  static getBestAuthToken(installation: any): string | null {
    return installation.authenticationToken ||
           installation.webhookVerificationToken ||
           null;
  }

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
      per_page: perPage.toString()
      // Removed status: 'active' filter to allow all products including drafts
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    try {
      // Try company endpoint first (works with both dit_ and PT tokens)
      // Then fallback to v1 endpoints if company endpoint fails
      const possibleEndpoints = [
        `https://${companyShop}.fluid.app/api/company/v1/products?${queryParams}`, // Company endpoint (works with dit_ and PT)
        `https://${companyShop}.fluid.app/api/v1/products?${queryParams}`, // Subdomain v1
        `https://fluid.app/api/v1/products?company=${companyShop}&${queryParams}`, // Global API
        `https://api.fluid.app/api/v1/products?company=${companyShop}&${queryParams}` // Fallback: global v1
      ];

      let response = null;

      for (const endpoint of possibleEndpoints) {

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
            break;
          } else {
          }
        } catch (endpointError: any) {
        }
      }

      if (!response || !response.ok) {
        throw new Error(`All product API endpoints failed. Last status: ${response?.status || 'No response'}`);
      }

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`Failed to fetch products from Fluid: ${response.status} ${response.statusText}`)
      }

      const raw = await response.json()

      // According to updated Fluid API docs, response format is:
      // { products: [...], meta: { request_id, timestamp, pagination } }
      const products = raw?.products || []
      const meta = raw?.meta || {}

      return { products, meta }
    } catch (error: any) {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        throw new Error('Request timeout: Fluid API took too long to respond')
      }
      throw error
    }
  }

  /**
   * Fetch product images from Fluid API
   */
  static async fetchProductImages(
    companyShop: string,
    authToken: string,
    productId: number
  ): Promise<string | null> {
    try {
      const possibleEndpoints = [
        `https://${companyShop}.fluid.app/api/company/v1/products/${productId}/images`,
        `https://app.nexui.com/api/company/v1/products/${productId}/images?company=${companyShop}`,
        `https://api.fluid.app/api/company/v1/products/${productId}/images?company=${companyShop}`
      ]
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout for images

      let imageUrl: string | null = null
      for (const endpoint of possibleEndpoints) {
        try {
          const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            },
            signal: controller.signal
          })
          if (!response.ok) continue

          const data = await response.json()
          // Normalize shapes: { images: [...] } or { status: 'success', data: { images: [...] } }
          const images = data?.images || data?.data?.images || []
          if (Array.isArray(images) && images.length > 0) {
            const sortedImages = images.sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
            imageUrl = sortedImages[0]?.image_url || sortedImages[0]?.url || null
            if (imageUrl) break
          }
        } catch (e) {
          // try next endpoint
        }
      }

      clearTimeout(timeoutId)
      return imageUrl
    } catch (error: any) {
      // If there's any error fetching images, just return null
      return null
    }
  }

  /**
   * Sync products from Fluid to our database
   */
  static async syncProductsFromFluid(
    installationId: string,
    companyShop: string,
    authToken: string,
    companyApiKey?: string
  ): Promise<{ synced: number; errors: number }> {
    try {
      // Use company API key if available, fallback to dit token
      const tokenToUse = companyApiKey || authToken

      // Fetch all products from Fluid (with pagination)
      let page = 1
      let hasMorePages = true
      let syncedCount = 0
      let errorCount = 0

      while (hasMorePages) {
        const fluidResponse = await this.fetchProductsFromFluid(companyShop, tokenToUse, page, 50)
        
        // Process each product
        for (const fluidProduct of fluidResponse.products) {
          try {
            
            // Prefer image fields present on the product payload to avoid extra calls
            let imageUrl = (
              fluidProduct.image_url ||
              fluidProduct.imageUrl ||
              fluidProduct.image ||
              (Array.isArray(fluidProduct.images) && fluidProduct.images.length > 0
                ? (fluidProduct.images[0]?.image_url || fluidProduct.images[0]?.url || null)
                : null)
            ) as string | null

            // Fallback: fetch images from images endpoint only if not present
            if (!imageUrl) {
              imageUrl = await ProductService.fetchProductImages(companyShop, tokenToUse, fluidProduct.id)
            }
            

            // Strip HTML from description
            const cleanDescription = fluidProduct.description 
              ? fluidProduct.description.replace(/<[^>]*>/g, '') 
              : null

            await prisma.$executeRaw`
              INSERT INTO products (
                id, "installationId", "fluidProductId", title, sku, description, 
                "imageUrl", status, price, "inStock", public, "createdAt", "updatedAt"
              ) VALUES (
                gen_random_uuid(), ${installationId}, ${fluidProduct.id.toString()}, 
                ${fluidProduct.title}, ${fluidProduct.sku || null}, ${cleanDescription},
                ${imageUrl}, ${fluidProduct.status || null}, 
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
    const products = await prisma.$queryRaw`
      SELECT * FROM products 
      WHERE "installationId" = ${installationId}
      ORDER BY "updatedAt" DESC
    `
    
    
    return products
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
