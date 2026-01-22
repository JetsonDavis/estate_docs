import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { sessionService } from '../services/sessionService'
import { templateService } from '../services/templateService'
import { DocumentSession } from '../types/session'
import { Template } from '../types/template'
import './MergeDocuments.css'

const MergeDocuments: React.FC = () => {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<DocumentSession[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null)
  const [sessionIdentifiers, setSessionIdentifiers] = useState<string[]>([])
  const [templateIdentifiers, setTemplateIdentifiers] = useState<string[]>([])
  const [loadingIdentifiers, setLoadingIdentifiers] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

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
      setSessionIdentifiers(identifiers)
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
        setTemplateIdentifiers(template.identifiers.split(',').map(id => id.trim()))
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

  const handleSessionClick = (sessionId: number) => {
    navigate(`/document?session=${sessionId}`)
  }

  const handleTemplateClick = (templateId: number) => {
    navigate(`/admin/templates?template=${templateId}`)
  }

  const handleSessionRadioChange = (sessionId: number) => {
    setSelectedSessionId(sessionId)
  }

  const handleTemplateRadioChange = (templateId: number) => {
    setSelectedTemplateId(templateId)
  }

  const getAllIdentifiers = () => {
    return Array.from(new Set([...sessionIdentifiers, ...templateIdentifiers])).sort()
  }

  const isIdentifierInBoth = (identifier: string) => {
    return sessionIdentifiers.includes(identifier) && templateIdentifiers.includes(identifier)
  }

  return (
    <div className="merge-documents-container">
      <div className="merge-documents-wrapper">
        <div className="merge-documents-header">
          <h1 className="merge-documents-title">Merge Documents</h1>
        </div>

        {loading && <div className="loading-state">Loading...</div>}

        {error && <div className="error-state">{error}</div>}

        {!loading && !error && (
          <div className="merge-documents-content">
            <div className="list-box-container">
              <div className="list-box">
                <div className="list-box-header">
                  <h2 className="list-box-title">Document Sessions</h2>
                  <span className="list-box-count">{sessions.length}</span>
                </div>
                <div className="list-box-content">
                  {sessions.length === 0 ? (
                    <div className="empty-list">No sessions found</div>
                  ) : (
                    <ul className="item-list">
                      {sessions.map((session) => (
                        <li
                          key={session.id}
                          className="item"
                        >
                          <div className="item-radio">
                            <input
                              type="radio"
                              name="session"
                              checked={selectedSessionId === session.id}
                              onChange={() => handleSessionRadioChange(session.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <div className="item-content" onClick={() => handleSessionClick(session.id)}>
                            <div className="item-header">
                              <span className="item-name">{session.client_identifier}</span>
                              {session.is_completed && (
                                <span className="status-badge completed">Completed</span>
                              )}
                              {!session.is_completed && (
                                <span className="status-badge in-progress">In Progress</span>
                              )}
                            </div>
                            <div className="item-meta">
                              <span className="item-date">
                                Created: {new Date(session.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="list-box">
                <div className="list-box-header">
                  <h2 className="list-box-title">Templates</h2>
                  <span className="list-box-count">{templates.length}</span>
                </div>
                <div className="list-box-content">
                  {templates.length === 0 ? (
                    <div className="empty-list">No templates found</div>
                  ) : (
                    <ul className="item-list">
                      {templates.map((template) => (
                        <li
                          key={template.id}
                          className="item"
                        >
                          <div className="item-radio">
                            <input
                              type="radio"
                              name="template"
                              checked={selectedTemplateId === template.id}
                              onChange={() => handleTemplateRadioChange(template.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <div className="item-content" onClick={() => handleTemplateClick(template.id)}>
                            <div className="item-header">
                              <span className="item-name">{template.name}</span>
                              {template.is_active && (
                                <span className="status-badge completed">Active</span>
                              )}
                              {!template.is_active && (
                                <span className="status-badge in-progress">Inactive</span>
                              )}
                            </div>
                            <div className="item-meta">
                              <span className="item-date">
                                Created: {new Date(template.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {(selectedSessionId || selectedTemplateId) && (
              <div className="identifiers-section">
                <h2 className="identifiers-title">Identifiers</h2>
                {loadingIdentifiers ? (
                  <div className="loading-state">Loading identifiers...</div>
                ) : (
                  <div className="identifiers-columns">
                    <div className="identifiers-column">
                      <h3 className="column-title">Document Session Identifiers</h3>
                      {sessionIdentifiers.length === 0 ? (
                        <div className="empty-list">No session selected or no identifiers found</div>
                      ) : (
                        <ul className="identifier-items">
                          {sessionIdentifiers.map((identifier) => (
                            <li
                              key={identifier}
                              className={`identifier-item ${!templateIdentifiers.includes(identifier) ? 'missing' : ''}`}
                            >
                              {identifier}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="identifiers-column">
                      <h3 className="column-title">Template Identifiers</h3>
                      {templateIdentifiers.length === 0 ? (
                        <div className="empty-list">No template selected or no identifiers found</div>
                      ) : (
                        <ul className="identifier-items">
                          {templateIdentifiers.map((identifier) => (
                            <li
                              key={identifier}
                              className={`identifier-item ${!sessionIdentifiers.includes(identifier) ? 'missing' : ''}`}
                            >
                              {identifier}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default MergeDocuments
