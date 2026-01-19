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
import QuestionGroups from './pages/admin/QuestionGroups'

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
              path="/admin/templates"
              element={
                <ProtectedRoute requireAdmin>
                  <div className="min-h-screen bg-gray-50">
                    <Header />
                    <div className="p-8">
                      <h1 className="text-2xl font-bold">Document Templates</h1>
                      <p className="text-gray-600 mt-2">Coming soon...</p>
                    </div>
                  </div>
                </ProtectedRoute>
              }
            />
            
            {/* Client routes */}
            <Route
              path="/questionnaire"
              element={
                <ProtectedRoute>
                  <div className="min-h-screen bg-gray-50">
                    <Header />
                    <div className="p-8">
                      <h1 className="text-2xl font-bold">Questionnaire</h1>
                      <p className="text-gray-600 mt-2">Coming soon...</p>
                    </div>
                  </div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/documents"
              element={
                <ProtectedRoute>
                  <div className="min-h-screen bg-gray-50">
                    <Header />
                    <div className="p-8">
                      <h1 className="text-2xl font-bold">My Documents</h1>
                      <p className="text-gray-600 mt-2">Coming soon...</p>
                    </div>
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
