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
  const [isEditing, setIsEditing] = useState(false)
  const [blockErrors, setBlockErrors] = useState<string[]>([])
  const textareaInitializedRef = useRef(false)
  const scrollRatioRef = useRef<number>(0)
  const pageScrollRef = useRef<number>(0)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const formattedDivRef = useRef<HTMLDivElement | null>(null)

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

  // Format content with bold for {{ }} and << >> patterns, and color coding for IF/FOREACH
  const formatContent = (text: string) => {
    // Escape HTML first
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

    // Color scheme for nesting levels
    const colors = [
      '#2563eb', // Blue for level 0
      '#059669', // Green for level 1
      '#7c3aed', // Purple for level 2
      '#dc2626', // Red for level 3+
    ]

    // Track nesting depth as we parse
    let result = ''
    let depth = 0
    const stack: string[] = [] // Track what we're inside (IF or FOREACH)

    // Split by {{ }} blocks
    const parts = escaped.split(/(\{\{[^}]+\}\})/g)

    for (const part of parts) {
      if (part.startsWith('{{') && part.endsWith('}}')) {
        const inner = part.slice(2, -2).trim()

        // Determine block type
        let isOpening = false
        let isClosing = false
        let blockType = ''

        if (inner.match(/^IF\s/i) || inner === 'IF') {
          isOpening = true
          blockType = 'IF'
        } else if (inner.match(/^FOREACH\s/i)) {
          isOpening = true
          blockType = 'FOREACH'
        } else if (inner === 'END FOREACH') {
          isClosing = true
          blockType = 'FOREACH'
        } else if (inner === 'END') {
          isClosing = true
          blockType = 'IF'
        } else if (inner === 'ELSE') {
          // ELSE doesn't change depth, uses current depth
          const color = colors[Math.min(depth - 1, colors.length - 1)]
          result += `<strong style="color: ${color};">{{${inner}}}</strong>`
          continue
        }

        if (isOpening) {
          const color = colors[Math.min(depth, colors.length - 1)]
          result += `<strong style="color: ${color};">{{${inner}}}</strong>`
          stack.push(blockType)
          depth++
        } else if (isClosing) {
          depth = Math.max(0, depth - 1)
          const color = colors[Math.min(depth, colors.length - 1)]
          result += `<strong style="color: ${color};">{{${inner}}}</strong>`
          stack.pop()
        } else {
          // Other {{ }} blocks (not control flow) - just bold
          result += `<strong>{{${inner}}}</strong>`
        }
      } else {
        // Regular text - apply << >> bold formatting
        result += part.replace(/&lt;&lt;([^&]+)&gt;&gt;/g, '<strong>&lt;&lt;$1&gt;&gt;</strong>')
      }
    }

    return result.replace(/\n/g, '<br>')
  }


  // Validate matching IF/END and FOREACH/END FOREACH blocks
  const validateBlocks = (text: string): string[] => {
    const errors: string[] = []
    const blockRegex = /\{\{\s*(IF\s|FOREACH\s|ELSE|END FOREACH|END)\s*/gi
    const stack: { type: string; line: number }[] = []
    const lines = text.split('\n')

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum]
      let match: RegExpExecArray | null
      const lineRegex = /\{\{\s*(IF\s[^}]*|FOREACH(?:\(\d+\))?\s[^}]*|ELSE|END FOREACH|END)\s*\}\}/gi

      while ((match = lineRegex.exec(line)) !== null) {
        const keyword = match[1].trim().toUpperCase()

        if (keyword.startsWith('IF ') || keyword === 'IF') {
          stack.push({ type: 'IF', line: lineNum + 1 })
        } else if (keyword.startsWith('FOREACH')) {
          stack.push({ type: 'FOREACH', line: lineNum + 1 })
        } else if (keyword === 'END FOREACH') {
          const last = stack.pop()
          if (!last) {
            errors.push(`Line ${lineNum + 1}: {{ END FOREACH }} without a matching {{ FOREACH }}`)
          } else if (last.type !== 'FOREACH') {
            errors.push(`Line ${lineNum + 1}: {{ END FOREACH }} but expected {{ END }} to close {{ IF }} from line ${last.line}`)
            stack.push(last) // put it back
          }
        } else if (keyword === 'END') {
          const last = stack.pop()
          if (!last) {
            errors.push(`Line ${lineNum + 1}: {{ END }} without a matching {{ IF }}`)
          } else if (last.type !== 'IF') {
            errors.push(`Line ${lineNum + 1}: {{ END }} but expected {{ END FOREACH }} to close {{ FOREACH }} from line ${last.line}`)
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
        errors.push(`Line ${unclosed.line}: {{ FOREACH }} is never closed with {{ END FOREACH }}`)
      }
    }

    return errors
  }

  // Block navigation when there are block errors
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (blockErrors.length > 0) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [blockErrors])

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

    const errors = validateBlocks(markdownContent)
    setBlockErrors(errors)
    if (errors.length > 0) return

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
            onClick={() => {
              if (blockErrors.length > 0) {
                alert('Please fix the mismatched IF/FOREACH blocks before navigating away.')
                return
              }
              navigate('/admin/templates')
            }}
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
                <textarea
                  ref={textareaRefCallback}
                  value={markdownContent}
                  onChange={(e) => setMarkdownContent(e.target.value)}
                  onBlur={(e) => {
                    const el = e.currentTarget
                    const maxScroll = el.scrollHeight - el.clientHeight
                    scrollRatioRef.current = maxScroll > 0 ? el.scrollTop / maxScroll : 0
                    pageScrollRef.current = window.scrollY
                    textareaInitializedRef.current = false
                    setIsEditing(false)
                    setBlockErrors(validateBlocks(markdownContent))
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Tab') {
                      e.preventDefault()
                      const start = e.currentTarget.selectionStart
                      const end = e.currentTarget.selectionEnd
                      const value = e.currentTarget.value
                      setMarkdownContent(value.substring(0, start) + '\t' + value.substring(end))
                      setTimeout(() => {
                        e.currentTarget.selectionStart = e.currentTarget.selectionEnd = start + 1
                      }, 0)
                    }
                  }}
                  style={{
                    width: '100%',
                    height: '600px',
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
                    color: '#111827',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
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
                  style={{
                    width: '100%',
                    height: '600px',
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
                    color: '#111827',
                    cursor: 'text'
                  }}
                  dangerouslySetInnerHTML={{
                    __html: formatContent(markdownContent)
                  }}
                />
              )}
            </div>

            <div className="form-actions" style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button
                type="button"
                onClick={() => {
                  if (blockErrors.length > 0) {
                    alert('Please fix the mismatched IF/FOREACH blocks before navigating away.')
                    return
                  }
                  navigate('/admin/templates')
                }}
                className="cancel-button"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || blockErrors.length > 0}
                className="submit-button"
                style={blockErrors.length > 0 ? {
                  backgroundColor: '#dc2626',
                  borderColor: '#dc2626',
                  cursor: 'not-allowed',
                  opacity: 0.9
                } : {}}
              >
                {blockErrors.length > 0
                  ? 'Error, please correct before saving'
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
