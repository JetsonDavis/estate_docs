export interface QuestionnaireFlow {
  id: number
  name: string
  description: string | null
  flow_logic?: any
  starting_group_id: number | null
  created_by: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface QuestionnaireFlowWithGroups extends QuestionnaireFlow {
  question_groups: Array<{
    id: number
    name: string
    description: string | null
    order_index: number
  }>
}

export interface QuestionnaireFlowCreate {
  name: string
  description?: string
  flow_logic?: any
  starting_group_id?: number
  question_group_ids?: number[]
}

export interface QuestionnaireFlowUpdate {
  name?: string
  description?: string
  flow_logic?: any
  starting_group_id?: number
  question_group_ids?: number[]
}

export interface QuestionnaireFlowListResponse {
  flows: QuestionnaireFlow[]
  total: number
  page: number
  page_size: number
  total_pages: number
}
