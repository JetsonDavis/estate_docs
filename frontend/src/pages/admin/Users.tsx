import React, { useState, useEffect } from 'react'
import styled, { keyframes } from 'styled-components'
import { userService } from '../../services/userService'
import { User, UserCreate, UserUpdate } from '../../types/user'
import ConfirmDialog from '../../components/common/ConfirmDialog'

const UsersContainer = styled.div`
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
`

const UsersHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
`

const UsersTitle = styled.h1`
  font-size: 1.875rem;
  font-weight: 700;
  color: #111827;
  margin: 0;
`

const UsersSubtitle = styled.p`
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
  &:hover {
    background-color: #1d4ed8;
  }
`

const AlertContainer = styled.div`
  margin-bottom: 1rem;
`

const Alert = styled.div<{ $variant?: 'error' | 'success' }>`
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

const FiltersCard = styled.div`
  background: white;
  padding: 1.5rem;
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  margin-bottom: 1.5rem;
`

const FiltersGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  @media (min-width: 768px) {
    grid-template-columns: 2fr 1fr 1fr;
  }
`

const FilterInput = styled.input`
  width: 100%;
  padding: 0.625rem 0.875rem;
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

const FilterSelect = styled.select`
  width: 100%;
  padding: 0.625rem 0.875rem;
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

const UsersTableContainer = styled.div`
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  overflow: hidden;
`

const UsersTable = styled.table`
  width: 100%;
  border-collapse: collapse;
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
    &:last-child {
      text-align: left;
    }
  }
  td {
    padding: 1rem 1.5rem;
    border-top: 1px solid #e5e7eb;
    font-size: 0.875rem;
  }
`

const UserName = styled.div`
  font-weight: 600;
  color: #111827;
`

const UserFullname = styled.div`
  font-size: 0.875rem;
  color: #6b7280;
  margin-top: 0.125rem;
`

const UserEmail = styled.div`
  color: #374151;
`

const Badge = styled.span<{ $variant: 'admin' | 'user' | 'active' | 'inactive' }>`
  display: inline-flex;
  padding: 0.25rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 9999px;
  line-height: 1.25rem;
  ${({ $variant }) => {
    switch ($variant) {
      case 'admin': return 'background-color: #ede9fe; color: #6b21a8;'
      case 'user': return 'background-color: #dcfce7; color: #166534;'
      case 'active': return 'background-color: #dcfce7; color: #166534;'
      case 'inactive': return 'background-color: #fee2e2; color: #991b1b;'
    }
  }}
`

const UserActions = styled.div`
  display: flex;
  justify-content: flex-start;
  gap: 0.75rem;
  align-items: center;
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

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`

const ModalContent = styled.div`
  background: white;
  border-radius: 0.75rem;
  padding: 2rem;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
`

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
`

const ModalTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
`

const ModalClose = styled.button`
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #6b7280;
  cursor: pointer;
  padding: 0.25rem;
  &:hover {
    color: #111827;
  }
`

const FormGroup = styled.div`
  margin-bottom: 1.5rem;
`

const FormLabel = styled.label`
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.5rem;
`

const FormInput = styled.input`
  width: 100%;
  padding: 0.625rem 0.875rem;
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

const FormSelect = styled.select`
  width: 100%;
  padding: 0.625rem 0.875rem;
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

const FormHelper = styled.p`
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: #6b7280;
`

const CheckboxGroup = styled.div`
  display: flex;
  align-items: center;
`

const CheckboxInput = styled.input`
  width: 1rem;
  height: 1rem;
  color: #2563eb;
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
  cursor: pointer;
  &:focus {
    outline: none;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }
`

const CheckboxLabel = styled.label`
  margin-left: 0.5rem;
  font-size: 0.875rem;
  color: #111827;
`

const ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e5e7eb;
`

const CancelButton = styled.button`
  padding: 0.625rem 1.25rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  background-color: white;
  color: #374151;
  &:hover {
    background-color: #f9fafb;
  }
`

const SubmitButton = styled.button`
  padding: 0.625rem 1.25rem;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  background-color: #2563eb;
  color: white;
  &:hover {
    background-color: #1d4ed8;
  }
`

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [formData, setFormData] = useState<UserCreate | UserUpdate>({
    username: '',
    email: '',
    password: '',
    full_name: '',
    role: 'user',
  })

  const pageSize = 20

  useEffect(() => {
    loadUsers()
  }, [page, searchTerm, roleFilter, statusFilter])

  const loadUsers = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await userService.listUsers(page, pageSize, statusFilter !== 'active')
      
      // Apply client-side filtering
      let filteredUsers = response.users
      
      if (searchTerm) {
        const search = searchTerm.toLowerCase()
        filteredUsers = filteredUsers.filter(user => 
          user.username.toLowerCase().includes(search) ||
          user.email.toLowerCase().includes(search) ||
          (user.full_name && user.full_name.toLowerCase().includes(search))
        )
      }
      
      if (roleFilter !== 'all') {
        filteredUsers = filteredUsers.filter(user => user.role === roleFilter)
      }
      
      if (statusFilter !== 'all') {
        filteredUsers = filteredUsers.filter(user => 
          statusFilter === 'active' ? user.is_active : !user.is_active
        )
      }
      
      setUsers(filteredUsers)
      setTotal(filteredUsers.length)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingUser(null)
    setFormData({
      username: '',
      email: '',
      password: '',
      full_name: '',
      role: 'user',
    })
    setIsModalOpen(true)
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    setFormData({
      email: user.email,
      full_name: user.full_name || '',
      role: user.role,
      is_active: user.is_active,
    })
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      if (editingUser) {
        await userService.updateUser(editingUser.id, formData as UserUpdate)
        setSuccess('User updated successfully')
      } else {
        await userService.createUser(formData as UserCreate)
        setSuccess('User created successfully')
      }
      setIsModalOpen(false)
      loadUsers()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Operation failed')
    }
  }

  const handleDelete = (userId: number) => {
    setDeleteTarget(userId)
  }

  const confirmDelete = async () => {
    if (deleteTarget === null) return
    try {
      await userService.deleteUser(deleteTarget)
      setSuccess('User deactivated successfully')
      loadUsers()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to deactivate user')
    } finally {
      setDeleteTarget(null)
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <UsersContainer>
      <UsersHeader>
        <div>
          <UsersTitle>User Management</UsersTitle>
          <UsersSubtitle>
            Manage system users and their roles
          </UsersSubtitle>
        </div>
        <CreateButton onClick={handleCreate}>
          Create User
        </CreateButton>
      </UsersHeader>

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

      <FiltersCard>
        <FiltersGrid>
          <FilterInput
            type="text"
            placeholder="Search by username, email, or name..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setPage(1)
            }}
          />
          <FilterSelect
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value as 'all' | 'admin' | 'user')
              setPage(1)
            }}
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
          </FilterSelect>
          <FilterSelect
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')
              setPage(1)
            }}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </FilterSelect>
        </FiltersGrid>
      </FiltersCard>

      {loading ? (
        <LoadingState>
          <LoadingSpinner />
          <LoadingText>Loading users...</LoadingText>
        </LoadingState>
      ) : (
        <>
          <UsersTableContainer>
            <UsersTable>
              <thead>
                <tr>
                  <th>User Name</th>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <UserName>{user.username}</UserName>
                    </td>
                    <td>
                      <UserFullname>{user.full_name || '-'}</UserFullname>
                    </td>
                    <td>
                      <UserEmail>{user.email}</UserEmail>
                    </td>
                    <td>
                      <Badge $variant={user.role === 'admin' ? 'admin' : 'user'}>
                        {user.role}
                      </Badge>
                    </td>
                    <td>
                      <Badge $variant={user.is_active ? 'active' : 'inactive'}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td>
                      {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                    </td>
                    <td>
                      <UserActions>
                        <ActionButton $variant="edit" onClick={() => handleEdit(user)} title="Edit">
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </ActionButton>
                        {user.is_active && (
                          <ActionButton $variant="delete" onClick={() => handleDelete(user.id)} title="Deactivate">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          </ActionButton>
                        )}
                      </UserActions>
                    </td>
                  </tr>
                ))}
              </tbody>
            </UsersTable>
          </UsersTableContainer>

          {totalPages > 1 && (
            <Pagination>
              <PaginationInfo>
                Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} users
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

      {isModalOpen && (
        <ModalOverlay onClick={() => setIsModalOpen(false)}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>{editingUser ? 'Edit User' : 'Create User'}</ModalTitle>
              <ModalClose onClick={() => setIsModalOpen(false)}>&times;</ModalClose>
            </ModalHeader>

            <form onSubmit={handleSubmit}>
              {!editingUser && (
                <>
                  <FormGroup>
                    <FormLabel>Username</FormLabel>
                    <FormInput
                      type="text"
                      value={(formData as UserCreate).username || ''}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      required
                      placeholder="Enter username"
                    />
                  </FormGroup>
                  <FormGroup>
                    <FormLabel>Password</FormLabel>
                    <FormInput
                      type="password"
                      value={(formData as UserCreate).password || ''}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      placeholder="Enter password"
                    />
                    <FormHelper>Min 8 chars, uppercase, lowercase, and digit</FormHelper>
                  </FormGroup>
                </>
              )}
              <FormGroup>
                <FormLabel>Email</FormLabel>
                <FormInput
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  placeholder="user@example.com"
                />
              </FormGroup>
              <FormGroup>
                <FormLabel>Full Name</FormLabel>
                <FormInput
                  type="text"
                  value={formData.full_name || ''}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Full name (optional)"
                />
              </FormGroup>
              <FormGroup>
                <FormLabel>Role</FormLabel>
                <FormSelect
                  value={formData.role || 'user'}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'user' })}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </FormSelect>
              </FormGroup>
              {editingUser && (
                <FormGroup>
                  <CheckboxGroup>
                    <CheckboxInput
                      type="checkbox"
                      id="is_active"
                      checked={(formData as UserUpdate).is_active !== false}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    />
                    <CheckboxLabel htmlFor="is_active">
                      Active
                    </CheckboxLabel>
                  </CheckboxGroup>
                </FormGroup>
              )}
              <ModalActions>
                <CancelButton
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </CancelButton>
                <SubmitButton type="submit">
                  {editingUser ? 'Update' : 'Create'}
                </SubmitButton>
              </ModalActions>
            </form>
          </ModalContent>
        </ModalOverlay>
      )}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Deactivate User"
        message="Are you sure you want to deactivate this user?"
        confirmLabel="Deactivate"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </UsersContainer>
  )
}

export default Users
