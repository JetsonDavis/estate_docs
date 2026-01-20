import apiClient from './api'
import {
  DocumentFlow,
  DocumentFlowWithGroups,
  DocumentFlowCreate,
  DocumentFlowUpdate,
  DocumentFlowListResponse
} from '../types/flow'

export const flowService = {
  /**
   * Create a new questionnaire flow
   */
  createFlow: async (data: DocumentFlowCreate): Promise<DocumentFlow> => {
    const response = await apiClient.post<DocumentFlow>('/flows/', data)
    return response.data
  },

  /**
   * Get all questionnaire flows
   */
  getFlows: async (page: number = 1, pageSize: number = 100, search?: string): Promise<DocumentFlowListResponse> => {
    const skip = (page - 1) * pageSize
    const response = await apiClient.get<DocumentFlowListResponse>('/flows/', {
      params: { skip, limit: pageSize, search }
    })
    return response.data
  },

  /**
   * Get a specific flow with question groups
   */
  getFlow: async (flowId: number): Promise<DocumentFlowWithGroups> => {
    const response = await apiClient.get<DocumentFlowWithGroups>(`/flows/${flowId}`)
    return response.data
  },

  /**
   * Update a questionnaire flow
   */
  updateFlow: async (flowId: number, data: DocumentFlowUpdate): Promise<DocumentFlow> => {
    const response = await apiClient.put<DocumentFlow>(`/flows/${flowId}`, data)
    return response.data
  },

  /**
   * Delete a questionnaire flow
   */
  deleteFlow: async (flowId: number): Promise<void> => {
    await apiClient.delete(`/flows/${flowId}`)
  }
}
