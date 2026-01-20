import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { sessionService } from '../services/sessionService'
import { SessionProgress, QuestionnaireSession } from '../types/session'
import PersonTypeahead from '../components/common/PersonTypeahead'
import './Questionnaire.css'

const Questionnaire: React.FC = () => {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session')
  const navigate = useNavigate()

  const [sessions, setSessions] = useState<QuestionnaireSession[]>([])
  const [currentSession, setCurrentSession] = useState<SessionProgress | null>(null)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [documentFor, setDocumentFor] = useState('')
  const [documentName, setDocumentName] = useState('')

  useEffect(() => {
    if (sessionId) {
      loadSession(parseInt(sessionId))
    } else {
      loadSessions()
    }
  }, [sessionId])

  const loadSessions = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await sessionService.getSessions()
      setSessions(data)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }

  const loadSession = async (id: number) => {
    try {
      setLoading(true)
      setError(null)
      const progress = await sessionService.getSessionProgress(id)
      setCurrentSession(progress)

      // Pre-fill answers if returning to a group
      const initialAnswers: Record<number, string> = {}
      if (progress.current_group) {
        progress.current_group.questions.forEach(q => {
          const existingAnswer = progress.session.id // Would need to fetch answers
          // For now, start fresh
        })
      }
      setAnswers(initialAnswers)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load session')
    } finally {
      setLoading(false)
    }
  }

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
      setDocumentFor('')
      setDocumentName('')
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create session')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAnswerChange = (questionId: number, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentSession || !currentSession.current_group) {
      return
    }

    // Validate required questions
    const requiredQuestions = currentSession.current_group.questions.filter(q => q.is_required)
    const missingAnswers = requiredQuestions.filter(q => !answers[q.id] || answers[q.id].trim() === '')

    if (missingAnswers.length > 0) {
      alert('Please answer all required questions')
      return
    }

    try {
      setSubmitting(true)
      const answerArray = Object.entries(answers).map(([questionId, answerValue]) => ({
        question_id: parseInt(questionId),
        answer_value: answerValue
      }))

      await sessionService.submitAnswers(currentSession.session.id, {
        answers: answerArray
      })

      // Reload session to get next group
      await loadSession(currentSession.session.id)
      setAnswers({}) // Clear answers for next group
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to submit answers')
    } finally {
      setSubmitting(false)
    }
  }

  const renderQuestion = (question: any) => {
    const value = answers[question.id] || ''

    switch (question.question_type) {
      case 'multiple_choice':
        return (
          <div className="radio-group">
            {question.options?.choices?.map((choice: string, index: number) => (
              <div key={index} className="radio-option">
                <input
                  type="radio"
                  id={`q${question.id}-${index}`}
                  name={`question-${question.id}`}
                  value={choice}
                  checked={value === choice}
                  onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                />
                <label htmlFor={`q${question.id}-${index}`}>{choice}</label>
              </div>
            ))}
          </div>
        )

      case 'free_text':
        return (
          <textarea
            className="question-textarea"
            value={value}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            placeholder="Enter your answer..."
          />
        )

      case 'database_dropdown':
        return (
          <select
            className="question-select"
            value={value}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
          >
            <option value="">Select an option...</option>
            {question.options?.table_values?.map((val: string, index: number) => (
              <option key={index} value={val}>{val}</option>
            ))}
          </select>
        )

      default:
        return (
          <input
            type="text"
            className="question-input"
            value={value}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            placeholder="Enter your answer..."
          />
        )
    }
  }

  if (loading) {
    return (
      <div className="questionnaire-container">
        <div className="loading-state">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="questionnaire-container">
        <div className="error-state">{error}</div>
      </div>
    )
  }

  // Show session list if no active session
  if (!sessionId) {
    return (
      <div className="questionnaire-container">
        <div className="questionnaire-content">
          <div className="questionnaire-card">
            <div className="questionnaire-header">
              <h1 className="questionnaire-title">Documents</h1>
              <p className="questionnaire-subtitle">Start a new document or continue an existing one</p>
            </div>

            <form onSubmit={handleCreateSession} className="new-session-form" style={{ marginBottom: '2rem' }}>
              <div className="form-group">
                <label className="form-label">Document For</label>
                <PersonTypeahead
                  value={documentFor}
                  onChange={(value) => setDocumentFor(value)}
                  placeholder="Enter client name"
                  className="form-input"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Document Name</label>
                <input
                  type="text"
                  value={documentName}
                  onChange={(e) => setDocumentName(e.target.value)}
                  placeholder="Enter document name"
                  className="form-input"
                  required
                />
              </div>
              <button type="submit" disabled={submitting || !documentFor.trim() || !documentName.trim()} className="btn btn-primary">
                {submitting ? 'Creating...' : 'Create Document'}
              </button>
            </form>

            <div className="session-list">
              {sessions.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#6b7280' }}>
                  No documents yet. Start a new one to get started.
                </p>
              ) : (
                sessions.map(session => (
                  <div
                    key={session.id}
                    className="session-card"
                    onClick={() => navigate(`/document?session=${session.id}`)}
                  >
                    <div className="session-card-header">
                      <div className="session-client">{session.client_identifier}</div>
                      <span className={`session-status ${session.is_completed ? 'status-completed' : 'status-in-progress'}`}>
                        {session.is_completed ? 'Completed' : 'In Progress'}
                      </span>
                    </div>
                    <div className="session-date">
                      Started: {new Date(session.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show completion screen
  if (currentSession?.is_completed) {
    return (
      <div className="questionnaire-container">
        <div className="questionnaire-content">
          <div className="questionnaire-card completion-card">
            <div className="completion-icon">✅</div>
            <h1 className="completion-title">Questionnaire Complete!</h1>
            <p className="completion-message">
              You have successfully completed the questionnaire for {currentSession.session.client_identifier}.
            </p>
            <button
              onClick={() => navigate('/document')}
              className="btn btn-primary"
            >
              Back to Questionnaires
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Show current question group
  return (
    <div className="questionnaire-container">
      <div className="questionnaire-content">
        <div className="questionnaire-card">
          <div className="questionnaire-header">
            <h1 className="questionnaire-title">
              {currentSession?.session.client_identifier}
            </h1>
            <p className="questionnaire-subtitle">Complete the questionnaire</p>
          </div>

          {currentSession?.current_group && (
            <form onSubmit={handleSubmit}>
              <div className="group-header">
                <h2 className="group-name">{currentSession.current_group.name}</h2>
                {currentSession.current_group.description && (
                  <p className="group-description">{currentSession.current_group.description}</p>
                )}
              </div>

              <div className="question-list">
                {currentSession.current_group.questions.map(question => (
                  <div key={question.id} className="question-item">
                    <label className="question-label">
                      {question.question_text}
                      {question.is_required && <span className="required-indicator">*</span>}
                    </label>
                    {renderQuestion(question)}
                  </div>
                ))}
              </div>

              <div className="action-buttons">
                <button
                  type="button"
                  onClick={() => navigate('/document')}
                  className="btn btn-secondary"
                >
                  Save & Exit
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                >
                  {submitting ? 'Submitting...' : 'Continue'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default Questionnaire
