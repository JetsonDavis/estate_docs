import apiClient from './api'
import {
  QuestionnaireSession,
  QuestionnaireSessionWithAnswers,
  SessionCreate,
  SubmitAnswersRequest,
  SessionProgress
} from '../types/session'

export const sessionService = {
  /**
   * Create a new questionnaire session
   */
  createSession: async (data: SessionCreate): Promise<QuestionnaireSession> => {
    const response = await apiClient.post<QuestionnaireSession>('/sessions/', data)
    return response.data
  },

  /**
   * Get all sessions for the current user
   */
  getSessions: async (): Promise<QuestionnaireSession[]> => {
    const response = await apiClient.get<QuestionnaireSession[]>('/sessions/')
    return response.data
  },

  /**
   * Get a specific session with all answers
   */
  getSession: async (sessionId: number): Promise<QuestionnaireSessionWithAnswers> => {
    const response = await apiClient.get<QuestionnaireSessionWithAnswers>(`/sessions/${sessionId}`)
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
   * Submit answers and navigate to next group
   */
  submitAnswers: async (
    sessionId: number,
    answers: SubmitAnswersRequest
  ): Promise<QuestionnaireSession> => {
    const response = await apiClient.post<QuestionnaireSession>(
      `/sessions/${sessionId}/submit`,
      answers
    )
    return response.data
  },

  /**
   * Delete a session
   */
  deleteSession: async (sessionId: number): Promise<void> => {
    await apiClient.delete(`/sessions/${sessionId}`)
  }
}
