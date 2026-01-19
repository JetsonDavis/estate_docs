import apiClient from './api'
import {
  QuestionnaireFlow,
  QuestionnaireFlowWithGroups,
  QuestionnaireFlowCreate,
  QuestionnaireFlowUpdate,
  QuestionnaireFlowListResponse
} from '../types/flow'

export const flowService = {
  /**
   * Create a new questionnaire flow
   */
  createFlow: async (data: QuestionnaireFlowCreate): Promise<QuestionnaireFlow> => {
    const response = await apiClient.post<QuestionnaireFlow>('/flows/', data)
    return response.data
  },

  /**
   * Get all questionnaire flows
   */
  getFlows: async (page: number = 1, pageSize: number = 100, search?: string): Promise<QuestionnaireFlowListResponse> => {
    const skip = (page - 1) * pageSize
    const response = await apiClient.get<QuestionnaireFlowListResponse>('/flows/', {
      params: { skip, limit: pageSize, search }
    })
    return response.data
  },

  /**
   * Get a specific flow with question groups
   */
  getFlow: async (flowId: number): Promise<QuestionnaireFlowWithGroups> => {
    const response = await apiClient.get<QuestionnaireFlowWithGroups>(`/flows/${flowId}`)
    return response.data
  },

  /**
   * Update a questionnaire flow
   */
  updateFlow: async (flowId: number, data: QuestionnaireFlowUpdate): Promise<QuestionnaireFlow> => {
    const response = await apiClient.put<QuestionnaireFlow>(`/flows/${flowId}`, data)
    return response.data
  },

  /**
   * Delete a questionnaire flow
   */
  deleteFlow: async (flowId: number): Promise<void> => {
    await apiClient.delete(`/flows/${flowId}`)
  }
}
