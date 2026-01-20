export interface DocumentFlow {
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

export interface DocumentFlowWithGroups extends DocumentFlow {
  question_groups: Array<{
    id: number
    name: string
    description: string | null
    order_index: number
  }>
}

export interface DocumentFlowCreate {
  name: string
  description?: string
  flow_logic?: any
  starting_group_id?: number
  question_group_ids?: number[]
}

export interface DocumentFlowUpdate {
  name?: string
  description?: string
  flow_logic?: any
  starting_group_id?: number
  question_group_ids?: number[]
}

export interface DocumentFlowListResponse {
  flows: DocumentFlow[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

// Backwards compatibility aliases
export type DocumentFlow = DocumentFlow
export type DocumentFlowWithGroups = DocumentFlowWithGroups
export type DocumentFlowCreate = DocumentFlowCreate
export type DocumentFlowUpdate = DocumentFlowUpdate
export type DocumentFlowListResponse = DocumentFlowListResponse
