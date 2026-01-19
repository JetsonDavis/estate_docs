import apiClient from './api'
import {
  GeneratedDocument,
  GenerateDocumentRequest,
  DocumentPreview,
  GeneratedDocumentListResponse
} from '../types/document'

export const documentService = {
  /**
   * Generate a document by merging session answers into a template
   */
  generateDocument: async (data: GenerateDocumentRequest): Promise<GeneratedDocument> => {
    const response = await apiClient.post<GeneratedDocument>('/documents/generate', data)
    return response.data
  },

  /**
   * Preview a document merge without saving
   */
  previewDocument: async (sessionId: number, templateId: number): Promise<DocumentPreview> => {
    const response = await apiClient.post<DocumentPreview>(
      '/documents/preview',
      null,
      {
        params: {
          session_id: sessionId,
          template_id: templateId
        }
      }
    )
    return response.data
  },

  /**
   * Get all generated documents for the current user
   */
  getDocuments: async (page: number = 1, pageSize: number = 100): Promise<GeneratedDocumentListResponse> => {
    const skip = (page - 1) * pageSize
    const response = await apiClient.get<GeneratedDocumentListResponse>('/documents/', {
      params: { skip, limit: pageSize }
    })
    return response.data
  },

  /**
   * Get a specific generated document
   */
  getDocument: async (documentId: number): Promise<GeneratedDocument> => {
    const response = await apiClient.get<GeneratedDocument>(`/documents/${documentId}`)
    return response.data
  },

  /**
   * Delete a generated document
   */
  deleteDocument: async (documentId: number): Promise<void> => {
    await apiClient.delete(`/documents/${documentId}`)
  }
}
