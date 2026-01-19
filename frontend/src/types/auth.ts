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

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  user: User
  message: string
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
  full_name?: string
}

export interface ForgotPasswordRequest {
  email: string
}

export interface ResetPasswordRequest {
  token: string
  new_password: string
}

export interface ChangePasswordRequest {
  current_password: string
  new_password: string
}

export interface MessageResponse {
  message: string
}
