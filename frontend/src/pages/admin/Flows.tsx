import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { flowService } from '../../services/flowService'
import { DocumentFlow } from '../../types/flow'
import './Flows.css'

const Flows: React.FC = () => {
  const navigate = useNavigate()
  const [flows, setFlows] = useState<DocumentFlow[]>([])
  const [questionGroups, setQuestionGroups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

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
      // TODO: Load question groups when service is available
      setQuestionGroups([])
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
    navigate(`/admin/flows/${flow.id}/edit`)
  }

  return (
    <div className="flows-container">
      <div className="flows-wrapper">
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
              onClick={() => navigate('/admin/flows/new')}
              className="create-button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                whiteSpace: 'nowrap',
                minWidth: '140px'
              }}
            >
              <svg
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ width: '1.25rem', height: '1.25rem' }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              New Flow
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
                    <td className="flow-name">
                      <span
                        onClick={() => handleEdit(flow)}
                        style={{ cursor: 'pointer', color: '#2563eb' }}
                      >
                        {flow.name}
                      </span>
                    </td>
                    <td>{flow.description || '-'}</td>
                    <td>
                      {flow.starting_group_id
                        ? questionGroups.find(g => g.id === flow.starting_group_id)?.name || `Group ${flow.starting_group_id}`
                        : 'Not set'
                      }
                    </td>
                    <td>{new Date(flow.created_at).toLocaleDateString()}</td>
                    <td>
                      <div className="flow-actions" style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleEdit(flow)}
                          className="action-button edit-button"
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: '0.25rem',
                            cursor: 'pointer',
                            color: '#6b7280'
                          }}
                          title="Edit flow"
                        >
                          <svg
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            style={{ width: '1.25rem', height: '1.25rem' }}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(flow.id)}
                          className="action-button delete-button"
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: '0.25rem',
                            cursor: 'pointer',
                            color: '#dc2626'
                          }}
                          title="Delete flow"
                        >
                          <svg
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            style={{ width: '1.25rem', height: '1.25rem' }}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  )
}

export default Flows
