import React, { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import './Header.css'

const Header: React.FC = () => {
  const { isAuthenticated, isAdmin, user, logout } = useAuth()
  const navigate = useNavigate()
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/login')
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  return (
    <header className="header">
      <nav className="header-nav">
        <div className="header-content">
          <div className="header-left">
            <Link to="/" className="header-logo">
              Estate Doc(tor)
            </Link>
            {isAuthenticated && (
              <div className="header-links">
                {isAdmin && (
                  <>
                    <Link to="/admin/people" className="header-link">
                      People
                    </Link>
                    <Link to="/admin/question-groups" className="header-link">
                      Question Groups
                    </Link>
                    <Link to="/admin/flows" className="header-link">
                      Flows
                    </Link>
                    <Link to="/admin/templates" className="header-link">
                      Templates
                    </Link>
                    <button
                      onClick={() => navigate('/questionnaire')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        background: '#2563eb',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.375rem',
                        padding: '0.5rem 1rem',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '1rem', height: '1rem' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      New Doc
                    </button>
                  </>
                )}
                {!isAdmin && (
                  <Link to="/questionnaire" className="header-link">
                    Questionnaire
                  </Link>
                )}
              </div>
            )}
          </div>
          <div className="header-right">
            {isAuthenticated ? (
              <>
                <div className="user-info-wrapper">
                  <div className="user-info">
                    <span className="username">{user?.username}</span>
                    {isAdmin && <span className="admin-badge">Admin</span>}
                  </div>
                </div>
                <div className="header-actions">
                  <div className="dropdown-container" ref={dropdownRef}>
                    <button 
                      className="icon-button gear-button" 
                      onClick={() => setShowDropdown(!showDropdown)}
                      title="Settings"
                    >
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                    {showDropdown && (
                      <div className="dropdown-menu">
                        <button 
                          className="dropdown-item"
                          onClick={() => {
                            setShowDropdown(false)
                            navigate('/admin/users')
                          }}
                        >
                          Users
                        </button>
                        <button 
                          className="dropdown-item"
                          onClick={() => {
                            setShowDropdown(false)
                            alert('Coming soon')
                          }}
                        >
                          Settings
                        </button>
                      </div>
                    )}
                  </div>
                  <button className="icon-button logout-button" onClick={handleLogout} title="Logout">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="login-button">
                  Login
                </Link>
                <Link to="/register" className="register-button">
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>
    </header>
  )
}

export default Header
