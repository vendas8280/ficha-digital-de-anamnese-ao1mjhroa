import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { clinicSettingsService } from '@/services/forms'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Save, Mail, Building, Phone, Loader2, CheckCircle2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function SettingsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [clinicName, setClinicName] = useState('Andresa Souza Clinic')
  const [notificationEmail, setNotificationEmail] = useState('gihobaicn@hotmail.com')
  const [phone, setPhone] = useState('(11) 99999-8888')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login')
    }
  }, [authLoading, isAuthenticated, navigate])

  useEffect(() => {
    async function load() {
      if (!isAuthenticated) return
      setLoading(true)
      try {
        const settings = await clinicSettingsService.getSettings()
        if (settings) {
          setClinicName(settings.clinic_name)
          setNotificationEmail(settings.notification_email)
          if (settings.phone) setPhone(settings.phone)
        }
      } catch {
        // default fallback
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isAuthenticated])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await clinicSettingsService.updateSettings({
        clinic_name: clinicName,
        notification_email: notificationEmail,
        phone,
      })
      toast({
        title: 'Configurações salvas!',
        description: 'Os e-mails de comprovante das fichas serão direcionados para este endereço.',
      })
    } catch {
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível atualizar as configurações.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-rose-900 animate-spin mb-2" />
        <p className="text-xs text-slate-600">Carregando configurações...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/70 pb-16">
      {/* Top Header */}
      <header className="bg-white border-b border-rose-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-xs gap-1 text-slate-600 hover:text-rose-900"
            >
              <Link to="/painel">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Voltar ao Painel
              </Link>
            </Button>
            <div>
              <h1 className="text-base font-bold text-rose-950">Configurações da Clínica</h1>
              <p className="text-xs text-rose-700 font-medium">
                Notificações e Recebimento de Comprovantes
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-8">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Mail className="w-5 h-5 text-rose-800" />
              E-mail de Notificações da Clínica
            </CardTitle>
            <CardDescription className="text-xs">
              Sempre que um paciente preencher e assinar uma ficha on-line, uma cópia completa do
              comprovante de anamnese será enviada automaticamente para este e-mail.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="clinicName"
                  className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                >
                  <Building className="w-3.5 h-3.5 text-slate-500" />
                  Nome da Clínica
                </Label>
                <Input
                  id="clinicName"
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  required
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="notifEmail"
                  className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                >
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  E-mail que Recebe os Comprovantes *
                </Label>
                <Input
                  id="notifEmail"
                  type="email"
                  value={notificationEmail}
                  onChange={(e) => setNotificationEmail(e.target.value)}
                  required
                  placeholder="clinica@andresasouza.com"
                  className="text-sm font-medium"
                />
                <p className="text-[11px] text-muted-foreground">
                  Garante que a administradora e a equipe clínica recebam cópias imediatas de cada
                  prontuário preenchido.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="phone"
                  className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                >
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  Telefone / WhatsApp de Contato
                </Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="text-sm"
                />
              </div>

              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-950 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-rose-800 shrink-0 mt-0.5" />
                <div>
                  <strong>Serviço de E-mail Transacional Ativo:</strong>
                  <p className="text-rose-900 mt-0.5">
                    O sistema envia automaticamente o comprovante para o e-mail do paciente e para o
                    e-mail da clínica configurado acima assim que a assinatura é concluída.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-rose-900 hover:bg-rose-950 text-white text-xs gap-1.5 px-6"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      Salvar Alterações
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
