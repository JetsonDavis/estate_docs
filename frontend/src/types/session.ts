export interface SessionAnswer {
  id: number
  session_id: number
  question_id: number
  answer_value: string
  created_at: string
  updated_at: string
}

export interface QuestionnaireSession {
  id: number
  client_identifier: string
  user_id: number
  current_group_id: number | null
  is_completed: boolean
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface QuestionnaireSessionWithAnswers extends QuestionnaireSession {
  answers: SessionAnswer[]
}

export interface SessionCreate {
  client_identifier: string
  starting_group_id?: number
}

export interface SubmitAnswersRequest {
  answers: Array<{
    question_id: number
    answer_value: string
  }>
}

export interface SessionProgress {
  session: QuestionnaireSession
  current_group: {
    id: number
    name: string
    description: string | null
    questions: Array<{
      id: number
      identifier: string
      question_text: string
      question_type: string
      options: any
      validation_rules: any
      is_required: boolean
    }>
  } | null
  next_group_id: number | null
  is_completed: boolean
  total_answers: number
}
