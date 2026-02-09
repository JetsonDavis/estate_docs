import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { templateService } from '../../services/templateService'
import { Template } from '../../types/template'
import './Templates.css'

const EditTemplate: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  
  const [template, setTemplate] = useState<Template | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [markdownContent, setMarkdownContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (id) {
      loadTemplate(parseInt(id))
    }
  }, [id])

  const loadTemplate = async (templateId: number) => {
    try {
      setLoading(true)
      setError(null)
      const data = await templateService.getTemplate(templateId)
      setTemplate(data)
      setName(data.name)
      setDescription(data.description || '')
      setMarkdownContent(data.markdown_content)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load template')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setUploading(true)
      const result = await templateService.uploadFile(file)
      setMarkdownContent(result.markdown_content)
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to upload file')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!template) return

    try {
      setSubmitting(true)
      await templateService.updateTemplate(template.id, {
        name,
        description: description || undefined,
        markdown_content: markdownContent
      })
      navigate('/admin/templates')
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update template')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="templates-container">
        <div className="templates-wrapper">
          <div className="loading-state">Loading template...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="templates-container">
        <div className="templates-wrapper">
          <div className="error-state">{error}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="templates-container">
      <div className="templates-wrapper">
        <div className="templates-header">
          <h1 className="templates-title">Edit Template</h1>
          <button
            onClick={() => navigate('/admin/templates')}
            className="cancel-button"
            style={{ padding: '0.625rem 1.25rem' }}
          >
            ← Back to Templates
          </button>
        </div>

        <div className="edit-template-content">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem', paddingTop: '16px' }}>Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem', paddingTop: '16px' }}>Upload File</label>
              <div className="file-upload" style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }} onClick={() => {
                document.getElementById('edit-file-input')?.click()
              }}>
                <input
                  id="edit-file-input"
                  type="file"
                  accept=".docx,.pdf,.txt,.jpg,.jpeg,.png,.tiff,.tif"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                <span>📄</span>
                <span style={{ fontSize: '0.875rem' }}>
                  {uploading ? 'Uploading...' : 'Click to upload Word, PDF, Text, or Image file'}
                </span>
              </div>
            </div>

            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem', paddingTop: '16px' }}>
                Text (Use {'<<identifier>>'} for placeholders)
              </label>
              <textarea
                value={markdownContent}
                onChange={(e) => setMarkdownContent(e.target.value)}
                style={{ 
                  width: '100%',
                  height: '600px',
                  padding: '0.875rem 1rem',
                  border: '2px solid #d1d5db',
                  borderRadius: '0.75rem',
                  fontSize: '1rem',
                  fontFamily: "'Courier New', monospace",
                  boxSizing: 'border-box',
                  overflowY: 'scroll',
                  resize: 'vertical'
                }}
                required
              />
            </div>

            <div className="form-actions" style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button
                type="button"
                onClick={() => navigate('/admin/templates')}
                className="cancel-button"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="submit-button"
              >
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default EditTemplate
