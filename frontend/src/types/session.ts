export interface SessionAnswer {
  id: number
  session_id: number
  question_id: number
  answer_value: string
  created_at: string
  updated_at: string
}

export interface DocumentSession {
  id: number
  client_identifier: string
  user_id: number
  current_group_id: number | null
  is_completed: boolean
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface DocumentSessionWithAnswers extends DocumentSession {
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
  session: DocumentSession
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

export interface QuestionToDisplay {
  id: number
  identifier: string
  question_text: string
  question_type: string
  is_required: boolean
  repeatable: boolean
  help_text: string | null
  options: Array<{ value: string; label: string }> | null
  person_display_mode: string | null
  include_time: boolean | null
  validation_rules: Record<string, any> | null
  current_answer: string | null
  depth: number  // Nesting level for conditional questions
}

export interface SessionQuestionsResponse {
  session_id: number
  client_identifier: string
  flow_id: number | null
  flow_name: string | null
  current_group_id: number
  current_group_name: string
  current_group_index: number
  total_groups: number
  questions: QuestionToDisplay[]
  current_page: number
  total_pages: number
  questions_per_page: number
  is_completed: boolean
  is_last_group: boolean
  can_go_back: boolean
  existing_answers: Record<number, string>
  conditional_identifiers: string[]  // identifiers that have conditionals depending on them
}

export interface SaveAnswersRequest {
  answers: Array<{
    question_id: number
    answer_value: string
  }>
}

export interface NavigateRequest {
  direction: 'forward' | 'backward'
  answers?: Array<{
    question_id: number
    answer_value: string
  }>
}
