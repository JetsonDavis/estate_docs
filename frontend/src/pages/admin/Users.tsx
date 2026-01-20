import React, { useState, useEffect } from 'react'
import { userService } from '../../services/userService'
import { User, UserCreate, UserUpdate } from '../../types/user'
import './Users.css'

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

  const handleDelete = async (userId: number) => {
    if (!confirm('Are you sure you want to deactivate this user?')) {
      return
    }

    try {
      await userService.deleteUser(userId)
      setSuccess('User deactivated successfully')
      loadUsers()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to deactivate user')
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="users-container">
      <div className="users-header">
        <div>
          <h1 className="users-title">User Management</h1>
          <p className="users-subtitle">
            Manage system users and their roles
          </p>
        </div>
        <button onClick={handleCreate} className="create-button">
          Create User
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

      <div className="filters-card">
        <div className="filters-grid">
          <input
            type="text"
            placeholder="Search by username, email, or name..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setPage(1)
            }}
            className="search-input"
          />
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value as 'all' | 'admin' | 'user')
              setPage(1)
            }}
            className="filter-select"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')
              setPage(1)
            }}
            className="filter-select"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading users...</p>
        </div>
      ) : (
        <>
          <div className="users-table-container">
            <table className="users-table">
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
                      <div className="user-name">{user.username}</div>
                    </td>
                    <td>
                      <div className="user-fullname">{user.full_name || '-'}</div>
                    </td>
                    <td>
                      <div className="user-email">{user.email}</div>
                    </td>
                    <td>
                      <span className={`badge ${user.role === 'admin' ? 'badge-admin' : 'badge-user'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${user.is_active ? 'badge-active' : 'badge-inactive'}`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                    </td>
                    <td>
                      <div className="user-actions">
                        <button onClick={() => handleEdit(user)} className="action-button edit-button" title="Edit">
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        {user.is_active && (
                          <button onClick={() => handleDelete(user.id)} className="action-button delete-button" title="Deactivate">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <div className="pagination-info">
                Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} users
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

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingUser ? 'Edit User' : 'Create User'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="modal-close">&times;</button>
            </div>

            <form onSubmit={handleSubmit}>
              {!editingUser && (
                <>
                  <div className="form-group">
                    <label className="form-label">Username</label>
                    <input
                      type="text"
                      value={(formData as UserCreate).username || ''}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      required
                      placeholder="Enter username"
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input
                      type="password"
                      value={(formData as UserCreate).password || ''}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      placeholder="Enter password"
                      className="form-input"
                    />
                    <p className="form-helper">Min 8 chars, uppercase, lowercase, and digit</p>
                  </div>
                </>
              )}
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  placeholder="user@example.com"
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  value={formData.full_name || ''}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Full name (optional)"
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select
                  value={formData.role || 'user'}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'user' })}
                  className="form-select"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {editingUser && (
                <div className="form-group">
                  <div className="checkbox-group">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={(formData as UserUpdate).is_active !== false}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="checkbox-input"
                    />
                    <label htmlFor="is_active" className="checkbox-label">
                      Active
                    </label>
                  </div>
                </div>
              )}
              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="cancel-button"
                >
                  Cancel
                </button>
                <button type="submit" className="submit-button">
                  {editingUser ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Users
