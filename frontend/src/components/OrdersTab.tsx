import { useState, useEffect } from 'react'
import { apiClient } from '../lib/api'

interface Order {
  id: string
  fluidOrderId: string
  orderNumber?: string
  amount?: string
  status?: string
  customerEmail?: string
  customerName?: string
  itemsCount?: number
  orderData?: any
  createdAt: string
  updatedAt: string
}

interface OrdersResponse {
  success: boolean
  data: {
    orders: Order[]
    installation: {
      id: string
      companyName: string
    }
  }
}

interface SyncResponse {
  success: boolean
  data: {
    message: string
    synced: number
    errors: number
    installation: {
      id: string
      companyName: string
    }
  }
}

interface TestWebhookResponse {
  success: boolean
  message: string
  data: {
    testOrder: any
    webhookExpected: string
    instructions: string
    installation: {
      id: string
      companyName: string
    }
  }
}

interface OrdersTabProps {
  installationId: string
  brandGuidelines?: {
    color?: string
    secondary_color?: string
  }
  onSyncMessage: (message: string | null) => void
}

export function OrdersTab({ installationId, brandGuidelines, onSyncMessage }: OrdersTabProps) {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncingOrders, setIsSyncingOrders] = useState(false)
  const [isTestingWebhook, setIsTestingWebhook] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const itemsPerPage = 10

  // Helper function to format colors
  const formatColor = (color: string | null | undefined) => {
    if (!color) return undefined
    return color.startsWith('#') ? color : `#${color}`
  }

  // Fetch orders from our database
  const fetchOrders = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await apiClient.get<OrdersResponse>(`/api/orders/${installationId}`)
      if (response.data.success) {
        setOrders(response.data.data.orders)
      } else {
        setError('Failed to fetch orders')
      }
    } catch (err: any) {
      console.error('Error fetching orders:', err)
      setError(err.response?.data?.message || 'Failed to fetch orders')
    } finally {
      setIsLoading(false)
    }
  }

  // Sync orders from Fluid
  const syncOrders = async () => {
    try {
      setIsSyncingOrders(true)
      setError(null)
      onSyncMessage(null)

      const response = await apiClient.post<SyncResponse>(`/api/orders/${installationId}/sync`)
      const data = response.data

      if (data.success) {
        onSyncMessage(`Successfully synced ${data.data.synced} orders from Fluid`)
        await fetchOrders() // Refresh orders after sync
      } else {
        setError('Failed to sync orders')
      }
    } catch (err: any) {
      console.error('Error syncing orders:', err)
      setError(err.response?.data?.message || 'Failed to sync orders from Fluid')
    } finally {
      setIsSyncingOrders(false)
    }
  }

  // Test webhook by creating a test order
  const handleTestWebhook = async () => {
    try {
      setIsTestingWebhook(true)
      setError(null)
      onSyncMessage(null)

      const response = await apiClient.post<TestWebhookResponse>(`/api/orders/${installationId}/test-webhook`)
      const data = response.data

      if (data.success) {
        onSyncMessage(`🧪 ${data.message} Check your backend logs for webhook JSON!`)

        // Refresh orders after a short delay to capture any webhook updates
        setTimeout(async () => {
          await fetchOrders()
        }, 2000)
      } else {
        setError(data.message || 'Failed to trigger test webhook')
      }
    } catch (err: any) {
      console.error('Error testing webhook:', err)
      setError(err.response?.data?.message || 'Failed to trigger test webhook')
    } finally {
      setIsTestingWebhook(false)
    }
  }


  // Filter and paginate orders
  const filteredOrders = orders.filter(order =>
    (order.orderNumber && order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (order.customerEmail && order.customerEmail.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (order.customerName && order.customerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (order.status && order.status.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage)
  const getCurrentOrders = () => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredOrders.slice(startIndex, endIndex)
  }

  // Initialize
  useEffect(() => {
    if (installationId) {
      fetchOrders()
    }
  }, [installationId])

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-gray-600">Loading orders...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={syncOrders}
            disabled={isSyncingOrders || isTestingWebhook}
            className="inline-flex items-center px-4 py-2 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: brandGuidelines?.color
                ? formatColor(brandGuidelines.color)
                : '#3b82f6'
            }}
          >
            {isSyncingOrders ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Syncing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync Orders
              </>
            )}
          </button>
          <button
            onClick={handleTestWebhook}
            disabled={isSyncingOrders || isTestingWebhook}
            className="inline-flex items-center px-3 py-1.5 border border-indigo-300 text-indigo-700 bg-indigo-50 text-xs font-medium rounded-md transition-colors hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {isTestingWebhook ? 'Testing...' : 'Test Webhook'}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-red-800 text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Orders Count */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          {filteredOrders.length === orders.length
            ? `${orders.length} orders`
            : `${filteredOrders.length} of ${orders.length} orders`
          }
        </span>
        {totalPages > 1 && (
          <span>
            Page {currentPage} of {totalPages}
          </span>
        )}
      </div>

      {/* Orders Table */}
      {filteredOrders.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Items
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {getCurrentOrders().map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {order.orderNumber || `#${order.fluidOrderId}`}
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {order.customerName || 'Anonymous'}
                      </div>
                      {order.customerEmail && (
                        <div className="text-sm text-gray-500">
                          {order.customerEmail}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {order.amount || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          order.status === 'completed' || order.status === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : order.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : order.status === 'cancelled'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {order.status || 'unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {order.itemsCount ? `${order.itemsCount} items` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-700">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No orders yet</h3>
          <p className="text-gray-600">
            Use the sync button above to sync orders from Fluid
          </p>
        </div>
      )}
    </div>
  )
}