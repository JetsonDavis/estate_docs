import React from 'react'
import styled from 'styled-components'
import { useAuth } from '../hooks/useAuth'
import { Link } from 'react-router-dom'

const DashboardContainer = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #e0f2fe 0%, #bfdbfe 100%);
  padding: 3rem 1rem;
`

const DashboardContent = styled.div`
  max-width: 1200px;
  margin: 0 auto;
`

const DashboardHeader = styled.div`
  margin-bottom: 2rem;
`

const DashboardTitle = styled.h1`
  font-size: 2rem;
  font-weight: 700;
  color: #111827;
  margin-bottom: 0.5rem;
`

const DashboardSubtitle = styled.p`
  font-size: 0.875rem;
  color: #6b7280;
`

const DashboardGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
  margin-bottom: 2rem;

  @media (min-width: 640px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: 1024px) {
    grid-template-columns: repeat(3, 1fr);
  }
`

const DashboardCard = styled.div`
  background: white;
  border-radius: 1rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  padding: 1.5rem;
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  }
`

const CardHeader = styled.div`
  display: flex;
  align-items: flex-start;
  margin-bottom: 1rem;
`

const CardIcon = styled.svg`
  flex-shrink: 0;
  width: 2.5rem;
  height: 2.5rem;
  color: #2563eb;
`

const CardContent = styled.div`
  margin-left: 1rem;
  flex: 1;
`

const CardTitle = styled.h3`
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
  margin-bottom: 0.25rem;
`

const CardDescription = styled.p`
  font-size: 0.875rem;
  color: #6b7280;
`

const CardButton = styled(Link)<{ $secondary?: boolean }>`
  width: 100%;
  background-color: ${props => props.$secondary ? '#f3f4f6' : '#2563eb'};
  color: ${props => props.$secondary ? '#374151' : 'white'};
  font-weight: 600;
  font-size: 0.875rem;
  padding: 0.625rem 1rem;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: background-color 0.2s;
  text-decoration: none;
  display: inline-block;
  text-align: center;

  &:hover {
    background-color: ${props => props.$secondary ? '#e5e7eb' : '#1d4ed8'};
  }
`

const InfoBanner = styled.div`
  background-color: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 0.75rem;
  padding: 1rem;
  display: flex;
  align-items: flex-start;
`

const InfoIcon = styled.svg`
  flex-shrink: 0;
  width: 1.25rem;
  height: 1.25rem;
  color: #3b82f6;
`

const InfoContent = styled.div`
  margin-left: 0.75rem;
`

const InfoTitle = styled.h3`
  font-size: 0.875rem;
  font-weight: 600;
  color: #1e40af;
  margin-bottom: 0.5rem;
`

const InfoText = styled.p`
  font-size: 0.875rem;
  color: #1e3a8a;
  line-height: 1.5;
`

const Dashboard: React.FC = () => {
  const { user, isAdmin } = useAuth()

  return (
    <DashboardContainer>
      <DashboardContent>
        <DashboardHeader>
          <DashboardTitle>
            Welcome, {user?.full_name || user?.username}!
          </DashboardTitle>
          <DashboardSubtitle>
            {isAdmin ? 'Admin Dashboard' : 'Client Dashboard'}
          </DashboardSubtitle>
        </DashboardHeader>

        <DashboardGrid>
          {isAdmin ? (
            <>
              <DashboardCard>
                <CardHeader>
                  <CardIcon fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </CardIcon>
                  <CardContent>
                    <CardTitle>Question Groups</CardTitle>
                    <CardDescription>Create and manage question groups</CardDescription>
                  </CardContent>
                </CardHeader>
                <CardButton to="/admin/question-groups" $secondary>
                  Manage Questions
                </CardButton>
              </DashboardCard>

              <DashboardCard>
                <CardHeader>
                  <CardIcon fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </CardIcon>
                  <CardContent>
                    <CardTitle>Document Templates</CardTitle>
                    <CardDescription>Manage document templates</CardDescription>
                  </CardContent>
                </CardHeader>
                <CardButton to="/admin/templates" $secondary>
                  Manage Templates
                </CardButton>
              </DashboardCard>

              <DashboardCard>
                <CardHeader>
                  <CardIcon fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </CardIcon>
                  <CardContent>
                    <CardTitle>Document Flows</CardTitle>
                    <CardDescription>Manage document workflows</CardDescription>
                  </CardContent>
                </CardHeader>
                <CardButton to="/admin/flows" $secondary>
                  Manage Flows
                </CardButton>
              </DashboardCard>

              <DashboardCard>
                <CardHeader>
                  <CardIcon fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </CardIcon>
                  <CardContent>
                    <CardTitle>Input Form</CardTitle>
                    <CardDescription>View and manage active sessions</CardDescription>
                  </CardContent>
                </CardHeader>
                <CardButton to="/document" $secondary>
                  View Input Forms
                </CardButton>
              </DashboardCard>

              <DashboardCard>
                <CardHeader>
                  <CardIcon fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </CardIcon>
                  <CardContent>
                    <CardTitle>Completed Documents</CardTitle>
                    <CardDescription>View generated documents</CardDescription>
                  </CardContent>
                </CardHeader>
                <CardButton to="/documents" $secondary>
                  View Documents
                </CardButton>
              </DashboardCard>
            </>
          ) : (
            <>
              <DashboardCard>
                <CardHeader>
                  <CardIcon fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </CardIcon>
                  <CardContent>
                    <CardTitle>Start Document</CardTitle>
                    <CardDescription>Begin answering questions</CardDescription>
                  </CardContent>
                </CardHeader>
                <CardButton to="/document">
                  Start
                </CardButton>
              </DashboardCard>

              <DashboardCard>
                <CardHeader>
                  <CardIcon fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </CardIcon>
                  <CardContent>
                    <CardTitle>My Documents</CardTitle>
                    <CardDescription>View generated documents</CardDescription>
                  </CardContent>
                </CardHeader>
                <CardButton to="/documents" $secondary>
                  View Documents
                </CardButton>
              </DashboardCard>
            </>
          )}
        </DashboardGrid>

        <InfoBanner>
          <InfoIcon fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </InfoIcon>
          <InfoContent>
            <InfoTitle>Welcome to Estate Doc(tor)</InfoTitle>
            <InfoText>
              {isAdmin
                ? 'As an administrator, you can manage users, create question groups, design document templates, and configure document flows.'
                : 'Complete documents to generate personalized estate documents based on your answers.'}
            </InfoText>
          </InfoContent>
        </InfoBanner>
      </DashboardContent>
    </DashboardContainer>
  )
}

export default Dashboard
