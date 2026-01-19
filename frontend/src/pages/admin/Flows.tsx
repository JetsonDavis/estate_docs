import React, { useState, useEffect } from 'react'
import { flowService } from '../../services/flowService'
import { questionGroupService } from '../../services/questionGroupService'
import { DocumentFlow, DocumentFlowCreate, DocumentFlowUpdate } from '../../types/flow'
import { QuestionGroup } from '../../types/questionGroup'
import './Flows.css'

const Flows: React.FC = () => {
  const [flows, setFlows] = useState<DocumentFlow[]>([])
  const [questionGroups, setQuestionGroups] = useState<QuestionGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedFlow, setSelectedFlow] = useState<DocumentFlow | null>(null)

  useEffect(() => {
    loadFlows()
    loadQuestionGroups()
  }, [search])

  const loadFlows = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await flowService.getFlows(1, 100, search || undefined)
      setFlows(response.flows)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load flows')
    } finally {
      setLoading(false)
    }
  }

  const loadQuestionGroups = async () => {
    try {
      const response = await questionGroupService.getQuestionGroups()
      setQuestionGroups(response.question_groups)
    } catch (err: any) {
      console.error('Failed to load question groups:', err)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this flow?')) {
      return
    }

    try {
      await flowService.deleteFlow(id)
      loadFlows()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete flow')
    }
  }

  const handleEdit = (flow: DocumentFlow) => {
    setSelectedFlow(flow)
    setShowEditModal(true)
  }

  return (
    <div className="flows-container">
      <div className="flows-header">
        <h1 className="flows-title">Document Flows</h1>
        <div className="flows-actions">
          <input
            type="text"
            placeholder="Search flows..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
          <button
            onClick={() => setShowCreateModal(true)}
            className="create-button"
          >
            Create Flow
          </button>
        </div>
      </div>

      {loading && <div className="loading-state">Loading flows...</div>}
      
      {error && <div className="error-state">{error}</div>}
      
      {!loading && !error && flows.length === 0 && (
        <div className="empty-state">
          No flows found. Create your first flow to get started.
        </div>
      )}

      {!loading && !error && flows.length > 0 && (
        <div className="flows-table">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Starting Group</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {flows.map((flow) => (
                <tr key={flow.id}>
                  <td className="flow-name">{flow.name}</td>
                  <td>{flow.description || '-'}</td>
                  <td>
                    {flow.starting_group_id 
                      ? questionGroups.find(g => g.id === flow.starting_group_id)?.name || `Group ${flow.starting_group_id}`
                      : 'Not set'
                    }
                  </td>
                  <td>{new Date(flow.created_at).toLocaleDateString()}</td>
                  <td>
                    <div className="flow-actions">
                      <button
                        onClick={() => handleEdit(flow)}
                        className="action-button edit-button"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(flow.id)}
                        className="action-button delete-button"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreateModal && (
        <CreateFlowModal
          questionGroups={questionGroups}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            loadFlows()
          }}
        />
      )}

      {showEditModal && selectedFlow && (
        <EditFlowModal
          flow={selectedFlow}
          questionGroups={questionGroups}
          onClose={() => {
            setShowEditModal(false)
            setSelectedFlow(null)
          }}
          onSuccess={() => {
            setShowEditModal(false)
            setSelectedFlow(null)
            loadFlows()
          }}
        />
      )}
    </div>
  )
}

interface CreateFlowModalProps {
  questionGroups: QuestionGroup[]
  onClose: () => void
  onSuccess: () => void
}

const CreateFlowModal: React.FC<CreateFlowModalProps> = ({ questionGroups, onClose, onSuccess }) => {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startingGroupId, setStartingGroupId] = useState<number | null>(null)
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([])
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name) {
      alert('Please provide a flow name')
      return
    }

    try {
      setSubmitting(true)
      const data: DocumentFlowCreate = {
        name,
        description: description || undefined,
        starting_group_id: startingGroupId || undefined,
        question_group_ids: selectedGroupIds.length > 0 ? selectedGroupIds : undefined
      }
      await flowService.createFlow(data)
      onSuccess()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create flow')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleGroupSelection = (groupId: number) => {
    setSelectedGroupIds(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Create Flow</h2>
          <button onClick={onClose} className="modal-close">&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="form-textarea"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Starting Question Group</label>
            <select
              value={startingGroupId || ''}
              onChange={(e) => setStartingGroupId(e.target.value ? Number(e.target.value) : null)}
              className="form-select"
            >
              <option value="">Select starting group...</option>
              {questionGroups.map(group => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Associated Question Groups</label>
            <div className="checkbox-list">
              {questionGroups.map(group => (
                <label key={group.id} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={selectedGroupIds.includes(group.id)}
                    onChange={() => toggleGroupSelection(group.id)}
                  />
                  <span>{group.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="cancel-button">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="submit-button">
              {submitting ? 'Creating...' : 'Create Flow'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface EditFlowModalProps {
  flow: DocumentFlow
  questionGroups: QuestionGroup[]
  onClose: () => void
  onSuccess: () => void
}

const EditFlowModal: React.FC<EditFlowModalProps> = ({ flow, questionGroups, onClose, onSuccess }) => {
  const [name, setName] = useState(flow.name)
  const [description, setDescription] = useState(flow.description || '')
  const [startingGroupId, setStartingGroupId] = useState<number | null>(flow.starting_group_id)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setSubmitting(true)
      const data: DocumentFlowUpdate = {
        name,
        description: description || undefined,
        starting_group_id: startingGroupId || undefined
      }
      await flowService.updateFlow(flow.id, data)
      onSuccess()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update flow')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Edit Flow</h2>
          <button onClick={onClose} className="modal-close">&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="form-textarea"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Starting Question Group</label>
            <select
              value={startingGroupId || ''}
              onChange={(e) => setStartingGroupId(e.target.value ? Number(e.target.value) : null)}
              className="form-select"
            >
              <option value="">Select starting group...</option>
              {questionGroups.map(group => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="cancel-button">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="submit-button">
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Flows
