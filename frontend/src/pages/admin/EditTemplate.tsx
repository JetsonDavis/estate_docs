import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { templateService } from '../../services/templateService'
import { Template } from '../../types/template'
import './Templates.css'

const EditTemplate: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [template, setTemplate] = useState<Template | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [markdownContent, setMarkdownContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  // Refs for auto-save to avoid stale closures
  const nameRef = useRef(name)
  const descriptionRef = useRef(description)
  const markdownContentRef = useRef(markdownContent)
  const templateRef = useRef(template)
  const lastSavedRef = useRef({ name: '', description: '', markdownContent: '' })
  const editableRef = useRef<HTMLDivElement>(null)
  const cursorPositionRef = useRef<number>(0)

  useEffect(() => { nameRef.current = name }, [name])
  useEffect(() => { descriptionRef.current = description }, [description])
  useEffect(() => { markdownContentRef.current = markdownContent }, [markdownContent])
  useEffect(() => { templateRef.current = template }, [template])

  // Format content with bold for {{ }} and << >> patterns
  const formatContent = (text: string) => {
    // Escape HTML first
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

    // Apply bold formatting to patterns
    return escaped
      .replace(/\{\{([^}]+)\}\}/g, '<strong>{{$1}}</strong>')
      .replace(/&lt;&lt;([^&]+)&gt;&gt;/g, '<strong>&lt;&lt;$1&gt;&gt;</strong>')
      .replace(/\n/g, '<br>')
  }

  // Save cursor position before update
  const saveCursorPosition = () => {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0 && editableRef.current) {
      const range = selection.getRangeAt(0)
      const preCaretRange = range.cloneRange()
      preCaretRange.selectNodeContents(editableRef.current)
      preCaretRange.setEnd(range.endContainer, range.endOffset)
      cursorPositionRef.current = preCaretRange.toString().length
    }
  }

  // Restore cursor position after update
  const restoreCursorPosition = () => {
    if (!editableRef.current) return

    const selection = window.getSelection()
    if (!selection) return

    let charCount = 0
    const targetPosition = cursorPositionRef.current

    const findTextNode = (node: Node): { node: Node; offset: number } | null => {
      if (node.nodeType === Node.TEXT_NODE) {
        const textLength = node.textContent?.length || 0
        if (charCount + textLength >= targetPosition) {
          return { node, offset: targetPosition - charCount }
        }
        charCount += textLength
      } else {
        for (let i = 0; i < node.childNodes.length; i++) {
          const result = findTextNode(node.childNodes[i])
          if (result) return result
        }
      }
      return null
    }

    const result = findTextNode(editableRef.current)
    if (result) {
      const range = document.createRange()
      range.setStart(result.node, result.offset)
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)
    }
  }

  // Update formatted content when markdownContent changes
  useEffect(() => {
    if (editableRef.current && document.activeElement === editableRef.current) {
      saveCursorPosition()
      editableRef.current.innerHTML = formatContent(markdownContent)
      restoreCursorPosition()
    } else if (editableRef.current && document.activeElement !== editableRef.current) {
      editableRef.current.innerHTML = formatContent(markdownContent)
    }
  }, [markdownContent])

  const autoSave = useCallback(async () => {
    const t = templateRef.current
    if (!t) return
    const currentName = nameRef.current
    const currentDesc = descriptionRef.current
    const currentContent = markdownContentRef.current
    const last = lastSavedRef.current

    // Only save if something changed
    if (currentName === last.name && currentDesc === last.description && currentContent === last.markdownContent) {
      return
    }

    try {
      setAutoSaveStatus('saving')
      await templateService.updateTemplate(t.id, {
        name: currentName,
        description: currentDesc || undefined,
        markdown_content: currentContent
      })
      lastSavedRef.current = { name: currentName, description: currentDesc, markdownContent: currentContent }
      setAutoSaveStatus('saved')
      setTimeout(() => setAutoSaveStatus('idle'), 2000)
    } catch {
      setAutoSaveStatus('error')
      setTimeout(() => setAutoSaveStatus('idle'), 3000)
    }
  }, [])

  // Auto-save every 10 seconds
  useEffect(() => {
    if (!template) return
    const interval = setInterval(autoSave, 10000)
    return () => clearInterval(interval)
  }, [template, autoSave])

  useEffect(() => {
    if (id) {
      loadTemplate(parseInt(id))
    }
  }, [id])

  const loadTemplate = async (templateId: number) => {
    try {
      setLoading(true)
      setError(null)
      const data = await templateService.getTemplate(templateId)
      setTemplate(data)
      setName(data.name)
      setDescription(data.description || '')
      setMarkdownContent(data.markdown_content)
      lastSavedRef.current = { name: data.name, description: data.description || '', markdownContent: data.markdown_content }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load template')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setUploading(true)
      const result = await templateService.uploadFile(file)
      setMarkdownContent(result.markdown_content)
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to upload file')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!template) return

    try {
      setSubmitting(true)
      await templateService.updateTemplate(template.id, {
        name,
        description: description || undefined,
        markdown_content: markdownContent
      })
      navigate('/admin/templates')
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update template')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="templates-container">
        <div className="templates-wrapper">
          <div className="loading-state">Loading template...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="templates-container">
        <div className="templates-wrapper">
          <div className="error-state">{error}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="templates-container">
      <div className="templates-wrapper">
        <div className="templates-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h1 className="templates-title">Edit Template</h1>
            {autoSaveStatus === 'saving' && (
              <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>Saving...</span>
            )}
            {autoSaveStatus === 'saved' && (
              <span style={{ fontSize: '0.8rem', color: '#10b981' }}>Saved</span>
            )}
            {autoSaveStatus === 'error' && (
              <span style={{ fontSize: '0.8rem', color: '#ef4444' }}>Auto-save failed</span>
            )}
          </div>
          <button
            onClick={() => navigate('/admin/templates')}
            className="cancel-button"
            style={{ padding: '0.625rem 1.25rem' }}
          >
            ← Back to Templates
          </button>
        </div>

        <div className="edit-template-content">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="form-input"
                required
              />
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
                document.getElementById('edit-file-input')?.click()
              }}>
                <input
                  id="edit-file-input"
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
              <div style={{ position: 'relative', width: '100%' }}>
                <div
                  ref={editableRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(e) => {
                    saveCursorPosition()
                    const text = e.currentTarget.innerText
                    setMarkdownContent(text)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Tab') {
                      e.preventDefault()
                      document.execCommand('insertText', false, '\t')
                    }
                  }}
                  style={{
                    width: '100%',
                    minHeight: '600px',
                    padding: '0.875rem 1rem',
                    border: '2px solid #d1d5db',
                    borderRadius: '0.75rem',
                    fontSize: '1rem',
                    fontFamily: "'Courier New', monospace",
                    boxSizing: 'border-box',
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordWrap: 'break-word',
                    backgroundColor: 'white',
                    outline: 'none'
                  }}
                  dangerouslySetInnerHTML={{
                    __html: formatContent(markdownContent)
                  }}
                />
              </div>
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
                disabled={submitting}
                className="submit-button"
              >
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default EditTemplate
