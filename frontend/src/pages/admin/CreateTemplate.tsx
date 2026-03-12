import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { templateService } from '../../services/templateService'
import { TemplateCreate, TemplateType } from '../../types/template'
import { useToast } from '../../hooks/useToast'
import RichTextEditor from '../../components/common/RichTextEditor'
import './Templates.css'

const CreateTemplate: React.FC = () => {
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [markdownContent, setMarkdownContent] = useState('')
  const [templateType, setTemplateType] = useState<TemplateType>('direct')
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()
  const [uploadedFile, setUploadedFile] = useState(false)
  const [nameError, setNameError] = useState('')
  const [checkingName, setCheckingName] = useState(false)

  // Prevent browser default drag-and-drop behavior
  useEffect(() => {
    const preventGlobalDrop = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }

    document.addEventListener('dragover', preventGlobalDrop)
    document.addEventListener('drop', preventGlobalDrop)

    return () => {
      document.removeEventListener('dragover', preventGlobalDrop)
      document.removeEventListener('drop', preventGlobalDrop)
    }
  }, [])

  const isFormValid = name.trim() !== '' && !nameError && (markdownContent.trim() !== '' || uploadedFile)

  useEffect(() => {
    const checkNameExists = async () => {
      if (!name.trim()) {
        setNameError('')
        return
      }

      const timeoutId = setTimeout(async () => {
        try {
          setCheckingName(true)
          const response = await templateService.getTemplates(1, 100)
          const exists = response.templates.some(
            (template) => template.name.toLowerCase() === name.trim().toLowerCase()
          )
          if (exists) {
            setNameError('A template with this name already exists')
          } else {
            setNameError('')
          }
        } catch (err) {
          // Silently fail on check error
        } finally {
          setCheckingName(false)
        }
      }, 500)

      return () => clearTimeout(timeoutId)
    }

    checkNameExists()
  }, [name])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    console.log('File upload triggered, file:', file)
    if (!file) return

    console.log('File name:', file.name, 'File type:', file.type, 'File size:', file.size)

    // Check if file is an image
    const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/tiff', 'image/tif']
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.tiff', '.tif']
    const isImage = imageTypes.includes(file.type) ||
                    imageExtensions.some(ext => file.name.toLowerCase().endsWith(ext))

    if (isImage) {
      toast('File type not yet implemented', 'warning')
      e.target.value = '' // Reset the file input
      return
    }

    try {
      setUploading(true)
      // Pass the template name if available for Word/PDF files
      const templateNameForUpload = name.trim() || file.name.replace(/\.[^/.]+$/, '')
      console.log('Calling uploadFile with:', file.name, templateNameForUpload)
      const response = await templateService.uploadFile(file, templateNameForUpload)
      console.log('Upload response:', response)
      setMarkdownContent(response.markdown_content)
      setUploadedFile(true)
    } catch (err: any) {
      console.error('Upload error:', err)
      toast(err.response?.data?.detail || err.message || 'Failed to upload file')
    } finally {
      setUploading(false)
      e.target.value = '' // Reset file input for re-upload
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name || !markdownContent) {
      toast('Please provide a name and content', 'warning')
      return
    }

    try {
      setSubmitting(true)
      const data: TemplateCreate = {
        name,
        description: description || undefined,
        template_type: templateType,
        markdown_content: markdownContent
      }
      console.log('Submitting template data:', data)
      await templateService.createTemplate(data)
      navigate('/admin/templates')
    } catch (err: any) {
      console.error('Template creation error:', err)
      console.error('Error response:', err.response)
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to create template'
      toast(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  // Prevent browser from opening dropped files
  const preventDefaults = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = async (e: React.DragEvent) => {
    preventDefaults(e)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      // Create a synthetic event to reuse handleFileUpload logic
      const syntheticEvent = {
        target: { files: [file], value: '' }
      } as unknown as React.ChangeEvent<HTMLInputElement>
      await handleFileUpload(syntheticEvent)
    }
  }

  return (
    <div className="templates-container">
      <div className="templates-wrapper">
        <div className="templates-header">
          <h1 className="templates-title">Create Template</h1>
          <button
            onClick={() => navigate('/admin/templates')}
            className="cancel-button"
            style={{ padding: '0.625rem 1.25rem' }}
          >
            ← Back to Templates
          </button>
        </div>

        <div
          className="edit-template-content"
          onDragEnter={preventDefaults}
          onDragOver={preventDefaults}
          onDragLeave={preventDefaults}
          onDrop={handleDrop}
        >
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="form-input"
                style={{ borderColor: nameError ? '#dc2626' : undefined }}
                required
              />
              <div style={{ height: '1.5rem', marginTop: '0.25rem' }}>
                {checkingName && (
                  <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>Checking name...</p>
                )}
                {nameError && !checkingName && (
                  <p style={{ color: '#dc2626', fontSize: '0.875rem', margin: 0 }}>{nameError}</p>
                )}
              </div>
            </div>

            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem', paddingTop: '16px' }}>Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem', paddingTop: '16px' }}>Upload File</label>
              <div className="file-upload" style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }} onClick={() => {
                console.log('File upload div clicked')
                document.getElementById('file-input')?.click()
              }}>
                <input
                  id="file-input"
                  type="file"
                  accept=".docx,.pdf,.txt,.jpg,.jpeg,.png,.tiff,.tif"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                <span>📄</span>
                <span style={{ fontSize: '0.875rem' }}>
                  {uploading ? 'Uploading...' : 'Click to upload Word, PDF, Text, or Image file'}
                </span>
              </div>
            </div>

            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem', paddingTop: '16px' }}>
                Text (Use {'<<identifier>>'} for placeholders)
              </label>
              <RichTextEditor
                value={markdownContent}
                onChange={setMarkdownContent}
                placeholder="Enter your template content here...

Example:
Name: <<client_name>>
Date of Birth: <<dob>>"
                height="600px"
              />
            </div>

            <div className="form-actions" style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button
                type="button"
                onClick={() => navigate('/admin/templates')}
                className="cancel-button"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !isFormValid}
                className="submit-button"
              >
                {submitting ? 'Creating...' : 'Create Template'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default CreateTemplate
