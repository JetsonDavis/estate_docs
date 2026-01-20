import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { flowService } from '../../services/flowService'
import { QuestionnaireFlowCreate } from '../../types/flow'
import './Flows.css'

const CreateFlow: React.FC = () => {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [isDuplicateName, setIsDuplicateName] = useState(false)
  const [isCheckingName, setIsCheckingName] = useState(false)
  const nameCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (nameCheckTimeoutRef.current) {
      clearTimeout(nameCheckTimeoutRef.current)
    }

    if (name.trim() === '') {
      setIsDuplicateName(false)
      setIsCheckingName(false)
      return
    }

    setIsCheckingName(true)

    nameCheckTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await flowService.getFlows(1, 100)
        const duplicate = response.flows.some(f => f.name.toLowerCase() === name.toLowerCase())
        setIsDuplicateName(duplicate)
        setIsCheckingName(false)
      } catch (error: any) {
        console.error('Failed to check name:', error)
        setIsDuplicateName(false)
        setIsCheckingName(false)
      }
    }, 500)

    return () => {
      if (nameCheckTimeoutRef.current) {
        clearTimeout(nameCheckTimeoutRef.current)
      }
    }
  }, [name])


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name) {
      alert('Please provide a flow name')
      return
    }

    try {
      setSubmitting(true)
      const data: QuestionnaireFlowCreate = {
        name,
        description: description || undefined
      }
      await flowService.createFlow(data)
      navigate('/admin/flows')
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create flow')
    } finally {
      setSubmitting(false)
    }
  }


  return (
    <div className="flows-container">
      <div className="flows-wrapper">
        <div style={{ maxWidth: '50%' }}>
          <div className="flows-header" style={{ display: 'block' }}>
            <h1 className="flows-title">Create New Flow</h1>
            
            <form onSubmit={handleSubmit} className="flow-form" style={{ marginTop: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="form-input"
                style={{ 
                  borderColor: isDuplicateName ? '#dc2626' : undefined,
                  width: '100%'
                }}
                required
                placeholder="Enter flow name"
              />
              {isCheckingName && (
                <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  Checking name...
                </p>
              )}
              {isDuplicateName && !isCheckingName && (
                <p style={{ fontSize: '0.875rem', color: '#dc2626', marginTop: '0.25rem' }}>
                  This name is already in use. Please choose a unique name.
                </p>
              )}
            </div>

            <div className="form-group description-group">
              <label className="form-label">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="form-textarea"
                rows={1}
                style={{ width: '100%' }}
                placeholder="Enter flow description"
              />
            </div>

            <div className="form-actions" style={{ marginTop: '-10px' }}>
              <button 
                type="button" 
                onClick={() => navigate('/admin/flows')} 
                className="cancel-button"
                style={{ 
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  minWidth: 'auto'
                }}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={submitting || isDuplicateName} 
                className="submit-button"
                style={{ 
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  minWidth: 'auto'
                }}
              >
                {submitting ? 'Creating...' : 'Create Flow'}
              </button>
            </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CreateFlow
