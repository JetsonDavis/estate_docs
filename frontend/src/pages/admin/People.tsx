import React, { useState, useEffect } from 'react'
import styled, { keyframes } from 'styled-components'
import { personService } from '../../services/personService'
import { Person } from '../../types/person'
import PersonFormModal from '../../components/common/PersonFormModal'
import ConfirmDialog from '../../components/common/ConfirmDialog'

const PeopleContainer = styled.div`
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
`

const PeopleHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
`

const PeopleTitle = styled.h1`
  font-size: 1.875rem;
  font-weight: 700;
  color: #111827;
  margin: 0;
`

const PeopleSubtitle = styled.p`
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: #6b7280;
`

const CreateButton = styled.button`
  padding: 0.625rem 1.25rem;
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

const FiltersContainer = styled.div`
  background: white;
  padding: 1.5rem;
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  margin-bottom: 1.5rem;
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  align-items: center;
`

const SearchBox = styled.div`
  flex: 1;
  min-width: 300px;
  position: relative;
`

const SearchIcon = styled.svg`
  position: absolute;
  left: 0.875rem;
  top: 50%;
  transform: translateY(-50%);
  width: 1.25rem;
  height: 1.25rem;
  color: #9ca3af;
  pointer-events: none;
`

const SearchInput = styled.input`
  width: 100%;
  padding: 0.625rem 0.875rem 0.625rem 2.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  box-sizing: border-box;
  &:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }
`

const FilterGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`

const FilterLabel = styled.label`
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  white-space: nowrap;
`

const FilterSelect = styled.select`
  padding: 0.625rem 0.875rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  background-color: white;
  cursor: pointer;
  &:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }
`

const spin = keyframes`
  to { transform: rotate(360deg); }
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
  color: #9ca3af;
  margin: 0 auto;
`

const EmptyStateTitle = styled.h3`
  margin-top: 1rem;
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
`

const EmptyStateDescription = styled.p`
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: #6b7280;
`

const TableContainer = styled.div`
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  overflow-x: auto;
`

const PeopleTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  min-width: 800px;
  thead {
    background-color: #f9fafb;
  }
  th {
    padding: 0.75rem 1.5rem;
    text-align: left;
    font-size: 0.75rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    vertical-align: middle !important;
  }
  td {
    padding: 1rem 1.5rem;
    border-top: 1px solid #e5e7eb;
    font-size: 0.875rem;
    color: #374151;
    vertical-align: middle !important;
  }
`

const PersonNameCell = styled.div`
  display: inline;
`

const PersonName = styled.span`
  font-weight: 600;
  color: #111827;
  margin-right: 0.5rem;
`

const SsnBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  background-color: #fef3c7;
  color: #92400e;
  border-radius: 9999px;
  vertical-align: middle;
`

const StatusBadge = styled.span<{ $active: boolean }>`
  display: inline-flex;
  padding: 0.25rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 9999px;
  line-height: 1.25rem;
  ${({ $active }) => $active ? `
    background-color: #dcfce7;
    color: #166534;
  ` : `
    background-color: #fee2e2;
    color: #991b1b;
  `}
`

const ActionButtons = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  justify-content: center;
  margin-top: -2px;
  margin-left: -44px;
`

const ActionButton = styled.button<{ $variant: 'edit' | 'delete' }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
  border-radius: 0.375rem;
  svg {
    width: 1.25rem;
    height: 1.25rem;
  }
  ${({ $variant }) => $variant === 'edit' ? `
    color: #2563eb;
    &:hover {
      background-color: #eff6ff;
      color: #1d4ed8;
    }
  ` : `
    color: #dc2626;
    &:hover {
      background-color: #fef2f2;
      color: #991b1b;
    }
  `}
`

const PaginationContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1.5rem;
`

const PaginationInfo = styled.span`
  font-size: 0.875rem;
  color: #374151;
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

const People: React.FC = () => {
  const [people, setPeople] = useState<Person[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPerson, setEditingPerson] = useState<Person | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)

  const pageSize = 20

  useEffect(() => {
    loadPeople()
  }, [page, searchTerm, statusFilter])

  const loadPeople = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await personService.getPeople(
        page,
        pageSize,
        statusFilter !== 'active',
        searchTerm || undefined
      )
      
      setPeople(response.people)
      setTotal(response.total)
    } catch (err: any) {
      // Only show error if it's not a "no results" scenario
      const errorMessage = err.response?.data?.detail || 'Failed to load people'
      // Don't show error for empty results
      if (err.response?.status !== 404) {
        setError(errorMessage)
      }
      setPeople([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingPerson(null)
    setIsModalOpen(true)
  }

  const handleEdit = (person: Person) => {
    setEditingPerson(person)
    setIsModalOpen(true)
  }

  const handlePersonSaved = (_person: Person) => {
    setSuccess(editingPerson ? 'Person updated successfully' : 'Person created successfully')
    loadPeople()
  }

  const handleDelete = (id: number) => {
    setDeleteTarget(id)
  }

  const confirmDelete = async () => {
    if (deleteTarget === null) return
    try {
      setError('')
      await personService.deletePerson(deleteTarget)
      setSuccess('Person deleted successfully')
      loadPeople()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete person')
    } finally {
      setDeleteTarget(null)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    // Parse date parts directly to avoid timezone issues
    // Date string is in YYYY-MM-DD format
    const parts = dateString.split('-')
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10)
      const month = parseInt(parts[1], 10)
      const day = parseInt(parts[2], 10)
      return `${month}/${day}/${year}`
    }
    return dateString
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <PeopleContainer>
      <PeopleHeader>
        <div>
          <PeopleTitle>People Management</PeopleTitle>
          <PeopleSubtitle>
            Manage people and their information
          </PeopleSubtitle>
        </div>
        <CreateButton onClick={handleCreate}>
          <ButtonIcon fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </ButtonIcon>
          Add Person
        </CreateButton>
      </PeopleHeader>

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

      <FiltersContainer>
        <SearchBox>
          <SearchIcon fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </SearchIcon>
          <SearchInput
            type="text"
            placeholder="Search by name, email, or employer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </SearchBox>

        <FilterGroup>
          <FilterLabel>Status:</FilterLabel>
          <FilterSelect
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </FilterSelect>
        </FilterGroup>
      </FiltersContainer>

      {loading ? (
        <LoadingState>
          <LoadingSpinner />
          <LoadingText>Loading people...</LoadingText>
        </LoadingState>
      ) : people.length === 0 ? (
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
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </EmptyStateIcon>
          <EmptyStateTitle>No people found</EmptyStateTitle>
          <EmptyStateDescription>
            Get started by adding a new person.
          </EmptyStateDescription>
        </EmptyState>
      ) : (
        <>
          <TableContainer>
            <PeopleTable>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Date of Birth</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {people.map((person) => (
                  <tr key={person.id}>
                    <td>
                      <PersonNameCell>
                        <PersonName>{person.name}</PersonName>
                        {person.has_ssn && (
                          <SsnBadge title="SSN on file">🔒 SSN</SsnBadge>
                        )}
                      </PersonNameCell>
                    </td>
                    <td>{person.email || 'N/A'}</td>
                    <td>{person.phone_number || 'N/A'}</td>
                    <td>{formatDate(person.date_of_birth)}</td>
                    <td>
                      <StatusBadge $active={person.is_active}>
                        {person.is_active ? 'Active' : 'Inactive'}
                      </StatusBadge>
                    </td>
                    <td>
                      <ActionButtons>
                        <ActionButton
                          $variant="edit"
                          onClick={() => handleEdit(person)}
                          title="Edit"
                        >
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </ActionButton>
                        <ActionButton
                          $variant="delete"
                          onClick={() => handleDelete(person.id)}
                          title="Delete"
                        >
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </ActionButton>
                      </ActionButtons>
                    </td>
                  </tr>
                ))}
              </tbody>
            </PeopleTable>
          </TableContainer>

          {totalPages > 1 && (
            <PaginationContainer>
              <PaginationButton
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                Previous
              </PaginationButton>
              <PaginationInfo>
                Page {page} of {totalPages} ({total} total)
              </PaginationInfo>
              <PaginationButton
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
              >
                Next
              </PaginationButton>
            </PaginationContainer>
          )}
        </>
      )}

      <PersonFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handlePersonSaved}
        editingPerson={editingPerson}
      />
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete Person"
        message="Are you sure you want to delete this person?"
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </PeopleContainer>
  )
}

export default People
