import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { authStatus } from '@/services/auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Sparkles, Lock, AlertCircle, Loader2, ShieldCheck } from 'lucide-react'

export default function LoginPage() {
  const { signIn, isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [setupRequired, setSetupRequired] = useState(false)

  // Sem sessão válida, nenhum dado é renderizado; com sessão, vai ao painel.
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/painel', { replace: true })
    }
  }, [isAuthenticated, isLoading, navigate])

  // Descobre se o painel ainda não tem administrador (primeiro acesso).
  useEffect(() => {
    let active = true
    authStatus()
      .then((s) => {
        if (active && s && s.setup_required) setSetupRequired(true)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await signIn(email, password)
    if (res.error) {
      setError(
        res.status === 429
          ? 'Muitas tentativas. Tente novamente em alguns minutos.'
          : 'E-mail ou senha incorretos.',
      )
      setLoading(false)
    } else {
      navigate('/painel')
    }
  }

  if (setupRequired) {
    return (
      <div className="min-h-screen bg-[#F7F7FA] flex flex-col justify-center items-center p-4">
        <Card className="max-w-md w-full border-purple-200 shadow-xl bg-white">
          <CardHeader className="space-y-1 pb-4 text-center">
            <div className="mx-auto mb-2 inline-flex items-center justify-center w-14 h-14 bg-[#6B3FA0] text-white rounded-2xl shadow-lg">
              <Sparkles className="w-7 h-7 text-purple-200" />
            </div>
            <CardTitle className="text-lg font-bold text-slate-900">
              Configure o acesso do painel
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Este é o primeiro acesso: defina o e-mail e a senha da clínica.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => navigate('/primeiro-acesso')}
              className="w-full bg-[#6B3FA0] hover:bg-[#5a3389] text-white font-medium py-2.5 text-sm shadow-md"
            >
              <ShieldCheck className="w-4 h-4 mr-2" />
              Configurar acesso
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F7FA] flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-[#6B3FA0] text-white rounded-2xl shadow-lg mb-3">
            <Sparkles className="w-7 h-7 text-purple-200" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#6B3FA0]">Andresa Souza Clinic</h1>
          <p className="text-xs text-slate-600 font-medium mt-1">
            Sistema Integrado de Fichas de Anamnese &amp; Termos Digitais
          </p>
        </div>

        <Card className="border-purple-200 shadow-xl bg-white">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#6B3FA0]" />
              Acesso ao Painel da Clínica
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Entre com suas credenciais para gerenciar as fichas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4" autoComplete="off">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
                  E-mail
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder=""
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold text-slate-700">
                  Senha
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder=""
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="text-sm"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-2.5 rounded-lg text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#6B3FA0] hover:bg-[#5a3389] text-white font-medium py-2.5 text-sm transition-all shadow-md"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>

              <div className="pt-2 text-center border-t">
                <Link
                  to="/esqueci-senha"
                  className="text-xs font-medium text-[#6B3FA0] hover:underline"
                >
                  Esqueci minha senha
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-[11px] text-slate-500 mt-6">
          &copy; {new Date().getFullYear()} Andresa Souza Clinic &bull; Todos os direitos
          reservados.
        </p>
      </div>
    </div>
  )
}
