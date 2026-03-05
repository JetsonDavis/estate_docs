import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { sessionService } from '../services/sessionService'
import { InputForm, SessionQuestionsResponse, QuestionToDisplay, ConditionalFollowupQuestion } from '../types/session'
import { Person } from '../types/person'
import { personService } from '../services/personService'
import PersonFormModal from '../components/common/PersonFormModal'
import './InputForms.css'

const InputForms: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const sessionId = searchParams.get('session')
  const navigate = useNavigate()

  // Session list state
  const [sessions, setSessions] = useState<InputForm[]>([])

  // Current session document state
  const [sessionData, setSessionData] = useState<SessionQuestionsResponse | null>(null)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [personAnswers, setPersonAnswers] = useState<Record<number, string[]>>({}) // For multiple person fields
  const [personConjunctions, setPersonConjunctions] = useState<Record<number, Array<'and' | 'then'>>>({}) // Conjunction between each person

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
  const [copyingSessionId, setCopyingSessionId] = useState<number | null>(null)

  // Ref for debouncing answer changes that might affect conditionals
  const conditionalRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Ref for debouncing person answer saves
  const personAnswerSaveTimeoutRef = useRef<Record<number, NodeJS.Timeout | null>>({})

  useEffect(() => {
    if (sessionId) {
      loadSessionQuestions(parseInt(sessionId))
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

  const loadSessionQuestions = async (id: number) => {
    try {
      setLoading(true)
      setError(null)
      const data = await sessionService.getSessionQuestions(id)
      setSessionData(data)
      setIsCompleted(data.is_completed)

      // Pre-fill answers from existing_answers
      const initialAnswers: Record<number, string> = {}
      const initialPersonAnswers: Record<number, string[]> = {}
      const initialPersonConjunctions: Record<number, Array<'and' | 'then'>> = {}

      // First, load ALL existing_answers (including cross-page) into initialAnswers
      // so that the "Replaces" dropdown can find person names from other pages
      for (const [qIdStr, answerValue] of Object.entries(data.existing_answers)) {
        const qId = parseInt(qIdStr, 10)
        initialAnswers[qId] = answerValue as string
      }

      // Helper to parse person answers from an answer value
      const parsePersonAnswer = (qId: number, answerValue: string) => {
        try {
          const parsed = JSON.parse(answerValue)
          if (Array.isArray(parsed)) {
            if (parsed.length > 0 && typeof parsed[0] === 'object' && 'name' in parsed[0]) {
              initialPersonAnswers[qId] = parsed.map((p: any) => p.name)
              initialPersonConjunctions[qId] = parsed.map((p: any) => p.conjunction).filter((c: any) => c)
            } else {
              initialPersonAnswers[qId] = parsed
            }
          }
        } catch {
          // Not an array, it's the new JSON object format - already in initialAnswers
        }
      }

      // Process person answers for top-level questions
      data.questions.forEach(q => {
        if (data.existing_answers[q.id]) {
          if (q.question_type === 'person' || q.question_type === 'person_backup') {
            parsePersonAnswer(q.id, data.existing_answers[q.id])
          }
        } else if (q.question_type === 'person' || q.question_type === 'person_backup') {
          initialPersonAnswers[q.id] = ['']
        }
      })

      // Also process person answers for conditional followup questions (nested)
      const processFollowupPersonAnswers = (cfus: any[] | undefined) => {
        if (!cfus) return
        for (const cfu of cfus) {
          for (const fq of (cfu.questions || [])) {
            if ((fq.question_type === 'person' || fq.question_type === 'person_backup') && data.existing_answers[fq.id]) {
              parsePersonAnswer(fq.id, data.existing_answers[fq.id])
            }
            processFollowupPersonAnswers(fq.conditional_followups)
          }
        }
      }
      data.questions.forEach(q => {
        processFollowupPersonAnswers(q.conditional_followups || undefined)
      })

      // Seed synthetic IDs for followups inside repeatable groups
      // so that answers are available under the synthetic keys used during rendering
      const seedFollowupSyntheticIds = (cfus: any[] | undefined, instanceCount: number) => {
        if (!cfus) return
        for (const cfu of cfus) {
          for (const fq of (cfu.questions || [])) {
            if (fq.repeatable && initialAnswers[fq.id] !== undefined) {
              // Repeatable followups use synthetic IDs for ALL instances (including 0)
              // Copy the real ID answer to synthetic ID 0 so rendering can find it
              for (let i = 0; i < instanceCount; i++) {
                const synId = fq.id * 100000 + i
                if (initialAnswers[synId] === undefined) {
                  initialAnswers[synId] = initialAnswers[fq.id]
                }
                // Also seed personAnswers/personConjunctions for person-type questions
                if ((fq.question_type === 'person' || fq.question_type === 'person_backup') && initialPersonAnswers[fq.id] && !initialPersonAnswers[synId]) {
                  initialPersonAnswers[synId] = [...initialPersonAnswers[fq.id]]
                  if (initialPersonConjunctions[fq.id]) {
                    initialPersonConjunctions[synId] = [...initialPersonConjunctions[fq.id]]
                  }
                }
              }
            } else if (!fq.repeatable && initialAnswers[fq.id] !== undefined) {
              // Non-repeatable followups: instance 0 uses real ID, instances 1+ use synthetic
              for (let i = 1; i < instanceCount; i++) {
                const synId = fq.id * 100000 + i
                if (initialAnswers[synId] === undefined) {
                  initialAnswers[synId] = initialAnswers[fq.id]
                }
              }
            }
            // Recurse into deeper conditional followups
            seedFollowupSyntheticIds(fq.conditional_followups, instanceCount)
          }
        }
      }
      data.questions.forEach(q => {
        if (q.repeatable && initialAnswers[q.id]) {
          try {
            const parsed = JSON.parse(initialAnswers[q.id])
            if (Array.isArray(parsed) && parsed.length >= 1) {
              seedFollowupSyntheticIds(q.conditional_followups || undefined, parsed.length)
            }
          } catch { /* not a JSON array */ }
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
          questions_per_page: 0,
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

  // Find a question by ID in sessionData.questions OR recursively inside conditional_followups
  // Also handles synthetic IDs (realId * 100000 + instanceIdx) used by repeatable followups
  const findQuestionById = (questionId: number): any | undefined => {
    if (!sessionData) return undefined
    // Recursively search conditional_followups for a specific target ID
    const searchFollowups = (cfus: any[] | null | undefined, targetId: number): any | undefined => {
      if (!cfus) return undefined
      for (const cfu of cfus) {
        for (const q of (cfu.questions || [])) {
          if (q.id === targetId) return q
          const deeper = searchFollowups(q.conditional_followups, targetId)
          if (deeper) return deeper
        }
      }
      return undefined
    }
    const searchAll = (targetId: number): any | undefined => {
      const topLevel = sessionData.questions.find(q => q.id === targetId)
      if (topLevel) return topLevel
      for (const q of sessionData.questions) {
        const found = searchFollowups(q.conditional_followups, targetId)
        if (found) return found
      }
      return undefined
    }
    // Try direct ID first
    const direct = searchAll(questionId)
    if (direct) return direct
    // If not found, try deriving real ID from synthetic ID (realId * 100000 + instanceIdx)
    if (questionId >= 100000) {
      const realId = Math.floor(questionId / 100000)
      return searchAll(realId)
    }
    return undefined
  }

  // Get the answer for a synthetic ID, falling back to the real ID
  // This handles initial load where backend answers are keyed by real question ID
  // but the frontend renders non-repeatable followups with synthetic IDs
  const getEffectiveAnswer = (syntheticId: number, realId: number): string => {
    return answers[syntheticId] || answers[realId] || ''
  }

  // Shared conditional evaluation: supports equals, not_equals, count_greater_than, count_equals, count_less_than
  const evaluateConditional = (operator: string | undefined, answer: string, triggerValue: string, fullAnswer?: string): boolean => {
    const op = operator || 'equals'
    if (op === 'equals') return answer === triggerValue
    if (op === 'not_equals') return answer !== triggerValue
    if (op === 'count_greater_than' || op === 'count_equals' || op === 'count_less_than') {
      // Count operators: parse the full answer (JSON array) and compare length to threshold
      const source = fullAnswer !== undefined ? fullAnswer : answer
      let count = 0
      try {
        const parsed = JSON.parse(source)
        if (Array.isArray(parsed)) {
          count = parsed.filter((v: any) => v !== '' && v !== null && v !== undefined).length
        } else if (source && source !== '') {
          count = 1
        }
      } catch {
        count = (source && source !== '') ? 1 : 0
      }
      const threshold = parseInt(triggerValue, 10) || 0
      if (op === 'count_greater_than') return count > threshold
      if (op === 'count_equals') return count === threshold
      return count < threshold // count_less_than
    }
    return false
  }

  // Recursively collect all question IDs from conditional followups that match a given answer.
  // If answer is undefined, collect ALL followup question IDs regardless of matching.
  const collectFollowupQuestionIds = (question: any, answer?: string): number[] => {
    const cfus = question?.conditional_followups
    if (!cfus || cfus.length === 0) return []
    const ids: number[] = []
    for (const cfu of cfus) {
      // If answer provided, only collect from matching branches; otherwise collect all
      const matches = answer === undefined
        ? true
        : evaluateConditional(cfu.operator, answer, cfu.trigger_value, answer)
      if (matches) {
        for (const fq of (cfu.questions || [])) {
          ids.push(fq.id)
          // Recurse into deeper followups (collect all since the parent is being removed)
          ids.push(...collectFollowupQuestionIds(fq))
        }
      }
    }
    return ids
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
  const handleRadioChange = async (questionId: number, newValue: string, instanceIndex: number = 0) => {
    if (!sessionData) return

    const question = findQuestionById(questionId)
    if (!question) return

    // Derive real question ID for backend saves (synthetic IDs are realId * 100000 + instanceIdx)
    const realQuestionId = questionId >= 100000 ? Math.floor(questionId / 100000) : questionId

    console.log('handleRadioChange called:', { questionId, realQuestionId, newValue, instanceIndex, identifier: question.identifier })

    // For repeatable questions, build the full JSON array with the new value
    // We can't rely on reading state here because React may not have flushed the update yet
    let valueToSave = newValue
    if (question.repeatable) {
      const arr = getRepeatableAnswerArray(questionId)
      const updated = [...arr]
      while (updated.length <= instanceIndex) {
        updated.push('')
      }
      updated[instanceIndex] = newValue
      valueToSave = JSON.stringify(updated)
    }

    // Save the answer immediately (use real question ID for backend)
    try {
      await sessionService.saveAnswers(sessionData.session_id, {
        answers: [{ question_id: realQuestionId, answer_value: valueToSave }]
      })
      console.log('Answer saved successfully, valueToSave:', valueToSave)
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

    // Delete answers from ALL conditional branches that don't match the new value.
    // We collect ALL followup IDs, then subtract the ones matching the new value.
    // This handles the case where oldValue was empty (first interaction) or switching
    // between branches — all non-active branches get their answers deleted.
    const allFollowupIds = collectFollowupQuestionIds(question) // undefined = collect ALL
    const newMatchIds = new Set(collectFollowupQuestionIds(question, newValue))
    const idsToDelete = allFollowupIds.filter(id => !newMatchIds.has(id))

    if (idsToDelete.length > 0) {
      if (question.repeatable) {
        // For repeatable parents, followup answer rows are shared across instances.
        // Only clear local state for THIS instance's synthetic IDs — don't delete
        // backend rows, which would wipe other instances' followup answers.
        console.log('Repeatable parent: clearing local followup state for instance', instanceIndex, 'ids:', idsToDelete)
        const syntheticIdsToDelete = idsToDelete.map(id => instanceIndex > 0 ? id * 100000 + instanceIndex : id)
        setAnswers(prev => {
          const updated = { ...prev }
          for (const id of syntheticIdsToDelete) {
            delete updated[id]
          }
          return updated
        })
        setPersonAnswers(prev => {
          const updated = { ...prev }
          for (const id of syntheticIdsToDelete) {
            delete updated[id]
          }
          return updated
        })
        setPersonConjunctions(prev => {
          const updated = { ...prev }
          for (const id of syntheticIdsToDelete) {
            delete updated[id]
          }
          return updated
        })
      } else {
        // Non-repeatable: delete from backend and clear local state
        console.log('Deleting outgoing conditional followup answers:', idsToDelete)
        try {
          await sessionService.deleteAnswers(sessionData.session_id, idsToDelete)
        } catch (err) {
          console.error('Failed to delete outgoing answers:', err)
        }
        // Clear from local state
        setAnswers(prev => {
          const updated = { ...prev }
          for (const id of idsToDelete) {
            delete updated[id]
          }
          return updated
        })
        setPersonAnswers(prev => {
          const updated = { ...prev }
          for (const id of idsToDelete) {
            delete updated[id]
          }
          return updated
        })
        setPersonConjunctions(prev => {
          const updated = { ...prev }
          for (const id of idsToDelete) {
            delete updated[id]
          }
          return updated
        })
      }
    }

    // Trigger conditional refresh
    try {
      setConditionalLoading(true)
      setConditionalLoadingQuestionId(questionId)

      // Refresh questions to re-evaluate conditionals
      const data = await sessionService.getSessionQuestions(
        sessionData.session_id
      )

      // Update session data with new questions
      setSessionData(data)

      // Preserve the just-changed answer and merge with new data
      // For repeatable questions, we need to preserve the full JSON array, not just the raw value
      let preservedValue = newValue
      if (question.repeatable) {
        const arr = getRepeatableAnswerArray(questionId)
        const updated = [...arr]
        while (updated.length <= instanceIndex) {
          updated.push('')
        }
        updated[instanceIndex] = newValue
        preservedValue = JSON.stringify(updated)
      }
      setAnswers(currentAnswers => {
        const newAnswers: Record<number, string> = { ...currentAnswers, [questionId]: preservedValue }

        // Remove deleted IDs that may have been re-added from existing_answers
        for (const id of idsToDelete) {
          delete newAnswers[id]
        }

        data.questions.forEach(q => {
          if (!(q.id in newAnswers) && data.existing_answers[q.id] && q.question_type !== 'person') {
            // Only load from existing_answers if this question wasn't just deleted
            if (!idsToDelete.includes(q.id)) {
              newAnswers[q.id] = data.existing_answers[q.id]
            }
          }
        })

        return newAnswers
      })

      setPersonAnswers(currentPersonAnswers => {
        const newPersonAnswers: Record<number, string[]> = { ...currentPersonAnswers }

        // Remove deleted IDs
        for (const id of idsToDelete) {
          delete newPersonAnswers[id]
        }

        data.questions.forEach(q => {
          if ((q.question_type === 'person' || q.question_type === 'person_backup') && data.existing_answers[q.id]) {
            if (!idsToDelete.includes(q.id)) {
              try {
                const parsed = JSON.parse(data.existing_answers[q.id])
                if (Array.isArray(parsed)) {
                  newPersonAnswers[q.id] = parsed
                }
              } catch {
                // Not an array, ignore
              }
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
  const handleAnswerBlur = async (questionId: number, valueOverride?: string) => {
    if (!sessionData) return

    const question = findQuestionById(questionId)
    if (!question) return

    // Derive real question ID for backend saves (synthetic IDs are realId * 100000 + instanceIdx)
    const realQuestionId = questionId >= 100000 ? Math.floor(questionId / 100000) : questionId

    // Save the current answer value (use override if provided to avoid stale state)
    const currentValue = valueOverride !== undefined ? valueOverride : (answers[questionId] || '')
    try {
      await sessionService.saveAnswers(sessionData.session_id, {
        answers: [{ question_id: realQuestionId, answer_value: currentValue }]
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

    // Delete answers from ALL conditional branches that don't match the current value.
    // This mirrors the logic in handleRadioChange.
    const allFollowupIds = collectFollowupQuestionIds(question)
    const newMatchIds = new Set(collectFollowupQuestionIds(question, currentValue))
    const idsToDelete = allFollowupIds.filter(id => !newMatchIds.has(id))

    // Derive instance index from synthetic ID
    const blurInstanceIndex = questionId >= 100000 ? questionId % 100000 : 0

    if (idsToDelete.length > 0) {
      if (question.repeatable) {
        // For repeatable parents, followup answer rows are shared across instances.
        // Only clear local state for THIS instance's synthetic IDs.
        console.log('handleAnswerBlur: Repeatable parent, clearing local followup state for instance', blurInstanceIndex, 'ids:', idsToDelete)
        const syntheticIdsToDelete = idsToDelete.map(id => blurInstanceIndex > 0 ? id * 100000 + blurInstanceIndex : id)
        setAnswers(prev => {
          const updated = { ...prev }
          for (const id of syntheticIdsToDelete) {
            delete updated[id]
          }
          return updated
        })
        setPersonAnswers(prev => {
          const updated = { ...prev }
          for (const id of syntheticIdsToDelete) {
            delete updated[id]
          }
          return updated
        })
        setPersonConjunctions(prev => {
          const updated = { ...prev }
          for (const id of syntheticIdsToDelete) {
            delete updated[id]
          }
          return updated
        })
      } else {
        // Non-repeatable: delete from backend and clear local state
        console.log('handleAnswerBlur: Deleting outgoing conditional followup answers:', idsToDelete)
        try {
          await sessionService.deleteAnswers(sessionData.session_id, idsToDelete)
        } catch (err) {
          console.error('Failed to delete outgoing answers:', err)
        }
        setAnswers(prev => {
          const updated = { ...prev }
          for (const id of idsToDelete) {
            delete updated[id]
          }
          return updated
        })
        setPersonAnswers(prev => {
          const updated = { ...prev }
          for (const id of idsToDelete) {
            delete updated[id]
          }
          return updated
        })
        setPersonConjunctions(prev => {
          const updated = { ...prev }
          for (const id of idsToDelete) {
            delete updated[id]
          }
          return updated
        })
      }
    }

    // Trigger conditional refresh
    try {
      setConditionalLoading(true)
      setConditionalLoadingQuestionId(questionId)

      // Refresh questions to re-evaluate conditionals
      const data = await sessionService.getSessionQuestions(
        sessionData.session_id
      )

      // Update session data with new questions
      setSessionData(data)

      // Use functional updates to get current state and merge with new data
      setAnswers(currentAnswers => {
        const value = currentAnswers[questionId] || ''
        const newAnswers: Record<number, string> = { ...currentAnswers, [questionId]: value }

        // Remove deleted IDs that may have been re-added from existing_answers
        for (const id of idsToDelete) {
          delete newAnswers[id]
        }

        data.questions.forEach(q => {
          // Only set from existing_answers if we don't have a local answer
          // and this question wasn't just deleted
          if (!(q.id in newAnswers) && data.existing_answers[q.id] && q.question_type !== 'person') {
            if (!idsToDelete.includes(q.id)) {
              newAnswers[q.id] = data.existing_answers[q.id]
            }
          }
        })

        return newAnswers
      })

      setPersonAnswers(currentPersonAnswers => {
        const newPersonAnswers: Record<number, string[]> = { ...currentPersonAnswers }

        // Remove deleted IDs
        for (const id of idsToDelete) {
          delete newPersonAnswers[id]
        }

        data.questions.forEach(q => {
          if (q.question_type === 'person' || q.question_type === 'person_backup') {
            if (!(q.id in newPersonAnswers) && data.existing_answers[q.id]) {
              if (!idsToDelete.includes(q.id)) {
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
          if ((q.question_type === 'person' || q.question_type === 'person_backup') && data.existing_answers[q.id]) {
            if (!idsToDelete.includes(q.id)) {
              try {
                const parsed = JSON.parse(data.existing_answers[q.id])
                if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object' && 'conjunction' in parsed[0]) {
                  newConjunctions[q.id] = parsed.slice(0, -1).map((p: any) => p.conjunction || 'and')
                }
              } catch {
                // ignore
              }
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
        if (q.question_type === 'person' || q.question_type === 'person_backup') {
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

      // Check if this is an Exit (no changes) on the last group
      const isLastGroup = sessionData.is_last_group

      if (direction === 'forward' && isLastGroup && !hasChanges) {
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
        await loadSessionQuestions(sessionData.session_id)
        // Reset hasChanges for new group
        setHasChanges(false)
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to navigate')
    } finally {
      setSubmitting(false)
    }
  }

  // Replace ## token in question text with the 1-based loop number
  const replaceLoopToken = (text: string, instanceIndex: number): string => {
    return text.replace(/##/g, String(instanceIndex + 1))
  }

  // Helper functions for repeatable questions
  const getRepeatableAnswerArray = (questionId: number): string[] => {
    const value = answers[questionId] || ''
    if (!value) return ['']
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        if (parsed.length === 0) return ['']
        // Ensure all elements are strings. If an element is an object
        // (legacy format from old savePersonAnswer: [{name: "...", conjunction: "..."}]),
        // convert it to the JSON string format the inline person form expects.
        return parsed.map((item: any) => {
          if (typeof item === 'string') return item
          if (typeof item === 'object' && item !== null) {
            // Legacy format: {name: "{\"name\":\"John\",...}", conjunction: "and"}
            // The 'name' field may itself be a JSON string of person data
            if ('name' in item && typeof item.name === 'string') {
              try {
                const innerParsed = JSON.parse(item.name)
                if (typeof innerParsed === 'object' && innerParsed !== null) {
                  // Merge conjunction from outer object into inner person data
                  if (item.conjunction) {
                    innerParsed.conjunction = item.conjunction
                  }
                  return JSON.stringify(innerParsed)
                }
              } catch {
                // name is a plain string, build person object from legacy fields
              }
              // Plain name string — build a person object
              const personObj: Record<string, any> = { name: item.name }
              if (item.conjunction) personObj.conjunction = item.conjunction
              return JSON.stringify(personObj)
            }
            // Generic object — stringify it
            return JSON.stringify(item)
          }
          return String(item)
        })
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

  // Find ALL questions with the same repeatable_group_id (not just consecutive ones)
  // This handles nested questions inside conditionals that aren't adjacent in the flat array
  const getRepeatableSetQuestionIds = (questionIndex: number): number[] => {
    if (!sessionData) return []
    const questions = sessionData.questions
    const currentQuestion = questions[questionIndex]
    const currentGroupId = currentQuestion?.repeatable_group_id
    if (!currentGroupId) return [currentQuestion.id]

    const ids: number[] = []
    for (const q of questions) {
      if (q.repeatable && q.repeatable_group_id === currentGroupId) {
        ids.push(q.id)
      }
    }
    return ids
  }

  const getRepeatableSetStartIndex = (questionIndex: number): number => {
    if (!sessionData) return questionIndex
    const questions = sessionData.questions
    const currentQuestion = questions[questionIndex]
    const currentGroupId = currentQuestion?.repeatable_group_id
    if (!currentGroupId) return questionIndex

    // Find the first question in the array with this group ID
    for (let i = 0; i < questions.length; i++) {
      if (questions[i].repeatable && questions[i].repeatable_group_id === currentGroupId) {
        return i
      }
    }
    return questionIndex
  }

  const isLastInRepeatableSet = (questionIndex: number): boolean => {
    if (!sessionData) return false
    const questions = sessionData.questions
    const currentQuestion = questions[questionIndex]
    if (!currentQuestion?.repeatable) return false

    const currentGroupId = currentQuestion.repeatable_group_id
    if (!currentGroupId) return true

    // Find the last question in the array with this group ID
    let lastIndex = questionIndex
    for (let i = 0; i < questions.length; i++) {
      if (questions[i].repeatable && questions[i].repeatable_group_id === currentGroupId) {
        lastIndex = i
      }
    }
    return questionIndex === lastIndex
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
            sessionData.session_id
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
                      handleRadioChange(question.id, e.target.value, instanceIndex)
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
            onBlur={(e) => {
              // For repeatable questions, save the entire array to avoid overwriting other instances
              if (question.repeatable) {
                // Get current array and update THIS instance with the fresh value from the input
                const currentArray = getRepeatableAnswerArray(question.id)
                const updated = [...currentArray]
                // Ensure array is long enough
                while (updated.length <= instanceIndex) {
                  updated.push('')
                }
                // Use the fresh value from e.target.value to avoid stale state
                updated[instanceIndex] = e.target.value
                handleAnswerBlur(question.id, JSON.stringify(updated))
              } else {
                handleAnswerBlur(question.id, e.target.value)
              }
            }}
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
            onBlur={(e) => {
              // For repeatable questions, save the entire array to avoid overwriting other instances
              if (question.repeatable) {
                // Get current array and update THIS instance with the fresh value from the input
                const currentArray = getRepeatableAnswerArray(question.id)
                const updated = [...currentArray]
                // Ensure array is long enough
                while (updated.length <= instanceIndex) {
                  updated.push('')
                }
                // Use the fresh value from e.target.value to avoid stale state
                updated[instanceIndex] = e.target.value
                handleAnswerBlur(question.id, JSON.stringify(updated))
              } else {
                handleAnswerBlur(question.id, e.target.value)
              }
            }}
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

        // Collect ALL person/person_backup names from the entire document
        // excluding the current instance
        const earlierPeople: Array<{ name: string; data: Record<string, any> }> = []
        if (sessionData) {
          for (const q of sessionData.questions) {
            if (q.question_type === 'person' || q.question_type === 'person_backup') {
              const answerValue = answers[q.id]
              if (answerValue) {
                try {
                  const parsed = JSON.parse(answerValue)
                  if (Array.isArray(parsed)) {
                    for (let pIdx = 0; pIdx < parsed.length; pIdx++) {
                      const personObj = typeof parsed[pIdx] === 'string' ? (parsed[pIdx] ? JSON.parse(parsed[pIdx]) : null) : parsed[pIdx]
                      // Skip the current instance of this question
                      if (q.id === question.id && pIdx === instanceIndex) continue
                      if (personObj && typeof personObj === 'object' && personObj.name?.trim()) {
                        // Avoid duplicates
                        if (!earlierPeople.some(p => p.name.toLowerCase() === personObj.name.toLowerCase())) {
                          earlierPeople.push({ name: personObj.name, data: personObj })
                        }
                      }
                    }
                  } else if (parsed && typeof parsed === 'object' && parsed.name?.trim()) {
                    // Skip if this is the current question instance 0
                    if (q.id === question.id && instanceIndex === 0) continue
                    if (!earlierPeople.some(p => p.name.toLowerCase() === parsed.name.toLowerCase())) {
                      earlierPeople.push({ name: parsed.name, data: parsed })
                    }
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
          // Get current value from repeatable array to avoid stale state
          const currentArray = getRepeatableAnswerArray(question.id)
          const currentValue = JSON.stringify(currentArray)
          handleAnswerBlur(question.id, currentValue)
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
            {/* Conjunction dropdown for 2nd+ instances of repeatable questions */}
            {question.repeatable && instanceIndex > 0 && (
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem', color: '#7c3aed' }}>Relationship to Previous Entry</label>
                <select
                  className="question-select"
                  value={personData.conjunction || 'and'}
                  onChange={(e) => updatePersonField('conjunction', e.target.value)}
                  onBlur={savePersonOnBlur}
                  style={{ fontSize: '0.875rem' }}
                >
                  <option value="and">And</option>
                  <option value="or">Or</option>
                  <option value="then">Then</option>
                </select>
              </div>
            )}

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
              <details style={{ marginTop: '0.5rem' }}>
                <summary style={{ cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500, color: '#4b5563', userSelect: 'none', padding: '0.25rem 0' }}>
                  Details
                </summary>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}>
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

                </div>
              </details>
            )}
          </div>
        )

      case 'person_backup':
        // Parse the current answer as JSON object with person fields + replaces field
        let personBackupData: Record<string, any> = {}
        try {
          if (value) {
            personBackupData = JSON.parse(value)
          }
        } catch {
          personBackupData = {}
        }

        // Helper function to calculate group number based on 'then' conjunctions
        const calculateGroupNumber = (instances: string[]): number[] => {
          const groups: number[] = [0] // First instance is always group 0
          let currentGroup = 0

          for (let i = 1; i < instances.length; i++) {
            try {
              const parsed = JSON.parse(instances[i])
              if (parsed && typeof parsed === 'object' && parsed.conjunction === 'then') {
                currentGroup++
              }
            } catch {
              // If parsing fails, stay in current group
            }
            groups.push(currentGroup)
          }

          return groups
        }

        // Collect ALL person/person_backup names from the entire document
        // excluding the current instance
        const earlierPeopleBackup: Array<{ name: string; data: Record<string, any> }> = []
        if (sessionData) {
          for (const q of sessionData.questions) {
            if (q.question_type === 'person' || q.question_type === 'person_backup') {
              const answerValue = answers[q.id]
              if (answerValue) {
                try {
                  const parsed = JSON.parse(answerValue)
                  if (Array.isArray(parsed)) {
                    for (let pIdx = 0; pIdx < parsed.length; pIdx++) {
                      const personObj = typeof parsed[pIdx] === 'string' ? (parsed[pIdx] ? JSON.parse(parsed[pIdx]) : null) : parsed[pIdx]
                      // Skip the current instance of this question
                      if (q.id === question.id && pIdx === instanceIndex) continue
                      if (personObj && typeof personObj === 'object' && personObj.name?.trim()) {
                        if (!earlierPeopleBackup.some(p => p.name.toLowerCase() === personObj.name.toLowerCase())) {
                          earlierPeopleBackup.push({ name: personObj.name, data: personObj })
                        }
                      }
                    }
                  } else if (parsed && typeof parsed === 'object' && parsed.name?.trim()) {
                    if (q.id === question.id && instanceIndex === 0) continue
                    if (!earlierPeopleBackup.some(p => p.name.toLowerCase() === parsed.name.toLowerCase())) {
                      earlierPeopleBackup.push({ name: parsed.name, data: parsed })
                    }
                  }
                } catch {
                  // Skip invalid JSON
                }
              }
            }
          }
        }

        // Build "Replaces" dropdown options:
        // 1. All person names from ALL pages (trustors from person-type questions)
        // 2. Person backups from earlier questions on this page
        // 3. Person backups from earlier "then" groups within the same repeatable question
        const replaceablePersons: string[] = []

        // Helper to extract plain person names from an answer value
        // Handles: new format ["{"name":"John",...}"], legacy format [{"name":"{"name":"John"}"}], single objects
        const extractNamesFromAnswer = (answerValue: string): string[] => {
          const names: string[] = []
          try {
            const parsed = JSON.parse(answerValue)
            if (Array.isArray(parsed)) {
              for (const personObj of parsed) {
                let obj = typeof personObj === 'string' ? (personObj ? JSON.parse(personObj) : null) : personObj
                if (obj && typeof obj === 'object' && obj.name) {
                  let nameVal = obj.name
                  // Unwrap if name is itself a JSON string (legacy double-encoding)
                  if (typeof nameVal === 'string' && nameVal.startsWith('{')) {
                    try {
                      const inner = JSON.parse(nameVal)
                      if (inner?.name) nameVal = inner.name
                    } catch { /* use as-is */ }
                  }
                  if (typeof nameVal === 'string' && nameVal.trim()) names.push(nameVal)
                }
              }
            } else if (parsed && typeof parsed === 'object' && parsed.name?.trim()) {
              names.push(parsed.name)
            }
          } catch { /* skip */ }
          return names
        }

        if (sessionData) {
          const currentQuestionIndex = sessionData.questions.findIndex(q => q.id === question.id)

          // First: scan ALL answers (including cross-page) for person/person_backup names
          // The answers state now includes existing_answers from all pages
          // We need to check all answers, but we only know question_type for current-page questions
          // For cross-page answers, extract names from any answer that looks like person data
          const currentPageQIds = new Set(sessionData.questions.map(q => q.id))

          // Extract names from cross-page answers (not on current page)
          for (const [qIdStr, answerValue] of Object.entries(answers)) {
            const qId = parseInt(qIdStr, 10)
            if (currentPageQIds.has(qId)) continue // handled below with type info
            if (!answerValue) continue
            // For cross-page answers, try to extract person names
            const names = extractNamesFromAnswer(answerValue)
            for (const name of names) {
              if (!replaceablePersons.includes(name)) {
                replaceablePersons.push(name)
              }
            }
          }

          // Then: scan current-page questions with full type info
          for (const q of sessionData.questions) {
            const qIndex = sessionData.questions.indexOf(q)
            const answerValue = answers[q.id]
            if (!answerValue) continue

            try {
              const parsed = JSON.parse(answerValue)

              if (q.question_type === 'person') {
                // All person (trustor) names go into the replaces dropdown
                const names = extractNamesFromAnswer(answerValue)
                for (const name of names) {
                  if (!replaceablePersons.includes(name)) {
                    replaceablePersons.push(name)
                  }
                }
              } else if (q.question_type === 'person_backup' && qIndex < currentQuestionIndex) {
                // Person backups from earlier questions (e.g., initial trustees)
                const names = extractNamesFromAnswer(answerValue)
                for (const name of names) {
                  if (!replaceablePersons.includes(name)) {
                    replaceablePersons.push(name)
                  }
                }
              } else if (q.question_type === 'person_backup' && q.id === question.id && q.repeatable) {
                // Same question — include names from earlier "then" groups
                if (Array.isArray(parsed)) {
                  // Determine which "then" group the current instance belongs to
                  let currentGroupNum = 0
                  for (let i = 1; i <= instanceIndex; i++) {
                    const inst = typeof parsed[i] === 'string' ? (parsed[i] ? JSON.parse(parsed[i]) : null) : parsed[i]
                    if (inst?.conjunction === 'then') currentGroupNum++
                  }
                  // Collect names from earlier "then" groups (groupNum < currentGroupNum)
                  let groupNum = 0
                  for (let i = 0; i < parsed.length; i++) {
                    const inst = typeof parsed[i] === 'string' ? (parsed[i] ? JSON.parse(parsed[i]) : null) : parsed[i]
                    if (i > 0 && inst?.conjunction === 'then') groupNum++
                    if (groupNum < currentGroupNum && inst?.name?.trim() && !replaceablePersons.includes(inst.name)) {
                      replaceablePersons.push(inst.name)
                    }
                  }
                }
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }

        // Check if current name matches an earlier person
        const matchedPersonBackup = earlierPeopleBackup.find(p =>
          p.name.toLowerCase() === (personBackupData.name || '').toLowerCase() && personBackupData.name?.trim()
        )

        // Update person field in local state only (called on every keystroke)
        const updatePersonBackupField = (field: string, fieldValue: string) => {
          // If updating name and it matches an earlier person, copy all their data
          if (field === 'name') {
            const match = earlierPeopleBackup.find(p => p.name.toLowerCase() === fieldValue.toLowerCase())
            if (match) {
              handleValueChange(JSON.stringify({ ...match.data, replaces: personBackupData.replaces }))
              return
            }
          }
          const newData = { ...personBackupData, [field]: fieldValue }
          handleValueChange(JSON.stringify(newData))
        }

        const updatePersonBackupAddressField = (addressType: 'mailing_address' | 'physical_address', field: string, fieldValue: string) => {
          const currentAddress = personBackupData[addressType] || {}
          const newAddress = { ...currentAddress, [field]: fieldValue }
          const newData = { ...personBackupData, [addressType]: newAddress }
          handleValueChange(JSON.stringify(newData))
        }

        // Save person data on blur (called when field loses focus)
        const savePersonBackupOnBlur = () => {
          // Get current value from repeatable array to avoid stale state
          const currentArray = getRepeatableAnswerArray(question.id)
          const currentValue = JSON.stringify(currentArray)
          handleAnswerBlur(question.id, currentValue)
        }

        // Update a field AND immediately save (for <select> elements where onBlur is unreliable)
        const updateAndSavePersonBackupField = (field: string, fieldValue: string) => {
          const newData = { ...personBackupData, [field]: fieldValue }
          const newJson = JSON.stringify(newData)
          // Update local state
          handleValueChange(newJson)
          // Build the full array with the updated value and save immediately
          const currentArray = getRepeatableAnswerArray(question.id)
          const updatedArray = [...currentArray]
          updatedArray[instanceIndex] = newJson
          handleAnswerBlur(question.id, JSON.stringify(updatedArray))
        }

        const US_STATES_BACKUP = [
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
            {/* Conjunction dropdown for 2nd+ instances of repeatable questions */}
            {question.repeatable && instanceIndex > 0 && (
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem', color: '#7c3aed' }}>Relationship to Previous Entry</label>
                <select
                  className="question-select"
                  value={personBackupData.conjunction || 'and'}
                  onChange={(e) => updateAndSavePersonBackupField('conjunction', e.target.value)}
                  style={{ fontSize: '0.875rem' }}
                >
                  <option value="and">And</option>
                  <option value="or">Or</option>
                  <option value="then">Then</option>
                </select>
              </div>
            )}

            {/* Replaces field - appears first for Person (Backup) */}
            <div style={{ borderBottom: '2px solid #3b82f6', paddingBottom: '1rem', marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem', color: '#3b82f6' }}>Replaces (Person Being Replaced)</label>
              <select
                className="question-select"
                value={personBackupData.replaces || ''}
                onChange={(e) => updateAndSavePersonBackupField('replaces', e.target.value)}
              >
                <option value="">Select person being replaced...</option>
                <option value="Previous Group">Previous Group</option>
                {replaceablePersons.map((name, idx) => (
                  <option key={idx} value={name}>{name}</option>
                ))}
              </select>
            </div>

            {/* Relationship Changes To dropdown - hidden when "Previous Group" is selected */}
            {personBackupData.replaces !== 'Previous Group' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem', color: '#3b82f6' }}>Relationship Becomes</label>
                <select
                  className="question-select"
                  value={personBackupData.relationship_changes_to || 'and'}
                  onChange={(e) => updateAndSavePersonBackupField('relationship_changes_to', e.target.value)}
                  style={{ fontSize: '0.875rem' }}
                >
                  <option value="and">And</option>
                  <option value="or">Or</option>
                  <option value="none">None</option>
                </select>
              </div>
            )}

            {/* Name with type-ahead from earlier form entries */}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Name</label>
              <input
                type="text"
                className="question-input"
                value={personBackupData.name || ''}
                onChange={(e) => updatePersonBackupField('name', e.target.value)}
                onBlur={savePersonBackupOnBlur}
                placeholder="Full name"
                list={`person-backup-typeahead-${question.id}-${instanceIndex}`}
                autoComplete="off"
              />
              <datalist id={`person-backup-typeahead-${question.id}-${instanceIndex}`}>
                {earlierPeopleBackup.map((person, idx) => (
                  <option key={idx} value={person.name} />
                ))}
              </datalist>
              {matchedPersonBackup && (
                <p style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.25rem' }}>
                  ✓ Matched with earlier entry
                </p>
              )}
            </div>

            {/* Rest of person fields - same as regular person */}
            {(personBackupData.name || matchedPersonBackup) && (
              <details style={{ marginTop: '0.5rem' }}>
                <summary style={{ cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500, color: '#4b5563', userSelect: 'none', padding: '0.25rem 0' }}>
                  Details
                </summary>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Email</label>
                <input
                  type="email"
                  className="question-input"
                  value={personBackupData.email || ''}
                  onChange={(e) => updatePersonBackupField('email', e.target.value)}
                  onBlur={savePersonBackupOnBlur}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Phone</label>
                <input
                  type="tel"
                  className="question-input"
                  value={personBackupData.phone || ''}
                  onChange={(e) => updatePersonBackupField('phone', e.target.value)}
                  onBlur={savePersonBackupOnBlur}
                />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Occupation</label>
              <input
                type="text"
                className="question-input"
                value={personBackupData.occupation || ''}
                onChange={(e) => updatePersonBackupField('occupation', e.target.value)}
                onBlur={savePersonBackupOnBlur}
              />
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
                    value={personBackupData.mailing_address?.line1 || ''}
                    onChange={(e) => updatePersonBackupAddressField('mailing_address', 'line1', e.target.value)}
                    onBlur={savePersonBackupOnBlur}
                    placeholder="Street address"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Address Line 2</label>
                  <input
                    type="text"
                    className="question-input"
                    value={personBackupData.mailing_address?.line2 || ''}
                    onChange={(e) => updatePersonBackupAddressField('mailing_address', 'line2', e.target.value)}
                    onBlur={savePersonBackupOnBlur}
                    placeholder="Apt, suite, etc. (optional)"
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>City</label>
                    <input
                      type="text"
                      className="question-input"
                      value={personBackupData.mailing_address?.city || ''}
                      onChange={(e) => updatePersonBackupAddressField('mailing_address', 'city', e.target.value)}
                      onBlur={savePersonBackupOnBlur}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>State</label>
                    <select
                      className="question-select"
                      value={personBackupData.mailing_address?.state || ''}
                      onChange={(e) => updatePersonBackupAddressField('mailing_address', 'state', e.target.value)}
                      onBlur={savePersonBackupOnBlur}
                    >
                      <option value="">Select State</option>
                      {US_STATES_BACKUP.map(state => (
                        <option key={state.value} value={state.value}>{state.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>ZIP Code</label>
                    <input
                      type="text"
                      className="question-input"
                      value={personBackupData.mailing_address?.zip || ''}
                      onChange={(e) => updatePersonBackupAddressField('mailing_address', 'zip', e.target.value)}
                      onBlur={savePersonBackupOnBlur}
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
                    value={personBackupData.physical_address?.line1 || ''}
                    onChange={(e) => updatePersonBackupAddressField('physical_address', 'line1', e.target.value)}
                    onBlur={savePersonBackupOnBlur}
                    placeholder="Street address"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Address Line 2</label>
                  <input
                    type="text"
                    className="question-input"
                    value={personBackupData.physical_address?.line2 || ''}
                    onChange={(e) => updatePersonBackupAddressField('physical_address', 'line2', e.target.value)}
                    onBlur={savePersonBackupOnBlur}
                    placeholder="Apt, suite, etc. (optional)"
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>City</label>
                    <input
                      type="text"
                      className="question-input"
                      value={personBackupData.physical_address?.city || ''}
                      onChange={(e) => updatePersonBackupAddressField('physical_address', 'city', e.target.value)}
                      onBlur={savePersonBackupOnBlur}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>State</label>
                    <select
                      className="question-select"
                      value={personBackupData.physical_address?.state || ''}
                      onChange={(e) => updatePersonBackupAddressField('physical_address', 'state', e.target.value)}
                      onBlur={savePersonBackupOnBlur}
                    >
                      <option value="">Select State</option>
                      {US_STATES_BACKUP.map(state => (
                        <option key={state.value} value={state.value}>{state.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>ZIP Code</label>
                    <input
                      type="text"
                      className="question-input"
                      value={personBackupData.physical_address?.zip || ''}
                      onChange={(e) => updatePersonBackupAddressField('physical_address', 'zip', e.target.value)}
                      onBlur={savePersonBackupOnBlur}
                      placeholder="12345"
                      maxLength={10}
                    />
                  </div>
                </div>
              </div>
            </div>

                </div>
              </details>
            )}
          </div>
        )

      case 'dropdown':
      case 'database_dropdown':
        return (
          <select
            className="question-select"
            value={value}
            onChange={(e) => {
              handleValueChange(e.target.value)
              handleRadioChange(question.id, e.target.value, instanceIndex)
            }}
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
            onBlur={(e) => handleAnswerBlur(question.id, e.target.value)}
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
                      <div>
                        <div className="session-name">{session.client_identifier}</div>
                        {session.current_group_name && (
                          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                            <span style={{ fontWeight: 500 }}>Question Group:</span> {session.current_group_name}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span
                          className={`session-status ${session.is_completed ? 'status-completed' : 'status-in-progress'}`}
                          onClick={async (e) => {
                            if (!session.is_completed) {
                              e.stopPropagation()
                              try {
                                await sessionService.markSessionComplete(session.id)
                                // Update the local state to reflect the change
                                setSessions(prev => prev.map(s =>
                                  s.id === session.id
                                    ? { ...s, is_completed: true }
                                    : s
                                ))
                              } catch (err: any) {
                                alert('Failed to mark session as complete: ' + (err.response?.data?.detail || err.message))
                              }
                            }
                          }}
                          style={{
                            cursor: session.is_completed ? 'default' : 'pointer'
                          }}
                          title={session.is_completed ? '' : 'Click to mark as Finished'}
                        >
                          {session.is_completed ? 'Completed' : 'In Progress'}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setCopyingSessionId(session.id)
                            sessionService.copySession(session.id)
                              .then((copiedSession) => {
                                // Insert the copied session directly above the original
                                setSessions(prev => {
                                  const index = prev.findIndex(s => s.id === session.id)
                                  if (index !== -1) {
                                    const newSessions = [...prev]
                                    newSessions.splice(index, 0, copiedSession)
                                    return newSessions
                                  }
                                  return [copiedSession, ...prev]
                                })
                              })
                              .catch(err => {
                                alert('Failed to copy form: ' + (err.response?.data?.detail || err.message))
                              })
                              .finally(() => {
                                setCopyingSessionId(null)
                              })
                          }}
                          style={{
                            padding: '0.375rem',
                            color: '#0ea5e9',
                            background: 'white',
                            border: '1px solid #0ea5e9',
                            borderRadius: '0.25rem',
                            cursor: copyingSessionId === session.id ? 'wait' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Copy"
                          disabled={copyingSessionId === session.id}
                        >
                          {copyingSessionId === session.id ? (
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '1rem', height: '1rem', animation: 'spin 1s linear infinite' }}>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          ) : (
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '1rem', height: '1rem' }}>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          )}
                        </button>
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
                  let topLevelQuestionNum = 0

                  return sessionData.questions.map((question, qIndex) => {
                    // Hide questions after the triggering question while loading
                    if (conditionalLoading && triggerIndex >= 0 && qIndex > triggerIndex) {
                      return null
                    }

                    // For repeatable questions, render as a repeatable block with per-instance follow-ups
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
                      // We render the entire set as one block, so always show "Add Another"
                      const isLastInSet = true

                      return (
                        <div
                          key={`repeatable-set-${setStartIndex}`}
                          style={{
                            border: '1px solid #e5e7eb',
                            borderRadius: '0.5rem',
                            backgroundColor: '#fafafa',
                            marginBottom: '1rem'
                          }}
                        >
                          {Array.from({ length: instanceCount }).map((_, instanceIdx) => (
                            <div
                              key={`instance-${instanceIdx}`}
                              className="repeatable-instance"
                              style={{
                                padding: '1rem',
                                borderBottom: instanceIdx < instanceCount - 1 ? '1px solid #e5e7eb' : 'none',
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
                                    fontSize: '0.85rem',
                                    lineHeight: 1,
                                    padding: '0.25rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem'
                                  }}
                                  title="Remove this entry"
                                >
                                  <span aria-hidden="true">×</span> Remove
                                </button>
                              )}
                              {setQuestions.map((setQuestion, setQIdx) => {
                                // Use hierarchical number from backend, fallback to simple counter
                                const baseNumber = setQuestion.hierarchical_number || '1'
                                const setQLabel = baseNumber
                                // Get this instance's answer for determining follow-ups
                                const instanceAnswer = setQuestion.repeatable
                                  ? getRepeatableAnswerArray(setQuestion.id)[instanceIdx] || ''
                                  : answers[setQuestion.id] || ''

                                // Find matching conditional follow-ups for this instance's answer
                                const fullRawAnswer = answers[setQuestion.id] || ''
                                const matchingFollowups = setQuestion.conditional_followups?.filter(fu => {
                                  return evaluateConditional(fu.operator, instanceAnswer, fu.trigger_value, fullRawAnswer)
                                }) || []

                                return (
                                  <React.Fragment key={setQuestion.id}>
                                    <div className="question-item" style={{ marginBottom: matchingFollowups.length > 0 ? '0.25rem' : '0.75rem' }}>
                                      <label className="question-label">
                                        <span style={{ color: '#6b7280', fontWeight: 600, marginRight: '0.35rem' }}>{setQLabel}.</span>
                                        {replaceLoopToken(setQuestion.question_text, instanceIdx)}
                                        {setQuestion.is_required && <span className="required-indicator">*</span>}
                                      </label>
                                      {setQuestion.help_text && (
                                        <p className="question-help">{replaceLoopToken(setQuestion.help_text, instanceIdx)}</p>
                                      )}
                                      {renderQuestion(setQuestion, instanceIdx)}
                                    </div>
                                    {(() => {
                                      // Recursive renderer for nested conditional followups to arbitrary depth
                                      // Handles both repeatable and non-repeatable nested questions
                                      // Uses synthetic IDs (realId * 100000 + instanceIdx) for non-repeatable questions
                                      // so each parent repeatable instance gets its own answer key
                                      const renderNestedFollowups = (question: any, parentInstanceIdx: number, depth: number, keyPrefix: string, parentLabel: string = ''): React.ReactNode[] => {
                                        // Use synthetic ID if available (set on virtualQ), falling back to real ID
                                        const effectiveId = question.id
                                        const realId = effectiveId >= 100000 ? Math.floor(effectiveId / 100000) : effectiveId
                                        const qAnswer = getEffectiveAnswer(effectiveId, realId)
                                        const matchedFollowups = (question as any).conditional_followups?.filter((cfu: any) => {
                                          return evaluateConditional(cfu.operator, qAnswer, cfu.trigger_value, qAnswer)
                                        }) || []
                                        if (matchedFollowups.length === 0) return []

                                        const allNestedQs = matchedFollowups.flatMap((nfu: any) => nfu.questions)
                                        const renderedRepeatableGroups = new Set<string>()

                                        let nestedQCounter = 0
                                        return allNestedQs.map((nfq: any, nfqIdx: number) => {
                                          const nfqKey = `${keyPrefix}-nfq-${nfq.id}-${parentInstanceIdx}-d${depth}-${nfqIdx}`
                                          nestedQCounter++
                                          const nfqLabel = nfq.hierarchical_number || `${parentLabel}-${nestedQCounter}`

                                          if (nfq.repeatable) {
                                            // Repeatable nested follow-up: render with Add Another pattern
                                            const rGroupId = nfq.repeatable_group_id || String(nfq.id)
                                            const rGroupKey = `${rGroupId}-${parentInstanceIdx}-d${depth}`
                                            if (renderedRepeatableGroups.has(rGroupKey)) return null
                                            renderedRepeatableGroups.add(rGroupKey)

                                            // Collect all repeatable questions in this group from allNestedQs
                                            const rSetQs = allNestedQs.filter((q: any) =>
                                              q.repeatable && (q.repeatable_group_id || String(q.id)) === rGroupId
                                            )
                                            const rSyntheticIds = rSetQs.map((q: any) => q.id * 100000 + parentInstanceIdx)

                                            // Get instance count
                                            let rInstanceCount = 1
                                            for (const sid of rSyntheticIds) {
                                              const arr = getRepeatableAnswerArray(sid)
                                              if (arr.length > rInstanceCount) rInstanceCount = arr.length
                                            }

                                            return (
                                              <div key={nfqKey} style={{
                                                marginBottom: '0.75rem', marginLeft: `${depth}rem`,
                                                borderLeft: '2px solid #d1d5db', paddingLeft: '1rem',
                                                border: '1px solid #e5e7eb', borderRadius: '0.5rem',
                                                backgroundColor: '#fafafa'
                                              }}>
                                                {Array.from({ length: rInstanceCount }).map((_, rIdx) => (
                                                  <div key={`${nfqKey}-ri-${rIdx}`} style={{
                                                    padding: '0.75rem',
                                                    borderBottom: rIdx < rInstanceCount - 1 ? '1px solid #e5e7eb' : 'none',
                                                    position: 'relative'
                                                  }}>
                                                    {rInstanceCount > 1 && (
                                                      <button
                                                        type="button"
                                                        onClick={() => {
                                                          for (const sid of rSyntheticIds) {
                                                            const arr = getRepeatableAnswerArray(sid)
                                                            if (arr.length > 1) {
                                                              setRepeatableAnswerArray(sid, arr.filter((_, i) => i !== rIdx))
                                                            }
                                                          }
                                                        }}
                                                        style={{
                                                          position: 'absolute', top: '0.25rem', right: '0.25rem',
                                                          background: 'none', border: 'none', color: '#dc2626',
                                                          cursor: 'pointer', fontSize: '0.85rem', lineHeight: 1, padding: '0.25rem',
                                                          display: 'flex', alignItems: 'center', gap: '0.25rem'
                                                        }}
                                                        title="Remove this entry"
                                                      ><span aria-hidden="true">×</span> Remove</button>
                                                    )}
                                                    {rSetQs.map((rQ: any, rQIdx: number) => {
                                                      const rSid = rSyntheticIds[rQIdx]
                                                      const rVirtualQ = { ...rQ, id: rSid } as unknown as QuestionToDisplay
                                                      return (
                                                        <React.Fragment key={`${nfqKey}-rq-${rQ.id}-${rIdx}`}>
                                                          <div className="question-item" style={{ marginBottom: '0.75rem' }}>
                                                            <label className="question-label">
                                                              <span style={{ color: '#6b7280', fontWeight: 600, marginRight: '0.35rem' }}>{nfqLabel}.</span>
                                                              {replaceLoopToken(rQ.question_text, rIdx)}
                                                              {rQ.is_required && <span className="required-indicator">*</span>}
                                                            </label>
                                                            {rQ.help_text && (
                                                              <p className="question-help">{replaceLoopToken(rQ.help_text, rIdx)}</p>
                                                            )}
                                                            {renderQuestion(rVirtualQ, rIdx)}
                                                          </div>
                                                          {renderNestedFollowups(rQ, rIdx, depth + 1, `${nfqKey}-rq-${rQ.id}-${rIdx}`, nfqLabel)}
                                                        </React.Fragment>
                                                      )
                                                    })}
                                                  </div>
                                                ))}
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    for (const sid of rSyntheticIds) {
                                                      const arr = getRepeatableAnswerArray(sid)
                                                      setRepeatableAnswerArray(sid, [...arr, ''])
                                                    }
                                                  }}
                                                  style={{
                                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                                    width: '100%', padding: '0.5rem 1rem',
                                                    backgroundColor: '#f3f4f6', border: 'none',
                                                    borderTop: '1px dashed #9ca3af',
                                                    borderRadius: '0 0 0.5rem 0.5rem',
                                                    color: '#4b5563', cursor: 'pointer', fontSize: '0.875rem'
                                                  }}
                                                >
                                                  <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>+</span>
                                                  Add Another ({(rSetQs[0] as any)?.hierarchical_number || nfqLabel})
                                                </button>
                                              </div>
                                            )
                                          }

                                          // Non-repeatable nested follow-up: use synthetic ID for instances > 0
                                          // Instance 0 uses real ID (preserves backend persistence)
                                          const nfqEffectiveId = parentInstanceIdx > 0 ? nfq.id * 100000 + parentInstanceIdx : nfq.id
                                          const nfqVirtual = { ...nfq, id: nfqEffectiveId } as unknown as QuestionToDisplay
                                          const nfqWithEffId = { ...nfq, id: nfqEffectiveId }
                                          return (
                                            <React.Fragment key={nfqKey}>
                                              <div className="question-item" style={{
                                                marginBottom: '0.75rem', marginLeft: `${depth}rem`,
                                                borderLeft: '2px solid #d1d5db', paddingLeft: '1rem'
                                              }}>
                                                <label className="question-label">
                                                  <span style={{ color: '#6b7280', fontWeight: 600, marginRight: '0.35rem' }}>{nfqLabel}.</span>
                                                  {replaceLoopToken(nfq.question_text, parentInstanceIdx)}
                                                  {nfq.is_required && <span className="required-indicator">*</span>}
                                                </label>
                                                {nfq.help_text && (
                                                  <p className="question-help">{replaceLoopToken(nfq.help_text, parentInstanceIdx)}</p>
                                                )}
                                                {renderQuestion(nfqVirtual, 0)}
                                              </div>
                                              {renderNestedFollowups(nfqWithEffId, parentInstanceIdx, depth + 1, nfqKey, nfqLabel)}
                                            </React.Fragment>
                                          )
                                        })
                                      }

                                      // Collect all follow-up questions, grouping repeatable ones by group ID
                                      const allFuQuestions = matchingFollowups.flatMap(fu => fu.questions)
                                      const renderedFuGroups = new Set<string>()
                                      let fuQCounter = 0
                                      return allFuQuestions.map(fq => {
                                        if (!fq.repeatable) {
                                          fuQCounter++
                                          const fuLabel = fq.hierarchical_number || `${setQLabel}-${fuQCounter}`
                                          // Non-repeatable follow-up: use synthetic ID for instances > 0
                                          // Instance 0 uses real ID (preserves backend persistence)
                                          const fqEffectiveId = instanceIdx > 0 ? fq.id * 100000 + instanceIdx : fq.id
                                          const fqVirtual = { ...fq, id: fqEffectiveId } as unknown as QuestionToDisplay
                                          const fqWithEffId = { ...fq, id: fqEffectiveId }
                                          return (
                                            <React.Fragment key={`fu-${fq.id}-${instanceIdx}`}>
                                              <div className="question-item" style={{ marginBottom: '0.75rem', marginLeft: '1rem', borderLeft: '2px solid #d1d5db', paddingLeft: '1rem' }}>
                                                <label className="question-label">
                                                  <span style={{ color: '#6b7280', fontWeight: 600, marginRight: '0.35rem' }}>{fuLabel}.</span>
                                                  {replaceLoopToken(fq.question_text, instanceIdx)}
                                                  {fq.is_required && <span className="required-indicator">*</span>}
                                                </label>
                                                {fq.help_text && (
                                                  <p className="question-help">{replaceLoopToken(fq.help_text, instanceIdx)}</p>
                                                )}
                                                {renderQuestion(fqVirtual, 0)}
                                              </div>
                                              {renderNestedFollowups(fqWithEffId, instanceIdx, 2, `fu-${fq.id}`, fuLabel)}
                                            </React.Fragment>
                                          )
                                        }

                                        fuQCounter++
                                        const fuRepLabel = fq.hierarchical_number || `${setQLabel}-${fuQCounter}`
                                        // Repeatable follow-up: group by repeatable_group_id
                                        const fuGroupId = fq.repeatable_group_id || String(fq.id)
                                        const fuGroupKey = `${fuGroupId}-${instanceIdx}`
                                        if (renderedFuGroups.has(fuGroupKey)) return null
                                        renderedFuGroups.add(fuGroupKey)

                                        // Collect all follow-up questions in this repeatable group
                                        const fuSetQuestions = allFuQuestions.filter(q =>
                                          q.repeatable && (q.repeatable_group_id || String(q.id)) === fuGroupId
                                        )

                                        // Build synthetic IDs for each question in the set (per parent instance)
                                        const fuSyntheticIds = fuSetQuestions.map(q => q.id * 100000 + instanceIdx)

                                        // Get instance count from the max answer array length across the set
                                        let fuInstanceCount = 1
                                        for (const sid of fuSyntheticIds) {
                                          const arr = getRepeatableAnswerArray(sid)
                                          if (arr.length > fuInstanceCount) fuInstanceCount = arr.length
                                        }

                                        return (
                                          <div key={`fu-set-${fuGroupId}-${instanceIdx}`} style={{
                                            marginBottom: '0.75rem',
                                            marginLeft: '1rem',
                                            borderLeft: '2px solid #d1d5db',
                                            paddingLeft: '1rem',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '0.5rem',
                                            backgroundColor: '#fafafa'
                                          }}>
                                            {Array.from({ length: fuInstanceCount }).map((_, fuIdx) => (
                                              <div key={`fu-set-${fuGroupId}-${instanceIdx}-${fuIdx}`} style={{
                                                padding: '0.75rem',
                                                borderBottom: fuIdx < fuInstanceCount - 1 ? '1px solid #e5e7eb' : 'none',
                                                position: 'relative'
                                              }}>
                                                {fuInstanceCount > 1 && (
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      for (const sid of fuSyntheticIds) {
                                                        const arr = getRepeatableAnswerArray(sid)
                                                        if (arr.length > 1) {
                                                          setRepeatableAnswerArray(sid, arr.filter((_, i) => i !== fuIdx))
                                                        }
                                                      }
                                                    }}
                                                    style={{
                                                      position: 'absolute', top: '0.25rem', right: '0.25rem',
                                                      background: 'none', border: 'none', color: '#dc2626',
                                                      cursor: 'pointer', fontSize: '0.85rem', lineHeight: 1, padding: '0.25rem',
                                                      display: 'flex', alignItems: 'center', gap: '0.25rem'
                                                    }}
                                                    title="Remove this entry"
                                                  ><span aria-hidden="true">×</span> Remove</button>
                                                )}
                                                {fuSetQuestions.map((fuQ, fuQIdx) => {
                                                  const sid = fuSyntheticIds[fuQIdx]
                                                  const virtualQ = { ...fuQ, id: sid } as unknown as QuestionToDisplay

                                                  // Get the current answer for this follow-up question instance
                                                  const fuAnswer = getRepeatableAnswerArray(sid)[fuIdx] || ''

                                                  // Evaluate conditional_followups on this follow-up question
                                                  const nestedFollowups = (fuQ as any).conditional_followups?.filter((cfu: any) => {
                                                    return evaluateConditional(cfu.operator, fuAnswer, cfu.trigger_value, fuAnswer)
                                                  }) || []

                                                  return (
                                                    <React.Fragment key={`fuq-${fuQ.id}-${fuIdx}`}>
                                                      <div className="question-item" style={{ marginBottom: fuQIdx < fuSetQuestions.length - 1 && nestedFollowups.length === 0 ? '0.75rem' : 0 }}>
                                                        <label className="question-label">
                                                          <span style={{ color: '#6b7280', fontWeight: 600, marginRight: '0.35rem' }}>{fuRepLabel}.</span>
                                                          {replaceLoopToken(fuQ.question_text, fuIdx)}
                                                          {fuQ.is_required && <span className="required-indicator">*</span>}
                                                        </label>
                                                        {fuQ.help_text && (
                                                          <p className="question-help">{replaceLoopToken(fuQ.help_text, fuIdx)}</p>
                                                        )}
                                                        {renderQuestion(virtualQ, fuIdx)}
                                                      </div>
                                                      {nestedFollowups.length > 0 && (() => {
                                                        const allNfqs = nestedFollowups.flatMap((nfu: any) => nfu.questions)
                                                        const renderedNfqGroups = new Set<string>()
                                                        return allNfqs.map((nfq: any, nfqIdx: number) => {
                                                          const nfqKey = `rfuq-${nfq.id}-${instanceIdx}-${fuIdx}`
                                                          const nfqNestedLabel = nfq.hierarchical_number || `${fuRepLabel}.${nfqIdx + 1}`

                                                          if (nfq.repeatable) {
                                                            // Repeatable nested followup: render with its own Add Another pattern
                                                            const nfqGroupId = nfq.repeatable_group_id || String(nfq.id)
                                                            const nfqGroupKey = `${nfqGroupId}-${instanceIdx}-${fuIdx}`
                                                            if (renderedNfqGroups.has(nfqGroupKey)) return null
                                                            renderedNfqGroups.add(nfqGroupKey)

                                                            const nfqSetQs = allNfqs.filter((q: any) =>
                                                              q.repeatable && (q.repeatable_group_id || String(q.id)) === nfqGroupId
                                                            )
                                                            const nfqSynIds = nfqSetQs.map((q: any) => q.id * 100000 + instanceIdx)

                                                            let nfqInstCount = 1
                                                            for (const sid of nfqSynIds) {
                                                              const arr = getRepeatableAnswerArray(sid)
                                                              if (arr.length > nfqInstCount) nfqInstCount = arr.length
                                                            }

                                                            return (
                                                              <div key={nfqKey} style={{
                                                                marginBottom: '0.75rem', marginLeft: '1rem',
                                                                borderLeft: '2px solid #d1d5db', paddingLeft: '1rem',
                                                                border: '1px solid #e5e7eb', borderRadius: '0.5rem',
                                                                backgroundColor: '#fafafa'
                                                              }}>
                                                                {Array.from({ length: nfqInstCount }).map((_, nfqRIdx) => (
                                                                  <div key={`${nfqKey}-ri-${nfqRIdx}`} style={{
                                                                    padding: '0.75rem',
                                                                    borderBottom: nfqRIdx < nfqInstCount - 1 ? '1px solid #e5e7eb' : 'none',
                                                                    position: 'relative'
                                                                  }}>
                                                                    {nfqInstCount > 1 && (
                                                                      <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                          for (const sid of nfqSynIds) {
                                                                            const arr = getRepeatableAnswerArray(sid)
                                                                            if (arr.length > 1) {
                                                                              setRepeatableAnswerArray(sid, arr.filter((_, i) => i !== nfqRIdx))
                                                                            }
                                                                          }
                                                                        }}
                                                                        style={{
                                                                          position: 'absolute', top: '0.25rem', right: '0.25rem',
                                                                          background: 'none', border: 'none', color: '#dc2626',
                                                                          cursor: 'pointer', fontSize: '0.85rem', lineHeight: 1, padding: '0.25rem',
                                                                          display: 'flex', alignItems: 'center', gap: '0.25rem'
                                                                        }}
                                                                        title="Remove this entry"
                                                                      ><span aria-hidden="true">×</span> Remove</button>
                                                                    )}
                                                                    {nfqSetQs.map((nfqQ: any, nfqQIdx: number) => {
                                                                      const nfqSid = nfqSynIds[nfqQIdx]
                                                                      const nfqVirtualQ = { ...nfqQ, id: nfqSid } as unknown as QuestionToDisplay
                                                                      return (
                                                                        <React.Fragment key={`${nfqKey}-rq-${nfqQ.id}-${nfqRIdx}`}>
                                                                          <div className="question-item" style={{ marginBottom: '0.75rem', marginLeft: '1rem', borderLeft: '2px solid #d1d5db', paddingLeft: '1rem' }}>
                                                                            <label className="question-label">
                                                                              <span style={{ color: '#6b7280', fontWeight: 600, marginRight: '0.35rem' }}>{nfqNestedLabel}.</span>
                                                                              {replaceLoopToken(nfqQ.question_text, nfqRIdx)}
                                                                              {nfqQ.is_required && <span className="required-indicator">*</span>}
                                                                            </label>
                                                                            {nfqQ.help_text && (
                                                                              <p className="question-help">{replaceLoopToken(nfqQ.help_text, nfqRIdx)}</p>
                                                                            )}
                                                                            {renderQuestion(nfqVirtualQ, nfqRIdx)}
                                                                          </div>
                                                                          {renderNestedFollowups(nfqQ, nfqRIdx, 3, `${nfqKey}-rq-${nfqQ.id}-${nfqRIdx}`, nfqNestedLabel)}
                                                                        </React.Fragment>
                                                                      )
                                                                    })}
                                                                  </div>
                                                                ))}
                                                                <button
                                                                  type="button"
                                                                  onClick={() => {
                                                                    for (const sid of nfqSynIds) {
                                                                      const arr = getRepeatableAnswerArray(sid)
                                                                      setRepeatableAnswerArray(sid, [...arr, ''])
                                                                    }
                                                                  }}
                                                                  style={{
                                                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                                                    width: '100%', padding: '0.5rem 1rem',
                                                                    backgroundColor: '#f3f4f6', border: 'none',
                                                                    borderTop: '1px dashed #9ca3af',
                                                                    borderRadius: '0 0 0.5rem 0.5rem',
                                                                    color: '#4b5563', cursor: 'pointer', fontSize: '0.875rem'
                                                                  }}
                                                                >
                                                                  <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>+</span>
                                                                  Add Another ({(nfqSetQs[0] as any)?.hierarchical_number || nfqNestedLabel})
                                                                </button>
                                                              </div>
                                                            )
                                                          }

                                                          // Non-repeatable nested followup
                                                          return (
                                                            <React.Fragment key={nfqKey}>
                                                              <div className="question-item" style={{
                                                                marginBottom: '0.75rem', marginLeft: '1rem',
                                                                borderLeft: '2px solid #d1d5db', paddingLeft: '1rem'
                                                              }}>
                                                                <label className="question-label">
                                                                  <span style={{ color: '#6b7280', fontWeight: 600, marginRight: '0.35rem' }}>{nfqNestedLabel}.</span>
                                                                  {replaceLoopToken(nfq.question_text, fuIdx)}
                                                                  {nfq.is_required && <span className="required-indicator">*</span>}
                                                                </label>
                                                                {nfq.help_text && (
                                                                  <p className="question-help">{replaceLoopToken(nfq.help_text, fuIdx)}</p>
                                                                )}
                                                                {renderQuestion({ ...nfq, id: instanceIdx > 0 ? nfq.id * 100000 + instanceIdx : nfq.id } as unknown as QuestionToDisplay, fuIdx)}
                                                              </div>
                                                              {renderNestedFollowups({ ...nfq, id: instanceIdx > 0 ? nfq.id * 100000 + instanceIdx : nfq.id }, fuIdx, 2, nfqKey, nfqNestedLabel)}
                                                            </React.Fragment>
                                                          )
                                                        })
                                                      })()}
                                                    </React.Fragment>
                                                  )
                                                })}
                                              </div>
                                            ))}
                                            <button
                                              type="button"
                                              onClick={() => {
                                                for (const sid of fuSyntheticIds) {
                                                  const arr = getRepeatableAnswerArray(sid)
                                                  setRepeatableAnswerArray(sid, [...arr, ''])
                                                }
                                              }}
                                              style={{
                                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                                width: '100%', padding: '0.5rem 1rem',
                                                backgroundColor: '#f3f4f6', border: 'none',
                                                borderTop: '1px dashed #9ca3af',
                                                borderRadius: '0 0 0.5rem 0.5rem',
                                                color: '#4b5563', cursor: 'pointer', fontSize: '0.875rem'
                                              }}
                                            >
                                              <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>+</span>
                                              Add Another ({(fuSetQuestions[0] as any)?.hierarchical_number || fuRepLabel})
                                            </button>
                                          </div>
                                        )
                                      })
                                    })()}
                                  </React.Fragment>
                                )
                              })}
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
                                width: '100%',
                                padding: '0.5rem 1rem',
                                backgroundColor: '#f3f4f6',
                                border: 'none',
                                borderTop: '1px dashed #9ca3af',
                                borderRadius: '0 0 0.5rem 0.5rem',
                                color: '#4b5563',
                                cursor: 'pointer',
                                fontSize: '0.875rem'
                              }}
                            >
                              <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>+</span>
                              Add Another ({setQuestions.length > 1 ? `${setQuestions[0].hierarchical_number || '1'}–${setQuestions[setQuestions.length - 1].hierarchical_number || String(setQuestions.length)}` : `${setQuestions[0].hierarchical_number || '1'}`})
                            </button>
                          )}
                        </div>
                      )
                    }

                    // Non-repeatable question - use hierarchical number from backend
                    const nonRepQLabel = question.hierarchical_number || '1'
                    return (
                      <React.Fragment key={question.id}>
                        <div className="question-item">
                          <label className="question-label">
                            <span style={{ color: '#6b7280', fontWeight: 600, marginRight: '0.35rem' }}>{nonRepQLabel}.</span>
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

                  <button
                    type="button"
                    onClick={() => handleNavigate('forward')}
                    disabled={submitting}
                    className="btn btn-primary"
                  >
                    {submitting ? 'Saving...' : (
                      sessionData.is_last_group
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

export default InputForms
