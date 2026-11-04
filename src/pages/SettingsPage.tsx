import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { clinicSettingsService } from '@/services/forms'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Building,
  Mail,
  Phone,
  Save,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  UserCheck,
  MapPin,
  FileBadge,
  Bell,
  Clock,
  FlaskConical,
  FileText,
} from 'lucide-react'
import { ReminderTemplateEditor } from '@/components/ReminderTemplateEditor'
import {
  DEFAULT_REMINDER_SUBJECT_24H,
  DEFAULT_REMINDER_SUBJECT_2H,
  DEFAULT_REMINDER_BODY,
  validateReminderTemplate,
} from '@/lib/reminderTemplates'

export default function SettingsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [clinicName, setClinicName] = useState('Andresa Souza Clinic')
  const [notificationEmail, setNotificationEmail] = useState('gihobaicn@hotmail.com')
  const [senderEmail, setSenderEmail] = useState(
    'Ficha Digital - Andresa Souza Clinic <ficha@andresasouzaclinic.com.br>',
  )
  const [technicalResponsible, setTechnicalResponsible] = useState('Dra. Andresa Souza')
  const [professionalRegister, setProfessionalRegister] = useState('')
  const [clinicAddress, setClinicAddress] = useState('')
  const [phone, setPhone] = useState('')

  // Campos de lembrete adicionados pela Etapa 3
  const [reminderSenderEmail, setReminderSenderEmail] = useState(
    'Ficha Digital - Andresa Souza Clinic <ficha@andresasouza.com.br>',
  )
  const [reminderMinAdvanceHours, setReminderMinAdvanceHours] = useState<'6' | '12' | '24'>('6')
  const [reminderEnable24h, setReminderEnable24h] = useState(true)
  const [reminderEnable2h, setReminderEnable2h] = useState(true)
  const [reminderTestMode, setReminderTestMode] = useState(true)

  // Textos dos e-mails de lembrete (Etapa 5)
  const [reminderSubject24h, setReminderSubject24h] = useState(DEFAULT_REMINDER_SUBJECT_24H)
  const [reminderBody24h, setReminderBody24h] = useState(DEFAULT_REMINDER_BODY)
  const [reminderSubject2h, setReminderSubject2h] = useState(DEFAULT_REMINDER_SUBJECT_2H)
  const [reminderBody2h, setReminderBody2h] = useState(DEFAULT_REMINDER_BODY)
  const [sendingTest24h, setSendingTest24h] = useState(false)
  const [sendingTest2h, setSendingTest2h] = useState(false)

  // Check auth
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login')
    }
  }, [authLoading, isAuthenticated, navigate])

  // Load current settings
  useEffect(() => {
    async function load() {
      try {
        const data = await clinicSettingsService.getSettings()
        if (data) {
          setClinicName(data.clinic_name)
          setNotificationEmail(data.notification_email)
          if (data.phone) setPhone(data.phone)
          if (data.sender_email) setSenderEmail(data.sender_email)
          if (data.technical_responsible) setTechnicalResponsible(data.technical_responsible)
          if (data.professional_register) setProfessionalRegister(data.professional_register)
          if (data.clinic_address) setClinicAddress(data.clinic_address)

          // Lembretes
          if (data.reminder_sender_email) {
            setReminderSenderEmail(data.reminder_sender_email)
          } else if (data.sender_email) {
            setReminderSenderEmail(data.sender_email)
          }
          if (
            data.reminder_min_advance_hours === '6' ||
            data.reminder_min_advance_hours === '12' ||
            data.reminder_min_advance_hours === '24'
          ) {
            setReminderMinAdvanceHours(data.reminder_min_advance_hours)
          }
          if (typeof data.reminder_enable_24h === 'boolean') {
            setReminderEnable24h(data.reminder_enable_24h)
          }
          if (typeof data.reminder_enable_2h === 'boolean') {
            setReminderEnable2h(data.reminder_enable_2h)
          }
          if (typeof data.reminder_test_mode === 'boolean') {
            setReminderTestMode(data.reminder_test_mode)
          }

          // Textos dos lembretes
          if (data.reminder_subject_24h) {
            setReminderSubject24h(data.reminder_subject_24h)
          }
          if (data.reminder_body_24h) {
            setReminderBody24h(data.reminder_body_24h)
          }
          if (data.reminder_subject_2h) {
            setReminderSubject2h(data.reminder_subject_2h)
          }
          if (data.reminder_body_2h) {
            setReminderBody2h(data.reminder_body_2h)
          }
        }
      } catch (err) {
        console.error('Erro ao carregar configurações:', err)
      } finally {
        setLoading(false)
      }
    }

    if (isAuthenticated) {
      load()
    }
  }, [isAuthenticated])

  const validateSenderFormat = (sender: string): boolean => {
    // Deve ser no formato: Nome <email@dominio.com>
    // Exige Nome, abertura <, usuário, arroba, domínio com ponto e fechamento >
    const regex = /^.+<[^\s@]+@[^\s@]+\.[^\s@]+>$/
    return regex.test(sender.trim())
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validação estrita dos textos dos lembretes (Etapa 5)
    const val24h = validateReminderTemplate(reminderSubject24h, reminderBody24h)
    if (!val24h.valid) {
      toast({
        title: 'Modelo 24h inválido',
        description: val24h.error,
        variant: 'destructive',
      })
      return
    }

    const val2h = validateReminderTemplate(reminderSubject2h, reminderBody2h)
    if (!val2h.valid) {
      toast({
        title: 'Modelo 2h inválido',
        description: val2h.error,
        variant: 'destructive',
      })
      return
    }

    // Validação estrita dos campos de remetente
    if (!validateSenderFormat(reminderSenderEmail)) {
      toast({
        title: 'Formato de remetente inválido',
        description: 'Informe o remetente completo, no formato Nome <email@dominio.com>.',
        variant: 'destructive',
      })
      return
    }

    if (!validateSenderFormat(senderEmail)) {
      toast({
        title: 'Formato de remetente inválido',
        description: 'Informe o remetente completo, no formato Nome <email@dominio.com>.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      await clinicSettingsService.updateSettings({
        clinic_name: clinicName,
        notification_email: notificationEmail,
        phone,
        sender_email: senderEmail.trim(),
        technical_responsible: technicalResponsible,
        professional_register: professionalRegister,
        clinic_address: clinicAddress,
        reminder_sender_email: reminderSenderEmail.trim(),
        reminder_min_advance_hours: reminderMinAdvanceHours,
        reminder_enable_24h: reminderEnable24h,
        reminder_enable_2h: reminderEnable2h,
        reminder_test_mode: reminderTestMode,
        reminder_subject_24h: reminderSubject24h.trim(),
        reminder_body_24h: reminderBody24h.trim(),
        reminder_subject_2h: reminderSubject2h.trim(),
        reminder_body_2h: reminderBody2h.trim(),
      })
      toast({
        title: 'Configurações salvas com sucesso!',
        description:
          'Dados da clínica, remetentes, textos de lembrete e automações salvos com sucesso.',
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

  // Disparo de teste para o e-mail de comprovantes da clínica (independente do modo de teste)
  const handleSendTest = async (kind: '24h' | '2h') => {
    const subject = kind === '24h' ? reminderSubject24h : reminderSubject2h
    const body = kind === '24h' ? reminderBody24h : reminderBody2h

    // Valida antes de disparar
    const validation = validateReminderTemplate(subject, body)
    if (!validation.valid) {
      toast({
        title: 'Modelo inválido para envio de teste',
        description: validation.error,
        variant: 'destructive',
      })
      return
    }

    if (kind === '24h') setSendingTest24h(true)
    else setSendingTest2h(true)

    try {
      const res = await clinicSettingsService.testReminderTemplate({
        kind,
        subject,
        body,
      })
      toast({
        title: 'E-mail de teste disparado com sucesso!',
        description: `Entregue para ${res.recipient} com o assunto "${res.subject}".`,
      })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Falha ao enviar e-mail de teste.'
      toast({
        title: 'Erro no envio de teste',
        description: errMsg,
        variant: 'destructive',
      })
    } finally {
      if (kind === '24h') setSendingTest24h(false)
      else setSendingTest2h(false)
    }
  }

  const handleReset24h = () => {
    setReminderSubject24h(DEFAULT_REMINDER_SUBJECT_24H)
    setReminderBody24h(DEFAULT_REMINDER_BODY)
    toast({
      title: 'Texto padrão restaurado (24h)',
      description: 'Lembre-se de clicar em "Salvar Alterações" para gravar.',
    })
  }

  const handleReset2h = () => {
    setReminderSubject2h(DEFAULT_REMINDER_SUBJECT_2H)
    setReminderBody2h(DEFAULT_REMINDER_BODY)
    toast({
      title: 'Texto padrão restaurado (2h)',
      description: 'Lembre-se de clicar em "Salvar Alterações" para gravar.',
    })
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
                Remetente Oficial, Dados Legais e Notificações
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-8 space-y-6">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Mail className="w-5 h-5 text-rose-800" />
              Remetente e Notificações de E-mail
            </CardTitle>
            <CardDescription className="text-xs">
              Configure o remetente oficial com domínio da clínica e os destinatários das cópias dos
              prontuários.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="senderEmail"
                  className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                >
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  Remetente Oficial dos E-mails (Domínio Próprio) *
                </Label>
                <Input
                  id="senderEmail"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  required
                  placeholder="Ficha Digital - Andresa Souza Clinic <ficha@andresasouzaclinic.com.br>"
                  className="text-sm font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  Padrão exigido:{' '}
                  <code>
                    Ficha Digital - Andresa Souza Clinic &lt;ficha@andresasouzaclinic.com.br&gt;
                  </code>
                  . Utilizado no envio das fichas e comprovantes aos pacientes e clínica.
                </p>
              </div>

              <div className="space-y-1.5 pt-1 border-t border-slate-100">
                <Label
                  htmlFor="reminderSenderEmail"
                  className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                >
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  E-mail do remetente (Lembretes) *
                </Label>
                <Input
                  id="reminderSenderEmail"
                  value={reminderSenderEmail}
                  onChange={(e) => setReminderSenderEmail(e.target.value)}
                  required
                  placeholder="Ficha Digital - Andresa Souza Clinic <ficha@andresasouza.com.br>"
                  className="text-sm font-mono w-full"
                />
                <p className="text-[11px] text-muted-foreground">
                  Aparece como remetente do e-mail de lembrete enviado à paciente. Padrão:{' '}
                  <code>
                    Ficha Digital - Andresa Souza Clinic &lt;ficha@andresasouza.com.br&gt;
                  </code>
                  .
                </p>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="reminderMinAdvance"
                  className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                >
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  Antecedência mínima *
                </Label>
                <Select
                  value={reminderMinAdvanceHours}
                  onValueChange={(val: '6' | '12' | '24') => setReminderMinAdvanceHours(val)}
                >
                  <SelectTrigger id="reminderMinAdvance" className="text-sm w-full sm:w-64">
                    <SelectValue placeholder="Selecione a antecedência" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6">6 horas antes</SelectItem>
                    <SelectItem value="12">12 horas antes</SelectItem>
                    <SelectItem value="24">24 horas antes</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Tempo mínimo antes do procedimento para considerar o lembrete elegível.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    E-mail que Recebe os Comprovantes (Clínica) *
                  </Label>
                  <Input
                    id="notifEmail"
                    type="email"
                    value={notificationEmail}
                    onChange={(e) => setNotificationEmail(e.target.value)}
                    required
                    className="text-sm font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="techResp"
                    className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                    Profissional Responsável
                  </Label>
                  <Input
                    id="techResp"
                    value={technicalResponsible}
                    onChange={(e) => setTechnicalResponsible(e.target.value)}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="profReg"
                    className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                  >
                    <FileBadge className="w-3.5 h-3.5 text-slate-500" />
                    Registro Profissional
                  </Label>
                  <Input
                    id="profReg"
                    value={professionalRegister}
                    onChange={(e) => setProfessionalRegister(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="phone"
                  className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                >
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  Telefone / WhatsApp da Clínica
                </Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 99999-0000"
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="address"
                  className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                >
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  Endereço Completo da Clínica
                </Label>
                <Input
                  id="address"
                  value={clinicAddress}
                  onChange={(e) => setClinicAddress(e.target.value)}
                  className="text-sm"
                />
              </div>

              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-950 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-rose-800 shrink-0 mt-0.5" />
                <div>
                  <strong>Envio Transacional em Duas Vias Ativo:</strong>
                  <p className="text-rose-900 mt-0.5">
                    O sistema envia o e-mail oficial com o PDF completo da ficha para o e-mail do
                    paciente e para o e-mail da clínica configurado acima, usando o remetente
                    oficial da Andresa Souza Clinic.
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

        {/* Card novo "Lembretes automáticos" com 3 interruptores ligados por padrão */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Bell className="w-5 h-5 text-rose-800" />
              Lembretes automáticos
            </CardTitle>
            <CardDescription className="text-xs">
              Controle o disparo automático dos lembretes aos pacientes antes dos procedimentos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="flex items-center justify-between gap-4 p-3.5 rounded-lg border border-slate-200 bg-white">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="enable24h"
                    className="text-xs font-semibold text-slate-800 cursor-pointer flex items-center gap-1.5"
                  >
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    Lembrete 24 horas antes
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Envia lembrete na véspera com o assunto: &quot;Lembrete: seu procedimento é
                    amanhã às [hora]&quot;.
                  </p>
                </div>
                <Switch
                  id="enable24h"
                  checked={reminderEnable24h}
                  onCheckedChange={setReminderEnable24h}
                />
              </div>

              <div className="flex items-center justify-between gap-4 p-3.5 rounded-lg border border-slate-200 bg-white">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="enable2h"
                    className="text-xs font-semibold text-slate-800 cursor-pointer flex items-center gap-1.5"
                  >
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    Lembrete 2 horas antes
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Envia lembrete no próprio dia com o assunto: &quot;Lembrete: seu procedimento é
                    hoje às [hora]&quot;.
                  </p>
                </div>
                <Switch
                  id="enable2h"
                  checked={reminderEnable2h}
                  onCheckedChange={setReminderEnable2h}
                />
              </div>

              <div className="flex items-center justify-between gap-4 p-3.5 rounded-lg border border-amber-200 bg-amber-50/50">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="testMode"
                    className="text-xs font-semibold text-amber-950 cursor-pointer flex items-center gap-1.5"
                  >
                    <FlaskConical className="w-3.5 h-3.5 text-amber-700" />
                    Modo de teste
                  </Label>
                  <p className="text-[11px] text-amber-900/80">
                    Enquanto ligado, tudo vai para o e-mail de comprovantes da clínica com
                    &quot;[TESTE]&quot; no assunto, e a paciente não recebe.
                  </p>
                </div>
                <Switch
                  id="testMode"
                  checked={reminderTestMode}
                  onCheckedChange={setReminderTestMode}
                />
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

        {/* Card novo "Textos dos e-mails" posicionado abaixo de Lembretes automáticos */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-rose-800" />
              Textos dos e-mails
            </CardTitle>
            <CardDescription className="text-xs">
              Personalize o assunto e o corpo dos lembretes automáticos enviados aos pacientes. Os
              campos entre chaves duplas serão substituídos automaticamente pelos dados de cada
              agendamento.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleSave} className="space-y-6">
              {/* Item 1: Lembrete ao paciente (24h) */}
              <ReminderTemplateEditor
                kind="24h"
                title="Lembrete ao paciente (24h)"
                description="Disparado 24 horas antes do horário do procedimento (véspera)."
                subject={reminderSubject24h}
                body={reminderBody24h}
                defaultSubject={DEFAULT_REMINDER_SUBJECT_24H}
                defaultBody={DEFAULT_REMINDER_BODY}
                clinicName={clinicName}
                clinicAddress={clinicAddress}
                clinicPhone={phone}
                notificationEmail={notificationEmail}
                onSubjectChange={setReminderSubject24h}
                onBodyChange={setReminderBody24h}
                onResetToDefault={handleReset24h}
                onSendTest={() => handleSendTest('24h')}
                sendingTest={sendingTest24h}
              />

              {/* Item 2: Lembrete ao paciente (2h) */}
              <ReminderTemplateEditor
                kind="2h"
                title="Lembrete ao paciente (2h)"
                description="Disparado 2 horas antes do procedimento no próprio dia."
                subject={reminderSubject2h}
                body={reminderBody2h}
                defaultSubject={DEFAULT_REMINDER_SUBJECT_2H}
                defaultBody={DEFAULT_REMINDER_BODY}
                clinicName={clinicName}
                clinicAddress={clinicAddress}
                clinicPhone={phone}
                notificationEmail={notificationEmail}
                onSubjectChange={setReminderSubject2h}
                onBodyChange={setReminderBody2h}
                onResetToDefault={handleReset2h}
                onSendTest={() => handleSendTest('2h')}
                sendingTest={sendingTest2h}
              />

              <div className="pt-2 flex items-center justify-between gap-4 border-t border-slate-200">
                <p className="text-[11px] text-muted-foreground">
                  As alterações salvas entram em vigor para todos os próximos disparos automáticos.
                </p>
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-rose-900 hover:bg-rose-950 text-white text-xs gap-1.5 px-6 shrink-0"
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
