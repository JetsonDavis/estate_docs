import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { sessionService } from '../services/sessionService'
import { questionGroupService } from '../services/questionService'
import { Person } from '../types/person'
import { QuestionGroup } from '../types/question'
import PersonTypeahead from '../components/common/PersonTypeahead'
import PersonFormModal from '../components/common/PersonFormModal'
import './DocumentSessions.css'

const DocumentNew: React.FC = () => {
  const navigate = useNavigate()

  // Form state
  const [documentFor, setDocumentFor] = useState('')
  const [documentName, setDocumentName] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
  const [questionGroups, setQuestionGroups] = useState<QuestionGroup[]>([])
  const [loadingGroups, setLoadingGroups] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showNewPersonModal, setShowNewPersonModal] = useState(false)

  // Fetch question groups on mount
  useEffect(() => {
    const fetchQuestionGroups = async () => {
      try {
        setLoadingGroups(true)
        const response = await questionGroupService.listQuestionGroups(1, 100, false)
        setQuestionGroups(response.question_groups)
        // Pre-select the first group if available
        if (response.question_groups.length > 0) {
          setSelectedGroupId(response.question_groups[0].id)
        }
      } catch (err) {
        console.error('Failed to fetch question groups:', err)
      } finally {
        setLoadingGroups(false)
      }
    }
    fetchQuestionGroups()
  }, [])

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!documentFor.trim() || !documentName.trim() || !selectedGroupId) {
      alert('Please fill in all fields')
      return
    }

    try {
      setSubmitting(true)
      const session = await sessionService.createSession({
        client_identifier: `${documentFor} - ${documentName}`,
        starting_group_id: selectedGroupId
      })
      navigate(`/document?session=${session.id}`)
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create session')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="document-sessions-container">
      <div className="document-sessions-content">
        <div className="document-sessions-card">
          <div className="document-sessions-header">
            <h1 className="document-sessions-title">New Document</h1>
            <p className="document-sessions-subtitle">Create a new document</p>
          </div>

          <form onSubmit={handleCreateSession} className="new-session-form">
            <div className="form-group">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <label className="form-label" style={{ margin: 0 }}>Document For:</label>
                <button
                  type="button"
                  onClick={() => setShowNewPersonModal(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.25rem 0.75rem',
                    backgroundColor: '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  + New Person
                </button>
              </div>
              <PersonTypeahead
                value={documentFor}
                onChange={(value) => setDocumentFor(value)}
                placeholder="Enter client name"
                className="form-input"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Document Name:</label>
              <input
                type="text"
                value={documentName}
                onChange={(e) => setDocumentName(e.target.value)}
                placeholder="Enter document name"
                className="form-input"
                required
                disabled={!documentFor.trim()}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Question Group:</label>
              {loadingGroups ? (
                <div style={{ padding: '0.5rem', color: '#6b7280' }}>Loading question groups...</div>
              ) : questionGroups.length === 0 ? (
                <div style={{ padding: '0.5rem', color: '#ef4444' }}>No question groups available</div>
              ) : (
                <select
                  value={selectedGroupId || ''}
                  onChange={(e) => setSelectedGroupId(Number(e.target.value))}
                  className="form-input"
                  required
                  disabled={!documentFor.trim()}
                >
                  <option value="">Select a question group</option>
                  {questionGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name} {group.description ? `- ${group.description}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <button type="submit" disabled={submitting || !documentFor.trim() || !documentName.trim() || !selectedGroupId} className="btn btn-primary">
              {submitting ? 'Creating...' : 'Create Document'}
            </button>
          </form>
        </div>
      </div>

      <PersonFormModal
        isOpen={showNewPersonModal}
        onClose={() => setShowNewPersonModal(false)}
        onSave={(person: Person) => {
          setDocumentFor(person.name)
        }}
      />
    </div>
  )
}

export default DocumentNew
