import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import { sessionService } from '../services/sessionService'
import { templateService } from '../services/templateService'
import { InputForm } from '../types/session'
import { Template } from '../types/template'
import { useToast } from '../hooks/useToast'

const MergeContainer = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #e0f2fe 0%, #bfdbfe 100%);
  padding: 3rem 1rem;
`

const MergeWrapper = styled.div`
  max-width: 1400px;
  margin: 0 auto;
`

const MergeHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  background: white;
  border-radius: 1rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  padding: 1.5rem;
`

const MergeTitle = styled.h1`
  font-size: 2rem;
  font-weight: 700;
  color: #111827;
  margin: 0;
`

const MergeContent = styled.div`
  background: white;
  border-radius: 1rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  padding: 2rem;
`

const ListBoxContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`

const ListBox = styled.div`
  display: flex;
  flex-direction: column;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  overflow: hidden;
`

const ListBoxHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  background-color: #2563eb;
  border-bottom: 1px solid #1d4ed8;
`

const ListBoxTitle = styled.h2`
  font-size: 1.125rem;
  font-weight: 600;
  color: #ffffff;
  margin: 0;
  cursor: pointer;
`

const ListBoxCount = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2rem;
  height: 1.5rem;
  padding: 0 0.5rem;
  background-color: #ffffff;
  color: #2563eb;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 9999px;
`

const ListBoxContent = styled.div`
  flex: 1;
  overflow-y: auto;
  max-height: 600px;
  margin-top: 0;
`

const ItemList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`

const Item = styled.li`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #f3f4f6;
  transition: background-color 0.2s;

  &:hover {
    background-color: #f9fafb;
  }

  &:last-child {
    border-bottom: none;
  }
`

const ItemRadio = styled.div`
  display: flex;
  align-items: center;

  input[type="radio"] {
    width: 1.125rem;
    height: 1.125rem;
    cursor: pointer;
  }
`

const ItemContent = styled.div`
  flex: 1;
  cursor: pointer;
`

const ItemHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0;
`

const ItemNameLink = styled.span`
  font-size: 0.875rem;
  font-weight: 600;
  color: #2563eb;
  cursor: pointer;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
    color: #1d4ed8;
  }
`

const ItemMeta = styled.div`
  display: flex;
  gap: 1rem;
  font-size: 0.75rem;
  color: #6b7280;
`

const ItemDate = styled.span`
  display: flex;
  align-items: center;
  gap: 0.25rem;
`

const StatusBadge = styled.span<{ $status: 'completed' | 'in-progress' }>`
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 9999px;
  background-color: ${props => props.$status === 'completed' ? '#d1fae5' : '#fef3c7'};
  color: ${props => props.$status === 'completed' ? '#065f46' : '#92400e'};
`

const EmptyList = styled.div`
  padding: 3rem 1rem;
  text-align: center;
  color: #6b7280;
  font-size: 0.875rem;
`

const StateMessage = styled.div<{ $variant?: 'error' }>`
  text-align: center;
  padding: 3rem 1rem;
  background: ${props => props.$variant === 'error' ? '#fef2f2' : 'white'};
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  color: ${props => props.$variant === 'error' ? '#991b1b' : '#6b7280'};
  ${props => props.$variant === 'error' ? 'border: 1px solid #fecaca;' : ''}
`

const MergeBtn = styled.button<{ $disabled?: boolean }>`
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  font-weight: 600;
  border-radius: 0.5rem;
  border: none;
  background-color: #2563eb;
  color: white;
  cursor: ${props => props.$disabled ? 'not-allowed' : 'pointer'};
  opacity: ${props => props.$disabled ? 0.5 : 1};
  transition: background-color 0.2s;

  &:hover:not(:disabled) {
    background-color: #1d4ed8;
  }
`

const IdentifiersSection = styled.div`
  margin-top: 2rem;
  background: white;
  border-radius: 0.75rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
`

const IdentifiersTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 600;
  color: #111827;
  margin: 0 0 1.5rem 0;
`

const IdentifiersColumns = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`

const IdentifiersColumn = styled.div`
  display: flex;
  flex-direction: column;
`

const ColumnTitle = styled.h3`
  font-size: 1rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 1rem 0;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid #e5e7eb;
`

const IdentifierItems = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`

const IdentifierItem = styled.li<{ $missing?: boolean; $placeholder?: boolean }>`
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;

  ${props => props.$placeholder ? `
    background-color: transparent;
    border: 1px dashed #e5e7eb;
    color: transparent;
  ` : props.$missing ? `
    background-color: #fee2e2;
    color: #991b1b;
    border: 1px solid #fca5a5;
  ` : `
    background-color: #f3f4f6;
    color: #374151;
    border: 1px solid #d1d5db;
  `}
`

const MergeDocuments: React.FC = () => {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<InputForm[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(() => {
    const saved = localStorage.getItem('mergeDocuments_selectedSessionId')
    return saved ? parseInt(saved, 10) : null
  })
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(() => {
    const saved = localStorage.getItem('mergeDocuments_selectedTemplateId')
    return saved ? parseInt(saved, 10) : null
  })
  const [sessionIdentifiers, setSessionIdentifiers] = useState<string[]>([])
  const [templateIdentifiers, setTemplateIdentifiers] = useState<string[]>([])
  const [loadingIdentifiers, setLoadingIdentifiers] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadData()
  }, [])

  // Persist selected session ID to localStorage
  useEffect(() => {
    if (selectedSessionId !== null) {
      localStorage.setItem('mergeDocuments_selectedSessionId', selectedSessionId.toString())
    } else {
      localStorage.removeItem('mergeDocuments_selectedSessionId')
    }
  }, [selectedSessionId])

  // Persist selected template ID to localStorage
  useEffect(() => {
    if (selectedTemplateId !== null) {
      localStorage.setItem('mergeDocuments_selectedTemplateId', selectedTemplateId.toString())
    } else {
      localStorage.removeItem('mergeDocuments_selectedTemplateId')
    }
  }, [selectedTemplateId])

  useEffect(() => {
    if (selectedSessionId) {
      loadSessionIdentifiers(selectedSessionId)
    } else {
      setSessionIdentifiers([])
    }
  }, [selectedSessionId])

  useEffect(() => {
    if (selectedTemplateId) {
      loadTemplateIdentifiers(selectedTemplateId)
    } else {
      setTemplateIdentifiers([])
    }
  }, [selectedTemplateId])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [sessionsData, templatesData] = await Promise.all([
        sessionService.getSessions(),
        templateService.getTemplates()
      ])
      setSessions(sessionsData)
      setTemplates(templatesData.templates)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const loadSessionIdentifiers = async (sessionId: number) => {
    try {
      setLoadingIdentifiers(true)
      const identifiers = await sessionService.getSessionIdentifiers(sessionId)
      // Strip namespace prefix (e.g., "bene_test_20.Special_bene" -> "Special_bene")
      const stripped = identifiers.map(id => id.includes('.') ? id.split('.').slice(1).join('.') : id)
      // Sort alphabetically
      setSessionIdentifiers([...stripped].sort((a, b) => a.localeCompare(b)))
    } catch (err: any) {
      console.error('Failed to load session identifiers:', err)
      setSessionIdentifiers([])
    } finally {
      setLoadingIdentifiers(false)
    }
  }

  const loadTemplateIdentifiers = async (templateId: number) => {
    try {
      setLoadingIdentifiers(true)
      const template = templates.find(t => t.id === templateId)
      if (template && template.identifiers) {
        // For template identifiers, only use text before the period (if there is one)
        const identifiers = template.identifiers.split(',').map(id => {
          const trimmed = id.trim()
          const dotIndex = trimmed.indexOf('.')
          return dotIndex !== -1 ? trimmed.substring(0, dotIndex) : trimmed
        })
        // Sort alphabetically
        setTemplateIdentifiers([...identifiers].sort((a, b) => a.localeCompare(b)))
      } else {
        setTemplateIdentifiers([])
      }
    } catch (err: any) {
      console.error('Failed to load template identifiers:', err)
      setTemplateIdentifiers([])
    } finally {
      setLoadingIdentifiers(false)
    }
  }

  const handleSessionRadioChange = (sessionId: number) => {
    setSelectedSessionId(sessionId)
  }

  const handleTemplateRadioChange = (templateId: number) => {
    setSelectedTemplateId(templateId)
  }

  // Sort identifiers so matching ones line up between the two columns
  // Returns { sessionSorted, templateSorted } where matching identifiers are at the same index
  const { sessionSorted, templateSorted } = useMemo(() => {
    // Helper to strip subscripts like [1], [2] from identifiers
    const stripSubscript = (id: string): string => {
      return id.replace(/\[\d+\]$/, '')
    }
    
    // Find identifiers that exist in both lists (ignoring subscripts)
    const inBoth = sessionIdentifiers.filter(id => 
      templateIdentifiers.some(tid => stripSubscript(id) === stripSubscript(tid))
    ).sort()
    
    // Find identifiers only in session (not in template)
    const onlyInSession = sessionIdentifiers.filter(id => 
      !templateIdentifiers.some(tid => stripSubscript(id) === stripSubscript(tid))
    ).sort()
    
    // Find identifiers only in template (not in session)
    const onlyInTemplate = templateIdentifiers.filter(id => 
      !sessionIdentifiers.some(sid => stripSubscript(id) === stripSubscript(sid))
    ).sort()
    
    // Build aligned lists:
    // - First, matching identifiers (same in both)
    // - Then, non-matching ones with placeholders to align
    const sSorted: (string | null)[] = []
    const tSorted: (string | null)[] = []
    
    // Add matching identifiers first
    for (const id of inBoth) {
      sSorted.push(id)
      tSorted.push(id)
    }
    
    // Add session-only identifiers with null placeholders in template
    for (const id of onlyInSession) {
      sSorted.push(id)
      tSorted.push(null)
    }
    
    // Add template-only identifiers with null placeholders in session
    for (const id of onlyInTemplate) {
      sSorted.push(null)
      tSorted.push(id)
    }
    
    return { sessionSorted: sSorted, templateSorted: tSorted }
  }, [sessionIdentifiers, templateIdentifiers])

  const handleMergeDocuments = async () => {
    if (!selectedSessionId || !selectedTemplateId) {
      toast('Please select both a document session and a template', 'warning')
      return
    }

    try {
      setLoadingIdentifiers(true)
      
      // First, generate and save the document to the database
      const generateResponse = await fetch(`/api/v1/documents/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          session_id: selectedSessionId,
          template_id: selectedTemplateId,
          document_name: `Document ${new Date().toLocaleDateString()}`
        })
      })

      if (!generateResponse.ok) {
        const errorData = await generateResponse.json()
        throw new Error(errorData.detail || 'Failed to generate document')
      }

      // Then, download the Word document
      const mergeResponse = await fetch(`/api/v1/documents/merge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          session_id: selectedSessionId,
          template_id: selectedTemplateId
        })
      })

      if (!mergeResponse.ok) {
        const errorData = await mergeResponse.json()
        throw new Error(errorData.detail || 'Failed to merge documents')
      }

      const blob = await mergeResponse.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `merged_document_${selectedSessionId}_${selectedTemplateId}.docx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast('Document generated and downloaded successfully!', 'success')
    } catch (err: any) {
      toast(err.message || 'Failed to merge documents')
    } finally {
      setLoadingIdentifiers(false)
    }
  }

  return (
    <MergeContainer>
      <MergeWrapper>
        <MergeHeader>
          <MergeTitle>Merge Documents</MergeTitle>
          <MergeBtn
            onClick={handleMergeDocuments}
            disabled={!selectedSessionId || !selectedTemplateId || loadingIdentifiers}
            $disabled={!selectedSessionId || !selectedTemplateId}
          >
            Merge Documents
          </MergeBtn>
        </MergeHeader>

        {loading && <StateMessage>Loading...</StateMessage>}

        {error && <StateMessage $variant="error">{error}</StateMessage>}

        {!loading && !error && (
          <MergeContent>
            <ListBoxContainer>
              <ListBox>
                <ListBoxHeader>
                  <ListBoxTitle
                    onClick={() => navigate('/document')}
                    title="Go to Input Forms"
                  >
                    Input Form
                  </ListBoxTitle>
                  <ListBoxCount>{sessions.length}</ListBoxCount>
                </ListBoxHeader>
                <ListBoxContent>
                  {sessions.length === 0 ? (
                    <EmptyList>No sessions found</EmptyList>
                  ) : (
                    <ItemList>
                      {sessions.map((session) => (
                        <Item key={session.id}>
                          <ItemRadio>
                            <input
                              type="radio"
                              name="session"
                              checked={selectedSessionId === session.id}
                              onChange={() => handleSessionRadioChange(session.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </ItemRadio>
                          <ItemContent>
                            <ItemHeader>
                              <ItemNameLink
                                onClick={(e) => { e.stopPropagation(); navigate(`/document?session=${session.id}`) }}
                                title="Open input form"
                              >{session.client_identifier}</ItemNameLink>
                              {session.is_completed && (
                                <StatusBadge $status="completed">Completed</StatusBadge>
                              )}
                              {!session.is_completed && (
                                <StatusBadge $status="in-progress">In Progress</StatusBadge>
                              )}
                            </ItemHeader>
                            {session.current_group_name && (
                              <div style={{ fontSize: '0.75rem', marginTop: '-4px' }}>
                                <span
                                  style={{ color: '#3b82f6', cursor: session.current_group_id ? 'pointer' : 'default', textDecoration: 'none' }}
                                  onMouseEnter={(e) => { if (session.current_group_id) (e.target as HTMLElement).style.textDecoration = 'underline' }}
                                  onMouseLeave={(e) => { (e.target as HTMLElement).style.textDecoration = 'none' }}
                                  onClick={(e) => { if (session.current_group_id) { e.stopPropagation(); navigate(`/admin/question-groups/${session.current_group_id}/edit`) } }}
                                  title={session.current_group_id ? 'Edit question group' : undefined}
                                >{session.current_group_name}</span>
                              </div>
                            )}
                            <ItemMeta>
                              <ItemDate>
                                Created: {new Date(session.created_at).toLocaleDateString()}
                              </ItemDate>
                            </ItemMeta>
                          </ItemContent>
                        </Item>
                      ))}
                    </ItemList>
                  )}
                </ListBoxContent>
              </ListBox>

              <ListBox>
                <ListBoxHeader>
                  <ListBoxTitle
                    onClick={() => navigate('/admin/templates')}
                    title="Go to Templates"
                  >
                    Templates
                  </ListBoxTitle>
                  <ListBoxCount>{templates.length}</ListBoxCount>
                </ListBoxHeader>
                <ListBoxContent>
                  {templates.length === 0 ? (
                    <EmptyList>No templates found</EmptyList>
                  ) : (
                    <ItemList>
                      {templates.map((template) => (
                        <Item key={template.id}>
                          <ItemRadio>
                            <input
                              type="radio"
                              name="template"
                              checked={selectedTemplateId === template.id}
                              onChange={() => handleTemplateRadioChange(template.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </ItemRadio>
                          <ItemContent>
                            <ItemHeader>
                              <ItemNameLink
                                onClick={(e) => { e.stopPropagation(); navigate(`/admin/templates/${template.id}/edit`) }}
                                title="Open template"
                              >{template.name}</ItemNameLink>
                              {template.is_active && (
                                <StatusBadge $status="completed">Active</StatusBadge>
                              )}
                              {!template.is_active && (
                                <StatusBadge $status="in-progress">Inactive</StatusBadge>
                              )}
                            </ItemHeader>
                            <ItemMeta>
                              <ItemDate>
                                Created: {new Date(template.created_at).toLocaleDateString()}
                              </ItemDate>
                            </ItemMeta>
                          </ItemContent>
                        </Item>
                      ))}
                    </ItemList>
                  )}
                </ListBoxContent>
              </ListBox>
            </ListBoxContainer>

            {(selectedSessionId || selectedTemplateId) && (
              <IdentifiersSection>
                <IdentifiersTitle>Identifiers</IdentifiersTitle>
                {loadingIdentifiers ? (
                  <StateMessage>Loading identifiers...</StateMessage>
                ) : (
                  <IdentifiersColumns>
                    <IdentifiersColumn>
                      <ColumnTitle>Input Form Identifiers</ColumnTitle>
                      {sessionIdentifiers.length === 0 ? (
                        <EmptyList>No session selected or no identifiers found</EmptyList>
                      ) : (
                        <IdentifierItems>
                          {sessionSorted.map((identifier, index) => {
                            const stripSubscript = (id: string): string => id.replace(/\[\d+\]$/, '')
                            const isMissing = identifier !== null && !templateIdentifiers.some(tid => 
                              stripSubscript(identifier) === stripSubscript(tid)
                            )
                            return (
                              <IdentifierItem
                                key={identifier || `placeholder-${index}`}
                                $placeholder={identifier === null}
                                $missing={isMissing}
                              >
                                {identifier ? stripSubscript(identifier) : '\u00A0'}
                              </IdentifierItem>
                            )
                          })}
                        </IdentifierItems>
                      )}
                    </IdentifiersColumn>
                    <IdentifiersColumn>
                      <ColumnTitle>Template Identifiers</ColumnTitle>
                      {templateIdentifiers.length === 0 ? (
                        <EmptyList>No template selected or no identifiers found</EmptyList>
                      ) : (
                        <IdentifierItems>
                          {templateSorted.map((identifier, index) => {
                            const stripSubscript = (id: string): string => id.replace(/\[\d+\]$/, '')
                            const isMissing = identifier !== null && !sessionIdentifiers.some(sid => 
                              stripSubscript(identifier) === stripSubscript(sid)
                            )
                            return (
                              <IdentifierItem
                                key={identifier || `placeholder-${index}`}
                                $placeholder={identifier === null}
                                $missing={isMissing}
                              >
                                {identifier ? stripSubscript(identifier) : '\u00A0'}
                              </IdentifierItem>
                            )
                          })}
                        </IdentifierItems>
                      )}
                    </IdentifiersColumn>
                  </IdentifiersColumns>
                )}
              </IdentifiersSection>
            )}
          </MergeContent>
        )}
      </MergeWrapper>
    </MergeContainer>
  )
}

export default MergeDocuments
