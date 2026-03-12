import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import styled from 'styled-components'
import { useAuth } from '../hooks/useAuth'

const LoginContainer = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #e0f2fe 0%, #bfdbfe 100%);
  padding: 3rem 1rem;
`

const LoginCard = styled.div`
  max-width: 28rem;
  width: 100%;
  background: white;
  border-radius: 1rem;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  padding: 3rem;
`

const LoginHeader = styled.div`
  margin-bottom: 2rem;
  text-align: center;
`

const LoginTitle = styled.h2`
  font-size: 2.5rem;
  font-weight: 700;
  color: #2563eb;
  margin-bottom: 0.5rem;
  line-height: 1.1;
`

const LoginSubtitle = styled.p`
  font-size: 0.875rem;
  color: #2563eb;
`

const LoginForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`

const ErrorMessage = styled.div`
  padding: 1rem;
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.5rem;
  color: #991b1b;
  font-size: 0.875rem;
`

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
`

const FormLabel = styled.label`
  display: block;
  font-size: 1rem;
  font-weight: 500;
  color: #111827;
  margin-bottom: 0.5rem;
`

const FormInput = styled.input`
  width: 100%;
  padding: 0.875rem 1rem;
  font-size: 1rem;
  border: 2px solid #d1d5db;
  border-radius: 0.75rem;
  transition: all 0.2s;
  box-sizing: border-box;

  &::placeholder {
    color: #9ca3af;
  }

  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
`

const PasswordWrapper = styled.div`
  position: relative;
`

const PasswordToggle = styled.button`
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  color: #9ca3af;
  padding: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: #4b5563;
  }

  svg {
    width: 1.25rem;
    height: 1.25rem;
  }
`

const CheckboxWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`

const CheckboxInput = styled.input`
  width: 1rem;
  height: 1rem;
  border-radius: 0.25rem;
  border: 1px solid #d1d5db;
  cursor: pointer;
`

const CheckboxLabel = styled.label`
  font-size: 1rem;
  color: #374151;
  cursor: pointer;
`

const TermsText = styled.div`
  text-align: center;
  font-size: 0.875rem;
  color: #4b5563;
`

const TermsLink = styled(Link)`
  color: #2563eb;
  text-decoration: none;
  font-weight: 500;

  &:hover {
    color: #1d4ed8;
  }
`

const SubmitButton = styled.button`
  width: 100%;
  background-color: #2563eb;
  color: white;
  font-weight: 600;
  font-size: 1.125rem;
  padding: 1rem 1.5rem;
  border: none;
  border-radius: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);

  &:hover {
    background-color: #1d4ed8;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const ForgotPassword = styled.div`
  text-align: center;
`

const ForgotLink = styled(Link)`
  font-size: 0.875rem;
  color: #2563eb;
  text-decoration: none;
  font-weight: 500;

  &:hover {
    color: #1d4ed8;
  }
`

const SignupText = styled.div`
  margin-top: 1.5rem;
  text-align: center;
  font-size: 0.875rem;
  color: #4b5563;
`

const SignupLink = styled(Link)`
  color: #2563eb;
  text-decoration: none;
  font-weight: 600;

  &:hover {
    color: #1d4ed8;
  }
`

const Login: React.FC = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(username, password)
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <LoginContainer>
      <LoginCard>
        <LoginHeader>
          <LoginTitle>Estate-Doc(tor)</LoginTitle>
          <LoginSubtitle>Sign in to your account.</LoginSubtitle>
        </LoginHeader>

        <LoginForm onSubmit={handleSubmit}>
          {error && (
            <ErrorMessage>
              {error}
            </ErrorMessage>
          )}

          <FormGroup>
            <FormLabel htmlFor="username">
              Email Address or Username
            </FormLabel>
            <FormInput
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              placeholder="Email Address or Username"
            />
          </FormGroup>

          <FormGroup>
            <FormLabel htmlFor="password">
              Password
            </FormLabel>
            <PasswordWrapper>
              <FormInput
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="Password"
              />
              <PasswordToggle
                type="button"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </PasswordToggle>
            </PasswordWrapper>
          </FormGroup>

          <CheckboxWrapper>
            <CheckboxInput
              id="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <CheckboxLabel htmlFor="remember-me">
              Keep me signed in
            </CheckboxLabel>
          </CheckboxWrapper>

          <TermsText>
            By continuing, you agree to our{' '}
            <TermsLink to="/terms">
              terms of service
            </TermsLink>
            .
          </TermsText>

          <SubmitButton
            type="submit"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </SubmitButton>

          <ForgotPassword>
            <ForgotLink to="/forgot-password">
              Forgot your password?
            </ForgotLink>
          </ForgotPassword>
        </LoginForm>

        <SignupText>
          Don't have an account?{' '}
          <SignupLink to="/register">
            Create one now
          </SignupLink>
        </SignupText>
      </LoginCard>
    </LoginContainer>
  )
}

export default Login
