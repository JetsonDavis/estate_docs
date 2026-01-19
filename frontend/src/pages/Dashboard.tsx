import React from 'react'
import { useAuth } from '../hooks/useAuth'
import { Link } from 'react-router-dom'
import Button from '../components/common/Button'

const Dashboard: React.FC = () => {
  const { user, isAdmin } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome, {user?.full_name || user?.username}!
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {isAdmin ? 'Admin Dashboard' : 'Client Dashboard'}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {isAdmin ? (
            <>
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">User Management</dt>
                        <dd className="mt-1 text-sm text-gray-900">Manage system users and roles</dd>
                      </dl>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Link to="/admin/users">
                      <Button variant="secondary" size="sm" className="w-full">
                        Manage Users
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Question Groups</dt>
                        <dd className="mt-1 text-sm text-gray-900">Create and manage question groups</dd>
                      </dl>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Link to="/admin/question-groups">
                      <Button variant="secondary" size="sm" className="w-full">
                        Manage Questions
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Document Templates</dt>
                        <dd className="mt-1 text-sm text-gray-900">Manage document templates</dd>
                      </dl>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Link to="/admin/templates">
                      <Button variant="secondary" size="sm" className="w-full">
                        Manage Templates
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Start Questionnaire</dt>
                        <dd className="mt-1 text-sm text-gray-900">Begin answering questions</dd>
                      </dl>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Link to="/questionnaire">
                      <Button size="sm" className="w-full">
                        Start
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">My Documents</dt>
                        <dd className="mt-1 text-sm text-gray-900">View generated documents</dd>
                      </dl>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Link to="/documents">
                      <Button variant="secondary" size="sm" className="w-full">
                        View Documents
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">Welcome to Document Merge System</h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>
                  {isAdmin 
                    ? 'As an administrator, you can manage users, create question groups, design document templates, and configure document flows.'
                    : 'Complete questionnaires to generate personalized estate documents based on your answers.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
