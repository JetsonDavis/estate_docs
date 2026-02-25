import React, { useState, useEffect, useRef } from 'react'
import { flushSync } from 'react-dom'
import { Navigate, useNavigate, useLocation, useParams } from 'react-router-dom'
import { questionGroupService } from '../../services/questionService'
import { QuestionGroup, QuestionType, QuestionOption, QuestionLogicItem } from '../../types/question'
import PersonTypeahead from '../../components/common/PersonTypeahead'
import './QuestionGroups.css'

const QuestionGroups: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams()

  // Determine current view early so we can use it for initial state
  const isCreateView = location.pathname.includes('/new')
  const isEditView = location.pathname.includes('/edit')
  const isDetailView = id && !isEditView
  const isListView = !isCreateView && !isEditView && !isDetailView

  const [groups, setGroups] = useState<QuestionGroup[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(isListView)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set())

  const pageSize = 20

  useEffect(() => {
    if (isListView) {
      loadGroups()
    }
  }, [page, isListView])

  const loadGroups = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await questionGroupService.listQuestionGroups(page, pageSize, false)
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

    // Calculate pagination state before deletion
    const itemsOnCurrentPage = groups.length
    const totalPages = Math.ceil(total / pageSize)
    const hasNextPage = page < totalPages
    const willBeEmptyPage = itemsOnCurrentPage === 1 && page > 1

    // Store previous state for potential rollback
    const previousGroups = groups
    const previousTotal = total

    // Optimistic update - remove from UI immediately
    setGroups(prev => prev.filter(g => g.id !== groupId))
    setTotal(prev => prev - 1)

    // If there's a next page and we're not going to an empty page, fetch the first item from next page
    if (hasNextPage && !willBeEmptyPage) {
      try {
        const nextPageResponse = await questionGroupService.listQuestionGroups(page + 1, 1, false)
        if (nextPageResponse.question_groups.length > 0) {
          // Append the first item from next page to current page
          setGroups(prev => [...prev, nextPageResponse.question_groups[0]])
        }
      } catch (err: any) {
        // If fetching next item fails, we'll continue with the deletion
        console.error('Failed to fetch replacement item:', err)
      }
    } else if (willBeEmptyPage) {
      // If current page will be empty and we're not on page 1, go to previous page
      setPage(page - 1)
    }

    setSuccess('Question group deleted successfully')

    // Delete in background
    try {
      await questionGroupService.deleteQuestionGroup(groupId)
    } catch (err: any) {
      // Revert on error - restore previous state
      setGroups(previousGroups)
      setTotal(previousTotal)
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
      <div className="question-groups-wrapper">
      <div className="question-groups-header">
        <div>
          <h1 className="question-groups-title">Question Groups</h1>
          <p className="question-groups-subtitle">
            Create and manage question groups for documents
          </p>
        </div>
        <button onClick={() => navigate('/admin/question-groups/new')} className="create-button">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="button-icon">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Questions Group
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
                      <input
                        type="checkbox"
                        checked={group.is_active}
                        onChange={async (e) => {
                          try {
                            await questionGroupService.updateQuestionGroup(group.id, {
                              is_active: e.target.checked
                            })
                            // Refresh the list
                            setGroups(prev => prev.map(g =>
                              g.id === group.id ? { ...g, is_active: e.target.checked } : g
                            ))
                          } catch (err) {
                            console.error('Failed to update group status:', err)
                          }
                        }}
                        style={{
                          width: '1rem',
                          height: '1rem',
                          marginRight: '0.5rem',
                          cursor: 'pointer',
                          position: 'relative',
                          top: '-2px'
                        }}
                        title={group.is_active ? 'Active - click to deactivate' : 'Inactive - click to activate'}
                      />
                      <span
                        onClick={() => navigate(`/admin/question-groups/${group.id}/edit`)}
                        style={{ cursor: 'pointer', color: '#2563eb', fontSize: '0.875rem', fontWeight: '400' }}
                      >
                        {group.name}
                      </span>
                      <span className="badge badge-count">
                        {group.question_count} questions
                      </span>
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
                            marginLeft: '0.5rem',
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
                      {!group.is_active && (
                        <span className="badge badge-inactive">
                          Inactive
                        </span>
                      )}
                    </div>
                    {group.description && (
                      <p className="group-description">{group.description}</p>
                    )}
                    {group.questions && group.questions.length > 0 && (
                      <div>
                        <button
                          onClick={() => {
                            setExpandedGroups(prev => {
                              const newSet = new Set(prev)
                              if (newSet.has(group.id)) {
                                newSet.delete(group.id)
                              } else {
                                newSet.add(group.id)
                              }
                              return newSet
                            })
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: '0.25rem 0',
                            cursor: 'pointer',
                            color: '#6b7280',
                            fontSize: '0.875rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            fontWeight: '600'
                          }}
                        >
                          <svg
                            style={{
                              width: '1rem',
                              height: '1rem',
                              transform: expandedGroups.has(group.id) ? 'rotate(90deg)' : 'rotate(0deg)',
                              transition: 'transform 0.2s'
                            }}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Question Identifiers
                        </button>
                        {expandedGroups.has(group.id) && (
                          <div style={{
                            marginTop: '0.5rem',
                            paddingLeft: '1.5rem',
                            fontSize: '0.875rem',
                            color: '#4b5563'
                          }}>
                            {group.questions.map((q: any, idx: number) => (
                              <div key={idx} style={{ marginBottom: '0.25rem' }}>
                                <code style={{
                                  backgroundColor: '#f3f4f6',
                                  padding: '0.125rem 0.375rem',
                                  borderRadius: '0.25rem',
                                  fontFamily: 'monospace',
                                  fontSize: '0.8125rem'
                                }}>
                                  {stripIdentifierNamespace(q.identifier)}
                                </code>
                                <span style={{
                                  marginLeft: '0.5rem',
                                  padding: '0.125rem 0.375rem',
                                  backgroundColor: '#dbeafe',
                                  color: '#1e40af',
                                  borderRadius: '0.25rem',
                                  fontSize: '0.75rem',
                                  fontWeight: '500'
                                }}>
                                  {q.question_type}
                                </span>
                                <span style={{ marginLeft: '0.5rem', color: '#9ca3af' }}>
                                  {q.question_text}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
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
  repeatable: boolean
  repeatable_group_id?: string  // ID to group repeatable questions together
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

// Helper to strip namespace prefix from identifier (e.g., "group.field" -> "field")
// The namespace is never shown to users - they only see the field name
const stripIdentifierNamespace = (identifier: string): string => {
  const dotIndex = identifier.indexOf('.')
  return dotIndex >= 0 ? identifier.substring(dotIndex + 1) : identifier
}

// Color scheme for different nesting depths
// Level 0 (root): gray, Level 1: purple, Level 2: green, Level 3: amber, Level 4: red
const getDepthBackgroundColor = (depth: number): string => {
  const colors = [
    '#f9fafb', // Level 0: gray-50
    '#faf5ff', // Level 1: purple-50
    '#f0fdf4', // Level 2: green-50
    '#fffbeb', // Level 3: amber-50
    '#fef2f2', // Level 4: red-50
  ]
  return colors[Math.min(depth, colors.length - 1)]
}

const getDepthBorderColor = (depth: number): string => {
  const colors = [
    '#e5e7eb', // Level 0: gray-200
    '#e9d5ff', // Level 1: purple-200
    '#bbf7d0', // Level 2: green-200
    '#fde68a', // Level 3: amber-200
    '#fecaca', // Level 4: red-200
  ]
  return colors[Math.min(depth, colors.length - 1)]
}

const getDepthTextColor = (depth: number): string => {
  const colors = [
    '#374151', // Level 0: gray-700
    '#7c3aed', // Level 1: purple-600
    '#16a34a', // Level 2: green-600
    '#d97706', // Level 3: amber-600
    '#dc2626', // Level 4: red-600
  ]
  return colors[Math.min(depth, colors.length - 1)]
}

const CreateQuestionGroupForm: React.FC<CreateQuestionGroupFormProps> = ({ groupId }) => {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [questions, setQuestions] = useState<QuestionFormData[]>([])
  const [questionLogic, setQuestionLogic] = useState<QuestionLogicItem[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [openDisplayModeDropdown, setOpenDisplayModeDropdown] = useState<string | null>(null)
  const [isDuplicateName, setIsDuplicateName] = useState(false)
  const [isCheckingName, setIsCheckingName] = useState(false)
  const [groupInfoSaved, setGroupInfoSaved] = useState(false)
  const [savedGroupId, setSavedGroupId] = useState<number | null>(groupId || null)
  const savedGroupIdRef = useRef<number | null>(groupId || null)
  const [loading, setLoading] = useState(!!groupId)
  const displayModeDropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})
  const nameCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const autoSaveTimeoutRefs = useRef<{ [key: string]: NodeJS.Timeout | null }>({})
  const identifierCheckTimeoutRefs = useRef<{ [key: string]: NodeJS.Timeout | null }>({})
  const questionLogicSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const groupInfoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pendingRequestsRef = useRef<number>(0)
  const [hasPendingRequests, setHasPendingRequests] = useState(false)
  const nestedQuestionIdsRef = useRef<Set<string>>(new Set())
  const isEditMode = !!groupId

  // Track pending requests
  const incrementPendingRequests = () => {
    pendingRequestsRef.current++
    setHasPendingRequests(true)
  }
  
  const decrementPendingRequests = () => {
    pendingRequestsRef.current = Math.max(0, pendingRequestsRef.current - 1)
    if (pendingRequestsRef.current === 0) {
      setHasPendingRequests(false)
    }
  }

  // No beforeunload warning - auto-save handles persistence
  // Pending requests complete quickly in the background

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
          savedGroupIdRef.current = groupId

          // Load questions if they exist
          const loadedQuestions: QuestionFormData[] = groupData.questions && groupData.questions.length > 0
            ? groupData.questions.map(q => {
                return {
                  id: q.id.toString(),
                  dbId: q.id,
                  question_text: q.question_text,
                  question_type: q.question_type,
                  identifier: stripIdentifierNamespace(q.identifier),
                  repeatable: q.repeatable || false,
                  repeatable_group_id: q.repeatable_group_id || undefined,
                  is_required: q.is_required,
                  options: q.options || [],
                  person_display_mode: q.person_display_mode || undefined,
                  include_time: q.include_time || false,
                  lastSaved: new Date()
                }
              })
            : []
          setQuestions(loadedQuestions)

          // Load question logic if it exists, and clean up orphaned items
          if (groupData.question_logic && groupData.question_logic.length > 0) {
            // Create a set of valid question IDs
            const validQuestionIds = new Set(loadedQuestions.map(q => q.dbId))
            
            // Build a map of localQuestionId -> dbId for questions that have been saved
            // This is used to fix question slots that were saved with undefined questionId
            const localIdToDbId = new Map<string, number>()
            for (const q of loadedQuestions) {
              if (q.dbId && q.id) {
                localIdToDbId.set(q.id, q.dbId)
              }
            }

            // First pass: Fix question items that have localQuestionId but undefined questionId
            // This must happen BEFORE cleanOrphanedItems or the slots will be removed
            const fixUndefinedQuestionIds = (items: QuestionLogicItem[]): QuestionLogicItem[] => {
              return items.map(item => {
                if (item.type === 'question' && !item.questionId) {
                  const localId = (item as any).localQuestionId
                  if (localId && localIdToDbId.has(localId)) {
                    const dbId = localIdToDbId.get(localId)!
                    return { ...item, questionId: dbId }
                  }
                }
                if (item.type === 'conditional' && item.conditional?.nestedItems) {
                  return {
                    ...item,
                    conditional: {
                      ...item.conditional,
                      nestedItems: fixUndefinedQuestionIds(item.conditional.nestedItems)
                    }
                  }
                }
                return item
              })
            }
            
            // Fix undefined questionIds first
            let fixedLogic = fixUndefinedQuestionIds(groupData.question_logic)

            // Recursively clean orphaned question items from logic
            // Now we only remove items that have invalid questionIds (not in DB)
            const cleanOrphanedItems = (items: QuestionLogicItem[]): QuestionLogicItem[] => {
              return items.filter(item => {
                if (item.type === 'question') {
                  // Keep if questionId exists in valid questions
                  // Also keep if questionId is undefined but has localQuestionId (might be unsaved)
                  if (item.questionId && validQuestionIds.has(item.questionId)) {
                    return true
                  }
                  // If still undefined after fix attempt, check if it has a localQuestionId
                  // that might correspond to a question that hasn't been saved yet
                  const localId = (item as any).localQuestionId
                  if (!item.questionId && localId) {
                    return true
                  }
                  return false
                }
                return true // Keep conditionals
              }).map(item => {
                if (item.type === 'conditional' && item.conditional?.nestedItems) {
                  return {
                    ...item,
                    conditional: {
                      ...item.conditional,
                      nestedItems: cleanOrphanedItems(item.conditional.nestedItems)
                    }
                  }
                }
                return item
              })
            }

            let cleanedLogic = cleanOrphanedItems(fixedLogic)
            
            // Find questions that exist in DB but are missing from question_logic (orphaned questions)
            // Also count how many question slots exist in the logic (including those with undefined questionId)
            const getQuestionIdsFromLogic = (items: QuestionLogicItem[]): Set<number> => {
              const ids = new Set<number>()
              for (const item of items) {
                if (item.type === 'question' && item.questionId) {
                  ids.add(item.questionId)
                }
                if (item.type === 'conditional' && item.conditional?.nestedItems) {
                  const nestedIds = getQuestionIdsFromLogic(item.conditional.nestedItems)
                  nestedIds.forEach(id => ids.add(id))
                }
              }
              return ids
            }
            
            // Count total question slots in logic (including those with undefined questionId)
            // This helps us understand if there are "placeholder" slots for unsaved questions
            const countQuestionSlotsInLogic = (items: QuestionLogicItem[]): number => {
              let count = 0
              for (const item of items) {
                if (item.type === 'question') {
                  count++
                }
                if (item.type === 'conditional' && item.conditional?.nestedItems) {
                  count += countQuestionSlotsInLogic(item.conditional.nestedItems)
                }
              }
              return count
            }
            
            // Check if we fixed any undefined questionIds (compare fixedLogic to original)
            const logicBeforeFix = JSON.stringify(groupData.question_logic)
            const logicAfterFix = JSON.stringify(fixedLogic)
            const wasFixed = logicBeforeFix !== logicAfterFix
            
            const questionIdsInLogic = getQuestionIdsFromLogic(cleanedLogic)
            const totalSlots = countQuestionSlotsInLogic(cleanedLogic)
            
            const orphanedQuestions = loadedQuestions.filter(q => q.dbId && !questionIdsInLogic.has(q.dbId))
            
            // Only add orphaned questions if they are truly missing from the logic
            // AND there are no empty slots that could be filled
            if (orphanedQuestions.length > 0) {
              // Check if there are unfilled slots in the logic that could hold these questions
              const unfilledSlots = totalSlots - questionIdsInLogic.size
              if (unfilledSlots < orphanedQuestions.length) {
                console.warn('WARNING: Found orphaned questions in DB but not in logic:', orphanedQuestions.map(q => q.identifier))
                console.warn('These questions exist in the database but are not in the question_logic. They will be added at the root level for display only.')
                for (const orphan of orphanedQuestions) {
                  cleanedLogic.push({
                    id: `restored_${orphan.dbId}_${Date.now()}`,
                    type: 'question',
                    questionId: orphan.dbId,
                    depth: 0
                  })
                }
              }
            }
            
            setQuestionLogic(cleanedLogic)

            // If we fixed undefined questionIds, save the corrected logic to the server
            // This ensures nested questions maintain their correct position after refresh
            if (wasFixed) {
              try {
                await questionGroupService.updateQuestionGroup(groupId, {
                  question_logic: cleanedLogic
                })
              } catch (err) {
                console.error('Failed to save corrected question_logic:', err)
              }
            }
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
        const duplicate = response.question_groups.some(g => g.name.toLowerCase() === name.toLowerCase())
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

  // Auto-save group name/description when changed (only when already saved)
  useEffect(() => {
    if (!groupInfoSaved || !savedGroupId) return

    if (groupInfoSaveTimeoutRef.current) {
      clearTimeout(groupInfoSaveTimeoutRef.current)
    }

    groupInfoSaveTimeoutRef.current = setTimeout(async () => {
      incrementPendingRequests()
      try {
        await questionGroupService.updateQuestionGroup(savedGroupId, {
          name,
          description: description || undefined
        })
      } catch (error) {
        console.error('Failed to auto-save group info:', error)
      } finally {
        decrementPendingRequests()
      }
    }, 500)

    return () => {
      if (groupInfoSaveTimeoutRef.current) {
        clearTimeout(groupInfoSaveTimeoutRef.current)
      }
    }
  }, [name, description, groupInfoSaved, savedGroupId])

  const isNameUnique = name.trim() !== '' && !isDuplicateName
  const canAddQuestion = isNameUnique

  const isLogicItemForQuestion = (item: QuestionLogicItem, question: QuestionFormData): boolean => {
    const localId = (item as any).localQuestionId as string | undefined
    if (localId && localId === question.id) {
      return true
    }
    return item.questionId != null && question.dbId != null && item.questionId === question.dbId
  }

  const findQuestionForLogicItem = (item: QuestionLogicItem): QuestionFormData | undefined => {
    const localId = (item as any).localQuestionId as string | undefined
    return questions.find(q =>
      (localId != null && q.id === localId) ||
      (item.questionId != null && q.dbId != null && q.dbId === item.questionId)
    )
  }

  const addQuestion = (): QuestionFormData => {
    const newQuestion: QuestionFormData = {
      id: Date.now().toString(),
      question_text: '',
      question_type: 'free_text',
      identifier: '',
      repeatable: false,
      is_required: false,
      options: []
    }
    setQuestions(prev => [...prev, newQuestion])
    return newQuestion
  }

  const updateQuestion = (id: string, field: keyof QuestionFormData, value: any) => {
    setQuestions(prevQuestions => prevQuestions.map(q => {
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
        // Use a promise to get current state since we're in an async callback
        let localDuplicate = false
        setQuestions(prev => {
          localDuplicate = prev.some(q =>
            q.id !== question.id &&
            q.identifier.trim() !== '' &&
            q.identifier.toLowerCase() === question.identifier.toLowerCase()
          )
          return prev // Don't modify, just read
        })

        if (localDuplicate) {
          setQuestions(prev => prev.map(q =>
            q.id === question.id ? { ...q, isDuplicateIdentifier: true, isCheckingIdentifier: false } : q
          ))
          return
        }

        // Then check against the database using the efficient endpoint
        // Need savedGroupId to build the namespaced identifier for checking
        if (!savedGroupId) {
          setQuestions(prev => prev.map(q =>
            q.id === question.id ? { ...q, isDuplicateIdentifier: false, isCheckingIdentifier: false } : q
          ))
          return
        }
        
        const result = await questionGroupService.checkQuestionIdentifier(
          question.identifier,
          savedGroupId,
          question.dbId
        )

        setQuestions(prev => prev.map(q =>
          q.id === question.id ? { ...q, isDuplicateIdentifier: result.exists, isCheckingIdentifier: false } : q
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
    if (!savedGroupIdRef.current) {
      return
    }

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
        // Get the latest version of the question from state
        setQuestions(prev => {
          const latestQuestion = prev.find(q => q.id === question.id)
          if (latestQuestion) {
            autoSaveQuestion(latestQuestion)
          }
          return prev // Don't modify state, just read it
        })
      }, 1000) // 1 second debounce
    }
  }

  const autoSaveQuestion = async (question: QuestionFormData) => {
    // Use ref to get current value, avoiding stale closure
    const currentGroupId = savedGroupIdRef.current
    
    if (!currentGroupId) return

    // Don't save if missing identifier (question_text can be empty initially)
    if (!question.identifier.trim()) return

    // Don't save if identifier is duplicate
    if (question.isDuplicateIdentifier) return

    // Mark as saving
    setQuestions(prev => prev.map(q =>
      q.id === question.id ? { ...q, isSaving: true } : q
    ))

    incrementPendingRequests()
    try {
      // Calculate display_order based on position in questionLogic, not questions array
      let displayOrder = 1
      setQuestionLogic(prev => {
        // Find the position of this question in the logic array (flattened)
        const findPositionInLogic = (items: QuestionLogicItem[], localId: string, currentPos: number): number => {
          for (const item of items) {
            if (item.type === 'question') {
              currentPos++
              if ((item as any).localQuestionId === localId || (question.dbId != null && item.questionId != null && item.questionId === question.dbId)) {
                return currentPos
              }
            }
            if (item.type === 'conditional' && item.conditional?.nestedItems) {
              const nestedPos = findPositionInLogic(item.conditional.nestedItems, localId, currentPos)
              if (nestedPos > currentPos) {
                return nestedPos
              }
              // Count questions in nested items for position tracking
              const countQuestions = (items: QuestionLogicItem[]): number => {
                let count = 0
                for (const i of items) {
                  if (i.type === 'question') count++
                  if (i.type === 'conditional' && i.conditional?.nestedItems) {
                    count += countQuestions(i.conditional.nestedItems)
                  }
                }
                return count
              }
              currentPos += countQuestions(item.conditional.nestedItems)
            }
          }
          return currentPos
        }
        displayOrder = findPositionInLogic(prev, question.id, 0)
        if (displayOrder === 0) displayOrder = prev.length + 1 // Fallback to end
        return prev // Don't modify, just read
      })

      if (question.dbId) {
        // Update existing question
        await questionGroupService.updateQuestion(question.dbId, {
          question_text: question.question_text,
          question_type: question.question_type,
          identifier: question.identifier,
          repeatable: question.repeatable,
          repeatable_group_id: question.repeatable_group_id,
          is_required: question.is_required,
          display_order: displayOrder,
          options: question.question_type === 'multiple_choice' || question.question_type === 'checkbox_group' || question.question_type === 'dropdown' ? question.options : undefined,
          person_display_mode: question.question_type === 'person' ? question.person_display_mode : undefined,
          include_time: question.question_type === 'date' ? question.include_time : undefined
        })
      } else {
        // Create new question - only include fields with values
        const createPayload: any = {
          question_group_id: currentGroupId,
          question_text: question.question_text || '',
          question_type: question.question_type,
          identifier: question.identifier,
          repeatable: question.repeatable || false,
          is_required: question.is_required || false,
          display_order: displayOrder,
        }
        if (question.repeatable_group_id) {
          createPayload.repeatable_group_id = question.repeatable_group_id
        }
        if ((question.question_type === 'multiple_choice' || question.question_type === 'checkbox_group' || question.question_type === 'dropdown') && question.options?.length) {
          createPayload.options = question.options
        }
        if (question.question_type === 'person' && question.person_display_mode) {
          createPayload.person_display_mode = question.person_display_mode
        }
        if (question.question_type === 'date' && question.include_time !== undefined) {
          createPayload.include_time = question.include_time
        }
        const created = await questionGroupService.createQuestion(currentGroupId, createPayload)

        // Update with database ID
        setQuestions(prev => prev.map(q =>
          q.id === question.id ? { ...q, dbId: created.id } : q
        ))

        // Also update the questionId in questionLogic
        setQuestionLogic(prev => {
          const updateLogicItems = (items: QuestionLogicItem[]): QuestionLogicItem[] => {
            return items.map(item => {
              if (item.type === 'question' && (item as any).localQuestionId === question.id) {
                return { ...item, questionId: created.id }
              }
              if (item.type === 'conditional' && item.conditional?.nestedItems) {
                return {
                  ...item,
                  conditional: {
                    ...item.conditional,
                    nestedItems: updateLogicItems(item.conditional.nestedItems)
                  }
                }
              }
              return item
            })
          }
          const updated = updateLogicItems(prev)
          saveQuestionLogic(updated, currentGroupId)
          return updated
        })
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
    } finally {
      decrementPendingRequests()
    }
  }

  const removeQuestion = async (id: string) => {
    const questionToRemove = questions.find(q => q.id === id)

    // If the question has a dbId, delete it from the database
    if (questionToRemove?.dbId) {
      incrementPendingRequests()
      try {
        await questionGroupService.deleteQuestion(questionToRemove.dbId)
      } catch (err) {
        console.error('Failed to delete question from database:', err)
      } finally {
        decrementPendingRequests()
      }
    }

    setQuestions(questions.filter(q => q.id !== id))
    
    // Also remove the question from questionLogic (including nested items)
    const removeFromLogic = (items: QuestionLogicItem[]): QuestionLogicItem[] => {
      const result: QuestionLogicItem[] = []
      for (const item of items) {
        // Check if this is the question to remove
        if (item.type === 'question') {
          const localId = (item as any).localQuestionId
          if (localId === id || (questionToRemove?.dbId != null && item.questionId != null && item.questionId === questionToRemove.dbId)) {
            continue // Skip this item (remove it)
          }
        }
        // Recursively process nested items in conditionals
        if (item.conditional?.nestedItems) {
          result.push({
            ...item,
            conditional: {
              ...item.conditional,
              nestedItems: removeFromLogic(item.conditional.nestedItems)
            }
          })
        } else {
          result.push(item)
        }
      }
      return result
    }
    
    setQuestionLogic(prevLogic => {
      const newLogic = removeFromLogic(prevLogic)
      saveQuestionLogic(newLogic)
      return newLogic
    })
  }

  const addOption = (questionId: string) => {
    setQuestions(prev => {
      const question = prev.find(q => q.id === questionId)
      const newOptionIndex = question ? question.options.length : 0
      
      // Focus the new option input after state update
      setTimeout(() => {
        const input = document.querySelector(`[data-option-input="${questionId}-${newOptionIndex}"]`) as HTMLInputElement
        if (input) input.focus()
      }, 0)
      
      return prev.map(q => {
        if (q.id === questionId) {
          return {
            ...q,
            options: [...q.options, { value: '', label: '' }]
          }
        }
        return q
      })
    })
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

  // Question Logic Functions
  const saveQuestionLogic = async (newLogic: QuestionLogicItem[], groupIdOverride?: number) => {
    const targetGroupId = groupIdOverride || savedGroupIdRef.current
    if (!targetGroupId) return

    // Clear existing timeout
    if (questionLogicSaveTimeoutRef.current) {
      clearTimeout(questionLogicSaveTimeoutRef.current)
    }

    // Save immediately without debounce to avoid race conditions
    incrementPendingRequests()
    try {
      await questionGroupService.updateQuestionGroup(targetGroupId, {
        question_logic: newLogic
      })
    } catch (err) {
      console.error('Failed to save question logic:', err)
    } finally {
      decrementPendingRequests()
    }
  }

  // Insert a question BEFORE a specific index (for the insert button)
  const insertQuestionBeforeIndex = (beforeIndex: number, questionArrayIndex: number) => {
    // Create the new question data
    const newQuestion: QuestionFormData = {
      id: Date.now().toString(),
      question_text: '',
      question_type: 'free_text',
      identifier: '',
      repeatable: false,
      is_required: false,
      options: []
    }

    // Insert at the correct position in the questions array
    setQuestions(prev => [
      ...prev.slice(0, questionArrayIndex),
      newQuestion,
      ...prev.slice(questionArrayIndex)
    ])

    const newLogicItem: QuestionLogicItem = {
      id: Date.now().toString(),
      type: 'question',
      questionId: undefined,
      depth: 0
    }

    ;(newLogicItem as any).localQuestionId = newQuestion.id

    // Capture savedGroupId before entering any callbacks to avoid stale closure
    const currentGroupId = savedGroupId

    // Insert at the specified index (before the item at that index) - use functional update
    setQuestionLogic(prevLogic => {
      const newLogic = [...prevLogic.slice(0, beforeIndex), newLogicItem, ...prevLogic.slice(beforeIndex)]
      if (currentGroupId) saveQuestionLogic(newLogic, currentGroupId)
      return newLogic
    })
  }

  const addQuestionToLogic = (afterIndex?: number, parentPath?: number[]) => {
    // Create the new question data
    const newQuestion: QuestionFormData = {
      id: Date.now().toString(),
      question_text: '',
      question_type: 'free_text',
      identifier: '',
      repeatable: false,
      is_required: false,
      options: []
    }

    const newLogicItem: QuestionLogicItem = {
      id: Date.now().toString() + '_logic',
      type: 'question',
      questionId: undefined, // Will be set when question is saved
      depth: parentPath ? parentPath.length : 0
    }

    // Store the local question ID temporarily for matching
    ;(newLogicItem as any).localQuestionId = newQuestion.id

    // Capture savedGroupId before entering any callbacks to avoid stale closure
    const currentGroupId = savedGroupIdRef.current
    
    if (parentPath && parentPath.length > 0) {
      // Mark this question as nested IMMEDIATELY via ref (before any state updates)
      // This ensures mainLevelQuestions filters it out even before questionLogic state is updated
      nestedQuestionIdsRef.current.add(newQuestion.id)
      
      const updateNestedItems = (items: QuestionLogicItem[], path: number[], depth: number): QuestionLogicItem[] => {
        if (depth >= path.length) {
          // If items is empty or afterIndex is beyond the array, just append
          if (items.length === 0 || afterIndex === undefined || afterIndex < 0) {
            return [...items, newLogicItem]
          }
          // Insert after the specified index
          return [...items.slice(0, afterIndex + 1), newLogicItem, ...items.slice(afterIndex + 1)]
        }
        
        return items.map((item, idx) => {
          if (idx === path[depth]) {
            if (item.type === 'conditional' && item.conditional) {
              return {
                ...item,
                conditional: {
                  ...item.conditional,
                  nestedItems: updateNestedItems(item.conditional.nestedItems || [], path, depth + 1)
                }
              }
            }
          }
          return item
        })
      }
      
      // Add to questions array first
      setQuestions(prev => [...prev, newQuestion])
      
      // Then update questionLogic
      setQuestionLogic(prevLogic => {
        const newLogic = updateNestedItems(prevLogic, parentPath, 0)
        if (currentGroupId) saveQuestionLogic(newLogic, currentGroupId)
        return newLogic
      })
    } else {
      // Add to root level - add question first, then update logic
      setQuestions(prev => [...prev, newQuestion])
      
      setQuestionLogic(prevLogic => {
        const newLogic = afterIndex !== undefined
          ? [...prevLogic.slice(0, afterIndex + 1), newLogicItem, ...prevLogic.slice(afterIndex + 1)]
          : [...prevLogic, newLogicItem]
        if (currentGroupId) {
          saveQuestionLogic(newLogic, currentGroupId)
        }
        return newLogic
      })
    }
  }

  // Add question at a specific index within nested items
  const addQuestionToLogicAtIndex = (afterIndex: number, parentPath?: number[]) => {
    const newQuestion = addQuestion()
    if (!newQuestion) return

    const newLogicItem: QuestionLogicItem = {
      id: Date.now().toString(),
      type: 'question',
      questionId: undefined,
      depth: parentPath ? parentPath.length : 0
    }

    ;(newLogicItem as any).localQuestionId = newQuestion.id

    // Capture savedGroupId before entering any callbacks to avoid stale closure
    const currentGroupId = savedGroupId

    if (parentPath && parentPath.length > 0) {
      // Add to nested items at specific index
      const updateNestedItems = (items: QuestionLogicItem[], path: number[], depth: number): QuestionLogicItem[] => {
        if (depth >= path.length) {
          // Insert after the specified index
          return [...items.slice(0, afterIndex + 1), newLogicItem, ...items.slice(afterIndex + 1)]
        }
        return items.map((item, idx) => {
          if (idx === path[depth] && item.conditional) {
            return {
              ...item,
              conditional: {
                ...item.conditional,
                nestedItems: updateNestedItems(item.conditional.nestedItems || [], path, depth + 1)
              }
            }
          }
          return item
        })
      }
      // Use functional update to avoid stale closure
      setQuestionLogic(prevLogic => {
        const newLogic = updateNestedItems(prevLogic, parentPath, 0)
        if (currentGroupId) saveQuestionLogic(newLogic, currentGroupId)
        return newLogic
      })
    } else {
      // Add to root level at specific index - use functional update
      setQuestionLogic(prevLogic => {
        const newLogic = [...prevLogic.slice(0, afterIndex + 1), newLogicItem, ...prevLogic.slice(afterIndex + 1)]
        if (currentGroupId) saveQuestionLogic(newLogic, currentGroupId)
        return newLogic
      })
    }
  }

  // Add conditional at a specific index within nested items (for purple arrow - add conditional one level out)
  const addConditionalToLogicAtIndex = (afterIndex: number, parentPath?: number[], targetQuestion?: QuestionFormData) => {
    // Get the previous question to use as the "if" condition
    let previousQuestion: QuestionFormData | undefined = targetQuestion
      ? questions.find(q => q.id === targetQuestion.id) || targetQuestion
      : undefined

    if (!previousQuestion) {
      if (parentPath && parentPath.length > 0) {
        // Find the previous item in nested context
        const getItemsAtPath = (items: QuestionLogicItem[], path: number[], depth: number): QuestionLogicItem[] => {
          if (depth >= path.length) return items
          const item = items[path[depth]]
          if (item?.conditional?.nestedItems) {
            return getItemsAtPath(item.conditional.nestedItems, path, depth + 1)
          }
          return []
        }
        const itemsAtPath = getItemsAtPath(questionLogic, parentPath, 0)
        for (let i = itemsAtPath.length - 1; i >= 0; i--) {
          const item = itemsAtPath[i]
          if (item.type === 'question') {
            const localId = (item as any).localQuestionId
            previousQuestion = questions.find(q =>
              (localId != null && q.id === localId) ||
              (item.questionId != null && q.dbId != null && q.dbId === item.questionId)
            )
            break
          }
        }
      } else {
        // Find the previous question at root level
        for (let i = afterIndex; i >= 0; i--) {
          const item = questionLogic[i]
          if (item.type === 'question') {
            const localId = (item as any).localQuestionId
            previousQuestion = questions.find(q =>
              (localId != null && q.id === localId) ||
              (item.questionId != null && q.dbId != null && q.dbId === item.questionId)
            )
            break
          }
        }
      }
    }

    // Create a new nested question to go inside the conditional
    const nestedQuestion = addQuestion()
    const nestedQuestionLogicItem: QuestionLogicItem = {
      id: Date.now().toString() + '_nested_q',
      type: 'question',
      questionId: undefined,
      depth: (parentPath ? parentPath.length : 0) + 1
    }
    ;(nestedQuestionLogicItem as any).localQuestionId = nestedQuestion.id

    const newConditional: QuestionLogicItem = {
      id: Date.now().toString() + '_cond',
      type: 'conditional',
      conditional: {
        ifIdentifier: previousQuestion?.identifier || '',
        value: '',
        nestedItems: [nestedQuestionLogicItem]
      },
      depth: parentPath ? parentPath.length : 0
    }

    const currentGroupId = savedGroupId

    if (parentPath && parentPath.length > 0) {
      // Add to nested items at specific index
      const updateNestedItems = (items: QuestionLogicItem[], path: number[], depth: number): QuestionLogicItem[] => {
        if (depth >= path.length) {
          // Insert after the specified index
          return [...items.slice(0, afterIndex + 1), newConditional, ...items.slice(afterIndex + 1)]
        }
        return items.map((item, idx) => {
          if (idx === path[depth] && item.conditional) {
            return {
              ...item,
              conditional: {
                ...item.conditional,
                nestedItems: updateNestedItems(item.conditional.nestedItems || [], path, depth + 1)
              }
            }
          }
          return item
        })
      }
      setQuestionLogic(prevLogic => {
        const newLogic = updateNestedItems(prevLogic, parentPath, 0)
        if (currentGroupId) saveQuestionLogic(newLogic, currentGroupId)
        return newLogic
      })
    } else {
      // Add to root level at specific index
      setQuestionLogic(prevLogic => {
        const newLogic = [...prevLogic.slice(0, afterIndex + 1), newConditional, ...prevLogic.slice(afterIndex + 1)]
        if (currentGroupId) saveQuestionLogic(newLogic, currentGroupId)
        return newLogic
      })
    }
  }

  // Insert a nested question BEFORE a specific index within a conditional's nestedItems
  const insertNestedQuestionBeforeIndex = (beforeIndex: number, parentPath: number[]) => {
    // Create the new question data
    const newQuestion: QuestionFormData = {
      id: Date.now().toString(),
      question_text: '',
      question_type: 'free_text',
      identifier: '',
      repeatable: false,
      is_required: false,
      options: []
    }

    // Add to questions array
    setQuestions(prev => [...prev, newQuestion])

    const newLogicItem: QuestionLogicItem = {
      id: (Date.now() + 1).toString(),
      type: 'question',
      questionId: undefined,
      depth: parentPath.length
    }

    ;(newLogicItem as any).localQuestionId = newQuestion.id

    // Capture savedGroupId before entering any callbacks to avoid stale closure
    const currentGroupId = savedGroupId

    // Insert at the specified index within the nested items
    const updateNestedItems = (items: QuestionLogicItem[], path: number[], depth: number): QuestionLogicItem[] => {
      if (depth >= path.length) {
        // We're at the target level - insert before the specified index
        return [...items.slice(0, beforeIndex), newLogicItem, ...items.slice(beforeIndex)]
      }
      return items.map((item, idx) => {
        if (idx === path[depth] && item.conditional) {
          return {
            ...item,
            conditional: {
              ...item.conditional,
              nestedItems: updateNestedItems(item.conditional.nestedItems || [], path, depth + 1)
            }
          }
        }
        return item
      })
    }

    // Use functional update to avoid stale closure
    setQuestionLogic(prevLogic => {
      const newLogic = updateNestedItems(prevLogic, parentPath, 0)
      if (currentGroupId) saveQuestionLogic(newLogic, currentGroupId)
      return newLogic
    })
  }

  // Insert a conditional at the same level as nested items (as a sibling)
  const insertConditionalAsSibling = (afterIndex: number, parentPath: number[], targetQuestion?: QuestionFormData) => {
    // Get the previous question to use as the "if" condition
    let previousQuestion: QuestionFormData | undefined = targetQuestion
      ? questions.find(q => q.id === targetQuestion.id) || targetQuestion
      : undefined

    // Create a new nested question to go inside the conditional
    const nestedQuestion = addQuestion()
    const nestedQuestionId = nestedQuestion.id
    
    // The depth should be parentPath.length (the depth of items in the parent's nestedItems)
    const conditionalDepth = parentPath.length
    const nestedQuestionDepth = parentPath.length + 1
    
    const nestedQuestionLogicItem: QuestionLogicItem = {
      id: Date.now().toString() + '_nested_q',
      type: 'question',
      questionId: undefined,
      depth: nestedQuestionDepth
    }
    ;(nestedQuestionLogicItem as any).localQuestionId = nestedQuestionId

    const newConditional: QuestionLogicItem = {
      id: Date.now().toString() + '_cond',
      type: 'conditional',
      conditional: {
        ifIdentifier: previousQuestion?.identifier || '',
        value: '',
        nestedItems: [nestedQuestionLogicItem]
      },
      depth: conditionalDepth
    }

    const currentGroupId = savedGroupId

    // Insert into nested items at the parent path
    const updateNestedItems = (items: QuestionLogicItem[], path: number[], depth: number): QuestionLogicItem[] => {
      if (depth >= path.length) {
        // Insert after afterIndex position
        const insertIndex = afterIndex >= 0 ? afterIndex + 1 : items.length
        return [...items.slice(0, insertIndex), newConditional, ...items.slice(insertIndex)]
      }
      return items.map((item, idx) => {
        if (idx === path[depth] && item.conditional) {
          return {
            ...item,
            conditional: {
              ...item.conditional,
              nestedItems: updateNestedItems(item.conditional.nestedItems || [], path, depth + 1)
            }
          }
        }
        return item
      })
    }
    
    setQuestionLogic(prevLogic => {
      const newLogic = updateNestedItems(prevLogic, parentPath, 0)
      if (currentGroupId) saveQuestionLogic(newLogic, currentGroupId)
      return newLogic
    })
  }

  const addConditionalToLogic = (afterIndex: number, parentPath?: number[], targetQuestion?: QuestionFormData) => {

    // Get the previous question to use as the "if" condition
    // If targetQuestion is passed, get the latest version from questions state
    let previousQuestion: QuestionFormData | undefined = targetQuestion
      ? questions.find(q => q.id === targetQuestion.id) || targetQuestion
      : undefined

    if (!previousQuestion) {
      if (parentPath && parentPath.length > 0) {
        // Find the previous item in nested context
        const getItemsAtPath = (items: QuestionLogicItem[], path: number[], depth: number): QuestionLogicItem[] => {
          if (depth >= path.length) return items
          const item = items[path[depth]]
          if (item?.conditional?.nestedItems) {
            return getItemsAtPath(item.conditional.nestedItems, path, depth + 1)
          }
          return []
        }
        const itemsAtPath = getItemsAtPath(questionLogic, parentPath, 0)
        // Find the last question item before this position
        for (let i = itemsAtPath.length - 1; i >= 0; i--) {
          const item = itemsAtPath[i]
          if (item.type === 'question') {
            const localId = (item as any).localQuestionId
            previousQuestion = questions.find(q =>
              (localId != null && q.id === localId) ||
              (item.questionId != null && q.dbId != null && q.dbId === item.questionId)
            )
            break
          }
        }
      } else {
        // Find the previous question at root level
        for (let i = afterIndex; i >= 0; i--) {
          const item = questionLogic[i]
          if (item.type === 'question') {
            const localId = (item as any).localQuestionId
            previousQuestion = questions.find(q =>
              (localId != null && q.id === localId) ||
              (item.questionId != null && q.dbId != null && q.dbId === item.questionId)
            )
            break
          }
        }
      }
    }

    // Create a new nested question to go inside the conditional
    const nestedQuestion = addQuestion()
    const nestedQuestionId = nestedQuestion.id
    
    const nestedQuestionLogicItem: QuestionLogicItem = {
      id: Date.now().toString() + '_nested_q',
      type: 'question',
      questionId: undefined,
      depth: (parentPath ? parentPath.length : 0) + 1
    }
    // Store the local question ID for reference
    ;(nestedQuestionLogicItem as any).localQuestionId = nestedQuestionId

    const newConditional: QuestionLogicItem = {
      id: Date.now().toString() + '_cond',
      type: 'conditional',
      conditional: {
        ifIdentifier: previousQuestion?.identifier || '',
        value: '',
        nestedItems: [nestedQuestionLogicItem]
      },
      depth: parentPath ? parentPath.length : 0
    }

    // Capture savedGroupId before entering any callbacks to avoid stale closure
    const currentGroupId = savedGroupId

    if (parentPath && parentPath.length > 0) {
      // Add to nested items - insert after the specified index, not at the end
      const updateNestedItems = (items: QuestionLogicItem[], path: number[], depth: number): QuestionLogicItem[] => {
        if (depth >= path.length) {
          // Insert after afterIndex position, not at the end
          const insertIndex = afterIndex >= 0 ? afterIndex + 1 : items.length
          return [...items.slice(0, insertIndex), newConditional, ...items.slice(insertIndex)]
        }
        return items.map((item, idx) => {
          if (idx === path[depth] && item.conditional) {
            return {
              ...item,
              conditional: {
                ...item.conditional,
                nestedItems: updateNestedItems(item.conditional.nestedItems || [], path, depth + 1)
              }
            }
          }
          return item
        })
      }
      setQuestionLogic(prevLogic => {
        const newLogic = updateNestedItems(prevLogic, parentPath, 0)
        if (currentGroupId) saveQuestionLogic(newLogic, currentGroupId)
        return newLogic
      })
    } else {
      // Add to root level - if afterIndex is -1 or invalid, just append to the end
      setQuestionLogic(prevLogic => {
        const insertIndex = afterIndex >= 0 ? afterIndex + 1 : prevLogic.length
        const newLogic = [...prevLogic.slice(0, insertIndex), newConditional, ...prevLogic.slice(insertIndex)]
        if (currentGroupId) saveQuestionLogic(newLogic, currentGroupId)
        return newLogic
      })
    }
  }

  const updateConditionalValue = (itemId: string, field: 'ifIdentifier' | 'value' | 'operator', value: string) => {
    const updateItem = (items: QuestionLogicItem[]): QuestionLogicItem[] => {
      return items.map(item => {
        if (item.id === itemId && item.conditional) {
          return {
            ...item,
            conditional: {
              ...item.conditional,
              [field]: value
            }
          }
        }
        if (item.conditional?.nestedItems) {
          return {
            ...item,
            conditional: {
              ...item.conditional,
              nestedItems: updateItem(item.conditional.nestedItems)
            }
          }
        }
        return item
      })
    }
    const newLogic = updateItem(questionLogic)
    setQuestionLogic(newLogic)
    saveQuestionLogic(newLogic)
  }

  const removeLogicItem = (itemId: string) => {
    
    // Helper to collect all question IDs from logic items (for deletion)
    const collectQuestionIds = (items: QuestionLogicItem[]): string[] => {
      const ids: string[] = []
      for (const item of items) {
        if (item.type === 'question' && item.questionId) {
          ids.push(item.questionId.toString())
        }
        if (item.type === 'conditional' && item.conditional?.nestedItems) {
          ids.push(...collectQuestionIds(item.conditional.nestedItems))
        }
      }
      return ids
    }
    
    const removeItem = (items: QuestionLogicItem[]): QuestionLogicItem[] => {
      const result: QuestionLogicItem[] = []
      
      for (const item of items) {
        if (item.id === itemId) {
          // If this is a conditional being removed, delete all nested questions
          if (item.type === 'conditional' && item.conditional?.nestedItems) {
            const nestedQuestionIds = collectQuestionIds(item.conditional.nestedItems)
            // Remove nested questions from the questions state
            setQuestions(prevQuestions => 
              prevQuestions.filter(q => !nestedQuestionIds.includes(q.id))
            )
          }
          // Skip adding the removed item itself (deletes the conditional and all nested content)
          continue
        }
        
        // Recursively process nested items in conditionals
        if (item.conditional?.nestedItems) {
          result.push({
            ...item,
            conditional: {
              ...item.conditional,
              nestedItems: removeItem(item.conditional.nestedItems)
            }
          })
        } else {
          result.push(item)
        }
      }
      
      return result
    }
    
    // Use functional update to ensure we have the latest state
    setQuestionLogic(prevLogic => {
      const newLogic = removeItem(prevLogic)
      saveQuestionLogic(newLogic)
      return newLogic
    })
  }

  const toggleEndFlow = (itemId: string) => {
    const updateItem = (items: QuestionLogicItem[]): QuestionLogicItem[] => {
      return items.map(item => {
        if (item.id === itemId && item.conditional) {
          return {
            ...item,
            conditional: {
              ...item.conditional,
              endFlow: !item.conditional.endFlow
            }
          }
        }
        if (item.conditional?.nestedItems) {
          return {
            ...item,
            conditional: {
              ...item.conditional,
              nestedItems: updateItem(item.conditional.nestedItems)
            }
          }
        }
        return item
      })
    }
    const newLogic = updateItem(questionLogic)
    setQuestionLogic(newLogic)
    saveQuestionLogic(newLogic)
  }

  const toggleStopFlow = (itemId: string) => {
    const updateItem = (items: QuestionLogicItem[]): QuestionLogicItem[] => {
      return items.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            stopFlow: !item.stopFlow
          }
        }
        if (item.conditional?.nestedItems) {
          return {
            ...item,
            conditional: {
              ...item.conditional,
              nestedItems: updateItem(item.conditional.nestedItems)
            }
          }
        }
        return item
      })
    }
    const newLogic = updateItem(questionLogic)
    setQuestionLogic(newLogic)
    saveQuestionLogic(newLogic)
  }

  const getQuestionByIdentifier = (identifier: string): QuestionFormData | undefined => {
    return questions.find(q => q.identifier === identifier)
  }

  const getPreviousQuestionIdentifiers = (currentIndex: number, parentPath?: number[]): string[] => {
    const identifiers: string[] = []

    // Collect identifiers from questions before the current position
    if (parentPath && parentPath.length > 0) {
      // In nested context, get identifiers from parent conditional's target
      const getItemsAtPath = (items: QuestionLogicItem[], path: number[], depth: number): QuestionLogicItem[] => {
        if (depth >= path.length - 1) return items
        const item = items[path[depth]]
        if (item?.conditional?.nestedItems) {
          return getItemsAtPath(item.conditional.nestedItems, path, depth + 1)
        }
        return []
      }
      const parentItems = getItemsAtPath(questionLogic, parentPath.slice(0, -1), 0)
      parentItems.forEach(item => {
        if (item.type === 'question') {
          const localId = (item as any).localQuestionId
          const q = questions.find(q =>
            (localId != null && q.id === localId) ||
            (item.questionId != null && q.dbId != null && q.dbId === item.questionId)
          )
          if (q?.identifier) identifiers.push(q.identifier)
        }
      })
    } else {
      // At root level
      for (let i = 0; i < currentIndex; i++) {
        const item = questionLogic[i]
        if (item.type === 'question') {
          const localId = (item as any).localQuestionId
          const q = questions.find(q =>
            (localId != null && q.id === localId) ||
            (item.questionId != null && q.dbId != null && q.dbId === item.questionId)
          )
          if (q?.identifier) identifiers.push(q.identifier)
        }
      }
    }

    return identifiers
  }

  // Helper to get question by local ID or db ID from logic item
  const getQuestionFromLogicItem = (item: QuestionLogicItem): QuestionFormData | undefined => {
    return findQuestionForLogicItem(item)
  }

  // Helper to collect all nested question IDs from conditionals
  const getNestedQuestionIds = (items: QuestionLogicItem[]): Set<string> => {
    const nestedIds = new Set<string>()

    const collectIds = (logicItems: QuestionLogicItem[], isNested: boolean) => {
      logicItems.forEach(item => {
        // If we're inside a conditional's nestedItems, track all questions
        if (isNested && item.type === 'question') {
          const localId = (item as any).localQuestionId
          if (localId) nestedIds.add(localId)
          if (item.questionId) nestedIds.add(item.questionId.toString())
        }
        // Recurse into conditionals
        if (item.type === 'conditional' && item.conditional?.nestedItems) {
          collectIds(item.conditional.nestedItems, true)
        }
      })
    }

    collectIds(items, false)
    return nestedIds
  }

  // Get questions that are NOT nested inside conditionals (main level only)
  // AND sort them according to their order in questionLogic
  const mainLevelQuestions = (() => {
    const nestedIds = getNestedQuestionIds(questionLogic)
    // Also check the ref for immediately-added nested questions (before state updates)
    const filtered = questions.filter(q => {
      // Check both the computed nestedIds AND the ref for immediate filtering
      if (nestedQuestionIdsRef.current.has(q.id)) return false
      return !nestedIds.has(q.id) && !nestedIds.has(q.dbId?.toString() || '')
    })
    
    // Sort by position in questionLogic
    return filtered.sort((a, b) => {
      const aIndex = questionLogic.findIndex(item => 
        item.type === 'question' && 
        isLogicItemForQuestion(item, a)
      )
      const bIndex = questionLogic.findIndex(item => 
        item.type === 'question' && 
        isLogicItemForQuestion(item, b)
      )
      // If not found in logic, put at end
      const aPos = aIndex === -1 ? Infinity : aIndex
      const bPos = bIndex === -1 ? Infinity : bIndex
      return aPos - bPos
    })
  })()

  // Recursive function to render nested items within a conditional
  const renderNestedItems = (
    nestedItems: QuestionLogicItem[],
    parentPath: number[],
    depth: number,
    parentQuestion?: QuestionFormData,
    questionNumberPrefix?: string
  ): React.ReactNode => {
    if (depth > 4) return null // Max 4 levels of nesting

    // Filter to only items that have valid questions, and track their display index
    let questionDisplayIndex = 0
    let conditionalDisplayIndex = 0

    return nestedItems.map((item, itemIndex) => {
      const currentPath = [...parentPath, itemIndex]

      if (item.type === 'question') {
        const nestedQuestion = getQuestionFromLogicItem(item)
        if (!nestedQuestion) return null

        const currentDisplayIndex = questionDisplayIndex
        questionDisplayIndex++

        // Check if this is the last question in the nested items group
        // (no more question-type items after this one at the same level)
        const isLastQuestionInGroup = !nestedItems.slice(itemIndex + 1).some(
          nextItem => nextItem.type === 'question'
        )

        // Build the full number string (e.g., "2-1", "2-2" for nested questions)
        // currentDisplayIndex is 0-based, so add 1 for display
        const questionNumber = questionNumberPrefix
          ? `${questionNumberPrefix}-${currentDisplayIndex + 1}`
          : `${currentDisplayIndex + 1}`

        return (
          <div key={item.id} style={{ marginBottom: '1rem' }}>
            {/* Insert Question and Insert Conditional buttons before each nested question */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '0.5rem',
              marginBottom: '0.5rem',
              marginTop: itemIndex === 0 ? '0' : '0.25rem'
            }}>
              <button
                type="button"
                onClick={() => insertNestedQuestionBeforeIndex(itemIndex, parentPath)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.2rem 0.5rem',
                  fontSize: '0.65rem',
                  background: 'white',
                  color: '#7c3aed',
                  border: '1px dashed #7c3aed',
                  borderRadius: '0.25rem',
                  cursor: 'pointer',
                  opacity: 0.7,
                  transition: 'opacity 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
                title="Insert a nested question here"
              >
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '0.65rem', height: '0.65rem' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Insert Question
              </button>
              {itemIndex > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    // Insert conditional at ROOT level (depth 0)
                    // Find the previous question to use as ifIdentifier
                    let prevQuestionForCondition: QuestionFormData | undefined
                    
                    for (let i = itemIndex - 1; i >= 0; i--) {
                      const item = nestedItems[i]
                      if (item.type === 'question') {
                        prevQuestionForCondition = questions.find(q => 
                          q.id === (item as any).localQuestionId || q.dbId === item.questionId
                        )
                        break
                      }
                    }
                    
                    // Insert at root level: use the parent conditional's index
                    const insertAfterIndex = parentPath[parentPath.length - 1]
                    addConditionalToLogicAtIndex(insertAfterIndex, undefined, prevQuestionForCondition)
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.2rem 0.5rem',
                    fontSize: '0.65rem',
                    background: 'white',
                    color: '#7c3aed',
                    border: '1px dashed #7c3aed',
                    borderRadius: '0.25rem',
                    cursor: 'pointer',
                    opacity: 0.7,
                    transition: 'opacity 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
                  title="Insert a nested conditional here"
                >
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '0.65rem', height: '0.65rem' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Insert Conditional
                </button>
              )}
            </div>

            {/* Nested Question Block */}
            <div style={{
              padding: '1rem',
              border: `1px solid ${getDepthBorderColor(depth)}`,
              borderRadius: '0.5rem',
              backgroundColor: getDepthBackgroundColor(depth)
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: getDepthTextColor(depth) }}>
                  Nested Question ({questionNumber})
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    // First remove from database if it has a dbId
                    if (nestedQuestion.dbId) {
                      incrementPendingRequests()
                      try {
                        await questionGroupService.deleteQuestion(nestedQuestion.dbId)
                      } catch (err) {
                        console.error('Failed to delete nested question from database:', err)
                      } finally {
                        decrementPendingRequests()
                      }
                    }
                    
                    // Remove the question from state
                    setQuestions(prev => prev.filter(q => q.id !== nestedQuestion.id))

                    // Capture savedGroupId before the callback
                    const currentGroupId = savedGroupId

                    // Remove the logic item from nestedItems
                    setQuestionLogic(prev => {
                      const removeFromNestedItems = (items: QuestionLogicItem[]): QuestionLogicItem[] => {
                        return items.filter(logicItem => {
                          // Filter out the item we're deleting
                          if (logicItem.id === item.id) {
                            return false
                          }
                          return true
                        }).map(logicItem => {
                          // Recursively process nested conditionals
                          if (logicItem.conditional?.nestedItems) {
                            return {
                              ...logicItem,
                              conditional: {
                                ...logicItem.conditional,
                                nestedItems: removeFromNestedItems(logicItem.conditional.nestedItems)
                              }
                            }
                          }
                          return logicItem
                        })
                      }
                      const updated = removeFromNestedItems(prev)
                      if (currentGroupId) {
                        saveQuestionLogic(updated, currentGroupId)
                      }
                      return updated
                    })
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '0.25rem',
                    cursor: 'pointer',
                    color: '#dc2626'
                  }}
                  title="Remove nested question"
                >
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '1rem', height: '1rem' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              {/* Identifier */}
              <div className="form-group">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.25rem' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Identifier *</label>
                  {(() => {
                    // Find the previous repeatable question in nested items
                    let prevRepeatableNestedQuestion: QuestionFormData | null = null
                    for (let i = itemIndex - 1; i >= 0; i--) {
                      const prevItem = nestedItems[i]
                      if (prevItem.type === 'question') {
                        const q = questions.find(q => 
                          q.id === (prevItem as any).localQuestionId || q.dbId === prevItem.questionId
                        )
                        if (q?.repeatable) {
                          prevRepeatableNestedQuestion = q
                        }
                        break // Stop at the first question we find
                      }
                    }
                    
                    // If no previous repeatable in nested items, check if parent question is repeatable
                    if (!prevRepeatableNestedQuestion && parentQuestion?.repeatable) {
                      prevRepeatableNestedQuestion = parentQuestion
                    }
                    
                    const hasPrevRepeatable = prevRepeatableNestedQuestion !== null
                    
                    // Always show radio buttons for nested questions
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.875rem', color: '#374151' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name={`repeatable-${nestedQuestion.id}`}
                            checked={!nestedQuestion.repeatable}
                            onChange={() => {
                              updateQuestion(nestedQuestion.id, 'repeatable', false)
                              updateQuestion(nestedQuestion.id, 'repeatable_group_id', undefined)
                            }}
                          />
                          Not Repeatable
                        </label>
                        {hasPrevRepeatable && prevRepeatableNestedQuestion && (
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                            <input
                              type="radio"
                              name={`repeatable-${nestedQuestion.id}`}
                              checked={nestedQuestion.repeatable && nestedQuestion.repeatable_group_id === (prevRepeatableNestedQuestion.repeatable_group_id || prevRepeatableNestedQuestion.id)}
                              onChange={() => {
                                updateQuestion(nestedQuestion.id, 'repeatable', true)
                                updateQuestion(nestedQuestion.id, 'repeatable_group_id', prevRepeatableNestedQuestion.repeatable_group_id || prevRepeatableNestedQuestion.id)
                              }}
                            />
                            Join Repeatable Group
                          </label>
                        )}
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name={`repeatable-${nestedQuestion.id}`}
                            checked={nestedQuestion.repeatable && (!hasPrevRepeatable || nestedQuestion.repeatable_group_id !== (prevRepeatableNestedQuestion?.repeatable_group_id || prevRepeatableNestedQuestion?.id))}
                            onChange={() => {
                              updateQuestion(nestedQuestion.id, 'repeatable', true)
                              updateQuestion(nestedQuestion.id, 'repeatable_group_id', nestedQuestion.id)
                            }}
                          />
                          Start New Repeatable Group
                        </label>
                      </div>
                    )
                  })()}
                </div>
                <input
                  type="text"
                  value={nestedQuestion.identifier}
                  onChange={(e) => updateQuestion(nestedQuestion.id, 'identifier', e.target.value)}
                  className="form-input"
                  placeholder="e.g., nested_field"
                />
              </div>

              {/* Question Text */}
              <div className="question-text-section">
                <label className="form-label">Question Text *</label>
                <textarea
                  value={nestedQuestion.question_text}
                  onChange={(e) => updateQuestion(nestedQuestion.id, 'question_text', e.target.value)}
                  className="form-textarea"
                  rows={1.5}
                  placeholder="Enter your question here..."
                />
              </div>

              {/* Answer Type and Options - matching main level styling */}
              <div className="question-type-options-container">
                <div className="question-type-section">
                  <label className="form-label">Answer Type</label>
                  <div className="radio-group">
                    <label className="radio-option">
                      <input
                        type="radio"
                        name={`nested-type-${nestedQuestion.id}`}
                        value="free_text"
                        checked={nestedQuestion.question_type === 'free_text'}
                        onChange={(e) => updateQuestion(nestedQuestion.id, 'question_type', e.target.value)}
                      />
                      <span>Text Input Field</span>
                    </label>
                    <label className="radio-option">
                      <input
                        type="radio"
                        name={`nested-type-${nestedQuestion.id}`}
                        value="multiple_choice"
                        checked={nestedQuestion.question_type === 'multiple_choice'}
                        onChange={(e) => updateQuestion(nestedQuestion.id, 'question_type', e.target.value)}
                      />
                      <span>Single Choice (Radio Buttons)</span>
                    </label>
                    <label className="radio-option">
                      <input
                        type="radio"
                        name={`nested-type-${nestedQuestion.id}`}
                        value="yes_no"
                        checked={
                          nestedQuestion.question_type === 'multiple_choice' &&
                          nestedQuestion.options?.length === 2 &&
                          nestedQuestion.options[0]?.value === 'yes' &&
                          nestedQuestion.options[1]?.value === 'no'
                        }
                        onChange={(e) => {
                          // Yes/No is just a shortcut for multiple_choice with Yes/No options
                          updateQuestion(nestedQuestion.id, 'question_type', 'multiple_choice')
                          updateQuestion(nestedQuestion.id, 'options', [
                            { value: 'yes', label: 'Yes' },
                            { value: 'no', label: 'No' }
                          ])
                        }}
                      />
                      <span>Yes/No</span>
                    </label>
                    <label className="radio-option">
                      <input
                        type="radio"
                        name={`nested-type-${nestedQuestion.id}`}
                        value="checkbox_group"
                        checked={nestedQuestion.question_type === 'checkbox_group'}
                        onChange={(e) => updateQuestion(nestedQuestion.id, 'question_type', e.target.value)}
                      />
                      <span>Multiple Choice (Checkboxes)</span>
                    </label>
                    <label className="radio-option">
                      <input
                        type="radio"
                        name={`nested-type-${nestedQuestion.id}`}
                        value="dropdown"
                        checked={nestedQuestion.question_type === 'dropdown'}
                        onChange={(e) => updateQuestion(nestedQuestion.id, 'question_type', e.target.value)}
                      />
                      <span>Dropdown Menu</span>
                    </label>
                    <label className="radio-option">
                      <input
                        type="radio"
                        name={`nested-type-${nestedQuestion.id}`}
                        value="person"
                        checked={nestedQuestion.question_type === 'person'}
                        onChange={(e) => {
                          updateQuestion(nestedQuestion.id, 'question_type', e.target.value)
                          if (!nestedQuestion.person_display_mode) {
                            updateQuestion(nestedQuestion.id, 'person_display_mode', 'autocomplete')
                          }
                        }}
                      />
                      <span>Person</span>
                    </label>
                    <label className="radio-option">
                      <input
                        type="radio"
                        name={`nested-type-${nestedQuestion.id}`}
                        value="person_backup"
                        checked={nestedQuestion.question_type === 'person_backup'}
                        onChange={(e) => {
                          updateQuestion(nestedQuestion.id, 'question_type', e.target.value)
                          if (!nestedQuestion.person_display_mode) {
                            updateQuestion(nestedQuestion.id, 'person_display_mode', 'autocomplete')
                          }
                        }}
                      />
                      <span>Person (Backup)</span>
                    </label>
                    <label className="radio-option">
                      <input
                        type="radio"
                        name={`nested-type-${nestedQuestion.id}`}
                        value="date"
                        checked={nestedQuestion.question_type === 'date'}
                        onChange={(e) => updateQuestion(nestedQuestion.id, 'question_type', e.target.value)}
                      />
                      <span>Date</span>
                    </label>
                  </div>
                </div>

                <div className="options-section">
                  {['multiple_choice', 'checkbox_group', 'dropdown'].includes(nestedQuestion.question_type) && (
                    <div className="options-list">
                      <label className="form-label">Options</label>
                      {nestedQuestion.options.map((opt, optIdx) => (
                        <div key={optIdx} className="option-row">
                          <input
                            type="text"
                            value={opt.label}
                            onChange={(e) => updateOption(nestedQuestion.id, optIdx, 'label', e.target.value)}
                            onBlur={() => {
                              const q = questions.find(q => q.id === nestedQuestion.id)
                              if (q) triggerAutoSave(q)
                            }}
                            className="form-input option-input"
                            placeholder={`Option ${optIdx + 1}`}
                            data-option-input={`${nestedQuestion.id}-${optIdx}`}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              removeOption(nestedQuestion.id, optIdx)
                              // Trigger auto-save after removing option
                              setTimeout(() => {
                                const q = questions.find(q => q.id === nestedQuestion.id)
                                if (q) triggerAutoSave(q)
                              }, 100)
                            }}
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
                        onClick={() => {
                          addOption(nestedQuestion.id)
                          // Trigger auto-save after adding option
                          setTimeout(() => {
                            const q = questions.find(q => q.id === nestedQuestion.id)
                            if (q) triggerAutoSave(q)
                          }, 100)
                        }}
                        className="add-option-button"
                      >
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '16px', height: '16px' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Option
                      </button>
                    </div>
                  )}
                  {nestedQuestion.question_type === 'free_text' && (
                    <div className="empty-options">
                      <p style={{ color: '#6b7280', fontSize: '0.875rem', fontStyle: 'italic' }}>No options needed for text input</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action buttons after nested question */}
            {depth <= 4 && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', marginLeft: '1rem' }}>
                {isLastQuestionInGroup && (
                  <button
                    type="button"
                    onClick={() => addQuestionToLogic(itemIndex, parentPath)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.7rem',
                      background: '#2563eb',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.25rem',
                      cursor: 'pointer'
                    }}
                  >
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '0.75rem', height: '0.75rem' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Follow-on Question
                  </button>
                )}
                {depth > 0 && depth < 4 && isLastQuestionInGroup && (
                  <button
                    type="button"
                    onClick={() => {
                      // Add conditional at same level as this question (after it)
                      addConditionalToLogic(itemIndex, parentPath, nestedQuestion)
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.7rem',
                      background: '#7c3aed',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.25rem',
                      cursor: 'pointer'
                    }}
                  >
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '0.75rem', height: '0.75rem' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Add Follow-on Conditional
                  </button>
                )}
                {/* Move item one level up - orange arrow */}
                {parentPath.length > 0 && isLastQuestionInGroup && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      
                      // Move this question one level up by:
                      // 1. Creating a copy of the question data
                      const questionData = { ...nestedQuestion }
                      
                      // 2. Add to parent level
                      const parentPathUp = parentPath.slice(0, -1)
                      const insertAfterIndex = parentPath[parentPath.length - 1]
                      
                      // 3. Find the logic item for this nested question and remove it
                      const updateNestedItems = (items: QuestionLogicItem[], path: number[], depth: number): QuestionLogicItem[] => {
                        if (depth >= path.length) {
                          // Remove the item at itemIndex
                          return items.filter((_, idx) => idx !== itemIndex)
                        }
                        return items.map((item, idx) => {
                          if (idx === path[depth] && item.conditional) {
                            return {
                              ...item,
                              conditional: {
                                ...item.conditional,
                                nestedItems: updateNestedItems(item.conditional.nestedItems || [], path, depth + 1)
                              }
                            }
                          }
                          return item
                        })
                      }
                      
                      // First add the question at parent level
                      addQuestionToLogicAtIndex(insertAfterIndex, parentPathUp.length > 0 ? parentPathUp : undefined)
                      
                      // Then remove from current location
                      setTimeout(() => {
                        setQuestionLogic(prevLogic => {
                          const newLogic = updateNestedItems(prevLogic, parentPath, 0)
                          if (savedGroupId) saveQuestionLogic(newLogic, savedGroupId)
                          return newLogic
                        })
                      }, 100)
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.7rem',
                      background: '#f97316',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.25rem',
                      cursor: 'pointer'
                    }}
                    title="Move question one level up"
                  >
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '0.75rem', height: '0.75rem' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>
        )
      } else if (item.type === 'conditional' && item.conditional) {
        // Find the previous question in this nested context and its display index
        let prevNestedQuestion: QuestionFormData | undefined
        let prevQuestionDisplayIndex = 0
        let questionsBeforeThis = 0
        for (let i = 0; i < itemIndex; i++) {
          const prevItem = nestedItems[i]
          if (prevItem.type === 'question') {
            const q = getQuestionFromLogicItem(prevItem)
            if (q) {
              prevNestedQuestion = q
              prevQuestionDisplayIndex = questionsBeforeThis
              questionsBeforeThis++
            }
          }
        }
        // If no previous in nested, use parent question
        if (!prevNestedQuestion) {
          prevNestedQuestion = parentQuestion
        }

        const currentConditionalIndex = conditionalDisplayIndex
        conditionalDisplayIndex++

        // Build the conditional number string based on the previous question's number
        // The conditional should have the same number as the question it follows
        // prevQuestionDisplayIndex is 0-based, so add 1 for display
        const prevQuestionNumber = questionNumberPrefix
          ? `${questionNumberPrefix}-${prevQuestionDisplayIndex + 1}`
          : `${prevQuestionDisplayIndex + 1}`
        const conditionalNumber = prevNestedQuestion
          ? prevQuestionNumber
          : (questionNumberPrefix ? `${questionNumberPrefix}` : `${currentConditionalIndex + 1}`)

        // Use the depth stored in the item if available, otherwise calculate as depth + 1
        const conditionalDepth = item.depth !== undefined ? item.depth : depth + 1
        
        return (
          <div key={item.id} className="conditional-block" style={{
            marginBottom: '1rem',
            marginLeft: '2rem',
            padding: '1rem',
            border: `1px solid ${getDepthBorderColor(conditionalDepth)}`,
            borderRadius: '0.5rem',
            backgroundColor: getDepthBackgroundColor(conditionalDepth)
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: getDepthTextColor(conditionalDepth) }}>
                Conditional ({conditionalNumber})
              </div>
              <button
                type="button"
                onClick={() => removeLogicItem(item.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '0.25rem',
                  cursor: 'pointer',
                  color: '#dc2626'
                }}
                title="Remove conditional"
              >
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '1rem', height: '1rem' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {/* If identifier - dropdown of all questions */}
              <div>
                <label style={{ fontSize: '0.7rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>
                  If identifier
                </label>
                <select
                  value={item.conditional.ifIdentifier || prevNestedQuestion?.identifier || ''}
                  onChange={(e) => updateConditionalValue(item.id, 'ifIdentifier', e.target.value)}
                  className="form-select"
                  style={{ fontSize: '0.8rem' }}
                >
                  {questions.filter(q => q.identifier.trim()).map(q => (
                    <option key={q.id} value={q.identifier}>
                      {q.identifier}
                    </option>
                  ))}
                </select>
              </div>

              {/* Operator dropdown */}
              <div>
                <label style={{ fontSize: '0.7rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>
                  Operator
                </label>
                {(() => {
                  // Find the selected question by ifIdentifier to check if it's repeatable
                  const selectedIdentifier = item.conditional.ifIdentifier || prevNestedQuestion?.identifier || ''
                  const selectedQuestion = questions.find(q => q.identifier === selectedIdentifier)
                  const isRepeatable = selectedQuestion?.repeatable || false
                  
                  return (
                    <select
                      value={item.conditional.operator || 'equals'}
                      onChange={(e) => updateConditionalValue(item.id, 'operator', e.target.value)}
                      className="form-select"
                      style={{ fontSize: '0.8rem' }}
                    >
                      <option value="equals">equals</option>
                      <option value="not_equals">does not equal</option>
                      {isRepeatable && (
                        <>
                          <option value="count_greater_than">entry count &gt;</option>
                          <option value="count_equals">entry count =</option>
                          <option value="count_less_than">entry count &lt;</option>
                        </>
                      )}
                    </select>
                  )
                })()}
              </div>

              {/* Value */}
              <div>
                <label style={{ fontSize: '0.7rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>
                  Value
                </label>
                {(() => {
                  const currentOperator = item.conditional.operator || 'equals'
                  const isCountOperator = ['count_greater_than', 'count_equals', 'count_less_than'].includes(currentOperator)
                  
                  // If count operator, show numeric input
                  if (isCountOperator) {
                    return (
                      <input
                        type="number"
                        min="0"
                        value={item.conditional.value || ''}
                        onChange={(e) => updateConditionalValue(item.id, 'value', e.target.value)}
                        className="form-input"
                        style={{ fontSize: '0.8rem', width: '80px' }}
                        placeholder="0"
                      />
                    )
                  }
                  
                  // Find the selected question by ifIdentifier to get its type and options
                  const selectedIdentifier = item.conditional.ifIdentifier || prevNestedQuestion?.identifier || ''
                  const selectedQuestion = questions.find(q => q.identifier === selectedIdentifier)
                  const isChoiceType = selectedQuestion && ['multiple_choice', 'dropdown', 'checkbox_group'].includes(selectedQuestion.question_type)
                  const isDateType = selectedQuestion && selectedQuestion.question_type === 'date'
                  const isPersonType = selectedQuestion && selectedQuestion.question_type === 'person'

                  if (isDateType) {
                    return (
                      <input
                        type="date"
                        value={item.conditional.value || ''}
                        onChange={(e) => updateConditionalValue(item.id, 'value', e.target.value)}
                        className="form-input"
                        style={{ fontSize: '0.8rem' }}
                      />
                    )
                  } else if (isChoiceType && selectedQuestion?.options) {
                    return (
                      <select
                        value={item.conditional.value || ''}
                        onChange={(e) => updateConditionalValue(item.id, 'value', e.target.value)}
                        className="form-select"
                        style={{ fontSize: '0.8rem' }}
                      >
                        <option value="">Select value...</option>
                        {selectedQuestion.options.map((opt, idx) => (
                          <option key={opt.value || idx} value={opt.value || opt.label}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    )
                  } else if (isPersonType) {
                    return (
                      <input
                        type="text"
                        value={item.conditional.value || ''}
                        onChange={(e) => updateConditionalValue(item.id, 'value', e.target.value)}
                        className="form-input"
                        style={{ fontSize: '0.8rem' }}
                        placeholder="Type person name..."
                      />
                    )
                  } else {
                    return (
                      <input
                        type="text"
                        value={item.conditional.value || ''}
                        onChange={(e) => updateConditionalValue(item.id, 'value', e.target.value)}
                        className="form-input"
                        style={{ fontSize: '0.8rem' }}
                        placeholder="Enter value"
                      />
                    )
                  }
                })()}
              </div>

              {/* Nested items */}
              <div style={{ marginTop: '0.5rem' }}>
                {item.conditional.nestedItems && item.conditional.nestedItems.length > 0 && (
                  renderNestedItems(item.conditional.nestedItems, currentPath, conditionalDepth, prevNestedQuestion, conditionalNumber)
                )}
              </div>
            </div>

          </div>
        )
      }
      return null
    })
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
      savedGroupIdRef.current = groupResponse.id
      setGroupInfoSaved(true)

      // Switch to a persisted route so refresh keeps the saved group context.
      if (!groupId) {
        const editPath = `/admin/question-groups/${groupResponse.id}/edit`
        navigate(editPath, { replace: true })

        // In rare cases router navigation can be deferred; force the persisted URL.
        setTimeout(() => {
          if (window.location.pathname !== editPath) {
            window.location.replace(editPath)
          }
        }, 0)
      }
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
        repeatable: question.repeatable,
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

  if (!groupId && groupInfoSaved && savedGroupId) {
    return <Navigate to={`/admin/question-groups/${savedGroupId}/edit`} replace />
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <svg
            style={{ width: '3rem', height: '3rem', color: '#7c3aed', animation: 'spin 1s linear infinite' }}
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      </div>
    )
  }

  return (
    <div className="question-groups-container">
      <div className="question-groups-header">
        <div>
          <h1 className="question-groups-title">{isEditMode ? 'Edit Question Group' : 'Create Question Group'}</h1>
          <p className="question-groups-subtitle">
            {isEditMode ? 'Update the question group information and questions' : 'Create a new question group'}
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

          <div className="form-group" style={{ maxWidth: '50%' }}>
            <label className="form-label">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input"
              style={{ borderColor: isDuplicateName ? '#dc2626' : undefined }}
              autoComplete="off"
              required
            />
            <div style={{ minHeight: '1.5rem', marginTop: '0.25rem' }}>
              {isCheckingName && (
                <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>Checking name...</p>
              )}
              {isDuplicateName && !isCheckingName && (
                <p style={{ color: '#dc2626', fontSize: '0.875rem', margin: 0 }}>A question group with this name already exists. Please use a unique name.</p>
              )}
            </div>
          </div>

          <div className="form-group form-group-description" style={{ maxWidth: '50%' }}>
            <label className="form-label">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="form-textarea"
              rows={3}
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
            <h2 className="form-section-title" style={{ marginBottom: 0 }}>Questions</h2>
          </div>

          {mainLevelQuestions.map((question, qIndex) => {
            // Find the logic index for this question to use for insertion
            const logicIndex = questionLogic.findIndex(item =>
              item.type === 'question' &&
              isLogicItemForQuestion(item, question)
            )

            return (
            <div key={question.id} className="question-builder">
              {/* Insert Question and Insert Conditional buttons before each question */}
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '0.5rem',
                marginBottom: '0.5rem',
                marginTop: '12px'
              }}>
                <button
                  type="button"
                  onClick={() => insertQuestionBeforeIndex(logicIndex >= 0 ? logicIndex : qIndex, qIndex)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.25rem 0.75rem',
                    fontSize: '0.7rem',
                    background: 'white',
                    color: '#2563eb',
                    border: '1px dashed #2563eb',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    opacity: 0.7,
                    transition: 'opacity 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
                  title="Insert a new question here"
                >
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '0.75rem', height: '0.75rem' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Insert Question
                </button>
                {qIndex > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      // Find the previous question to use as the conditional's ifIdentifier
                      const prevQuestion = mainLevelQuestions[qIndex - 1]
                      const prevLogicIndex = questionLogic.findIndex(item =>
                        item.type === 'question' &&
                        ((item as any).localQuestionId === prevQuestion.id || item.questionId === prevQuestion.dbId)
                      )
                      addConditionalToLogic(prevLogicIndex >= 0 ? prevLogicIndex : qIndex - 1, undefined, prevQuestion)
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '0.25rem 0.75rem',
                      fontSize: '0.7rem',
                      background: 'white',
                      color: '#7c3aed',
                      border: '1px dashed #7c3aed',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      opacity: 0.7,
                      transition: 'opacity 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
                    title="Insert a new conditional here"
                  >
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '0.75rem', height: '0.75rem' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Insert Conditional
                  </button>
                )}
              </div>

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
                  data-testid={`remove-question-${question.id}`}
                >
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="trash-icon">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              <div className="question-builder-content">
                <div className="form-group">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.25rem' }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>Identifier *</label>
                    {(() => {
                      // Find the previous repeatable question by checking the actual order in questionLogic
                      // This handles cases where there's a conditional between questions
                      const currentLogicIndex = questionLogic.findIndex(item =>
                        item.type === 'question' &&
                        isLogicItemForQuestion(item, question)
                      )
                      
                      // Walk backwards through questionLogic to find the previous question item
                      let prevRepeatableQuestion: QuestionFormData | null = null
                      for (let i = currentLogicIndex - 1; i >= 0; i--) {
                        const item = questionLogic[i]
                        if (item.type === 'question') {
                          const q = questions.find(q => 
                            ((item as any).localQuestionId != null && q.id === (item as any).localQuestionId) ||
                            (item.questionId != null && q.dbId != null && q.dbId === item.questionId)
                          )
                          if (q?.repeatable) {
                            prevRepeatableQuestion = q
                          }
                          break // Stop at the first question we find (whether repeatable or not)
                        }
                        // If we hit a conditional, check if it has repeatable questions inside
                        // For now, we just continue looking backwards
                      }
                      
                      const prevIsRepeatable = prevRepeatableQuestion !== null
                      if (prevIsRepeatable && prevRepeatableQuestion) {
                        // Show radio buttons for repeatable options
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.875rem', color: '#374151' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                              <input
                                type="radio"
                                name={`repeatable-${question.id}`}
                                checked={!question.repeatable}
                                onChange={() => {
                                  updateQuestion(question.id, 'repeatable', false)
                                  updateQuestion(question.id, 'repeatable_group_id', undefined)
                                }}
                              />
                              Not Repeatable
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                              <input
                                type="radio"
                                name={`repeatable-${question.id}`}
                                checked={question.repeatable && question.repeatable_group_id === prevRepeatableQuestion?.repeatable_group_id}
                                onChange={() => {
                                  updateQuestion(question.id, 'repeatable', true)
                                  // Join the previous question's group
                                  updateQuestion(question.id, 'repeatable_group_id', prevRepeatableQuestion?.repeatable_group_id || prevRepeatableQuestion?.id)
                                }}
                              />
                              Join Repeatable Group
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                              <input
                                type="radio"
                                name={`repeatable-${question.id}`}
                                checked={question.repeatable && question.repeatable_group_id !== prevRepeatableQuestion?.repeatable_group_id && question.repeatable_group_id !== undefined}
                                onChange={() => {
                                  updateQuestion(question.id, 'repeatable', true)
                                  // Start a new group with this question's ID
                                  updateQuestion(question.id, 'repeatable_group_id', question.id)
                                }}
                              />
                              Start New Repeatable Group
                            </label>
                          </div>
                        )
                      } else {
                        // Show simple checkbox
                        return (
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem', color: '#374151', position: 'relative', top: '-2px' }}>
                            <input
                              type="checkbox"
                              checked={question.repeatable}
                              onChange={(e) => {
                                updateQuestion(question.id, 'repeatable', e.target.checked)
                                if (e.target.checked) {
                                  // Start a new group with this question's ID
                                  updateQuestion(question.id, 'repeatable_group_id', question.id)
                                } else {
                                  updateQuestion(question.id, 'repeatable_group_id', undefined)
                                }
                              }}
                            />
                            Repeatable
                          </label>
                        )
                      }
                    })()}
                  </div>
                  <input
                    type="text"
                    value={question.identifier}
                    onChange={(e) => updateQuestion(question.id, 'identifier', e.target.value)}
                    className="form-input"
                    style={{ borderColor: question.isDuplicateIdentifier ? '#dc2626' : undefined }}
                    placeholder="e.g., full_name"
                  />
                  <div style={{ minHeight: '1.5rem', marginTop: '0.25rem' }}>
                    {question.isCheckingIdentifier && (
                      <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
                        Checking identifier...
                      </p>
                    )}
                    {question.isDuplicateIdentifier && !question.isCheckingIdentifier && (
                      <p style={{ fontSize: '0.875rem', color: '#dc2626', margin: 0 }}>
                        This identifier is already in use. Please choose a unique identifier.
                      </p>
                    )}
                  </div>
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
                          value="yes_no"
                          checked={
                            question.question_type === 'multiple_choice' &&
                            question.options?.length === 2 &&
                            question.options[0]?.value === 'yes' &&
                            question.options[1]?.value === 'no'
                          }
                          onChange={(e) => {
                            // Yes/No is just a shortcut for multiple_choice with Yes/No options
                            updateQuestion(question.id, 'question_type', 'multiple_choice')
                            updateQuestion(question.id, 'options', [
                              { value: 'yes', label: 'Yes' },
                              { value: 'no', label: 'No' }
                            ])
                          }}
                        />
                        <span>Yes/No</span>
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
                          value="person_backup"
                          checked={question.question_type === 'person_backup'}
                          onChange={(e) => {
                            updateQuestion(question.id, 'question_type', e.target.value)
                            if (!question.person_display_mode) {
                              updateQuestion(question.id, 'person_display_mode', 'autocomplete')
                            }
                          }}
                        />
                        <span>Person (Backup)</span>
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
                              data-option-input={`${question.id}-${optIndex}`}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                removeOption(question.id, optIndex)
                                // Trigger auto-save after removing option
                                setTimeout(() => {
                                  const q = questions.find(q => q.id === question.id)
                                  if (q) triggerAutoSave(q)
                                }, 100)
                              }}
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


              {/* Render conditionals that follow this question in questionLogic */}
              {(() => {
                // Find the index of this question in questionLogic
                const thisQuestionLogicIndex = questionLogic.findIndex(item =>
                  item.type === 'question' &&
                  isLogicItemForQuestion(item, question)
                )
                
                // Find conditionals that come after this question but before the next question
                const conditionalsAfterQuestion: { item: QuestionLogicItem; idx: number }[] = []
                if (thisQuestionLogicIndex >= 0) {
                  for (let i = thisQuestionLogicIndex + 1; i < questionLogic.length; i++) {
                    const item = questionLogic[i]
                    if (item.type === 'question') break // Stop at next question
                    if (item.type === 'conditional') {
                      conditionalsAfterQuestion.push({ item, idx: i })
                    }
                  }
                }
                
                return conditionalsAfterQuestion.map(({ item: logicItem, idx: logicIndex }, condIndex) => {
                  return (
                    <React.Fragment key={logicItem.id}>
                    <div className="conditional-block" style={{
                      marginTop: '0.25rem',
                      padding: '1rem',
                      border: `1px solid ${getDepthBorderColor(1)}`,
                      borderRadius: '0.5rem',
                      backgroundColor: getDepthBackgroundColor(1)
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: getDepthTextColor(1) }}>
                          Conditional ({logicIndex + 1})
                        </div>
              
                        <button
                          type="button"
                          onClick={() => removeLogicItem(logicItem.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: '0.25rem',
                            cursor: 'pointer',
                            color: '#dc2626'
                          }}
                          title="Remove conditional"
                        >
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '1rem', height: '1rem' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {/* If identifier - dropdown of all questions */}
                        <div>
                          <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>
                            If identifier
                          </label>
                          <select
                            value={logicItem.conditional?.ifIdentifier || question.identifier}
                            onChange={(e) => updateConditionalValue(logicItem.id, 'ifIdentifier', e.target.value)}
                            className="form-select"
                            style={{ fontSize: '0.875rem' }}
                          >
                            {questions.filter(q => q.identifier.trim()).map(q => (
                              <option key={q.id} value={q.identifier}>
                                {q.identifier}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Operator dropdown */}
                        <div>
                          <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>
                            Operator
                          </label>
                          {(() => {
                            // Find the selected question by ifIdentifier to check if it's repeatable
                            const selectedIdentifier = logicItem.conditional?.ifIdentifier || question?.identifier || ''
                            const selectedQuestion = questions.find(q => q.identifier === selectedIdentifier)
                            const isRepeatable = selectedQuestion?.repeatable || false
                            
                            return (
                              <select
                                value={logicItem.conditional?.operator || 'equals'}
                                onChange={(e) => updateConditionalValue(logicItem.id, 'operator', e.target.value)}
                                className="form-select"
                                style={{ fontSize: '0.875rem' }}
                              >
                                <option value="equals">equals</option>
                                <option value="not_equals">does not equal</option>
                                {isRepeatable && (
                                  <>
                                    <option value="count_greater_than">entry count &gt;</option>
                                    <option value="count_equals">entry count =</option>
                                    <option value="count_less_than">entry count &lt;</option>
                                  </>
                                )}
                              </select>
                            )
                          })()}
                        </div>

                        {/* Value - based on question type */}
                        <div>
                          <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>
                            Value
                          </label>
                          {(() => {
                            const currentOperator = logicItem.conditional?.operator || 'equals'
                            const isCountOperator = ['count_greater_than', 'count_equals', 'count_less_than'].includes(currentOperator)
                            
                            // If count operator, show numeric input
                            if (isCountOperator) {
                              return (
                                <input
                                  type="number"
                                  min="0"
                                  value={logicItem.conditional?.value || ''}
                                  onChange={(e) => updateConditionalValue(logicItem.id, 'value', e.target.value)}
                                  className="form-input"
                                  style={{ fontSize: '0.875rem', width: '80px' }}
                                  placeholder="0"
                                />
                              )
                            }
                            
                            // Find the selected question by ifIdentifier to get its type and options
                            const selectedIdentifier = logicItem.conditional?.ifIdentifier || question?.identifier || ''
                            const selectedQuestion = questions.find(q => q.identifier === selectedIdentifier)
                            const isChoiceType = selectedQuestion && ['multiple_choice', 'dropdown', 'checkbox_group'].includes(selectedQuestion.question_type)
                            const isPersonType = selectedQuestion && selectedQuestion.question_type === 'person'
                            const isDateType = selectedQuestion && selectedQuestion.question_type === 'date'

                            if (isDateType) {
                              return (
                                <input
                                  type="date"
                                  value={logicItem.conditional?.value || ''}
                                  onChange={(e) => updateConditionalValue(logicItem.id, 'value', e.target.value)}
                                  className="form-input"
                                  style={{ fontSize: '0.875rem' }}
                                />
                              )
                            } else if (isChoiceType && selectedQuestion.options && Array.isArray(selectedQuestion.options)) {
                              return (
                                <select
                                  value={logicItem.conditional?.value || ''}
                                  onChange={(e) => updateConditionalValue(logicItem.id, 'value', e.target.value)}
                                  className="form-select"
                                  style={{ fontSize: '0.875rem' }}
                                >
                                  <option value="">Select value...</option>
                                  {selectedQuestion.options.map((opt: any, idx: number) => {
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
                              return (
                                <PersonTypeahead
                                  value={logicItem.conditional?.value || ''}
                                  onChange={(value) => updateConditionalValue(logicItem.id, 'value', value)}
                                  className="form-input"
                                  style={{ fontSize: '0.875rem' }}
                                  placeholder="Type to search people..."
                                  id={`people-list-${logicItem.id}`}
                                />
                              )
                            } else {
                              return (
                                <input
                                  type="text"
                                  value={logicItem.conditional?.value || ''}
                                  onChange={(e) => updateConditionalValue(logicItem.id, 'value', e.target.value)}
                                  className="form-input"
                                  style={{ fontSize: '0.875rem' }}
                                  placeholder="Enter value"
                                />
                              )
                            }
                          })()}
                        </div>

                        {/* Nested items */}
                        <div style={{ marginTop: '0.5rem' }}>
                          {logicItem.conditional?.nestedItems && logicItem.conditional.nestedItems.length > 0 && (
                            renderNestedItems(logicItem.conditional.nestedItems, [logicIndex], 1, question, (logicIndex + 1).toString())
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Insert buttons AFTER the conditional */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      marginTop: '0.5rem',
                      marginBottom: '0.5rem'
                    }}>
                      <button
                        type="button"
                        onClick={() => addQuestionToLogic(-1, [logicIndex])}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.7rem',
                          background: 'white',
                          color: '#7c3aed',
                          border: '1px dashed #7c3aed',
                          borderRadius: '0.25rem',
                          cursor: 'pointer',
                          opacity: 0.7,
                          transition: 'opacity 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
                        title="Add a question inside this conditional"
                      >
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '0.7rem', height: '0.7rem' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Insert Question
                      </button>
                    </div>

                    </React.Fragment>
                  )
                })
              })()}
            </div>
          )})}


          {questions.length === 0 && (
            <div className="empty-questions">
              <p>No questions added yet. Click "Add Question" to get started.</p>
            </div>
          )}

          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={() => addQuestionToLogic()}
              className="add-question-button"
              disabled={!canAddQuestion}
              style={{ opacity: canAddQuestion ? 1 : 0.5, cursor: canAddQuestion ? 'pointer' : 'not-allowed' }}
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="button-icon">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Question
            </button>
            <button
              type="button"
              onClick={() => addConditionalToLogic(questionLogic.length - 1)}
              className="action-button"
              disabled={questions.length === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                background: questions.length === 0 ? '#d1d5db' : '#7c3aed',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: questions.length === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '1rem', height: '1rem' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Add Conditional
            </button>
          </div>
        </div>
        )}
      </div>
    </div>
  )
}

export default QuestionGroups
