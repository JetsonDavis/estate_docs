import React, { useMemo, useEffect, useRef, useCallback } from 'react'
import ReactQuill, { Quill } from 'react-quill'
import 'react-quill/dist/quill.snow.css'

// Register custom font sizes
const Size = Quill.import('attributors/style/size') as any
Size.whitelist = ['10px', '12px', '14px', '16px', '18px', '20px', '24px', '32px', '36px', '40px', '48px', '64px']
Quill.register(Size, true)

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  height?: string
}

// Escape template identifiers so they don't get stripped by Quill
const escapeIdentifiers = (html: string): string => {
  return html
    .replace(/<<([^>]+)>>/g, '&lt;&lt;$1&gt;&gt;')
    .replace(/\{\{([^}]+)\}\}/g, '&#123;&#123;$1&#125;&#125;')
}

// Unescape template identifiers when saving
const unescapeIdentifiers = (html: string): string => {
  return html
    .replace(/&lt;&lt;([^&]+)&gt;&gt;/g, '<<$1>>')
    .replace(/&#123;&#123;([^&]+)&#125;&#125;/g, '{{$1}}')
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Enter your template content here...',
  height = '600px'
}) => {
  const quillRef = useRef<ReactQuill>(null)
  // Track the last value we sent to the parent so we can detect truly external changes
  const lastValueSent = useRef(value)

  // Initial escaped content (computed once, used as defaultValue)
  const initialValue = useMemo(() => escapeIdentifiers(value), [])

  // Handle external value changes (e.g. file upload) – update editor imperatively
  useEffect(() => {
    if (value === lastValueSent.current) return
    lastValueSent.current = value
    if (quillRef.current) {
      const editor = quillRef.current.getEditor()
      editor.clipboard.dangerouslyPasteHTML(escapeIdentifiers(value))
    }
  }, [value])

  const handleChange = useCallback((content: string) => {
    const unescaped = unescapeIdentifiers(content)
    lastValueSent.current = unescaped
    // Defer parent update so Quill can finish its DOM + cursor positioning
    // before any React re-render triggers a layout recalculation
    setTimeout(() => onChange(unescaped), 0)
  }, [onChange])

  const modules = useMemo(() => ({
    toolbar: [
      [{ 'size': ['10px', '12px', '14px', '16px', '18px', '20px', '24px', '32px', '36px', '40px', '48px', '64px'] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      [{ 'align': [] }],
      ['link'],
      ['clean']
    ],
  }), [])

  const formats = [
    'size',
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet',
    'indent',
    'align',
    'link'
  ]

  return (
    <div style={{ height }}>
      <ReactQuill
        ref={quillRef}
        theme="snow"
        defaultValue={initialValue}
        onChange={handleChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        style={{ height: `calc(${height} - 42px)` }}
      />
      <style>{`
        .ql-container.ql-snow {
          background-color: white !important;
        }
        .ql-editor {
          background-color: white !important;
          font-size: 14px !important;
        }
        .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="10px"]::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="10px"]::before {
          content: '10px';
        }
        .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="12px"]::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="12px"]::before {
          content: '12px';
        }
        .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="14px"]::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="14px"]::before {
          content: '14px';
        }
        .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="16px"]::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="16px"]::before {
          content: '16px';
        }
        .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="18px"]::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="18px"]::before {
          content: '18px';
        }
        .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="20px"]::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="20px"]::before {
          content: '20px';
        }
        .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="24px"]::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="24px"]::before {
          content: '24px';
        }
        .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="32px"]::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="32px"]::before {
          content: '32px';
        }
        .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="36px"]::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="36px"]::before {
          content: '36px';
        }
        .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="40px"]::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="40px"]::before {
          content: '40px';
        }
        .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="48px"]::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="48px"]::before {
          content: '48px';
        }
        .ql-snow .ql-picker.ql-size .ql-picker-label[data-value="64px"]::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item[data-value="64px"]::before {
          content: '64px';
        }
        .ql-snow .ql-picker.ql-size .ql-picker-label::before,
        .ql-snow .ql-picker.ql-size .ql-picker-item::before {
          content: 'Normal';
        }
      `}</style>
    </div>
  )
}

export default RichTextEditor
