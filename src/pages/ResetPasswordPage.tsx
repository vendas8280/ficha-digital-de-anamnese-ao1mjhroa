import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { AlertCircle, KeyRound, Loader2, MailCheck } from 'lucide-react'

const GENERIC = 'Link inválido ou expirado. Solicite um novo.'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/backend/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.message || GENERIC)
        return
      }
      setDone(true)
      setTimeout(() => navigate('/login', { replace: true }), 3000)
    } catch (_) {
      setError(GENERIC)
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-[#F7F7FA] flex flex-col justify-center items-center p-4">
        <Card className="max-w-md w-full border-purple-200 shadow-xl bg-white">
          <CardHeader className="space-y-1 pb-4 text-center">
            <CardTitle className="text-lg font-bold text-slate-900 flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              {GENERIC}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link to="/login">
              <Button className="w-full bg-[#6B3FA0] hover:bg-[#5a3389] text-white text-sm shadow-md">
                Voltar ao login
              </Button>
            </Link>
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
            <KeyRound className="w-7 h-7 text-purple-200" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#6B3FA0]">Redefinir senha</h1>
          <p className="text-xs text-slate-600 font-medium mt-1">
            Defina uma nova senha de acesso ao painel
          </p>
        </div>

        <Card className="border-purple-200 shadow-xl bg-white">
          <CardContent className="pt-6">
            {done ? (
              <div className="text-center space-y-3">
                <MailCheck className="w-8 h-8 text-green-600 mx-auto" />
                <p className="text-sm font-medium text-slate-900">Senha redefinida com sucesso!</p>
                <p className="text-xs text-slate-500">
                  Você será redirecionado para o login em instantes...
                </p>
                <Link to="/login">
                  <Button className="bg-[#6B3FA0] hover:bg-[#5a3389] text-white text-sm shadow-md">
                    Ir para o login
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs font-semibold text-slate-700">
                    Nova senha
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mínimo de 8 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm" className="text-xs font-semibold text-slate-700">
                    Confirmar nova senha
                  </Label>
                  <Input
                    id="confirm"
                    type="password"
                    placeholder="Repita a nova senha"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
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
                  className="w-full bg-[#6B3FA0] hover:bg-[#5a3389] text-white font-medium py-2.5 text-sm shadow-md"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Redefinir senha'
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
