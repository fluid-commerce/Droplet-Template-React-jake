import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add request interceptor for logging
apiClient.interceptors.request.use(
  (config) => {
    console.log('🌐 API Request:', config.method?.toUpperCase(), config.url)
    console.log('🌐 Full URL:', (config.baseURL || '') + (config.url || ''))
    console.log('🌐 Headers:', config.headers)
    return config
  },
  (error) => {
    console.error('🌐 API Request Error:', error)
    return Promise.reject(error)
  }
)

// Add response interceptor for logging
apiClient.interceptors.response.use(
  (response) => {
    console.log('✅ API Response:', response.status, response.config.url)
    console.log('✅ Response data:', response.data)
    return response
  },
  (error) => {
    console.error('❌ API Response Error:', error.response?.status, error.config?.url, error.response?.data)
    console.error('❌ Full error object:', error)
    return Promise.reject(error)
  }
)
