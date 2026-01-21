import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sessionService } from '../services/sessionService'
import { Person } from '../types/person'
import PersonTypeahead from '../components/common/PersonTypeahead'
import PersonFormModal from '../components/common/PersonFormModal'
import './Questionnaire.css'

const DocumentNew: React.FC = () => {
  const navigate = useNavigate()

  // Form state
  const [documentFor, setDocumentFor] = useState('')
  const [documentName, setDocumentName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showNewPersonModal, setShowNewPersonModal] = useState(false)

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!documentFor.trim() || !documentName.trim()) {
      alert('Please fill in all fields')
      return
    }

    try {
      setSubmitting(true)
      const session = await sessionService.createSession({
        client_identifier: `${documentFor} - ${documentName}`
      })
      navigate(`/document?session=${session.id}`)
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create session')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="questionnaire-container">
      <div className="questionnaire-content">
        <div className="questionnaire-card">
          <div className="questionnaire-header">
            <h1 className="questionnaire-title">New Document</h1>
            <p className="questionnaire-subtitle">Create a new document</p>
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
            <button type="submit" disabled={submitting || !documentFor.trim() || !documentName.trim()} className="btn btn-primary">
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
