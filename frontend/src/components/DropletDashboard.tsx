import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiClient } from '../lib/api'

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
}

export function DropletDashboard() {
  const [searchParams] = useSearchParams()
  const installationId = searchParams.get('installation_id') || searchParams.get('dri')
  const fluidApiKey = searchParams.get('fluid_api_key')
  
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [brandGuidelines, setBrandGuidelines] = useState<BrandGuidelines | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Helper function to format colors
  const formatColor = (color: string | null | undefined) => {
    if (!color) return undefined
    return color.startsWith('#') ? color : `#${color}`
  }

  // Function to fetch brand guidelines from Fluid API
  const fetchBrandGuidelines = async (installationId: string, fluidApiKey: string) => {
    try {
      console.log('🎨 Fetching brand guidelines for installation:', installationId)
      const response = await apiClient.get(`/api/droplet/brand-guidelines/${installationId}?fluid_api_key=${fluidApiKey}`)
      const brandData = response.data.data
      console.log('✅ Brand guidelines loaded:', brandData)
      setBrandGuidelines(brandData)
      return brandData
    } catch (err: any) {
      console.log('⚠️ Failed to fetch brand guidelines:', err.response?.status, err.response?.data)
      // Don't fail the whole dashboard if brand guidelines fail
      return null
    }
  }


  useEffect(() => {
    const loadDashboardData = async () => {
      console.log('🔍 DropletDashboard: Starting loadDashboardData')
      console.log('🔍 Installation ID:', installationId)
      console.log('🔍 Fluid API Key:', fluidApiKey)
      console.log('🔍 API Base URL:', import.meta.env.VITE_API_BASE_URL)
      console.log('🔍 Current URL:', window.location.href)
      console.log('🔍 Search params:', window.location.search)
      console.log('🔍 All URL params:', Object.fromEntries(searchParams.entries()))
      
      // Check if we're missing both parameters - this indicates we're not in a proper Fluid embed
      if (!installationId && !fluidApiKey) {
        console.log('⚠️ No Fluid parameters found - this appears to be a direct access')
        setError('This droplet must be accessed through the Fluid platform. Please install it from the Fluid marketplace.')
        setIsLoading(false)
        return
      }

      if (!installationId) {
        console.log('❌ Missing installation ID')
        setError('Missing installation ID. Please try reinstalling the droplet from the Fluid marketplace.')
        setIsLoading(false)
        return
      }

      // If we don't have fluid_api_key, try the installation endpoint first
      if (!fluidApiKey) {
        console.log('⚠️ Missing Fluid API key, trying dashboard endpoint without API key')
        try {
          const apiUrl = `/api/droplet/dashboard/${installationId}`
          console.log('🚀 Making API request to dashboard endpoint:', apiUrl)
          
          const response = await apiClient.get(apiUrl)
          console.log('✅ Dashboard API Response received:', response.data)
          setDashboardData(response.data.data)
          setIsLoading(false)
          return
        } catch (err: any) {
          console.log('❌ Dashboard endpoint failed:', err.response?.status, err.response?.data)
          // Continue to show error about missing API key
        }
      }

      if (!fluidApiKey) {
        console.log('❌ Missing Fluid API key')
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

        console.log('✅ Dashboard API Response received:', dashboardResponse.data)
        const dashboardData = dashboardResponse.data.data
        
        // If we have brand guidelines, merge them into dashboard data
        if (brandData) {
          dashboardData.brandGuidelines = brandData
        }
        
        setDashboardData(dashboardData)
      } catch (err: any) {
        console.error('❌ Failed to load dashboard data:', err)
        console.error('❌ Error details:', {
          message: err.message,
          status: err.response?.status,
          statusText: err.response?.statusText,
          data: err.response?.data,
          config: err.config
        })
        
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
    // Use brand colors if available, otherwise use default blue
    const defaultColor = '#2563eb'
    const primaryColor = brandGuidelines?.color ? formatColor(brandGuidelines.color) : defaultColor
    const lightColor = brandGuidelines?.color ? `${formatColor(brandGuidelines.color)}20` : `${defaultColor}20`
    
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4"
        style={{
          background: brandGuidelines?.color 
            ? `linear-gradient(135deg, ${lightColor}, ${formatColor(brandGuidelines.color)}10)`
            : 'linear-gradient(135deg, #f8fafc, #e0e7ff, #c7d2fe)'
        }}
      >
        <div className="text-center">
          <div 
            className="w-16 h-16 border-4 rounded-full animate-spin mx-auto mb-6"
            style={{
              borderColor: `${primaryColor}20`,
              borderTopColor: primaryColor
            }}
          ></div>
          <h3 className="text-2xl font-semibold text-gray-800 mb-2">
            Loading {brandGuidelines?.name || 'Dashboard'}...
          </h3>
          <p className="text-gray-600 mt-2">Please wait while we set up your droplet</p>
        </div>
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
    <div className="min-h-screen bg-gray-50">
      {/* Modern Header with Company Branding */}
      <div 
        className="relative overflow-hidden"
        style={{
          background: dashboardData?.brandGuidelines?.color 
            ? `linear-gradient(135deg, ${formatColor(dashboardData.brandGuidelines.color)}, ${formatColor(dashboardData.brandGuidelines.secondary_color || dashboardData.brandGuidelines.color)}dd)`
            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        }}
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 25% 25%, white 2px, transparent 0),
                             radial-gradient(circle at 75% 75%, white 2px, transparent 0)`,
            backgroundSize: '50px 50px'
          }}></div>
        </div>
        
        <div className="relative px-6 py-16">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-8">
              {/* Company Logo */}
              {(dashboardData?.brandGuidelines?.logo_url || dashboardData?.logoUrl) && (
                <div className="w-24 h-24 rounded-2xl p-4 shadow-2xl bg-white/95 flex items-center justify-center backdrop-blur-sm">
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
              <div className="flex-1">
                <h1 className="text-5xl font-bold text-white mb-3">
                  Welcome to your Fluid droplet
                </h1>
                <p className="text-2xl text-white/90 font-medium">
                  {dashboardData?.brandGuidelines?.name || dashboardData?.companyName}
                </p>
                <div className="flex items-center gap-4 mt-4">
                  <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-white font-medium">Active</span>
                  </div>
                  <div className="text-white/80 text-sm">
                    Installation ID: <span className="font-mono">{dashboardData?.installationId}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Dashboard Content */}
      <div className="px-6 py-12">
        <div className="max-w-7xl mx-auto">
          {/* Success Card */}
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden mb-8">
            <div className="p-8">
              <div className="flex items-center justify-center mb-6">
                <div 
                  className="w-20 h-20 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: dashboardData?.brandGuidelines?.color 
                      ? `${formatColor(dashboardData.brandGuidelines.color)}20` 
                      : '#10b98120'
                  }}
                >
                  <svg 
                    className="w-10 h-10" 
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
              </div>
              
              <div className="text-center">
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                  Installation Successful!
                </h2>
                <p className="text-xl text-gray-600 mb-8">
                  Your Fluid droplet is now active and ready to use.
                </p>
              </div>

              {/* Company Details Accordion */}
              <div className="max-w-4xl mx-auto">
                <div className="space-y-4">
                  {/* Basic Info */}
                  <div className="bg-gray-50 rounded-2xl p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">Company</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {dashboardData?.brandGuidelines?.name || dashboardData?.companyName}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">Installation ID</p>
                        <p className="text-lg font-mono text-gray-900">{dashboardData?.installationId}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">Status</p>
                        <span 
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
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
                    </div>
                  </div>

                  {/* API Token - Collapsible */}
                  {dashboardData?.authenticationToken && (
                    <div className="bg-gray-50 rounded-2xl overflow-hidden">
                      <details className="group">
                        <summary className="flex items-center justify-between p-6 cursor-pointer hover:bg-gray-100 transition-colors">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-8 h-8 rounded-lg flex items-center justify-center"
                              style={{
                                backgroundColor: dashboardData?.brandGuidelines?.color 
                                  ? `${formatColor(dashboardData.brandGuidelines.color)}20`
                                  : '#3b82f620'
                              }}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{
                                color: dashboardData?.brandGuidelines?.color 
                                  ? formatColor(dashboardData.brandGuidelines.color)
                                  : '#3b82f6'
                              }}>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                              </svg>
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900">Company API Token</h3>
                              <p className="text-sm text-gray-500">Authentication token for company API access</p>
                            </div>
                          </div>
                          <svg className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </summary>
                        
                        <div className="px-6 pb-6">
                          <div className="bg-white rounded-xl p-4 border border-gray-200">
                            <p className="text-sm font-medium text-gray-700 mb-2">Authentication Token:</p>
                            <div className="bg-gray-900 rounded-lg p-4">
                              <code className="text-green-400 font-mono text-sm break-all block">
                                {dashboardData.authenticationToken}
                              </code>
                            </div>
                            <p className="text-xs text-gray-500 mt-3">
                              Use this token to authenticate API calls on behalf of the company (create orders, sync data, etc.)
                            </p>
                          </div>
                        </div>
                      </details>
                    </div>
                  )}

                  {/* Brand Guidelines - Collapsible */}
                  {dashboardData?.brandGuidelines && (
                    <div className="bg-gray-50 rounded-2xl overflow-hidden">
                      <details className="group">
                        <summary className="flex items-center justify-between p-6 cursor-pointer hover:bg-gray-100 transition-colors">
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
                              <h3 className="font-semibold text-gray-900">Brand Guidelines</h3>
                              <p className="text-sm text-gray-500">Company colors, logo, and branding</p>
                            </div>
                          </div>
                          <svg className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </summary>
                        
                        <div className="px-6 pb-6">
                          <div className="bg-white rounded-xl p-6 border border-gray-200">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Colors */}
                              <div>
                                <h4 className="font-medium text-gray-900 mb-3">Brand Colors</h4>
                                <div className="space-y-3">
                                  <div className="flex items-center gap-3">
                                    <div 
                                      className="w-8 h-8 rounded-lg border border-gray-200"
                                      style={{ backgroundColor: `#${dashboardData.brandGuidelines.color}` }}
                                    ></div>
                                    <div>
                                      <p className="font-medium text-gray-900">Primary</p>
                                      <p className="text-sm text-gray-500 font-mono">#{dashboardData.brandGuidelines.color}</p>
                                    </div>
                                  </div>
                                  {dashboardData.brandGuidelines.secondary_color && (
                                    <div className="flex items-center gap-3">
                                      <div 
                                        className="w-8 h-8 rounded-lg border border-gray-200"
                                        style={{ backgroundColor: `#${dashboardData.brandGuidelines.secondary_color}` }}
                                      ></div>
                                      <div>
                                        <p className="font-medium text-gray-900">Secondary</p>
                                        <p className="text-sm text-gray-500 font-mono">#{dashboardData.brandGuidelines.secondary_color}</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              {/* Logo */}
                              {dashboardData.brandGuidelines.logo_url && (
                                <div>
                                  <h4 className="font-medium text-gray-900 mb-3">Company Logo</h4>
                                  <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-center">
                                    <img 
                                      src={dashboardData.brandGuidelines.logo_url} 
                                      alt="Company logo"
                                      className="max-h-16 object-contain"
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
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
