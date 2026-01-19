import apiClient from './api'
import { User, UserCreate, UserUpdate, UserListResponse } from '../types/user'

export const userService = {
  async listUsers(page: number = 1, pageSize: number = 20, includeInactive: boolean = false): Promise<UserListResponse> {
    const response = await apiClient.get<UserListResponse>('/users', {
      params: {
        page,
        page_size: pageSize,
        include_inactive: includeInactive,
      },
    })
    return response.data
  },

  async getUser(userId: number): Promise<User> {
    const response = await apiClient.get<User>(`/users/${userId}`)
    return response.data
  },

  async createUser(data: UserCreate): Promise<User> {
    const response = await apiClient.post<User>('/users', data)
    return response.data
  },

  async updateUser(userId: number, data: UserUpdate): Promise<User> {
    const response = await apiClient.put<User>(`/users/${userId}`, data)
    return response.data
  },

  async deleteUser(userId: number): Promise<void> {
    await apiClient.delete(`/users/${userId}`)
  },
}
