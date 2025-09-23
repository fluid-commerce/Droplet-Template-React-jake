import { useState, useEffect } from 'react'
import { apiClient } from '../lib/api'

interface Product {
  id: string
  fluidProductId: string
  title: string
  sku?: string
  description?: string
  imageUrl?: string
  status?: string
  price?: string
  inStock: boolean
  public: boolean
  createdAt: string
  updatedAt: string
}

interface ProductsResponse {
  success: boolean
  data: {
    products: Product[]
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

interface OrdersSyncResponse {
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

interface ProductsSectionProps {
  installationId: string
  brandGuidelines?: {
    color?: string
    secondary_color?: string
  }
}

export function ProductsSection({ installationId, brandGuidelines }: ProductsSectionProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isSyncingOrders, setIsSyncingOrders] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [ordersSyncMessage, setOrdersSyncMessage] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'products' | 'orders'>('products')
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [isTabLoading, setIsTabLoading] = useState(false)
  const [orderItemImages, setOrderItemImages] = useState<Record<string, string | null>>({})
  const [showCreateOrderModal, setShowCreateOrderModal] = useState(false)
  const [isCreatingOrder, setIsCreatingOrder] = useState(false)
  const [createOrderMessage, setCreateOrderMessage] = useState<string | null>(null)
  const itemsPerPage = 10

  // Helper function to format colors
  const formatColor = (color: string | null | undefined) => {
    if (!color) return undefined
    return color.startsWith('#') ? color : `#${color}`
  }

  // Search and filtering helpers
  const getFilteredOrders = () => {
    if (!searchQuery.trim()) return orders
    
    const query = searchQuery.toLowerCase()
    return orders.filter(order => {
      // Search in order number, customer name, customer email, status, and amount
      return (
        (order.orderNumber && order.orderNumber.toLowerCase().includes(query)) ||
        (order.fluidOrderId && order.fluidOrderId.toLowerCase().includes(query)) ||
        (order.customerName && order.customerName.toLowerCase().includes(query)) ||
        (order.customerEmail && order.customerEmail.toLowerCase().includes(query)) ||
        (order.status && order.status.toLowerCase().includes(query)) ||
        (order.amount && order.amount.toLowerCase().includes(query))
      )
    })
  }

  // Pagination helpers
  const getCurrentProducts = () => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return products.slice(startIndex, endIndex)
  }

  const getCurrentOrders = () => {
    const filteredOrders = getFilteredOrders()
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredOrders.slice(startIndex, endIndex)
  }

  const getTotalPages = () => {
    if (activeTab === 'products') {
      return Math.ceil(products.length / itemsPerPage)
    } else {
      const filteredOrders = getFilteredOrders()
      return Math.ceil(filteredOrders.length / itemsPerPage)
    }
  }

  // Helper function to render order items
  const renderOrderItems = (order: Order) => {
    if (!order.orderData) {
      return <span className="text-gray-400">No items data</span>
    }

    // Try to extract items from different possible structures
    const items = order.orderData.items || 
                  order.orderData.line_items || 
                  order.orderData.order_items || 
                  []

    if (!Array.isArray(items) || items.length === 0) {
      return <span className="text-gray-400">No items found</span>
    }


    // Fetch images for order items if not already fetched
    const itemsNeedingImages = items.filter(item => {
      const productId = item.product_id || item.id || item.sku
      return productId && !Object.prototype.hasOwnProperty.call(orderItemImages, productId)
    })
    
    if (itemsNeedingImages.length > 0) {
      fetchOrderItemImages(itemsNeedingImages)
    }

    // Show first 3 items, with a count if there are more
    const displayItems = items.slice(0, 3)
    const hasMore = items.length > 3

    return (
      <div className="space-y-2">
        {displayItems.map((item: any, index: number) => (
          <div key={index} className="flex items-center space-x-2">
            {(() => {
              // Try to get image from various sources
              const productId = item.product_id || item.id || item.sku
              const fetchedImageUrl = productId ? orderItemImages[productId] : null
              const imageUrl = item.image_url || item.imageUrl || item.image || item.product_image || item.product_image_url || fetchedImageUrl
              
              if (imageUrl) {
                return (
                  <img
                    src={imageUrl}
                    alt={item.name || item.title || item.product_name || 'Item'}
                    className="w-8 h-8 rounded object-cover flex-shrink-0"
                    onLoad={() => {}}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                )
              } else {
                return (
                  <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )
              }
            })()}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">
                {item.name || item.title || item.product_name || 'Unknown Item'}
              </div>
              <div className="text-xs text-gray-500">
                Qty: {item.quantity || item.qty || 1}
                {item.price && ` • $${item.price}`}
              </div>
            </div>
          </div>
        ))}
        {hasMore && (
          <div className="text-xs text-gray-500 pl-10">
            +{items.length - 3} more items
          </div>
        )}
      </div>
    )
  }

  const goToNextPage = () => {
    if (currentPage < getTotalPages()) {
      setCurrentPage(currentPage + 1)
    }
  }

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  const goToPage = (page: number) => {
    if (page >= 1 && page <= getTotalPages()) {
      setCurrentPage(page)
    }
  }

  const handleTabChange = (tab: 'products' | 'orders') => {
    if (tab !== activeTab) {
      setIsTabLoading(true)
      setActiveTab(tab)
      setCurrentPage(1) // Reset to first page when switching tabs

      // Show loading for a brief moment to prevent flash, then hide
      setTimeout(() => {
        setIsTabLoading(false)
      }, 300) // Reduced from 3000ms to 300ms
    }
  }

  const getPageNumbers = () => {
    const totalPages = getTotalPages()
    const current = currentPage
    const pages: (number | string)[] = []
    
    if (totalPages <= 7) {
      // Show all pages if 7 or fewer
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Always show first page
      pages.push(1)
      
      if (current <= 4) {
        // Show first 5 pages, then ellipsis, then last page
        for (let i = 2; i <= 5; i++) {
          pages.push(i)
        }
        pages.push('...')
        pages.push(totalPages)
      } else if (current >= totalPages - 3) {
        // Show first page, ellipsis, then last 5 pages
        pages.push('...')
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i)
        }
      } else {
        // Show first page, ellipsis, current-1, current, current+1, ellipsis, last page
        pages.push('...')
        pages.push(current - 1)
        pages.push(current)
        pages.push(current + 1)
        pages.push('...')
        pages.push(totalPages)
      }
    }
    
    return pages
  }

  // Fetch products from our database
  const fetchProducts = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await apiClient.get(`/api/products/${installationId}`)
      const data = response.data as ProductsResponse
      
      if (data.success) {
        setProducts(data.data.products)
        setCompanyName(data.data.installation.companyName)
      } else {
        setError('Failed to fetch products')
      }
    } catch (err: any) {
      console.error('Error fetching products:', err)
      setError(err.response?.data?.message || 'Failed to fetch products')
    } finally {
      setIsLoading(false)
    }
  }

  // Sync products from Fluid API
  const syncProducts = async () => {
    try {
      setIsSyncing(true)
      setError(null)
      setSyncMessage(null)

      const response = await apiClient.post(`/api/products/${installationId}/sync`)
      const data = response.data as SyncResponse

      if (data.success) {
        setSyncMessage(data.data.message)
        // Refresh products after sync
        await fetchProducts()
      } else {
        setError('Failed to sync products')
      }
    } catch (err: any) {
      console.error('Error syncing products:', err)
      setError(err.response?.data?.message || 'Failed to sync products from Fluid')
    } finally {
      setIsSyncing(false)
    }
  }

  // Fetch orders from our database
  const fetchOrders = async () => {
    try {
      setError(null)
      
      const response = await apiClient.get(`/api/orders/${installationId}`)
      const data = response.data as OrdersResponse
      
      if (data.success) {
        setOrders(data.data.orders)
        setCompanyName(data.data.installation.companyName)
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

  // Sync orders from Fluid API
  const syncOrders = async () => {
    try {
      setIsSyncingOrders(true)
      setError(null)
      setOrdersSyncMessage(null)

      const response = await apiClient.post(`/api/orders/${installationId}/sync`)
      const data = response.data as OrdersSyncResponse

      if (data.success) {
        setOrdersSyncMessage(data.data.message)
        // Refresh orders after sync
        await fetchOrders()
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

  // Create order in Fluid
  const createOrder = async (orderData: any) => {
    try {
      setIsCreatingOrder(true)
      setError(null)
      setCreateOrderMessage(null)

      const response = await apiClient.post(`/api/orders/${installationId}/create`, orderData)
      const data = response.data

      if (data.success) {
        setCreateOrderMessage(`Order ${data.data.orderNumber} created successfully!`)
        setShowCreateOrderModal(false)
        // Refresh orders after creation
        await fetchOrders()
      } else {
        setError('Failed to create order')
      }
    } catch (err: any) {
      console.error('Error creating order:', err)
      setError(err.response?.data?.message || 'Failed to create order in Fluid')
    } finally {
      setIsCreatingOrder(false)
    }
  }

  // Fetch product images for order items (optimized batch processing)
  const fetchOrderItemImages = async (orderItems: any[]) => {
    // Limit to first 10 items to prevent resource exhaustion
    const limitedItems = orderItems.slice(0, 10)

    // Get unique product IDs that haven't been cached yet
    const uniqueProductIds = Array.from(new Set(
      limitedItems
        .map(item => item.product_id || item.id || item.sku)
        .filter(id => id && !Object.prototype.hasOwnProperty.call(orderItemImages, id))
    ))

    if (uniqueProductIds.length === 0) return

    const imageMap: Record<string, string | null> = {}

    // Process in parallel batches of 3 to balance speed vs server load
    const BATCH_SIZE = 3
    for (let i = 0; i < uniqueProductIds.length; i += BATCH_SIZE) {
      const batch = uniqueProductIds.slice(i, i + BATCH_SIZE)

      // Process batch in parallel
      const batchPromises = batch.map(async (productId) => {
        try {
          const response = await apiClient.get(`/api/products/${installationId}/image/${productId}`)
          if (response.data && response.data.success) {
            imageMap[productId] = response.data.imageUrl || null
          } else {
            imageMap[productId] = null
          }
        } catch (error) {
          imageMap[productId] = null
        }
      })

      // Wait for current batch to complete before starting next batch
      await Promise.all(batchPromises)

      // Small delay between batches to be server-friendly
      if (i + BATCH_SIZE < uniqueProductIds.length) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    }

    setOrderItemImages(prev => ({ ...prev, ...imageMap }))
  }


  useEffect(() => {
    setCurrentPage(1) // Reset to first page when switching tabs
  }, [activeTab])

  useEffect(() => {
    setCurrentPage(1) // Reset to first page when search query changes
  }, [searchQuery])

  useEffect(() => {
    // Only fetch data when installationId changes and we don't already have data
    if (installationId && (products.length === 0 || orders.length === 0)) {
      fetchProducts()
      fetchOrders()
    }
  }, [installationId])

  // Auto-dismiss sync messages after 3 seconds
  useEffect(() => {
    if (syncMessage) {
      const timer = setTimeout(() => {
        setSyncMessage(null)
      }, 3000)
      
      return () => clearTimeout(timer)
    }
  }, [syncMessage])

  useEffect(() => {
    if (ordersSyncMessage) {
      const timer = setTimeout(() => {
        setOrdersSyncMessage(null)
      }, 3000)

      return () => clearTimeout(timer)
    }
  }, [ordersSyncMessage])

  useEffect(() => {
    if (createOrderMessage) {
      const timer = setTimeout(() => {
        setCreateOrderMessage(null)
      }, 3000)

      return () => clearTimeout(timer)
    }
  }, [createOrderMessage])

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex items-center justify-center py-8">
          <div 
            className="w-8 h-8 border-4 rounded-full animate-spin"
            style={{
              borderColor: brandGuidelines?.color 
                ? `${formatColor(brandGuidelines.color)}20` 
                : '#e5e7eb20',
              borderTopColor: brandGuidelines?.color 
                ? formatColor(brandGuidelines.color) 
                : '#6b7280'
            }}
          ></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Products and Orders from {companyName}
          </h3>
          <p className="text-sm text-gray-600">
            {activeTab === 'products' 
              ? `${products.length} products synced from Fluid`
              : `${orders.length} orders synced from Fluid`
            }
          </p>
        </div>

        {/* Tabs - Full width on mobile, auto width on desktop */}
        <div className="w-full sm:w-auto">
          <div className="flex bg-gray-100 rounded-lg p-1 w-full sm:w-auto">
                <button
                  onClick={() => handleTabChange('products')}
                  disabled={isTabLoading}
                  className={`flex-1 sm:flex-none px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'products'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  } ${isTabLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  Products
                </button>
                <button
                  onClick={() => handleTabChange('orders')}
                  disabled={isTabLoading}
                  className={`flex-1 sm:flex-none px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'orders'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  } ${isTabLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  Orders
                </button>
          </div>
        </div>
      </div>

      {/* Tab Loading Spinner */}
      {isTabLoading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
        </div>
      )}

      {/* Search bar for orders */}
      {!isTabLoading && activeTab === 'orders' && (
        <div className="mb-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search orders by number, customer, email, status, or amount..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {searchQuery && (
            <div className="mt-2 text-sm text-gray-600">
              Found {getFilteredOrders().length} order{getFilteredOrders().length !== 1 ? 's' : ''} matching "{searchQuery}"
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-2">
        {activeTab === 'products' ? (
          <button
            onClick={syncProducts}
            disabled={isSyncing || isSyncingOrders}
            className="inline-flex items-center px-3 py-1.5 text-white text-xs font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: brandGuidelines?.color
                ? formatColor(brandGuidelines.color)
                : '#3b82f6'
            }}
          >
            {isSyncing ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5"></div>
                Syncing...
              </>
            ) : (
              <>
                <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync Products
              </>
            )}
          </button>
        ) : (
          <>
            <button
              onClick={syncOrders}
              disabled={isSyncing || isSyncingOrders}
              className="inline-flex items-center px-3 py-1.5 text-white text-xs font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: brandGuidelines?.color
                  ? formatColor(brandGuidelines.color)
                  : '#3b82f6'
              }}
            >
              {isSyncingOrders ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5"></div>
                  Syncing...
                </>
              ) : (
                <>
                  <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Sync Orders
                </>
              )}
            </button>
            <button
              onClick={() => setShowCreateOrderModal(true)}
              disabled={isSyncing || isSyncingOrders || isCreatingOrder}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-gray-700 text-xs font-medium rounded-md transition-colors hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create Order
            </button>
          </>
        )}

      </div>

      {/* Sync message */}
      {syncMessage && (
        <div
          className="p-4 rounded-lg border"
          style={{
            backgroundColor: brandGuidelines?.color
              ? `${formatColor(brandGuidelines.color)}10`
              : '#f0f9ff',
            borderColor: brandGuidelines?.color
              ? `${formatColor(brandGuidelines.color)}30`
              : '#bae6fd'
          }}
        >
          <div className="flex items-center">
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              style={{
                color: brandGuidelines?.color
                  ? formatColor(brandGuidelines.color)
                  : '#0ea5e9'
              }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-medium text-gray-900">{syncMessage}</span>
          </div>
        </div>
      )}

      {/* Orders sync message */}
      {ordersSyncMessage && (
        <div
          className="p-4 rounded-lg border"
          style={{
            backgroundColor: brandGuidelines?.color
              ? `${formatColor(brandGuidelines.color)}10`
              : '#f0f9ff',
            borderColor: brandGuidelines?.color
              ? `${formatColor(brandGuidelines.color)}30`
              : '#bae6fd'
          }}
        >
          <div className="flex items-center">
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              style={{
                color: brandGuidelines?.color
                  ? formatColor(brandGuidelines.color)
                  : '#0ea5e9'
              }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-medium text-gray-900">{ordersSyncMessage}</span>
          </div>
        </div>
      )}

      {/* Create order message */}
      {createOrderMessage && (
        <div
          className="p-4 rounded-lg border"
          style={{
            backgroundColor: brandGuidelines?.color
              ? `${formatColor(brandGuidelines.color)}10`
              : '#f0f9ff',
            borderColor: brandGuidelines?.color
              ? `${formatColor(brandGuidelines.color)}30`
              : '#bae6fd'
          }}
        >
          <div className="flex items-center">
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              style={{
                color: brandGuidelines?.color
                  ? formatColor(brandGuidelines.color)
                  : '#0ea5e9'
              }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-medium text-gray-900">{createOrderMessage}</span>
          </div>
        </div>
      )}


      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium text-red-800">{error}</span>
          </div>
        </div>
      )}

      {/* Content based on active tab */}
      {!isTabLoading && activeTab === 'products' ? (
        /* Products list */
        products.length > 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      SKU
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stock
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {getCurrentProducts().map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 mr-3">
                            {product.imageUrl ? (
                              <img
                                className="h-10 w-10 rounded-lg object-cover"
                                src={product.imageUrl}
                                alt={product.title}
                                onLoad={() => {}}
                                onError={(e) => {
                                  // Show placeholder if image fails to load
                                  e.currentTarget.style.display = 'none'
                                  const nextElement = e.currentTarget.nextElementSibling as HTMLElement
                                  if (nextElement) {
                                    nextElement.style.display = 'flex'
                                  }
                                }}
                              />
                            ) : null}
                            <div 
                              className="h-10 w-10 rounded-lg bg-gray-200 flex items-center justify-center"
                              style={{ display: product.imageUrl ? 'none' : 'flex' }}
                            >
                              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {product.title}
                            </div>
                            {product.description && (
                              <div className="text-sm text-gray-500 truncate">
                                {product.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.sku || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.price || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span 
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: product.status === 'active' 
                              ? (brandGuidelines?.color 
                                  ? `${formatColor(brandGuidelines.color)}20` 
                                  : '#dcfce720')
                              : '#f3f4f6',
                            color: product.status === 'active'
                              ? (brandGuidelines?.color 
                                  ? formatColor(brandGuidelines.color) 
                                  : '#16a34a')
                              : '#6b7280'
                          }}
                        >
                          {product.status || 'unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span 
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: product.inStock 
                              ? (brandGuidelines?.color 
                                  ? `${formatColor(brandGuidelines.color)}20` 
                                  : '#dcfce720')
                              : '#fee2e220',
                            color: product.inStock
                              ? (brandGuidelines?.color 
                                  ? formatColor(brandGuidelines.color) 
                                  : '#16a34a')
                              : '#dc2626'
                          }}
                        >
                          {product.inStock ? 'In Stock' : 'Out of Stock'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {getTotalPages() > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={goToPreviousPage}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={goToNextPage}
                    disabled={currentPage === getTotalPages()}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing{' '}
                      <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span>
                      {' '}to{' '}
                      <span className="font-medium">
                        {Math.min(currentPage * itemsPerPage, products.length)}
                      </span>
                      {' '}of{' '}
                      <span className="font-medium">{products.length}</span>
                      {' '}results
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                      <button
                        onClick={goToPreviousPage}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Previous</span>
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                      {getPageNumbers().map((page, index) => (
                        page === '...' ? (
                          <span
                            key={`ellipsis-${index}`}
                            className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700"
                          >
                            ...
                          </span>
                        ) : (
                          <button
                            key={page}
                            onClick={() => goToPage(page as number)}
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                              currentPage === page
                                ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {page}
                          </button>
                        )
                      ))}
                      
                      <button
                        onClick={goToNextPage}
                        disabled={currentPage === getTotalPages()}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Next</span>
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No products yet</h3>
            <p className="text-gray-600">
              Use the sync button above to sync products from Fluid
            </p>
          </div>
        )
      ) : !isTabLoading && activeTab === 'orders' ? (
        /* Orders list */
        orders.length > 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
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
                      Order Items
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
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
                          ID: {order.fluidOrderId}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {order.customerName || '-'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {order.customerEmail || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {order.amount || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span 
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: order.status === 'completed' || order.status === 'fulfilled'
                              ? (brandGuidelines?.color 
                                  ? `${formatColor(brandGuidelines.color)}20` 
                                  : '#dcfce720')
                              : order.status === 'pending' || order.status === 'processing'
                              ? '#fef3c720'
                              : '#f3f4f6',
                            color: order.status === 'completed' || order.status === 'fulfilled'
                              ? (brandGuidelines?.color 
                                  ? formatColor(brandGuidelines.color) 
                                  : '#16a34a')
                              : order.status === 'pending' || order.status === 'processing'
                              ? '#d97706'
                              : '#6b7280'
                          }}
                        >
                          {order.status || 'unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                        {renderOrderItems(order)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {getTotalPages() > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={goToPreviousPage}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={goToNextPage}
                    disabled={currentPage === getTotalPages()}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing{' '}
                      <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span>
                      {' '}to{' '}
                      <span className="font-medium">
                        {Math.min(currentPage * itemsPerPage, orders.length)}
                      </span>
                      {' '}of{' '}
                      <span className="font-medium">{orders.length}</span>
                      {' '}results
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                      <button
                        onClick={goToPreviousPage}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Previous</span>
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                      {getPageNumbers().map((page, index) => (
                        page === '...' ? (
                          <span
                            key={`ellipsis-${index}`}
                            className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700"
                          >
                            ...
                          </span>
                        ) : (
                          <button
                            key={page}
                            onClick={() => goToPage(page as number)}
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                              currentPage === page
                                ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {page}
                          </button>
                        )
                      ))}
                      
                      <button
                        onClick={goToNextPage}
                        disabled={currentPage === getTotalPages()}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Next</span>
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </nav>
                  </div>
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
        )
      ) : null}

      {/* Create Order Modal */}
      {showCreateOrderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Create New Order</h2>
                <button
                  onClick={() => setShowCreateOrderModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <CreateOrderForm
                onSubmit={createOrder}
                onCancel={() => setShowCreateOrderModal(false)}
                isLoading={isCreatingOrder}
                brandGuidelines={brandGuidelines}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Create Order Form Component
interface CreateOrderFormProps {
  onSubmit: (orderData: any) => void
  onCancel: () => void
  isLoading: boolean
  brandGuidelines?: {
    color?: string
    secondary_color?: string
  }
}

function CreateOrderForm({ onSubmit, onCancel, isLoading, brandGuidelines }: CreateOrderFormProps) {
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    postalCode: '',
    countryCode: 'US',
    items: [{ variantId: '', quantity: 1 }]
  })

  const formatColor = (color: string | null | undefined) => {
    if (!color) return undefined
    return color.startsWith('#') ? color : `#${color}`
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { variantId: '', quantity: 1 }]
    }))
  }

  const removeItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
  }

  const updateItem = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Customer Information */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Customer Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div></div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
            <input
              type="text"
              required
              value={formData.firstName}
              onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
            <input
              type="text"
              required
              value={formData.lastName}
              onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Shipping Address */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Shipping Address</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1 *</label>
            <input
              type="text"
              required
              value={formData.address1}
              onChange={(e) => setFormData(prev => ({ ...prev, address1: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
            <input
              type="text"
              value={formData.address2}
              onChange={(e) => setFormData(prev => ({ ...prev, address2: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
              <input
                type="text"
                required
                value={formData.city}
                onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
              <input
                type="text"
                required
                value={formData.state}
                onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code *</label>
              <input
                type="text"
                required
                value={formData.postalCode}
                onChange={(e) => setFormData(prev => ({ ...prev, postalCode: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Order Items */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Order Items</h3>
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-500"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Item
          </button>
        </div>
        <div className="space-y-3">
          {formData.items.map((item, index) => (
            <div key={index} className="flex items-center gap-3 p-3 border border-gray-200 rounded-md">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Variant ID *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., 61868"
                  value={item.variantId}
                  onChange={(e) => updateItem(index, 'variantId', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="w-24">
                <label className="block text-sm font-medium text-gray-700 mb-1">Qty *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={item.quantity}
                  onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              {formData.items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="text-red-600 hover:text-red-500"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: brandGuidelines?.color
              ? formatColor(brandGuidelines.color)
              : '#3b82f6'
          }}
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
              Creating...
            </>
          ) : (
            'Create Order'
          )}
        </button>
      </div>
    </form>
  )
}
