export type TemplateType = 'word' | 'pdf' | 'image' | 'direct'

export interface Template {
  id: number
  name: string
  description: string | null
  template_type: TemplateType
  original_filename: string | null
  original_file_path: string | null
  markdown_content: string
  identifiers: string | null
  created_by: number | null
  created_at: string
  updated_at: string
  is_active: boolean
}

export interface TemplateCreate {
  name: string
  description?: string
  template_type: TemplateType
  markdown_content: string
  original_filename?: string
  original_file_path?: string
}

export interface TemplateUpdate {
  name?: string
  description?: string
  markdown_content?: string
}

export interface TemplateListResponse {
  templates: Template[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface TemplateIdentifiersResponse {
  template_id: number
  identifiers: string[]
}

export interface FileUploadResponse {
  filename: string
  file_path: string
  markdown_content: string
  message: string
}
