import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import './Header.css'

const Header: React.FC = () => {
  const { isAuthenticated, isAdmin, user, logout } = useAuth()
  const navigate = useNavigate()

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
              Estate Planning Document Generator
            </Link>
            {isAuthenticated && (
              <div className="header-links">
                {isAdmin && (
                  <>
                    <Link to="/admin/users" className="header-link">
                      Users
                    </Link>
                    <Link to="/admin/question-groups" className="header-link">
                      Question Groups
                    </Link>
                    <Link to="/admin/templates" className="header-link">
                      Templates
                    </Link>
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
                <div className="user-info">
                  <span>{user?.username}</span>
                  {isAdmin && <span className="admin-badge">Admin</span>}
                </div>
                <button className="logout-button" onClick={handleLogout}>
                  Logout
                </button>
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
