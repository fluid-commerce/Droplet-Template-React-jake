import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiClient } from '../lib/api'
import { ProductsSection } from './ProductsSection'

interface BrandGuidelines {
  name: string
  logo_url?: string
  color?: string
  secondary_color?: string
}

interface DashboardData {
  companyName: string
  logoUrl?: string
  installationId: string
  authenticationToken?: string // cdrtkn_ token for company API access
  brandGuidelines?: BrandGuidelines
  fluidShop?: string // Company's Fluid shop domain (e.g., "pokey.fluid.app")
}

export function DropletDashboard() {
  const [searchParams] = useSearchParams()
  const installationId = searchParams.get('installation_id') || searchParams.get('dri')
  const fluidApiKey = searchParams.get('fluid_api_key')
  
  
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [brandGuidelines, setBrandGuidelines] = useState<BrandGuidelines | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showToken, setShowToken] = useState(false)

  // Helper function to format colors
  const formatColor = (color: string | null | undefined) => {
    if (!color) return undefined
    return color.startsWith('#') ? color : `#${color}`
  }

  // Function to fetch brand guidelines from Fluid API
  const fetchBrandGuidelines = async (installationId: string, fluidApiKey: string) => {
    try {
      const response = await apiClient.get(`/api/droplet/brand-guidelines/${installationId}?fluid_api_key=${fluidApiKey}`)
      const brandData = response.data.data
      setBrandGuidelines(brandData)
      return brandData
    } catch (err: any) {
      // Don't fail the whole dashboard if brand guidelines fail
      return null
    }
  }


  useEffect(() => {
    const loadDashboardData = async () => {
      
      // Check if we're missing both parameters - this indicates we're not in a proper Fluid embed
      if (!installationId && !fluidApiKey) {
        setError('This droplet must be accessed through the Fluid platform. Please install it from the Fluid marketplace.')
        setIsLoading(false)
        return
      }
      
      if (!installationId) {
        setError('Missing installation ID. Please try reinstalling the droplet from the Fluid marketplace.')
        setIsLoading(false)
        return
      }

      // If we don't have fluid_api_key, try the installation endpoint first
      if (!fluidApiKey) {
        try {
          const apiUrl = `/api/droplet/dashboard/${installationId}`
          const response = await apiClient.get(apiUrl)
          const dashboardData = response.data.data
          setDashboardData(dashboardData)
          
          // Try to fetch brand guidelines using the authentication token from the response
          if (dashboardData.authenticationToken) {
            try {
              const brandData = await fetchBrandGuidelines(installationId, dashboardData.authenticationToken)
              if (brandData) {
                dashboardData.brandGuidelines = brandData
                setDashboardData({...dashboardData})
              }
            } catch (err) {
              // Silently fail - brand guidelines are optional
            }
          }
          
          setIsLoading(false)
          return
        } catch (err: any) {
          // Continue to show error about missing API key
        }
      }

      if (!fluidApiKey) {
        setError('Missing Fluid API key. Please try reinstalling the droplet from the Fluid marketplace.')
        setIsLoading(false)
        return
      }

      try {
        // Fetch dashboard data and brand guidelines in parallel
        const [dashboardResponse, brandData] = await Promise.all([
          apiClient.get(`/api/droplet/dashboard/${installationId}?fluid_api_key=${fluidApiKey}`),
          fetchBrandGuidelines(installationId, fluidApiKey)
        ])

        const dashboardData = dashboardResponse.data.data
        
        // If we have brand guidelines, merge them into dashboard data
        if (brandData) {
          dashboardData.brandGuidelines = brandData
        }
        
        setDashboardData(dashboardData)
      } catch (err: any) {
        // If installation not found (404) or forbidden (403), it was likely uninstalled
        if (err.response?.status === 404 || err.response?.status === 403) {
          // Clear localStorage and redirect to fresh installation
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('droplet_session_') || key.includes(installationId!)) {
              localStorage.removeItem(key)
            }
          })
          
          // Redirect to installation flow
          window.location.href = '/'
          return
        }
        
        setError(err.response?.data?.message || 'Failed to load dashboard data')
      } finally {
        setIsLoading(false)
      }
    }

    loadDashboardData()
  }, [installationId, fluidApiKey])

  if (isLoading) {
    // Use brand colors if available, otherwise use black
    const defaultColor = '#000000'
    const primaryColor = brandGuidelines?.color ? formatColor(brandGuidelines.color) : defaultColor

    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <div
          className="w-16 h-16 border-4 rounded-full animate-spin"
          style={{
            borderColor: `${primaryColor}20`,
            borderTopColor: primaryColor
          }}
        ></div>
      </div>
    )
  }

  if (error) {
    const isAccessError = error.includes('This droplet must be accessed through the Fluid platform') || 
                         error.includes('Missing installation ID') || 
                         error.includes('Missing Fluid API key')
    
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-50 border border-red-100 rounded-xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Connection Error</h2>
          <p className="text-gray-600 mb-6 text-base">{error}</p>
          
          {isAccessError && (
            <div className="bg-blue-50 rounded-lg p-6 mb-6 text-left">
              <h3 className="text-base font-medium text-blue-900 mb-3">How to fix this:</h3>
              <ul className="text-sm text-blue-800 space-y-2">
                <li>• Make sure you're accessing this through the Fluid platform</li>
                <li>• If you just installed, try clicking the droplet again from your Fluid dashboard</li>
                <li>• If the problem persists, try uninstalling and reinstalling the droplet</li>
              </ul>
            </div>
          )}
          
          <button 
            onClick={() => window.location.reload()} 
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors text-base font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Single Card with Everything */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Header with Company Branding */}
          <div 
            className="p-6 sm:p-8"
            style={{
              background: dashboardData?.brandGuidelines?.color 
                ? `linear-gradient(135deg, ${formatColor(dashboardData.brandGuidelines.color)}, ${formatColor(dashboardData.brandGuidelines.secondary_color || dashboardData.brandGuidelines.color)}dd)`
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            }}
          >
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
              {/* Company Logo */}
              {(dashboardData?.brandGuidelines?.logo_url || dashboardData?.logoUrl) && (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl p-3 sm:p-4 shadow-2xl bg-white/95 flex items-center justify-center flex-shrink-0">
                  <img 
                    src={dashboardData.brandGuidelines?.logo_url || dashboardData.logoUrl} 
                    alt={`${dashboardData.brandGuidelines?.name || dashboardData.companyName} logo`}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>
            )}
              
              {/* Company Info */}
              <div className="text-center sm:text-left flex-1">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">
                  {dashboardData?.brandGuidelines?.name || dashboardData?.companyName}
              </h1>
          </div>
        </div>
      </div>

          {/* Main Content */}
          <div className="p-6 sm:p-8">
            {/* Success Message */}
            <div className="text-center mb-6">
              <div 
                className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: dashboardData?.brandGuidelines?.color 
                    ? `${formatColor(dashboardData.brandGuidelines.color)}20` 
                    : '#10b98120'
                }}
              >
                <svg 
                  className="w-8 h-8" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                  style={{
                    color: dashboardData?.brandGuidelines?.color 
                      ? formatColor(dashboardData.brandGuidelines.color)
                      : '#10b981'
                  }}
                >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
              Installation Successful!
            </h2>
              <p className="text-gray-600 text-sm sm:text-base">
              Your Fluid droplet is now active and ready to use.
            </p>
            </div>

            {/* Build Your Own Droplet - Collapsible */}
            <div className="bg-gray-50 rounded-2xl overflow-hidden mb-6">
              <details className="group">
                <summary className="flex items-center justify-between p-4 sm:p-6 cursor-pointer hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{
                        backgroundColor: dashboardData?.brandGuidelines?.color 
                          ? `${formatColor(dashboardData.brandGuidelines.color)}20`
                          : '#10b98120'
                      }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{
                        color: dashboardData?.brandGuidelines?.color 
                          ? formatColor(dashboardData.brandGuidelines.color)
                          : '#10b981'
                      }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Build Your Own Droplet</h3>
                      <p className="text-xs sm:text-sm text-gray-500">Create powerful integrations for the Fluid platform</p>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                
                <div className="px-4 sm:px-6 pb-4 sm:pb-6">
                  <div className="bg-white rounded-xl p-4 sm:p-6 border border-gray-200 space-y-4">
                    <div>
                      <p className="text-sm text-gray-700 leading-relaxed mb-4">
                        Create powerful integrations that connect any service to the Fluid platform. 
                        Build custom droplets that all Fluid users can install and use.
                      </p>
                      
                      <div className="grid md:grid-cols-2 gap-4 mb-4">
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <h4 className="font-semibold text-gray-900 mb-2 flex items-center text-sm">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{
                              color: dashboardData?.brandGuidelines?.color 
                                ? formatColor(dashboardData.brandGuidelines.color)
                                : '#6b7280'
                            }}>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Connect Anything
                          </h4>
                          <p className="text-xs text-gray-600 leading-relaxed">
                            Connect Shopify, Stripe, email marketing tools, CRMs, or any API. 
                            Your droplet can sync data, send notifications, or automate workflows.
                          </p>
                        </div>
                        
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <h4 className="font-semibold text-gray-900 mb-2 flex items-center text-sm">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{
                              color: dashboardData?.brandGuidelines?.color 
                                ? formatColor(dashboardData.brandGuidelines.color)
                                : '#6b7280'
                            }}>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                            </svg>
                            Multi-Tenant Security
                          </h4>
                          <p className="text-xs text-gray-600 leading-relaxed">
                            Each company's data is completely isolated and encrypted. 
                            Your droplet automatically handles security, authentication, and data protection.
                          </p>
                        </div>
                      </div>
                      
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <h4 className="font-semibold text-gray-900 mb-2 flex items-center text-sm">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{
                            color: dashboardData?.brandGuidelines?.color 
                              ? formatColor(dashboardData.brandGuidelines.color)
                              : '#2563eb'
                          }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                          </svg>
                          Ready-to-Use Template
                        </h4>
                        <p className="text-xs text-gray-700 mb-3 leading-relaxed">
                          Get started with our complete template that includes React frontend, Node.js backend, 
                          PostgreSQL database, webhook handling, and deployment scripts.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <a
                            href="https://github.com/fluid-commerce/Droplet-Template-React-"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors hover:opacity-90"
                            style={{
                              backgroundColor: dashboardData?.brandGuidelines?.color 
                                ? formatColor(dashboardData.brandGuidelines.color)
                                : '#16a34a'
                            }}
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Clone & Start Building
                          </a>
                          <a
                            href="https://docs.fluid.app/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg transition-colors hover:bg-gray-50"
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            View Fluid API Docs
                          </a>
                        </div>
                      </div>
                      
                      <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <p className="font-medium text-gray-700 mb-2">What you get:</p>
                        <ul className="space-y-1 text-gray-600">
                          <li>• Complete React + Node.js + PostgreSQL setup</li>
                          <li>• Automatic deployment to Render.com</li>
                          <li>• Built-in webhook handling and security</li>
                          <li>• Multi-tenant data isolation</li>
                          <li>• Ready for Fluid platform integration</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </details>
            </div>

            {/* Installation Details - Collapsible */}
            <div className="bg-gray-50 rounded-2xl overflow-hidden mb-6">
              <details className="group">
                <summary className="flex items-center justify-between p-4 sm:p-6 cursor-pointer hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{
                        backgroundColor: dashboardData?.brandGuidelines?.color 
                          ? `${formatColor(dashboardData.brandGuidelines.color)}20`
                          : '#6b728020'
                      }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{
                        color: dashboardData?.brandGuidelines?.color 
                          ? formatColor(dashboardData.brandGuidelines.color)
                          : '#6b7280'
                      }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Installation Details</h3>
                      <p className="text-xs sm:text-sm text-gray-500">ID and status information</p>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                
                <div className="px-4 sm:px-6 pb-4 sm:pb-6">
                  <div className="bg-white rounded-xl p-4 sm:p-6 border border-gray-200 space-y-4">
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-gray-500 mb-1">Installation ID</p>
                      <p className="text-sm sm:text-base font-mono text-gray-900 break-all bg-gray-50 p-2 rounded">
                        {dashboardData?.installationId}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-gray-500 mb-1">Status</p>
                      <span 
                        className="inline-flex items-center px-3 py-1 rounded-full text-xs sm:text-sm font-medium"
                        style={{
                          backgroundColor: dashboardData?.brandGuidelines?.color 
                            ? `${formatColor(dashboardData.brandGuidelines.color)}20`
                            : '#dcfce720',
                          color: dashboardData?.brandGuidelines?.color 
                            ? formatColor(dashboardData.brandGuidelines.color)
                            : '#16a34a'
                        }}
                      >
                        <div className="w-2 h-2 rounded-full mr-2" style={{
                          backgroundColor: dashboardData?.brandGuidelines?.color 
                            ? formatColor(dashboardData.brandGuidelines.color)
                            : '#16a34a'
                        }}></div>
                        Active
                      </span>
                    </div>
                    
                    {/* API Token inside Installation Details */}
                    {dashboardData?.authenticationToken && (
                      <div className="pt-4 border-t border-gray-200">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-xs sm:text-sm font-medium text-gray-700">Company API Token</p>
                            <p className="text-xs text-gray-500">Authentication token for company API access</p>
                          </div>
                          <button
                            onClick={() => setShowToken(!showToken)}
                            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                            title={showToken ? "Hide token" : "Show token"}
                          >
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              {showToken ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                              ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              )}
                            </svg>
                          </button>
                        </div>
                        
                        <div className="bg-gray-900 rounded-lg p-3">
                          <code className="text-green-400 font-mono text-xs sm:text-sm break-all block">
                            {showToken ? dashboardData.authenticationToken : '••••••••••••••••••••••••••••••••••••••••'}
                          </code>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Use this token to authenticate API calls on behalf of the company (create orders, sync data, etc.)
                        </p>
                      </div>
                    )}

                    {/* Company Fluid Shop */}
                    {dashboardData?.fluidShop && (
                      <div className="pt-4 border-t border-gray-200">
                        <div className="mb-3">
                          <p className="text-xs sm:text-sm font-medium text-gray-700">Fluid Shop Domain</p>
                          <p className="text-xs text-gray-500">Company's Fluid store URL</p>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-sm font-mono text-blue-800">{dashboardData.fluidShop}</p>
                          <p className="text-xs text-blue-600 mt-1">
                            Subdomain: <span className="font-mono">{dashboardData.fluidShop.replace('.fluid.app', '')}</span>
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </details>
            </div>


            {/* Brand Guidelines - Collapsible */}
            {dashboardData?.brandGuidelines && (
              <div className="bg-gray-50 rounded-2xl overflow-hidden mb-6">
                <details className="group">
                  <summary className="flex items-center justify-between p-4 sm:p-6 cursor-pointer hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{
                          backgroundColor: dashboardData?.brandGuidelines?.color 
                            ? `${formatColor(dashboardData.brandGuidelines.color)}20`
                            : '#8b5cf620'
                        }}
                      >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{
                        color: dashboardData?.brandGuidelines?.color 
                          ? formatColor(dashboardData.brandGuidelines.color)
                          : '#8b5cf6'
                      }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z" />
                      </svg>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Brand Guidelines</h3>
                        <p className="text-xs sm:text-sm text-gray-500">Company colors, logo, and branding</p>
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  
                  <div className="px-4 sm:px-6 pb-4 sm:pb-6">
                    <div className="bg-white rounded-xl p-4 sm:p-6 border border-gray-200">
                      <div className="space-y-6">
                        {/* Colors */}
                        <div>
                          <h4 className="font-medium text-gray-900 mb-3 text-sm sm:text-base">Brand Colors</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-8 h-8 rounded-lg border border-gray-200 flex-shrink-0"
                                style={{ backgroundColor: `#${dashboardData.brandGuidelines.color}` }}
                              ></div>
                              <div>
                                <p className="font-medium text-gray-900 text-sm">Primary</p>
                                <p className="text-xs text-gray-500 font-mono">#{dashboardData.brandGuidelines.color}</p>
                              </div>
                            </div>
                            {dashboardData.brandGuidelines.secondary_color && (
                              <div className="flex items-center gap-3">
                                <div 
                                  className="w-8 h-8 rounded-lg border border-gray-200 flex-shrink-0"
                                  style={{ backgroundColor: `#${dashboardData.brandGuidelines.secondary_color}` }}
                                ></div>
                                <div>
                                  <p className="font-medium text-gray-900 text-sm">Secondary</p>
                                  <p className="text-xs text-gray-500 font-mono">#{dashboardData.brandGuidelines.secondary_color}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Logo */}
                        {dashboardData.brandGuidelines.logo_url && (
                          <div>
                            <h4 className="font-medium text-gray-900 mb-3 text-sm sm:text-base">Company Logo</h4>
                            <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-center">
                              <img 
                                src={dashboardData.brandGuidelines.logo_url} 
                                alt="Company logo"
                                className="max-h-12 sm:max-h-16 object-contain"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none'
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </details>
              </div>
            )}

            {/* Webhooks and API Integration - Collapsible */}
            <div className="bg-gray-50 rounded-2xl overflow-hidden mb-6">
              <details className="group">
                <summary className="flex items-center justify-between p-4 sm:p-6 cursor-pointer hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{
                        backgroundColor: dashboardData?.brandGuidelines?.color 
                          ? `${formatColor(dashboardData.brandGuidelines.color)}20`
                          : '#10b98120'
                      }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{
                        color: dashboardData?.brandGuidelines?.color 
                          ? formatColor(dashboardData.brandGuidelines.color)
                          : '#10b981'
                      }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Webhooks and API Integration</h3>
                      <p className="text-xs sm:text-sm text-gray-500">Examples of syncing data between Fluid and your droplet</p>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                
                <div className="px-4 sm:px-6 pb-4 sm:pb-6">
                  <div className="bg-white rounded-xl p-4 sm:p-6 border border-gray-200 space-y-4">
                    <div>
                      <p className="text-sm text-gray-700 leading-relaxed mb-4">
                        This section demonstrates how to sync data between Fluid and your droplet. 
                        You can pull products from Fluid's API and store them in your database.
                      </p>
                      
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <h4 className="font-semibold text-gray-900 mb-2 flex items-center text-sm">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{
                            color: dashboardData?.brandGuidelines?.color 
                              ? formatColor(dashboardData.brandGuidelines.color)
                              : '#2563eb'
                          }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Products Sync Example
                        </h4>
                        <p className="text-xs text-gray-700 mb-3 leading-relaxed">
                          Click the "Sync from Fluid" button below to fetch products from Fluid's API 
                          and store them in your droplet's database. This demonstrates the complete 
                          integration workflow.
                        </p>
                        <div className="text-xs text-gray-600 bg-white rounded p-3 border border-gray-200">
                          <p className="font-medium text-gray-700 mb-1">How it works:</p>
                          <ul className="space-y-1 text-gray-600">
                            <li>• Uses your company's authentication token (cdrtkn_)</li>
                            <li>• Calls Fluid's /api/company/v1/products endpoint</li>
                            <li>• Stores products in your PostgreSQL database</li>
                            <li>• Displays them in a beautiful table below</li>
                          </ul>
                        </div>
                      </div>
                      
                      {/* Products Section */}
                      <ProductsSection 
                        installationId={dashboardData?.installationId || ''} 
                        brandGuidelines={dashboardData?.brandGuidelines}
                      />
                    </div>
                  </div>
                </div>
              </details>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
