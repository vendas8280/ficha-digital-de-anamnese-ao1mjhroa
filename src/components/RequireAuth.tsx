import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { Sparkles } from 'lucide-react'

/**
 * Guarda de rotas privadas: nenhuma tela do painel renderiza dados de paciente
 * antes da sessão ser confirmada com o servidor (authRefresh).
 */
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    // Tela de confirmação de sessão — nunca dados, nunca o conteúdo protegido.
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-[#F7F7FA] p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-[#6B3FA0] text-white rounded-2xl shadow-lg">
            <Sparkles className="w-7 h-7 text-purple-200" />
          </div>
          <p className="text-sm font-medium text-[#6B3FA0]">Verificando sua sessão...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
