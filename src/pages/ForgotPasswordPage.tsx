import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { AlertCircle, KeyRound, Loader2, MailCheck } from 'lucide-react'

/**
 * "Esqueci minha senha": pede o e-mail e envia um link de redefinição com
 * validade de 1 hora (via Resend, segredo RESEND_API_KEY do cofre no servidor).
 * A resposta é sempre positiva — nunca revela se o e-mail está cadastrado.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const resetUrlBase = `${window.location.origin}/redefinir-senha`
      const res = await fetch('/backend/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), reset_url_base: resetUrlBase }),
      })
      if (!res.ok) {
        setError('Não foi possível enviar o link. Tente novamente em instantes.')
      } else {
        setSent(true)
      }
    } catch (_) {
      setError('Não foi possível enviar o link. Tente novamente em instantes.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F7FA] flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-[#6B3FA0] text-white rounded-2xl shadow-lg mb-3">
            <KeyRound className="w-7 h-7 text-purple-200" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#6B3FA0]">Esqueci minha senha</h1>
          <p className="text-xs text-slate-600 font-medium mt-1">
            Enviaremos um link de redefinição válido por 1 hora
          </p>
        </div>

        <Card className="border-purple-200 shadow-xl bg-white">
          <CardContent className="pt-6">
            {sent ? (
              <div className="text-center space-y-3">
                <MailCheck className="w-8 h-8 text-green-600 mx-auto" />
                <p className="text-sm font-medium text-slate-900">
                  Se este e-mail estiver cadastrado, você receberá um link de redefinição em
                  instantes.
                </p>
                <p className="text-xs text-slate-500">Verifique também a caixa de spam.</p>
                <Link to="/login">
                  <Button className="bg-[#6B3FA0] hover:bg-[#5a3389] text-white text-sm shadow-md">
                    Voltar ao login
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
                    E-mail de acesso
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="off"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                      Enviando...
                    </>
                  ) : (
                    'Enviar link de redefinição'
                  )}
                </Button>

                <div className="pt-2 text-center border-t">
                  <Link to="/login" className="text-xs font-medium text-[#6B3FA0] hover:underline">
                    Voltar ao login
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
