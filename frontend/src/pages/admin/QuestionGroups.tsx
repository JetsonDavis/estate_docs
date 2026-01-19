import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { questionGroupService } from '../../services/questionService'
import { QuestionGroup } from '../../types/question'
import Button from '../../components/common/Button'
import Alert from '../../components/common/Alert'

const QuestionGroups: React.FC = () => {
  const [groups, setGroups] = useState<QuestionGroup[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const navigate = useNavigate()

  const pageSize = 20

  useEffect(() => {
    loadGroups()
  }, [page])

  const loadGroups = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await questionGroupService.listQuestionGroups(page, pageSize, true)
      setGroups(response.question_groups)
      setTotal(response.total)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load question groups')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (groupId: number) => {
    if (!confirm('Are you sure you want to delete this question group?')) {
      return
    }

    try {
      await questionGroupService.deleteQuestionGroup(groupId)
      setSuccess('Question group deleted successfully')
      loadGroups()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete question group')
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Question Groups</h1>
              <p className="mt-2 text-sm text-gray-600">
                Create and manage question groups for questionnaires
              </p>
            </div>
            <Button onClick={() => navigate('/admin/question-groups/new')}>
              Create Question Group
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-4">
            <Alert type="error" message={error} onClose={() => setError('')} />
          </div>
        )}

        {success && (
          <div className="mb-4">
            <Alert type="success" message={success} onClose={() => setSuccess('')} />
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-sm text-gray-600">Loading question groups...</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No question groups</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by creating a new question group.
            </p>
            <div className="mt-6">
              <Button onClick={() => navigate('/admin/question-groups/new')}>
                Create Question Group
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <ul className="divide-y divide-gray-200">
                {groups.map((group) => (
                  <li key={group.id}>
                    <div className="px-6 py-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center">
                            <h3 className="text-lg font-medium text-gray-900">
                              {group.name}
                            </h3>
                            <span className="ml-3 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                              {group.question_count} questions
                            </span>
                            {!group.is_active && (
                              <span className="ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                Inactive
                              </span>
                            )}
                          </div>
                          {group.description && (
                            <p className="mt-1 text-sm text-gray-500">{group.description}</p>
                          )}
                          <div className="mt-2 flex items-center text-sm text-gray-500">
                            <span>Identifier: <code className="bg-gray-100 px-2 py-0.5 rounded">{group.identifier}</code></span>
                            <span className="mx-2">•</span>
                            <span>Order: {group.display_order}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => navigate(`/admin/question-groups/${group.id}`)}
                          >
                            View Details
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => navigate(`/admin/question-groups/${group.id}/edit`)}
                          >
                            Edit
                          </Button>
                          {group.is_active && (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleDelete(group.id)}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} groups
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default QuestionGroups
