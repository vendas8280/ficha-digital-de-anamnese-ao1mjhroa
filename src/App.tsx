/* Main App Component - Handles routing (using react-router-dom), query client and other providers */
import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { initSkipBannerObserver } from '@/lib/skipBanner'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/hooks/use-auth'
import RequireAuth from '@/components/RequireAuth'

import Index from './pages/Index'
import LoginPage from './pages/LoginPage'
import SetupPage from './pages/SetupPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import AgendaPage from './pages/AgendaPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import FormDetailPage from './pages/FormDetailPage'
import SettingsPage from './pages/SettingsPage'
import PatientFormPage from './pages/PatientFormPage'
import NotFound from './pages/NotFound'

const App = () => {
  useEffect(() => {
    const cleanup = initSkipBannerObserver()
    return cleanup
  }, [])

  return (
    <BrowserRouter>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/primeiro-acesso" element={<SetupPage />} />
            <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
            <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
            {/* Todas as rotas do painel exigem sessão válida confirmada no servidor */}
            <Route
              path="/agenda"
              element={
                <RequireAuth>
                  <AgendaPage />
                </RequireAuth>
              }
            />
            <Route
              path="/painel"
              element={
                <RequireAuth>
                  <DashboardPage />
                </RequireAuth>
              }
            />
            <Route
              path="/painel/ficha/:id"
              element={
                <RequireAuth>
                  <FormDetailPage />
                </RequireAuth>
              }
            />
            <Route
              path="/configuracoes"
              element={
                <RequireAuth>
                  <SettingsPage />
                </RequireAuth>
              }
            />
            {/* Public Patient Form with secure token */}
            <Route path="/f/:token" element={<PatientFormPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
