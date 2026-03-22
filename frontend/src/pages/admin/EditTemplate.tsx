import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { templateService } from '../../services/templateService'
import { Template } from '../../types/template'
import { useToast } from '../../hooks/useToast'
import ReactQuill from 'react-quill'
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
  const scrollRatioRef = useRef<number>(0)
  const pageScrollRef = useRef<number>(0)
  const formattedDivRef = useRef<HTMLDivElement | null>(null)
  const editorContainerRef = useRef<HTMLDivElement | null>(null)
  const quillEditorRef = useRef<ReactQuill | null>(null)

  useEffect(() => { nameRef.current = name }, [name])
  useEffect(() => { descriptionRef.current = description }, [description])
  useEffect(() => { markdownContentRef.current = markdownContent }, [markdownContent])
  useEffect(() => { templateRef.current = template }, [template])

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

  // Restore scroll position on the display overlay when leaving edit mode
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
        // Save Quill scroll position before exiting
        const qlEditor = editorContainerRef.current.querySelector('.ql-editor') as HTMLElement | null
        if (qlEditor) {
          const maxScroll = qlEditor.scrollHeight - qlEditor.clientHeight
          scrollRatioRef.current = maxScroll > 0 ? qlEditor.scrollTop / maxScroll : 0
        }
        pageScrollRef.current = window.scrollY
        setIsEditing(false)
        setBlockErrors(validateBlocks(markdownContent))
        autoSave()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isEditing, markdownContent, autoSave])

  // Color-code IF/FOR EACH blocks and escape identifiers for the formatted display view.
  // Erroneous block tags (mismatched or unclosed) get a bright yellow highlight.
  const colorCodeForDisplay = (html: string): string => {
    const colors = [
      '#2563eb', // Blue for level 0
      '#059669', // Green for level 1
      '#7c3aed', // Purple for level 2
      '#dc2626', // Red for level 3
      '#b45309', // Amber for level 4
      '#0891b2', // Cyan for level 5
      '#be185d', // Pink for level 6
      '#4338ca', // Indigo for level 7+
    ]

    // First escape <<...>> patterns (< is HTML-special)
    let result = html.replace(/<<([^>]+)>>/g, '<strong>&lt;&lt;$1&gt;&gt;</strong>')

    // Highlight <cr>/<CR> line-break tokens
    result = result.replace(/&lt;([Cc][Rr])&gt;/g, '<strong style="color: #9333ea;">&lt;$1&gt;</strong>')

    // --- Pass 1: identify bad tag indices via stack validation ---
    const badTagIndices = new Set<number>()
    const tagRegex1 = /\{\{([^}]+)\}\}/g
    const stack1: { type: string; idx: number }[] = []
    let m1: RegExpExecArray | null
    let tagIdx = 0
    while ((m1 = tagRegex1.exec(result)) !== null) {
      const upper = m1[1].trim().toUpperCase()
      if (upper.startsWith('IF ') || upper === 'IF') {
        stack1.push({ type: 'IF', idx: tagIdx })
      } else if (upper.startsWith('FOR EACH') || upper.startsWith('FOREACH')) {
        stack1.push({ type: 'FOR EACH', idx: tagIdx })
      } else if (upper === 'END FOR EACH' || upper === 'END FOREACH') {
        const last = stack1.pop()
        if (!last) {
          badTagIndices.add(tagIdx)
        } else if (last.type !== 'FOR EACH') {
          badTagIndices.add(tagIdx)
          badTagIndices.add(last.idx)
          stack1.push(last)
        }
      } else if (upper === 'END') {
        const last = stack1.pop()
        if (!last) {
          badTagIndices.add(tagIdx)
        } else if (last.type !== 'IF') {
          badTagIndices.add(tagIdx)
          badTagIndices.add(last.idx)
          stack1.push(last)
        }
      }
      tagIdx++
    }
    // Unclosed openers
    for (const unclosed of stack1) {
      badTagIndices.add(unclosed.idx)
    }

    // --- Pass 2: color-code with highlights for bad tags ---
    let depth = 0
    let tagIdx2 = 0
    result = result.replace(/\{\{([^}]+)\}\}/g, (_match, inner) => {
      const upper = inner.trim().toUpperCase()
      const isBad = badTagIndices.has(tagIdx2)
      tagIdx2++
      const highlight = isBad ? 'background-color: #fde047; padding: 1px 3px; border-radius: 2px;' : ''

      if (upper.startsWith('IF ') || upper === 'IF' || upper.startsWith('FOR EACH') || upper.startsWith('FOREACH')) {
        const color = colors[Math.min(depth, colors.length - 1)]
        depth++
        return `<strong style="color: ${color}; ${highlight}">{{${inner}}}</strong>`
      } else if (upper === 'END FOR EACH' || upper === 'END FOREACH' || upper === 'END') {
        depth = Math.max(0, depth - 1)
        const color = colors[Math.min(depth, colors.length - 1)]
        return `<strong style="color: ${color}; ${highlight}">{{${inner}}}</strong>`
      } else if (upper === 'ELSE') {
        const color = colors[Math.min(Math.max(0, depth - 1), colors.length - 1)]
        return `<strong style="color: ${color}; ${highlight}">{{${inner}}}</strong>`
      } else {
        return `<strong style="${highlight}">{{${inner}}}</strong>`
      }
    })

    return result
  }



  // ── Quill syntax highlighting ─────────────────────────────────────
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isHighlightingRef = useRef(false)
  const SYNTAX_COLORS = [
    '#2563eb', '#059669', '#7c3aed', '#dc2626',
    '#b45309', '#0891b2', '#be185d', '#4338ca',
  ]
  const IDENT_COLOR = '#1e40af'

  const applySyntaxHighlighting = useCallback(() => {
    const editor = quillEditorRef.current?.getEditor()
    if (!editor || isHighlightingRef.current) return

    isHighlightingRef.current = true

    try {
      const text = editor.getText()
      const len = text.length

      // Clear all existing color formatting
      editor.formatText(0, len, 'color', false, 'api')

      // Track ranges covered by {{ }} tags so identifiers inside them aren't re-colored
      const tagRanges: [number, number][] = []

      // Color {{ }} tags based on nesting depth
      const tagRegex = /\{\{[^}]+\}\}/g
      let match: RegExpExecArray | null
      let depth = 0

      while ((match = tagRegex.exec(text)) !== null) {
        const inner = match[0].slice(2, -2).trim().toUpperCase()
        const start = match.index
        const mlen = match[0].length
        tagRanges.push([start, start + mlen])

        if (
          inner.startsWith('IF ') || inner === 'IF' ||
          inner.startsWith('FOR EACH') || inner.startsWith('FOREACH') ||
          inner.startsWith('PEOPLELOOP')
        ) {
          editor.formatText(start, mlen, 'color', SYNTAX_COLORS[Math.min(depth, SYNTAX_COLORS.length - 1)], 'api')
          depth++
        } else if (inner.startsWith('END')) {
          depth = Math.max(0, depth - 1)
          editor.formatText(start, mlen, 'color', SYNTAX_COLORS[Math.min(depth, SYNTAX_COLORS.length - 1)], 'api')
        } else if (inner === 'ELSE') {
          editor.formatText(start, mlen, 'color', SYNTAX_COLORS[Math.min(Math.max(0, depth - 1), SYNTAX_COLORS.length - 1)], 'api')
        }
      }

      // Color standalone << >> identifiers (skip those inside {{ }} tags)
      const identRegex = /<<[^>]+>>/g
      while ((match = identRegex.exec(text)) !== null) {
        const start = match.index
        const mlen = match[0].length
        const insideTag = tagRanges.some(([s, e]) => start >= s && start + mlen <= e)
        if (!insideTag) {
          editor.formatText(start, mlen, 'color', IDENT_COLOR, 'api')
        }
      }

      // Color <cr>/<CR> line-break tokens
      const crRegex = /<[Cc][Rr]>/g
      while ((match = crRegex.exec(text)) !== null) {
        editor.formatText(match.index, match[0].length, 'color', '#9333ea', 'api')
      }
    } finally {
      requestAnimationFrame(() => {
        isHighlightingRef.current = false
      })
    }
  }, [])

  // Re-apply highlighting whenever the user types (debounced)
  useEffect(() => {
    if (!isEditing) return

    const editor = quillEditorRef.current?.getEditor()
    if (!editor) return

    // Apply after a frame to ensure Quill is fully visible
    requestAnimationFrame(() => applySyntaxHighlighting())

    const handler = (_delta: any, _oldDelta: any, source: string) => {
      // Only re-highlight on user edits, not on our own API formatting calls
      if (source !== 'user') return
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
      highlightTimerRef.current = setTimeout(applySyntaxHighlighting, 150)
    }

    editor.on('text-change', handler)
    return () => {
      editor.off('text-change', handler)
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
    }
  }, [isEditing, applySyntaxHighlighting])

  // Validate matching IF/END and FOR EACH/END FOR EACH blocks
  const validateBlocks = (text: string): string[] => {
    const errors: string[] = []
    // Strip HTML tags for readable context snippets
    const plain = text.replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ')

    // Helper: extract ~40 chars of surrounding plain text around a position
    const getContext = (pos: number): string => {
      // Map position from raw text to plain text approximately
      // by stripping tags from the text up to that position
      const before = text.substring(0, pos).replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ')
      const plainPos = before.length
      const start = Math.max(0, plainPos - 20)
      const end = Math.min(plain.length, plainPos + 20)
      let snippet = plain.substring(start, end).trim()
      if (start > 0) snippet = '...' + snippet
      if (end < plain.length) snippet = snippet + '...'
      return snippet
    }

    const tagRegex = /\{\{\s*(IF\s[^}]*|(?:FOR\s+EACH|FOREACH)(?:\(\d+\))?\s[^}]*|ELSE|END\s+(?:FOR\s+EACH|FOREACH)|END)\s*\}\}/gi
    const stack: { type: string; pos: number; context: string }[] = []
    let match: RegExpExecArray | null

    while ((match = tagRegex.exec(text)) !== null) {
      const keyword = match[1].trim().toUpperCase()
      const pos = match.index

      if (keyword.startsWith('IF ') || keyword === 'IF') {
        stack.push({ type: 'IF', pos, context: getContext(pos) })
      } else if (keyword.startsWith('FOR EACH') || keyword.startsWith('FOREACH')) {
        stack.push({ type: 'FOR EACH', pos, context: getContext(pos) })
      } else if (keyword === 'END FOR EACH' || keyword === 'END FOREACH') {
        const last = stack.pop()
        if (!last) {
          errors.push(`{{ END FOR EACH }} without a matching {{ FOR EACH }} — near "${getContext(pos)}"`)
        } else if (last.type !== 'FOR EACH') {
          errors.push(`{{ END FOR EACH }} but expected {{ END }} to close {{ IF }} — near "${getContext(pos)}" (opening {{ IF }} near "${last.context}")`)
          stack.push(last)
        }
      } else if (keyword === 'END') {
        const last = stack.pop()
        if (!last) {
          errors.push(`{{ END }} without a matching {{ IF }} — near "${getContext(pos)}"`)
        } else if (last.type !== 'IF') {
          errors.push(`{{ END }} but expected {{ END FOR EACH }} to close {{ FOR EACH }} — near "${getContext(pos)}" (opening {{ FOR EACH }} near "${last.context}")`)
          stack.push(last)
        }
      }
    }

    // Report unclosed blocks
    for (const unclosed of stack) {
      if (unclosed.type === 'IF') {
        errors.push(`{{ IF }} is never closed with {{ END }} — near "${unclosed.context}"`)
      } else {
        errors.push(`{{ FOR EACH }} is never closed with {{ END FOR EACH }} — near "${unclosed.context}"`)
      }
    }

    return errors
  }

  // Note: block errors are shown as warnings only — navigation is not blocked

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
                onBlur={autoSave}
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
                onBlur={autoSave}
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
              <div ref={editorContainerRef} style={{ position: 'relative', height: '600px' }}>
                {/* Editor is ALWAYS mounted — no mount/unmount cycle */}
                <RichTextEditor
                  value={markdownContent}
                  onChange={setMarkdownContent}
                  placeholder="Enter your template content here..."
                  height="600px"
                  editorRef={quillEditorRef}
                />
                {/* Display overlay sits on top when not editing */}
                {!isEditing && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      zIndex: 10,
                      cursor: 'text'
                    }}
                    onClick={() => {
                      const scrollDiv = formattedDivRef.current
                      if (scrollDiv) {
                        const maxScroll = scrollDiv.scrollHeight - scrollDiv.clientHeight
                        scrollRatioRef.current = maxScroll > 0 ? scrollDiv.scrollTop / maxScroll : 0
                      }
                      pageScrollRef.current = window.scrollY

                      // Sync Quill scroll to match overlay
                      const qlEditor = editorContainerRef.current?.querySelector('.ql-editor') as HTMLElement | null
                      if (qlEditor) {
                        const maxScroll = qlEditor.scrollHeight - qlEditor.clientHeight
                        qlEditor.scrollTop = Math.round(scrollRatioRef.current * maxScroll)
                      }

                      setIsEditing(true)

                      // Focus the already-live editor after overlay is removed
                      requestAnimationFrame(() => {
                        const quill = quillEditorRef.current?.getEditor()
                        if (quill) {
                          quill.focus()
                        }
                        // Restore scroll positions
                        if (qlEditor) {
                          const maxScroll = qlEditor.scrollHeight - qlEditor.clientHeight
                          qlEditor.scrollTop = Math.round(scrollRatioRef.current * maxScroll)
                        }
                        window.scrollTo({ top: pageScrollRef.current })
                      })
                    }}
                  >
                    {/* Fake toolbar matching Quill toolbar height */}
                    <div
                      style={{
                        height: '42px',
                        border: '1px solid #ccc',
                        borderBottom: 'none',
                        borderTopLeftRadius: '0.5rem',
                        borderTopRightRadius: '0.5rem',
                        backgroundColor: '#f9fafb',
                        display: 'flex',
                        alignItems: 'center',
                        paddingLeft: '12px'
                      }}
                    >
                      <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontStyle: 'italic' }}>Click to edit</span>
                    </div>
                    <div
                      ref={formattedDivRef}
                      className="ql-editor"
                      style={{
                        width: '100%',
                        height: 'calc(600px - 42px)',
                        padding: '12px 15px',
                        border: '1px solid #ccc',
                        borderBottomLeftRadius: '0.5rem',
                        borderBottomRightRadius: '0.5rem',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        overflowY: 'auto',
                        backgroundColor: 'white',
                        color: '#111827'
                      }}
                      dangerouslySetInnerHTML={{
                        __html: colorCodeForDisplay(markdownContent)
                      }}
                    />
                  </div>
                )}
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
                style={blockErrors.length > 0 ? {
                  backgroundColor: '#f59e0b',
                  borderColor: '#f59e0b',
                } : {}}
              >
                {blockErrors.length > 0
                  ? '⚠ Exit (has warnings)'
                  : submitting
                    ? 'Saving...'
                    : 'Exit'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default EditTemplate
