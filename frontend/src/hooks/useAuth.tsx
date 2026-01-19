import { useState, useEffect, createContext, useContext, ReactNode, useRef } from 'react'
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
  isAuthenticated: boolean
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const hasCheckedAuth = useRef(false)

  useEffect(() => {
    // Check if user is already authenticated on mount (only once)
    if (hasCheckedAuth.current) return
    
    hasCheckedAuth.current = true
    
    const checkAuth = async () => {
      try {
        const response = await apiClient.get('/auth/me')
        setUser(response.data)
      } catch (error) {
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

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
