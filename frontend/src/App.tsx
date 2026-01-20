import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './hooks/useAuth'
import ProtectedRoute from './components/auth/ProtectedRoute'
import Header from './components/layout/Header'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Users from './pages/admin/Users'
import People from './pages/admin/People'
import QuestionGroups from './pages/admin/QuestionGroups'
import Templates from './pages/admin/Templates'
import Flows from './pages/admin/Flows'
import CreateFlow from './pages/admin/CreateFlow'
import EditFlow from './pages/admin/EditFlow'
import Questionnaire from './pages/Questionnaire'
import Documents from './pages/Documents'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <Routes>
            {/* Public routes - no header */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            
            {/* Protected routes - with header */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <div className="min-h-screen bg-gray-50">
                    <Header />
                    <Dashboard />
                  </div>
                </ProtectedRoute>
              }
            />
              
            {/* Admin routes */}
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute requireAdmin>
                  <div className="min-h-screen bg-gray-50">
                    <Header />
                    <Users />
                  </div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/people"
              element={
                <ProtectedRoute requireAdmin>
                  <div className="min-h-screen bg-gray-50">
                    <Header />
                    <People />
                  </div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/question-groups"
              element={
                <ProtectedRoute requireAdmin>
                  <div className="min-h-screen bg-gray-50">
                    <Header />
                    <QuestionGroups />
                  </div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/question-groups/new"
              element={
                <ProtectedRoute requireAdmin>
                  <div className="min-h-screen bg-gray-50">
                    <Header />
                    <QuestionGroups />
                  </div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/question-groups/:id"
              element={
                <ProtectedRoute requireAdmin>
                  <div className="min-h-screen bg-gray-50">
                    <Header />
                    <QuestionGroups />
                  </div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/question-groups/:id/edit"
              element={
                <ProtectedRoute requireAdmin>
                  <div className="min-h-screen bg-gray-50">
                    <Header />
                    <QuestionGroups />
                  </div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/templates"
              element={
                <ProtectedRoute requireAdmin>
                  <div className="min-h-screen bg-gray-50">
                    <Header />
                    <Templates />
                  </div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/flows"
              element={
                <ProtectedRoute requireAdmin>
                  <div className="min-h-screen bg-gray-50">
                    <Header />
                    <Flows />
                  </div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/flows/new"
              element={
                <ProtectedRoute requireAdmin>
                  <div className="min-h-screen bg-gray-50">
                    <Header />
                    <CreateFlow />
                  </div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/flows/:id/edit"
              element={
                <ProtectedRoute requireAdmin>
                  <div className="min-h-screen bg-gray-50">
                    <Header />
                    <EditFlow />
                  </div>
                </ProtectedRoute>
              }
            />
            
            {/* Client routes */}
            <Route
              path="/questionnaire"
              element={
                <ProtectedRoute>
                  <Questionnaire />
                </ProtectedRoute>
              }
            />
            <Route
              path="/documents"
              element={
                <ProtectedRoute>
                  <div className="min-h-screen bg-gray-50">
                    <Header />
                    <Documents />
                  </div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  )
}

export default App
