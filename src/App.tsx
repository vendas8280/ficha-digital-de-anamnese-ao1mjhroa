/* Main App Component - Handles routing (using react-router-dom), query client and other providers */
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/hooks/use-auth'

import Index from './pages/Index'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import FormDetailPage from './pages/FormDetailPage'
import SettingsPage from './pages/SettingsPage'
import PatientFormPage from './pages/PatientFormPage'
import NotFound from './pages/NotFound'

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/painel" element={<DashboardPage />} />
          <Route path="/painel/ficha/:id" element={<FormDetailPage />} />
          <Route path="/configuracoes" element={<SettingsPage />} />
          {/* Public Patient Form with secure token */}
          <Route path="/f/:token" element={<PatientFormPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
