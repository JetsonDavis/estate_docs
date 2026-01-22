export type QuestionType = 'multiple_choice' | 'free_text' | 'database_dropdown' | 'checkbox_group' | 'dropdown' | 'person' | 'date'

export interface QuestionOption {
  value: string
  label: string
}

export interface Question {
  id: number
  question_group_id: number
  question_text: string
  question_type: QuestionType
  identifier: string
  display_order: number
  is_required: boolean
  help_text: string | null
  options: QuestionOption[] | null
  database_table: string | null
  database_value_column: string | null
  database_label_column: string | null
  person_display_mode: string | null
  include_time: boolean | null
  validation_rules: Record<string, any> | null
  created_at: string
  updated_at: string
  is_active: boolean
}

export interface QuestionCreate {
  question_group_id: number
  question_text: string
  question_type: QuestionType
  identifier: string
  display_order?: number
  is_required?: boolean
  help_text?: string
  options?: QuestionOption[]
  database_table?: string
  database_value_column?: string
  database_label_column?: string
  person_display_mode?: string
  include_time?: boolean
  validation_rules?: Record<string, any>
}

export interface QuestionUpdate {
  question_text?: string
  question_type?: QuestionType
  display_order?: number
  is_required?: boolean
  help_text?: string
  options?: QuestionOption[]
  database_table?: string
  database_value_column?: string
  database_label_column?: string
  person_display_mode?: string
  include_time?: boolean
  validation_rules?: Record<string, any>
  is_active?: boolean
}

export interface QuestionLogicItem {
  id: string
  type: 'question' | 'conditional'
  questionId?: number
  stopFlow?: boolean
  conditional?: {
    ifIdentifier: string
    value: string
    nestedItems: QuestionLogicItem[]
    endFlow?: boolean
  }
  depth?: number
}

export interface QuestionGroup {
  id: number
  name: string
  description: string | null
  identifier: string
  display_order: number
  question_logic: QuestionLogicItem[] | null
  created_at: string
  updated_at: string
  is_active: boolean
  question_count: number
  questions?: Question[]
}

export interface QuestionGroupCreate {
  name: string
  description?: string
  identifier: string
  display_order?: number
}

export interface QuestionGroupUpdate {
  name?: string
  description?: string
  display_order?: number
  question_logic?: QuestionLogicItem[]
  is_active?: boolean
}

export interface QuestionGroupDetail extends QuestionGroup {
  questions: Question[]
}

export interface QuestionGroupListResponse {
  question_groups: QuestionGroup[]
  total: number
  page: number
  page_size: number
}
