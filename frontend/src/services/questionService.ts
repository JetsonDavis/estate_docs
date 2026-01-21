import apiClient from './api'
import {
  QuestionGroup,
  QuestionGroupCreate,
  QuestionGroupUpdate,
  QuestionGroupDetail,
  QuestionGroupListResponse,
  Question,
  QuestionCreate,
  QuestionUpdate,
} from '../types/question'

export const questionGroupService = {
  async listQuestionGroups(
    page: number = 1,
    pageSize: number = 20,
    includeInactive: boolean = false
  ): Promise<QuestionGroupListResponse> {
    const response = await apiClient.get<QuestionGroupListResponse>('/question-groups', {
      params: {
        page,
        page_size: pageSize,
        include_inactive: includeInactive,
      },
    })
    return response.data
  },

  async getQuestionGroup(groupId: number): Promise<QuestionGroupDetail> {
    const response = await apiClient.get<QuestionGroupDetail>(`/question-groups/${groupId}`)
    return response.data
  },

  async createQuestionGroup(data: QuestionGroupCreate): Promise<QuestionGroup> {
    const response = await apiClient.post<QuestionGroup>('/question-groups', data)
    return response.data
  },

  async updateQuestionGroup(groupId: number, data: QuestionGroupUpdate): Promise<QuestionGroup> {
    const response = await apiClient.put<QuestionGroup>(`/question-groups/${groupId}`, data)
    return response.data
  },

  async deleteQuestionGroup(groupId: number): Promise<void> {
    await apiClient.delete(`/question-groups/${groupId}`)
  },

  async createQuestion(groupId: number, data: QuestionCreate): Promise<Question> {
    const response = await apiClient.post<Question>(
      `/question-groups/${groupId}/questions`,
      data
    )
    return response.data
  },

  async listQuestions(groupId: number, includeInactive: boolean = false): Promise<Question[]> {
    const response = await apiClient.get<Question[]>(`/question-groups/${groupId}/questions`, {
      params: {
        include_inactive: includeInactive,
      },
    })
    return response.data
  },

  async updateQuestion(questionId: number, data: QuestionUpdate): Promise<Question> {
    const response = await apiClient.put<Question>(
      `/question-groups/questions/${questionId}`,
      data
    )
    return response.data
  },

  async deleteQuestion(questionId: number): Promise<void> {
    await apiClient.delete(`/question-groups/questions/${questionId}`)
  },

  async checkQuestionIdentifier(
    identifier: string,
    excludeId?: number
  ): Promise<{ exists: boolean; question_id: number | null }> {
    const response = await apiClient.get<{ exists: boolean; question_id: number | null }>(
      '/question-groups/questions/check-identifier',
      {
        params: {
          identifier,
          exclude_id: excludeId,
        },
      }
    )
    return response.data
  },
}
