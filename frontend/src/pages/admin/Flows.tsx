import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import { flowService } from '../../services/flowService'
import { DocumentFlow } from '../../types/flow'
import { useToast } from '../../hooks/useToast'
import ConfirmDialog from '../../components/common/ConfirmDialog'

const FlowsContainer = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #e0f2fe 0%, #bfdbfe 100%);
  padding: 3rem 1rem;
`

const FlowsWrapper = styled.div`
  max-width: 1400px;
  margin: 0 auto;
`

const FlowsHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  background: white;
  border-radius: 1rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  padding: 1.5rem;
`

const FlowsTitle = styled.h1`
  font-size: 2rem;
  font-weight: 700;
  color: #111827;
  margin: 0;
`

const FlowsActions = styled.div`
  display: flex;
  gap: 1rem;
  align-items: center;
`

const SearchInput = styled.input`
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  min-width: 250px;

  &:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }
`

const CreateButton = styled.button`
  background-color: #2563eb;
  color: white;
  font-weight: 600;
  font-size: 0.875rem;
  padding: 0.625rem 1.25rem;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
  min-width: 140px;

  &:hover {
    background-color: #1d4ed8;
  }
`

const FlowsTable = styled.div`
  width: 100%;
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  overflow: hidden;

  table {
    width: 100%;
    border-collapse: collapse;
  }

  thead {
    background-color: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
  }

  th {
    padding: 0.75rem 1rem;
    text-align: left;
    font-size: 0.75rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  td {
    padding: 1rem;
    border-bottom: 1px solid #f3f4f6;
    font-size: 0.875rem;
    color: #374151;
  }

  tbody tr:hover {
    background-color: #f9fafb;
  }
`

const FlowName = styled.td`
  font-weight: 600;
  color: #111827;
`

const FlowActions = styled.div`
  display: flex;
  gap: 0.5rem;
`

const IconActionButton = styled.button`
  background: none;
  border: none;
  padding: 0.25rem;
  cursor: pointer;
  transition: all 0.2s;

  svg {
    width: 1.25rem;
    height: 1.25rem;
  }
`

const EditIconButton = styled(IconActionButton)`
  color: #6b7280;

  &:hover {
    color: #166534;
  }
`

const DeleteIconButton = styled(IconActionButton)`
  color: #dc2626;

  &:hover {
    color: #991b1b;
  }
`

const StateMessage = styled.div<{ $variant?: 'error' }>`
  text-align: center;
  padding: 3rem 1rem;
  background: ${props => props.$variant === 'error' ? '#fef2f2' : 'white'};
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  color: ${props => props.$variant === 'error' ? '#991b1b' : '#6b7280'};
  ${props => props.$variant === 'error' ? 'border: 1px solid #fecaca;' : ''}
`

const Flows: React.FC = () => {
  const navigate = useNavigate()
  const [flows, setFlows] = useState<DocumentFlow[]>([])
  const [questionGroups, setQuestionGroups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
  const { toast } = useToast()

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

  const handleDelete = (id: number) => {
    setDeleteTarget(id)
  }

  const confirmDelete = async () => {
    if (deleteTarget === null) return
    try {
      await flowService.deleteFlow(deleteTarget)
      loadFlows()
    } catch (err: any) {
      toast(err.response?.data?.detail || 'Failed to delete flow')
    } finally {
      setDeleteTarget(null)
    }
  }

  const handleEdit = (flow: DocumentFlow) => {
    navigate(`/admin/flows/${flow.id}/edit`)
  }

  return (
    <FlowsContainer>
      <FlowsWrapper>
        <FlowsHeader>
          <FlowsTitle>Document Flows</FlowsTitle>
          <FlowsActions>
            <SearchInput
              type="text"
              placeholder="Search flows..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <CreateButton onClick={() => navigate('/admin/flows/new')}>
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
            </CreateButton>
          </FlowsActions>
        </FlowsHeader>

        {loading && <StateMessage>Loading flows...</StateMessage>}

        {error && <StateMessage $variant="error">{error}</StateMessage>}

        {!loading && !error && flows.length === 0 && (
          <StateMessage>
            No flows found. Create your first flow to get started.
          </StateMessage>
        )}

        {!loading && !error && flows.length > 0 && (
          <FlowsTable>
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
                    <FlowName>
                      <span
                        onClick={() => handleEdit(flow)}
                        style={{ cursor: 'pointer', color: '#2563eb' }}
                      >
                        {flow.name}
                      </span>
                    </FlowName>
                    <td>{flow.description || '-'}</td>
                    <td>
                      {flow.starting_group_id
                        ? questionGroups.find(g => g.id === flow.starting_group_id)?.name || `Group ${flow.starting_group_id}`
                        : 'Not set'
                      }
                    </td>
                    <td>{new Date(flow.created_at).toLocaleDateString()}</td>
                    <td>
                      <FlowActions>
                        <EditIconButton
                          onClick={() => handleEdit(flow)}
                          title="Edit flow"
                        >
                          <svg
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                            />
                          </svg>
                        </EditIconButton>
                        <DeleteIconButton
                          onClick={() => handleDelete(flow.id)}
                          title="Delete flow"
                        >
                          <svg
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </DeleteIconButton>
                      </FlowActions>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </FlowsTable>
        )}

      </FlowsWrapper>
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete Flow"
        message="Are you sure you want to delete this flow?"
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </FlowsContainer>
  )
}

export default Flows
