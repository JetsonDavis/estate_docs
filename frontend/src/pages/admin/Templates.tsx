import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { templateService } from '../../services/templateService'
import { Template, TemplateCreate, TemplateType } from '../../types/template'
import { useToast } from '../../hooks/useToast'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import './Templates.css'

const Templates: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
  const { toast } = useToast()

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

  const handleDelete = (id: number) => {
    setDeleteTarget(id)
  }

  const confirmDelete = async () => {
    if (deleteTarget === null) return
    try {
      await templateService.deleteTemplate(deleteTarget)
      loadTemplates()
    } catch (err: any) {
      toast(err.response?.data?.detail || 'Failed to delete template')
    } finally {
      setDeleteTarget(null)
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
              onClick={() => navigate('/admin/templates/create')}
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

      </div>
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete Template"
        message="Are you sure you want to delete this template?"
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

export default Templates
