import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Important for cookie-based auth
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Add any request modifications here (e.g., auth tokens)
    return config
  },
  (error: AxiosError) => {
    return Promise.reject(error)
  }
)

// Response interceptor
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response
  },
  (error: AxiosError) => {
    // Handle common error scenarios
    // Note: Don't redirect on 401 here - let the auth context and ProtectedRoute handle it
    // to avoid infinite loops
    
    if (error.response?.status === 403) {
      // Forbidden - show error message
      console.error('Access forbidden')
    }
    
    return Promise.reject(error)
  }
)

export default apiClient
