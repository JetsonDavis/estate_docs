import apiClient from './api'
import {
  QuestionnaireSession,
  QuestionnaireSessionWithAnswers,
  SessionCreate,
  SubmitAnswersRequest,
  SessionProgress,
  SessionQuestionsResponse,
  SaveAnswersRequest,
  NavigateRequest
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
   * Get questions to display for a session with pagination
   */
  getSessionQuestions: async (
    sessionId: number,
    page: number = 1,
    questionsPerPage: number = 5
  ): Promise<SessionQuestionsResponse> => {
    const response = await apiClient.get<SessionQuestionsResponse>(
      `/sessions/${sessionId}/questions`,
      { params: { page, questions_per_page: questionsPerPage } }
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
  navigate: async (sessionId: number, data: NavigateRequest): Promise<QuestionnaireSession> => {
    const response = await apiClient.post<QuestionnaireSession>(
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
