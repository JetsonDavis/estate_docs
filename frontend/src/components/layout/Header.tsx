import React, { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'

const HeaderWrapper = styled.header`
  background: white;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
`

const HeaderNav = styled.nav`
  max-width: 100%;
  margin: 0 auto;
  padding: 0 1rem;
`

const HeaderContent = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 4rem;
`

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-left: 65px;
`

const HeaderLogo = styled(Link)`
  display: flex;
  align-items: center;
  text-decoration: none;
  font-size: 1.625rem;
  font-weight: 700;
  color: #2563eb;
  transition: color 0.2s;
  white-space: nowrap;

  &:hover {
    color: #1d4ed8;
  }

  @media (max-width: 640px) {
    font-size: 1rem;
  }
`

const HeaderLinks = styled.div`
  display: flex;
  gap: 0.25rem;
  align-items: center;
  margin-left: 30px;

  @media (max-width: 640px) {
    display: none;
  }
`

const HeaderLink = styled(Link)`
  text-decoration: none;
  font-size: 1.0125rem;
  font-weight: 500;
  color: #374151;
  padding: 0.375rem 0.5rem;
  border-radius: 0.375rem;
  transition: all 0.2s;
  white-space: nowrap;

  &:hover {
    color: #2563eb;
    background-color: #eff6ff;
  }
`

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`

const UserInfoWrapper = styled.div`
  display: flex;
`

const UserInfo = styled.div`
  display: flex !important;
  flex-direction: row !important;
  align-items: center;
  gap: 0.5rem;

  @media (max-width: 640px) {
    font-size: 0.75rem;
  }
`

const Username = styled.span`
  font-size: 0.875rem;
  color: #374151;
`

const AdminBadge = styled.span`
  padding: 0.25rem 0.625rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  background-color: #dbeafe;
  color: #1e40af;
`

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`

const IconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  background: none;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
  color: #2563eb;

  svg {
    width: 1.5625rem;
    height: 1.5625rem;
  }

  &:hover {
    background-color: #eff6ff;
    color: #1d4ed8;
  }
`

const DropdownContainer = styled.div`
  position: relative;
`

const DropdownMenu = styled.div`
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  border: 1px solid #e5e7eb;
  min-width: 150px;
  z-index: 50;
  overflow: hidden;
`

const DropdownItem = styled.button`
  display: block;
  width: 100%;
  padding: 0.75rem 1rem;
  text-align: left;
  background: none;
  border: none;
  font-size: 0.875rem;
  color: #374151;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: #f3f4f6;
  }

  &:not(:last-child) {
    border-bottom: 1px solid #f3f4f6;
  }
`

const LoginButton = styled(Link)`
  background-color: #f3f4f6;
  color: #374151;
  font-weight: 500;
  font-size: 0.875rem;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: background-color 0.2s;
  text-decoration: none;
  display: inline-block;

  &:hover {
    background-color: #e5e7eb;
  }
`

const RegisterButton = styled(Link)`
  background-color: #2563eb;
  color: white;
  font-weight: 500;
  font-size: 0.875rem;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: background-color 0.2s;
  text-decoration: none;
  display: inline-block;

  &:hover {
    background-color: #1d4ed8;
  }
`

const Header: React.FC = () => {
  const { isAuthenticated, isAdmin, user, logout } = useAuth()
  const navigate = useNavigate()
  const [showDropdown, setShowDropdown] = useState(false)
  const { toast } = useToast()
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
    <HeaderWrapper>
      <HeaderNav>
        <HeaderContent>
          <HeaderLeft>
            <HeaderLogo to="/">
              Estate Doc(tor)
            </HeaderLogo>
            {isAuthenticated && (
              <HeaderLinks>
                {isAdmin && (
                  <>
                    <HeaderLink to="/admin/question-groups">
                      Question Groups
                    </HeaderLink>
                    <HeaderLink to="/admin/templates">
                      Templates
                    </HeaderLink>
                    <HeaderLink to="/document">
                      Input Form
                    </HeaderLink>
                    <HeaderLink to="/merge-documents">
                      Merge Documents
                    </HeaderLink>
                  </>
                )}
                {!isAdmin && (
                  <>
                    <HeaderLink to="/document">
                      Input Form
                    </HeaderLink>
                    <HeaderLink to="/merge-documents">
                      Merge Documents
                    </HeaderLink>
                  </>
                )}
              </HeaderLinks>
            )}
          </HeaderLeft>
          <HeaderRight>
            {isAuthenticated ? (
              <>
                <UserInfoWrapper>
                  <UserInfo>
                    <Username>{user?.username}</Username>
                    {isAdmin && <AdminBadge>Admin</AdminBadge>}
                  </UserInfo>
                </UserInfoWrapper>
                <HeaderActions>
                  <DropdownContainer ref={dropdownRef}>
                    <IconButton
                      onClick={() => setShowDropdown(!showDropdown)}
                      title="Settings"
                    >
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </IconButton>
                    {showDropdown && (
                      <DropdownMenu>
                        {isAdmin && (
                          <DropdownItem
                            onClick={() => {
                              setShowDropdown(false)
                              navigate('/admin/users')
                            }}
                          >
                            Users
                          </DropdownItem>
                        )}
                        <DropdownItem
                          onClick={() => {
                            setShowDropdown(false)
                            toast('Coming soon', 'info')
                          }}
                        >
                          Settings
                        </DropdownItem>
                      </DropdownMenu>
                    )}
                  </DropdownContainer>
                  <IconButton onClick={handleLogout} title="Logout">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </IconButton>
                </HeaderActions>
              </>
            ) : (
              <>
                <LoginButton to="/login">
                  Login
                </LoginButton>
                <RegisterButton to="/register">
                  Register
                </RegisterButton>
              </>
            )}
          </HeaderRight>
        </HeaderContent>
      </HeaderNav>
    </HeaderWrapper>
  )
}

export default Header
