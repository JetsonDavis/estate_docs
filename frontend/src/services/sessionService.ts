import apiClient from './api'
import {
  InputForm,
  InputFormWithAnswers,
  SessionCreate,
  SubmitAnswersRequest,
  SessionProgress,
  SessionQuestionsResponse,
  SaveAnswersRequest,
  NavigateRequest
} from '../types/session'

export const sessionService = {
  /**
   * Create a new document session
   */
  createSession: async (data: SessionCreate): Promise<InputForm> => {
    const response = await apiClient.post<InputForm>('/sessions/', data)
    return response.data
  },

  /**
   * Get all sessions for the current user
   */
  getSessions: async (): Promise<InputForm[]> => {
    const response = await apiClient.get<InputForm[]>('/sessions/')
    return response.data
  },

  /**
   * Get a specific session with all answers
   */
  getSession: async (sessionId: number): Promise<InputFormWithAnswers> => {
    const response = await apiClient.get<InputFormWithAnswers>(`/sessions/${sessionId}`)
    return response.data
  },

  /**
   * Get current progress of a session
   */
  getSessionProgress: async (sessionId: number): Promise<SessionProgress> => {
    const response = await apiClient.get<SessionProgress>(`/sessions/${sessionId}/progress`)
    return response.data
  },

  /**
   * Get questions to display for a session
   */
  getSessionQuestions: async (
    sessionId: number
  ): Promise<SessionQuestionsResponse> => {
    const response = await apiClient.get<SessionQuestionsResponse>(
      `/sessions/${sessionId}/questions`
    )
    return response.data
  },

  /**
   * Save answers without navigating
   */
  saveAnswers: async (sessionId: number, answers: SaveAnswersRequest): Promise<void> => {
    await apiClient.post(`/sessions/${sessionId}/save-answers`, answers)
  },

  /**
   * Navigate to next or previous group
   */
  navigate: async (sessionId: number, data: NavigateRequest): Promise<InputForm> => {
    const response = await apiClient.post<InputForm>(
      `/sessions/${sessionId}/navigate`,
      data
    )
    return response.data
  },

  /**
   * Submit answers and navigate to next group
   */
  submitAnswers: async (
    sessionId: number,
    answers: SubmitAnswersRequest
  ): Promise<InputForm> => {
    const response = await apiClient.post<InputForm>(
      `/sessions/${sessionId}/submit`,
      answers
    )
    return response.data
  },

  /**
   * Delete answers for specific question IDs in a session.
   * Used when a conditional choice changes to clear stale followup answers.
   */
  deleteAnswers: async (sessionId: number, questionIds: number[]): Promise<void> => {
    await apiClient.post(`/sessions/${sessionId}/delete-answers`, { question_ids: questionIds })
  },

  /**
   * Delete a session
   */
  deleteSession: async (sessionId: number): Promise<void> => {
    await apiClient.delete(`/sessions/${sessionId}`)
  },

  /**
   * Get identifiers and their values from a session
   */
  getSessionIdentifiers: async (sessionId: number): Promise<Record<string, string>> => {
    const response = await apiClient.get<Record<string, string>>(`/sessions/${sessionId}/identifiers`)
    return response.data
  },

  /**
   * Copy a session with all its answers
   */
  copySession: async (sessionId: number): Promise<InputForm> => {
    const response = await apiClient.post<InputForm>(`/sessions/${sessionId}/copy`)
    return response.data
  },

  /**
   * Mark a session as completed
   */
  markSessionComplete: async (sessionId: number): Promise<InputForm> => {
    const response = await apiClient.patch<InputForm>(`/sessions/${sessionId}/complete`)
    return response.data
  }
}
