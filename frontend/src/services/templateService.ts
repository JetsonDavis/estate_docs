import apiClient from './api'
import {
  Template,
  TemplateCreate,
  TemplateUpdate,
  TemplateListResponse,
  TemplateIdentifiersResponse,
  FileUploadResponse
} from '../types/template'

export const templateService = {
  /**
   * Upload a file and convert to markdown
   */
  uploadFile: async (file: File): Promise<FileUploadResponse> => {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await apiClient.post<FileUploadResponse>(
      '/templates/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    )
    return response.data
  },

  /**
   * Create a new template
   */
  createTemplate: async (data: TemplateCreate): Promise<Template> => {
    const response = await apiClient.post<Template>('/templates/', data)
    return response.data
  },

  /**
   * Get all templates with pagination and search
   */
  getTemplates: async (
    page: number = 1,
    pageSize: number = 100,
    search?: string
  ): Promise<TemplateListResponse> => {
    const skip = (page - 1) * pageSize
    const params: Record<string, any> = {
      skip,
      limit: pageSize
    }
    
    if (search) {
      params.search = search
    }
    
    const response = await apiClient.get<TemplateListResponse>('/templates/', { params })
    return response.data
  },

  /**
   * Get a single template by ID
   */
  getTemplate: async (id: number): Promise<Template> => {
    const response = await apiClient.get<Template>(`/templates/${id}`)
    return response.data
  },

  /**
   * Update a template
   */
  updateTemplate: async (id: number, data: TemplateUpdate): Promise<Template> => {
    const response = await apiClient.put<Template>(`/templates/${id}`, data)
    return response.data
  },

  /**
   * Delete a template
   */
  deleteTemplate: async (id: number): Promise<void> => {
    await apiClient.delete(`/templates/${id}`)
  },

  /**
   * Get all identifiers from a template
   */
  getTemplateIdentifiers: async (id: number): Promise<TemplateIdentifiersResponse> => {
    const response = await apiClient.get<TemplateIdentifiersResponse>(
      `/templates/${id}/identifiers`
    )
    return response.data
  }
}
