import React, { useState, useEffect } from 'react'
import { personService } from '../../services/personService'
import { Person, PersonCreate, PersonUpdate } from '../../types/person'
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
  const [formData, setFormData] = useState<PersonCreate | PersonUpdate>({
    name: '',
    phone_number: '',
    date_of_birth: '',
    ssn: '',
    email: '',
    employer: '',
    occupation: '',
    mailing_address: {},
    physical_address: {},
  })

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
    setFormData({
      name: '',
      phone_number: '',
      date_of_birth: '',
      ssn: '',
      email: '',
      employer: '',
      occupation: '',
      mailing_address: {},
      physical_address: {},
    })
    setIsModalOpen(true)
  }

  const handleEdit = (person: Person) => {
    setEditingPerson(person)
    setFormData({
      name: person.name,
      phone_number: person.phone_number || '',
      date_of_birth: person.date_of_birth || '',
      email: person.email || '',
      employer: person.employer || '',
      occupation: person.occupation || '',
      mailing_address: person.mailing_address || {},
      physical_address: person.physical_address || {},
      is_active: person.is_active,
    })
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      if (editingPerson) {
        await personService.updatePerson(editingPerson.id, formData as PersonUpdate)
        setSuccess('Person updated successfully')
      } else {
        await personService.createPerson(formData as PersonCreate)
        setSuccess('Person created successfully')
      }
      setIsModalOpen(false)
      loadPeople()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save person')
    }
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
    return new Date(dateString).toLocaleDateString()
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

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingPerson ? 'Edit Person' : 'Add New Person'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="modal-close">
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Name *</label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phone_number || ''}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Date of Birth</label>
                  <input
                    type="date"
                    value={formData.date_of_birth || ''}
                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Social Security Number</label>
                  <input
                    type="text"
                    value={formData.ssn || ''}
                    onChange={(e) => setFormData({ ...formData, ssn: e.target.value })}
                    className="form-input"
                    placeholder="XXX-XX-XXXX"
                    maxLength={11}
                  />
                  <small className="form-hint">Will be encrypted and stored securely</small>
                </div>

                <div className="form-group form-group-full">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label className="form-label">Employer</label>
                      <input
                        type="text"
                        value={formData.employer || ''}
                        onChange={(e) => setFormData({ ...formData, employer: e.target.value })}
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="form-label">Occupation</label>
                      <input
                        type="text"
                        value={formData.occupation || ''}
                        onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                        className="form-input"
                      />
                    </div>
                  </div>
                </div>

                {editingPerson && (
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select
                      value={(formData as PersonUpdate).is_active ? 'active' : 'inactive'}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'active' } as PersonUpdate)}
                      className="form-input"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                )}

                <div className="form-group form-group-full">
                  <h4 className="address-section-title">Mailing Address</h4>
                </div>

                <div className="form-group">
                  <label className="form-label">Address Line 1</label>
                  <input
                    type="text"
                    value={formData.mailing_address?.line1 || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      mailing_address: { ...formData.mailing_address, line1: e.target.value }
                    })}
                    className="form-input"
                    placeholder="Street address"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Address Line 2</label>
                  <input
                    type="text"
                    value={formData.mailing_address?.line2 || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      mailing_address: { ...formData.mailing_address, line2: e.target.value }
                    })}
                    className="form-input"
                    placeholder="Apt, suite, etc. (optional)"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">City</label>
                  <input
                    type="text"
                    value={formData.mailing_address?.city || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      mailing_address: { ...formData.mailing_address, city: e.target.value }
                    })}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">State</label>
                  <select
                    value={formData.mailing_address?.state || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      mailing_address: { ...formData.mailing_address, state: e.target.value }
                    })}
                    className="form-input"
                  >
                    <option value="">Select State</option>
                    <option value="AL">Alabama</option>
                    <option value="AK">Alaska</option>
                    <option value="AZ">Arizona</option>
                    <option value="AR">Arkansas</option>
                    <option value="CA">California</option>
                    <option value="CO">Colorado</option>
                    <option value="CT">Connecticut</option>
                    <option value="DE">Delaware</option>
                    <option value="FL">Florida</option>
                    <option value="GA">Georgia</option>
                    <option value="HI">Hawaii</option>
                    <option value="ID">Idaho</option>
                    <option value="IL">Illinois</option>
                    <option value="IN">Indiana</option>
                    <option value="IA">Iowa</option>
                    <option value="KS">Kansas</option>
                    <option value="KY">Kentucky</option>
                    <option value="LA">Louisiana</option>
                    <option value="ME">Maine</option>
                    <option value="MD">Maryland</option>
                    <option value="MA">Massachusetts</option>
                    <option value="MI">Michigan</option>
                    <option value="MN">Minnesota</option>
                    <option value="MS">Mississippi</option>
                    <option value="MO">Missouri</option>
                    <option value="MT">Montana</option>
                    <option value="NE">Nebraska</option>
                    <option value="NV">Nevada</option>
                    <option value="NH">New Hampshire</option>
                    <option value="NJ">New Jersey</option>
                    <option value="NM">New Mexico</option>
                    <option value="NY">New York</option>
                    <option value="NC">North Carolina</option>
                    <option value="ND">North Dakota</option>
                    <option value="OH">Ohio</option>
                    <option value="OK">Oklahoma</option>
                    <option value="OR">Oregon</option>
                    <option value="PA">Pennsylvania</option>
                    <option value="RI">Rhode Island</option>
                    <option value="SC">South Carolina</option>
                    <option value="SD">South Dakota</option>
                    <option value="TN">Tennessee</option>
                    <option value="TX">Texas</option>
                    <option value="UT">Utah</option>
                    <option value="VT">Vermont</option>
                    <option value="VA">Virginia</option>
                    <option value="WA">Washington</option>
                    <option value="WV">West Virginia</option>
                    <option value="WI">Wisconsin</option>
                    <option value="WY">Wyoming</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">ZIP Code</label>
                  <input
                    type="text"
                    value={formData.mailing_address?.zip || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      mailing_address: { ...formData.mailing_address, zip: e.target.value }
                    })}
                    className="form-input"
                    placeholder="12345"
                    maxLength={10}
                  />
                </div>

                <div className="form-group form-group-full">
                  <h4 className="address-section-title">Physical Address</h4>
                </div>

                <div className="form-group">
                  <label className="form-label">Address Line 1</label>
                  <input
                    type="text"
                    value={formData.physical_address?.line1 || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      physical_address: { ...formData.physical_address, line1: e.target.value }
                    })}
                    className="form-input"
                    placeholder="Street address"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Address Line 2</label>
                  <input
                    type="text"
                    value={formData.physical_address?.line2 || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      physical_address: { ...formData.physical_address, line2: e.target.value }
                    })}
                    className="form-input"
                    placeholder="Apt, suite, etc. (optional)"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">City</label>
                  <input
                    type="text"
                    value={formData.physical_address?.city || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      physical_address: { ...formData.physical_address, city: e.target.value }
                    })}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">State</label>
                  <select
                    value={formData.physical_address?.state || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      physical_address: { ...formData.physical_address, state: e.target.value }
                    })}
                    className="form-input"
                  >
                    <option value="">Select State</option>
                    <option value="AL">Alabama</option>
                    <option value="AK">Alaska</option>
                    <option value="AZ">Arizona</option>
                    <option value="AR">Arkansas</option>
                    <option value="CA">California</option>
                    <option value="CO">Colorado</option>
                    <option value="CT">Connecticut</option>
                    <option value="DE">Delaware</option>
                    <option value="FL">Florida</option>
                    <option value="GA">Georgia</option>
                    <option value="HI">Hawaii</option>
                    <option value="ID">Idaho</option>
                    <option value="IL">Illinois</option>
                    <option value="IN">Indiana</option>
                    <option value="IA">Iowa</option>
                    <option value="KS">Kansas</option>
                    <option value="KY">Kentucky</option>
                    <option value="LA">Louisiana</option>
                    <option value="ME">Maine</option>
                    <option value="MD">Maryland</option>
                    <option value="MA">Massachusetts</option>
                    <option value="MI">Michigan</option>
                    <option value="MN">Minnesota</option>
                    <option value="MS">Mississippi</option>
                    <option value="MO">Missouri</option>
                    <option value="MT">Montana</option>
                    <option value="NE">Nebraska</option>
                    <option value="NV">Nevada</option>
                    <option value="NH">New Hampshire</option>
                    <option value="NJ">New Jersey</option>
                    <option value="NM">New Mexico</option>
                    <option value="NY">New York</option>
                    <option value="NC">North Carolina</option>
                    <option value="ND">North Dakota</option>
                    <option value="OH">Ohio</option>
                    <option value="OK">Oklahoma</option>
                    <option value="OR">Oregon</option>
                    <option value="PA">Pennsylvania</option>
                    <option value="RI">Rhode Island</option>
                    <option value="SC">South Carolina</option>
                    <option value="SD">South Dakota</option>
                    <option value="TN">Tennessee</option>
                    <option value="TX">Texas</option>
                    <option value="UT">Utah</option>
                    <option value="VT">Vermont</option>
                    <option value="VA">Virginia</option>
                    <option value="WA">Washington</option>
                    <option value="WV">West Virginia</option>
                    <option value="WI">Wisconsin</option>
                    <option value="WY">Wyoming</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">ZIP Code</label>
                  <input
                    type="text"
                    value={formData.physical_address?.zip || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      physical_address: { ...formData.physical_address, zip: e.target.value }
                    })}
                    className="form-input"
                    placeholder="12345"
                    maxLength={10}
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="button-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="button-primary">
                  {editingPerson ? 'Update Person' : 'Create Person'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default People
