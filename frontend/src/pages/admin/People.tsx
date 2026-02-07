import React, { useState, useEffect } from 'react'
import { personService } from '../../services/personService'
import { Person } from '../../types/person'
import PersonFormModal from '../../components/common/PersonFormModal'
import './People.css'

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

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this person?')) {
      return
    }

    try {
      setError('')
      await personService.deletePerson(id)
      setSuccess('Person deleted successfully')
      loadPeople()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete person')
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
    <div className="people-container">
      <div className="people-header">
        <div>
          <h1 className="people-title">People Management</h1>
          <p className="people-subtitle">
            Manage people and their information
          </p>
        </div>
        <button onClick={handleCreate} className="create-button">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="button-icon">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Person
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

      <div className="filters-container">
        <div className="search-box">
          <svg className="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, email, or employer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-group">
          <label className="filter-label">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="filter-select"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading people...</p>
        </div>
      ) : people.length === 0 ? (
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
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
          <h3 className="empty-state-title">No people found</h3>
          <p className="empty-state-description">
            Get started by adding a new person.
          </p>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="people-table">
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
                      <div className="person-name-cell">
                        <span className="person-name">{person.name}</span>
                        {person.has_ssn && (
                          <span className="ssn-badge" title="SSN on file">🔒 SSN</span>
                        )}
                      </div>
                    </td>
                    <td>{person.email || 'N/A'}</td>
                    <td>{person.phone_number || 'N/A'}</td>
                    <td>{formatDate(person.date_of_birth)}</td>
                    <td>
                      <span className={`status-badge ${person.is_active ? 'status-active' : 'status-inactive'}`}>
                        {person.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          onClick={() => handleEdit(person)}
                          className="action-button action-edit"
                          title="Edit"
                        >
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(person.id)}
                          className="action-button action-delete"
                          title="Delete"
                        >
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="pagination-button"
              >
                Previous
              </button>
              <span className="pagination-info">
                Page {page} of {totalPages} ({total} total)
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
                className="pagination-button"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      <PersonFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handlePersonSaved}
        editingPerson={editingPerson}
      />
    </div>
  )
}

export default People
