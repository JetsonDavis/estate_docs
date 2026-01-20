import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { flowService } from '../../services/flowService'
import { questionGroupService } from '../../services/questionService'
import { personService } from '../../services/personService'
import { DocumentFlowUpdate } from '../../types/flow'
import { QuestionGroup, QuestionGroupDetail } from '../../types/question'
import { Person } from '../../types/person'
import './Flows.css'

interface FlowStep {
  id: string
  type: 'group' | 'conditional'
  groupId?: number
  conditional?: {
    identifier: string
    value: string
    targetGroupId?: number
    nestedSteps?: FlowStep[]
  }
  depth?: number
}

const EditFlow: React.FC = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(true)
  const [isDuplicateName, setIsDuplicateName] = useState(false)
  const [isCheckingName, setIsCheckingName] = useState(false)
  const [questionGroups, setQuestionGroups] = useState<QuestionGroup[]>([])
  const [questionGroupsWithQuestions, setQuestionGroupsWithQuestions] = useState<Map<number, QuestionGroupDetail>>(new Map())
  const [flowSteps, setFlowSteps] = useState<FlowStep[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [personSearch, setPersonSearch] = useState<string>('')
  const nameCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const originalNameRef = useRef<string>('')
  const personSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const loadingGroupsRef = useRef<Map<number, Promise<QuestionGroupDetail | null>>>(new Map())

  useEffect(() => {
    loadFlow()
    loadQuestionGroups()
  }, [id])

  useEffect(() => {
    if (nameCheckTimeoutRef.current) {
      clearTimeout(nameCheckTimeoutRef.current)
    }

    // Don't check if name is empty or same as original
    if (name.trim() === '' || name === originalNameRef.current) {
      setIsDuplicateName(false)
      setIsCheckingName(false)
      return
    }

    setIsCheckingName(true)

    nameCheckTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await flowService.getFlows(1, 100)
        const duplicate = response.flows.some(f =>
          f.name.toLowerCase() === name.toLowerCase() &&
          f.id.toString() !== id
        )
        setIsDuplicateName(duplicate)
        setIsCheckingName(false)
      } catch (error: any) {
        console.error('Failed to check name:', error)
        setIsDuplicateName(false)
        setIsCheckingName(false)
      }
    }, 500)

    return () => {
      if (nameCheckTimeoutRef.current) {
        clearTimeout(nameCheckTimeoutRef.current)
      }
    }
  }, [name, id])

  const loadFlow = async () => {
    if (!id) return

    try {
      setLoading(true)
      const flow = await flowService.getFlow(Number(id))
      setName(flow.name)
      setDescription(flow.description || '')
      originalNameRef.current = flow.name

      // Load flow steps from flow_logic
      if (flow.flow_logic && Array.isArray(flow.flow_logic)) {
        setFlowSteps(flow.flow_logic)

        // Load questions for all groups in the flow so identifiers populate
        const groupIds = new Set<number>()
        const collectGroupIds = (steps: FlowStep[]) => {
          steps.forEach(step => {
            if (step.type === 'group' && step.groupId) {
              groupIds.add(step.groupId)
            }
            // Also collect targetGroupId from conditionals
            if (step.conditional?.targetGroupId) {
              groupIds.add(step.conditional.targetGroupId)
            }
            if (step.conditional?.nestedSteps) {
              collectGroupIds(step.conditional.nestedSteps)
            }
          })
        }
        collectGroupIds(flow.flow_logic)

        // Load all groups in parallel
        await Promise.all(
          Array.from(groupIds).map(groupId => loadGroupWithQuestions(groupId))
        )
      }
    } catch (err: any) {
      console.error('Failed to load flow:', err)
      alert('Failed to load flow')
      navigate('/admin/flows')
    } finally {
      setLoading(false)
    }
  }

  const loadQuestionGroups = async () => {
    try {
      const response = await questionGroupService.listQuestionGroups(1, 100, true)
      setQuestionGroups(response.question_groups)
    } catch (err: any) {
      console.error('Failed to load question groups:', err)
    }
  }

  const loadGroupWithQuestions = async (groupId: number): Promise<QuestionGroupDetail | null> => {
    if (questionGroupsWithQuestions.has(groupId)) {
      return questionGroupsWithQuestions.get(groupId)!
    }

    // Check if already loading this group (prevents duplicate parallel fetches)
    if (loadingGroupsRef.current.has(groupId)) {
      return loadingGroupsRef.current.get(groupId)!
    }

    const loadPromise = (async () => {
      try {
        const group = await questionGroupService.getQuestionGroup(groupId)
        // Use functional update to avoid race conditions when loading multiple groups in parallel
        setQuestionGroupsWithQuestions(prev => {
          const newMap = new Map(prev)
          newMap.set(groupId, group)
          return newMap
        })
        return group
      } catch (err: any) {
        console.error('Failed to load group questions:', err)
        return null
      } finally {
        loadingGroupsRef.current.delete(groupId)
      }
    })()

    loadingGroupsRef.current.set(groupId, loadPromise)
    return loadPromise
  }

  const addGroupStep = () => {
    const newStep: FlowStep = {
      id: Date.now().toString(),
      type: 'group',
      groupId: undefined
    }
    const newSteps = [...flowSteps, newStep]
    setFlowSteps(newSteps)
    triggerAutoSave(newSteps)
  }

  const promoteNestedToMainLevel = (parentStepId: string, nestedStepId: string) => {
    // Create a new main-level group step
    const newMainStep: FlowStep = {
      id: Date.now().toString(),
      type: 'group',
      groupId: undefined
    }

    // Find the parent step index
    const parentIndex = flowSteps.findIndex(s => s.id === parentStepId)
    if (parentIndex === -1) return

    // Insert the new step after the parent
    const newSteps = [...flowSteps]
    newSteps.splice(parentIndex + 1, 0, newMainStep)

    // Update the parent conditional to point to the new step
    newSteps[parentIndex] = {
      ...newSteps[parentIndex],
      conditional: {
        ...newSteps[parentIndex].conditional!,
        targetGroupId: undefined // Will be set to the new step's group when selected
      }
    }

    // Find and update the nested step to point to the new step
    const updateNestedSteps = (steps: FlowStep[]): FlowStep[] => {
      return steps.map(step => {
        if (step.id === parentStepId && step.conditional?.nestedSteps) {
          return {
            ...step,
            conditional: {
              ...step.conditional,
              nestedSteps: step.conditional.nestedSteps.map(ns => {
                if (ns.id === nestedStepId && ns.conditional) {
                  return {
                    ...ns,
                    conditional: {
                      ...ns.conditional,
                      targetGroupId: undefined // Will be set to the new step's group when selected
                    }
                  }
                }
                return ns
              })
            }
          }
        }
        return step
      })
    }

    const updatedSteps = updateNestedSteps(newSteps)
    setFlowSteps(updatedSteps)
    triggerAutoSave(updatedSteps)
  }

  const addConditionalStep = (afterStepId: string, parentDepth: number = 0) => {
    const newStep: FlowStep = {
      id: Date.now().toString(),
      type: 'conditional',
      depth: parentDepth + 1,
      conditional: {
        identifier: '',
        value: '',
        targetGroupId: undefined,
        nestedSteps: []
      }
    }
    const stepIndex = flowSteps.findIndex(s => s.id === afterStepId)
    const newSteps = [...flowSteps]
    newSteps.splice(stepIndex + 1, 0, newStep)
    setFlowSteps(newSteps)
    triggerAutoSave(newSteps)

    // Load questions for the current group so identifiers populate
    const step = flowSteps[stepIndex]
    if (step.type === 'group' && step.groupId) {
      loadGroupWithQuestions(step.groupId)
    }
  }

  const addNestedConditional = (parentStepId: string, currentDepth: number) => {
    if (currentDepth >= 4) return // Max 4 levels deep

    const newNestedStep: FlowStep = {
      id: Date.now().toString(),
      type: 'conditional',
      depth: currentDepth + 1,
      conditional: {
        identifier: '',
        value: '',
        targetGroupId: undefined,
        nestedSteps: []
      }
    }

    const updateNestedSteps = (steps: FlowStep[]): FlowStep[] => {
      return steps.map(step => {
        if (step.id === parentStepId && step.conditional) {
          return {
            ...step,
            conditional: {
              ...step.conditional,
              nestedSteps: [...(step.conditional.nestedSteps || []), newNestedStep]
            }
          }
        }
        if (step.conditional?.nestedSteps) {
          return {
            ...step,
            conditional: {
              ...step.conditional,
              nestedSteps: updateNestedSteps(step.conditional.nestedSteps)
            }
          }
        }
        return step
      })
    }

    const newSteps = updateNestedSteps(flowSteps)
    setFlowSteps(newSteps)
    triggerAutoSave(newSteps)
  }


  const removeNestedStep = (parentStepId: string, nestedStepId: string) => {
    const updateNestedSteps = (steps: FlowStep[]): FlowStep[] => {
      return steps.map(step => {
        if (step.id === parentStepId && step.conditional) {
          return {
            ...step,
            conditional: {
              ...step.conditional,
              nestedSteps: (step.conditional.nestedSteps || []).filter(s => s.id !== nestedStepId)
            }
          }
        }
        if (step.conditional?.nestedSteps) {
          return {
            ...step,
            conditional: {
              ...step.conditional,
              nestedSteps: updateNestedSteps(step.conditional.nestedSteps)
            }
          }
        }
        return step
      })
    }

    const newSteps = updateNestedSteps(flowSteps)
    setFlowSteps(newSteps)
    triggerAutoSave(newSteps)
  }

  const updateStep = (stepId: string, updates: Partial<FlowStep>) => {
    const newSteps = flowSteps.map(step =>
      step.id === stepId ? { ...step, ...updates } : step
    )
    setFlowSteps(newSteps)
    triggerAutoSave(newSteps)
  }

  const removeStep = (stepId: string) => {
    const newSteps = flowSteps.filter(step => step.id !== stepId)
    setFlowSteps(newSteps)
    triggerAutoSave(newSteps)
  }

  const triggerAutoSave = (steps: FlowStep[]) => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }

    autoSaveTimeoutRef.current = setTimeout(async () => {
      await saveFlowLogic(steps)
    }, 0)
  }

  const saveFlowLogic = async (steps: FlowStep[]) => {
    if (!id) return

    try {
      const data: DocumentFlowUpdate = {
        flow_logic: steps
      }
      await flowService.updateFlow(Number(id), data)
    } catch (err: any) {
      console.error('Failed to auto-save flow logic:', err)
    }
  }

  const getIdentifiersForGroup = (groupId: number | undefined): string[] => {
    if (!groupId) {
      console.log('getIdentifiersForGroup: no groupId')
      return []
    }

    const group = questionGroupsWithQuestions.get(groupId)
    console.log('getIdentifiersForGroup:', { groupId, hasGroup: !!group, hasQuestions: !!group?.questions, questionCount: group?.questions?.length })
    if (!group || !group.questions) return []

    const identifiers = group.questions.map((q: any) => q.identifier).filter(Boolean)
    console.log('getIdentifiersForGroup identifiers:', identifiers)
    return identifiers
  }

  const getQuestionByIdentifier = (groupId: number | undefined, identifier: string): any => {
    if (!groupId || !identifier) return null

    const group = questionGroupsWithQuestions.get(groupId)
    if (!group || !group.questions) return null

    return group.questions.find((q: any) => q.identifier === identifier)
  }

  const saveNameAndDescription = async () => {
    if (!id || !name) return

    try {
      const data: DocumentFlowUpdate = {
        name,
        description: description || undefined
      }
      await flowService.updateFlow(Number(id), data)
    } catch (err: any) {
      console.error('Failed to save name/description:', err)
    }
  }

  const isNameValid = name.trim() !== '' && !isDuplicateName && !isCheckingName

  // Auto-save name when it changes and is valid
  useEffect(() => {
    if (isNameValid && name !== originalNameRef.current) {
      const timeout = setTimeout(() => {
        saveNameAndDescription()
      }, 1000)
      return () => clearTimeout(timeout)
    }
  }, [name, isNameValid])

  // Auto-save description when it changes
  useEffect(() => {
    if (description !== undefined) {
      const timeout = setTimeout(() => {
        saveNameAndDescription()
      }, 1000)
      return () => clearTimeout(timeout)
    }
  }, [description])

  if (loading) {
    return (
      <div className="flows-container">
        <div className="flows-wrapper">
          <div style={{ maxWidth: '50%' }}>
            <div className="flows-header">
              <h1 className="flows-title">Loading...</h1>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flows-container">
      <div className="flows-wrapper">
        <div className="flows-header" style={{ display: 'block', maxWidth: '90%' }}>
          <h1 className="flows-title">Edit Flow</h1>

          <div style={{ maxWidth: '50%' }}>
            <div className="flow-form" style={{ marginTop: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="form-input"
                style={{
                  borderColor: isDuplicateName ? '#dc2626' : undefined,
                  width: '100%'
                }}
                required
                placeholder="Enter flow name"
              />
              {isCheckingName && (
                <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  Checking name...
                </p>
              )}
              {isDuplicateName && !isCheckingName && (
                <p style={{ fontSize: '0.875rem', color: '#dc2626', marginTop: '0.25rem' }}>
                  This name is already in use. Please choose a unique name.
                </p>
              )}
            </div>

            <div className="form-group description-group">
              <label className="form-label">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="form-textarea"
                rows={1}
                style={{ width: '100%' }}
                placeholder="Enter flow description"
              />
            </div>

            {isNameValid && (
              <div className="form-group" style={{ marginTop: '1.5rem' }}>
                {/* First Group or Add First Group */}
                {flowSteps.length === 0 ? (
                  <button
                    type="button"
                    onClick={addGroupStep}
                    className="create-button"
                    style={{
                      padding: '0.5rem 1rem',
                      fontSize: '0.875rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '1rem', height: '1rem' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add First Group
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {flowSteps.map((step, index) => (
                      <div key={step.id}>
                        {step.type === 'group' ? (
                          <>
                            {/* Show "Flow Steps" for first group, "Next Step" for subsequent groups */}
                            {index === 0 ? (
                              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
                                Flow Steps
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
                                Next Step
                              </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <select
                              value={step.groupId || ''}
                              onChange={(e) => {
                                const groupId = e.target.value ? Number(e.target.value) : undefined
                                updateStep(step.id, { groupId })
                                // Load questions for this group for conditional identifier dropdown
                                if (groupId) {
                                  loadGroupWithQuestions(groupId)
                                }
                              }}
                              className="form-select"
                              style={{ flex: 1 }}
                            >
                              <option value="">Select group...</option>
                              {questionGroups.map(group => (
                                <option key={group.id} value={group.id}>
                                  {group.name}
                                </option>
                              ))}
                            </select>

                            {/* Question mark icon - add conditional */}
                            <button
                              type="button"
                              onClick={() => addConditionalStep(step.id)}
                              style={{
                                background: 'none',
                                border: '1px solid #d1d5db',
                                borderRadius: '0.375rem',
                                padding: '0.375rem',
                                cursor: 'pointer',
                                color: '#7c3aed',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                              title="Add conditional"
                            >
                              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '1.25rem', height: '1.25rem' }}>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </button>

                            {/* Trash icon - delete this group only */}
                            {flowSteps.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  // Remove only this specific group
                                  const newSteps = flowSteps.filter(s => s.id !== step.id)
                                  setFlowSteps(newSteps)
                                  triggerAutoSave(newSteps)
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: '0.25rem',
                                  cursor: 'pointer',
                                  color: '#dc2626'
                                }}
                                title="Remove this group"
                              >
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '1.25rem', height: '1.25rem' }}>
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}

                          </div>
                          </>
                        ) : (
                          <div style={{
                            marginLeft: `${(step.depth || 1) * 2}rem`,
                            padding: '1rem',
                            border: '1px solid #e5e7eb',
                            borderRadius: '0.5rem',
                            backgroundColor: '#f9fafb'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#7c3aed' }}>
                                Conditional Logic
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  // Remove this conditional step (which includes all nested conditionals)
                                  // Main level groups are not affected
                                  removeStep(step.id)
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: '0.25rem',
                                  cursor: 'pointer',
                                  color: '#dc2626'
                                }}
                                title="Remove conditional and all nested conditionals"
                              >
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '1.25rem', height: '1.25rem' }}>
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                              {/* Identifier dropdown */}
                              <div>
                                <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>
                                  If identifier
                                </label>
                                <select
                                  value={step.conditional?.identifier || ''}
                                  onChange={(e) => updateStep(step.id, {
                                    conditional: { ...step.conditional!, identifier: e.target.value }
                                  })}
                                  className="form-select"
                                  style={{ fontSize: '0.875rem' }}
                                >
                                  <option value="">Select identifier...</option>
                                  {(() => {
                                    // Find the current group step (the group this conditional belongs to)
                                    const currentIndex = flowSteps.findIndex(s => s.id === step.id)
                                    let currentGroupId: number | undefined
                                    for (let i = currentIndex - 1; i >= 0; i--) {
                                      if (flowSteps[i].type === 'group' && flowSteps[i].groupId) {
                                        currentGroupId = flowSteps[i].groupId
                                        break
                                      }
                                    }
                                    const identifiers = getIdentifiersForGroup(currentGroupId)
                                    return identifiers.map(identifier => (
                                      <option key={identifier} value={identifier}>
                                        {identifier}
                                      </option>
                                    ))
                                  })()}
                                </select>
                              </div>

                              {/* Value input */}
                              <div>
                                <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>
                                  Equals value
                                </label>
                                {(() => {
                                  // Find the previous group and get the question for the selected identifier
                                  const currentIndex = flowSteps.findIndex(s => s.id === step.id)
                                  let previousGroupId: number | undefined
                                  for (let i = currentIndex - 1; i >= 0; i--) {
                                    if (flowSteps[i].type === 'group' && flowSteps[i].groupId) {
                                      previousGroupId = flowSteps[i].groupId
                                      break
                                    }
                                  }

                                  const question = getQuestionByIdentifier(previousGroupId, step.conditional?.identifier || '')
                                  const isChoiceType = question && ['multiple_choice', 'dropdown', 'checkbox_group'].includes(question.question_type)
                                  const isPersonType = question && question.question_type === 'person'
                                  const isDateType = question && question.question_type === 'date'

                                  if (isDateType) {
                                    // Show date input for date type questions
                                    return (
                                      <input
                                        type="date"
                                        value={step.conditional?.value || ''}
                                        onChange={(e) => updateStep(step.id, {
                                          conditional: { ...step.conditional!, value: e.target.value }
                                        })}
                                        className="form-input"
                                        style={{ fontSize: '0.875rem' }}
                                      />
                                    )
                                  } else if (isChoiceType && question.options && Array.isArray(question.options)) {
                                    // Show dropdown for choice-based questions
                                    return (
                                      <select
                                        value={step.conditional?.value || ''}
                                        onChange={(e) => {
                                          updateStep(step.id, {
                                            conditional: { ...step.conditional!, value: e.target.value }
                                          })
                                        }}
                                        className="form-select"
                                        style={{ fontSize: '0.875rem' }}
                                      >
                                        <option value="">Select value...</option>
                                        {question.options.map((opt: any, idx: number) => {
                                          const optionValue = opt.value || opt.label
                                          return (
                                            <option key={optionValue || `opt-${idx}`} value={optionValue}>
                                              {opt.label}
                                            </option>
                                          )
                                        })}
                                      </select>
                                    )
                                  } else if (isPersonType) {
                                    // Show type-ahead for person type questions
                                    return (
                                      <>
                                        <input
                                          type="text"
                                          value={step.conditional?.value || ''}
                                          onChange={async (e) => {
                                            updateStep(step.id, {
                                              conditional: { ...step.conditional!, value: e.target.value }
                                            })

                                            // Debounced search for people
                                            if (personSearchTimeoutRef.current) {
                                              clearTimeout(personSearchTimeoutRef.current)
                                            }

                                            const searchValue = e.target.value
                                            personSearchTimeoutRef.current = setTimeout(async () => {
                                              if (searchValue.length >= 2) {
                                                try {
                                                  const response = await personService.getPeople(1, 50, false, searchValue)
                                                  setPeople(response.people)
                                                } catch (err) {
                                                  console.error('Failed to search people:', err)
                                                }
                                              } else {
                                                setPeople([])
                                              }
                                            }, 300)
                                          }}
                                          list={`people-list-${step.id}`}
                                          className="form-input"
                                          style={{ fontSize: '0.875rem' }}
                                          placeholder="Type to search people..."
                                        />
                                        <datalist id={`people-list-${step.id}`}>
                                          {people.map((person) => (
                                            <option key={person.id} value={person.name} />
                                          ))}
                                        </datalist>
                                      </>
                                    )
                                  } else {
                                    // Show text input for other question types
                                    return (
                                      <input
                                        type="text"
                                        value={step.conditional?.value || ''}
                                        onChange={(e) => updateStep(step.id, {
                                          conditional: { ...step.conditional!, value: e.target.value }
                                        })}
                                        className="form-input"
                                        style={{ fontSize: '0.875rem' }}
                                        placeholder="Enter value"
                                      />
                                    )
                                  }
                                })()}
                              </div>

                              {/* Target group dropdown with action icons */}
                              <div>
                                <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>
                                  Then go to group
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <select
                                    value={step.conditional?.targetGroupId || ''}
                                    onChange={(e) => {
                                      const targetGroupId = e.target.value ? Number(e.target.value) : undefined
                                      updateStep(step.id, {
                                        conditional: { ...step.conditional!, targetGroupId }
                                      })
                                      // Load questions for the target group so nested conditional identifiers populate
                                      if (targetGroupId) {
                                        loadGroupWithQuestions(targetGroupId)
                                      }
                                    }}
                                    className="form-select"
                                    style={{ fontSize: '0.875rem', flex: 1 }}
                                  >
                                    <option value="">Select target group...</option>
                                    {questionGroups.map(group => (
                                      <option key={group.id} value={group.id}>
                                        {group.name}
                                      </option>
                                    ))}
                                  </select>

                                  {/* Question mark icon - add nested conditional */}
                                  <button
                                    type="button"
                                    onClick={() => addNestedConditional(step.id, step.depth || 0)}
                                    disabled={(step.depth || 0) >= 4}
                                    style={{
                                      background: 'none',
                                      border: '1px solid #d1d5db',
                                      borderRadius: '0.375rem',
                                      padding: '0.375rem',
                                      cursor: (step.depth || 0) >= 4 ? 'not-allowed' : 'pointer',
                                      color: (step.depth || 0) >= 4 ? '#9ca3af' : '#7c3aed',
                                      display: 'flex',
                                      alignItems: 'center',
                                      opacity: (step.depth || 0) >= 4 ? 0.5 : 1
                                    }}
                                    title="Add nested conditional"
                                  >
                                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '1.25rem', height: '1.25rem' }}>
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  </button>

                                  {/* Blue left arrow - add convergence point */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      // Add a new group step after this conditional
                                      const stepIndex = flowSteps.findIndex(s => s.id === step.id)
                                      const newStep: FlowStep = {
                                        id: Date.now().toString(),
                                        type: 'group',
                                        groupId: undefined
                                      }
                                      const newSteps = [...flowSteps]
                                      newSteps.splice(stepIndex + 1, 0, newStep)
                                      setFlowSteps(newSteps)
                                      triggerAutoSave(newSteps)
                                    }}
                                    style={{
                                      background: 'none',
                                      border: '1px solid #d1d5db',
                                      borderRadius: '0.375rem',
                                      padding: '0.25rem',
                                      cursor: 'pointer',
                                      color: '#2563eb',
                                      display: 'flex',
                                      alignItems: 'center'
                                    }}
                                    title="Add convergence point"
                                  >
                                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '1.25rem', height: '1.25rem' }}>
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                    </svg>
                                  </button>
                                </div>
                              </div>

                              {/* Render nested steps recursively */}
                              {step.conditional?.nestedSteps && step.conditional.nestedSteps.length > 0 && (
                                <div style={{ marginLeft: '1.5rem', marginTop: '0.75rem', borderLeft: '2px solid #e5e7eb', paddingLeft: '1rem' }}>
                                  {step.conditional.nestedSteps.map((nestedStep) => (
                                    <div key={nestedStep.id} style={{ marginBottom: '0.75rem' }}>
                                      {nestedStep.type === 'group' ? (
                                        <div style={{
                                          padding: '0.75rem',
                                          border: '1px solid #e5e7eb',
                                          borderRadius: '0.5rem',
                                          backgroundColor: 'white'
                                        }}>
                                          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                                            Nested Group
                                          </div>
                                          <select
                                            value={nestedStep.groupId || ''}
                                            onChange={(e) => {
                                              const updatedNestedSteps = step.conditional!.nestedSteps!.map(ns =>
                                                ns.id === nestedStep.id ? { ...ns, groupId: Number(e.target.value) } : ns
                                              )
                                              updateStep(step.id, {
                                                conditional: { ...step.conditional!, nestedSteps: updatedNestedSteps }
                                              })
                                            }}
                                            className="form-select"
                                            style={{ fontSize: '0.875rem' }}
                                          >
                                            <option value="">Select group...</option>
                                            {questionGroups.map(group => (
                                              <option key={group.id} value={group.id}>
                                                {group.name}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                      ) : (
                                        <div style={{
                                          padding: '0.75rem',
                                          border: '1px solid #e5e7eb',
                                          borderRadius: '0.5rem',
                                          backgroundColor: '#faf5ff'
                                        }}>
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#7c3aed' }}>
                                              Nested Conditional (1)
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const updatedNestedSteps = step.conditional!.nestedSteps!.filter(ns => ns.id !== nestedStep.id)
                                                updateStep(step.id, {
                                                  conditional: { ...step.conditional!, nestedSteps: updatedNestedSteps }
                                                })
                                              }}
                                              style={{
                                                background: 'none',
                                                border: 'none',
                                                padding: '0.25rem',
                                                cursor: 'pointer',
                                                color: '#dc2626'
                                              }}
                                              title="Remove nested conditional"
                                            >
                                              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '1rem', height: '1rem' }}>
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                              </svg>
                                            </button>
                                          </div>

                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {/* Nested If identifier */}
                                            <div>
                                              <label style={{ fontSize: '0.7rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>
                                                If identifier
                                              </label>
                                              <select
                                                value={nestedStep.conditional?.identifier || ''}
                                                onChange={(e) => {
                                                  const updatedNestedSteps = step.conditional!.nestedSteps!.map(ns =>
                                                    ns.id === nestedStep.id
                                                      ? { ...ns, conditional: { ...ns.conditional!, identifier: e.target.value } }
                                                      : ns
                                                  )
                                                  updateStep(step.id, {
                                                    conditional: { ...step.conditional!, nestedSteps: updatedNestedSteps }
                                                  })
                                                }}
                                                className="form-select"
                                                style={{ fontSize: '0.8rem' }}
                                              >
                                                <option value="">Select identifier...</option>
                                                {(() => {
                                                  // Get identifiers from the parent conditional's target group
                                                  const targetGroupId = step.conditional?.targetGroupId
                                                  const identifiers = getIdentifiersForGroup(targetGroupId)
                                                  return identifiers.map(identifier => (
                                                    <option key={identifier} value={identifier}>
                                                      {identifier}
                                                    </option>
                                                  ))
                                                })()}
                                              </select>
                                            </div>

                                            {/* Nested Equals value */}
                                            <div>
                                              <label style={{ fontSize: '0.7rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>
                                                Equals value
                                              </label>
                                              {(() => {
                                                // Get the question for the selected identifier to determine input type
                                                // Use the parent conditional's target group
                                                const targetGroupId = step.conditional?.targetGroupId

                                                const question = getQuestionByIdentifier(targetGroupId, nestedStep.conditional?.identifier || '')
                                                const isChoiceType = question && ['multiple_choice', 'dropdown', 'checkbox_group'].includes(question.question_type)
                                                const isPersonType = question && question.question_type === 'person'
                                                const isDateType = question && question.question_type === 'date'

                                                if (isDateType) {
                                                  // Show date input for date type questions
                                                  return (
                                                    <input
                                                      type="date"
                                                      value={nestedStep.conditional?.value || ''}
                                                      onChange={(e) => {
                                                        const updatedNestedSteps = step.conditional!.nestedSteps!.map(ns =>
                                                          ns.id === nestedStep.id
                                                            ? { ...ns, conditional: { ...ns.conditional!, value: e.target.value } }
                                                            : ns
                                                        )
                                                        updateStep(step.id, {
                                                          conditional: { ...step.conditional!, nestedSteps: updatedNestedSteps }
                                                        })
                                                      }}
                                                      className="form-input"
                                                      style={{ fontSize: '0.8rem' }}
                                                    />
                                                  )
                                                } else if (isChoiceType && question.options && Array.isArray(question.options)) {
                                                  // Show dropdown for choice-based questions
                                                  return (
                                                    <select
                                                      value={nestedStep.conditional?.value || ''}
                                                      onChange={(e) => {
                                                        const updatedNestedSteps = step.conditional!.nestedSteps!.map(ns =>
                                                          ns.id === nestedStep.id
                                                            ? { ...ns, conditional: { ...ns.conditional!, value: e.target.value } }
                                                            : ns
                                                        )
                                                        updateStep(step.id, {
                                                          conditional: { ...step.conditional!, nestedSteps: updatedNestedSteps }
                                                        })
                                                      }}
                                                      className="form-select"
                                                      style={{ fontSize: '0.8rem' }}
                                                    >
                                                      <option value="">Select value...</option>
                                                      {question.options.map((opt: any, idx: number) => {
                                                        const optionValue = opt.value || opt.label
                                                        return (
                                                          <option key={optionValue || `nested-opt-${idx}`} value={optionValue}>
                                                            {opt.label}
                                                          </option>
                                                        )
                                                      })}
                                                    </select>
                                                  )
                                                } else if (isPersonType) {
                                                  // Show type-ahead for person type questions
                                                  return (
                                                    <>
                                                      <input
                                                        type="text"
                                                        value={nestedStep.conditional?.value || ''}
                                                        onChange={async (e) => {
                                                          const updatedNestedSteps = step.conditional!.nestedSteps!.map(ns =>
                                                            ns.id === nestedStep.id
                                                              ? { ...ns, conditional: { ...ns.conditional!, value: e.target.value } }
                                                              : ns
                                                          )
                                                          updateStep(step.id, {
                                                            conditional: { ...step.conditional!, nestedSteps: updatedNestedSteps }
                                                          })

                                                          // Debounced search for people
                                                          if (personSearchTimeoutRef.current) {
                                                            clearTimeout(personSearchTimeoutRef.current)
                                                          }

                                                          const searchValue = e.target.value
                                                          personSearchTimeoutRef.current = setTimeout(async () => {
                                                            if (searchValue.length >= 2) {
                                                              try {
                                                                const response = await personService.getPeople(1, 50, false, searchValue)
                                                                setPeople(response.people)
                                                              } catch (err) {
                                                                console.error('Failed to search people:', err)
                                                              }
                                                            } else {
                                                              setPeople([])
                                                            }
                                                          }, 300)
                                                        }}
                                                        list={`people-list-nested-${nestedStep.id}`}
                                                        className="form-input"
                                                        style={{ fontSize: '0.8rem' }}
                                                        placeholder="Type to search people..."
                                                      />
                                                      <datalist id={`people-list-nested-${nestedStep.id}`}>
                                                        {people.map((person) => (
                                                          <option key={person.id} value={person.name} />
                                                        ))}
                                                      </datalist>
                                                    </>
                                                  )
                                                } else {
                                                  // Show text input for other question types
                                                  return (
                                                    <input
                                                      type="text"
                                                      value={nestedStep.conditional?.value || ''}
                                                      onChange={(e) => {
                                                        const updatedNestedSteps = step.conditional!.nestedSteps!.map(ns =>
                                                          ns.id === nestedStep.id
                                                            ? { ...ns, conditional: { ...ns.conditional!, value: e.target.value } }
                                                            : ns
                                                        )
                                                        updateStep(step.id, {
                                                          conditional: { ...step.conditional!, nestedSteps: updatedNestedSteps }
                                                        })
                                                      }}
                                                      className="form-input"
                                                      style={{ fontSize: '0.8rem' }}
                                                      placeholder="Enter value"
                                                    />
                                                  )
                                                }
                                              })()}
                                            </div>

                                            {/* Nested Then go to group */}
                                            <div>
                                              <label style={{ fontSize: '0.7rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>
                                                Then go to group
                                              </label>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <select
                                                  value={nestedStep.conditional?.targetGroupId || ''}
                                                  onChange={(e) => {
                                                    const targetGroupId = e.target.value ? Number(e.target.value) : undefined
                                                    const updatedNestedSteps = step.conditional!.nestedSteps!.map(ns =>
                                                      ns.id === nestedStep.id
                                                        ? { ...ns, conditional: { ...ns.conditional!, targetGroupId } }
                                                        : ns
                                                    )
                                                    updateStep(step.id, {
                                                      conditional: { ...step.conditional!, nestedSteps: updatedNestedSteps }
                                                    })
                                                    // Load questions for the target group so deeper nested conditional identifiers populate
                                                    if (targetGroupId) {
                                                      loadGroupWithQuestions(targetGroupId)
                                                    }
                                                  }}
                                                  className="form-select"
                                                  style={{ fontSize: '0.8rem', flex: 1 }}
                                                >
                                                  <option value="">Select target group...</option>
                                                  {questionGroups.map(group => (
                                                    <option key={group.id} value={group.id}>
                                                      {group.name}
                                                    </option>
                                                  ))}
                                                </select>

                                                {/* Nested action buttons - only show if depth allows */}
                                                {(nestedStep.depth || 0) < 4 && (
                                                  <>
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        const newNestedConditional: FlowStep = {
                                                          id: Date.now().toString() + '_cond',
                                                          type: 'conditional',
                                                          conditional: { identifier: '', value: '', nestedSteps: [] },
                                                          depth: (nestedStep.depth || 0) + 1
                                                        }
                                                        const updatedNestedSteps = step.conditional!.nestedSteps!.map(ns =>
                                                          ns.id === nestedStep.id
                                                            ? { ...ns, conditional: { ...ns.conditional!, nestedSteps: [...(ns.conditional?.nestedSteps || []), newNestedConditional] } }
                                                            : ns
                                                        )
                                                        updateStep(step.id, {
                                                          conditional: { ...step.conditional!, nestedSteps: updatedNestedSteps }
                                                        })
                                                      }}
                                                      style={{
                                                        background: 'none',
                                                        border: '1px solid #d1d5db',
                                                        borderRadius: '0.375rem',
                                                        padding: '0.25rem',
                                                        cursor: 'pointer',
                                                        color: '#7c3aed',
                                                        display: 'flex',
                                                        alignItems: 'center'
                                                      }}
                                                      title="Add nested conditional"
                                                    >
                                                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '1rem', height: '1rem' }}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                      </svg>
                                                    </button>
                                                  </>
                                                )}

                                                <button
                                                  type="button"
                                                  onClick={() => promoteNestedToMainLevel(step.id, nestedStep.id)}
                                                  style={{
                                                    background: 'none',
                                                    border: '1px solid #d1d5db',
                                                    borderRadius: '0.375rem',
                                                    padding: '0.25rem',
                                                    cursor: 'pointer',
                                                    color: '#2563eb',
                                                    display: 'flex',
                                                    alignItems: 'center'
                                                  }}
                                                  title="Promote to main level"
                                                >
                                                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '1rem', height: '1rem' }}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                                  </svg>
                                                </button>
                                              </div>
                                            </div>

                                            {/* Recursively render deeper nested steps */}
                                            {nestedStep.conditional?.nestedSteps && nestedStep.conditional.nestedSteps.length > 0 && (
                                              <div style={{ marginLeft: '1.5rem', marginTop: '0.75rem', borderLeft: '2px solid #e5e7eb', paddingLeft: '1rem', marginRight: '-2.5rem' }}>
                                                {nestedStep.conditional.nestedSteps.map((deeperStep) => (
                                                  <div key={deeperStep.id} style={{ marginBottom: '0.75rem' }}>
                                                    {deeperStep.type === 'group' ? (
                                                      <div style={{
                                                        padding: '0.75rem',
                                                        border: '1px solid #e5e7eb',
                                                        borderRadius: '0.5rem',
                                                        backgroundColor: 'white'
                                                      }}>
                                                        <div style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                                                          Deeper Nested Group
                                                        </div>
                                                        <select
                                                          value={deeperStep.groupId || ''}
                                                          onChange={(e) => {
                                                            const updatedDeeperSteps = nestedStep.conditional!.nestedSteps!.map(ds =>
                                                              ds.id === deeperStep.id ? { ...ds, groupId: Number(e.target.value) } : ds
                                                            )
                                                            const updatedNestedSteps = step.conditional!.nestedSteps!.map(ns =>
                                                              ns.id === nestedStep.id
                                                                ? { ...ns, conditional: { ...ns.conditional!, nestedSteps: updatedDeeperSteps } }
                                                                : ns
                                                            )
                                                            updateStep(step.id, {
                                                              conditional: { ...step.conditional!, nestedSteps: updatedNestedSteps }
                                                            })
                                                          }}
                                                          className="form-select"
                                                          style={{ fontSize: '0.8rem' }}
                                                        >
                                                          <option value="">Select group...</option>
                                                          {questionGroups.map(group => (
                                                            <option key={group.id} value={group.id}>
                                                              {group.name}
                                                            </option>
                                                          ))}
                                                        </select>
                                                      </div>
                                                    ) : (
                                                      <div style={{
                                                        padding: '0.75rem',
                                                        border: '1px solid #e5e7eb',
                                                        borderRadius: '0.5rem',
                                                        backgroundColor: '#faf5ff'
                                                      }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#7c3aed' }}>
                                                            Nested Conditional (2)
                                                          </div>
                                                          <button
                                                            type="button"
                                                            onClick={() => {
                                                              const updatedDeeperSteps = nestedStep.conditional!.nestedSteps!.filter(ds => ds.id !== deeperStep.id)
                                                              const updatedNestedSteps = step.conditional!.nestedSteps!.map(ns =>
                                                                ns.id === nestedStep.id
                                                                  ? { ...ns, conditional: { ...ns.conditional!, nestedSteps: updatedDeeperSteps } }
                                                                  : ns
                                                              )
                                                              updateStep(step.id, {
                                                                conditional: { ...step.conditional!, nestedSteps: updatedNestedSteps }
                                                              })
                                                            }}
                                                            style={{
                                                              background: 'none',
                                                              border: 'none',
                                                              padding: '0.25rem',
                                                              cursor: 'pointer',
                                                              color: '#dc2626'
                                                            }}
                                                            title="Remove deeper nested conditional"
                                                          >
                                                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '1rem', height: '1rem' }}>
                                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                          </button>
                                                        </div>

                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                          {/* Deeper If identifier */}
                                                          <div>
                                                            <label style={{ fontSize: '0.7rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>
                                                              If identifier
                                                            </label>
                                                            <select
                                                              value={deeperStep.conditional?.identifier || ''}
                                                              onChange={(e) => {
                                                                console.log('Deeper nested conditional identifier changed to:', e.target.value)
                                                                const updatedDeeperSteps = nestedStep.conditional!.nestedSteps!.map(ds =>
                                                                  ds.id === deeperStep.id
                                                                    ? { ...ds, conditional: { ...ds.conditional!, identifier: e.target.value } }
                                                                    : ds
                                                                )
                                                                const updatedNestedSteps = step.conditional!.nestedSteps!.map(ns =>
                                                                  ns.id === nestedStep.id
                                                                    ? { ...ns, conditional: { ...ns.conditional!, nestedSteps: updatedDeeperSteps } }
                                                                    : ns
                                                                )
                                                                console.log('Calling updateStep for deeper nested conditional identifier')
                                                                updateStep(step.id, {
                                                                  conditional: { ...step.conditional!, nestedSteps: updatedNestedSteps }
                                                                })
                                                              }}
                                                              className="form-select"
                                                              style={{ fontSize: '0.8rem' }}
                                                            >
                                                              <option value="">Select identifier...</option>
                                                              {getIdentifiersForGroup(nestedStep.conditional?.targetGroupId).map((identifier) => (
                                                                <option key={identifier} value={identifier}>
                                                                  {identifier}
                                                                </option>
                                                              ))}
                                                            </select>
                                                          </div>

                                                          {/* Deeper Equals value */}
                                                          <div>
                                                            <label style={{ fontSize: '0.7rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>
                                                              Equals value
                                                            </label>
                                                            {(() => {
                                                              // Get the question for the selected identifier to determine input type
                                                              // Use the parent nested conditional's target group
                                                              const targetGroupId = nestedStep.conditional?.targetGroupId

                                                              const question = getQuestionByIdentifier(targetGroupId, deeperStep.conditional?.identifier || '')
                                                              const isChoiceType = question && ['multiple_choice', 'dropdown', 'checkbox_group'].includes(question.question_type)
                                                              const isPersonType = question && question.question_type === 'person'
                                                              const isDateType = question && question.question_type === 'date'

                                                              if (isDateType) {
                                                                // Show date input for date type questions
                                                                return (
                                                                  <input
                                                                    type="date"
                                                                    value={deeperStep.conditional?.value || ''}
                                                                    onChange={(e) => {
                                                                      const updatedDeeperSteps = nestedStep.conditional!.nestedSteps!.map(ds =>
                                                                        ds.id === deeperStep.id
                                                                          ? { ...ds, conditional: { ...ds.conditional!, value: e.target.value } }
                                                                          : ds
                                                                      )
                                                                      const updatedNestedSteps = step.conditional!.nestedSteps!.map(ns =>
                                                                        ns.id === nestedStep.id
                                                                          ? { ...ns, conditional: { ...ns.conditional!, nestedSteps: updatedDeeperSteps } }
                                                                          : ns
                                                                      )
                                                                      updateStep(step.id, {
                                                                        conditional: { ...step.conditional!, nestedSteps: updatedNestedSteps }
                                                                      })
                                                                    }}
                                                                    className="form-input"
                                                                    style={{ fontSize: '0.8rem' }}
                                                                  />
                                                                )
                                                              } else if (isPersonType) {
                                                                // Show person type-ahead input
                                                                return (
                                                                  <>
                                                                    <input
                                                                      type="text"
                                                                      value={deeperStep.conditional?.value || ''}
                                                                      onChange={async (e) => {
                                                                        const updatedDeeperSteps = nestedStep.conditional!.nestedSteps!.map(ds =>
                                                                          ds.id === deeperStep.id
                                                                            ? { ...ds, conditional: { ...ds.conditional!, value: e.target.value } }
                                                                            : ds
                                                                        )
                                                                        const updatedNestedSteps = step.conditional!.nestedSteps!.map(ns =>
                                                                          ns.id === nestedStep.id
                                                                            ? { ...ns, conditional: { ...ns.conditional!, nestedSteps: updatedDeeperSteps } }
                                                                            : ns
                                                                        )
                                                                        updateStep(step.id, {
                                                                          conditional: { ...step.conditional!, nestedSteps: updatedNestedSteps }
                                                                        })

                                                                        // Debounced search for people
                                                                        if (personSearchTimeoutRef.current) {
                                                                          clearTimeout(personSearchTimeoutRef.current)
                                                                        }

                                                                        const searchValue = e.target.value
                                                                        personSearchTimeoutRef.current = setTimeout(async () => {
                                                                          if (searchValue.length >= 2) {
                                                                            try {
                                                                              const response = await personService.getPeople(1, 50, false, searchValue)
                                                                              setPeople(response.people)
                                                                            } catch (err) {
                                                                              console.error('Failed to search people:', err)
                                                                            }
                                                                          } else {
                                                                            setPeople([])
                                                                          }
                                                                        }, 300)
                                                                      }}
                                                                      list={`people-list-deeper-${deeperStep.id}`}
                                                                      className="form-input"
                                                                      style={{ fontSize: '0.8rem' }}
                                                                      placeholder="Enter person name"
                                                                    />
                                                                    <datalist id={`people-list-deeper-${deeperStep.id}`}>
                                                                      {people.map((person) => (
                                                                        <option key={person.id} value={person.name} />
                                                                      ))}
                                                                    </datalist>
                                                                  </>
                                                                )
                                                              } else if (isChoiceType && question.options && Array.isArray(question.options)) {
                                                                // Show dropdown for choice-based questions
                                                                return (
                                                                  <select
                                                                    value={deeperStep.conditional?.value || ''}
                                                                    onChange={(e) => {
                                                                      const updatedDeeperSteps = nestedStep.conditional!.nestedSteps!.map(ds =>
                                                                        ds.id === deeperStep.id
                                                                          ? { ...ds, conditional: { ...ds.conditional!, value: e.target.value } }
                                                                          : ds
                                                                      )
                                                                      const updatedNestedSteps = step.conditional!.nestedSteps!.map(ns =>
                                                                        ns.id === nestedStep.id
                                                                          ? { ...ns, conditional: { ...ns.conditional!, nestedSteps: updatedDeeperSteps } }
                                                                          : ns
                                                                      )
                                                                      updateStep(step.id, {
                                                                        conditional: { ...step.conditional!, nestedSteps: updatedNestedSteps }
                                                                      })
                                                                    }}
                                                                    className="form-select"
                                                                    style={{ fontSize: '0.8rem' }}
                                                                  >
                                                                    <option value="">Select value...</option>
                                                                    {question.options.map((opt: any, idx: number) => {
                                                                      const optionValue = opt.value || opt.label
                                                                      return (
                                                                        <option key={optionValue || `deeper-opt-${idx}`} value={optionValue}>
                                                                          {opt.label}
                                                                        </option>
                                                                      )
                                                                    })}
                                                                  </select>
                                                                )
                                                              } else {
                                                                // Show text input for other question types
                                                                return (
                                                                  <input
                                                                    type="text"
                                                                    value={deeperStep.conditional?.value || ''}
                                                                    onChange={(e) => {
                                                                      const updatedDeeperSteps = nestedStep.conditional!.nestedSteps!.map(ds =>
                                                                        ds.id === deeperStep.id
                                                                          ? { ...ds, conditional: { ...ds.conditional!, value: e.target.value } }
                                                                          : ds
                                                                      )
                                                                      const updatedNestedSteps = step.conditional!.nestedSteps!.map(ns =>
                                                                        ns.id === nestedStep.id
                                                                          ? { ...ns, conditional: { ...ns.conditional!, nestedSteps: updatedDeeperSteps } }
                                                                          : ns
                                                                      )
                                                                      updateStep(step.id, {
                                                                        conditional: { ...step.conditional!, nestedSteps: updatedNestedSteps }
                                                                      })
                                                                    }}
                                                                    className="form-input"
                                                                    style={{ fontSize: '0.8rem' }}
                                                                    placeholder="Enter value"
                                                                  />
                                                                )
                                                              }
                                                            })()}
                                                          </div>

                                                          {/* Deeper Then go to group */}
                                                          <div>
                                                            <label style={{ fontSize: '0.7rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>
                                                              Then go to group
                                                            </label>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                              <select
                                                                value={deeperStep.conditional?.targetGroupId || ''}
                                                                onChange={(e) => {
                                                                  const updatedDeeperSteps = nestedStep.conditional!.nestedSteps!.map(ds =>
                                                                    ds.id === deeperStep.id
                                                                      ? { ...ds, conditional: { ...ds.conditional!, targetGroupId: Number(e.target.value) } }
                                                                      : ds
                                                                  )
                                                                  const updatedNestedSteps = step.conditional!.nestedSteps!.map(ns =>
                                                                    ns.id === nestedStep.id
                                                                      ? { ...ns, conditional: { ...ns.conditional!, nestedSteps: updatedDeeperSteps } }
                                                                      : ns
                                                                  )
                                                                  updateStep(step.id, {
                                                                    conditional: { ...step.conditional!, nestedSteps: updatedNestedSteps }
                                                                  })
                                                                }}
                                                                className="form-select"
                                                                style={{ fontSize: '0.8rem', flex: 1 }}
                                                              >
                                                                <option value="">Select target group...</option>
                                                                {questionGroups.map(group => (
                                                                  <option key={group.id} value={group.id}>
                                                                    {group.name}
                                                                  </option>
                                                                ))}
                                                              </select>

                                                              {/* Deeper nested action buttons - only show if depth allows */}
                                                              {(deeperStep.depth || 0) < 4 && (
                                                                <>
                                                                  <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                      const newDeeperConditional: FlowStep = {
                                                                        id: Date.now().toString() + '_cond',
                                                                        type: 'conditional',
                                                                        conditional: { identifier: '', value: '', nestedSteps: [] },
                                                                        depth: (deeperStep.depth || 0) + 1
                                                                      }
                                                                      // Add to deeperStep's nestedSteps (nested inside, not as sibling)
                                                                      const updatedDeeperSteps = nestedStep.conditional!.nestedSteps!.map(ds =>
                                                                        ds.id === deeperStep.id
                                                                          ? { ...ds, conditional: { ...ds.conditional!, nestedSteps: [...(ds.conditional?.nestedSteps || []), newDeeperConditional] } }
                                                                          : ds
                                                                      )
                                                                      
                                                                      const updatedNestedSteps = step.conditional!.nestedSteps!.map(ns =>
                                                                        ns.id === nestedStep.id
                                                                          ? { ...ns, conditional: { ...ns.conditional!, nestedSteps: updatedDeeperSteps } }
                                                                          : ns
                                                                      )
                                                                      updateStep(step.id, {
                                                                        conditional: { ...step.conditional!, nestedSteps: updatedNestedSteps }
                                                                      })
                                                                    }}
                                                                    style={{
                                                                      background: 'none',
                                                                      border: '1px solid #d1d5db',
                                                                      borderRadius: '0.375rem',
                                                                      padding: '0.25rem',
                                                                      cursor: 'pointer',
                                                                      color: '#7c3aed',
                                                                      display: 'flex',
                                                                      alignItems: 'center'
                                                                    }}
                                                                    title="Add deeper nested conditional"
                                                                  >
                                                                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '1rem', height: '1rem' }}>
                                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                    </svg>
                                                                  </button>
                                                                </>
                                                              )}

                                                              <button
                                                                type="button"
                                                                onClick={() => promoteNestedToMainLevel(nestedStep.id, deeperStep.id)}
                                                                style={{
                                                                  background: 'none',
                                                                  border: '1px solid #d1d5db',
                                                                  borderRadius: '0.375rem',
                                                                  padding: '0.25rem',
                                                                  cursor: 'pointer',
                                                                  color: '#2563eb',
                                                                  display: 'flex',
                                                                  alignItems: 'center'
                                                                }}
                                                                title="Promote to main level"
                                                              >
                                                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '1rem', height: '1rem' }}>
                                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                                                </svg>
                                                              </button>
                                                            </div>
                                                          </div>

                                                          {/* Render deeper deeper nested steps (level 4) */}
                                                          {deeperStep.conditional?.nestedSteps && deeperStep.conditional.nestedSteps.length > 0 && (
                                                            <div style={{ marginLeft: '1.5rem', marginTop: '0.75rem', borderLeft: '2px solid #e5e7eb', paddingLeft: '1rem', marginRight: '-2.5rem' }}>
                                                              {deeperStep.conditional.nestedSteps.map((deepestStep) => (
                                                                <div key={deepestStep.id} style={{ marginBottom: '0.75rem' }}>
                                                                  {deepestStep.type === 'group' ? (
                                                                    <div style={{
                                                                      padding: '0.75rem',
                                                                      border: '1px solid #e5e7eb',
                                                                      borderRadius: '0.5rem',
                                                                      backgroundColor: 'white'
                                                                    }}>
                                                                      <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6b7280' }}>
                                                                        Deepest Nested Group (Level 4)
                                                                      </div>
                                                                      <select
                                                                        value={deepestStep.groupId || ''}
                                                                        onChange={(e) => {
                                                                          const updatedDeepestSteps = deeperStep.conditional!.nestedSteps!.map(dst =>
                                                                            dst.id === deepestStep.id ? { ...dst, groupId: Number(e.target.value) } : dst
                                                                          )
                                                                          const updatedDeeperSteps = nestedStep.conditional!.nestedSteps!.map(ds =>
                                                                            ds.id === deeperStep.id
                                                                              ? { ...ds, conditional: { ...ds.conditional!, nestedSteps: updatedDeepestSteps } }
                                                                              : ds
                                                                          )
                                                                          const updatedNestedSteps = step.conditional!.nestedSteps!.map(ns =>
                                                                            ns.id === nestedStep.id
                                                                              ? { ...ns, conditional: { ...ns.conditional!, nestedSteps: updatedDeeperSteps } }
                                                                              : ns
                                                                          )
                                                                          updateStep(step.id, {
                                                                            conditional: { ...step.conditional!, nestedSteps: updatedNestedSteps }
                                                                          })
                                                                        }}
                                                                        className="form-select"
                                                                        style={{ fontSize: '0.8rem' }}
                                                                      >
                                                                        <option value="">Select group...</option>
                                                                        {questionGroups.map(group => (
                                                                          <option key={group.id} value={group.id}>
                                                                            {group.name}
                                                                          </option>
                                                                        ))}
                                                                      </select>
                                                                    </div>
                                                                  ) : (
                                                                    <div style={{
                                                                      padding: '0.75rem',
                                                                      border: '1px solid #e5e7eb',
                                                                      borderRadius: '0.5rem',
                                                                      backgroundColor: '#faf5ff'
                                                                    }}>
                                                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#7c3aed' }}>
                                                                          Nested Conditional (3)
                                                                        </div>
                                                                        <button
                                                                          type="button"
                                                                          onClick={() => {
                                                                            const updatedDeepestSteps = deeperStep.conditional!.nestedSteps!.filter(dst => dst.id !== deepestStep.id)
                                                                            const updatedDeeperSteps = nestedStep.conditional!.nestedSteps!.map(ds =>
                                                                              ds.id === deeperStep.id
                                                                                ? { ...ds, conditional: { ...ds.conditional!, nestedSteps: updatedDeepestSteps } }
                                                                                : ds
                                                                            )
                                                                            const updatedNestedSteps = step.conditional!.nestedSteps!.map(ns =>
                                                                              ns.id === nestedStep.id
                                                                                ? { ...ns, conditional: { ...ns.conditional!, nestedSteps: updatedDeeperSteps } }
                                                                                : ns
                                                                            )
                                                                            updateStep(step.id, {
                                                                              conditional: { ...step.conditional!, nestedSteps: updatedNestedSteps }
                                                                            })
                                                                          }}
                                                                          style={{
                                                                            background: 'none',
                                                                            border: 'none',
                                                                            padding: '0.25rem',
                                                                            cursor: 'pointer',
                                                                            color: '#dc2626'
                                                                          }}
                                                                          title="Remove deepest nested conditional"
                                                                        >
                                                                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '1rem', height: '1rem' }}>
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                          </svg>
                                                                        </button>
                                                                      </div>

                                                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                                        {/* Deepest If identifier */}
                                                                        <div>
                                                                          <label style={{ fontSize: '0.7rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>
                                                                            If identifier
                                                                          </label>
                                                                          <select
                                                                            value={deepestStep.conditional?.identifier || ''}
                                                                            onChange={(e) => {
                                                                              console.log('Deepest nested conditional identifier changed to:', e.target.value)
                                                                              const updatedDeepestSteps = deeperStep.conditional!.nestedSteps!.map(dst =>
                                                                                dst.id === deepestStep.id
                                                                                  ? { ...dst, conditional: { ...dst.conditional!, identifier: e.target.value } }
                                                                                  : dst
                                                                              )
                                                                              const updatedDeeperSteps = nestedStep.conditional!.nestedSteps!.map(ds =>
                                                                                ds.id === deeperStep.id
                                                                                  ? { ...ds, conditional: { ...ds.conditional!, nestedSteps: updatedDeepestSteps } }
                                                                                  : ds
                                                                              )
                                                                              const updatedNestedSteps = step.conditional!.nestedSteps!.map(ns =>
                                                                                ns.id === nestedStep.id
                                                                                  ? { ...ns, conditional: { ...ns.conditional!, nestedSteps: updatedDeeperSteps } }
                                                                                  : ns
                                                                              )
                                                                              console.log('Calling updateStep for deepest nested conditional identifier')
                                                                              updateStep(step.id, {
                                                                                conditional: { ...step.conditional!, nestedSteps: updatedNestedSteps }
                                                                              })
                                                                            }}
                                                                            className="form-select"
                                                                            style={{ fontSize: '0.8rem' }}
                                                                          >
                                                                            <option value="">Select identifier...</option>
                                                                            {getIdentifiersForGroup(deeperStep.conditional?.targetGroupId).map((identifier) => (
                                                                              <option key={identifier} value={identifier}>
                                                                                {identifier}
                                                                              </option>
                                                                            ))}
                                                                          </select>
                                                                        </div>

                                                                        {/* Deepest Equals value */}
                                                                        <div>
                                                                          <label style={{ fontSize: '0.7rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>
                                                                            Equals value
                                                                          </label>
                                                                          {(() => {
                                                                            // Get the question for the selected identifier to determine input type
                                                                            // Use the parent deeper conditional's target group
                                                                            const targetGroupId = deeperStep.conditional?.targetGroupId

                                                                            const question = getQuestionByIdentifier(targetGroupId, deepestStep.conditional?.identifier || '')
                                                                            const isChoiceType = question && ['multiple_choice', 'dropdown', 'checkbox_group'].includes(question.question_type)
                                                                            const isPersonType = question && question.question_type === 'person'
                                                                            const isDateType = question && question.question_type === 'date'

                                                                            if (isDateType) {
                                                                              // Show date input for date type questions
                                                                              return (
                                                                                <input
                                                                                  type="date"
                                                                                  value={deepestStep.conditional?.value || ''}
                                                                                  onChange={(e) => {
                                                                                    const updatedDeepestSteps = deeperStep.conditional!.nestedSteps!.map(dst =>
                                                                                      dst.id === deepestStep.id
                                                                                        ? { ...dst, conditional: { ...dst.conditional!, value: e.target.value } }
                                                                                        : dst
                                                                                    )
                                                                                    const updatedDeeperSteps = nestedStep.conditional!.nestedSteps!.map(ds =>
                                                                                      ds.id === deeperStep.id
                                                                                        ? { ...ds, conditional: { ...ds.conditional!, nestedSteps: updatedDeepestSteps } }
                                                                                        : ds
                                                                                    )
                                                                                    const updatedNestedSteps = step.conditional!.nestedSteps!.map(ns =>
                                                                                      ns.id === nestedStep.id
                                                                                        ? { ...ns, conditional: { ...ns.conditional!, nestedSteps: updatedDeeperSteps } }
                                                                                        : ns
                                                                                    )
                                                                                    updateStep(step.id, {
                                                                                      conditional: { ...step.conditional!, nestedSteps: updatedNestedSteps }
                                                                                    })
                                                                                  }}
                                                                                  className="form-input"
                                                                                  style={{ fontSize: '0.8rem' }}
                                                                                />
                                                                              )
                                                                            } else if (isPersonType) {
                                                                              // Show person type-ahead input
                                                                              return (
                                                                                <>
                                                                                  <input
                                                                                    type="text"
                                                                                    value={deepestStep.conditional?.value || ''}
                                                                                    onChange={async (e) => {
                                                                                      const updatedDeepestSteps = deeperStep.conditional!.nestedSteps!.map(dst =>
                                                                                        dst.id === deepestStep.id
                                                                                          ? { ...dst, conditional: { ...dst.conditional!, value: e.target.value } }
                                                                                          : dst
                                                                                      )
                                                                                      const updatedDeeperSteps = nestedStep.conditional!.nestedSteps!.map(ds =>
                                                                                        ds.id === deeperStep.id
                                                                                          ? { ...ds, conditional: { ...ds.conditional!, nestedSteps: updatedDeepestSteps } }
                                                                                          : ds
                                                                                      )
                                                                                      const updatedNestedSteps = step.conditional!.nestedSteps!.map(ns =>
                                                                                        ns.id === nestedStep.id
                                                                                          ? { ...ns, conditional: { ...ns.conditional!, nestedSteps: updatedDeeperSteps } }
                                                                                          : ns
                                                                                      )
                                                                                      updateStep(step.id, {
                                                                                        conditional: { ...step.conditional!, nestedSteps: updatedNestedSteps }
                                                                                      })

                                                                                      // Debounced search for people
                                                                                      if (personSearchTimeoutRef.current) {
                                                                                        clearTimeout(personSearchTimeoutRef.current)
                                                                                      }

                                                                                      const searchValue = e.target.value
                                                                                      personSearchTimeoutRef.current = setTimeout(async () => {
                                                                                        if (searchValue.length >= 2) {
                                                                                          try {
                                                                                            const response = await personService.getPeople(1, 50, false, searchValue)
                                                                                            setPeople(response.people)
                                                                                          } catch (err) {
                                                                                            console.error('Failed to search people:', err)
                                                                                          }
                                                                                        } else {
                                                                                          setPeople([])
                                                                                        }
                                                                                      }, 300)
                                                                                    }}
                                                                                    list={`people-list-deepest-${deepestStep.id}`}
                                                                                    className="form-input"
                                                                                    style={{ fontSize: '0.8rem' }}
                                                                                    placeholder="Type to search people..."
                                                                                  />
                                                                                  <datalist id={`people-list-deepest-${deepestStep.id}`}>
                                                                                    {people.map((person) => (
                                                                                      <option key={person.id} value={person.name} />
                                                                                    ))}
                                                                                  </datalist>
                                                                                </>
                                                                              )
                                                                            } else if (isChoiceType && question.options && Array.isArray(question.options)) {
                                                                              // Show dropdown for choice-based questions
                                                                              return (
                                                                                <select
                                                                                  value={deepestStep.conditional?.value || ''}
                                                                                  onChange={(e) => {
                                                                                    const updatedDeepestSteps = deeperStep.conditional!.nestedSteps!.map(dst =>
                                                                                      dst.id === deepestStep.id
                                                                                        ? { ...dst, conditional: { ...dst.conditional!, value: e.target.value } }
                                                                                        : dst
                                                                                    )
                                                                                    const updatedDeeperSteps = nestedStep.conditional!.nestedSteps!.map(ds =>
                                                                                      ds.id === deeperStep.id
                                                                                        ? { ...ds, conditional: { ...ds.conditional!, nestedSteps: updatedDeepestSteps } }
                                                                                        : ds
                                                                                    )
                                                                                    const updatedNestedSteps = step.conditional!.nestedSteps!.map(ns =>
                                                                                      ns.id === nestedStep.id
                                                                                        ? { ...ns, conditional: { ...ns.conditional!, nestedSteps: updatedDeeperSteps } }
                                                                                        : ns
                                                                                    )
                                                                                    updateStep(step.id, {
                                                                                      conditional: { ...step.conditional!, nestedSteps: updatedNestedSteps }
                                                                                    })
                                                                                  }}
                                                                                  className="form-select"
                                                                                  style={{ fontSize: '0.8rem' }}
                                                                                >
                                                                                  <option value="">Select value...</option>
                                                                                  {question.options.map((opt: any, idx: number) => {
                                                                                    const optionValue = opt.value || opt.label
                                                                                    return (
                                                                                      <option key={optionValue || `deepest-opt-${idx}`} value={optionValue}>
                                                                                        {opt.label}
                                                                                      </option>
                                                                                    )
                                                                                  })}
                                                                                </select>
                                                                              )
                                                                            } else {
                                                                              // Show text input for other question types
                                                                              return (
                                                                                <input
                                                                                  type="text"
                                                                                  value={deepestStep.conditional?.value || ''}
                                                                                  onChange={(e) => {
                                                                                    const updatedDeepestSteps = deeperStep.conditional!.nestedSteps!.map(dst =>
                                                                                      dst.id === deepestStep.id
                                                                                        ? { ...dst, conditional: { ...dst.conditional!, value: e.target.value } }
                                                                                        : dst
                                                                                    )
                                                                                    const updatedDeeperSteps = nestedStep.conditional!.nestedSteps!.map(ds =>
                                                                                      ds.id === deeperStep.id
                                                                                        ? { ...ds, conditional: { ...ds.conditional!, nestedSteps: updatedDeepestSteps } }
                                                                                        : ds
                                                                                    )
                                                                                    const updatedNestedSteps = step.conditional!.nestedSteps!.map(ns =>
                                                                                      ns.id === nestedStep.id
                                                                                        ? { ...ns, conditional: { ...ns.conditional!, nestedSteps: updatedDeeperSteps } }
                                                                                        : ns
                                                                                    )
                                                                                    updateStep(step.id, {
                                                                                      conditional: { ...step.conditional!, nestedSteps: updatedNestedSteps }
                                                                                    })
                                                                                  }}
                                                                                  className="form-input"
                                                                                  style={{ fontSize: '0.8rem' }}
                                                                                  placeholder="Enter value"
                                                                                />
                                                                              )
                                                                            }
                                                                          })()}
                                                                        </div>

                                                                        {/* Deepest Then go to group */}
                                                                        <div>
                                                                          <label style={{ fontSize: '0.7rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>
                                                                            Then go to group
                                                                          </label>
                                                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                            <select
                                                                              value={deepestStep.conditional?.targetGroupId || ''}
                                                                              onChange={(e) => {
                                                                                const updatedDeepestSteps = deeperStep.conditional!.nestedSteps!.map(dst =>
                                                                                  dst.id === deepestStep.id
                                                                                    ? { ...dst, conditional: { ...dst.conditional!, targetGroupId: Number(e.target.value) } }
                                                                                    : dst
                                                                                )
                                                                                const updatedDeeperSteps = nestedStep.conditional!.nestedSteps!.map(ds =>
                                                                                  ds.id === deeperStep.id
                                                                                    ? { ...ds, conditional: { ...ds.conditional!, nestedSteps: updatedDeepestSteps } }
                                                                                    : ds
                                                                                )
                                                                                const updatedNestedSteps = step.conditional!.nestedSteps!.map(ns =>
                                                                                  ns.id === nestedStep.id
                                                                                    ? { ...ns, conditional: { ...ns.conditional!, nestedSteps: updatedDeeperSteps } }
                                                                                    : ns
                                                                                )
                                                                                updateStep(step.id, {
                                                                                  conditional: { ...step.conditional!, nestedSteps: updatedNestedSteps }
                                                                                })
                                                                              }}
                                                                              className="form-select"
                                                                              style={{ fontSize: '0.8rem', flex: 1 }}
                                                                            >
                                                                              <option value="">Select target group...</option>
                                                                              {questionGroups.map(group => (
                                                                                <option key={group.id} value={group.id}>
                                                                                  {group.name}
                                                                                </option>
                                                                              ))}
                                                                            </select>

                                                                            {/* Only left arrow - no conditional or group buttons at max depth */}
                                                                            <button
                                                                              type="button"
                                                                              onClick={() => promoteNestedToMainLevel(deeperStep.id, deepestStep.id)}
                                                                              style={{
                                                                                background: 'none',
                                                                                border: '1px solid #d1d5db',
                                                                                borderRadius: '0.375rem',
                                                                                padding: '0.25rem',
                                                                                cursor: 'pointer',
                                                                                color: '#2563eb',
                                                                                display: 'flex',
                                                                                alignItems: 'center'
                                                                              }}
                                                                              title="Promote to main level"
                                                                            >
                                                                              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '0.875rem', height: '0.875rem' }}>
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                                                              </svg>
                                                                            </button>
                                                                          </div>
                                                                        </div>
                                                                      </div>
                                                                    </div>
                                                                  )}
                                                                </div>
                                                              ))}
                                                            </div>
                                                          )}
                                                        </div>
                                                      </div>
                                                    )}
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: '1.5rem' }}>
              <button
                type="button"
                onClick={addGroupStep}
                style={{
                  background: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontWeight: 500
                }}
              >
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '1rem', height: '1rem' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Step
              </button>
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EditFlow
