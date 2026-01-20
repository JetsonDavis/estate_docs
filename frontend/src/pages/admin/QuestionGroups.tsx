import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { questionGroupService } from '../../services/questionService'
import { QuestionGroup, QuestionType, QuestionOption } from '../../types/question'
import './QuestionGroups.css'

const QuestionGroups: React.FC = () => {
  const [groups, setGroups] = useState<QuestionGroup[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams()

  const pageSize = 20
  
  // Determine current view
  const isCreateView = location.pathname.includes('/new')
  const isEditView = location.pathname.includes('/edit')
  const isDetailView = id && !isEditView

  useEffect(() => {
    loadGroups()
  }, [page])

  const loadGroups = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await questionGroupService.listQuestionGroups(page, pageSize, true)
      setGroups(response.question_groups)
      setTotal(response.total)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load question groups')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (groupId: number) => {
    if (!confirm('Are you sure you want to delete this question group?')) {
      return
    }

    try {
      await questionGroupService.deleteQuestionGroup(groupId)
      setSuccess('Question group deleted successfully')
      loadGroups()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete question group')
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  // Render create form
  if (isCreateView) {
    return <CreateQuestionGroupForm onCancel={() => navigate('/admin/question-groups')} onSuccess={() => {
      setSuccess('Question group created successfully')
      navigate('/admin/question-groups')
    }} />
  }

  // Render edit form
  if (isEditView && id) {
    return <CreateQuestionGroupForm 
      groupId={parseInt(id)} 
      onCancel={() => navigate('/admin/question-groups')} 
      onSuccess={() => {
        setSuccess('Question group updated successfully')
        navigate('/admin/question-groups')
      }} 
    />
  }

  // Render list view
  return (
    <div className="question-groups-container">
      <div className="question-groups-header">
        <div>
          <h1 className="question-groups-title">Question Groups</h1>
          <p className="question-groups-subtitle">
            Create and manage question groups for questionnaires
          </p>
        </div>
        <button onClick={() => navigate('/admin/question-groups/new')} className="create-button">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="button-icon">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Question Group
        </button>
      </div>

      {error && (
        <div className="alert-container">
          <div className="alert alert-error">
            <span>{error}</span>
            <button onClick={() => setError('')} className="alert-close">&times;</button>
          </div>
        </div>
      )}

      {success && (
        <div className="alert-container">
          <div className="alert alert-success">
            <span>{success}</span>
            <button onClick={() => setSuccess('')} className="alert-close">&times;</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading question groups...</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="empty-state">
          <svg
            className="empty-state-icon"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="empty-state-title">No question groups</h3>
          <p className="empty-state-description">
            Get started by creating a new question group using the button above.
          </p>
        </div>
      ) : (
        <>
          <div className="groups-list">
            {groups.map((group) => (
              <div key={group.id} className="group-item">
                <div className="group-content">
                  <div className="group-info">
                    <div className="group-header">
                      {group.is_active && (
                        <button
                          onClick={() => handleDelete(group.id)}
                          className="trash-icon-button"
                          title="Delete group"
                          style={{ 
                            background: 'none', 
                            border: 'none', 
                            padding: '0.25rem', 
                            cursor: 'pointer',
                            color: '#dc2626',
                            marginRight: '0.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            position: 'relative',
                            top: '-3px'
                          }}
                        >
                          <svg 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24" 
                            style={{ width: '1rem', height: '1rem' }}
                          >
                            <path 
                              strokeLinecap="round" 
                              strokeLinejoin="round" 
                              strokeWidth={2} 
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
                            />
                          </svg>
                        </button>
                      )}
                      <span
                        onClick={() => navigate(`/admin/question-groups/${group.id}/edit`)}
                        style={{ cursor: 'pointer', color: '#2563eb', fontSize: '0.875rem', fontWeight: '400' }}
                      >
                        {group.name}
                      </span>
                      <span className="badge badge-count">
                        {group.question_count} questions
                      </span>
                      {!group.is_active && (
                        <span className="badge badge-inactive">
                          Inactive
                        </span>
                      )}
                    </div>
                    {group.description && (
                      <p className="group-description">{group.description}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <div className="pagination-info">
                Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} groups
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
                  disabled={page === totalPages}
                  className="pagination-button"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

interface CreateQuestionGroupFormProps {
  groupId?: number
  onCancel: () => void
  onSuccess: () => void
}

interface QuestionFormData {
  id: string
  question_text: string
  question_type: QuestionType
  identifier: string
  is_required: boolean
  options: QuestionOption[]
  person_display_mode?: string
  include_time?: boolean
  dbId?: number
  isSaving?: boolean
  lastSaved?: Date
  isDuplicateIdentifier?: boolean
  isCheckingIdentifier?: boolean
}

const CreateQuestionGroupForm: React.FC<CreateQuestionGroupFormProps> = ({ groupId }) => {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [questions, setQuestions] = useState<QuestionFormData[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [openDisplayModeDropdown, setOpenDisplayModeDropdown] = useState<string | null>(null)
  const [isDuplicateName, setIsDuplicateName] = useState(false)
  const [isCheckingName, setIsCheckingName] = useState(false)
  const [groupInfoSaved, setGroupInfoSaved] = useState(false)
  const [savedGroupId, setSavedGroupId] = useState<number | null>(groupId || null)
  const [loading, setLoading] = useState(!!groupId)
  const displayModeDropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})
  const nameCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const autoSaveTimeoutRefs = useRef<{ [key: string]: NodeJS.Timeout | null }>({})
  const identifierCheckTimeoutRefs = useRef<{ [key: string]: NodeJS.Timeout | null }>({})
  const isEditMode = !!groupId

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openDisplayModeDropdown) {
        const ref = displayModeDropdownRefs.current[openDisplayModeDropdown]
        if (ref && !ref.contains(event.target as Node)) {
          setOpenDisplayModeDropdown(null)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openDisplayModeDropdown])

  // Load existing group data when editing
  useEffect(() => {
    if (groupId) {
      const loadGroupData = async () => {
        try {
          setLoading(true)
          const groupData = await questionGroupService.getQuestionGroup(groupId)
          setName(groupData.name)
          setDescription(groupData.description || '')
          setGroupInfoSaved(true)
          setSavedGroupId(groupId)
          
          // Load questions if they exist
          if (groupData.questions && groupData.questions.length > 0) {
            const loadedQuestions: QuestionFormData[] = groupData.questions.map(q => ({
              id: q.id.toString(),
              dbId: q.id,
              question_text: q.question_text,
              question_type: q.question_type,
              identifier: q.identifier,
              is_required: q.is_required,
              options: q.options || [],
              person_display_mode: q.person_display_mode || undefined,
              include_time: q.include_time || false,
              lastSaved: new Date()
            }))
            setQuestions(loadedQuestions)
          }
        } catch (error) {
          console.error('Failed to load group data:', error)
          alert('Failed to load question group data')
        } finally {
          setLoading(false)
        }
      }
      loadGroupData()
    }
  }, [groupId])

  useEffect(() => {
    if (nameCheckTimeoutRef.current) {
      clearTimeout(nameCheckTimeoutRef.current)
    }

    if (name.trim() === '' || groupInfoSaved || isEditMode) {
      setIsDuplicateName(false)
      setIsCheckingName(false)
      return
    }

    setIsCheckingName(true)

    nameCheckTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await questionGroupService.listQuestionGroups(1, 100)
        console.log('Checking name:', name)
        console.log('Existing groups:', response.question_groups.map(g => g.name))
        const duplicate = response.question_groups.some(g => g.name.toLowerCase() === name.toLowerCase())
        console.log('Is duplicate:', duplicate)
        setIsDuplicateName(duplicate)
        setIsCheckingName(false)
      } catch (error: any) {
        console.error('Failed to check name:', error)
        // If authentication fails, assume we can't check duplicates
        // Set to false to allow the user to continue, validation will happen on submit
        setIsDuplicateName(false)
        setIsCheckingName(false)
        if (error.response?.status === 401) {
          console.warn('Authentication required for duplicate checking - will validate on submit')
        }
      }
    }, 500)

    return () => {
      if (nameCheckTimeoutRef.current) {
        clearTimeout(nameCheckTimeoutRef.current)
      }
    }
  }, [name, groupInfoSaved])

  const isNameUnique = name.trim() !== '' && !isDuplicateName
  const canAddQuestion = isNameUnique

  const addQuestion = () => {
    const newQuestion: QuestionFormData = {
      id: Date.now().toString(),
      question_text: '',
      question_type: 'free_text',
      identifier: '',
      is_required: false,
      options: []
    }
    setQuestions([...questions, newQuestion])
  }

  const updateQuestion = (id: string, field: keyof QuestionFormData, value: any) => {
    setQuestions(questions.map(q => {
      if (q.id === id) {
        const updated = { ...q, [field]: value }
        // Trigger identifier uniqueness check if identifier field changed
        if (field === 'identifier') {
          checkIdentifierUniqueness(updated)
        }
        // Trigger auto-save after a delay
        triggerAutoSave(updated)
        return updated
      }
      return q
    }))
  }

  const checkIdentifierUniqueness = (question: QuestionFormData) => {
    // Clear existing timeout for this question
    if (identifierCheckTimeoutRefs.current[question.id]) {
      clearTimeout(identifierCheckTimeoutRefs.current[question.id]!)
    }

    // If identifier is empty, clear any duplicate status
    if (question.identifier.trim() === '') {
      setQuestions(prev => prev.map(q => 
        q.id === question.id ? { ...q, isDuplicateIdentifier: false, isCheckingIdentifier: false } : q
      ))
      return
    }

    // Mark as checking
    setQuestions(prev => prev.map(q => 
      q.id === question.id ? { ...q, isCheckingIdentifier: true } : q
    ))

    // Debounce the check
    identifierCheckTimeoutRefs.current[question.id] = setTimeout(async () => {
      try {
        // First check against other questions in the current form
        const localDuplicate = questions.some(q => 
          q.id !== question.id && 
          q.identifier.toLowerCase() === question.identifier.toLowerCase()
        )

        if (localDuplicate) {
          setQuestions(prev => prev.map(q => 
            q.id === question.id ? { ...q, isDuplicateIdentifier: true, isCheckingIdentifier: false } : q
          ))
          return
        }

        // Then check against all groups in the database
        const response = await questionGroupService.listQuestionGroups(1, 1000, true)
        
        // Fetch each group's details to get questions
        let isDuplicate = false
        for (const group of response.question_groups) {
          try {
            const groupDetail = await questionGroupService.getQuestionGroup(group.id)
            if (groupDetail.questions) {
              const found = groupDetail.questions.some(q => 
                q.identifier.toLowerCase() === question.identifier.toLowerCase() && 
                q.id !== question.dbId
              )
              if (found) {
                isDuplicate = true
                break
              }
            }
          } catch (err) {
            console.error(`Failed to fetch group ${group.id}:`, err)
          }
        }

        setQuestions(prev => prev.map(q => 
          q.id === question.id ? { ...q, isDuplicateIdentifier: isDuplicate, isCheckingIdentifier: false } : q
        ))
      } catch (error) {
        console.error('Failed to check identifier uniqueness:', error)
        setQuestions(prev => prev.map(q => 
          q.id === question.id ? { ...q, isDuplicateIdentifier: false, isCheckingIdentifier: false } : q
        ))
      }
    }, 500)
  }

  const triggerAutoSave = (question: QuestionFormData) => {
    if (!savedGroupId) return
    
    // Clear existing timeout for this question
    if (autoSaveTimeoutRefs.current[question.id]) {
      clearTimeout(autoSaveTimeoutRefs.current[question.id]!)
    }

    // Check if question has minimum required fields
    const hasIdentifier = question.identifier.trim() !== ''
    const hasQuestionText = question.question_text.trim() !== ''

    // Auto-save if identifier is present, or if question text is present
    if (hasIdentifier || hasQuestionText) {
      autoSaveTimeoutRefs.current[question.id] = setTimeout(() => {
        autoSaveQuestion(question)
      }, 1000) // 1 second debounce
    }
  }

  const autoSaveQuestion = async (question: QuestionFormData) => {
    if (!savedGroupId) return
    
    // Don't save if missing required fields
    if (!question.identifier.trim() || !question.question_text.trim()) {
      return
    }

    // Don't save if identifier is duplicate
    if (question.isDuplicateIdentifier) {
      return
    }

    // Mark as saving
    setQuestions(prev => prev.map(q => 
      q.id === question.id ? { ...q, isSaving: true } : q
    ))

    try {
      const questionIndex = questions.findIndex(q => q.id === question.id)
      
      if (question.dbId) {
        // Update existing question
        await questionGroupService.updateQuestion(question.dbId, {
          question_text: question.question_text,
          question_type: question.question_type,
          is_required: question.is_required,
          display_order: questionIndex + 1,
          options: question.question_type === 'multiple_choice' || question.question_type === 'checkbox_group' || question.question_type === 'dropdown' ? question.options : undefined,
          person_display_mode: question.question_type === 'person' ? question.person_display_mode : undefined,
          include_time: question.question_type === 'date' ? question.include_time : undefined
        })
      } else {
        // Create new question
        const created = await questionGroupService.createQuestion(savedGroupId, {
          question_group_id: savedGroupId,
          question_text: question.question_text,
          question_type: question.question_type,
          identifier: question.identifier,
          is_required: question.is_required,
          display_order: questionIndex + 1,
          options: question.question_type === 'multiple_choice' || question.question_type === 'checkbox_group' || question.question_type === 'dropdown' ? question.options : undefined,
          person_display_mode: question.question_type === 'person' ? question.person_display_mode : undefined,
          include_time: question.question_type === 'date' ? question.include_time : undefined
        })
        
        // Update with database ID
        setQuestions(prev => prev.map(q => 
          q.id === question.id ? { ...q, dbId: created.id } : q
        ))
      }

      // Mark as saved
      setQuestions(prev => prev.map(q => 
        q.id === question.id ? { ...q, isSaving: false, lastSaved: new Date() } : q
      ))
    } catch (error: any) {
      console.error('Failed to auto-save question:', error)
      setQuestions(prev => prev.map(q => 
        q.id === question.id ? { ...q, isSaving: false } : q
      ))
    }
  }

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id))
  }

  const addOption = (questionId: string) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId) {
        return {
          ...q,
          options: [...q.options, { value: '', label: '' }]
        }
      }
      return q
    }))
  }

  const updateOption = (questionId: string, optionIndex: number, field: 'value' | 'label', value: string) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId) {
        const newOptions = [...q.options]
        newOptions[optionIndex] = { ...newOptions[optionIndex], [field]: value }
        return { ...q, options: newOptions }
      }
      return q
    }))
  }

  const removeOption = (questionId: string, optionIndex: number) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId) {
        return {
          ...q,
          options: q.options.filter((_, i) => i !== optionIndex)
        }
      }
      return q
    }))
  }

  const handleSaveGroupInfo = async () => {
    if (!name) {
      alert('Please provide a name')
      return
    }

    if (!isNameUnique) {
      alert('A question group with this name already exists. Please use a unique name.')
      return
    }

    try {
      setSubmitting(true)
      const identifier = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
      const groupResponse = await questionGroupService.createQuestionGroup({
        name,
        description: description || undefined,
        identifier
      })
      setSavedGroupId(groupResponse.id)
      setGroupInfoSaved(true)
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to save question group')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSaveQuestion = async (question: QuestionFormData, index: number) => {
    if (!savedGroupId) return
    
    if (!question.question_text || !question.identifier) {
      alert('Please provide question text and identifier')
      return
    }

    try {
      await questionGroupService.createQuestion(savedGroupId, {
        question_group_id: savedGroupId,
        question_text: question.question_text,
        question_type: question.question_type,
        identifier: question.identifier,
        is_required: question.is_required,
        display_order: index + 1,
        options: question.question_type === 'multiple_choice' || question.question_type === 'checkbox_group' || question.question_type === 'dropdown' ? question.options : undefined,
        person_display_mode: question.question_type === 'person' ? question.person_display_mode : undefined,
        include_time: question.question_type === 'date' ? question.include_time : undefined
      })
      alert('Question saved successfully')
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to save question')
    }
  }

  return (
    <div className="question-groups-container">
      <div className="question-groups-header">
        <div>
          <h1 className="question-groups-title">{isEditMode ? 'Edit Question Group' : 'Create Question Group'}</h1>
          <p className="question-groups-subtitle">
            {isEditMode ? 'Update the question group information and questions' : 'Create a new question group with questions'}
          </p>
        </div>
        {!groupInfoSaved && (
          <button 
            onClick={handleSaveGroupInfo}
            disabled={(!isNameUnique && !isEditMode) || submitting}
            className="create-button"
            style={{ opacity: (isNameUnique || isEditMode) && !submitting ? 1 : 0.5, cursor: (isNameUnique || isEditMode) && !submitting ? 'pointer' : 'not-allowed' }}
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="button-icon">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {isEditMode ? 'Update Group Information' : 'Create Question Group'}
          </button>
        )}
      </div>

      <div className="question-group-form">
        <div className="form-section">
          <h2 className="form-section-title">Group Information</h2>
          
          <div className="form-group">
            <label className="form-label">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input"
              style={{ borderColor: isDuplicateName ? '#dc2626' : undefined }}
              disabled={groupInfoSaved}
              required
            />
            {isCheckingName && (
              <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>Checking name...</p>
            )}
            {isDuplicateName && !isCheckingName && (
              <p style={{ color: '#dc2626', fontSize: '0.875rem', marginTop: '0.25rem' }}>A question group with this name already exists. Please use a unique name.</p>
            )}
          </div>

          <div className="form-group form-group-description">
            <label className="form-label">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="form-textarea"
              rows={3}
              disabled={groupInfoSaved}
            />
          </div>

          {!groupInfoSaved && (
            <div style={{ marginTop: '1rem' }}>
              <button
                type="button"
                onClick={handleSaveGroupInfo}
                disabled={(!isNameUnique && !isEditMode) || submitting}
                className="submit-button"
                style={{ opacity: (isNameUnique || isEditMode) && !submitting ? 1 : 0.5, cursor: (isNameUnique || isEditMode) && !submitting ? 'pointer' : 'not-allowed' }}
              >
                {submitting ? 'Saving...' : (isEditMode ? 'Update Group Information' : 'Save Group Information')}
              </button>
            </div>
          )}
        </div>

        {groupInfoSaved && (
        <div className="form-section">
          <div className="form-section-header">
            <h2 className="form-section-title">Questions</h2>
          </div>

          {questions.map((question, qIndex) => (
            <div key={question.id} className="question-builder">
              <div className="question-builder-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="question-number">Question {qIndex + 1}</span>
                  {question.isSaving && (
                    <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Saving...</span>
                  )}
                  {!question.isSaving && question.lastSaved && (
                    <span style={{ fontSize: '0.75rem', color: '#10b981' }}>✓ Saved</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeQuestion(question.id)}
                  className="remove-button"
                  title="Remove question"
                >
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="trash-icon">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              <div className="question-builder-content">
                <div className="form-group">
                  <label className="form-label">Identifier *</label>
                  <input
                    type="text"
                    value={question.identifier}
                    onChange={(e) => updateQuestion(question.id, 'identifier', e.target.value)}
                    className="form-input"
                    style={{ borderColor: question.isDuplicateIdentifier ? '#dc2626' : undefined }}
                    placeholder="e.g., full_name"
                  />
                  {question.isCheckingIdentifier && (
                    <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                      Checking identifier...
                    </p>
                  )}
                  {question.isDuplicateIdentifier && !question.isCheckingIdentifier && (
                    <p style={{ fontSize: '0.875rem', color: '#dc2626', marginTop: '0.25rem' }}>
                      This identifier is already in use. Please choose a unique identifier.
                    </p>
                  )}
                </div>

                <div className="question-text-section">
                  <label className="form-label">Question Text *</label>
                  <textarea
                    value={question.question_text}
                    onChange={(e) => updateQuestion(question.id, 'question_text', e.target.value)}
                    className="form-textarea"
                    rows={1.5}
                    placeholder="Enter your question here..."
                  />
                </div>

                <div className="question-type-options-container">
                  <div className="question-type-section">
                    <label className="form-label">Answer Type</label>
                    <div className="radio-group">
                      <label className="radio-option">
                        <input
                          type="radio"
                          name={`type-${question.id}`}
                          value="free_text"
                          checked={question.question_type === 'free_text'}
                          onChange={(e) => updateQuestion(question.id, 'question_type', e.target.value)}
                        />
                        <span>Text Input Field</span>
                      </label>
                      <label className="radio-option">
                        <input
                          type="radio"
                          name={`type-${question.id}`}
                          value="multiple_choice"
                          checked={question.question_type === 'multiple_choice'}
                          onChange={(e) => updateQuestion(question.id, 'question_type', e.target.value)}
                        />
                        <span>Single Choice (Radio Buttons)</span>
                      </label>
                      <label className="radio-option">
                        <input
                          type="radio"
                          name={`type-${question.id}`}
                          value="checkbox_group"
                          checked={question.question_type === 'checkbox_group'}
                          onChange={(e) => updateQuestion(question.id, 'question_type', e.target.value)}
                        />
                        <span>Multiple Choice (Checkboxes)</span>
                      </label>
                      <label className="radio-option">
                        <input
                          type="radio"
                          name={`type-${question.id}`}
                          value="dropdown"
                          checked={question.question_type === 'dropdown'}
                          onChange={(e) => updateQuestion(question.id, 'question_type', e.target.value)}
                        />
                        <span>Dropdown Menu</span>
                      </label>
                      <label className="radio-option">
                        <input
                          type="radio"
                          name={`type-${question.id}`}
                          value="person"
                          checked={question.question_type === 'person'}
                          onChange={(e) => {
                            updateQuestion(question.id, 'question_type', e.target.value)
                            if (!question.person_display_mode) {
                              updateQuestion(question.id, 'person_display_mode', 'autocomplete')
                            }
                          }}
                        />
                        <span>Person</span>
                      </label>
                      <label className="radio-option">
                        <input
                          type="radio"
                          name={`type-${question.id}`}
                          value="date"
                          checked={question.question_type === 'date'}
                          onChange={(e) => updateQuestion(question.id, 'question_type', e.target.value)}
                        />
                        <span>Date</span>
                      </label>
                    </div>
                  </div>

                  <div className="question-options-panel">
                    <label className="form-label">Options</label>
                    {(question.question_type === 'multiple_choice' || question.question_type === 'checkbox_group' || question.question_type === 'dropdown') && (
                      <div className="options-list">
                        {question.options.map((option, optIndex) => (
                          <div key={optIndex} className="option-row">
                            <input
                              type="text"
                              value={option.label}
                              onChange={(e) => updateOption(question.id, optIndex, 'label', e.target.value)}
                              onBlur={() => {
                                const q = questions.find(q => q.id === question.id)
                                if (q) triggerAutoSave(q)
                              }}
                              className="form-input"
                              placeholder={`Option ${optIndex + 1}`}
                            />
                            <button
                              type="button"
                              onClick={() => removeOption(question.id, optIndex)}
                              className="remove-option-button"
                              title="Remove option"
                            >
                              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '16px', height: '16px' }}>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addOption(question.id)}
                          className="add-option-button"
                        >
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '16px', height: '16px' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Add Option
                        </button>
                      </div>
                    )}
                    {question.question_type === 'person' && (
                      <div className="person-options">
                        <div 
                          className="dropdown-container" 
                          ref={(el) => { displayModeDropdownRefs.current[question.id] = el }}
                        >
                          <button
                            type="button"
                            className="dropdown-button form-input"
                            onClick={(e) => {
                              e.preventDefault()
                              setOpenDisplayModeDropdown(
                                openDisplayModeDropdown === question.id ? null : question.id
                              )
                            }}
                            style={{ 
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                          >
                            <span>{question.person_display_mode === 'dropdown' ? 'Drop Down Menu' : 'Auto Complete'}</span>
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '16px', height: '16px' }}>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {openDisplayModeDropdown === question.id && (
                            <div className="dropdown-menu">
                              <button
                                type="button"
                                className="dropdown-item"
                                onClick={() => {
                                  updateQuestion(question.id, 'person_display_mode', 'autocomplete')
                                  setOpenDisplayModeDropdown(null)
                                }}
                              >
                                {question.person_display_mode !== 'dropdown' && (
                                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '16px', height: '16px', marginRight: '8px' }}>
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                                {question.person_display_mode === 'dropdown' && <span style={{ width: '24px', display: 'inline-block' }}></span>}
                                Auto Complete
                              </button>
                              <button
                                type="button"
                                className="dropdown-item"
                                onClick={() => {
                                  updateQuestion(question.id, 'person_display_mode', 'dropdown')
                                  setOpenDisplayModeDropdown(null)
                                }}
                              >
                                {question.person_display_mode === 'dropdown' && (
                                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '16px', height: '16px', marginRight: '8px' }}>
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                                {question.person_display_mode !== 'dropdown' && <span style={{ width: '24px', display: 'inline-block' }}></span>}
                                Drop Down Menu
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {question.question_type === 'date' && (
                      <div className="date-options">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={question.include_time || false}
                            onChange={(e) => updateQuestion(question.id, 'include_time', e.target.checked)}
                          />
                          <span>Include time of day</span>
                        </label>
                      </div>
                    )}
                    {question.question_type === 'free_text' && (
                      <div className="empty-options">
                        <p style={{ color: '#6b7280', fontSize: '0.875rem', fontStyle: 'italic' }}>No options needed for text input</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {questions.length === 0 && (
            <div className="empty-questions">
              <p>No questions added yet. Click "Add Question" to get started.</p>
            </div>
          )}

          <div style={{ marginTop: '1rem' }}>
            <button 
              type="button" 
              onClick={addQuestion} 
              className="add-question-button"
              disabled={!canAddQuestion}
              style={{ opacity: canAddQuestion ? 1 : 0.5, cursor: canAddQuestion ? 'pointer' : 'not-allowed' }}
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="button-icon">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Question
            </button>
          </div>
        </div>
        )}
      </div>
    </div>
  )
}

export default QuestionGroups
