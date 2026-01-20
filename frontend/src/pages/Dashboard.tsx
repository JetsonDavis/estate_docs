import React from 'react'
import { useAuth } from '../hooks/useAuth'
import { Link } from 'react-router-dom'
import './Dashboard.css'

const Dashboard: React.FC = () => {
  const { user, isAdmin } = useAuth()

  return (
    <div className="dashboard-container">
      <div className="dashboard-content">
        <div className="dashboard-header">
          <h1 className="dashboard-title">
            Welcome, {user?.full_name || user?.username}!
          </h1>
          <p className="dashboard-subtitle">
            {isAdmin ? 'Admin Dashboard' : 'Client Dashboard'}
          </p>
        </div>

        <div className="dashboard-grid">
          {isAdmin ? (
            <>
              <div className="dashboard-card">
                <div className="card-header">
                  <svg className="card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <div className="card-content">
                    <h3 className="card-title">People</h3>
                    <p className="card-description">Manage people and their information</p>
                  </div>
                </div>
                <Link to="/admin/people" className="card-button secondary">
                  Manage People
                </Link>
              </div>

              <div className="dashboard-card">
                <div className="card-header">
                  <svg className="card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  <div className="card-content">
                    <h3 className="card-title">Question Groups</h3>
                    <p className="card-description">Create and manage question groups</p>
                  </div>
                </div>
                <Link to="/admin/question-groups" className="card-button secondary">
                  Manage Questions
                </Link>
              </div>

              <div className="dashboard-card">
                <div className="card-header">
                  <svg className="card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div className="card-content">
                    <h3 className="card-title">Document Templates</h3>
                    <p className="card-description">Manage document templates</p>
                  </div>
                </div>
                <Link to="/admin/templates" className="card-button secondary">
                  Manage Templates
                </Link>
              </div>

              <div className="dashboard-card">
                <div className="card-header">
                  <svg className="card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <div className="card-content">
                    <h3 className="card-title">Questionnaire Flows</h3>
                    <p className="card-description">Manage questionnaire workflows</p>
                  </div>
                </div>
                <Link to="/admin/flows" className="card-button secondary">
                  Manage Flows
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="dashboard-card">
                <div className="card-header">
                  <svg className="card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <div className="card-content">
                    <h3 className="card-title">Start Questionnaire</h3>
                    <p className="card-description">Begin answering questions</p>
                  </div>
                </div>
                <Link to="/document" className="card-button">
                  Start
                </Link>
              </div>

              <div className="dashboard-card">
                <div className="card-header">
                  <svg className="card-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div className="card-content">
                    <h3 className="card-title">My Documents</h3>
                    <p className="card-description">View generated documents</p>
                  </div>
                </div>
                <Link to="/documents" className="card-button secondary">
                  View Documents
                </Link>
              </div>
            </>
          )}
        </div>

        <div className="info-banner">
          <svg className="info-icon" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="info-content">
            <h3 className="info-title">Welcome to Estate Doc(tor)</h3>
            <p className="info-text">
              {isAdmin 
                ? 'As an administrator, you can manage users, create question groups, design document templates, and configure document flows.'
                : 'Complete questionnaires to generate personalized estate documents based on your answers.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
