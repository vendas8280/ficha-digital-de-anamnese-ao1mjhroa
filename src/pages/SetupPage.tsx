import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { authService } from '@/services/auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Sparkles, Lock, AlertCircle, Loader2, ShieldCheck } from 'lucide-react'

/**
 * Tela de primeiro acesso: aparece somente quando o painel ainda NÃO tem
 * administrador. A clínica define aqui o e-mail e a senha (nunca um padrão
 * fixo do sistema). Não existe cadastro público — esta tela some depois.
 */
export default function SetupPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSetup = async (e: React.FormEvent) => {
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
      // Confirma que ainda não existe administrador (evita corrida)
      const setupRequired = await authService.getSetupStatus()
      if (!setupRequired) {
        setError('O painel já possui um administrador configurado. Faça login normalmente.')
        setLoading(false)
        return
      }
      await authService.setupAdmin(email.trim().toLowerCase(), password)
      // Já entra com a conta criada
      await signIn(email.trim().toLowerCase(), password)
      navigate('/painel')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg || 'Não foi possível configurar o acesso. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F7FA] flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-[#6B3FA0] text-white rounded-2xl shadow-lg mb-3">
            <Sparkles className="w-7 h-7 text-purple-200" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#6B3FA0]">Andresa Souza Clinic</h1>
          <p className="text-xs text-slate-600 font-medium mt-1">Configuração inicial do painel</p>
        </div>

        <Card className="border-purple-200 shadow-xl bg-white">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#6B3FA0]" />
              Defina o acesso da clínica
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Este é o único usuário do painel. Escolha um e-mail e uma senha fortes — a senha é
              gravada apenas como hash seguro no servidor.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSetup} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
                  E-mail de acesso
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seuemail@clinica.com"
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
                  placeholder="Mínimo de 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm" className="text-xs font-semibold text-slate-700">
                  Confirmar senha
                </Label>
                <Input
                  id="confirm"
                  type="password"
                  placeholder="Repita a senha"
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
                className="w-full bg-[#6B3FA0] hover:bg-[#5a3389] text-white font-medium py-2.5 text-sm transition-all shadow-md"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Configurando...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Criar acesso e entrar
                  </>
                )}
              </Button>
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
