import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { flowService } from '../../services/flowService'
import { questionGroupService } from '../../services/questionService'
import { QuestionGroup } from '../../types/question'
import './Flows.css'

interface FlowGroup {
  id: number
  name: string
  description: string | null
  order_index: number
}

const FlowBuilder: React.FC = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const flowId = id ? parseInt(id) : null
  const isEditMode = !!flowId

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [availableGroups, setAvailableGroups] = useState<QuestionGroup[]>([])
  const [selectedGroups, setSelectedGroups] = useState<FlowGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDuplicateName, setIsDuplicateName] = useState(false)
  const [isCheckingName, setIsCheckingName] = useState(false)
  const nameCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Drag state
  const [draggedItem, setDraggedItem] = useState<QuestionGroup | FlowGroup | null>(null)
  const [dragSource, setDragSource] = useState<'available' | 'selected' | null>(null)
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null)

  useEffect(() => {
    loadData()
  }, [flowId])

  useEffect(() => {
    // Check name uniqueness
    if (nameCheckTimeoutRef.current) {
      clearTimeout(nameCheckTimeoutRef.current)
    }

    if (name.trim() === '') {
      setIsDuplicateName(false)
      setIsCheckingName(false)
      return
    }

    setIsCheckingName(true)
    nameCheckTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await flowService.getFlows(1, 100, name)
        const duplicate = response.flows.find(
          f => f.name.toLowerCase() === name.toLowerCase() && f.id !== flowId
        )
        setIsDuplicateName(!!duplicate)
      } catch (err) {
        console.error('Failed to check name uniqueness:', err)
      } finally {
        setIsCheckingName(false)
      }
    }, 500)

    return () => {
      if (nameCheckTimeoutRef.current) {
        clearTimeout(nameCheckTimeoutRef.current)
      }
    }
  }, [name, flowId])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load all question groups
      const groupsResponse = await questionGroupService.listQuestionGroups(1, 100)
      const allGroups = groupsResponse.question_groups || []

      if (flowId) {
        // Load existing flow
        const flowData = await flowService.getFlow(flowId)
        setName(flowData.name)
        setDescription(flowData.description || '')
        
        // Set selected groups from flow
        const flowGroups: FlowGroup[] = (flowData.question_groups || []).map((g, idx) => ({
          id: g.id,
          name: g.name,
          description: g.description,
          order_index: g.order_index ?? idx
        })).sort((a, b) => a.order_index - b.order_index)
        
        setSelectedGroups(flowGroups)
        
        // Filter out already selected groups from available
        const selectedIds = new Set(flowGroups.map(g => g.id))
        setAvailableGroups(allGroups.filter(g => !selectedIds.has(g.id)))
      } else {
        setAvailableGroups(allGroups)
        setSelectedGroups([])
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleDragStart = (
    e: React.DragEvent,
    item: QuestionGroup | FlowGroup,
    source: 'available' | 'selected'
  ) => {
    setDraggedItem(item)
    setDragSource(source)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnd = () => {
    setDraggedItem(null)
    setDragSource(null)
    setDropTargetIndex(null)
  }

  const handleDragOver = (e: React.DragEvent, index?: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (index !== undefined) {
      setDropTargetIndex(index)
    }
  }

  const handleDropOnSelected = (e: React.DragEvent, targetIndex?: number) => {
    e.preventDefault()
    
    if (!draggedItem) return

    if (dragSource === 'available') {
      // Moving from available to selected
      const group = draggedItem as QuestionGroup
      const newFlowGroup: FlowGroup = {
        id: group.id,
        name: group.name,
        description: group.description || null,
        order_index: targetIndex ?? selectedGroups.length
      }

      // Remove from available
      setAvailableGroups(prev => prev.filter(g => g.id !== group.id))

      // Add to selected at the target position
      setSelectedGroups(prev => {
        const newList = [...prev]
        const insertIndex = targetIndex ?? newList.length
        newList.splice(insertIndex, 0, newFlowGroup)
        // Update order indices
        return newList.map((g, idx) => ({ ...g, order_index: idx }))
      })
    } else if (dragSource === 'selected' && targetIndex !== undefined) {
      // Reordering within selected
      const draggedFlowGroup = draggedItem as FlowGroup
      setSelectedGroups(prev => {
        const currentIndex = prev.findIndex(g => g.id === draggedFlowGroup.id)
        if (currentIndex === -1 || currentIndex === targetIndex) return prev

        const newList = [...prev]
        newList.splice(currentIndex, 1)
        const adjustedIndex = targetIndex > currentIndex ? targetIndex - 1 : targetIndex
        newList.splice(adjustedIndex, 0, draggedFlowGroup)
        // Update order indices
        return newList.map((g, idx) => ({ ...g, order_index: idx }))
      })
    }

    handleDragEnd()
  }

  const handleDropOnAvailable = (e: React.DragEvent) => {
    e.preventDefault()
    
    if (!draggedItem || dragSource !== 'selected') return

    const flowGroup = draggedItem as FlowGroup
    
    // Remove from selected
    setSelectedGroups(prev => {
      const newList = prev.filter(g => g.id !== flowGroup.id)
      return newList.map((g, idx) => ({ ...g, order_index: idx }))
    })

    // Add back to available
    const originalGroup: QuestionGroup = {
      id: flowGroup.id,
      name: flowGroup.name,
      description: flowGroup.description || '',
      identifier: '',
      display_order: 0,
      is_active: true,
      created_at: '',
      updated_at: '',
      question_logic: null,
      question_count: 0
    }
    setAvailableGroups(prev => [...prev, originalGroup])

    handleDragEnd()
  }

  const removeFromSelected = (groupId: number) => {
    const group = selectedGroups.find(g => g.id === groupId)
    if (!group) return

    setSelectedGroups(prev => {
      const newList = prev.filter(g => g.id !== groupId)
      return newList.map((g, idx) => ({ ...g, order_index: idx }))
    })

    const originalGroup: QuestionGroup = {
      id: group.id,
      name: group.name,
      description: group.description || '',
      identifier: '',
      display_order: 0,
      is_active: true,
      created_at: '',
      updated_at: '',
      question_logic: null,
      question_count: 0
    }
    setAvailableGroups(prev => [...prev, originalGroup])
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Flow name is required')
      return
    }

    if (isDuplicateName) {
      setError('A flow with this name already exists')
      return
    }

    if (selectedGroups.length === 0) {
      setError('Please add at least one question group to the flow')
      return
    }

    try {
      setSaving(true)
      setError(null)

      const flowData = {
        name: name.trim(),
        description: description.trim() || undefined,
        question_group_ids: selectedGroups.map(g => g.id),
        starting_group_id: selectedGroups[0]?.id
      }

      if (flowId) {
        await flowService.updateFlow(flowId, flowData)
      } else {
        await flowService.createFlow(flowData)
      }

      navigate('/admin/flows')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save flow')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flows-container">
        <div style={{ textAlign: 'center', padding: '2rem' }}>Loading...</div>
      </div>
    )
  }

  return (
    <div className="flows-container">
      <div className="flows-header">
        <h1>{isEditMode ? 'Edit Flow' : 'Create New Flow'}</h1>
        <button
          onClick={() => navigate('/admin/flows/new')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '0.5rem 1rem',
            fontSize: '0.875rem',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer'
          }}
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '1rem', height: '1rem' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Flow
        </button>
      </div>

      {error && (
        <div style={{
          padding: '0.75rem 1rem',
          backgroundColor: '#fee2e2',
          border: '1px solid #fecaca',
          borderRadius: '0.375rem',
          color: '#dc2626',
          marginBottom: '1rem'
        }}>
          {error}
        </div>
      )}

      {/* Flow Name and Description */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
            Flow Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter flow name"
            style={{
              width: '50%',
              padding: '0.5rem 0.75rem',
              border: isDuplicateName ? '1px solid #dc2626' : '1px solid #d1d5db',
              borderRadius: '0.375rem',
              fontSize: '0.875rem'
            }}
          />
          {isCheckingName && (
            <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
              Checking...
            </span>
          )}
          {isDuplicateName && (
            <div style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem' }}>
              A flow with this name already exists
            </div>
          )}
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter flow description (optional)"
            rows={2}
            style={{
              width: '50%',
              padding: '0.5rem 0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              resize: 'vertical'
            }}
          />
        </div>
      </div>

      {/* Drag and Drop Builder */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '0.75fr 0.75fr',
        gap: '1.5rem',
        minHeight: '400px',
        maxWidth: '75%'
      }}>
        {/* Available Question Groups (Left Side) */}
        <div
          onDragOver={(e) => handleDragOver(e)}
          onDrop={handleDropOnAvailable}
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: '0.5rem',
            padding: '1.25rem',
            backgroundColor: dragSource === 'selected' ? '#f0fdf4' : 'white'
          }}
        >
          <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', fontWeight: 600, color: '#111827' }}>
            Available Question Groups
          </h3>
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', color: '#6b7280' }}>
            Drag groups into flow →
          </p>
          
          {availableGroups.length === 0 ? (
            <div style={{
              padding: '2rem',
              textAlign: 'center',
              color: '#6b7280',
              fontSize: '0.875rem'
            }}>
              {selectedGroups.length > 0 
                ? 'All question groups have been added to the flow'
                : 'No question groups available. Create some first.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {availableGroups.map((group) => (
                <div
                  key={group.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, group, 'available')}
                  onDragEnd={handleDragEnd}
                  style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderLeft: '4px solid #14b8a6',
                    borderRadius: '0.375rem',
                    cursor: 'grab',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    transition: 'all 0.15s ease',
                    opacity: draggedItem && (draggedItem as QuestionGroup).id === group.id ? 0.5 : 1,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)'
                  }}
                >
                  {/* Drag handle dots */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
                    <div style={{ display: 'flex', gap: '2px' }}>
                      <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#9ca3af' }} />
                      <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#9ca3af' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '2px' }}>
                      <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#9ca3af' }} />
                      <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#9ca3af' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '2px' }}>
                      <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#9ca3af' }} />
                      <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#9ca3af' }} />
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827' }}>
                      {group.name}
                    </div>
                    {group.description && (
                      <div style={{
                        fontSize: '0.75rem',
                        color: '#6b7280',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {group.description}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Question Groups (Right Side - Flow Order) */}
        <div
          onDragOver={(e) => handleDragOver(e, selectedGroups.length)}
          onDrop={(e) => handleDropOnSelected(e, selectedGroups.length)}
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: '0.5rem',
            padding: '1.25rem',
            backgroundColor: dragSource === 'available' ? '#f0fdf4' : 'white'
          }}
        >
          <div style={{ 
            border: '2px dashed #d1d5db',
            borderRadius: '0.375rem',
            padding: '1rem',
            minHeight: '300px',
            backgroundColor: '#fafafa'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: '1rem',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid #e5e7eb'
            }}>
              <span style={{ fontSize: '0.875rem', color: '#374151' }}>
                Groups ({selectedGroups.length})
              </span>
            </div>
          
            {selectedGroups.length === 0 ? (
              <div style={{
                padding: '3rem 2rem',
                textAlign: 'center',
                color: '#9ca3af',
                fontSize: '0.875rem'
              }}>
                <svg
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  style={{ width: '2rem', height: '2rem', margin: '0 auto 0.5rem', color: '#d1d5db' }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                <div>Drag question groups here to build your flow</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {selectedGroups.map((group, index) => (
                  <div
                    key={group.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, group, 'selected')}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDropOnSelected(e, index)}
                    style={{
                      padding: '0.75rem 1rem',
                      backgroundColor: 'white',
                      border: dropTargetIndex === index ? '2px solid #14b8a6' : '1px solid #e5e7eb',
                      borderLeft: '4px solid #14b8a6',
                      borderRadius: '0.375rem',
                      cursor: 'grab',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      transition: 'all 0.15s ease',
                      opacity: draggedItem && (draggedItem as FlowGroup).id === group.id ? 0.5 : 1,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                    }}
                  >
                    {/* Drag handle dots */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
                      <div style={{ display: 'flex', gap: '2px' }}>
                        <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#9ca3af' }} />
                        <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#9ca3af' }} />
                      </div>
                      <div style={{ display: 'flex', gap: '2px' }}>
                        <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#9ca3af' }} />
                        <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#9ca3af' }} />
                      </div>
                      <div style={{ display: 'flex', gap: '2px' }}>
                        <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#9ca3af' }} />
                        <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#9ca3af' }} />
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827' }}>
                        {group.name}
                      </div>
                      {group.description && (
                        <div style={{
                          fontSize: '0.75rem',
                          color: '#6b7280',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {group.description}
                        </div>
                      )}
                    </div>
                  <button
                    type="button"
                    onClick={() => removeFromSelected(group.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '0.25rem',
                      cursor: 'pointer',
                      color: '#dc2626',
                      flexShrink: 0
                    }}
                    title="Remove from flow"
                  >
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '1rem', height: '1rem' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem' }}>
        <button
          onClick={handleSave}
          disabled={saving || isDuplicateName || !name.trim()}
          style={{
            padding: '0.5rem 1rem',
            fontSize: '0.875rem',
            backgroundColor: saving || isDuplicateName || !name.trim() ? '#9ca3af' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: saving || isDuplicateName || !name.trim() ? 'not-allowed' : 'pointer'
          }}
        >
          {saving ? 'Saving...' : isEditMode ? 'Update Flow' : 'Create Flow'}
        </button>
        <button
          onClick={() => navigate('/admin/flows')}
          style={{
            padding: '0.5rem 1rem',
            fontSize: '0.875rem',
            backgroundColor: 'white',
            color: '#374151',
            border: '1px solid #d1d5db',
            borderRadius: '0.375rem',
            cursor: 'pointer'
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export default FlowBuilder
