import { useState, useEffect, createContext, useContext, ReactNode, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import apiClient from '../services/api'

interface User {
  id: number
  username: string
  email: string
  full_name: string | null
  role: 'admin' | 'user'
  is_email_verified: boolean
  last_login: string | null
  created_at: string
  updated_at: string
  is_active: boolean
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  isAuthenticated: boolean
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const location = useLocation()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const hasCheckedAuth = useRef(false)
  const authCheckInFlight = useRef(false)
  const isE2EMode =
    import.meta.env.VITE_E2E === '1' ||
    (typeof navigator !== 'undefined' && navigator.webdriver)

  const isPublicAuthRoute =
    location.pathname === '/login' ||
    location.pathname === '/register' ||
    location.pathname === '/forgot-password' ||
    location.pathname === '/reset-password'

  const refreshToken = async () => {
    try {
      await apiClient.post('/auth/refresh')
      return true
    } catch (error) {
      console.error('Token refresh failed:', error)
      return false
    }
  }

  const checkAuth = async () => {
    // Public auth pages don't need session probing.
    if (isPublicAuthRoute) {
      setUser(null)
      if (!hasCheckedAuth.current) {
        setLoading(false)
        hasCheckedAuth.current = true
      }
      return
    }

    if (authCheckInFlight.current) {
      return
    }

    authCheckInFlight.current = true

    // Set loading to true only for the initial check
    const isInitialCheck = !hasCheckedAuth.current
    if (isInitialCheck) {
      setLoading(true)
    }

    try {
      const response = await apiClient.get('/auth/me')
      setUser(response.data)
    } catch (error: any) {
      // If we get a 401, try to refresh the token
      if (error.response?.status === 401) {
        const refreshed = await refreshToken()
        if (refreshed) {
          // Retry getting user info after refresh
          try {
            const retryResponse = await apiClient.get('/auth/me')
            setUser(retryResponse.data)
          } catch (retryError) {
            // Refresh worked but still can't get user - log out
            setUser(null)
          }
        } else {
          // Refresh failed - log out
          setUser(null)
        }
      } else {
        setUser(null)
      }
    } finally {
      authCheckInFlight.current = false
      if (isInitialCheck) {
        setLoading(false)
        hasCheckedAuth.current = true
      }
    }
  }

  useEffect(() => {
    // Initial auth check on mount and when route changes
    if (isE2EMode && hasCheckedAuth.current) {
      return
    }

    checkAuth()
  }, [location.pathname, isE2EMode])

  useEffect(() => {
    // Set up polling intervals only after initial auth check and only for authenticated users
    // This effect runs separately to avoid race conditions with the async checkAuth

    // In E2E we intentionally avoid repeated probes to keep logs clean.
    if (isE2EMode) {
      return
    }

    // Don't set up intervals on public auth routes
    if (isPublicAuthRoute) {
      return
    }

    // Don't set up intervals until the initial auth check is complete
    if (!hasCheckedAuth.current) {
      return
    }

    // Only set up intervals if user is authenticated
    if (!user) {
      return
    }

    // Check auth every 30 seconds
    const authCheckInterval = setInterval(() => {
      checkAuth()
    }, 30000)

    // Proactively refresh token every 45 minutes (before 1 hour expiry)
    const tokenRefreshInterval = setInterval(() => {
      refreshToken()
    }, 45 * 60 * 1000) // 45 minutes

    // Cleanup intervals on unmount or when user logs out
    return () => {
      clearInterval(authCheckInterval)
      clearInterval(tokenRefreshInterval)
    }
  }, [user, isPublicAuthRoute, isE2EMode])

  const login = async (username: string, password: string) => {
    const response = await apiClient.post('/auth/login', { username, password })
    setUser(response.data.user)
  }

  const logout = async () => {
    await apiClient.post('/auth/logout')
    setUser(null)
  }

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    checkAuth,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
