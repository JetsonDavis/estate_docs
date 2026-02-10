import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { templateService } from '../../services/templateService'
import { Template, TemplateCreate, TemplateType } from '../../types/template'
import './Templates.css'

const Templates: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    loadTemplates()
  }, [search])

  useEffect(() => {
    const templateId = searchParams.get('template')
    if (templateId) {
      // Navigate to edit page instead of opening modal
      navigate(`/admin/templates/${templateId}/edit`)
      setSearchParams({})
    }
  }, [searchParams, navigate, setSearchParams])

  const loadTemplates = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await templateService.getTemplates(1, 100, search || undefined)
      setTemplates(response.templates)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this template?')) {
      return
    }

    try {
      await templateService.deleteTemplate(id)
      loadTemplates()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete template')
    }
  }

  const handleEdit = (template: Template) => {
    navigate(`/admin/templates/${template.id}/edit`)
  }

  const getTypeBadgeClass = (type: TemplateType): string => {
    const baseClass = 'template-type-badge'
    switch (type) {
      case 'word':
        return `${baseClass} template-type-word`
      case 'pdf':
        return `${baseClass} template-type-pdf`
      case 'image':
        return `${baseClass} template-type-image`
      case 'direct':
        return `${baseClass} template-type-direct`
      default:
        return baseClass
    }
  }

  return (
    <div className="templates-container">
      <div className="templates-wrapper">
        <div className="templates-header">
          <h1 className="templates-title">Document Templates</h1>
          <div className="templates-actions">
            <div style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              background: 'white',
              border: '2px solid #d1d5db',
              borderRadius: '0.75rem',
              paddingLeft: '0.75rem',
              paddingRight: '0.5rem'
            }}>
              <svg 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24" 
                style={{ width: '1.25rem', height: '1.25rem', color: '#9ca3af', flexShrink: 0 }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search templates..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  flex: 1,
                  padding: '0.75rem 0.5rem',
                  border: 'none',
                  outline: 'none',
                  fontSize: '0.875rem',
                  minWidth: '200px',
                  background: 'transparent'
                }}
              />
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="create-button"
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="button-icon">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Template
            </button>
          </div>
        </div>

      {loading && <div className="loading-state">Loading templates...</div>}
      
      {error && <div className="error-state">{error}</div>}
      
      {!loading && !error && templates.length === 0 && (
        <div className="empty-state">
          No templates found. Create your first template to get started.
        </div>
      )}

      {!loading && !error && templates.length > 0 && (
        <>
          <div className="templates-table">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr key={template.id}>
                    <td className="template-name">
                      <span
                        onClick={() => handleEdit(template)}
                        style={{ cursor: 'pointer', color: '#2563eb', textDecoration: 'none' }}
                        onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                        onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                      >
                        {template.name}
                      </span>
                    </td>
                    <td>
                      <span className={getTypeBadgeClass(template.template_type)}>
                        {template.template_type}
                      </span>
                    </td>
                    <td>{template.description || '-'}</td>
                    <td>{new Date(template.created_at).toLocaleDateString()}</td>
                    <td>
                      <div className="template-actions" style={{ justifyContent: 'flex-start' }}>
                        <button
                          onClick={() => handleEdit(template)}
                          className="action-icon-button"
                          title="Edit"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: '#2563eb' }}
                        >
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '1.25rem', height: '1.25rem' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(template.id)}
                          className="action-icon-button"
                          title="Delete"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: '#dc2626' }}
                        >
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '1.25rem', height: '1.25rem' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showCreateModal && (
        <CreateTemplateModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            loadTemplates()
          }}
        />
      )}

      </div>
    </div>
  )
}

interface CreateTemplateModalProps {
  onClose: () => void
  onSuccess: () => void
}

const CreateTemplateModal: React.FC<CreateTemplateModalProps> = ({ onClose, onSuccess }) => {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [markdownContent, setMarkdownContent] = useState('')
  const [templateType, setTemplateType] = useState<TemplateType>('direct')
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploadedFile, setUploadedFile] = useState(false)
  const [nameError, setNameError] = useState('')
  const [checkingName, setCheckingName] = useState(false)

  // Prevent browser default drag-and-drop behavior globally when modal is open
  useEffect(() => {
    const preventGlobalDrop = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }
    
    document.addEventListener('dragover', preventGlobalDrop)
    document.addEventListener('drop', preventGlobalDrop)
    
    return () => {
      document.removeEventListener('dragover', preventGlobalDrop)
      document.removeEventListener('drop', preventGlobalDrop)
    }
  }, [])

  const isFormValid = name.trim() !== '' && !nameError && (markdownContent.trim() !== '' || uploadedFile)

  useEffect(() => {
    const checkNameExists = async () => {
      if (!name.trim()) {
        setNameError('')
        return
      }

      const timeoutId = setTimeout(async () => {
        try {
          setCheckingName(true)
          const response = await templateService.getTemplates(1, 100)
          const exists = response.templates.some(
            (template) => template.name.toLowerCase() === name.trim().toLowerCase()
          )
          if (exists) {
            setNameError('A template with this name already exists')
          } else {
            setNameError('')
          }
        } catch (err) {
          // Silently fail on check error
        } finally {
          setCheckingName(false)
        }
      }, 500)

      return () => clearTimeout(timeoutId)
    }

    checkNameExists()
  }, [name])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    console.log('File upload triggered, file:', file)
    if (!file) return

    console.log('File name:', file.name, 'File type:', file.type, 'File size:', file.size)

    // Check if file is an image
    const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/tiff', 'image/tif']
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.tiff', '.tif']
    const isImage = imageTypes.includes(file.type) ||
                    imageExtensions.some(ext => file.name.toLowerCase().endsWith(ext))

    if (isImage) {
      alert('File type not yet implemented')
      e.target.value = '' // Reset the file input
      return
    }

    try {
      setUploading(true)
      // Pass the template name if available for Word/PDF files
      const templateNameForUpload = name.trim() || file.name.replace(/\.[^/.]+$/, '')
      console.log('Calling uploadFile with:', file.name, templateNameForUpload)
      const response = await templateService.uploadFile(file, templateNameForUpload)
      console.log('Upload response:', response)
      setMarkdownContent(response.markdown_content)
      setUploadedFile(true)
    } catch (err: any) {
      console.error('Upload error:', err)
      alert(err.response?.data?.detail || err.message || 'Failed to upload file')
    } finally {
      setUploading(false)
      e.target.value = '' // Reset file input for re-upload
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name || !markdownContent) {
      alert('Please provide a name and content')
      return
    }

    try {
      setSubmitting(true)
      const data: TemplateCreate = {
        name,
        description: description || undefined,
        template_type: templateType,
        markdown_content: markdownContent
      }
      console.log('Submitting template data:', data)
      await templateService.createTemplate(data)
      onSuccess()
    } catch (err: any) {
      console.error('Template creation error:', err)
      console.error('Error response:', err.response)
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to create template'
      alert(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  // Prevent browser from opening dropped files
  const preventDefaults = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = async (e: React.DragEvent) => {
    preventDefaults(e)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      // Create a synthetic event to reuse handleFileUpload logic
      const syntheticEvent = {
        target: { files: [file], value: '' }
      } as unknown as React.ChangeEvent<HTMLInputElement>
      await handleFileUpload(syntheticEvent)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()}
        onDragEnter={preventDefaults}
        onDragOver={preventDefaults}
        onDragLeave={preventDefaults}
        onDrop={handleDrop}
      >
        <div className="modal-header">
          <h2 className="modal-title">Create Template</h2>
          <button onClick={onClose} className="modal-close">&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input"
              style={{ borderColor: nameError ? '#dc2626' : undefined }}
            />
            <div style={{ height: '1.5rem', marginTop: '0.25rem' }}>
              {checkingName && (
                <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>Checking name...</p>
              )}
              {nameError && !checkingName && (
                <p style={{ color: '#dc2626', fontSize: '0.875rem', margin: 0 }}>{nameError}</p>
              )}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Upload File</label>
            <div className="file-upload" onClick={() => {
              console.log('File upload div clicked')
              document.getElementById('file-input')?.click()
            }}>
              <input
                id="file-input"
                type="file"
                accept=".docx,.pdf,.txt,.jpg,.jpeg,.png,.tiff,.tif"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
              <div className="upload-icon">📄</div>
              <div className="upload-text">
                {uploading ? 'Uploading...' : 'Click to upload Word, PDF, Text, or Image file'}
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              Text (Use {'<<identifier>>'} for placeholders)
            </label>
            <textarea
              value={markdownContent}
              onChange={(e) => setMarkdownContent(e.target.value)}
              className="form-textarea"
              rows={25}
              style={{ minHeight: '350px' }}
              placeholder="Enter your template content here...&#10;&#10;Example:&#10;Name: <<client_name>>&#10;Date of Birth: <<dob>>"
            />
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="cancel-button">
              Cancel
            </button>
            <button type="submit" disabled={submitting || !isFormValid} className="submit-button">
              {submitting ? 'Creating...' : 'Create Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Templates
