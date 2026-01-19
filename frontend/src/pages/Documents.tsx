import React, { useState, useEffect } from 'react'
import { documentService } from '../services/documentService'
import { sessionService } from '../services/sessionService'
import { templateService } from '../services/templateService'
import { GeneratedDocument, DocumentPreview } from '../types/document'
import { QuestionnaireSession } from '../types/session'
import { Template } from '../types/template'
import './Documents.css'

const Documents: React.FC = () => {
  const [documents, setDocuments] = useState<GeneratedDocument[]>([])
  const [sessions, setSessions] = useState<QuestionnaireSession[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [selectedSession, setSelectedSession] = useState<number | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null)
  const [documentName, setDocumentName] = useState('')
  const [preview, setPreview] = useState<DocumentPreview | null>(null)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    loadDocuments()
  }, [])

  const loadDocuments = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await documentService.getDocuments()
      setDocuments(response.documents)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }

  const loadSessionsAndTemplates = async () => {
    try {
      const [sessionsData, templatesData] = await Promise.all([
        sessionService.getSessions(),
        templateService.getTemplates()
      ])
      setSessions(sessionsData.filter(s => s.is_completed))
      setTemplates(templatesData.templates)
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to load sessions and templates')
    }
  }

  const handleGenerateClick = async () => {
    await loadSessionsAndTemplates()
    setShowGenerateModal(true)
  }

  const handlePreview = async () => {
    if (!selectedSession || !selectedTemplate) {
      alert('Please select both a session and a template')
      return
    }

    try {
      const previewData = await documentService.previewDocument(selectedSession, selectedTemplate)
      setPreview(previewData)
      setShowPreviewModal(true)
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to preview document')
    }
  }

  const handleGenerate = async () => {
    if (!selectedSession || !selectedTemplate) {
      alert('Please select both a session and a template')
      return
    }

    try {
      setGenerating(true)
      await documentService.generateDocument({
        session_id: selectedSession,
        template_id: selectedTemplate,
        document_name: documentName || undefined
      })
      setShowGenerateModal(false)
      setShowPreviewModal(false)
      setSelectedSession(null)
      setSelectedTemplate(null)
      setDocumentName('')
      setPreview(null)
      loadDocuments()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to generate document')
    } finally {
      setGenerating(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this document?')) {
      return
    }

    try {
      await documentService.deleteDocument(id)
      loadDocuments()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete document')
    }
  }

  return (
    <div className="documents-container">
      <div className="documents-content">
        <div className="documents-header">
          <h1 className="documents-title">My Documents</h1>
          <button onClick={handleGenerateClick} className="btn btn-primary">
            Generate New Document
          </button>
        </div>

        {loading && <div className="loading-state">Loading documents...</div>}
        
        {error && <div className="error-state">{error}</div>}
        
        {!loading && !error && documents.length === 0 && (
          <div className="empty-state">
            No documents generated yet. Generate your first document to get started.
          </div>
        )}

        {!loading && !error && documents.length > 0 && (
          <div className="documents-grid">
            {documents.map(doc => (
              <div key={doc.id} className="document-card">
                <div className="document-header">
                  <h3 className="document-name">{doc.document_name}</h3>
                  <span className="document-date">
                    {new Date(doc.generated_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="document-preview">
                  {doc.markdown_content.substring(0, 200)}...
                </div>
                <div className="document-actions">
                  <button
                    onClick={() => {
                      const blob = new Blob([doc.markdown_content], { type: 'text/markdown' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `${doc.document_name}.md`
                      a.click()
                    }}
                    className="btn btn-secondary btn-sm"
                  >
                    Download
                  </button>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="btn btn-danger btn-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showGenerateModal && (
          <div className="modal-overlay" onClick={() => setShowGenerateModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Generate Document</h2>
                <button onClick={() => setShowGenerateModal(false)} className="modal-close">&times;</button>
              </div>

              <div className="form-group">
                <label className="form-label">Select Completed Session</label>
                <select
                  className="form-select"
                  value={selectedSession || ''}
                  onChange={(e) => setSelectedSession(Number(e.target.value))}
                >
                  <option value="">Choose a session...</option>
                  {sessions.map(session => (
                    <option key={session.id} value={session.id}>
                      {session.client_identifier} - {new Date(session.created_at).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Select Template</label>
                <select
                  className="form-select"
                  value={selectedTemplate || ''}
                  onChange={(e) => setSelectedTemplate(Number(e.target.value))}
                >
                  <option value="">Choose a template...</option>
                  {templates.map(template => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Document Name (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  value={documentName}
                  onChange={(e) => setDocumentName(e.target.value)}
                  placeholder="Leave blank for auto-generated name"
                />
              </div>

              <div className="modal-actions">
                <button onClick={handlePreview} className="btn btn-secondary">
                  Preview
                </button>
                <button onClick={handleGenerate} disabled={generating} className="btn btn-primary">
                  {generating ? 'Generating...' : 'Generate'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showPreviewModal && preview && (
          <div className="modal-overlay" onClick={() => setShowPreviewModal(false)}>
            <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Document Preview</h2>
                <button onClick={() => setShowPreviewModal(false)} className="modal-close">&times;</button>
              </div>

              <div className="preview-info">
                <p><strong>Template:</strong> {preview.template_name}</p>
                <p><strong>Client:</strong> {preview.session_client}</p>
                {preview.missing_identifiers.length > 0 && (
                  <div className="warning-box">
                    <strong>Missing Identifiers:</strong> {preview.missing_identifiers.join(', ')}
                  </div>
                )}
              </div>

              <div className="preview-content">
                <pre>{preview.markdown_content}</pre>
              </div>

              <div className="modal-actions">
                <button onClick={() => setShowPreviewModal(false)} className="btn btn-secondary">
                  Close
                </button>
                <button onClick={handleGenerate} disabled={generating} className="btn btn-primary">
                  {generating ? 'Generating...' : 'Generate Document'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Documents
