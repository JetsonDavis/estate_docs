export interface User {
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

export interface UserCreate {
  username: string
  email: string
  password: string
  full_name?: string
  role?: 'admin' | 'user'
}

export interface UserUpdate {
  email?: string
  full_name?: string
  role?: 'admin' | 'user'
  is_active?: boolean
}

export interface UserListResponse {
  users: User[]
  total: number
  page: number
  page_size: number
}
