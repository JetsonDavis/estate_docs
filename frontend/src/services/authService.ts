import apiClient from './api'
import {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  ChangePasswordRequest,
  MessageResponse,
  User,
} from '../types/auth'

export const authService = {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>('/auth/login', credentials)
    return response.data
  },

  async register(data: RegisterRequest): Promise<User> {
    const response = await apiClient.post<User>('/auth/register', data)
    return response.data
  },

  async logout(): Promise<MessageResponse> {
    const response = await apiClient.post<MessageResponse>('/auth/logout')
    return response.data
  },

  async getCurrentUser(): Promise<User> {
    const response = await apiClient.get<User>('/auth/me')
    return response.data
  },

  async forgotPassword(data: ForgotPasswordRequest): Promise<MessageResponse> {
    const response = await apiClient.post<MessageResponse>('/auth/forgot-password', data)
    return response.data
  },

  async resetPassword(data: ResetPasswordRequest): Promise<MessageResponse> {
    const response = await apiClient.post<MessageResponse>('/auth/reset-password', data)
    return response.data
  },

  async changePassword(data: ChangePasswordRequest): Promise<MessageResponse> {
    const response = await apiClient.post<MessageResponse>('/auth/change-password', data)
    return response.data
  },
}
