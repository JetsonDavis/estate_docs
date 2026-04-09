import React, { useState, useEffect, useRef } from 'react'
import styled, { keyframes, css } from 'styled-components'
import { flushSync } from 'react-dom'
import { Navigate, useNavigate, useLocation, useParams } from 'react-router-dom'
import { questionGroupService } from '../../services/questionService'
import { QuestionGroup, QuestionType, QuestionOption, QuestionLogicItem } from '../../types/question'
import PersonTypeahead from '../../components/common/PersonTypeahead'
import { useToast } from '../../hooks/useToast'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import QuestionGroupGraph from '../../components/admin/QuestionGroupGraph'

const spin = keyframes`
  to { transform: rotate(360deg); }
`

const flashAdd = keyframes`
  0% { box-shadow: inset 0 0 0 100vmax rgba(134, 239, 172, 0.5); }
  100% { box-shadow: inset 0 0 0 100vmax transparent; }
`

const flashDelete = keyframes`
  0% { box-shadow: inset 0 0 0 100vmax rgba(252, 165, 165, 0.5); }
  50% { box-shadow: inset 0 0 0 100vmax rgba(252, 165, 165, 0.4); }
  100% { opacity: 0; transform: scale(0.98); }
`

const QGContainer = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #e0f2fe 0%, #bfdbfe 100%);
  padding: 3rem 1rem;
`

const QGWrapper = styled.div`
  max-width: 1400px;
  margin: 0 auto;
`

const QGHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  background: white;
  border-radius: 1rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  padding: 1.5rem;
`

const QGTitle = styled.h1`
  font-size: 2rem;
  font-weight: 700;
  color: #111827;
  margin: 0;
`

const QGSubtitle = styled.p`
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: #6b7280;
`

const CreateButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  background-color: #2563eb;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
  &:hover {
    background-color: #1d4ed8;
  }
`

const ButtonIcon = styled.svg`
  width: 1.25rem;
  height: 1.25rem;
`


const AlertContainer = styled.div`
  margin-bottom: 1rem;
`

const Alert = styled.div<{ $variant: 'error' | 'success' }>`
  padding: 1rem;
  border-radius: 0.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
  ${({ $variant }) => $variant === 'error' ? `
    background-color: #fef2f2;
    color: #991b1b;
    border: 1px solid #fecaca;
  ` : `
    background-color: #f0fdf4;
    color: #166534;
    border: 1px solid #bbf7d0;
  `}
`

const AlertClose = styled.button`
  background: none;
  border: none;
  font-size: 1.25rem;
  color: inherit;
  cursor: pointer;
  padding: 0;
  margin-left: 1rem;
`

const LoadingState = styled.div`
  text-align: center;
  padding: 3rem 1rem;
`

const LoadingSpinner = styled.div`
  display: inline-block;
  width: 2rem;
  height: 2rem;
  border: 3px solid #e5e7eb;
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: ${spin} 0.8s linear infinite;
`

const LoadingText = styled.p`
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: #6b7280;
`

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem 1rem;
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
`

const EmptyStateIcon = styled.svg`
  width: 3rem;
  height: 3rem;
  margin: 0 auto;
  color: #9ca3af;
`

const EmptyStateTitle = styled.h3`
  margin-top: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #111827;
`

const EmptyStateDescription = styled.p`
  margin-top: 0.25rem;
  font-size: 0.875rem;
  color: #6b7280;
`

const GroupsList = styled.div`
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  overflow: hidden;
`

const GroupItem = styled.div`
  padding: 0.625rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  &:last-child {
    border-bottom: none;
  }
  &:hover {
    background-color: #f9fafb;
  }
`

const GroupContent = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`

const GroupInfo = styled.div`
  flex: 1;
`

const GroupHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`

const Badge = styled.span<{ $variant?: 'count' | 'inactive' }>`
  display: inline-flex;
  padding: 0.25rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 9999px;
  line-height: 1.25rem;
  ${({ $variant }) => $variant === 'inactive' ? `
    background-color: #fee2e2;
    color: #991b1b;
  ` : `
    background-color: #dbeafe;
    color: #1e40af;
  `}
`

const GroupDescription = styled.p`
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  color: #6b7280;
`

const Pagination = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1.5rem;
`

const PaginationInfo = styled.div`
  font-size: 0.875rem;
  color: #374151;
`

const PaginationButtons = styled.div`
  display: flex;
  gap: 0.5rem;
`

const PaginationButton = styled.button`
  padding: 0.5rem 1rem;
  background-color: white;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s;
  &:hover:not(:disabled) {
    background-color: #f9fafb;
    border-color: #9ca3af;
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const QGForm = styled.div`
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  padding: 2rem;

  .form-group { margin-bottom: 1.5rem; }
  .form-group-description { margin-top: 12px !important; }
  .form-label {
    display: block;
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.5rem;
  }
  .form-input {
    width: 100%;
    padding: 0.625rem 0.875rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    transition: all 0.2s;
    &:focus {
      outline: none;
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }
  }
  .form-textarea {
    width: 100%;
    padding: 0.625rem 0.875rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-family: inherit;
    resize: vertical;
    transition: all 0.2s;
    min-height: 100px !important;
    height: 100px !important;
    &:focus {
      outline: none;
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }
  }
  .form-select {
    width: 100%;
    padding: 0.625rem 0.875rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    transition: all 0.2s;
    &:focus {
      outline: none;
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }
  }
  .question-text-section { width: 100%; }
  .question-type-options-container {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
  }
  .question-type-section {
    display: flex;
    flex-direction: column;
  }
  .question-options-panel {
    display: flex;
    flex-direction: column;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    padding: 1rem;
    background-color: #f9fafb;
  }
  .radio-group {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .radio-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 0.375rem;
    transition: background-color 0.2s;
    &:hover { background-color: #f3f4f6; }
    input[type="radio"] { cursor: pointer; }
    span { font-size: 0.875rem; color: #374151; }
  }
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    input[type="checkbox"] { cursor: pointer; }
    span { font-size: 0.875rem; color: #374151; }
  }
  .options-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }
  .option-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  .option-input { flex: 1; }
  .remove-option-button {
    flex-shrink: 0;
    width: 1.75rem;
    height: 1.75rem;
    background-color: white;
    color: #dc2626;
    border: 1px solid #dc2626;
    border-radius: 0.375rem;
    font-size: 1.25rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    &:hover { background-color: #dc2626; color: white; }
  }
  .add-option-button {
    padding: 0.375rem 0.75rem;
    background-color: white;
    color: #2563eb;
    border: 1px solid #2563eb;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    &:hover { background-color: #2563eb; color: white; }
  }
  .empty-options {}
  .conditional-block {}
  .person-options {}
  .date-options {}
  .dropdown-container {}
  .dropdown-button {
    background: white;
    cursor: pointer;
    text-align: left;
  }
  .dropdown-menu {}
  .dropdown-item {}
`

const FormSection = styled.div`
  margin-bottom: 2rem;
`

const FormSectionTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 600;
  color: #111827;
  margin: 0 0 1.5rem 0;
`

const FormSectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px !important;
`

const FormGroup = styled.div`
  margin-bottom: 1.5rem;
`

const FormGroupDescription = styled(FormGroup)`
  margin-top: 12px !important;
`

const AddQuestionButton = styled.button`
  padding: 0.5rem 1rem;
  background-color: #2563eb;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  &:hover {
    background-color: #1d4ed8;
  }
`

const QuestionBuilder = styled.div<{ $flash?: string }>`
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  padding: 0 1.5rem;
  margin-bottom: 6px;
  ${({ $flash }) => $flash === 'add' ? css`animation: ${flashAdd} 0.8s ease-out forwards;` : ''}
  ${({ $flash }) => $flash === 'delete' ? css`animation: ${flashDelete} 0.4s ease-out forwards;` : ''}
`

const QuestionBuilderHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
`

const QuestionNumber = styled.span`
  font-size: 0.875rem;
  font-weight: 600;
  color: #2563eb;
`

const RemoveButton = styled.button`
  padding: 0.25rem;
  background: none;
  color: #dc2626;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  &:hover {
    color: #991b1b;
  }
`

const TrashIcon = styled.svg`
  width: 1rem;
  height: 1rem;
`

const QuestionBuilderContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-bottom: 1rem;
`

const EmptyQuestions = styled.div`
  text-align: center;
  padding: 2rem;
  color: #6b7280;
  font-size: 0.875rem;
  background: white;
  border-radius: 0.5rem;
  border: 2px dashed #e5e7eb;
`

const SubmitButton = styled.button`
  padding: 0.625rem 1.25rem;
  background-color: #2563eb;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
  &:hover:not(:disabled) {
    background-color: #1d4ed8;
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

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
  const [copyingGroupId, setCopyingGroupId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
  const { toast } = useToast()

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

  const handleDelete = (groupId: number) => {
    setDeleteTarget(groupId)
  }

  const confirmDelete = async () => {
    const groupId = deleteTarget
    if (groupId === null) return
    setDeleteTarget(null)

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

  const handleCopy = async (groupId: number, event: React.MouseEvent) => {
    event.stopPropagation()
    setCopyingGroupId(groupId)

    try {
      const copiedGroup = await questionGroupService.copyQuestionGroup(groupId)

      // Insert the copied group directly above the original in the UI
      setGroups(prev => {
        const index = prev.findIndex(g => g.id === groupId)
        if (index !== -1) {
          const newGroups = [...prev]
          newGroups.splice(index, 0, copiedGroup)
          return newGroups
        }
        return [copiedGroup, ...prev]
      })

      setTotal(prev => prev + 1)
      setSuccess(`Question group copied: "${copiedGroup.name}"`)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to copy question group')
    } finally {
      setCopyingGroupId(null)
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
    <QGContainer>
      <QGWrapper>
      <QGHeader>
        <div>
          <QGTitle>Question Groups</QGTitle>
          <QGSubtitle>
            Create and manage question groups for documents
          </QGSubtitle>
        </div>
        <CreateButton onClick={() => navigate('/admin/question-groups/new')}>
          <ButtonIcon fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </ButtonIcon>
          Create Questions Group
        </CreateButton>
      </QGHeader>

      {error && (
        <AlertContainer>
          <Alert $variant="error">
            <span>{error}</span>
            <AlertClose onClick={() => setError('')}>&times;</AlertClose>
          </Alert>
        </AlertContainer>
      )}

      {success && (
        <AlertContainer>
          <Alert $variant="success">
            <span>{success}</span>
            <AlertClose onClick={() => setSuccess('')}>&times;</AlertClose>
          </Alert>
        </AlertContainer>
      )}

      {loading ? (
        <LoadingState>
          <LoadingSpinner />
          <LoadingText>Loading question groups...</LoadingText>
        </LoadingState>
      ) : groups.length === 0 ? (
        <EmptyState>
          <EmptyStateIcon
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
          </EmptyStateIcon>
          <EmptyStateTitle>No question groups</EmptyStateTitle>
          <EmptyStateDescription>
            Get started by creating a new question group using the button above.
          </EmptyStateDescription>
        </EmptyState>
      ) : (
        <>
          <GroupsList>
            {groups.map((group) => (
              <GroupItem key={group.id}>
                <GroupContent>
                  <GroupInfo>
                    <GroupHeader>
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
                        style={GROUP_NAME_LINK_STYLE}
                      >
                        {group.name}
                      </span>
                      <Badge $variant="count">
                        {group.question_count} questions
                      </Badge>
                      <button
                        onClick={(e) => handleCopy(group.id, e)}
                        title="Copy group"
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '0.25rem',
                          cursor: copyingGroupId === group.id ? 'wait' : 'pointer',
                          color: '#0ea5e9',
                          marginLeft: '0.5rem',
                          display: 'flex',
                          alignItems: 'center',
                          position: 'relative',
                          top: '-3px'
                        }}
                        disabled={copyingGroupId === group.id}
                      >
                        {copyingGroupId === group.id ? (
                          <svg
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            style={{
                              width: '1rem',
                              height: '1rem',
                              animation: 'spin 1s linear infinite'
                            }}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                        ) : (
                          <svg
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            style={ICON_SM_STYLE}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                        )}
                      </button>
                      {group.is_active && (
                        <button
                          onClick={() => handleDelete(group.id)}
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
                            style={ICON_SM_STYLE}
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
                        <Badge $variant="inactive">
                          Inactive
                        </Badge>
                      )}
                    </GroupHeader>
                    {group.description && (
                      <GroupDescription>{group.description}</GroupDescription>
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
                          <div style={IDENTIFIERS_PANEL_STYLE}>
                            {group.questions.map((q: any, idx: number) => (
                              <div key={idx} style={ITEM_SPACING_STYLE}>
                                <code style={IDENTIFIER_CODE_STYLE}>
                                  {stripIdentifierNamespace(q.identifier)}
                                </code>
                                <span style={IDENTIFIER_TYPE_BADGE_STYLE}>
                                  {q.question_type}
                                </span>
                                <span style={IDENTIFIER_TEXT_STYLE}>
                                  {q.question_text}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </GroupInfo>
                </GroupContent>
              </GroupItem>
            ))}
          </GroupsList>

          {totalPages > 1 && (
            <Pagination>
              <PaginationInfo>
                Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} groups
              </PaginationInfo>
              <PaginationButtons>
                <PaginationButton
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                >
                  Previous
                </PaginationButton>
                <PaginationButton
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                >
                  Next
                </PaginationButton>
              </PaginationButtons>
            </Pagination>
          )}
        </>
      )}
      </QGWrapper>
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete Question Group"
        message="Are you sure you want to delete this question group?"
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </QGContainer>
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

/**
 * Pure normalizer: transforms raw API group data into the component state shape.
 * Returns { questions, questionLogic, collapsedItems, wasFixed } without any side-effects.
 */
function normalizeGroupData(groupData: any): {
  questions: QuestionFormData[]
  questionLogic: QuestionLogicItem[]
  collapsedItems: Set<string> | null
  wasFixed: boolean
} {
  // Map raw questions to QuestionFormData
  const questions: QuestionFormData[] =
    groupData.questions && groupData.questions.length > 0
      ? groupData.questions.map((q: any) => ({
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
          lastSaved: new Date(),
        }))
      : []

  // Collapsed items
  const collapsedItems =
    groupData.collapsed_items && groupData.collapsed_items.length > 0
      ? new Set<string>(groupData.collapsed_items)
      : null

  // If no logic, return early
  if (!groupData.question_logic || groupData.question_logic.length === 0) {
    return { questions, questionLogic: [], collapsedItems, wasFixed: false }
  }

  const validQuestionIds = new Set(questions.map(q => q.dbId))

  const dbIdToQuestion = new Map<number, QuestionFormData>()
  for (const q of questions) {
    if (q.dbId) dbIdToQuestion.set(q.dbId, q)
  }

  // Collect all questionIds already assigned in logic items
  const collectAssignedIds = (items: any[]): Set<number> => {
    const ids = new Set<number>()
    for (const item of items) {
      if (item.type === 'question' && item.questionId) ids.add(item.questionId)
      if (item.type === 'conditional' && item.conditional?.nestedItems) {
        for (const id of collectAssignedIds(item.conditional.nestedItems)) ids.add(id)
      }
    }
    return ids
  }
  const assignedIds = collectAssignedIds(groupData.question_logic)

  // Sync localQuestionId -> question.id for items that DO have questionId
  const syncQuestionIds = (items: any[]) => {
    for (const item of items) {
      if (item.type === 'question' && item.questionId && item.localQuestionId) {
        const q = dbIdToQuestion.get(item.questionId)
        if (q) q.id = item.localQuestionId
      }
      if (item.type === 'conditional' && item.conditional?.nestedItems) {
        syncQuestionIds(item.conditional.nestedItems)
      }
    }
  }
  syncQuestionIds(groupData.question_logic)

  // For items WITHOUT questionId, find unassigned questions and patch
  const unassignedDbIds = questions.filter(q => q.dbId && !assignedIds.has(q.dbId)).map(q => q.dbId!)
  let unassignedIdx = 0

  const fixUndefinedQuestionIds = (items: QuestionLogicItem[]): QuestionLogicItem[] => {
    return items.map(item => {
      if (item.type === 'question' && !item.questionId) {
        const localId = item.localQuestionId
        if (localId && unassignedIdx < unassignedDbIds.length) {
          const dbId = unassignedDbIds[unassignedIdx++]
          const q = dbIdToQuestion.get(dbId)
          if (q) q.id = localId
          return { ...item, questionId: dbId }
        }
      }
      if (item.type === 'conditional' && item.conditional?.nestedItems) {
        return {
          ...item,
          conditional: {
            ...item.conditional,
            nestedItems: fixUndefinedQuestionIds(item.conditional.nestedItems),
          },
        }
      }
      return item
    })
  }

  // Strip namespace prefixes from conditional ifIdentifier values
  const stripConditionalNamespaces = (items: QuestionLogicItem[]): QuestionLogicItem[] => {
    return items.map(item => {
      if (item.type === 'conditional' && item.conditional) {
        return {
          ...item,
          conditional: {
            ...item.conditional,
            ifIdentifier: item.conditional.ifIdentifier
              ? stripIdentifierNamespace(item.conditional.ifIdentifier)
              : item.conditional.ifIdentifier,
            nestedItems: item.conditional.nestedItems
              ? stripConditionalNamespaces(item.conditional.nestedItems)
              : item.conditional.nestedItems,
          },
        }
      }
      return item
    })
  }

  // Fix undefined questionIds then strip namespaces
  let fixedLogic = fixUndefinedQuestionIds(groupData.question_logic)
  fixedLogic = stripConditionalNamespaces(fixedLogic)

  // After syncQuestionIds and fixUndefinedQuestionIds have run, build the set of valid local IDs
  // (question.id values that correspond to real DB questions)
  const validLocalIds = new Set(questions.map(q => q.id).filter(Boolean) as string[])

  // Recursively clean orphaned question items from logic.
  // Items with a questionId must reference a valid DB question.
  // Items with only a localQuestionId (no questionId) must reference a question that
  // actually exists in the questions array – otherwise they are stale orphans from a
  // previous session whose corresponding question was never saved.
  const cleanOrphanedItems = (items: QuestionLogicItem[]): QuestionLogicItem[] => {
    return items
      .filter(item => {
        if (item.type === 'question') {
          if (item.questionId && validQuestionIds.has(item.questionId)) return true
          const localId = item.localQuestionId as string | undefined
          if (!item.questionId && localId && validLocalIds.has(localId)) return true
          return false
        }
        return true
      })
      .map(item => {
        if (item.type === 'conditional' && item.conditional?.nestedItems) {
          return {
            ...item,
            conditional: {
              ...item.conditional,
              nestedItems: cleanOrphanedItems(item.conditional.nestedItems),
            },
          }
        }
        return item
      })
  }

  let cleanedLogic = cleanOrphanedItems(fixedLogic)

  // Find questions that exist in DB but are missing from question_logic
  const getQuestionIdsFromLogic = (items: QuestionLogicItem[]): Set<number> => {
    const ids = new Set<number>()
    for (const item of items) {
      if (item.type === 'question' && item.questionId) ids.add(item.questionId)
      if (item.type === 'conditional' && item.conditional?.nestedItems) {
        getQuestionIdsFromLogic(item.conditional.nestedItems).forEach(id => ids.add(id))
      }
    }
    return ids
  }

  const countQuestionSlotsInLogic = (items: QuestionLogicItem[]): number => {
    let count = 0
    for (const item of items) {
      if (item.type === 'question') count++
      if (item.type === 'conditional' && item.conditional?.nestedItems) {
        count += countQuestionSlotsInLogic(item.conditional.nestedItems)
      }
    }
    return count
  }

  // Compare against cleanedLogic so orphan-item removal also triggers a DB save
  const wasFixed =
    JSON.stringify(groupData.question_logic) !== JSON.stringify(cleanedLogic)

  const questionIdsInLogic = getQuestionIdsFromLogic(cleanedLogic)
  const totalSlots = countQuestionSlotsInLogic(cleanedLogic)
  const orphanedQuestions = questions.filter(q => q.dbId && !questionIdsInLogic.has(q.dbId))

  if (orphanedQuestions.length > 0) {
    const unfilledSlots = totalSlots - questionIdsInLogic.size
    if (unfilledSlots < orphanedQuestions.length) {
      console.warn(
        'WARNING: Found orphaned questions in DB but not in logic:',
        orphanedQuestions.map(q => q.identifier)
      )
      for (const orphan of orphanedQuestions) {
        cleanedLogic.push({
          id: `restored_${orphan.dbId}_${crypto.randomUUID()}`,
          type: 'question',
          questionId: orphan.dbId,
          depth: 0,
        })
      }
    }
  }

  return { questions, questionLogic: cleanedLogic, collapsedItems, wasFixed }
}

// Extracted style constants to avoid re-creating objects on every render
const SUMMARY_ROW_STYLE: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#374151', lineHeight: 1.4 }
const REPEATABLE_BADGE_STYLE: React.CSSProperties = { backgroundColor: '#dbeafe', color: '#1d4ed8', padding: '0 0.35rem', borderRadius: '0.25rem', fontSize: '0.7rem', fontWeight: 600 }
const IDENTIFIER_STYLE: React.CSSProperties = { fontWeight: 600, color: '#1f2937' }
const SEPARATOR_STYLE: React.CSSProperties = { color: '#9ca3af' }
const TEXT_MUTED_STYLE: React.CSSProperties = { color: '#6b7280' }
const TYPE_LABEL_STYLE: React.CSSProperties = { color: '#2563eb', fontWeight: 500 }
const OPTION_LABEL_STYLE: React.CSSProperties = { color: '#6b7280', fontStyle: 'italic' }
const COND_IF_STYLE: React.CSSProperties = { fontWeight: 500 }
const COND_IDENTIFIER_STYLE: React.CSSProperties = { fontWeight: 600, color: '#7c3aed' }
const COND_VALUE_STYLE: React.CSSProperties = { fontWeight: 600, color: '#1f2937' }
const COND_COUNT_STYLE: React.CSSProperties = { color: '#6b7280', fontSize: '0.75rem' }
const ICON_SM_STYLE: React.CSSProperties = { width: '1rem', height: '1rem' }
const ICON_BUTTON_STYLE: React.CSSProperties = { background: 'none', border: 'none', padding: '0.25rem', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center' }
const GROUP_NAME_LINK_STYLE: React.CSSProperties = { cursor: 'pointer', color: '#2563eb', fontSize: '0.875rem', fontWeight: '400' }
const CHECKBOX_STYLE: React.CSSProperties = { width: '1rem', height: '1rem', marginRight: '0.5rem', cursor: 'pointer' }
const IDENTIFIERS_PANEL_STYLE: React.CSSProperties = { marginTop: '0.5rem', paddingLeft: '1.5rem', fontSize: '0.875rem', color: '#4b5563' }
const IDENTIFIER_CODE_STYLE: React.CSSProperties = { backgroundColor: '#f3f4f6', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', fontSize: '0.8rem' }
const IDENTIFIER_TYPE_BADGE_STYLE: React.CSSProperties = { marginLeft: '0.5rem', padding: '0.125rem 0.375rem', backgroundColor: '#dbeafe', color: '#1d4ed8', borderRadius: '0.25rem', fontSize: '0.7rem' }
const IDENTIFIER_TEXT_STYLE: React.CSSProperties = { marginLeft: '0.5rem', color: '#9ca3af' }
const ITEM_SPACING_STYLE: React.CSSProperties = { marginBottom: '0.25rem' }

// Color scheme for different nesting depths
const getDepthBackgroundColor = (depth: number): string => {
  const colors = [
    '#f9fafb', // Level 0: gray-50
    '#faf5ff', // Level 1: purple-50
    '#f0fdf4', // Level 2: green-50
    '#fffbeb', // Level 3: amber-50
    '#ecfeff', // Level 4: cyan-50
    '#eff6ff', // Level 5: blue-50
    '#fdf2f8', // Level 6: pink-50
    '#f0fdfa', // Level 7: teal-50
    '#fefce8', // Level 8: yellow-50
    '#fdf4ff', // Level 9: fuchsia-50
    '#f8fafc', // Level 10: slate-50
  ]
  return colors[Math.min(depth, colors.length - 1)]
}

const getDepthBorderColor = (depth: number): string => {
  const colors = [
    '#e5e7eb', // Level 0: gray-200
    '#e9d5ff', // Level 1: purple-200
    '#bbf7d0', // Level 2: green-200
    '#fde68a', // Level 3: amber-200
    '#a5f3fc', // Level 4: cyan-200
    '#bfdbfe', // Level 5: blue-200
    '#fbcfe8', // Level 6: pink-200
    '#99f6e4', // Level 7: teal-200
    '#fef08a', // Level 8: yellow-200
    '#f5d0fe', // Level 9: fuchsia-200
    '#cbd5e1', // Level 10: slate-200
  ]
  return colors[Math.min(depth, colors.length - 1)]
}

const getDepthTextColor = (depth: number): string => {
  const colors = [
    '#374151', // Level 0: gray-700
    '#7c3aed', // Level 1: purple-600
    '#16a34a', // Level 2: green-600
    '#d97706', // Level 3: amber-600
    '#0891b2', // Level 4: cyan-600
    '#2563eb', // Level 5: blue-600
    '#db2777', // Level 6: pink-600
    '#0d9488', // Level 7: teal-600
    '#ca8a04', // Level 8: yellow-600
    '#c026d3', // Level 9: fuchsia-600
    '#475569', // Level 10: slate-600
  ]
  return colors[Math.min(depth, colors.length - 1)]
}

const CreateQuestionGroupForm: React.FC<CreateQuestionGroupFormProps> = ({ groupId }) => {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [questions, setQuestionsState] = useState<QuestionFormData[]>([])
  const questionsRef = useRef<QuestionFormData[]>([])
  // Keep ref in sync and expose a single setter
  const setQuestions: typeof setQuestionsState = (action) => {
    setQuestionsState(prev => {
      const next = typeof action === 'function' ? action(prev) : action
      questionsRef.current = next
      return next
    })
  }
  const [questionLogic, setQuestionLogic] = useState<QuestionLogicItem[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [showGraph, setShowGraph] = useState(false)
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
  const savingInProgressRefs = useRef<{ [key: string]: boolean }>({})
  const pendingSaveRefs = useRef<{ [key: string]: boolean }>({})
  const questionDbIdRefs = useRef<{ [key: string]: number | undefined }>({})
  const identifierCheckTimeoutRefs = useRef<{ [key: string]: NodeJS.Timeout | null }>({})
  const questionLogicSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const groupInfoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pendingRequestsRef = useRef<number>(0)
  const [hasPendingRequests, setHasPendingRequests] = useState(false)
  const nestedQuestionIdsRef = useRef<Set<string>>(new Set())
  const [collapsedItems, setCollapsedItems] = useState<Set<string>>(new Set())
  const collapsedSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [flashingQuestions, setFlashingQuestions] = useState<Map<string, 'add' | 'delete'>>(new Map())
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set())
  const [validationMessage, setValidationMessage] = useState('')

  const flashQuestion = (id: string, type: 'add' | 'delete') => {
    setFlashingQuestions(prev => new Map(prev).set(id, type))
    setTimeout(() => {
      setFlashingQuestions(prev => {
        const next = new Map(prev)
        next.delete(id)
        return next
      })
    }, type === 'add' ? 800 : 400)
  }

  const isEditMode = !!groupId

  // Validate all questions have identifier + question_text, all conditionals have value
  const validateForm = (): boolean => {
    const errors = new Set<string>()
    const messages: string[] = []

    // Check all questions
    for (const q of questions) {
      if (!q.identifier.trim()) {
        errors.add(`q-identifier-${q.id}`)
        messages.push(`Question is missing an identifier`)
      }
      if (!q.question_text.trim()) {
        errors.add(`q-text-${q.id}`)
        messages.push(`Question is missing question text`)
      }
    }

    // Recursively check nested conditionals
    const checkNestedItems = (items: QuestionLogicItem[], numberPrefix: string) => {
      let questionCounter = 0
      let conditionalCounter = 0
      for (const item of items) {
        if (item.type === 'question') {
          questionCounter++
          conditionalCounter = 0
        }
        if (item.type === 'conditional' && item.conditional) {
          conditionalCounter++
          const condNumber = `${numberPrefix}-${conditionalCounter}`
          if (!item.conditional.value || !item.conditional.value.trim()) {
            errors.add(`c-value-${item.id}`)
            messages.push(`Conditional (${condNumber}) is missing a value`)
          }
          if (item.conditional.nestedItems) {
            checkNestedItems(item.conditional.nestedItems, condNumber)
          }
        }
      }
    }

    // Check root-level conditionals using the same numbering as the rendering
    mainLevelQuestions.forEach((question, qIndex) => {
      const thisLogicIndex = questionLogic.findIndex(item =>
        item.type === 'question' && isLogicItemForQuestion(item, question)
      )
      if (thisLogicIndex < 0) return
      let condIndex = 0
      for (let i = thisLogicIndex + 1; i < questionLogic.length; i++) {
        const item = questionLogic[i]
        if (item.type === 'question') break
        if (item.type === 'conditional' && item.conditional) {
          condIndex++
          const condNumber = `${qIndex + 1}-${condIndex}`
          if (!item.conditional.value || !item.conditional.value.trim()) {
            errors.add(`c-value-${item.id}`)
            messages.push(`Conditional (${condNumber}) is missing a value`)
          }
          if (item.conditional.nestedItems) {
            checkNestedItems(item.conditional.nestedItems, condNumber)
          }
        }
      }
    })

    setValidationErrors(errors)

    if (errors.size > 0) {
      const uniqueMessages = [...new Set(messages)]
      setValidationMessage(`Please fill in all required fields: ${uniqueMessages.join('; ')}`)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return false
    }

    setValidationMessage('')
    return true
  }

  // Clear a specific validation error when user types in a field
  const clearValidationError = (errorKey: string) => {
    if (validationErrors.has(errorKey)) {
      setValidationErrors(prev => {
        const next = new Set(prev)
        next.delete(errorKey)
        if (next.size === 0) setValidationMessage('')
        return next
      })
    }
  }

  const saveCollapsedItems = (items: Set<string>) => {
    const targetGroupId = groupId || null
    if (!targetGroupId) return

    if (collapsedSaveTimeoutRef.current) {
      clearTimeout(collapsedSaveTimeoutRef.current)
    }

    collapsedSaveTimeoutRef.current = setTimeout(async () => {
      try {
        await questionGroupService.updateQuestionGroup(targetGroupId, {
          collapsed_items: [...items]
        })
      } catch (err) {
        console.error('Failed to save collapsed items:', err)
      }
    }, 500)
  }

  const updateCollapsedItems = (updater: (prev: Set<string>) => Set<string>) => {
    setCollapsedItems(prev => {
      const next = updater(prev)
      saveCollapsedItems(next)
      return next
    })
  }

  const toggleCollapsed = (itemId: string) => {
    updateCollapsedItems(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  const getAllCollapsibleIds = (): Set<string> => {
    const ids = new Set<string>()
    // Main-level questions
    for (const q of questions) {
      ids.add(`q-${q.id}`)
      ids.add(`nq-${q.id}`)
    }
    // Walk logic tree for conditionals and nested items
    const walkLogic = (items: QuestionLogicItem[]) => {
      for (const item of items) {
        if (item.type === 'conditional') {
          ids.add(`c-${item.id}`)
          ids.add(`nc-${item.id}`)
          if (item.conditional?.nestedItems) {
            walkLogic(item.conditional.nestedItems)
          }
        }
      }
    }
    walkLogic(questionLogic)
    return ids
  }

  const collapseAll = () => updateCollapsedItems(() => getAllCollapsibleIds())
  const expandAll = () => updateCollapsedItems(() => new Set())

  // Helper to generate a compact question type label
  const getQuestionTypeLabel = (q: QuestionFormData): string => {
    const isYesNo = q.question_type === 'multiple_choice' &&
      q.options?.length === 2 &&
      q.options[0]?.value === 'yes' &&
      q.options[1]?.value === 'no'
    if (isYesNo) return 'Yes/No'
    const typeMap: Record<string, string> = {
      free_text: 'Text',
      multiple_choice: 'Radio',
      checkbox_group: 'Checkboxes',
      dropdown: 'Dropdown',
      person: 'Person',
      person_backup: 'Person (Backup)',
      date: 'Date'
    }
    return typeMap[q.question_type] || q.question_type
  }

  // Helper to generate compact question summary for collapsed view
  const renderQuestionSummary = (q: QuestionFormData, prevQuestion?: QuestionFormData | null) => {
    const typeLabel = getQuestionTypeLabel(q)
    const hasOptions = ['multiple_choice', 'checkbox_group', 'dropdown'].includes(q.question_type) && q.options?.length > 0
    const optionLabels = hasOptions ? q.options.map(o => o.label).filter(Boolean).join(', ') : ''
    const isNewRepeatableGroup = q.repeatable && (
      !prevQuestion || !prevQuestion.repeatable || prevQuestion.repeatable_group_id !== q.repeatable_group_id
    )
    return (
      <div style={SUMMARY_ROW_STYLE}>
        {q.repeatable && (
          <span style={REPEATABLE_BADGE_STYLE}>{isNewRepeatableGroup ? 'New Repeatable' : 'Repeatable'}</span>
        )}
        <span style={IDENTIFIER_STYLE}>{q.identifier || '(no identifier)'}</span>
        <span style={SEPARATOR_STYLE}>|</span>
        <span style={TEXT_MUTED_STYLE}>{q.question_text || '(no text)'}</span>
        <span style={SEPARATOR_STYLE}>|</span>
        <span style={TYPE_LABEL_STYLE}>{typeLabel}</span>
        {hasOptions && optionLabels && (
          <>
            <span style={SEPARATOR_STYLE}>:</span>
            <span style={OPTION_LABEL_STYLE}>{optionLabels}</span>
          </>
        )}
      </div>
    )
  }

  // Helper to generate compact conditional summary for collapsed view
  const renderConditionalSummary = (logicItem: QuestionLogicItem) => {
    const cond = logicItem.conditional
    const identifier = cond?.ifIdentifier || '?'
    const op = cond?.operator || 'equals'
    const val = cond?.value || '?'
    const opLabel: Record<string, string> = {
      equals: '==',
      not_equals: '!=',
      count_greater_than: 'count >',
      count_equals: 'count ==',
      count_less_than: 'count <'
    }
    const nestedCount = cond?.nestedItems?.length || 0
    const questionCount = cond?.nestedItems?.filter(i => i.type === 'question').length || 0
    return (
      <div style={SUMMARY_ROW_STYLE}>
        <span style={COND_IF_STYLE}>If</span>
        <span style={COND_IDENTIFIER_STYLE}>{identifier}</span>
        <span style={TEXT_MUTED_STYLE}>{opLabel[op] || op}</span>
        <span style={COND_VALUE_STYLE}>"{val}"</span>
        {questionCount > 0 && (
          <span style={COND_COUNT_STYLE}>({questionCount} question{questionCount !== 1 ? 's' : ''} inside)</span>
        )}
      </div>
    )
  }

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

  // Block navigation when there are validation errors
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (validationErrors.size > 0) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [validationErrors])

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

          const normalized = normalizeGroupData(groupData)

          setQuestions(normalized.questions)
          if (normalized.collapsedItems) {
            setCollapsedItems(normalized.collapsedItems)
          }
          if (normalized.questionLogic.length > 0) {
            setQuestionLogic(normalized.questionLogic)
          }

          // If we fixed undefined questionIds, save the corrected logic to the server
          if (normalized.wasFixed) {
            try {
              await questionGroupService.updateQuestionGroup(groupId, {
                question_logic: normalized.questionLogic
              })
            } catch (err) {
              console.error('Failed to save corrected question_logic:', err)
            }
          }
        } catch (error) {
          console.error('Failed to load group data:', error)
          toast('Failed to load question group data')
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
        // Exclude the current group (by savedGroupId) to avoid false positives
        // when the group was just created and the name check re-fires
        const currentId = savedGroupIdRef.current
        const duplicate = response.question_groups.some(
          g => g.name.toLowerCase() === name.toLowerCase() && g.id !== currentId
        )
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
  }, [name, groupInfoSaved, isEditMode])

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
    const localId = item.localQuestionId as string | undefined
    if (localId && localId === question.id) {
      return true
    }
    return item.questionId != null && question.dbId != null && item.questionId === question.dbId
  }

  const findQuestionForLogicItem = (item: QuestionLogicItem): QuestionFormData | undefined => {
    const localId = item.localQuestionId as string | undefined
    return questions.find(q =>
      (localId != null && q.id === localId) ||
      (item.questionId != null && q.dbId != null && q.dbId === item.questionId)
    )
  }

  const addQuestion = (): QuestionFormData => {
    const newQuestion: QuestionFormData = {
      id: crypto.randomUUID(),
      question_text: '',
      question_type: 'free_text',
      identifier: '',
      repeatable: false,
      is_required: false,
      options: []
    }
    setQuestions(prev => [...prev, newQuestion])
    flashQuestion(newQuestion.id, 'add')
    return newQuestion
  }

  const updateQuestion = (id: string, field: keyof QuestionFormData, value: any) => {
    setQuestions(prevQuestions => prevQuestions.map(q => {
      if (q.id === id) {
        const updated = { ...q, [field]: value }
        // When switching to a choice-based type, ensure at least one empty option exists
        if (field === 'question_type' && ['multiple_choice', 'checkbox_group', 'dropdown'].includes(value as string)) {
          if (!updated.options || updated.options.length === 0) {
            updated.options = [{ value: '', label: '' }]
          }
        }
        // Trigger identifier uniqueness check if identifier field changed
        if (field === 'identifier') {
          checkIdentifierUniqueness(updated)
        }
        triggerAutoSave(updated)
        return updated
      }
      return q
    }))
  }

  const updateQuestionFields = (id: string, fields: Partial<QuestionFormData>) => {
    setQuestions(prevQuestions => prevQuestions.map(q => {
      if (q.id === id) {
        const updated = { ...q, ...fields }
        if ('identifier' in fields) {
          checkIdentifierUniqueness(updated)
        }
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
        // Wait for any in-progress save to complete before checking,
        // so we have the latest dbId to exclude from the uniqueness check.
        // Auto-save fires at 300ms, this check at 500ms — the save may still be in flight.
        const maxWait = 3000
        const pollInterval = 100
        let waited = 0
        while (savingInProgressRefs.current[question.id] && waited < maxWait) {
          await new Promise(resolve => setTimeout(resolve, pollInterval))
          waited += pollInterval
        }

        // First check against other questions in the current form
        const localDuplicate = questionsRef.current.some(q =>
          q.id !== question.id &&
          q.identifier.trim() !== '' &&
          q.identifier.toLowerCase() === question.identifier.toLowerCase()
        )

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
        
        // Read dbId from ref (synchronous, always up-to-date) to avoid race condition
        // where auto-save creates the question before this check runs
        const latestDbId = questionDbIdRefs.current[question.id] ?? question.dbId
        
        const result = await questionGroupService.checkQuestionIdentifier(
          question.identifier,
          savedGroupId,
          latestDbId
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
        // Get the latest version of the question from ref (synchronous read)
        const latestQuestion = questionsRef.current.find(q => q.id === question.id)
        if (latestQuestion) {
          autoSaveQuestion(latestQuestion)
        }
      }, 300) // 300ms debounce
    }
  }

  const autoSaveQuestion = async (question: QuestionFormData) => {
    // Use ref to get current value, avoiding stale closure
    const currentGroupId = savedGroupIdRef.current
    
    if (!currentGroupId) { return }

    // Don't save if missing identifier (question_text can be empty initially)
    if (!question.identifier.trim()) { return }

    // Don't save if identifier is duplicate (React state flag set by debounced check)
    if (question.isDuplicateIdentifier) { return }

    // Synchronous local check to guard against the race condition where the
    // 300ms auto-save fires before the 500ms checkIdentifierUniqueness sets
    // isDuplicateIdentifier. Without this, a partial identifier typed just
    // before an existing one could slip through as a valid save.
    const localIdentifierDuplicate = questionsRef.current.some(q =>
      q.id !== question.id &&
      q.identifier.trim() !== '' &&
      q.identifier.toLowerCase() === question.identifier.trim().toLowerCase()
    )
    if (localIdentifierDuplicate) { return }

    // If a save is already in progress for this question, mark as pending and return
    if (savingInProgressRefs.current[question.id]) {
      pendingSaveRefs.current[question.id] = true
      return
    }
    savingInProgressRefs.current[question.id] = true

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
              if (item.localQuestionId === localId || (question.dbId != null && item.questionId != null && item.questionId === question.dbId)) {
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
        const updatePayload = {
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
        }
        await questionGroupService.updateQuestion(question.dbId, updatePayload)
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

        // Store dbId in ref immediately (synchronous) so identifier check can read it
        questionDbIdRefs.current[question.id] = created.id

        // Update with database ID
        setQuestions(prev => prev.map(q =>
          q.id === question.id ? { ...q, dbId: created.id } : q
        ))

        // Also update the questionId in questionLogic
        setQuestionLogic(prev => {
          const updateLogicItems = (items: QuestionLogicItem[]): QuestionLogicItem[] => {
            return items.map(item => {
              if (item.type === 'question' && item.localQuestionId === question.id) {
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
      // If the backend rejected the save because the identifier already exists,
      // mark the question as a duplicate so the UI shows the red error indicator.
      const isDuplicateError =
        error?.response?.status === 400 &&
        (error?.response?.data?.detail ?? '').toLowerCase().includes('identifier already exists')
      setQuestions(prev => prev.map(q =>
        q.id === question.id
          ? { ...q, isSaving: false, ...(isDuplicateError ? { isDuplicateIdentifier: true } : {}) }
          : q
      ))
    } finally {
      decrementPendingRequests()
      savingInProgressRefs.current[question.id] = false
      // If another save was queued while we were saving, trigger it now
      if (pendingSaveRefs.current[question.id]) {
        pendingSaveRefs.current[question.id] = false
        const latestQuestion = questionsRef.current.find(q => q.id === question.id)
        if (latestQuestion) {
          autoSaveQuestion(latestQuestion)
        }
      }
    }
  }

  const removeQuestion = async (id: string) => {
    const questionToRemove = questions.find(q => q.id === id)

    // Flash delete animation, then remove after animation completes
    flashQuestion(id, 'delete')

    const doRemove = async () => {
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

      setQuestions(prev => prev.filter(q => q.id !== id))
      
      // Also remove the question from questionLogic (including nested items)
      const removeFromLogic = (items: QuestionLogicItem[]): QuestionLogicItem[] => {
        const result: QuestionLogicItem[] = []
        for (const item of items) {
          if (item.type === 'question') {
            const localId = item.localQuestionId
            if (localId === id || (questionToRemove?.dbId != null && item.questionId != null && item.questionId === questionToRemove.dbId)) {
              continue
            }
          }
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

    // Delay removal to let the animation play
    setTimeout(doRemove, 400)
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
      id: crypto.randomUUID(),
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
    flashQuestion(newQuestion.id, 'add')

    const newLogicItem: QuestionLogicItem = {
      id: crypto.randomUUID(),
      type: 'question',
      questionId: undefined,
      depth: 0
    }

    ;newLogicItem.localQuestionId = newQuestion.id

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
      id: crypto.randomUUID(),
      question_text: '',
      question_type: 'free_text',
      identifier: '',
      repeatable: false,
      is_required: false,
      options: []
    }
    flashQuestion(newQuestion.id, 'add')

    const newLogicItem: QuestionLogicItem = {
      id: crypto.randomUUID(),
      type: 'question',
      questionId: undefined, // Will be set when question is saved
      depth: parentPath ? parentPath.length : 0
    }

    // Store the local question ID temporarily for matching
    ;newLogicItem.localQuestionId = newQuestion.id

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
      id: crypto.randomUUID(),
      type: 'question',
      questionId: undefined,
      depth: parentPath ? parentPath.length : 0
    }

    ;newLogicItem.localQuestionId = newQuestion.id

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
            const localId = item.localQuestionId
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
            const localId = item.localQuestionId
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
    // Mark as nested IMMEDIATELY so mainLevelQuestions filters it out
    nestedQuestionIdsRef.current.add(nestedQuestion.id)
    const conditionalDepth = parentPath ? parentPath.length : 0
    const nestedQuestionLogicItem: QuestionLogicItem = {
      id: crypto.randomUUID(),
      type: 'question',
      questionId: undefined,
      depth: conditionalDepth + 1  // Nested question is one level deeper than the conditional
    }
    ;nestedQuestionLogicItem.localQuestionId = nestedQuestion.id

    const newConditional: QuestionLogicItem = {
      id: crypto.randomUUID(),
      type: 'conditional',
      conditional: {
        ifIdentifier: previousQuestion?.identifier || '',
        value: '',
        nestedItems: [nestedQuestionLogicItem]
      },
      depth: conditionalDepth  // Conditional is at the same depth as its parent's nested items
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
  const insertNestedQuestionBeforeIndex = (beforeIndex: number, parentPath: number[], parentDepth: number) => {
    // Create the new question data
    const newQuestion: QuestionFormData = {
      id: crypto.randomUUID(),
      question_text: '',
      question_type: 'free_text',
      identifier: '',
      repeatable: false,
      is_required: false,
      options: []
    }

    // Mark as nested IMMEDIATELY so mainLevelQuestions filters it out before state updates settle
    nestedQuestionIdsRef.current.add(newQuestion.id)

    // Add to questions array
    setQuestions(prev => [...prev, newQuestion])
    flashQuestion(newQuestion.id, 'add')

    const newLogicItem: QuestionLogicItem = {
      id: crypto.randomUUID(),
      type: 'question',
      questionId: undefined,
      depth: parentDepth
    }

    ;newLogicItem.localQuestionId = newQuestion.id

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
      id: crypto.randomUUID(),
      type: 'question',
      questionId: undefined,
      depth: nestedQuestionDepth
    }
    ;nestedQuestionLogicItem.localQuestionId = nestedQuestionId

    const newConditional: QuestionLogicItem = {
      id: crypto.randomUUID(),
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

  const addConditionalToLogic = (afterIndex: number, parentPath?: number[], targetQuestion?: QuestionFormData, insertBeforeQuestion?: QuestionFormData) => {

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
            const localId = item.localQuestionId
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
            const localId = item.localQuestionId
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
    // Mark as nested IMMEDIATELY so mainLevelQuestions filters it out
    nestedQuestionIdsRef.current.add(nestedQuestion.id)
    const nestedQuestionId = nestedQuestion.id
    
    const nestedQuestionLogicItem: QuestionLogicItem = {
      id: crypto.randomUUID(),
      type: 'question',
      questionId: undefined,
      depth: (parentPath ? parentPath.length : 0) + 1
    }
    // Store the local question ID for reference
    ;nestedQuestionLogicItem.localQuestionId = nestedQuestionId

    const newConditional: QuestionLogicItem = {
      id: crypto.randomUUID(),
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
      // Add to root level
      setQuestionLogic(prevLogic => {
        let insertIndex: number
        if (insertBeforeQuestion) {
          // Find the target question's current position in prevLogic and insert right before it
          // Use isLogicItemForQuestion which handles localQuestionId AND questionId matching
          const targetIdx = prevLogic.findIndex(item =>
            item.type === 'question' && isLogicItemForQuestion(item, insertBeforeQuestion)
          )
          insertIndex = targetIdx >= 0 ? targetIdx : prevLogic.length
        } else {
          insertIndex = afterIndex >= 0 ? afterIndex + 1 : prevLogic.length
        }
        const newLogic = [...prevLogic.slice(0, insertIndex), newConditional, ...prevLogic.slice(insertIndex)]
        if (currentGroupId) saveQuestionLogic(newLogic, currentGroupId)
        return newLogic
      })
    }
  }

  const updateConditionalValue = (itemId: string, field: 'ifIdentifier' | 'value' | 'operator' | 'userOptIn', value: string | boolean) => {
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
    
    // Helper to collect all question IDs (both local and DB) from logic items for deletion
    const collectQuestionIds = (items: QuestionLogicItem[]): { localIds: Set<string>, dbIds: Set<number> } => {
      const localIds = new Set<string>()
      const dbIds = new Set<number>()
      for (const item of items) {
        if (item.type === 'question') {
          if (item.questionId) dbIds.add(item.questionId)
          const localId = item.localQuestionId
          if (localId) localIds.add(localId)
        }
        if (item.type === 'conditional' && item.conditional?.nestedItems) {
          const nested = collectQuestionIds(item.conditional.nestedItems)
          nested.localIds.forEach(id => localIds.add(id))
          nested.dbIds.forEach(id => dbIds.add(id))
        }
      }
      return { localIds, dbIds }
    }
    
    const removeItem = (items: QuestionLogicItem[]): QuestionLogicItem[] => {
      const result: QuestionLogicItem[] = []
      
      for (const item of items) {
        if (item.id === itemId) {
          // If this is a conditional being removed, delete all nested questions
          if (item.type === 'conditional' && item.conditional?.nestedItems) {
            const { localIds, dbIds } = collectQuestionIds(item.conditional.nestedItems)
            // Remove nested questions from the questions state
            // Match by local ID (q.id) or DB ID (q.dbId)
            setQuestions(prevQuestions => 
              prevQuestions.filter(q => !localIds.has(q.id) && !(q.dbId && dbIds.has(q.dbId)))
            )
            // Also delete from database
            for (const dbId of dbIds) {
              incrementPendingRequests()
              questionGroupService.deleteQuestion(dbId)
                .catch(err => console.error('Failed to delete nested question from database:', err))
                .finally(() => decrementPendingRequests())
            }
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
          const localId = item.localQuestionId
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
          const localId = item.localQuestionId
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

  // Helper: recursively update depth on a logic item and its nested children
  const updateItemDepths = (item: QuestionLogicItem, newDepth: number) => {
    item.depth = newDepth
    if (item.type === 'conditional' && item.conditional?.nestedItems) {
      for (const child of item.conditional.nestedItems) {
        updateItemDepths(child, newDepth + 1)
      }
    }
  }

  // Move a conditional (with all its nested items) one level up in the hierarchy
  const moveConditionalUpOneLevel = (conditionalIndex: number, parentPath: number[]) => {
    if (parentPath.length === 0) return // Already at root level

    const currentGroupId = savedGroupId

    setQuestionLogic(prev => {
      const updated = JSON.parse(JSON.stringify(prev)) as QuestionLogicItem[]

      // Navigate to the parent level (where the grandparent conditional lives)
      const lastPathIdx = parentPath[parentPath.length - 1]
      let parentLevel = updated
      for (let i = 0; i < parentPath.length - 1; i++) {
        parentLevel = parentLevel[parentPath[i]].conditional!.nestedItems
      }

      const parentConditional = parentLevel[lastPathIdx]
      if (!parentConditional?.conditional?.nestedItems) return prev

      const nestedItems = parentConditional.conditional.nestedItems
      if (conditionalIndex >= nestedItems.length) return prev

      const itemToMove = nestedItems[conditionalIndex]
      if (itemToMove.type !== 'conditional') return prev

      // If ifIdentifier is empty, resolve it from context before moving
      // (the rendering fallback changes when the conditional moves levels)
      if (itemToMove.conditional && !itemToMove.conditional.ifIdentifier) {
        // Find the previous question in the nested items to use as ifIdentifier
        for (let i = conditionalIndex - 1; i >= 0; i--) {
          if (nestedItems[i].type === 'question') {
            const localId = nestedItems[i].localQuestionId
            const qId = nestedItems[i].questionId
            const q = questions.find(q =>
              (localId != null && q.id === localId) ||
              (qId != null && q.dbId != null && q.dbId === qId)
            )
            if (q?.identifier) {
              itemToMove.conditional.ifIdentifier = q.identifier
            }
            break
          }
        }
        // If still empty, try the parent conditional's ifIdentifier
        if (!itemToMove.conditional.ifIdentifier && parentConditional.conditional?.ifIdentifier) {
          itemToMove.conditional.ifIdentifier = parentConditional.conditional.ifIdentifier
        }
      }

      // Remove from current nestedItems
      nestedItems.splice(conditionalIndex, 1)

      // Insert into parent level right after the parent conditional
      parentLevel.splice(lastPathIdx + 1, 0, itemToMove)

      // Update depth values for the moved item and all its children
      const newDepth = parentPath.length - 1
      updateItemDepths(itemToMove, newDepth)

      // If moved to root level, update nestedQuestionIdsRef for any questions inside
      if (parentPath.length === 1) {
        const removeNestedIds = (items: QuestionLogicItem[]) => {
          for (const item of items) {
            if (item.type === 'question' && item.localQuestionId) {
              nestedQuestionIdsRef.current.delete(item.localQuestionId)
            }
            if (item.conditional?.nestedItems) {
              removeNestedIds(item.conditional.nestedItems)
            }
          }
        }
        if (itemToMove.conditional?.nestedItems) {
          removeNestedIds(itemToMove.conditional.nestedItems)
        }
      }

      if (currentGroupId) {
        saveQuestionLogic(updated, currentGroupId)
      }
      return updated
    })
  }

  // Move a conditional one level RIGHT (into the nearest conditional above it on the same level)
  const moveConditionalRight = (itemIndex: number, parentPath?: number[]) => {
    const currentGroupId = savedGroupId

    setQuestionLogic(prev => {
      const updated = JSON.parse(JSON.stringify(prev)) as QuestionLogicItem[]

      // Navigate to the current level
      let currentLevel = updated
      if (parentPath && parentPath.length > 0) {
        for (let i = 0; i < parentPath.length; i++) {
          const cond = currentLevel[parentPath[i]]
          if (!cond?.conditional?.nestedItems) return prev
          currentLevel = cond.conditional.nestedItems
        }
      }

      if (itemIndex >= currentLevel.length) return prev

      // Find the nearest conditional ABOVE this item on the same level
      let targetConditionalIndex = -1
      for (let i = itemIndex - 1; i >= 0; i--) {
        if (currentLevel[i].type === 'conditional') {
          targetConditionalIndex = i
          break
        }
      }

      if (targetConditionalIndex === -1) return prev

      const itemToMove = currentLevel[itemIndex]
      const targetConditional = currentLevel[targetConditionalIndex]

      // If ifIdentifier is empty, resolve it from context before moving
      if (itemToMove.conditional && !itemToMove.conditional.ifIdentifier) {
        for (let i = itemIndex - 1; i >= 0; i--) {
          if (currentLevel[i].type === 'question') {
            const localId = currentLevel[i].localQuestionId
            const qId = currentLevel[i].questionId
            const q = questions.find(q =>
              (localId != null && q.id === localId) ||
              (qId != null && q.dbId != null && q.dbId === qId)
            )
            if (q?.identifier) {
              itemToMove.conditional.ifIdentifier = q.identifier
            }
            break
          }
        }
      }

      // Remove from current level
      currentLevel.splice(itemIndex, 1)

      // Append to target conditional's nestedItems
      if (!targetConditional.conditional!.nestedItems) {
        targetConditional.conditional!.nestedItems = []
      }
      targetConditional.conditional!.nestedItems.push(itemToMove)

      // Update depth values for the moved item and all its children
      const newDepth = (parentPath ? parentPath.length : 0) + 1
      updateItemDepths(itemToMove, newDepth)

      // If moving from root level into a conditional, mark all nested questions as nested
      if ((!parentPath || parentPath.length === 0) && itemToMove.conditional?.nestedItems) {
        const addNestedIds = (items: QuestionLogicItem[]) => {
          for (const item of items) {
            if (item.type === 'question' && item.localQuestionId) {
              nestedQuestionIdsRef.current.add(item.localQuestionId)
            }
            if (item.conditional?.nestedItems) {
              addNestedIds(item.conditional.nestedItems)
            }
          }
        }
        addNestedIds(itemToMove.conditional.nestedItems)
      }

      if (currentGroupId) {
        saveQuestionLogic(updated, currentGroupId)
      }
      return updated
    })
  }

  // Move a question one level LEFT (out of its current conditional, placed after the conditional in the parent level)
  const moveQuestionLeft = (itemIndex: number, parentPath: number[]) => {
    if (parentPath.length === 0) return // Already at root level

    const currentGroupId = savedGroupId

    setQuestionLogic(prev => {
      const updated = JSON.parse(JSON.stringify(prev)) as QuestionLogicItem[]

      // Navigate to the parent conditional
      const lastPathIdx = parentPath[parentPath.length - 1]
      let parentLevel = updated
      for (let i = 0; i < parentPath.length - 1; i++) {
        parentLevel = parentLevel[parentPath[i]].conditional!.nestedItems
      }

      const parentConditional = parentLevel[lastPathIdx]
      if (!parentConditional?.conditional?.nestedItems) return prev

      const nestedItems = parentConditional.conditional.nestedItems
      if (itemIndex >= nestedItems.length) return prev

      const itemToMove = nestedItems[itemIndex]

      // Remove from current nestedItems
      nestedItems.splice(itemIndex, 1)

      // Insert into parent level right after the parent conditional
      parentLevel.splice(lastPathIdx + 1, 0, itemToMove)

      // Update depth for the moved item
      const newDepth = parentPath.length - 1
      updateItemDepths(itemToMove, newDepth)

      // If moved to root level, update nestedQuestionIdsRef
      if (parentPath.length === 1 && itemToMove.type === 'question' && itemToMove.localQuestionId) {
        nestedQuestionIdsRef.current.delete(itemToMove.localQuestionId)
      }

      if (currentGroupId) {
        saveQuestionLogic(updated, currentGroupId)
      }
      return updated
    })
  }

  // Move a question one level RIGHT (into the nearest conditional above it on the same level)
  // For root-level: logicIndex is the index in questionLogic, parentPath is undefined
  // For nested: logicIndex is the index in the nestedItems array, parentPath is the path to navigate
  const moveQuestionRight = (itemIndex: number, parentPath?: number[]) => {
    const currentGroupId = savedGroupId

    setQuestionLogic(prev => {
      const updated = JSON.parse(JSON.stringify(prev)) as QuestionLogicItem[]

      // Navigate to the current level
      let currentLevel = updated
      if (parentPath && parentPath.length > 0) {
        for (let i = 0; i < parentPath.length; i++) {
          const cond = currentLevel[parentPath[i]]
          if (!cond?.conditional?.nestedItems) return prev
          currentLevel = cond.conditional.nestedItems
        }
      }

      if (itemIndex >= currentLevel.length) return prev

      // Find the nearest conditional ABOVE this item on the same level
      let targetConditionalIndex = -1
      for (let i = itemIndex - 1; i >= 0; i--) {
        if (currentLevel[i].type === 'conditional') {
          targetConditionalIndex = i
          break
        }
      }

      if (targetConditionalIndex === -1) return prev // No conditional above

      const itemToMove = currentLevel[itemIndex]
      const targetConditional = currentLevel[targetConditionalIndex]

      // Remove from current level
      currentLevel.splice(itemIndex, 1)

      // Append to target conditional's nestedItems
      if (!targetConditional.conditional!.nestedItems) {
        targetConditional.conditional!.nestedItems = []
      }
      targetConditional.conditional!.nestedItems.push(itemToMove)

      // Update depth for the moved item
      const newDepth = (parentPath ? parentPath.length : 0) + 1
      updateItemDepths(itemToMove, newDepth)

      // If moving from root level into a conditional, update nestedQuestionIdsRef
      if ((!parentPath || parentPath.length === 0) && itemToMove.type === 'question' && itemToMove.localQuestionId) {
        nestedQuestionIdsRef.current.add(itemToMove.localQuestionId)
      }

      if (currentGroupId) {
        saveQuestionLogic(updated, currentGroupId)
      }
      return updated
    })
  }

  // Check if a question can move RIGHT (is there a conditional above it on the same level?)
  const canMoveQuestionRight = (itemIndex: number, parentPath?: number[]): boolean => {
    let currentLevel = questionLogic
    if (parentPath && parentPath.length > 0) {
      for (let i = 0; i < parentPath.length; i++) {
        const cond = currentLevel[parentPath[i]]
        if (!cond?.conditional?.nestedItems) return false
        currentLevel = cond.conditional.nestedItems
      }
    }
    // Look for a conditional before this item
    for (let i = itemIndex - 1; i >= 0; i--) {
      if (currentLevel[i].type === 'conditional') return true
    }
    return false
  }

  // Helper to collect all nested question IDs from conditionals
  const getNestedQuestionIds = (items: QuestionLogicItem[]): Set<string> => {
    const nestedIds = new Set<string>()

    const collectIds = (logicItems: QuestionLogicItem[], isNested: boolean) => {
      logicItems.forEach(item => {
        // If we're inside a conditional's nestedItems, track all questions
        if (isNested && item.type === 'question') {
          const localId = item.localQuestionId
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
    if (depth > 10) return null // Max 10 levels of nesting

    // Filter to only items that have valid questions, and track their display index
    let questionDisplayIndex = 0
    let conditionalDisplayIndex = 0

    // Helper: recursively check if a logic item (or its nested children) contains
    // a question belonging to a specific repeatable group
    const itemContainsGroupMember = (logicItem: QuestionLogicItem, groupId: string): boolean => {
      if (logicItem.type === 'question') {
        const q = getQuestionFromLogicItem(logicItem)
        return !!(q?.repeatable && q.repeatable_group_id === groupId)
      }
      if (logicItem.type === 'conditional' && logicItem.conditional) {
        // Check if this conditional is triggered by a question in the group
        const triggerIdentifier = logicItem.conditional.ifIdentifier
        if (triggerIdentifier) {
          const triggerQ = questions.find(q => q.identifier === triggerIdentifier)
          if (triggerQ?.repeatable && triggerQ.repeatable_group_id === groupId) return true
        }
        // Also check nested items
        if (logicItem.conditional.nestedItems) {
          return logicItem.conditional.nestedItems.some(ni => itemContainsGroupMember(ni, groupId))
        }
      }
      return false
    }

    // Helper: collect all repeatable group IDs from nested items (recursively through conditionals)
    const collectGroupIds = (items: QuestionLogicItem[]): Set<string> => {
      const ids = new Set<string>()
      for (const ni of items) {
        if (ni.type === 'question') {
          const nq = getQuestionFromLogicItem(ni)
          if (nq?.repeatable && nq.repeatable_group_id) ids.add(nq.repeatable_group_id)
        } else if (ni.type === 'conditional' && ni.conditional?.nestedItems) {
          for (const id of collectGroupIds(ni.conditional.nestedItems)) ids.add(id)
        }
      }
      return ids
    }

    // Build repeatable group color map for nested questions (including inside conditionals)
    const nestedRepeatableColors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#0891b2', '#06b6d4']
    const nestedGroupColorMap = new Map<string, string>()
    let nestedColorIdx = 0
    for (const gid of collectGroupIds(nestedItems)) {
      if (!nestedGroupColorMap.has(gid)) {
        nestedGroupColorMap.set(gid, nestedRepeatableColors[nestedColorIdx % nestedRepeatableColors.length])
        nestedColorIdx++
      }
    }

    // Build ordered list of question-type items for neighbor lookups
    const nestedQuestionItems: { itemIndex: number; question: QuestionFormData }[] = []
    for (let ni = 0; ni < nestedItems.length; ni++) {
      if (nestedItems[ni].type === 'question') {
        const nq = getQuestionFromLogicItem(nestedItems[ni])
        if (nq) nestedQuestionItems.push({ itemIndex: ni, question: nq })
      }
    }

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

        // Find previous question in the same nested context for repeatable group detection
        const prevNestedQuestionItem = nestedItems.slice(0, itemIndex).reverse().find(i => i.type === 'question')
        const prevNestedQuestionData = prevNestedQuestionItem ? getQuestionFromLogicItem(prevNestedQuestionItem) : null

        // Check if previous item is a conditional with nested items
        const prevItem = itemIndex > 0 ? nestedItems[itemIndex - 1] : null
        const prevIsConditional = prevItem?.type === 'conditional'
        
        // Repeatable group bracket info for nested questions
        // Check across conditional boundaries (not just direct question siblings)
        const nestedGroupId = nestedQuestion.repeatable && nestedQuestion.repeatable_group_id ? nestedQuestion.repeatable_group_id : null
        const nestedGroupColor = nestedGroupId ? nestedGroupColorMap.get(nestedGroupId) || null : null
        // Check if any previous item (question or conditional containing group member) is in same group
        let prevNestedInGroup = false
        if (nestedGroupId) {
          for (let pi = itemIndex - 1; pi >= 0; pi--) {
            if (itemContainsGroupMember(nestedItems[pi], nestedGroupId)) { prevNestedInGroup = true; break }
            // Stop if we hit a question NOT in the group (gap breaks the bracket)
            if (nestedItems[pi].type === 'question') {
              const pq = getQuestionFromLogicItem(nestedItems[pi])
              if (!pq?.repeatable || pq.repeatable_group_id !== nestedGroupId) break
            }
          }
        }
        // Check if any subsequent item (question or conditional containing group member) is in same group
        let nextNestedInGroup = false
        if (nestedGroupId) {
          for (let si = itemIndex + 1; si < nestedItems.length; si++) {
            if (itemContainsGroupMember(nestedItems[si], nestedGroupId)) { nextNestedInGroup = true; break }
            if (nestedItems[si].type === 'question') {
              const sq = getQuestionFromLogicItem(nestedItems[si])
              if (!sq?.repeatable || sq.repeatable_group_id !== nestedGroupId) break
            }
          }
        }

        return (
          <div key={item.id} style={{ marginBottom: '1rem', position: 'relative' }}>
            {/* Repeatable group bracket for nested questions */}
            {nestedGroupColor && (
              <div style={{
                position: 'absolute',
                left: '-8px',
                top: prevNestedInGroup ? '-8px' : '28px',
                bottom: nextNestedInGroup ? '-8px' : '12px',
                width: '8px',
                borderLeft: `3px solid ${nestedGroupColor}`,
                borderTop: !prevNestedInGroup ? `3px solid ${nestedGroupColor}` : 'none',
                borderBottom: !nextNestedInGroup ? `3px solid ${nestedGroupColor}` : 'none',
                borderRight: 'none',
                borderRadius: !prevNestedInGroup && !nextNestedInGroup ? '4px 0 0 4px'
                  : !prevNestedInGroup ? '4px 0 0 0'
                  : !nextNestedInGroup ? '0 0 0 4px'
                  : '0',
                zIndex: 1
              }} />
            )}
            {/* Nested Question Block */}
            <div style={{
              padding: '1rem',
              border: `1px solid ${getDepthBorderColor(depth)}`,
              borderRadius: '0.5rem',
              backgroundColor: getDepthBackgroundColor(depth),
              ...(flashingQuestions.has(nestedQuestion.id) ? {
                animation: flashingQuestions.get(nestedQuestion.id) === 'add'
                  ? 'flash-add 0.8s ease-out forwards'
                  : 'flash-delete 0.4s ease-out forwards'
              } : {})
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: collapsedItems.has(`nq-${nestedQuestion.id}`) ? 0 : '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, cursor: 'pointer' }} onClick={() => toggleCollapsed(`nq-${nestedQuestion.id}`)}>
                  <span style={{ fontSize: '0.6rem', flexShrink: 0, color: '#6b7280' }}>{collapsedItems.has(`nq-${nestedQuestion.id}`) ? '\u25B6' : '\u25BC'}</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: getDepthTextColor(depth) }}>
                    Nested Question ({questionNumber})
                  </span>
                  {collapsedItems.has(`nq-${nestedQuestion.id}`) && (
                    <div style={{ marginLeft: '0.25rem' }}>{renderQuestionSummary(nestedQuestion, prevNestedQuestionData)}</div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                {/* Left arrow - move question out of conditional (up one level) */}
                {parentPath.length > 0 && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); moveQuestionLeft(itemIndex, parentPath) }}
                    style={{
                      background: 'none',
                      border: '1px solid #9ca3af',
                      borderRadius: '0.25rem',
                      padding: '0.15rem 0.25rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#6b7280'
                    }}
                    title="Move question one level left (out of conditional)"
                  >
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '0.85rem', height: '0.85rem' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
                {/* Right arrow - move question into nearest conditional above */}
                {canMoveQuestionRight(itemIndex, parentPath) && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); moveQuestionRight(itemIndex, parentPath) }}
                    style={{
                      background: 'none',
                      border: '1px solid #9ca3af',
                      borderRadius: '0.25rem',
                      padding: '0.15rem 0.25rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#6b7280'
                    }}
                    title="Move question one level right (into conditional above)"
                  >
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '0.85rem', height: '0.85rem' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    // Flash delete animation first
                    flashQuestion(nestedQuestion.id, 'delete')

                    setTimeout(async () => {
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
                            if (logicItem.id === item.id) {
                              return false
                            }
                            return true
                          }).map(logicItem => {
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
                    }, 400)
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
              </div>

              {!collapsedItems.has(`nq-${nestedQuestion.id}`) && <>
              {/* Identifier */}
              <div className="form-group">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                  <label style={{ margin: 0, whiteSpace: 'nowrap', fontSize: '0.875rem', fontWeight: 600, color: '#374151', lineHeight: 1 }}>Identifier *</label>
                  {(() => {
                    // Find the previous repeatable question within this nested context (same nesting level only)
                    let prevRepeatableNestedQuestion: QuestionFormData | null = null
                    let hasPrevSiblingQuestion = false
                    for (let i = itemIndex - 1; i >= 0; i--) {
                      const prevItem = nestedItems[i]
                      if (prevItem.type === 'question') {
                        hasPrevSiblingQuestion = true
                        const q = getQuestionFromLogicItem(prevItem)
                        if (q?.repeatable) {
                          prevRepeatableNestedQuestion = q
                        }
                        break // Stop at the first question we find
                      }
                    }

                    // Only show Join/Not Repeatable/Start New radio buttons if there's a
                    // previous sibling question at this nesting level to join with.
                    // If this is the first question in a conditional (no siblings), only show checkbox.
                    if (hasPrevSiblingQuestion && prevRepeatableNestedQuestion) {
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.875rem', color: '#374151' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                            <input
                              type="radio"
                              name={`repeatable-${nestedQuestion.id}`}
                              checked={!nestedQuestion.repeatable}
                              onChange={() => {
                                updateQuestionFields(nestedQuestion.id, { repeatable: false, repeatable_group_id: undefined })
                              }}
                            />
                            Not Repeatable
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                            <input
                              type="radio"
                              name={`repeatable-${nestedQuestion.id}`}
                              checked={nestedQuestion.repeatable && nestedQuestion.repeatable_group_id === prevRepeatableNestedQuestion?.repeatable_group_id}
                              onChange={() => {
                                updateQuestionFields(nestedQuestion.id, { repeatable: true, repeatable_group_id: prevRepeatableNestedQuestion?.repeatable_group_id || prevRepeatableNestedQuestion?.id })
                              }}
                            />
                            Join Repeatable Group
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                            <input
                              type="radio"
                              name={`repeatable-${nestedQuestion.id}`}
                              checked={nestedQuestion.repeatable && nestedQuestion.repeatable_group_id !== prevRepeatableNestedQuestion?.repeatable_group_id && nestedQuestion.repeatable_group_id !== undefined}
                              onChange={() => {
                                updateQuestionFields(nestedQuestion.id, { repeatable: true, repeatable_group_id: nestedQuestion.id })
                              }}
                            />
                            Start New Repeatable Group
                          </label>
                        </div>
                      )
                    } else {
                      // First/only question in a conditional — show checkbox to start its own repeatable group
                      return (
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem', color: '#374151', margin: 0, lineHeight: 1, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={nestedQuestion.repeatable}
                            onChange={(e) => {
                              if (e.target.checked) {
                                updateQuestionFields(nestedQuestion.id, {
                                  repeatable: true,
                                  repeatable_group_id: nestedQuestion.id
                                })
                              } else {
                                updateQuestionFields(nestedQuestion.id, { repeatable: false, repeatable_group_id: undefined })
                              }
                            }}
                            style={{ margin: 0 }}
                          />
                          Start New Repeatable Group
                        </label>
                      )
                    }
                  })()}
                </div>
                <input
                  type="text"
                  value={nestedQuestion.identifier}
                  onChange={(e) => { updateQuestion(nestedQuestion.id, 'identifier', e.target.value); clearValidationError(`q-identifier-${nestedQuestion.id}`) }}
                  onBlur={(e) => updateQuestion(nestedQuestion.id, 'identifier', e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                  className="form-input"
                  style={{ borderColor: validationErrors.has(`q-identifier-${nestedQuestion.id}`) ? '#dc2626' : undefined }}
                  placeholder="e.g., nested_field"
                />
              </div>

              {/* Question Text */}
              <div className="question-text-section">
                <label className="form-label">Question Text *</label>
                <textarea
                  value={nestedQuestion.question_text}
                  onChange={(e) => { updateQuestion(nestedQuestion.id, 'question_text', e.target.value); clearValidationError(`q-text-${nestedQuestion.id}`) }}
                  className="form-textarea"
                  style={{ borderColor: validationErrors.has(`q-text-${nestedQuestion.id}`) ? '#dc2626' : undefined }}
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

                <div className="question-options-panel">
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
              </>}

              {/* Insert buttons at bottom of expanded nested question */}
              {!collapsedItems.has(`nq-${nestedQuestion.id}`) && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '0.5rem',
                marginTop: '0.75rem',
                marginBottom: '0.25rem'
              }}>
                <button
                  type="button"
                  onClick={() => insertNestedQuestionBeforeIndex(itemIndex + 1, parentPath, depth)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.2rem 0.5rem',
                    fontSize: '0.65rem',
                    background: 'white',
                    color: '#2563eb',
                    border: '1px dashed #2563eb',
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
                <button
                  type="button"
                  onClick={() => {
                    addConditionalToLogicAtIndex(itemIndex, parentPath, nestedQuestion)
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
              </div>
              )}
            </div>

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

        // Conditionals with nested items should be rendered one level deeper
        // to visually distinguish them from questions at the same level
        const conditionalDepth = item.conditional?.nestedItems && item.conditional.nestedItems.length > 0 
          ? depth + 1 
          : depth
        
        // Check if this conditional is part of a repeatable group bracket
        // (i.e., it contains group members and is adjacent to group members)
        let conditionalBracketGroupId: string | null = null
        let conditionalBracketColor: string | null = null
        let condPrevInGroup = false
        let condNextInGroup = false
        // Find which group this conditional belongs to (if it contains a group member)
        for (const [gid] of nestedGroupColorMap) {
          if (itemContainsGroupMember(item, gid)) {
            // Check if a previous item is also in this group
            let hasPrev = false
            for (let pi = itemIndex - 1; pi >= 0; pi--) {
              if (itemContainsGroupMember(nestedItems[pi], gid)) { hasPrev = true; break }
              if (nestedItems[pi].type === 'question') {
                const pq = getQuestionFromLogicItem(nestedItems[pi])
                if (!pq?.repeatable || pq.repeatable_group_id !== gid) break
              }
            }
            // Check if a subsequent item is also in this group
            let hasNext = false
            for (let si = itemIndex + 1; si < nestedItems.length; si++) {
              if (itemContainsGroupMember(nestedItems[si], gid)) { hasNext = true; break }
              if (nestedItems[si].type === 'question') {
                const sq = getQuestionFromLogicItem(nestedItems[si])
                if (!sq?.repeatable || sq.repeatable_group_id !== gid) break
              }
            }
            if (hasPrev || hasNext) {
              conditionalBracketGroupId = gid
              conditionalBracketColor = nestedGroupColorMap.get(gid) || null
              condPrevInGroup = hasPrev
              condNextInGroup = hasNext
              break
            }
          }
        }

        return (
          <div key={item.id} style={{ position: 'relative' }}>
          <div className="conditional-block" style={{
            marginBottom: '1rem',
            marginLeft: '2rem',
            padding: '1rem',
            position: 'relative',
            border: `1px solid ${getDepthBorderColor(conditionalDepth)}`,
            borderRadius: '0.5rem',
            backgroundColor: getDepthBackgroundColor(conditionalDepth)
          }}>
            {/* Repeatable group bracket continuation on conditional */}
            {conditionalBracketColor && (
              <div style={{
                position: 'absolute',
                left: 'calc(-2rem - 8px)',
                top: condPrevInGroup ? '-1rem' : '0',
                bottom: condNextInGroup ? '-1rem' : '12px',
                width: '8px',
                borderLeft: `3px solid ${conditionalBracketColor}`,
                borderTop: 'none',
                borderBottom: !condNextInGroup ? `3px solid ${conditionalBracketColor}` : 'none',
                borderRight: 'none',
                borderRadius: !condNextInGroup ? '0 0 0 4px' : '0',
                zIndex: 1
              }} />
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: collapsedItems.has(`nc-${item.id}`) ? 0 : '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, cursor: 'pointer' }} onClick={() => toggleCollapsed(`nc-${item.id}`)}>
                <span style={{ fontSize: '0.6rem', flexShrink: 0, color: '#6b7280' }}>{collapsedItems.has(`nc-${item.id}`) ? '\u25B6' : '\u25BC'}</span>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: getDepthTextColor(conditionalDepth) }}>
                  Conditional ({conditionalNumber})
                </div>
                {collapsedItems.has(`nc-${item.id}`) && (
                  <div style={{ marginLeft: '0.25rem' }}>{renderConditionalSummary(item)}</div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                {/* Left arrow - move conditional out of parent (up one level) */}
                {parentPath.length > 0 && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); moveConditionalUpOneLevel(itemIndex, parentPath) }}
                    style={{
                      background: 'none',
                      border: '1px solid #9ca3af',
                      borderRadius: '0.25rem',
                      padding: '0.15rem 0.25rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#6b7280'
                    }}
                    title="Move conditional one level left (out of parent)"
                  >
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '0.85rem', height: '0.85rem' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
                {/* Right arrow - move conditional into nearest conditional above */}
                {canMoveQuestionRight(itemIndex, parentPath) && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); moveConditionalRight(itemIndex, parentPath) }}
                    style={{
                      background: 'none',
                      border: '1px solid #9ca3af',
                      borderRadius: '0.25rem',
                      padding: '0.15rem 0.25rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#6b7280'
                    }}
                    title="Move conditional one level right (into conditional above)"
                  >
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '0.85rem', height: '0.85rem' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
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
            </div>

            {!collapsedItems.has(`nc-${item.id}`) && <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
                          <option value="any_equals">if any equals</option>
                          <option value="none_equals">if none equals</option>
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
                  Value *
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
                        onChange={(e) => { updateConditionalValue(item.id, 'value', e.target.value); clearValidationError(`c-value-${item.id}`) }}
                        className="form-input"
                        style={{ fontSize: '0.8rem', width: '80px', borderColor: validationErrors.has(`c-value-${item.id}`) ? '#dc2626' : undefined }}
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
                        onChange={(e) => { updateConditionalValue(item.id, 'value', e.target.value); clearValidationError(`c-value-${item.id}`) }}
                        className="form-input"
                        style={{ fontSize: '0.8rem', borderColor: validationErrors.has(`c-value-${item.id}`) ? '#dc2626' : undefined }}
                      />
                    )
                  } else if (isChoiceType && selectedQuestion?.options) {
                    return (
                      <select
                        value={item.conditional.value || ''}
                        onChange={(e) => { updateConditionalValue(item.id, 'value', e.target.value); clearValidationError(`c-value-${item.id}`) }}
                        className="form-select"
                        style={{ fontSize: '0.8rem', borderColor: validationErrors.has(`c-value-${item.id}`) ? '#dc2626' : undefined }}
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
                        onChange={(e) => { updateConditionalValue(item.id, 'value', e.target.value); clearValidationError(`c-value-${item.id}`) }}
                        className="form-input"
                        style={{ fontSize: '0.8rem', borderColor: validationErrors.has(`c-value-${item.id}`) ? '#dc2626' : undefined }}
                        placeholder="Type person name..."
                      />
                    )
                  } else {
                    return (
                      <input
                        type="text"
                        value={item.conditional.value || ''}
                        onChange={(e) => { updateConditionalValue(item.id, 'value', e.target.value); clearValidationError(`c-value-${item.id}`) }}
                        className="form-input"
                        style={{ fontSize: '0.8rem', borderColor: validationErrors.has(`c-value-${item.id}`) ? '#dc2626' : undefined }}
                        placeholder="Enter value"
                      />
                    )
                  }
                })()}
              </div>


            </div>}

          {/* Insert buttons after Value dropdown, before nested items */}
          {!collapsedItems.has(`nc-${item.id}`) && <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '0.5rem',
            marginTop: '0.25rem',
            marginBottom: '0.25rem'
          }}>
            <button
              type="button"
              onClick={() => insertNestedQuestionBeforeIndex(item.conditional?.nestedItems?.length || 0, currentPath, depth + 1)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.2rem 0.5rem',
                fontSize: '0.65rem',
                background: 'white',
                color: '#2563eb',
                border: '1px dashed #2563eb',
                borderRadius: '0.25rem',
                cursor: 'pointer',
                opacity: 0.7,
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
              title="Insert a question inside this conditional"
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '0.65rem', height: '0.65rem' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Insert Question
            </button>
            <button
              type="button"
              onClick={() => {
                // Find last question inside this conditional to use as ifIdentifier
                const nestedLen = item.conditional?.nestedItems?.length || 0
                let lastQ: QuestionFormData | undefined
                if (item.conditional?.nestedItems) {
                  for (let i = nestedLen - 1; i >= 0; i--) {
                    const ni = item.conditional.nestedItems[i]
                    if (ni.type === 'question') {
                      lastQ = questions.find(q =>
                        q.id === ni.localQuestionId || q.dbId === ni.questionId
                      )
                      break
                    }
                  }
                }
                if (!lastQ) lastQ = parentQuestion
                addConditionalToLogicAtIndex(nestedLen > 0 ? nestedLen - 1 : 0, currentPath, lastQ)
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
              title="Insert a conditional after this conditional"
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '0.65rem', height: '0.65rem' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Insert Conditional
            </button>
          </div>}

              {/* Nested items - always visible even when conditional is collapsed */}
              {item.conditional.nestedItems && item.conditional.nestedItems.length > 0 && (
                <div style={{ marginTop: collapsedItems.has(`nc-${item.id}`) ? '0.25rem' : '0.5rem' }}>
                  {renderNestedItems(item.conditional.nestedItems, currentPath, depth + 1, prevNestedQuestion, conditionalNumber)}
                </div>
              )}

          </div>
          </div>
        )
      }
      return null
    })
  }

  const handleSaveGroupInfo = async () => {
    if (!name) {
      toast('Please provide a name', 'warning')
      return
    }

    if (!isNameUnique) {
      toast('A question group with this name already exists. Please use a unique name.', 'warning')
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
      toast(err.response?.data?.detail || 'Failed to save question group')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSaveQuestion = async (question: QuestionFormData, index: number) => {
    if (!savedGroupId) return

    if (!question.question_text || !question.identifier) {
      toast('Please provide question text and identifier', 'warning')
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
      toast('Question saved successfully', 'success')
    } catch (err: any) {
      toast(err.response?.data?.detail || 'Failed to save question')
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

  // Wrap navigate to validate first
  const navigateWithValidation = (path: string) => {
    if (questions.length > 0 && !validateForm()) {
      return
    }
    setValidationErrors(new Set())
    setValidationMessage('')
    navigate(path)
  }

  return (
    <QGContainer>
      {validationMessage && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '0.5rem',
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <svg fill="none" stroke="#dc2626" viewBox="0 0 24 24" style={{ width: '1.25rem', height: '1.25rem', flexShrink: 0 }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <span style={{ color: '#dc2626', fontSize: '0.875rem', fontWeight: 500 }}>{validationMessage}</span>
          <button
            onClick={() => { setValidationMessage(''); setValidationErrors(new Set()) }}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1 }}
          >&times;</button>
        </div>
      )}
      <button
        type="button"
        onClick={() => navigateWithValidation('/admin/question-groups')}
        style={{
          background: 'none',
          border: 'none',
          color: '#6b7280',
          cursor: 'pointer',
          fontSize: '0.875rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.25rem 0',
          marginBottom: '0.5rem'
        }}
      >
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '1rem', height: '1rem' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Question Groups
      </button>
      <QGHeader>
        <div>
          <QGTitle>{isEditMode ? 'Edit Question Group' : 'Create Question Group'}</QGTitle>
          <QGSubtitle>
            {isEditMode ? 'Update the question group information and questions' : 'Create a new question group'}
          </QGSubtitle>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {groupInfoSaved && questionLogic.length > 0 && (
            <button
              type="button"
              onClick={() => setShowGraph(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.35rem',
                padding: '0.4rem 0.75rem', fontSize: '0.8rem', fontWeight: 600,
                background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd',
                borderRadius: '0.375rem', cursor: 'pointer'
              }}
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '1rem', height: '1rem' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
              View Graph
            </button>
          )}
          {!groupInfoSaved && (
            <CreateButton
              onClick={handleSaveGroupInfo}
              disabled={(!isNameUnique && !isEditMode) || submitting}
              style={{ opacity: (isNameUnique || isEditMode) && !submitting ? 1 : 0.5, cursor: (isNameUnique || isEditMode) && !submitting ? 'pointer' : 'not-allowed' }}
            >
              <ButtonIcon fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </ButtonIcon>
              {isEditMode ? 'Update Group Information' : 'Create Question Group'}
            </CreateButton>
          )}
        </div>
      </QGHeader>

      {showGraph && (
        <QuestionGroupGraph
          questionLogic={questionLogic}
          questions={questions.map(q => ({
            id: q.id,
            dbId: q.dbId,
            question_text: q.question_text,
            identifier: q.identifier,
            question_type: q.question_type,
            is_required: q.is_required
          }))}
          groupName={name || 'Untitled'}
          onClose={() => setShowGraph(false)}
        />
      )}

      <QGForm>
        <FormSection>
          <FormSectionTitle>Group Information</FormSectionTitle>

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

          <FormGroupDescription style={{ maxWidth: '50%' }}>
            <label className="form-label">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="form-textarea"
              rows={3}
            />
          </FormGroupDescription>

          {!groupInfoSaved && (
            <div style={{ marginTop: '1rem' }}>
              <SubmitButton
                type="button"
                onClick={handleSaveGroupInfo}
                disabled={(!isNameUnique && !isEditMode) || submitting}
                style={{ opacity: (isNameUnique || isEditMode) && !submitting ? 1 : 0.5, cursor: (isNameUnique || isEditMode) && !submitting ? 'pointer' : 'not-allowed' }}
              >
                {submitting ? 'Saving...' : (isEditMode ? 'Update Group Information' : 'Save Group Information')}
              </SubmitButton>
            </div>
          )}
        </FormSection>

        {groupInfoSaved && (
          <FormSection>
            <FormSectionHeader style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <FormSectionTitle style={{ marginBottom: 0 }}>Questions</FormSectionTitle>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={expandAll}
                  style={{
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.7rem',
                    background: 'white',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.25rem',
                    cursor: 'pointer'
                  }}
                >
                  Expand All
                </button>
                <button
                  type="button"
                  onClick={collapseAll}
                  style={{
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.7rem',
                    background: 'white',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.25rem',
                    cursor: 'pointer'
                  }}
                >
                  Collapse All
                </button>
              </div>
            </FormSectionHeader>

          {(() => {
            // Build group color map
            const repeatableGroupColors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#0891b2', '#06b6d4']
            const groupColorMap = new Map<string, string>()
            let colorIdx = 0
            for (const q of mainLevelQuestions) {
              if (q.repeatable && q.repeatable_group_id && !groupColorMap.has(q.repeatable_group_id)) {
                groupColorMap.set(q.repeatable_group_id, repeatableGroupColors[colorIdx % repeatableGroupColors.length])
                colorIdx++
              }
            }

            return mainLevelQuestions.map((question, qIndex) => {
            // Find the logic index for this question to use for insertion
            const logicIndex = questionLogic.findIndex(item =>
              item.type === 'question' &&
              isLogicItemForQuestion(item, question)
            )

            const isCollapsed = collapsedItems.has(`q-${question.id}`)
            const prevQuestion = qIndex > 0 ? mainLevelQuestions[qIndex - 1] : null
            const prevIsCollapsed = prevQuestion ? collapsedItems.has(`q-${prevQuestion.id}`) : false

            // Repeatable group bracket info
            const groupId = question.repeatable && question.repeatable_group_id ? question.repeatable_group_id : null
            const groupColor = groupId ? groupColorMap.get(groupId) || '#3b82f6' : null
            const prevInSameGroup = prevQuestion?.repeatable && prevQuestion?.repeatable_group_id === groupId && groupId !== null
            const nextQuestion = qIndex < mainLevelQuestions.length - 1 ? mainLevelQuestions[qIndex + 1] : null
            const nextInSameGroup = nextQuestion?.repeatable && nextQuestion?.repeatable_group_id === groupId && groupId !== null

            // Pre-compute conditionals following this question (split by join/no-join)
            const conditionalsAfterThisQ: { item: QuestionLogicItem; idx: number }[] = []
            if (logicIndex >= 0) {
              for (let ci = logicIndex + 1; ci < questionLogic.length; ci++) {
                const qliTmp = questionLogic[ci]
                if (qliTmp.type === 'question') break
                if (qliTmp.type === 'conditional') conditionalsAfterThisQ.push({ item: qliTmp, idx: ci })
              }
            }
            const renderConditionalBlockFn = (logicItem: QuestionLogicItem, logicIndex: number, condIndex: number): React.ReactNode => {
                  // Use stored depth if available, otherwise default to 0 for root-level conditionals
                  const conditionalDepth = logicItem.depth !== undefined ? logicItem.depth : 0
                  
                  return (
                    <React.Fragment key={logicItem.id}>
                    <div className="conditional-block" style={{
                      marginTop: '0.5rem',
                      padding: '1rem 1.5rem',
                      border: `1px solid ${getDepthBorderColor(conditionalDepth)}`,
                      borderRadius: '0.5rem',
                      backgroundColor: getDepthBackgroundColor(conditionalDepth)
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: collapsedItems.has(`c-${logicItem.id}`) ? 0 : '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, cursor: 'pointer' }} onClick={() => toggleCollapsed(`c-${logicItem.id}`)}>
                          <span style={{ fontSize: '0.65rem', flexShrink: 0, color: '#6b7280' }}>{collapsedItems.has(`c-${logicItem.id}`) ? '\u25B6' : '\u25BC'}</span>
                          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: getDepthTextColor(conditionalDepth) }}>
                            Conditional ({qIndex + 1}-{condIndex + 1})
                          </div>
                          {collapsedItems.has(`c-${logicItem.id}`) && (
                            <div style={{ marginLeft: '0.5rem' }}>{renderConditionalSummary(logicItem)}</div>
                          )}
                          {(() => {
                            const selIdent = logicItem.conditional?.ifIdentifier || question?.identifier || ''
                            const selQ = questions.find(q => q.identifier === selIdent)
                            if (!selQ?.repeatable) return null
                            const optIn = logicItem.conditional?.userOptIn ?? false
                            return (
                              <div style={{ display: 'flex', gap: '0.4rem', marginLeft: '0.75rem' }} onClick={e => e.stopPropagation()}>
                                <label style={{
                                  display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', fontSize: '0.7rem',
                                  padding: '0.15rem 0.5rem', borderRadius: '0.3rem', whiteSpace: 'nowrap',
                                  border: `1px solid ${!optIn ? '#6b7280' : '#d1d5db'}`,
                                  background: !optIn ? '#f3f4f6' : '#fff', color: !optIn ? '#374151' : '#9ca3af'
                                }}>
                                  <input type="radio" name={`oi-${logicItem.id}`} checked={!optIn}
                                    onChange={() => updateConditionalValue(logicItem.id, 'userOptIn', false)} />
                                  Don't Join Repeatable Group
                                </label>
                                <label style={{
                                  display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', fontSize: '0.7rem',
                                  padding: '0.15rem 0.5rem', borderRadius: '0.3rem', whiteSpace: 'nowrap',
                                  border: `1px solid ${optIn ? '#2563eb' : '#d1d5db'}`,
                                  background: optIn ? '#eff6ff' : '#fff', color: optIn ? '#1d4ed8' : '#9ca3af'
                                }}>
                                  <input type="radio" name={`oi-${logicItem.id}`} checked={optIn}
                                    onChange={() => updateConditionalValue(logicItem.id, 'userOptIn', true)} />
                                  Join Repeatable Group
                                </label>
                              </div>
                            )
                          })()}
                        </div>
              
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          {/* Right arrow - move root-level conditional into nearest conditional above in questionLogic */}
                          {canMoveQuestionRight(logicIndex) && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); moveConditionalRight(logicIndex) }}
                              style={{
                                background: 'none',
                                border: '1px solid #9ca3af',
                                borderRadius: '0.25rem',
                                padding: '0.15rem 0.25rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#6b7280'
                              }}
                              title="Move conditional one level right (into conditional above)"
                            >
                              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '0.85rem', height: '0.85rem' }}>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          )}
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
                      </div>

                      {!collapsedItems.has(`c-${logicItem.id}`) && <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
                                    <option value="any_equals">if any equals</option>
                                    <option value="none_equals">if none equals</option>
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

                      </div>}

                      {/* Insert buttons after Value dropdown, before nested items */}
                      {!collapsedItems.has(`c-${logicItem.id}`) && <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        marginTop: '0.5rem',
                        marginBottom: '0.25rem'
                      }}>
                        <button
                          type="button"
                          onClick={() => insertNestedQuestionBeforeIndex(0, [logicIndex], 1)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.2rem 0.5rem',
                            fontSize: '0.65rem',
                            background: 'white',
                            color: '#2563eb',
                            border: '1px dashed #2563eb',
                            borderRadius: '0.25rem',
                            cursor: 'pointer',
                            opacity: 0.7,
                            transition: 'opacity 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
                          title="Insert a question inside this conditional"
                        >
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '0.65rem', height: '0.65rem' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Insert Question
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            addConditionalToLogicAtIndex(-1, [logicIndex], question)
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
                          title="Insert a conditional inside this conditional"
                        >
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '0.65rem', height: '0.65rem' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Insert Conditional
                        </button>
                      </div>}

                      {/* Nested items - always visible even when conditional is collapsed */}
                      {logicItem.conditional?.nestedItems && logicItem.conditional.nestedItems.length > 0 && (
                        <div style={{ marginTop: collapsedItems.has(`c-${logicItem.id}`) ? '0.25rem' : '0.5rem' }}>
                          {renderNestedItems(logicItem.conditional.nestedItems, [logicIndex], 1, question, `${qIndex + 1}-${condIndex + 1}`)}
                        </div>
                      )}

                    </div>

                    </React.Fragment>
                  )
            }

            return (
            <div key={question.id}>
            {/* Insert buttons above first question only; for others, the previous question's bottom buttons handle it */}
              {qIndex === 0 && <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '0.5rem',
                marginBottom: '0.5rem'
              }}>
                <button
                  type="button"
                  onClick={() => insertQuestionBeforeIndex(logicIndex >= 0 ? logicIndex : 0, qIndex)}
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
                  title={`Insert a new question before Question ${qIndex + 1}`}
                >
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '0.75rem', height: '0.75rem' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Insert Question
                </button>
                <button
                  type="button"
                  onClick={() => {
                    addConditionalToLogic(-1, undefined, question, question)
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
                  title={`Insert a new conditional before Question ${qIndex + 1}`}
                >
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '0.65rem', height: '0.65rem' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Insert Conditional
                </button>
              </div>}
            <div style={{ position: 'relative' }}>
              {/* Repeatable group bracket */}
              {groupColor && (
                <div style={{
                  position: 'absolute',
                  left: '-10px',
                  top: prevInSameGroup ? '-6px' : '40px',
                  bottom: nextInSameGroup ? '-6px' : '12px',
                  width: '10px',
                  borderLeft: `3px solid ${groupColor}`,
                  borderTop: !prevInSameGroup ? `3px solid ${groupColor}` : 'none',
                  borderBottom: !nextInSameGroup ? `3px solid ${groupColor}` : 'none',
                  borderRight: 'none',
                  borderRadius: !prevInSameGroup && !nextInSameGroup ? '4px 0 0 4px'
                    : !prevInSameGroup ? '4px 0 0 0'
                    : !nextInSameGroup ? '0 0 0 4px'
                    : '0',
                  zIndex: 1
                }} />
              )}
            <QuestionBuilder className="question-builder" $flash={flashingQuestions.has(question.id) ? flashingQuestions.get(question.id) : undefined} style={isCollapsed ? { marginBottom: '3px' } : undefined}>
              <QuestionBuilderHeader style={isCollapsed ? { marginBottom: 0 } : undefined}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, cursor: 'pointer' }} onClick={() => toggleCollapsed(`q-${question.id}`)}>
                  <span style={{ fontSize: '0.65rem', flexShrink: 0, color: '#6b7280' }}>{collapsedItems.has(`q-${question.id}`) ? '\u25B6' : '\u25BC'}</span>
                  <QuestionNumber>Question {qIndex + 1}</QuestionNumber>
                  {question.isSaving && (
                    <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Saving...</span>
                  )}
                  {!question.isSaving && question.lastSaved && (
                    <span style={{ fontSize: '0.75rem', color: '#10b981' }}>✓ Saved</span>
                  )}
                  {collapsedItems.has(`q-${question.id}`) && (
                    <div style={{ marginLeft: '0.5rem' }}>{renderQuestionSummary(question, qIndex > 0 ? mainLevelQuestions[qIndex - 1] : null)}</div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  {/* Right arrow - move question into nearest conditional above in questionLogic */}
                  {logicIndex >= 0 && canMoveQuestionRight(logicIndex) && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); moveQuestionRight(logicIndex) }}
                      style={{
                        background: 'none',
                        border: '1px solid #9ca3af',
                        borderRadius: '0.25rem',
                        padding: '0.15rem 0.25rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#6b7280'
                      }}
                      title="Move question one level right (into conditional above)"
                    >
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '0.85rem', height: '0.85rem' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  )}
                  <RemoveButton
                    className="remove-button"
                    type="button"
                    onClick={() => removeQuestion(question.id)}
                    title="Remove question"
                    data-testid={`remove-question-${question.id}`}
                  >
                    <TrashIcon fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </TrashIcon>
                  </RemoveButton>
                </div>
              </QuestionBuilderHeader>

              {!collapsedItems.has(`q-${question.id}`) && <QuestionBuilderContent>
                <div className="form-group">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                    <label style={{ margin: 0, whiteSpace: 'nowrap', fontSize: '0.875rem', fontWeight: 600, color: '#374151', lineHeight: 1 }}>Identifier *</label>
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
                            (item.localQuestionId != null && q.id === item.localQuestionId) ||
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
                                  updateQuestionFields(question.id, { repeatable: false, repeatable_group_id: undefined })
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
                                  updateQuestionFields(question.id, { repeatable: true, repeatable_group_id: prevRepeatableQuestion?.repeatable_group_id || prevRepeatableQuestion?.id })
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
                                  updateQuestionFields(question.id, { repeatable: true, repeatable_group_id: question.id })
                                }}
                              />
                              Start New Repeatable Group
                            </label>
                          </div>
                        )
                      } else {
                        // Show simple checkbox
                        return (
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem', color: '#374151', margin: 0, lineHeight: 1, cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={question.repeatable}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  updateQuestionFields(question.id, { repeatable: true, repeatable_group_id: question.id })
                                } else {
                                  updateQuestionFields(question.id, { repeatable: false, repeatable_group_id: undefined })
                                }
                              }}
                              style={{ margin: 0 }}
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
                    onChange={(e) => { updateQuestion(question.id, 'identifier', e.target.value); clearValidationError(`q-identifier-${question.id}`) }}
                    onBlur={(e) => updateQuestion(question.id, 'identifier', e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                    className="form-input"
                    style={{ borderColor: question.isDuplicateIdentifier || validationErrors.has(`q-identifier-${question.id}`) ? '#dc2626' : undefined }}
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
                    onChange={(e) => { updateQuestion(question.id, 'question_text', e.target.value); clearValidationError(`q-text-${question.id}`) }}
                    className="form-textarea"
                    style={{ borderColor: validationErrors.has(`q-text-${question.id}`) ? '#dc2626' : undefined }}
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
              </QuestionBuilderContent>}

              {/* Insert Question and Insert Conditional buttons at bottom of expanded question */}
              {!isCollapsed && <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '0.5rem',
                marginTop: '0.75rem',
                marginBottom: '0.25rem'
              }}>
                <button
                  type="button"
                  onClick={() => {
                    // Identify the next main-level question so we can insert before it.
                    // We look it up inside the functional-update callbacks (prevLogic / prev)
                    // to avoid stale-closure issues with questionLogic or questions.
                    const nextQ = qIndex + 1 < mainLevelQuestions.length
                      ? mainLevelQuestions[qIndex + 1]
                      : null

                    const newQuestion: QuestionFormData = {
                      id: crypto.randomUUID(),
                      question_text: '',
                      question_type: 'free_text',
                      identifier: '',
                      repeatable: false,
                      is_required: false,
                      options: []
                    }
                    flashQuestion(newQuestion.id, 'add')

                    const newLogicItem: QuestionLogicItem = {
                      id: crypto.randomUUID(),
                      type: 'question',
                      questionId: undefined,
                      depth: 0
                    }
                    ;newLogicItem.localQuestionId = newQuestion.id

                    const currentGroupId = savedGroupIdRef.current

                    // Insert in questions array: before nextQ's position, or at end
                    setQuestions(prev => {
                      const insertAt = nextQ != null
                        ? prev.findIndex(q => q.id === nextQ.id || (nextQ.dbId != null && q.dbId === nextQ.dbId))
                        : -1
                      const pos = insertAt >= 0 ? insertAt : prev.length
                      return [...prev.slice(0, pos), newQuestion, ...prev.slice(pos)]
                    })

                    // Insert in questionLogic: before nextQ's logic item, or at end
                    setQuestionLogic(prevLogic => {
                      const insertAt = nextQ != null
                        ? prevLogic.findIndex(item =>
                            item.type === 'question' && isLogicItemForQuestion(item, nextQ))
                        : -1
                      const pos = insertAt >= 0 ? insertAt : prevLogic.length
                      const newLogic = [...prevLogic.slice(0, pos), newLogicItem, ...prevLogic.slice(pos)]
                      if (currentGroupId) saveQuestionLogic(newLogic, currentGroupId)
                      return newLogic
                    })
                  }}
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
                  title="Insert a new question after this one"
                >
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '0.75rem', height: '0.75rem' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Insert Question
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Insert a conditional AFTER the current question in the logic array
                    addConditionalToLogic(logicIndex >= 0 ? logicIndex : qIndex, undefined, question)
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
              </div>}

            </QuestionBuilder>
            {/* Join Repeatable Group conditionals - inside bracket scope */}
            {conditionalsAfterThisQ.filter(c => c.item.conditional?.userOptIn === true).map(({ item: logicItem, idx: logicIndex }) =>
              renderConditionalBlockFn(logicItem, logicIndex, conditionalsAfterThisQ.findIndex(c => c.idx === logicIndex))
            )}
            </div>
            {/* Don't Join conditionals - outside bracket scope */}
            {conditionalsAfterThisQ.filter(c => c.item.conditional?.userOptIn !== true).map(({ item: logicItem, idx: logicIndex }) =>
              renderConditionalBlockFn(logicItem, logicIndex, conditionalsAfterThisQ.findIndex(c => c.idx === logicIndex))
            )}

            {/* After-conditional insert buttons: insert at the main level right after this question's last conditional */}
            {conditionalsAfterThisQ.length > 0 && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '0.5rem',
                marginTop: '0.75rem',
                marginBottom: '0.25rem'
              }}>
                <button
                  type="button"
                  onClick={() => {
                    // Use the last conditional's logic index so the new item lands
                    // immediately after this question's conditional block, not at the end.
                    const lastCondLogicIdx = conditionalsAfterThisQ[conditionalsAfterThisQ.length - 1].idx

                    const newQuestion: QuestionFormData = {
                      id: crypto.randomUUID(),
                      question_text: '',
                      question_type: 'free_text',
                      identifier: '',
                      repeatable: false,
                      is_required: false,
                      options: []
                    }
                    flashQuestion(newQuestion.id, 'add')

                    const newLogicItem: QuestionLogicItem = {
                      id: crypto.randomUUID(),
                      type: 'question',
                      questionId: undefined,
                      depth: 0
                    }
                    ;newLogicItem.localQuestionId = newQuestion.id

                    const currentGroupId = savedGroupIdRef.current

                    // Order in the questions array doesn't matter (display is sorted by logic)
                    setQuestions(prev => [...prev, newQuestion])

                    setQuestionLogic(prevLogic => {
                      const pos = Math.min(lastCondLogicIdx + 1, prevLogic.length)
                      const newLogic = [...prevLogic.slice(0, pos), newLogicItem, ...prevLogic.slice(pos)]
                      if (currentGroupId) saveQuestionLogic(newLogic, currentGroupId)
                      return newLogic
                    })
                  }}
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
                  title="Insert a new question at this level"
                >
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '0.75rem', height: '0.75rem' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Insert Question
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Insert after the last conditional's index so the new conditional
                    // lands immediately after this question's conditional block.
                    const lastCondLogicIdx = conditionalsAfterThisQ[conditionalsAfterThisQ.length - 1].idx
                    addConditionalToLogic(lastCondLogicIdx, undefined, question)
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
                  title="Insert a new conditional at this level"
                >
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '0.75rem', height: '0.75rem' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Insert Conditional
                </button>
              </div>
            )}

            </div>
          )})
          })()}


          {questions.length === 0 && (
            <EmptyQuestions>
              <p>No questions added yet. Click "Add Question" to get started.</p>
            </EmptyQuestions>
          )}

          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
            <AddQuestionButton
              type="button"
              onClick={() => addQuestionToLogic()}
              disabled={!canAddQuestion}
              style={{ opacity: canAddQuestion ? 1 : 0.5, cursor: canAddQuestion ? 'pointer' : 'not-allowed' }}
            >
              <ButtonIcon fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </ButtonIcon>
              Add Question
            </AddQuestionButton>
            <button
              type="button"
              onClick={() => addConditionalToLogic(questionLogic.length - 1)}
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
        </FormSection>
        )}
      </QGForm>
    </QGContainer>
  )
}

export default QuestionGroups
