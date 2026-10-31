import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Sparkles, Lock, AlertCircle, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const { signIn, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('gihobaicn@hotmail.com')
  const [password, setPassword] = useState('Skip@Pass')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // If already logged in, redirect to dashboard
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/painel')
    }
  }, [isAuthenticated, navigate])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await signIn(email, password)
    if (res.error) {
      setError('E-mail ou senha incorretos. Verifique suas credenciais.')
      setLoading(false)
    } else {
      navigate('/painel')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50/80 via-white to-rose-100/50 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-rose-900 text-white rounded-2xl shadow-lg mb-3">
            <Sparkles className="w-7 h-7 text-rose-200" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-rose-950">Andresa Souza Clinic</h1>
          <p className="text-xs text-rose-800 font-medium mt-1">
            Sistema Integrado de Fichas de Anamnese & Termos Digitais
          </p>
        </div>

        <Card className="border-rose-200 shadow-xl bg-white/95 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Lock className="w-4 h-4 text-rose-700" />
              Acesso ao Painel da Clínica
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Entre com suas credenciais de administradora para gerenciar as fichas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
                  E-mail da Clínica
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@andresasouza.com"
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
                  placeholder="••••••••"
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
                className="w-full bg-rose-900 hover:bg-rose-950 text-white font-medium py-2.5 text-sm transition-all shadow-md"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar no Painel'
                )}
              </Button>

              <div className="pt-2 text-center text-xs text-muted-foreground border-t">
                Credenciais padrão para teste: <br />
                <span className="font-mono text-[11px] text-slate-800">
                  gihobaicn@hotmail.com / Skip@Pass
                </span>
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
