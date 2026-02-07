import React, { useState, useEffect } from 'react'
import { personService } from '../../services/personService'
import { Person, PersonCreate, PersonUpdate } from '../../types/person'

interface PersonFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (person: Person) => void
  editingPerson?: Person | null
}

const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' }
]

const PersonFormModal: React.FC<PersonFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingPerson
}) => {
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
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Format date to YYYY-MM-DD for HTML date input
  const formatDateForInput = (dateString: string | null): string => {
    if (!dateString) return ''
    // If already in YYYY-MM-DD format, return as-is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString
    // Try to parse and format
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return ''
      return date.toISOString().split('T')[0]
    } catch {
      return ''
    }
  }

  useEffect(() => {
    if (editingPerson) {
      setFormData({
        name: editingPerson.name,
        phone_number: editingPerson.phone_number || '',
        date_of_birth: formatDateForInput(editingPerson.date_of_birth),
        email: editingPerson.email || '',
        employer: editingPerson.employer || '',
        occupation: editingPerson.occupation || '',
        mailing_address: editingPerson.mailing_address || {},
        physical_address: editingPerson.physical_address || {},
        is_active: editingPerson.is_active,
      })
    } else {
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
    }
    setError('')
  }, [editingPerson, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      setSubmitting(true)
      let savedPerson: Person
      if (editingPerson) {
        savedPerson = await personService.updatePerson(editingPerson.id, formData as PersonUpdate)
      } else {
        savedPerson = await personService.createPerson(formData as PersonCreate)
      }
      onSave(savedPerson)
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save person')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {editingPerson ? 'Edit Person' : 'Add New Person'}
          </h2>
          <button onClick={onClose} className="modal-close">
            &times;
          </button>
        </div>

        {error && (
          <div style={{ padding: '0.75rem 1rem', backgroundColor: '#fee2e2', color: '#991b1b', marginBottom: '1rem', borderRadius: '0.375rem' }}>
            {error}
          </div>
        )}

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
                {US_STATES.map(state => (
                  <option key={state.value} value={state.value}>{state.label}</option>
                ))}
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
                {US_STATES.map(state => (
                  <option key={state.value} value={state.value}>{state.label}</option>
                ))}
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
              onClick={onClose}
              className="button-secondary"
              disabled={submitting}
            >
              Cancel
            </button>
            <button type="submit" className="button-primary" disabled={submitting}>
              {submitting ? 'Saving...' : (editingPerson ? 'Update Person' : 'Create Person')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default PersonFormModal
