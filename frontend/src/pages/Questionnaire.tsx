import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { sessionService } from '../services/sessionService'
import { QuestionnaireSession, SessionQuestionsResponse, QuestionToDisplay } from '../types/session'
import { Person } from '../types/person'
import { personService } from '../services/personService'
import PersonFormModal from '../components/common/PersonFormModal'
import './Questionnaire.css'

const QUESTIONS_PER_PAGE = 5

const Questionnaire: React.FC = () => {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session')
  const navigate = useNavigate()

  // Session list state
  const [sessions, setSessions] = useState<QuestionnaireSession[]>([])

  // Current session questionnaire state
  const [sessionData, setSessionData] = useState<SessionQuestionsResponse | null>(null)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [personAnswers, setPersonAnswers] = useState<Record<number, string[]>>({}) // For multiple person fields
  const [currentPage, setCurrentPage] = useState(1)

  // UI state
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCompleted, setIsCompleted] = useState(false)

  // Modal state for person-type questions
  const [personModalForQuestion, setPersonModalForQuestion] = useState<number | null>(null)

  // Person search state for person type questions
  const [personSuggestions, setPersonSuggestions] = useState<Record<number, Person[]>>({})
  const personSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Ref for debouncing answer changes that might affect conditionals
  const conditionalRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Ref for debouncing person answer saves
  const personAnswerSaveTimeoutRef = useRef<Record<number, NodeJS.Timeout | null>>({})

  useEffect(() => {
    if (sessionId) {
      loadSessionQuestions(parseInt(sessionId), 1)
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

  const loadSessionQuestions = async (id: number, page: number) => {
    try {
      setLoading(true)
      setError(null)
      const data = await sessionService.getSessionQuestions(id, page, QUESTIONS_PER_PAGE)
      setSessionData(data)
      setCurrentPage(page)
      setIsCompleted(data.is_completed)

      // Pre-fill answers from existing_answers
      const initialAnswers: Record<number, string> = {}
      const initialPersonAnswers: Record<number, string[]> = {}

      data.questions.forEach(q => {
        if (data.existing_answers[q.id]) {
          if (q.question_type === 'person') {
            // Person answers might be JSON array
            try {
              const parsed = JSON.parse(data.existing_answers[q.id])
              if (Array.isArray(parsed)) {
                initialPersonAnswers[q.id] = parsed
              } else {
                initialPersonAnswers[q.id] = [data.existing_answers[q.id]]
              }
            } catch {
              initialPersonAnswers[q.id] = [data.existing_answers[q.id]]
            }
          } else {
            initialAnswers[q.id] = data.existing_answers[q.id]
          }
        } else if (q.question_type === 'person') {
          initialPersonAnswers[q.id] = ['']
        }
      })

      setAnswers(initialAnswers)
      setPersonAnswers(initialPersonAnswers)
    } catch (err: any) {
      if (err.response?.status === 400 && err.response?.data?.detail === 'Session is already completed') {
        setIsCompleted(true)
        // Load session info for completion screen
        const session = await sessionService.getSession(id)
        setSessionData({
          session_id: session.id,
          client_identifier: session.client_identifier,
          flow_id: null,
          flow_name: null,
          current_group_id: 0,
          current_group_name: '',
          current_group_index: 0,
          total_groups: 0,
          questions: [],
          current_page: 1,
          total_pages: 1,
          questions_per_page: QUESTIONS_PER_PAGE,
          is_completed: true,
          is_last_group: true,
          can_go_back: false,
          existing_answers: {}
        })
      } else {
        setError(err.response?.data?.detail || 'Failed to load session')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleAnswerChange = (questionId: number, value: string) => {
    const previousValue = answers[questionId]

    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }))

    // If the value actually changed, check if we need to refresh for conditionals
    if (previousValue !== value && sessionData) {
      // Find the question to get its identifier
      const question = sessionData.questions.find(q => q.id === questionId)
      if (question) {
        // Debounce the save and refresh to avoid too many API calls
        if (conditionalRefreshTimeoutRef.current) {
          clearTimeout(conditionalRefreshTimeoutRef.current)
        }

        conditionalRefreshTimeoutRef.current = setTimeout(async () => {
          try {
            // Save the answer to the database
            await sessionService.saveAnswers(sessionData.session_id, {
              answers: [{ question_id: questionId, answer_value: value }]
            })

            // Refresh questions to re-evaluate conditionals
            // Don't show loading state to avoid UI flicker
            const data = await sessionService.getSessionQuestions(
              sessionData.session_id,
              currentPage,
              QUESTIONS_PER_PAGE
            )

            // Update session data with new questions
            setSessionData(data)

            // Use functional updates to get current state and merge with new data
            setAnswers(currentAnswers => {
              const newAnswers: Record<number, string> = { ...currentAnswers, [questionId]: value }

              data.questions.forEach(q => {
                // Only set from existing_answers if we don't have a local answer
                if (!(q.id in newAnswers) && data.existing_answers[q.id] && q.question_type !== 'person') {
                  newAnswers[q.id] = data.existing_answers[q.id]
                }
              })

              return newAnswers
            })

            setPersonAnswers(currentPersonAnswers => {
              const newPersonAnswers: Record<number, string[]> = { ...currentPersonAnswers }

              data.questions.forEach(q => {
                if (q.question_type === 'person') {
                  if (!(q.id in newPersonAnswers) && data.existing_answers[q.id]) {
                    try {
                      const parsed = JSON.parse(data.existing_answers[q.id])
                      if (Array.isArray(parsed)) {
                        newPersonAnswers[q.id] = parsed
                      } else {
                        newPersonAnswers[q.id] = [data.existing_answers[q.id]]
                      }
                    } catch {
                      newPersonAnswers[q.id] = [data.existing_answers[q.id]]
                    }
                  } else if (!(q.id in newPersonAnswers)) {
                    newPersonAnswers[q.id] = ['']
                  }
                }
              })

              return newPersonAnswers
            })
          } catch (err) {
            console.error('Failed to refresh questions after answer change:', err)
          }
        }, 500) // 500ms debounce
      }
    }
  }

  const savePersonAnswer = (questionId: number, values: string[]) => {
    if (!sessionData) return

    // Clear existing timeout for this question
    if (personAnswerSaveTimeoutRef.current[questionId]) {
      clearTimeout(personAnswerSaveTimeoutRef.current[questionId]!)
    }

    // Debounce the save
    personAnswerSaveTimeoutRef.current[questionId] = setTimeout(async () => {
      try {
        // Filter out empty values and save as JSON array
        const filteredValues = values.filter(v => v.trim() !== '')
        const answerValue = JSON.stringify(filteredValues)

        await sessionService.saveAnswers(sessionData.session_id, {
          answers: [{ question_id: questionId, answer_value: answerValue }]
        })
      } catch (err) {
        console.error('Failed to save person answer:', err)
      }
    }, 500)
  }

  const handlePersonAnswerChange = (questionId: number, index: number, value: string) => {
    setPersonAnswers(prev => {
      const current = prev[questionId] || ['']
      const updated = [...current]
      updated[index] = value

      // Trigger save
      savePersonAnswer(questionId, updated)

      return { ...prev, [questionId]: updated }
    })
  }

  const addPersonField = (questionId: number) => {
    setPersonAnswers(prev => {
      const current = prev[questionId] || ['']
      const updated = [...current, '']
      return { ...prev, [questionId]: updated }
    })
  }

  const removePersonField = (questionId: number, index: number) => {
    setPersonAnswers(prev => {
      const current = prev[questionId] || ['']
      if (current.length <= 1) return prev
      const updated = current.filter((_, i) => i !== index)

      // Trigger save after removal
      savePersonAnswer(questionId, updated)

      return { ...prev, [questionId]: updated }
    })
  }

  const searchPeople = async (questionId: number, searchTerm: string) => {
    if (personSearchTimeoutRef.current) {
      clearTimeout(personSearchTimeoutRef.current)
    }

    if (searchTerm.length < 2) {
      setPersonSuggestions(prev => ({ ...prev, [questionId]: [] }))
      return
    }

    personSearchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await personService.getPeople(1, 20, false, searchTerm)
        setPersonSuggestions(prev => ({ ...prev, [questionId]: response.people }))
      } catch (err) {
        console.error('Failed to search people:', err)
      }
    }, 300)
  }

  const saveCurrentAnswers = async () => {
    if (!sessionData) return

    const answerArray = Object.entries(answers).map(([questionId, answerValue]) => ({
      question_id: parseInt(questionId),
      answer_value: answerValue
    }))

    // Add person answers (as JSON arrays)
    Object.entries(personAnswers).forEach(([questionId, values]) => {
      const filteredValues = values.filter(v => v.trim() !== '')
      if (filteredValues.length > 0) {
        answerArray.push({
          question_id: parseInt(questionId),
          answer_value: JSON.stringify(filteredValues)
        })
      }
    })

    if (answerArray.length > 0) {
      await sessionService.saveAnswers(sessionData.session_id, { answers: answerArray })
    }
  }

  const handleNavigate = async (direction: 'forward' | 'backward') => {
    if (!sessionData) return

    // Validate required questions on forward navigation
    if (direction === 'forward') {
      const requiredQuestions = sessionData.questions.filter(q => q.is_required)
      const missingAnswers = requiredQuestions.filter(q => {
        if (q.question_type === 'person') {
          const personVals = personAnswers[q.id] || ['']
          return !personVals.some(v => v.trim() !== '')
        }
        return !answers[q.id] || answers[q.id].trim() === ''
      })

      if (missingAnswers.length > 0) {
        alert('Please answer all required questions')
        return
      }
    }

    try {
      setSubmitting(true)

      // Build answer array
      const answerArray = Object.entries(answers).map(([questionId, answerValue]) => ({
        question_id: parseInt(questionId),
        answer_value: answerValue
      }))

      // Add person answers
      Object.entries(personAnswers).forEach(([questionId, values]) => {
        const filteredValues = values.filter(v => v.trim() !== '')
        if (filteredValues.length > 0) {
          answerArray.push({
            question_id: parseInt(questionId),
            answer_value: JSON.stringify(filteredValues)
          })
        }
      })

      // Check if we're navigating within pages or between groups
      if (direction === 'forward' && currentPage < sessionData.total_pages) {
        // Save and go to next page within same group
        await saveCurrentAnswers()
        await loadSessionQuestions(sessionData.session_id, currentPage + 1)
      } else if (direction === 'backward' && currentPage > 1) {
        // Save and go to previous page within same group
        await saveCurrentAnswers()
        await loadSessionQuestions(sessionData.session_id, currentPage - 1)
      } else {
        // Navigate between groups
        const result = await sessionService.navigate(sessionData.session_id, {
          direction,
          answers: answerArray
        })

        if (result.is_completed) {
          setIsCompleted(true)
        } else {
          // Reload questions for new group
          await loadSessionQuestions(sessionData.session_id, 1)
        }
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to navigate')
    } finally {
      setSubmitting(false)
    }
  }

  const renderQuestion = (question: QuestionToDisplay) => {
    const value = answers[question.id] || ''

    switch (question.question_type) {
      case 'multiple_choice':
        return (
          <div className="radio-group">
            {question.options?.map((option, index) => {
              // Use label as value if value is empty
              const optionValue = option.value || option.label
              return (
                <div key={index} className="radio-option">
                  <input
                    type="radio"
                    id={`q${question.id}-${index}`}
                    name={`question-${question.id}`}
                    value={optionValue}
                    checked={value === optionValue}
                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                  />
                  <label htmlFor={`q${question.id}-${index}`}>{option.label}</label>
                </div>
              )
            })}
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

      case 'date':
        return (
          <input
            type={question.include_time ? 'datetime-local' : 'date'}
            className="question-input"
            value={value}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
          />
        )

      case 'person':
        const personValues = personAnswers[question.id] || ['']
        const suggestions = personSuggestions[question.id] || []

        return (
          <div className="person-field-container">
            {personValues.map((personValue, index) => (
              <div key={index} className="person-field-row">
                <div className="person-input-wrapper">
                  <input
                    type="text"
                    className="question-input"
                    value={personValue}
                    onChange={(e) => {
                      handlePersonAnswerChange(question.id, index, e.target.value)
                      searchPeople(question.id, e.target.value)
                    }}
                    list={`person-list-${question.id}-${index}`}
                    placeholder="Type to search people..."
                  />
                  <datalist id={`person-list-${question.id}-${index}`}>
                    {suggestions.map((person) => (
                      <option key={person.id} value={person.name} />
                    ))}
                  </datalist>
                </div>

                {index === personValues.length - 1 && (
                  <button
                    type="button"
                    onClick={() => addPersonField(question.id)}
                    className="person-add-btn"
                    title="Add another person"
                  >
                    +
                  </button>
                )}

                {personValues.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePersonField(question.id, index)}
                    className="person-remove-btn"
                    title="Remove this person"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={() => setPersonModalForQuestion(question.id)}
              className="add-new-person-btn"
            >
              + Add New Person
            </button>
          </div>
        )

      case 'dropdown':
      case 'database_dropdown':
        return (
          <select
            className="question-select"
            value={value}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
          >
            <option value="">Select an option...</option>
            {question.options?.map((option, index) => (
              <option key={index} value={option.value}>{option.label}</option>
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
        <div className="questionnaire-wrapper">
          <div className="questionnaire-header">
            <div>
              <h1 className="questionnaire-title">Documents</h1>
              <p className="questionnaire-subtitle">Start a new document or continue an existing one</p>
            </div>
            <button
              onClick={() => navigate('/document/new')}
              className="btn btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: '#2563eb',
                color: 'white',
                fontWeight: 600,
                fontSize: '0.875rem',
                padding: '0.625rem 1.25rem',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer'
              }}
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '1rem', height: '1rem' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Document
            </button>
          </div>

          <div className="session-list" style={{ background: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', padding: '1rem' }}>
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
                      <div className="session-name">{session.client_identifier}</div>
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
    )
  }

  // Show completion screen
  if (isCompleted && sessionData) {
    return (
      <div className="questionnaire-container">
        <div className="questionnaire-content">
          <div className="questionnaire-card completion-card">
            <div className="completion-icon">✅</div>
            <h1 className="completion-title">Questionnaire Complete!</h1>
            <p className="completion-message">
              You have successfully completed the questionnaire for {sessionData.client_identifier}.
            </p>
            <button
              onClick={() => navigate('/document')}
              className="btn btn-primary"
            >
              Back to Documents
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
              {sessionData?.client_identifier}
            </h1>
            {sessionData?.flow_name && (
              <p className="questionnaire-subtitle">{sessionData.flow_name}</p>
            )}
          </div>

          {sessionData && sessionData.questions.length > 0 && (
            <div>
              <div className="group-header">
                <h2 className="group-name">{sessionData.current_group_name}</h2>
                <div className="progress-info">
                  <span>Group {sessionData.current_group_index + 1} of {sessionData.total_groups}</span>
                  {sessionData.total_pages > 1 && (
                    <span> • Page {sessionData.current_page} of {sessionData.total_pages}</span>
                  )}
                </div>
              </div>

              <div className="question-list">
                {sessionData.questions.map(question => (
                  <div key={question.id} className="question-item">
                    <label className="question-label">
                      {question.question_text}
                      {question.is_required && <span className="required-indicator">*</span>}
                    </label>
                    {question.help_text && (
                      <p className="question-help">{question.help_text}</p>
                    )}
                    {renderQuestion(question)}
                  </div>
                ))}
              </div>

              <div className="action-buttons">
                <div className="nav-buttons">
                  {sessionData.can_go_back && (
                    <button
                      type="button"
                      onClick={() => handleNavigate('backward')}
                      disabled={submitting}
                      className="btn btn-secondary"
                    >
                      ← Back
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleNavigate('forward')}
                    disabled={submitting}
                    className="btn btn-primary"
                  >
                    {submitting ? 'Saving...' : (
                      sessionData.is_last_group && currentPage >= sessionData.total_pages
                        ? 'Exit'
                        : 'Next →'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Person modal for adding new person from question */}
      <PersonFormModal
        isOpen={personModalForQuestion !== null}
        onClose={() => setPersonModalForQuestion(null)}
        onSave={(person: Person) => {
          if (personModalForQuestion !== null) {
            // Add the new person to the last empty field or create a new one
            setPersonAnswers(prev => {
              const current = prev[personModalForQuestion] || ['']
              const lastIndex = current.length - 1
              if (current[lastIndex] === '') {
                const updated = [...current]
                updated[lastIndex] = person.name
                return { ...prev, [personModalForQuestion]: updated }
              } else {
                return { ...prev, [personModalForQuestion]: [...current, person.name] }
              }
            })
          }
          setPersonModalForQuestion(null)
        }}
      />
    </div>
  )
}

export default Questionnaire
