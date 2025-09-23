import { prisma } from '../db'

export interface FluidOrder {
  id: number
  order_number?: string
  amount?: string
  status?: string
  created_at?: string
  customer?: {
    email?: string
    first_name?: string
    last_name?: string
    name?: string
  }
  items_count?: number
  [key: string]: any // Allow for additional fields from Fluid API
}

export interface FluidOrdersResponse {
  orders: FluidOrder[]
  meta: {
    request_id: string
    timestamp: string
    current_page?: number
    total_count?: number
    pagination?: {
      page: number
      per_page: number
      total_pages: number
      total_count: number
    }
  }
}

export class OrderService {
  /**
   * Get the best available authentication token for API calls
   * Priority: companyApiKey > webhookVerificationToken > authenticationToken
   */
  static getBestAuthToken(installation: any): string | null {
    return installation.companyApiKey ||
           installation.webhookVerificationToken ||
           installation.authenticationToken ||
           null;
  }

  /**
   * Sync orders from Fluid to our database using batch processing
   */
  static async syncOrdersFromFluid(
    installationId: string,
    companyShop: string,
    authToken: string
  ): Promise<{ synced: number; errors: number }> {
    try {
      // Fetch all orders from Fluid (with pagination)
      let page = 1
      let hasMorePages = true
      let allOrders: any[] = []
      let syncedCount = 0
      let errorCount = 0
      const BATCH_SIZE = 100 // Process orders in batches of 100

      // First, collect all orders from all pages
      while (hasMorePages) {
        const fluidResponse = await this.fetchOrdersFromFluid(companyShop, authToken, page, 50)
        allOrders.push(...fluidResponse.orders)

        // Check if there are more pages
        if (fluidResponse.meta.pagination) {
          hasMorePages = page < fluidResponse.meta.pagination.total_pages
          page++
        } else if (fluidResponse.meta.current_page && fluidResponse.meta.total_count) {
          // Fallback to current_page and total_count if pagination object doesn't exist
          const calculatedTotalPages = Math.ceil(fluidResponse.meta.total_count / 50)
          hasMorePages = page < calculatedTotalPages
          page++
        } else {
          hasMorePages = false
        }
      }

      // Process orders in batches for optimal performance
      for (let i = 0; i < allOrders.length; i += BATCH_SIZE) {
        const batch = allOrders.slice(i, i + BATCH_SIZE)

        try {
          // Prepare batch data
          const orderValues = batch.map(fluidOrder => {
            const customerEmail = fluidOrder.customer?.email || null
            const customerName = fluidOrder.customer?.name ||
              (fluidOrder.customer?.first_name && fluidOrder.customer?.last_name
                ? `${fluidOrder.customer.first_name} ${fluidOrder.customer.last_name}`
                : null)

            return {
              id: 'gen_random_uuid()',
              installationId,
              fluidOrderId: fluidOrder.id.toString(),
              orderNumber: fluidOrder.order_number || null,
              amount: fluidOrder.amount || null,
              status: fluidOrder.status || null,
              customerEmail,
              customerName,
              itemsCount: fluidOrder.items_count || null,
              orderData: JSON.stringify(fluidOrder),
              createdAt: 'NOW()',
              updatedAt: 'NOW()'
            }
          })

          // Build batch upsert query
          const values = orderValues.map((_, index) =>
            `(gen_random_uuid(), $${index * 9 + 1}, $${index * 9 + 2}, $${index * 9 + 3}, $${index * 9 + 4}, $${index * 9 + 5}, $${index * 9 + 6}, $${index * 9 + 7}, $${index * 9 + 8}::integer, $${index * 9 + 9}::jsonb, NOW(), NOW())`
          ).join(', ')

          const params = orderValues.flatMap(order => [
            order.installationId,
            order.fluidOrderId,
            order.orderNumber,
            order.amount,
            order.status,
            order.customerEmail,
            order.customerName,
            order.itemsCount,
            order.orderData
          ])

          // Execute batch upsert
          await prisma.$executeRawUnsafe(`
            INSERT INTO orders (
              id, "installationId", "fluidOrderId", "orderNumber", amount, status,
              "customerEmail", "customerName", "itemsCount", "orderData", "createdAt", "updatedAt"
            ) VALUES ${values}
            ON CONFLICT ("installationId", "fluidOrderId")
            DO UPDATE SET
              "orderNumber" = EXCLUDED."orderNumber",
              amount = EXCLUDED.amount,
              status = EXCLUDED.status,
              "customerEmail" = EXCLUDED."customerEmail",
              "customerName" = EXCLUDED."customerName",
              "itemsCount" = EXCLUDED."itemsCount",
              "orderData" = EXCLUDED."orderData",
              "updatedAt" = NOW()
          `, ...params)

          syncedCount += batch.length
        } catch (error) {
          console.error(`Error syncing batch of ${batch.length} orders:`, error)
          errorCount += batch.length
        }
      }

      return { synced: syncedCount, errors: errorCount }
    } catch (error) {
      console.error('Error syncing orders from Fluid:', error)
      throw error
    }
  }

  /**
   * Get orders from our database for an installation
   */
  static async getOrdersForInstallation(installationId: string) {
    return await prisma.$queryRaw`
      SELECT * FROM orders
      WHERE "installationId" = ${installationId}
      ORDER BY "updatedAt" DESC
    `
  }

  /**
   * Fetch orders from Fluid API (for testing token functionality)
   */
  static async fetchOrdersFromFluid(
    companyShop: string,
    authToken: string,
    page: number = 1,
    perPage: number = 10
  ): Promise<FluidOrdersResponse> {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString()
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    try {
      // Try multiple API endpoints for orders (dit_ tokens work with v1 API)
      const possibleEndpoints = [
        `https://${companyShop}.fluid.app/api/v1/orders?${queryParams}`, // Working: v1 API
        `https://fluid.app/api/v1/orders?company=${companyShop}&${queryParams}`, // Working: global v1 API
        `https://${companyShop}.fluid.app/api/v202506/orders?${queryParams}`, // Fallback: Latest version
        `https://${companyShop}.fluid.app/api/v2/orders?${queryParams}` // Fallback: v2 version
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
        throw new Error(`All orders API endpoints failed. Last status: ${response?.status || 'No response'}`);
      }

      clearTimeout(timeoutId)

      const data = await response.json()
      return data as FluidOrdersResponse
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error) {
        throw new Error(`Failed to fetch orders from Fluid: ${error.message}`)
      }
      throw new Error('Failed to fetch orders from Fluid: Unknown error')
    }
  }

  /**
   * Create a test order in Fluid API for webhook testing
   */
  static async createTestOrder(
    companyShop: string,
    authToken: string
  ): Promise<any> {
    const testOrderData = {
      order: {
        payment_status: 'marked_paid',
        financial_status: 'paid',
        order_status: 'draft',
        fulfillment_status: 'unfulfilled',
        customer_email: 'test@webhook-test.com',
        customer_first_name: 'Webhook',
        customer_last_name: 'Test',
        line_items: [
          {
            title: 'Test Webhook Item',
            quantity: 1,
            price: '1.00'
          }
        ],
        note: `Test order created by droplet at ${new Date().toISOString()} to test webhook functionality`,
        tags: ['webhook-test', 'droplet-generated']
      }
    }

    // Try creating order directly with dit_ token
    const orderResponse = await fetch(`https://${companyShop}.fluid.app/api/v1/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testOrderData)
    })

    let orderResult
    let responseText = ''

    try {
      responseText = await orderResponse.text()
      orderResult = responseText ? JSON.parse(responseText) : {}
    } catch (parseError) {
      throw new Error(`Invalid JSON response: ${responseText}`)
    }

    if (!orderResponse.ok) {
      throw new Error(`Failed to create test order: ${orderResponse.status} - ${responseText}`)
    }

    return orderResult
  }
}