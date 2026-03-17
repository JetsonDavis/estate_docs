import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { templateService } from '../../services/templateService'
import { Template } from '../../types/template'
import { useToast } from '../../hooks/useToast'
import RichTextEditor from '../../components/common/RichTextEditor'
import 'react-quill/dist/quill.snow.css'
import './Templates.css'

const EditTemplate: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnTo = searchParams.get('returnTo')

  const [template, setTemplate] = useState<Template | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [markdownContent, setMarkdownContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const { toast } = useToast()

  // Refs for auto-save to avoid stale closures
  const nameRef = useRef(name)
  const descriptionRef = useRef(description)
  const markdownContentRef = useRef(markdownContent)
  const templateRef = useRef(template)
  const lastSavedRef = useRef({ name: '', description: '', markdownContent: '' })
  const [isEditing, setIsEditing] = useState(false)
  const [blockErrors, setBlockErrors] = useState<string[]>([])
  const textareaInitializedRef = useRef(false)
  const scrollRatioRef = useRef<number>(0)
  const pageScrollRef = useRef<number>(0)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const formattedDivRef = useRef<HTMLDivElement | null>(null)
  const editorContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => { nameRef.current = name }, [name])
  useEffect(() => { descriptionRef.current = description }, [description])
  useEffect(() => { markdownContentRef.current = markdownContent }, [markdownContent])
  useEffect(() => { templateRef.current = template }, [template])

  // Ref callback for textarea: runs exactly when the element mounts
  const textareaRefCallback = useCallback((el: HTMLTextAreaElement | null) => {
    textareaRef.current = el
    if (el && !textareaInitializedRef.current) {
      textareaInitializedRef.current = true
      const savedRatio = scrollRatioRef.current
      const savedPageScroll = pageScrollRef.current

      // Use setTimeout to let React finish rendering the value, then focus
      setTimeout(() => {
        if (textareaRef.current) {
          const maxScroll = textareaRef.current.scrollHeight - textareaRef.current.clientHeight
          const targetScroll = Math.round(savedRatio * maxScroll)

          textareaRef.current.focus({ preventScroll: true })
          textareaRef.current.scrollTop = targetScroll
          window.scrollTo({ top: savedPageScroll })

          // One more override after the browser settles
          requestAnimationFrame(() => {
            if (textareaRef.current) {
              const max = textareaRef.current.scrollHeight - textareaRef.current.clientHeight
              textareaRef.current.scrollTop = Math.round(savedRatio * max)
            }
            window.scrollTo({ top: savedPageScroll })
          })
        }
      }, 0)
    }
  }, [])

  // Restore scroll position when switching back to formatted view
  useEffect(() => {
    if (!isEditing && formattedDivRef.current) {
      const savedRatio = scrollRatioRef.current
      const savedPageScroll = pageScrollRef.current
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (formattedDivRef.current) {
            const maxScroll = formattedDivRef.current.scrollHeight - formattedDivRef.current.clientHeight
            formattedDivRef.current.scrollTop = Math.round(savedRatio * maxScroll)
          }
          window.scrollTo({ top: savedPageScroll })
        })
      })
    }
  }, [isEditing])

  // Handle click outside to exit edit mode
  useEffect(() => {
    if (!isEditing) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (editorContainerRef.current && !editorContainerRef.current.contains(target)) {
        setIsEditing(false)
        setBlockErrors(validateBlocks(markdownContent))
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isEditing, markdownContent])

  // Color-code IF/FOR EACH blocks and escape identifiers for the formatted display view
  const colorCodeForDisplay = (html: string): string => {
    const colors = [
      '#2563eb', // Blue for level 0
      '#059669', // Green for level 1
      '#7c3aed', // Purple for level 2
      '#dc2626', // Red for level 3+
    ]

    // First escape <<...>> patterns (< is HTML-special)
    let result = html.replace(/<<([^>]+)>>/g, '<strong>&lt;&lt;$1&gt;&gt;</strong>')

    // Process {{...}} with depth-based color coding for control flow
    let depth = 0
    result = result.replace(/\{\{([^}]+)\}\}/g, (_match, inner) => {
      const upper = inner.trim().toUpperCase()

      if (upper.startsWith('IF ') || upper === 'IF' || upper.startsWith('FOR EACH') || upper.startsWith('FOREACH')) {
        const color = colors[Math.min(depth, colors.length - 1)]
        depth++
        return `<strong style="color: ${color};">{{${inner}}}</strong>`
      } else if (upper === 'END FOR EACH' || upper === 'END FOREACH' || upper === 'END') {
        depth = Math.max(0, depth - 1)
        const color = colors[Math.min(depth, colors.length - 1)]
        return `<strong style="color: ${color};">{{${inner}}}</strong>`
      } else if (upper === 'ELSE') {
        const color = colors[Math.min(Math.max(0, depth - 1), colors.length - 1)]
        return `<strong style="color: ${color};">{{${inner}}}</strong>`
      } else {
        return `<strong>{{${inner}}}</strong>`
      }
    })

    return result
  }



  // Validate matching IF/END and FOR EACH/END FOR EACH blocks
  const validateBlocks = (text: string): string[] => {
    const errors: string[] = []
    const blockRegex = /\{\{\s*(IF\s|FOR\s+EACH\s|FOREACH\s|ELSE|END\s+FOR\s+EACH|END\s+FOREACH|END)\s*/gi
    const stack: { type: string; line: number }[] = []
    const lines = text.split('\n')

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum]
      let match: RegExpExecArray | null
      const lineRegex = /\{\{\s*(IF\s[^}]*|(?:FOR\s+EACH|FOREACH)(?:\(\d+\))?\s[^}]*|ELSE|END\s+(?:FOR\s+EACH|FOREACH)|END)\s*\}\}/gi

      while ((match = lineRegex.exec(line)) !== null) {
        const keyword = match[1].trim().toUpperCase()

        if (keyword.startsWith('IF ') || keyword === 'IF') {
          stack.push({ type: 'IF', line: lineNum + 1 })
        } else if (keyword.startsWith('FOR EACH') || keyword.startsWith('FOREACH')) {
          stack.push({ type: 'FOR EACH', line: lineNum + 1 })
        } else if (keyword === 'END FOR EACH' || keyword === 'END FOREACH') {
          const last = stack.pop()
          if (!last) {
            errors.push(`Line ${lineNum + 1}: {{ END FOR EACH }} without a matching {{ FOR EACH }}`)
          } else if (last.type !== 'FOR EACH') {
            errors.push(`Line ${lineNum + 1}: {{ END FOR EACH }} but expected {{ END }} to close {{ IF }} from line ${last.line}`)
            stack.push(last) // put it back
          }
        } else if (keyword === 'END') {
          const last = stack.pop()
          if (!last) {
            errors.push(`Line ${lineNum + 1}: {{ END }} without a matching {{ IF }}`)
          } else if (last.type !== 'IF') {
            errors.push(`Line ${lineNum + 1}: {{ END }} but expected {{ END FOR EACH }} to close {{ FOR EACH }} from line ${last.line}`)
            stack.push(last) // put it back
          }
        }
      }
    }

    // Report unclosed blocks
    for (const unclosed of stack) {
      if (unclosed.type === 'IF') {
        errors.push(`Line ${unclosed.line}: {{ IF }} is never closed with {{ END }}`)
      } else {
        errors.push(`Line ${unclosed.line}: {{ FOR EACH }} is never closed with {{ END FOR EACH }}`)
      }
    }

    return errors
  }

  // Note: block errors are shown as warnings only — navigation is not blocked

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
      toast(err.response?.data?.detail || 'Failed to upload file')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!template) return

    const errors = validateBlocks(markdownContent)
    setBlockErrors(errors)
    if (errors.length > 0) {
      toast('Warning: there are mismatched IF/FOR EACH blocks. Saving anyway.', 'warning')
    }

    try {
      setSubmitting(true)
      await templateService.updateTemplate(template.id, {
        name,
        description: description || undefined,
        markdown_content: markdownContent
      })
      navigate(returnTo || '/admin/templates')
    } catch (err: any) {
      toast(err.response?.data?.detail || 'Failed to update template')
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
              {blockErrors.length > 0 && (
                <div style={{
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  marginBottom: '0.5rem'
                }}>
                  {blockErrors.map((err, i) => (
                    <div key={i} style={{ color: '#dc2626', fontSize: '0.8rem', lineHeight: 1.4 }}>{err}</div>
                  ))}
                </div>
              )}
              {isEditing ? (
                <div ref={editorContainerRef}>
                  <RichTextEditor
                    value={markdownContent}
                    onChange={setMarkdownContent}
                    placeholder="Enter your template content here..."
                    height="600px"
                  />
                </div>
              ) : (
                <div
                  ref={formattedDivRef}
                  onClick={(e) => {
                    const div = e.currentTarget
                    const maxScroll = div.scrollHeight - div.clientHeight
                    scrollRatioRef.current = maxScroll > 0 ? div.scrollTop / maxScroll : 0
                    pageScrollRef.current = window.scrollY
                    setIsEditing(true)
                  }}
                  className="ql-editor"
                  style={{
                    width: '100%',
                    height: '600px',
                    padding: '0.875rem 1rem',
                    border: '2px solid #d1d5db',
                    borderRadius: '0.75rem',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                    overflowY: 'auto',
                    backgroundColor: 'white',
                    color: '#111827',
                    cursor: 'text'
                  }}
                  dangerouslySetInnerHTML={{
                    __html: colorCodeForDisplay(markdownContent)
                  }}
                />
              )}
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
                style={blockErrors.length > 0 ? {
                  backgroundColor: '#f59e0b',
                  borderColor: '#f59e0b',
                } : {}}
              >
                {blockErrors.length > 0
                  ? '⚠ Save (has warnings)'
                  : submitting
                    ? 'Saving...'
                    : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default EditTemplate
