import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { sessionService } from '../services/sessionService'
import { DocumentSession, SessionQuestionsResponse, QuestionToDisplay } from '../types/session'
import { Person } from '../types/person'
import { personService } from '../services/personService'
import PersonFormModal from '../components/common/PersonFormModal'
import './DocumentSessions.css'

const QUESTIONS_PER_PAGE = 10

const DocumentSessions: React.FC = () => {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session')
  const navigate = useNavigate()

  // Session list state
  const [sessions, setSessions] = useState<DocumentSession[]>([])

  // Current session document state
  const [sessionData, setSessionData] = useState<SessionQuestionsResponse | null>(null)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [personAnswers, setPersonAnswers] = useState<Record<number, string[]>>({}) // For multiple person fields
  const [personConjunctions, setPersonConjunctions] = useState<Record<number, Array<'and' | 'then'>>>({}) // Conjunction between each person
  const [currentPage, setCurrentPage] = useState(1)

  // UI state
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCompleted, setIsCompleted] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [conditionalLoading, setConditionalLoading] = useState(false)
  const [conditionalLoadingQuestionId, setConditionalLoadingQuestionId] = useState<number | null>(null)

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
      const initialPersonConjunctions: Record<number, Array<'and' | 'then'>> = {}

      data.questions.forEach(q => {
        if (data.existing_answers[q.id]) {
          if (q.question_type === 'person') {
            // Person answers are now stored as JSON objects with all person fields
            // Put them in initialAnswers so the inline form can use them
            initialAnswers[q.id] = data.existing_answers[q.id]
            
            // Also handle legacy format for backwards compatibility
            try {
              const parsed = JSON.parse(data.existing_answers[q.id])
              if (Array.isArray(parsed)) {
                // Check if it's the old format with objects containing name and conjunction
                if (parsed.length > 0 && typeof parsed[0] === 'object' && 'name' in parsed[0]) {
                  initialPersonAnswers[q.id] = parsed.map((p: any) => p.name)
                  initialPersonConjunctions[q.id] = parsed.map((p: any) => p.conjunction).filter((c: any) => c)
                } else {
                  // Old format - just an array of strings
                  initialPersonAnswers[q.id] = parsed
                }
              }
            } catch {
              // Not an array, it's the new JSON object format - already in initialAnswers
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
      setPersonConjunctions(initialPersonConjunctions)
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
          existing_answers: {},
          conditional_identifiers: []
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

    // Mark as having changes if value actually changed
    if (previousValue !== value) {
      setHasChanges(true)
    }
    // Note: Saving to database is now done on blur via handleAnswerBlur
  }

  // Handle radio button change - saves immediately and triggers conditional refresh
  const handleRadioChange = async (questionId: number, newValue: string) => {
    if (!sessionData) return

    const question = sessionData.questions.find(q => q.id === questionId)
    if (!question) return

    console.log('handleRadioChange called:', { questionId, newValue, identifier: question.identifier })

    // Save the answer immediately
    try {
      await sessionService.saveAnswers(sessionData.session_id, {
        answers: [{ question_id: questionId, answer_value: newValue }]
      })
      console.log('Answer saved successfully')
    } catch (err) {
      console.error('Failed to save answer:', err)
    }

    // Check if this question's identifier is used by any conditional
    // Support both namespaced and non-namespaced identifiers
    const strippedId = question.identifier.includes('.') 
      ? question.identifier.split('.').slice(1).join('.') 
      : question.identifier
    console.log('Checking conditional dependency:', { 
      identifier: question.identifier, 
      strippedId, 
      conditional_identifiers: sessionData.conditional_identifiers 
    })
    const isConditionalDependency = sessionData.conditional_identifiers?.includes(question.identifier) 
      || sessionData.conditional_identifiers?.includes(strippedId) 
      || false
    console.log('isConditionalDependency:', isConditionalDependency)
    if (!isConditionalDependency) return

    // Trigger conditional refresh
    try {
      setConditionalLoading(true)
      setConditionalLoadingQuestionId(questionId)

      // Refresh questions to re-evaluate conditionals
      const data = await sessionService.getSessionQuestions(
        sessionData.session_id,
        currentPage,
        QUESTIONS_PER_PAGE
      )

      // Update session data with new questions
      setSessionData(data)

      // Preserve the just-changed answer and merge with new data
      setAnswers(currentAnswers => {
        const newAnswers: Record<number, string> = { ...currentAnswers, [questionId]: newValue }

        data.questions.forEach(q => {
          if (!(q.id in newAnswers) && data.existing_answers[q.id] && q.question_type !== 'person') {
            newAnswers[q.id] = data.existing_answers[q.id]
          }
        })

        return newAnswers
      })

      setPersonAnswers(currentPersonAnswers => {
        const newPersonAnswers: Record<number, string[]> = { ...currentPersonAnswers }

        data.questions.forEach(q => {
          if (q.question_type === 'person' && data.existing_answers[q.id]) {
            try {
              const parsed = JSON.parse(data.existing_answers[q.id])
              if (Array.isArray(parsed)) {
                newPersonAnswers[q.id] = parsed
              }
            } catch {
              // Not an array, ignore
            }
          }
        })

        return newPersonAnswers
      })
    } catch (err) {
      console.error('Failed to refresh conditionals:', err)
    } finally {
      setConditionalLoading(false)
      setConditionalLoadingQuestionId(null)
    }
  }

  // Handle blur (input exit) - saves answer and triggers conditional refresh if needed
  const handleAnswerBlur = async (questionId: number) => {
    if (!sessionData) return

    const question = sessionData.questions.find(q => q.id === questionId)
    if (!question) return

    // Save the current answer value
    const currentValue = answers[questionId] || ''
    try {
      await sessionService.saveAnswers(sessionData.session_id, {
        answers: [{ question_id: questionId, answer_value: currentValue }]
      })
    } catch (err) {
      console.error('Failed to save answer:', err)
    }

    // Check if this question's identifier is used by any conditional
    // Support both namespaced and non-namespaced identifiers
    const strippedId = question.identifier.includes('.') 
      ? question.identifier.split('.').slice(1).join('.') 
      : question.identifier
    const isConditionalDependency = sessionData.conditional_identifiers?.includes(question.identifier) 
      || sessionData.conditional_identifiers?.includes(strippedId) 
      || false
    if (!isConditionalDependency) return

    // Trigger conditional refresh
    try {
      setConditionalLoading(true)
      setConditionalLoadingQuestionId(questionId)

      // Refresh questions to re-evaluate conditionals
      const data = await sessionService.getSessionQuestions(
        sessionData.session_id,
        currentPage,
        QUESTIONS_PER_PAGE
      )

      // Update session data with new questions
      setSessionData(data)

      // Use functional updates to get current state and merge with new data
      setAnswers(currentAnswers => {
        const value = currentAnswers[questionId] || ''
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
                if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object' && 'name' in parsed[0]) {
                  newPersonAnswers[q.id] = parsed.map((p: any) => p.name || '')
                } else if (Array.isArray(parsed)) {
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

      setPersonConjunctions(currentConjunctions => {
        const newConjunctions: Record<number, Array<'and' | 'then'>> = { ...currentConjunctions }

        data.questions.forEach(q => {
          if (q.question_type === 'person' && data.existing_answers[q.id]) {
            try {
              const parsed = JSON.parse(data.existing_answers[q.id])
              if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object' && 'conjunction' in parsed[0]) {
                newConjunctions[q.id] = parsed.slice(0, -1).map((p: any) => p.conjunction || 'and')
              }
            } catch {
              // ignore
            }
          }
        })

        return newConjunctions
      })
    } catch (err) {
      console.error('Failed to refresh conditionals:', err)
    } finally {
      setConditionalLoading(false)
      setConditionalLoadingQuestionId(null)
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
        // Filter out empty values
        const filteredValues = values.filter(v => v.trim() !== '')
        const conjunctions = personConjunctions[questionId] || []
        
        // Build array with person names and conjunctions
        const personData = filteredValues.map((name, idx) => ({
          name,
          conjunction: conjunctions[idx] || undefined
        }))
        
        const answerValue = JSON.stringify(personData)

        await sessionService.saveAnswers(sessionData.session_id, {
          answers: [{ question_id: questionId, answer_value: answerValue }]
        })
      } catch (err) {
        console.error('Failed to save person answer:', err)
      }
    }, 500)
  }

  const handlePersonAnswerChange = (questionId: number, index: number, value: string) => {
    setHasChanges(true)
    setPersonAnswers(prev => {
      const current = prev[questionId] || ['']
      const updated = [...current]
      updated[index] = value

      // Trigger save
      savePersonAnswer(questionId, updated)

      return { ...prev, [questionId]: updated }
    })
  }

  const addPersonField = (questionId: number, conjunction: 'and' | 'then') => {
    setPersonAnswers(prev => {
      const current = prev[questionId] || ['']
      const updated = [...current, '']
      return { ...prev, [questionId]: updated }
    })
    setPersonConjunctions(prev => {
      const current = prev[questionId] || []
      const updated = [...current, conjunction]
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
    setPersonConjunctions(prev => {
      const current = prev[questionId] || []
      // Remove the conjunction before this index (conjunctions are between items)
      const updated = current.filter((_, i) => i !== index - 1)
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

    // Add person answers with conjunctions
    Object.entries(personAnswers).forEach(([questionId, values]) => {
      const filteredValues = values.filter(v => v.trim() !== '')
      if (filteredValues.length > 0) {
        const conjunctions = personConjunctions[parseInt(questionId)] || []
        const personData = filteredValues.map((name, idx) => ({
          name,
          conjunction: conjunctions[idx] || undefined
        }))
        answerArray.push({
          question_id: parseInt(questionId),
          answer_value: JSON.stringify(personData)
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

      // Add person answers with conjunctions
      Object.entries(personAnswers).forEach(([questionId, values]) => {
        const filteredValues = values.filter(v => v.trim() !== '')
        if (filteredValues.length > 0) {
          const conjunctions = personConjunctions[parseInt(questionId)] || []
          const personData = filteredValues.map((name, idx) => ({
            name,
            conjunction: conjunctions[idx] || undefined
          }))
          answerArray.push({
            question_id: parseInt(questionId),
            answer_value: JSON.stringify(personData)
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
        // Check if this is an Exit (no changes) on the last group/page
        const isLastGroupAndPage = sessionData.is_last_group && currentPage >= sessionData.total_pages
        
        if (direction === 'forward' && isLastGroupAndPage && !hasChanges) {
          // No changes - just navigate directly to menu without saving
          navigate('/document')
          return
        }
        
        // Navigate between groups (with saving)
        const result = await sessionService.navigate(sessionData.session_id, {
          direction,
          answers: answerArray
        })

        if (result.is_completed) {
          // Navigate back to document sessions list
          navigate('/document')
        } else {
          // Reload questions for new group
          await loadSessionQuestions(sessionData.session_id, 1)
          // Reset hasChanges for new group
          setHasChanges(false)
        }
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to navigate')
    } finally {
      setSubmitting(false)
    }
  }

  // Helper functions for repeatable questions
  const getRepeatableAnswerArray = (questionId: number): string[] => {
    const value = answers[questionId] || ''
    if (!value) return ['']
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return parsed.length > 0 ? parsed : ['']
      }
    } catch {
      // Not JSON, treat as single value
    }
    return [value]
  }

  const setRepeatableAnswerArray = (questionId: number, values: string[]) => {
    const jsonValue = JSON.stringify(values)
    handleAnswerChange(questionId, jsonValue)
  }

  const isLastInRepeatableSet = (questionIndex: number): boolean => {
    if (!sessionData) return false
    const questions = sessionData.questions
    const currentQuestion = questions[questionIndex]
    if (!currentQuestion?.repeatable) return false
    
    // Check if next question exists and is also repeatable
    const nextQuestion = questions[questionIndex + 1]
    if (!nextQuestion || !nextQuestion.repeatable) return true
    return false
  }

  const getRepeatableSetStartIndex = (questionIndex: number): number => {
    if (!sessionData) return questionIndex
    const questions = sessionData.questions
    const currentDepth = questions[questionIndex]?.depth ?? 0
    let startIndex = questionIndex
    
    // Walk backwards to find the start of the repeatable set
    // Only include questions at the same depth level
    while (startIndex > 0 && 
           questions[startIndex - 1]?.repeatable && 
           (questions[startIndex - 1]?.depth ?? 0) === currentDepth) {
      startIndex--
    }
    return startIndex
  }

  const getRepeatableSetQuestionIds = (questionIndex: number): number[] => {
    if (!sessionData) return []
    const questions = sessionData.questions
    const currentDepth = questions[questionIndex]?.depth ?? 0
    const startIndex = getRepeatableSetStartIndex(questionIndex)
    const ids: number[] = []
    
    // Collect all consecutive repeatable questions at the same depth level
    for (let i = startIndex; i < questions.length && 
         questions[i]?.repeatable && 
         (questions[i]?.depth ?? 0) === currentDepth; i++) {
      ids.push(questions[i].id)
    }
    return ids
  }

  const getInstanceCount = (questionIndex: number): number => {
    if (!sessionData) return 1
    const setQuestionIds = getRepeatableSetQuestionIds(questionIndex)
    if (setQuestionIds.length === 0) return 1
    
    // Get the max instance count from all questions in the set
    let maxCount = 1
    for (const qId of setQuestionIds) {
      const arr = getRepeatableAnswerArray(qId)
      if (arr.length > maxCount) maxCount = arr.length
    }
    return maxCount
  }

  const addRepeatableInstance = (questionIndex: number) => {
    const setQuestionIds = getRepeatableSetQuestionIds(questionIndex)
    for (const qId of setQuestionIds) {
      const current = getRepeatableAnswerArray(qId)
      setRepeatableAnswerArray(qId, [...current, ''])
    }
  }

  const removeRepeatableInstance = async (questionIndex: number, instanceIndex: number) => {
    if (!sessionData) return
    
    const setQuestionIds = getRepeatableSetQuestionIds(questionIndex)
    const answersToSave: { question_id: number; answer_value: string }[] = []
    
    for (const qId of setQuestionIds) {
      const current = getRepeatableAnswerArray(qId)
      if (current.length > 1) {
        const updated = current.filter((_, i) => i !== instanceIndex)
        setRepeatableAnswerArray(qId, updated)
        answersToSave.push({ question_id: qId, answer_value: JSON.stringify(updated) })
      }
    }
    
    // Save updated answers to database
    if (answersToSave.length > 0) {
      try {
        await sessionService.saveAnswers(sessionData.session_id, { answers: answersToSave })
        
        // Check if any of the removed questions are conditional dependencies
        const questions = sessionData.questions.filter(q => setQuestionIds.includes(q.id))
        const isConditionalDependency = questions.some(q => 
          sessionData.conditional_identifiers?.includes(q.identifier)
        )
        
        if (isConditionalDependency) {
          // Trigger conditional refresh
          setConditionalLoading(true)
          const data = await sessionService.getSessionQuestions(
            sessionData.session_id,
            currentPage,
            QUESTIONS_PER_PAGE
          )
          setSessionData(data)
          setConditionalLoading(false)
        }
      } catch (err) {
        console.error('Failed to save after removing instance:', err)
      }
    }
  }

  const updateRepeatableInstance = (questionId: number, instanceIndex: number, value: string) => {
    const current = getRepeatableAnswerArray(questionId)
    const updated = [...current]
    // Ensure array is long enough
    while (updated.length <= instanceIndex) {
      updated.push('')
    }
    updated[instanceIndex] = value
    setRepeatableAnswerArray(questionId, updated)
  }

  const renderQuestion = (question: QuestionToDisplay, instanceIndex: number = 0) => {
    // For repeatable questions, get the value at the specific instance index
    let value: string
    if (question.repeatable) {
      const arr = getRepeatableAnswerArray(question.id)
      value = arr[instanceIndex] || ''
    } else {
      value = answers[question.id] || ''
    }

    // Handler for value changes - uses repeatable-aware update if needed
    const handleValueChange = (newValue: string) => {
      if (question.repeatable) {
        updateRepeatableInstance(question.id, instanceIndex, newValue)
      } else {
        handleAnswerChange(question.id, newValue)
      }
    }

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
                    id={`q${question.id}-${instanceIndex}-${index}`}
                    name={`question-${question.id}-${instanceIndex}`}
                    value={optionValue}
                    checked={value === optionValue}
                    onChange={(e) => {
                      // Update local state
                      handleValueChange(e.target.value)
                      // Save immediately and trigger conditional refresh for radio buttons
                      handleRadioChange(question.id, e.target.value)
                    }}
                  />
                  <label htmlFor={`q${question.id}-${instanceIndex}-${index}`}>{option.label}</label>
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
            onChange={(e) => handleValueChange(e.target.value)}
            onBlur={() => handleAnswerBlur(question.id)}
            placeholder="Enter your answer..."
          />
        )

      case 'date':
        return (
          <input
            type={question.include_time ? 'datetime-local' : 'date'}
            className="question-input"
            value={value}
            onChange={(e) => handleValueChange(e.target.value)}
            onBlur={() => handleAnswerBlur(question.id)}
          />
        )

      case 'person':
        // Parse the current answer as JSON object with person fields
        let personData: Record<string, any> = {}
        try {
          if (value) {
            personData = JSON.parse(value)
          }
        } catch {
          personData = {}
        }

        // Collect person data from questions that appear BEFORE this question in the list
        // AND from earlier instances of the same repeatable question
        const earlierPeople: Array<{ name: string; data: Record<string, any> }> = []
        if (sessionData) {
          const currentQuestionIndex = sessionData.questions.findIndex(q => q.id === question.id)
          for (let i = 0; i < currentQuestionIndex; i++) {
            const q = sessionData.questions[i]
            if (q.question_type === 'person') {
              const answerValue = answers[q.id]
              if (answerValue) {
                try {
                  const parsed = JSON.parse(answerValue)
                  if (Array.isArray(parsed)) {
                    // Repeatable person - add all instances
                    for (const personObj of parsed) {
                      if (personObj && typeof personObj === 'object' && personObj.name?.trim()) {
                        earlierPeople.push({ name: personObj.name, data: personObj })
                      }
                    }
                  } else if (parsed.name && parsed.name.trim()) {
                    earlierPeople.push({ name: parsed.name, data: parsed })
                  }
                } catch {
                  // Skip invalid JSON
                }
              }
            }
          }
          
          // For repeatable questions, also include earlier instances of THIS question
          if (question.repeatable && instanceIndex > 0) {
            const arr = getRepeatableAnswerArray(question.id)
            for (let i = 0; i < instanceIndex; i++) {
              const instanceValue = arr[i]
              if (instanceValue) {
                try {
                  const parsed = JSON.parse(instanceValue)
                  if (parsed && typeof parsed === 'object' && parsed.name?.trim()) {
                    earlierPeople.push({ name: parsed.name, data: parsed })
                  }
                } catch {
                  // Skip invalid JSON
                }
              }
            }
          }
        }

        // Check if current name matches an earlier person
        const matchedPerson = earlierPeople.find(p => 
          p.name.toLowerCase() === (personData.name || '').toLowerCase() && personData.name?.trim()
        )

        // Update person field in local state only (called on every keystroke)
        const updatePersonField = (field: string, fieldValue: string) => {
          // If updating name and it matches an earlier person, copy all their data
          if (field === 'name') {
            const match = earlierPeople.find(p => p.name.toLowerCase() === fieldValue.toLowerCase())
            if (match) {
              handleValueChange(JSON.stringify(match.data))
              return
            }
          }
          const newData = { ...personData, [field]: fieldValue }
          handleValueChange(JSON.stringify(newData))
        }

        const updatePersonAddressField = (addressType: 'mailing_address' | 'physical_address', field: string, fieldValue: string) => {
          const currentAddress = personData[addressType] || {}
          const newAddress = { ...currentAddress, [field]: fieldValue }
          const newData = { ...personData, [addressType]: newAddress }
          handleValueChange(JSON.stringify(newData))
        }

        // Save person data on blur (called when field loses focus)
        const savePersonOnBlur = () => {
          handleAnswerBlur(question.id)
        }

        const US_STATES = [
          { value: 'AL', label: 'Alabama' }, { value: 'AK', label: 'Alaska' }, { value: 'AZ', label: 'Arizona' },
          { value: 'AR', label: 'Arkansas' }, { value: 'CA', label: 'California' }, { value: 'CO', label: 'Colorado' },
          { value: 'CT', label: 'Connecticut' }, { value: 'DE', label: 'Delaware' }, { value: 'FL', label: 'Florida' },
          { value: 'GA', label: 'Georgia' }, { value: 'HI', label: 'Hawaii' }, { value: 'ID', label: 'Idaho' },
          { value: 'IL', label: 'Illinois' }, { value: 'IN', label: 'Indiana' }, { value: 'IA', label: 'Iowa' },
          { value: 'KS', label: 'Kansas' }, { value: 'KY', label: 'Kentucky' }, { value: 'LA', label: 'Louisiana' },
          { value: 'ME', label: 'Maine' }, { value: 'MD', label: 'Maryland' }, { value: 'MA', label: 'Massachusetts' },
          { value: 'MI', label: 'Michigan' }, { value: 'MN', label: 'Minnesota' }, { value: 'MS', label: 'Mississippi' },
          { value: 'MO', label: 'Missouri' }, { value: 'MT', label: 'Montana' }, { value: 'NE', label: 'Nebraska' },
          { value: 'NV', label: 'Nevada' }, { value: 'NH', label: 'New Hampshire' }, { value: 'NJ', label: 'New Jersey' },
          { value: 'NM', label: 'New Mexico' }, { value: 'NY', label: 'New York' }, { value: 'NC', label: 'North Carolina' },
          { value: 'ND', label: 'North Dakota' }, { value: 'OH', label: 'Ohio' }, { value: 'OK', label: 'Oklahoma' },
          { value: 'OR', label: 'Oregon' }, { value: 'PA', label: 'Pennsylvania' }, { value: 'RI', label: 'Rhode Island' },
          { value: 'SC', label: 'South Carolina' }, { value: 'SD', label: 'South Dakota' }, { value: 'TN', label: 'Tennessee' },
          { value: 'TX', label: 'Texas' }, { value: 'UT', label: 'Utah' }, { value: 'VT', label: 'Vermont' },
          { value: 'VA', label: 'Virginia' }, { value: 'WA', label: 'Washington' }, { value: 'WV', label: 'West Virginia' },
          { value: 'WI', label: 'Wisconsin' }, { value: 'WY', label: 'Wyoming' }
        ]

        return (
          <div className="person-form-inline" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Name with type-ahead from earlier form entries */}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Name</label>
              <input
                type="text"
                className="question-input"
                value={personData.name || ''}
                onChange={(e) => updatePersonField('name', e.target.value)}
                onBlur={savePersonOnBlur}
                placeholder="Full name"
                list={`person-typeahead-${question.id}-${instanceIndex}`}
                autoComplete="off"
              />
              <datalist id={`person-typeahead-${question.id}-${instanceIndex}`}>
                {earlierPeople.map((person, idx) => (
                  <option key={idx} value={person.name} />
                ))}
              </datalist>
              {matchedPerson && (
                <p style={{ fontSize: '0.75rem', color: '#059669', marginTop: '0.25rem', margin: 0 }}>
                  Using information from earlier entry
                </p>
              )}
            </div>

            {/* Only show other fields if no match found */}
            {!matchedPerson && (
              <>
                {/* Email and Phone in a row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Email</label>
                    <input
                      type="email"
                      className="question-input"
                      value={personData.email || ''}
                      onChange={(e) => updatePersonField('email', e.target.value)}
                      onBlur={savePersonOnBlur}
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Phone Number</label>
                    <input
                      type="tel"
                      className="question-input"
                      value={personData.phone_number || ''}
                      onChange={(e) => updatePersonField('phone_number', e.target.value)}
                      onBlur={savePersonOnBlur}
                    />
                  </div>
                </div>

                {/* Date of Birth and SSN in a row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Date of Birth</label>
                    <input
                      type="date"
                      className="question-input"
                      value={personData.date_of_birth || ''}
                      onChange={(e) => updatePersonField('date_of_birth', e.target.value)}
                      onBlur={savePersonOnBlur}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Social Security Number</label>
                    <input
                      type="text"
                      className="question-input"
                      value={personData.ssn || ''}
                      onChange={(e) => updatePersonField('ssn', e.target.value)}
                      onBlur={savePersonOnBlur}
                      placeholder="XXX-XX-XXXX"
                      maxLength={11}
                      autoComplete="off"
                    />
                  </div>
            </div>

            {/* Employer and Occupation in a row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Employer</label>
                <input
                  type="text"
                  className="question-input"
                  value={personData.employer || ''}
                  onChange={(e) => updatePersonField('employer', e.target.value)}
                  onBlur={savePersonOnBlur}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Occupation</label>
                <input
                  type="text"
                  className="question-input"
                  value={personData.occupation || ''}
                  onChange={(e) => updatePersonField('occupation', e.target.value)}
                  onBlur={savePersonOnBlur}
                />
              </div>
            </div>

            {/* Mailing Address Section */}
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', color: '#374151' }}>Mailing Address</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Address Line 1</label>
                  <input
                    type="text"
                    className="question-input"
                    value={personData.mailing_address?.line1 || ''}
                    onChange={(e) => updatePersonAddressField('mailing_address', 'line1', e.target.value)}
                    onBlur={savePersonOnBlur}
                    placeholder="Street address"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Address Line 2</label>
                  <input
                    type="text"
                    className="question-input"
                    value={personData.mailing_address?.line2 || ''}
                    onChange={(e) => updatePersonAddressField('mailing_address', 'line2', e.target.value)}
                    onBlur={savePersonOnBlur}
                    placeholder="Apt, suite, etc. (optional)"
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>City</label>
                    <input
                      type="text"
                      className="question-input"
                      value={personData.mailing_address?.city || ''}
                      onChange={(e) => updatePersonAddressField('mailing_address', 'city', e.target.value)}
                      onBlur={savePersonOnBlur}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>State</label>
                    <select
                      className="question-select"
                      value={personData.mailing_address?.state || ''}
                      onChange={(e) => updatePersonAddressField('mailing_address', 'state', e.target.value)}
                      onBlur={savePersonOnBlur}
                    >
                      <option value="">Select State</option>
                      {US_STATES.map(state => (
                        <option key={state.value} value={state.value}>{state.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>ZIP Code</label>
                    <input
                      type="text"
                      className="question-input"
                      value={personData.mailing_address?.zip || ''}
                      onChange={(e) => updatePersonAddressField('mailing_address', 'zip', e.target.value)}
                      onBlur={savePersonOnBlur}
                      placeholder="12345"
                      maxLength={10}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Physical Address Section */}
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', color: '#374151' }}>Physical Address</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Address Line 1</label>
                  <input
                    type="text"
                    className="question-input"
                    value={personData.physical_address?.line1 || ''}
                    onChange={(e) => updatePersonAddressField('physical_address', 'line1', e.target.value)}
                    onBlur={savePersonOnBlur}
                    placeholder="Street address"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Address Line 2</label>
                  <input
                    type="text"
                    className="question-input"
                    value={personData.physical_address?.line2 || ''}
                    onChange={(e) => updatePersonAddressField('physical_address', 'line2', e.target.value)}
                    onBlur={savePersonOnBlur}
                    placeholder="Apt, suite, etc. (optional)"
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>City</label>
                    <input
                      type="text"
                      className="question-input"
                      value={personData.physical_address?.city || ''}
                      onChange={(e) => updatePersonAddressField('physical_address', 'city', e.target.value)}
                      onBlur={savePersonOnBlur}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>State</label>
                    <select
                      className="question-select"
                      value={personData.physical_address?.state || ''}
                      onChange={(e) => updatePersonAddressField('physical_address', 'state', e.target.value)}
                      onBlur={savePersonOnBlur}
                    >
                      <option value="">Select State</option>
                      {US_STATES.map(state => (
                        <option key={state.value} value={state.value}>{state.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>ZIP Code</label>
                    <input
                      type="text"
                      className="question-input"
                      value={personData.physical_address?.zip || ''}
                      onChange={(e) => updatePersonAddressField('physical_address', 'zip', e.target.value)}
                      onBlur={savePersonOnBlur}
                      placeholder="12345"
                      maxLength={10}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Trustor Information Section */}
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', color: '#374151' }}>Trustor Information</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Trustor Is Living</label>
                    <select
                      className="question-select"
                      value={personData.trustor_is_living ?? 1}
                      onChange={(e) => updatePersonField('trustor_is_living', e.target.value)}
                      onBlur={savePersonOnBlur}
                    >
                      <option value={1}>Yes</option>
                      <option value={0}>No (Deceased)</option>
                    </select>
                  </div>
                  {String(personData.trustor_is_living) === '0' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Date of Death</label>
                      <input
                        type="date"
                        className="question-input"
                        value={personData.date_of_death || ''}
                        onChange={(e) => updatePersonField('date_of_death', e.target.value)}
                        onBlur={savePersonOnBlur}
                      />
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Death Certificate Received</label>
                    <select
                      className="question-select"
                      value={personData.trustor_death_certificate_received ?? 0}
                      onChange={(e) => updatePersonField('trustor_death_certificate_received', e.target.value)}
                      onBlur={savePersonOnBlur}
                    >
                      <option value={0}>No</option>
                      <option value={1}>Yes</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Of Sound Mind</label>
                    <select
                      className="question-select"
                      value={personData.trustor_of_sound_mind ?? 1}
                      onChange={(e) => updatePersonField('trustor_of_sound_mind', e.target.value)}
                      onBlur={savePersonOnBlur}
                    >
                      <option value={1}>Yes</option>
                      <option value={0}>No</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Has Relinquished</label>
                    <select
                      className="question-select"
                      value={personData.trustor_has_relinquished ?? 0}
                      onChange={(e) => updatePersonField('trustor_has_relinquished', e.target.value)}
                      onBlur={savePersonOnBlur}
                    >
                      <option value={0}>No</option>
                      <option value={1}>Yes</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Relinquished Date</label>
                    <input
                      type="date"
                      className="question-input"
                      value={personData.trustor_relinquished_date || ''}
                      onChange={(e) => updatePersonField('trustor_relinquished_date', e.target.value)}
                      onBlur={savePersonOnBlur}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Relinquishment Doc Received</label>
                  <select
                    className="question-select"
                    value={personData.trustor_reling_doc_received ?? 0}
                    onChange={(e) => updatePersonField('trustor_reling_doc_received', e.target.value)}
                    onBlur={savePersonOnBlur}
                  >
                    <option value={0}>No</option>
                    <option value={1}>Yes</option>
                  </select>
                </div>
              </div>
            </div>
              </>
            )}
          </div>
        )

      case 'dropdown':
      case 'database_dropdown':
        return (
          <select
            className="question-select"
            value={value}
            onChange={(e) => handleValueChange(e.target.value)}
            onBlur={() => handleAnswerBlur(question.id)}
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
            onChange={(e) => handleValueChange(e.target.value)}
            onBlur={() => handleAnswerBlur(question.id)}
            placeholder="Enter your answer..."
          />
        )
    }
  }

  if (loading) {
    return (
      <div className="document-sessions-container">
        <div className="loading-state">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="document-sessions-container">
        <div className="error-state">{error}</div>
      </div>
    )
  }

  // Show session list if no active session
  if (!sessionId) {
    return (
      <div className="document-sessions-container">
        <div className="document-sessions-wrapper">
          <div className="document-sessions-header">
            <div>
              <h1 className="document-sessions-title">Input Form</h1>
              <p className="document-sessions-subtitle">Start a new form or continue an existing one</p>
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
                  No forms yet. Start a new one to get started.
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className={`session-status ${session.is_completed ? 'status-completed' : 'status-in-progress'}`}>
                          {session.is_completed ? 'Completed' : 'In Progress'}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (window.confirm(`Are you sure you want to delete the form for "${session.client_identifier}"?`)) {
                              sessionService.deleteSession(session.id)
                                .then(() => {
                                  setSessions(prev => prev.filter(s => s.id !== session.id))
                                })
                                .catch(err => {
                                  alert('Failed to delete form: ' + (err.response?.data?.detail || err.message))
                                })
                            }
                          }}
                          style={{
                            padding: '0.375rem',
                            color: '#dc2626',
                            background: 'white',
                            border: '1px solid #dc2626',
                            borderRadius: '0.25rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Delete"
                        >
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '1rem', height: '1rem' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="session-date">
                      Started: {new Date(session.created_at).toLocaleDateString()} {new Date(session.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                ))
              )}
            </div>
        </div>
      </div>
    )
  }

  // Show completion screen only if we just completed (no questions loaded)
  // If questions are loaded, allow editing even for completed sessions
  if (isCompleted && sessionData && sessionData.questions.length === 0) {
    return (
      <div className="document-sessions-container">
        <div className="document-sessions-content">
          <div className="document-sessions-card completion-card">
            <div className="completion-icon">✅</div>
            <h1 className="completion-title">Document Complete!</h1>
            <p className="completion-message">
              You have successfully completed the document for {sessionData.client_identifier}.
            </p>
            <button
              onClick={() => navigate('/document')}
              className="btn btn-primary"
            >
              Back to Input Form
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Show current question group
  return (
    <div className="document-sessions-container">
      <div className="document-sessions-content">
        <div className="document-sessions-card">
          <div className="document-sessions-header">
            <h1 className="document-sessions-title">
              {sessionData?.client_identifier}
            </h1>
            {sessionData?.flow_name && (
              <p className="document-sessions-subtitle">{sessionData.flow_name}</p>
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
                {(() => {
                  // Find the index of the question that triggered the conditional loading
                  const triggerIndex = conditionalLoading && conditionalLoadingQuestionId
                    ? sessionData.questions.findIndex(q => q.id === conditionalLoadingQuestionId)
                    : -1
                  
                  // Track which repeatable sets we've already rendered
                  const renderedRepeatableSets = new Set<number>()
                  
                  return sessionData.questions.map((question, qIndex) => {
                    // Hide questions after the triggering question while loading
                    if (conditionalLoading && triggerIndex >= 0 && qIndex > triggerIndex) {
                      return null
                    }
                    
                    // For repeatable questions, we need special handling
                    if (question.repeatable) {
                      // Check if this is the start of a repeatable set
                      const setStartIndex = getRepeatableSetStartIndex(qIndex)
                      
                      // Skip if we've already rendered this set
                      if (renderedRepeatableSets.has(setStartIndex)) {
                        return null
                      }
                      renderedRepeatableSets.add(setStartIndex)
                      
                      // Get all questions in this repeatable set
                      const setQuestionIds = getRepeatableSetQuestionIds(qIndex)
                      const setQuestions = setQuestionIds.map(id => 
                        sessionData.questions.find(q => q.id === id)!
                      ).filter(Boolean)
                      
                      const instanceCount = getInstanceCount(qIndex)
                      const isLastInSet = isLastInRepeatableSet(qIndex + setQuestions.length - 1)
                      
                      return (
                        <React.Fragment key={`repeatable-set-${setStartIndex}`}>
                          {Array.from({ length: instanceCount }).map((_, instanceIdx) => (
                            <div 
                              key={`instance-${instanceIdx}`}
                              className="repeatable-instance"
                              style={{
                                border: '1px solid #e5e7eb',
                                borderRadius: '0.5rem',
                                padding: '1rem',
                                marginBottom: '0.75rem',
                                backgroundColor: '#fafafa',
                                position: 'relative'
                              }}
                            >
                              {instanceCount > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeRepeatableInstance(qIndex, instanceIdx)}
                                  style={{
                                    position: 'absolute',
                                    top: '0.5rem',
                                    right: '0.5rem',
                                    background: 'none',
                                    border: 'none',
                                    color: '#dc2626',
                                    cursor: 'pointer',
                                    fontSize: '1.25rem',
                                    lineHeight: 1,
                                    padding: '0.25rem'
                                  }}
                                  title="Remove this entry"
                                >
                                  ×
                                </button>
                              )}
                              {setQuestions.map((setQuestion) => (
                                <div key={setQuestion.id} className="question-item" style={{ marginBottom: '0.75rem' }}>
                                  <label className="question-label">
                                    {setQuestion.question_text}
                                    {setQuestion.is_required && <span className="required-indicator">*</span>}
                                  </label>
                                  {setQuestion.help_text && (
                                    <p className="question-help">{setQuestion.help_text}</p>
                                  )}
                                  {renderQuestion(setQuestion, instanceIdx)}
                                </div>
                              ))}
                            </div>
                          ))}
                          {isLastInSet && (
                            <button
                              type="button"
                              onClick={() => addRepeatableInstance(qIndex)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.5rem 1rem',
                                backgroundColor: '#f3f4f6',
                                border: '1px dashed #9ca3af',
                                borderRadius: '0.375rem',
                                color: '#4b5563',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                                marginBottom: '1rem'
                              }}
                            >
                              <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>+</span>
                              Add Another
                            </button>
                          )}
                        </React.Fragment>
                      )
                    }
                    
                    return (
                      <React.Fragment key={question.id}>
                        <div className="question-item">
                          <label className="question-label">
                            {question.question_text}
                            {question.is_required && <span className="required-indicator">*</span>}
                          </label>
                          {question.help_text && (
                            <p className="question-help">{question.help_text}</p>
                          )}
                          {renderQuestion(question)}
                        </div>
                        {conditionalLoading && conditionalLoadingQuestionId === question.id && (
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        padding: '1rem',
                        color: '#6b7280'
                      }}>
                        <svg 
                          style={{ 
                            width: '1.5rem', 
                            height: '1.5rem', 
                            marginRight: '0.5rem',
                            animation: 'spin 1s linear infinite'
                          }} 
                          fill="none" 
                          viewBox="0 0 24 24"
                        >
                          <circle 
                            style={{ opacity: 0.25 }} 
                            cx="12" 
                            cy="12" 
                            r="10" 
                            stroke="currentColor" 
                            strokeWidth="4"
                          />
                          <path 
                            style={{ opacity: 0.75 }} 
                            fill="currentColor" 
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        <span>Loading next questions...</span>
                      </div>
                        )}
                      </React.Fragment>
                    )
                  })
                })()}
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

                  {/* Show Update button when there are multiple pages and we're not on the last page */}
                  {sessionData.total_pages > 1 && currentPage < sessionData.total_pages && hasChanges && (
                    <button
                      type="button"
                      onClick={async () => {
                        await saveCurrentAnswers()
                        setHasChanges(false)
                      }}
                      disabled={submitting}
                      className="btn btn-secondary"
                      style={{ marginRight: '0.5rem' }}
                    >
                      {submitting ? 'Updating...' : 'Update'}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleNavigate('forward')}
                    disabled={submitting}
                    className="btn btn-primary"
                  >
                    {submitting ? (hasChanges ? 'Updating...' : 'Saving...') : (
                      sessionData.is_last_group && currentPage >= sessionData.total_pages
                        ? (hasChanges ? 'Update' : 'Exit')
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

export default DocumentSessions
