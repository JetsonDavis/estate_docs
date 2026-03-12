import React, { useState, useEffect } from 'react'
import styled from 'styled-components'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { templateService } from '../../services/templateService'
import { Template, TemplateCreate, TemplateType } from '../../types/template'
import { useToast } from '../../hooks/useToast'
import ConfirmDialog from '../../components/common/ConfirmDialog'

const TemplatesContainer = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #e0f2fe 0%, #bfdbfe 100%);
  padding: 3rem 1rem;
`

const TemplatesWrapper = styled.div`
  max-width: 1400px;
  margin: 0 auto;
`

const TemplatesHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  background: white;
  border-radius: 1rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  padding: 1.5rem;
  @media (max-width: 640px) {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }
`

const TemplatesTitle = styled.h1`
  font-size: 2rem;
  font-weight: 700;
  color: #111827;
  @media (max-width: 768px) {
    font-size: 1.5rem;
  }
`

const TemplatesActions = styled.div`
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
  @media (max-width: 640px) {
    flex-direction: column;
    width: 100%;
  }
`

const CreateButton = styled.button`
  background-color: #2563eb;
  color: white;
  font-weight: 600;
  font-size: 0.875rem;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  &:hover {
    background-color: #1d4ed8;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  }
  @media (max-width: 640px) {
    width: 100%;
  }
`

const ButtonIcon = styled.svg`
  width: 1.25rem;
  height: 1.25rem;
`

const TemplatesTable = styled.div`
  width: 100%;
  background: white;
  border-radius: 1rem;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  overflow: hidden;
  table {
    width: 100%;
    border-collapse: collapse;
  }
  thead {
    background-color: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
  }
  th {
    padding: 0.75rem 1rem;
    text-align: left;
    font-size: 0.75rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  td {
    padding: 1rem;
    border-bottom: 1px solid #f3f4f6;
    font-size: 0.875rem;
    color: #374151;
  }
  tbody tr:hover {
    background-color: #f9fafb;
  }
  @media (max-width: 768px) {
    overflow-x: auto;
    th, td {
      padding: 0.75rem;
      font-size: 0.8rem;
    }
  }
`

const TemplateName = styled.td`
  font-weight: 600;
  color: #111827;
`

const TypeBadge = styled.span<{ $type: TemplateType }>`
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  ${({ $type }) => {
    switch ($type) {
      case 'word': return 'background-color: #dbeafe; color: #1e40af;'
      case 'pdf': return 'background-color: #fee2e2; color: #991b1b;'
      case 'image': return 'background-color: #fef3c7; color: #92400e;'
      case 'direct': return 'background-color: #d1fae5; color: #065f46;'
      default: return ''
    }
  }}
`

const TemplateActions = styled.div`
  display: flex;
  gap: 0.5rem;
  justify-content: flex-start;
`

const ActionIconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  &:hover {
    opacity: 0.7;
  }
`

const StateMessage = styled.div<{ $variant?: 'error' | 'empty' }>`
  text-align: center;
  padding: 3rem 1rem;
  color: #6b7280;
  background: white;
  border-radius: 1rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  font-size: 1rem;
  ${({ $variant }) => $variant === 'error' ? `
    color: #991b1b;
    background-color: #fef2f2;
    border: 1px solid #fecaca;
  ` : ''}
`

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

  return (
    <TemplatesContainer>
      <TemplatesWrapper>
        <TemplatesHeader>
          <TemplatesTitle>Document Templates</TemplatesTitle>
          <TemplatesActions>
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
            <CreateButton onClick={() => navigate('/admin/templates/create')}>
              <ButtonIcon fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </ButtonIcon>
              Create Template
            </CreateButton>
          </TemplatesActions>
        </TemplatesHeader>

      {loading && <StateMessage>Loading templates...</StateMessage>}
      
      {error && <StateMessage $variant="error">{error}</StateMessage>}
      
      {!loading && !error && templates.length === 0 && (
        <StateMessage>
          No templates found. Create your first template to get started.
        </StateMessage>
      )}

      {!loading && !error && templates.length > 0 && (
        <>
          <TemplatesTable>
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
                    <TemplateName>
                      <span
                        onClick={() => handleEdit(template)}
                        style={{ cursor: 'pointer', color: '#2563eb', textDecoration: 'none' }}
                        onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                        onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                      >
                        {template.name}
                      </span>
                    </TemplateName>
                    <td>
                      <TypeBadge $type={template.template_type}>
                        {template.template_type}
                      </TypeBadge>
                    </td>
                    <td>{template.description || '-'}</td>
                    <td>{new Date(template.created_at).toLocaleDateString()}</td>
                    <td>
                      <TemplateActions>
                        <ActionIconButton
                          onClick={() => handleEdit(template)}
                          title="Edit"
                          style={{ color: '#2563eb' }}
                        >
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '1.25rem', height: '1.25rem' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </ActionIconButton>
                        <ActionIconButton
                          onClick={() => handleDelete(template.id)}
                          title="Delete"
                          style={{ color: '#dc2626' }}
                        >
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '1.25rem', height: '1.25rem' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </ActionIconButton>
                      </TemplateActions>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TemplatesTable>
        </>
      )}

      </TemplatesWrapper>
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete Template"
        message="Are you sure you want to delete this template?"
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </TemplatesContainer>
  )
}

export default Templates
