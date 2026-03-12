import React, { useState, useEffect } from 'react'
import styled from 'styled-components'
import { documentService } from '../services/documentService'
import { GeneratedDocument } from '../types/document'
import { useToast } from '../hooks/useToast'
import ConfirmDialog from '../components/common/ConfirmDialog'

const DocumentsContainer = styled.div`
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
`

const DocumentsContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2rem;
`

const DocumentsHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`

const DocumentsTitle = styled.h1`
  font-size: 1.875rem;
  font-weight: 700;
  color: #111827;
`

const DocumentsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
`

const DocumentCard = styled.div`
  background: white;
  border-radius: 0.75rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  transition: all 0.2s;

  &:hover {
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }
`

const DocumentHeaderRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
`

const DocumentName = styled.h3`
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
`

const DocumentDate = styled.span`
  font-size: 0.75rem;
  color: #6b7280;
`

const DocumentPreviewText = styled.div`
  font-size: 0.875rem;
  color: #6b7280;
  line-height: 1.5;
  margin-bottom: 1rem;
  max-height: 100px;
  overflow: hidden;
`

const DocumentActions = styled.div`
  display: flex;
  gap: 0.5rem;
`

const Btn = styled.button<{ $variant?: 'primary' | 'secondary' | 'danger'; $sm?: boolean }>`
  padding: ${props => props.$sm ? '0.375rem 0.75rem' : '0.5rem 1rem'};
  border: none;
  border-radius: 0.5rem;
  font-size: ${props => props.$sm ? '0.75rem' : '0.875rem'};
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  background-color: ${props => {
    switch (props.$variant) {
      case 'danger': return '#fef2f2'
      case 'secondary': return '#f3f4f6'
      default: return '#2563eb'
    }
  }};
  color: ${props => {
    switch (props.$variant) {
      case 'danger': return '#991b1b'
      case 'secondary': return '#374151'
      default: return 'white'
    }
  }};

  &:hover {
    background-color: ${props => {
      switch (props.$variant) {
        case 'danger': return '#fee2e2'
        case 'secondary': return '#e5e7eb'
        default: return '#1d4ed8'
      }
    }};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const StateMessage = styled.div<{ $variant?: 'error' }>`
  text-align: center;
  padding: 3rem 1rem;
  color: ${props => props.$variant === 'error' ? '#991b1b' : '#6b7280'};
`

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`

const ModalContent = styled.div<{ $large?: boolean }>`
  background: white;
  border-radius: 0.75rem;
  padding: 2rem;
  max-width: ${props => props.$large ? '900px' : '600px'};
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
`

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
`

const ModalTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
`

const ModalClose = styled.button`
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #6b7280;
  cursor: pointer;
  padding: 0.25rem;

  &:hover {
    color: #111827;
  }
`

const FormGroup = styled.div`
  margin-bottom: 1.5rem;
`

const FormLabel = styled.label`
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.5rem;
`

const FormInput = styled.input`
  width: 100%;
  padding: 0.625rem 0.875rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }
`

const FormSelect = styled.select`
  width: 100%;
  padding: 0.625rem 0.875rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }
`

const ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 2rem;
`

const PreviewInfo = styled.div`
  background-color: #f9fafb;
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 1rem;

  p {
    margin: 0.5rem 0;
    font-size: 0.875rem;
    color: #374151;
  }
`

const WarningBox = styled.div`
  background-color: #fef3c7;
  border: 1px solid #fbbf24;
  border-radius: 0.5rem;
  padding: 0.75rem;
  margin-top: 1rem;
  font-size: 0.875rem;
  color: #92400e;
`

const PreviewContent = styled.div`
  background-color: #f9fafb;
  border-radius: 0.5rem;
  padding: 1rem;
  max-height: 400px;
  overflow-y: auto;

  pre {
    margin: 0;
    white-space: pre-wrap;
    word-wrap: break-word;
    font-family: 'Courier New', monospace;
    font-size: 0.875rem;
    line-height: 1.5;
    color: #374151;
  }
`

const Documents: React.FC = () => {
  const [documents, setDocuments] = useState<GeneratedDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadDocuments()
  }, [])

  const loadDocuments = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await documentService.getDocuments()
      setDocuments(response.documents)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    setDeleteTarget(id)
  }

  const confirmDelete = async () => {
    if (deleteTarget === null) return
    try {
      await documentService.deleteDocument(deleteTarget)
      loadDocuments()
    } catch (err: any) {
      toast(err.response?.data?.detail || 'Failed to delete document')
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <DocumentsContainer>
      <DocumentsContent>
        <DocumentsHeader>
          <DocumentsTitle>My Documents</DocumentsTitle>
        </DocumentsHeader>

        {loading && <StateMessage>Loading documents...</StateMessage>}

        {error && <StateMessage $variant="error">{error}</StateMessage>}

        {!loading && !error && documents.length === 0 && (
          <StateMessage>
            No documents yet. Merge a template with session data from the Merge Documents page to create your first document.
          </StateMessage>
        )}

        {!loading && !error && documents.length > 0 && (
          <DocumentsGrid>
            {documents.map(doc => (
              <DocumentCard key={doc.id}>
                <DocumentHeaderRow>
                  <DocumentName>{doc.document_name}</DocumentName>
                  <DocumentDate>
                    {new Date(doc.generated_at).toLocaleDateString()} {new Date(doc.generated_at).toLocaleTimeString()}
                  </DocumentDate>
                </DocumentHeaderRow>
                <DocumentPreviewText>
                  {doc.markdown_content.substring(0, 200)}...
                </DocumentPreviewText>
                <DocumentActions>
                  <Btn
                    $variant="secondary"
                    $sm
                    onClick={() => {
                      const blob = new Blob([doc.markdown_content], { type: 'text/markdown' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `${doc.document_name}.md`
                      a.click()
                    }}
                  >
                    Download
                  </Btn>
                  <Btn
                    $variant="danger"
                    $sm
                    onClick={() => handleDelete(doc.id)}
                  >
                    Delete
                  </Btn>
                </DocumentActions>
              </DocumentCard>
            ))}
          </DocumentsGrid>
        )}

        <ConfirmDialog
          isOpen={deleteTarget !== null}
          title="Delete Document"
          message="Are you sure you want to delete this document?"
          confirmLabel="Delete"
          variant="danger"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      </DocumentsContent>
    </DocumentsContainer>
  )
}

export default Documents
