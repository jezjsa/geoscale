import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ScrollToTop } from './components/ScrollToTop'
import { HomePage } from './pages/HomePage'
import { PlansPage } from './pages/PlansPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { TermsPage } from './pages/TermsPage'
import { SignUpPage } from './pages/SignUpPage'
import { LoginPage } from './pages/LoginPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { DashboardPage } from './pages/DashboardPage'
import { SettingsPage } from './pages/SettingsPage'
import { AccountPage } from './pages/AccountPage'
import { ProjectDetailPage } from './pages/ProjectDetailPage'
import { ViewContentPage } from './pages/ViewContentPage'
import { HeatMapPage } from './pages/HeatMapPage'
import { CombinationDetailPage } from './pages/CombinationDetailPage'
import { WordPressSitemapPage } from './pages/WordPressSitemapPage'
import { TestDataForSEOPage } from './pages/TestDataForSEO'
import { AgencyBenefitsPage } from './pages/AgencyBenefitsPage'
import { FeaturesPage } from './pages/FeaturesPage'
import { ProtectedRoute } from './components/ProtectedRoute'

function App() {
  return (
    <Router>
      <ScrollToTop />
      <Routes>
        {/* Root redirects to home */}
        <Route path="/" element={<HomePage />} />
        
        {/* Public Routes */}
        <Route path="/plans" element={<PlansPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/sign-up" element={<SignUpPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/agency" element={<AgencyBenefitsPage />} />
        
        {/* Protected Routes */}
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/features" element={<ProtectedRoute><FeaturesPage /></ProtectedRoute>} />
        <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/projects/:projectId" element={<ProtectedRoute><ProjectDetailPage /></ProtectedRoute>} />
        <Route path="/projects/:projectId/content/:locationKeywordId" element={<ProtectedRoute><ViewContentPage /></ProtectedRoute>} />
        <Route path="/projects/:projectId/heat-map/:combinationId" element={<ProtectedRoute><HeatMapPage /></ProtectedRoute>} />
        <Route path="/projects/:projectId/ranking/:combinationId" element={<ProtectedRoute><CombinationDetailPage /></ProtectedRoute>} />
        <Route path="/projects/:projectId/sitemap" element={<ProtectedRoute><WordPressSitemapPage /></ProtectedRoute>} />
        <Route path="/test-dataforseo" element={<ProtectedRoute><TestDataForSEOPage /></ProtectedRoute>} />
      </Routes>
    </Router>
  )
}

export default App
