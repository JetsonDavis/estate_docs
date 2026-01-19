export interface GeneratedDocument {
  id: number
  session_id: number
  template_id: number | null
  document_name: string
  markdown_content: string
  pdf_file_path: string | null
  generated_by: number | null
  generated_at: string
  created_at: string
  updated_at: string
}

export interface GenerateDocumentRequest {
  session_id: number
  template_id: number
  document_name?: string
}

export interface DocumentPreview {
  template_name: string
  session_client: string
  markdown_content: string
  missing_identifiers: string[]
  available_identifiers: string[]
}

export interface GeneratedDocumentListResponse {
  documents: GeneratedDocument[]
  total: number
  page: number
  page_size: number
  total_pages: number
}
