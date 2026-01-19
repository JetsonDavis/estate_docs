import React, { useState, useEffect } from 'react'
import { templateService } from '../../services/templateService'
import { Template, TemplateCreate, TemplateType } from '../../types/template'
import './Templates.css'

const Templates: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)

  const pageSize = 10

  useEffect(() => {
    loadTemplates()
  }, [page, search])

  const loadTemplates = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await templateService.getTemplates(page, pageSize, search || undefined)
      setTemplates(response.templates)
      setTotal(response.total)
      setTotalPages(response.total_pages)
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
    setSelectedTemplate(template)
    setShowEditModal(true)
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
      <div className="templates-header">
        <h1 className="templates-title">Document Templates</h1>
        <div className="templates-actions">
          <input
            type="text"
            placeholder="Search templates..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="search-input"
          />
          <button
            onClick={() => setShowCreateModal(true)}
            className="create-button"
          >
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
                    <td className="template-name">{template.name}</td>
                    <td>
                      <span className={getTypeBadgeClass(template.template_type)}>
                        {template.template_type}
                      </span>
                    </td>
                    <td>{template.description || '-'}</td>
                    <td>{new Date(template.created_at).toLocaleDateString()}</td>
                    <td>
                      <div className="template-actions">
                        <button
                          onClick={() => handleEdit(template)}
                          className="action-button edit-button"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(template.id)}
                          className="action-button delete-button"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <div className="pagination-info">
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} templates
            </div>
            <div className="pagination-buttons">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="pagination-button"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
                className="pagination-button"
              >
                Next
              </button>
            </div>
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

      {showEditModal && selectedTemplate && (
        <EditTemplateModal
          template={selectedTemplate}
          onClose={() => {
            setShowEditModal(false)
            setSelectedTemplate(null)
          }}
          onSuccess={() => {
            setShowEditModal(false)
            setSelectedTemplate(null)
            loadTemplates()
          }}
        />
      )}
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
  const [templateType, setTemplateType] = useState<TemplateType>('direct')
  const [markdownContent, setMarkdownContent] = useState('')
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setUploading(true)
      const response = await templateService.uploadFile(file)
      setMarkdownContent(response.markdown_content)
      
      // Determine template type from file
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (ext === 'docx' || ext === 'doc') {
        setTemplateType('word')
      } else if (ext === 'pdf') {
        setTemplateType('pdf')
      } else if (['jpg', 'jpeg', 'png', 'tiff', 'tif'].includes(ext || '')) {
        setTemplateType('image')
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to upload file')
    } finally {
      setUploading(false)
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
      await templateService.createTemplate(data)
      onSuccess()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create template')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Create Template</h2>
          <button onClick={onClose} className="modal-close">&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Upload File (Optional)</label>
            <div className="file-upload" onClick={() => document.getElementById('file-input')?.click()}>
              <input
                id="file-input"
                type="file"
                accept=".docx,.pdf,.jpg,.jpeg,.png,.tiff,.tif"
                onChange={handleFileUpload}
              />
              <div className="upload-icon">📄</div>
              <div className="upload-text">
                {uploading ? 'Uploading...' : 'Click to upload Word, PDF, or Image file'}
              </div>
            </div>
          </div>

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
            <label className="form-label">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Template Type *</label>
            <select
              value={templateType}
              onChange={(e) => setTemplateType(e.target.value as TemplateType)}
              className="form-select"
            >
              <option value="direct">Direct Text</option>
              <option value="word">Word Document</option>
              <option value="pdf">PDF</option>
              <option value="image">Image</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">
              Markdown Content * (Use {'<<identifier>>'} for placeholders)
            </label>
            <textarea
              value={markdownContent}
              onChange={(e) => setMarkdownContent(e.target.value)}
              className="form-textarea"
              placeholder="Enter your template content here...&#10;&#10;Example:&#10;Name: <<client_name>>&#10;Date of Birth: <<dob>>"
              required
            />
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="cancel-button">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="submit-button">
              {submitting ? 'Creating...' : 'Create Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface EditTemplateModalProps {
  template: Template
  onClose: () => void
  onSuccess: () => void
}

const EditTemplateModal: React.FC<EditTemplateModalProps> = ({ template, onClose, onSuccess }) => {
  const [name, setName] = useState(template.name)
  const [description, setDescription] = useState(template.description || '')
  const [markdownContent, setMarkdownContent] = useState(template.markdown_content)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setSubmitting(true)
      await templateService.updateTemplate(template.id, {
        name,
        description: description || undefined,
        markdown_content: markdownContent
      })
      onSuccess()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update template')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Edit Template</h2>
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
              required
            />
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
            <label className="form-label">
              Markdown Content * (Use {'<<identifier>>'} for placeholders)
            </label>
            <textarea
              value={markdownContent}
              onChange={(e) => setMarkdownContent(e.target.value)}
              className="form-textarea"
              required
            />
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="cancel-button">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="submit-button">
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Templates
