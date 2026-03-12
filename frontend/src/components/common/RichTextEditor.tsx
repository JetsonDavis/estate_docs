import React, { useMemo } from 'react'
import ReactQuill, { Quill } from 'react-quill'
import 'react-quill/dist/quill.snow.css'

// Register custom font sizes
const Size = Quill.import('attributors/style/size') as any
Size.whitelist = ['10px', '12px', '14px', '16px', '18px', '20px', '24px', '32px']
Quill.register(Size, true)

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  height?: string
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Enter your template content here...',
  height = '600px'
}) => {
  const modules = useMemo(() => ({
    toolbar: [
      [{ 'size': ['10px', '12px', '14px', '16px', '18px', '20px', '24px', '32px'] }],
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
        theme="snow"
        value={value}
        onChange={onChange}
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
        }
      `}</style>
    </div>
  )
}

export default RichTextEditor
