import React, { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { formsService, appointmentsService } from '@/services/forms'
import type {
  FormSubmissionRecord,
  ProcedureAppointmentRecord,
  AppointmentReminderRecord,
} from '@/services/forms'
import { ReminderStateBadge } from '@/components/ReminderStateBadge'
import type { FormType } from '@/types/form'
import { formatDateBR } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, FileCheck } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Sparkles,
  Plus,
  Search,
  Copy,
  Check,
  Eye,
  Settings,
  LogOut,
  RefreshCw,
  ExternalLink,
  MessageCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Mail,
  Loader2,
  Send,
  Trash2,
  CalendarDays,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'

export default function DashboardPage() {
  const { isAuthenticated, isLoading: authLoading, signOut } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [forms, setForms] = useState<FormSubmissionRecord[]>([])
  // Agendamentos (base da coluna "Lembrete", vinculados por form_submission)
  const [appointments, setAppointments] = useState<ProcedureAppointmentRecord[]>([])
  // Lembretes programados/enviados (para detalhes no hover da coluna "Lembrete")
  const [reminders, setReminders] = useState<AppointmentReminderRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('todos')
  const [typeFilter, setTypeFilter] = useState<string>('todos')

  // Generate Link Dialog
  const [openNewLinkDialog, setOpenNewLinkDialog] = useState(false)
  const [newFormType, setNewFormType] = useState<FormType>('geral')
  const [newPatientName, setNewPatientName] = useState('')
  const [newPatientPhone, setNewPatientPhone] = useState('')
  const [creatingLink, setCreatingLink] = useState(false)
  const [createdLinkUrl, setCreatedLinkUrl] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [retryingReminderId, setRetryingReminderId] = useState<string | null>(null)

  // Agendamento opcional (seção do gerador de ficha)
  const [showScheduling, setShowScheduling] = useState(false)
  const [schedDate, setSchedDate] = useState('') // YYYY-MM-DD
  const [schedTime, setSchedTime] = useState('') // HH:MM
  const [notifyPatient, setNotifyPatient] = useState(true)

  const resetScheduling = () => {
    setShowScheduling(false)
    setSchedDate('')
    setSchedTime('')
    setNotifyPatient(true)
  }

  // Ex.: "2026-11-05" -> "05/11/2026" (sem deslocamento de fuso)
  const formatSchedDateBR = (iso: string) => {
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
  }

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login')
    }
  }, [authLoading, isAuthenticated, navigate])

  const loadForms = useCallback(async () => {
    setLoading(true)
    try {
      const data = await formsService.listForms()
      setForms(data)
      // Agendamentos e lembretes carregados em paralelo; falha aqui não impede a listagem
      appointmentsService
        .listAll()
        .then(setAppointments)
        .catch(() => setAppointments([]))
      appointmentsService
        .listAllReminders()
        .then(setReminders)
        .catch(() => setReminders([]))
    } catch {
      toast({
        title: 'Erro ao carregar fichas',
        description: 'Não foi possível buscar as fichas no banco de dados.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (isAuthenticated) {
      loadForms()
    }
  }, [isAuthenticated, loadForms])

  // Filtered forms
  const filteredForms = forms.filter((f) => {
    const matchesSearch =
      !searchTerm ||
      (f.patient_name && f.patient_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (f.patient_cpf && f.patient_cpf.includes(searchTerm)) ||
      (f.patient_email && f.patient_email.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesStatus = statusFilter === 'todos' || f.status === statusFilter
    const matchesType = typeFilter === 'todos' || f.form_type === typeFilter

    return matchesSearch && matchesStatus && matchesType
  })

  // Link generation handler
  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault()

    // A2: validação do agendamento opcional — antes de criar qualquer coisa
    if (showScheduling && (schedDate.trim() || schedTime.trim())) {
      // data e hora precisam ir juntas: uma preenchida obriga a outra
      if (!schedDate.trim() || !schedTime.trim()) {
        toast({
          title: 'Agendamento incompleto',
          description: 'Preencha data e hora do procedimento, ou deixe os dois em branco.',
          variant: 'destructive',
        })
        return
      }
      // data do agendamento não pode ser no passado (comparação local YYYY-MM-DD)
      const today = new Date()
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      if (schedDate.trim() < todayStr) {
        toast({
          title: 'Data inválida',
          description: 'A data do procedimento não pode ser no passado.',
          variant: 'destructive',
        })
        return
      }
    }

    setCreatingLink(true)
    try {
      const created = await formsService.createLink(
        newFormType,
        newPatientName.trim() || undefined,
        newPatientPhone.trim() || undefined,
      )

      // Agendamento é OPCIONAL: só grava se a data foi preenchida,
      // e um erro aqui não impede o envio da ficha
      if (showScheduling && schedDate.trim()) {
        try {
          await appointmentsService.createAppointment({
            form_submission: created.id,
            patient_name: newPatientName.trim() || undefined,
            patient_phone: newPatientPhone.trim() || undefined,
            procedure_date: schedDate,
            procedure_time: schedTime.trim() || undefined,
            procedure: newFormType,
            notify_patient: notifyPatient,
            notify_clinic: false,
          })
        } catch (err) {
          console.warn('Falha ao salvar agendamento:', err)
          toast({
            title: 'Ficha criada, mas o agendamento não foi salvo',
            description: 'A ficha foi gerada normalmente. Tente cadastrar o agendamento novamente.',
            variant: 'destructive',
          })
        }
      }

      const url = `${window.location.origin}/f/${created.token}`
      setCreatedLinkUrl(url)
      toast({
        title: 'Link gerado com sucesso!',
        description: 'Válido por 7 dias. Você já pode enviar para o paciente.',
      })
      loadForms()
    } catch {
      toast({
        title: 'Erro ao criar link',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setCreatingLink(false)
    }
  }

  const copyToClipboard = (url: string, id: string) => {
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    toast({
      title: 'Link copiado!',
      description: 'Pronto para colar no WhatsApp ou enviar por e-mail.',
    })
    setTimeout(() => setCopiedId(null), 2500)
  }

  const handleRetryReminder = async (appointmentId: string) => {
    setRetryingReminderId(appointmentId)
    try {
      const res = await appointmentsService.retryReminder(appointmentId)
      if (res.success) {
        toast({
          title: 'Lembrete reenviado',
          description: res.message || 'Lembrete disparado com sucesso via Resend!',
        })
        loadForms()
      } else {
        toast({
          title: 'Falha no reenvio',
          description: 'Não foi possível disparar o lembrete.',
          variant: 'destructive',
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao reenviar lembrete.'
      toast({
        title: 'Erro ao reenviar',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setRetryingReminderId(null)
    }
  }

  const handleDeleteForm = async (id: string, name?: string) => {
    if (confirm(`Deseja realmente remover a ficha de ${name || 'paciente'}?`)) {
      try {
        await formsService.deleteForm(id)
        toast({ title: 'Ficha excluída com sucesso.' })
        loadForms()
      } catch {
        toast({ title: 'Erro ao excluir ficha.', variant: 'destructive' })
      }
    }
  }

  const handleResendEmail = async (id: string) => {
    setResendingId(id)
    try {
      const res = await formsService.resendReceiptEmail(id)
      toast({
        title: 'E-mail enviado!',
        description: res?.message || 'Comprovante com PDF anexado reenviado com sucesso.',
      })
      loadForms()
    } catch (err: any) {
      toast({
        title: 'Erro ao reenviar e-mail',
        description: err?.message || 'Verifique as configurações de e-mail.',
        variant: 'destructive',
      })
    } finally {
      setResendingId(null)
    }
  }

  const typeLabelMap: Record<string, string> = {
    geral: 'Anamnese Geral',
    labios: 'Lábios / Micropigmentação',
    botox: 'Toxina Botulínica (Botox)',
  }

  return (
    <div className="min-h-screen bg-slate-50/70">
      {/* Top Navigation */}
      <header className="bg-white border-b border-rose-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-rose-900 text-white rounded-xl flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5 text-rose-200" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-rose-950 tracking-tight">
                Andresa Souza Clinic
              </h1>
              <p className="text-xs text-rose-700 font-medium">Painel de Fichas de Anamnese</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="text-xs gap-1.5 border-rose-200 text-rose-900 hover:bg-rose-50"
            >
              <Link to="/configuracoes">
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Configurações</span>
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="text-xs gap-1 text-slate-600 hover:text-rose-800"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* KPI Cards (indicadores: pendente / preenchida / código validado / termo assinado / e-mail enviado / falha no envio) */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
          <Card className="border-amber-200 bg-amber-50/40">
            <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between">
              <CardTitle className="text-[11px] font-semibold text-amber-800">Pendente</CardTitle>
              <Clock className="w-3.5 h-3.5 text-amber-600" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold text-amber-950">
                {forms.filter((f) => f.status === 'pendente').length}
              </div>
              <p className="text-[10px] text-amber-700">Aguardando início</p>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50/40">
            <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between">
              <CardTitle className="text-[11px] font-semibold text-blue-800">
                Código Validado
              </CardTitle>
              <FileCheck className="w-3.5 h-3.5 text-blue-600" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold text-blue-950">
                {forms.filter((f) => f.status === 'codigo_validado').length}
              </div>
              <p className="text-[10px] text-blue-700">E-mail confirmado</p>
            </CardContent>
          </Card>

          <Card className="border-purple-200 bg-purple-50/40">
            <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between">
              <CardTitle className="text-[11px] font-semibold text-purple-800">
                Termo Assinado
              </CardTitle>
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold text-purple-950">
                {forms.filter((f) => f.status === 'preenchida').length}
              </div>
              <p className="text-[10px] text-purple-700">Assinado em tela</p>
            </CardContent>
          </Card>

          <Card className="border-emerald-200 bg-emerald-50/40">
            <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between">
              <CardTitle className="text-[11px] font-semibold text-emerald-800">
                Preenchida
              </CardTitle>
              <FileText className="w-3.5 h-3.5 text-emerald-600" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold text-emerald-950">
                {forms.filter((f) => f.status === 'preenchida').length}
              </div>
              <p className="text-[10px] text-emerald-700">Ficha completa</p>
            </CardContent>
          </Card>

          <Card className="border-teal-200 bg-teal-50/40">
            <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between">
              <CardTitle className="text-[11px] font-semibold text-teal-800">
                E-mail Enviado
              </CardTitle>
              <Mail className="w-3.5 h-3.5 text-teal-600" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold text-teal-950">
                {forms.filter((f) => f.email_delivery_status === 'enviado').length}
              </div>
              <p className="text-[10px] text-teal-700">Comprovante entregue</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-red-50/40">
            <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between">
              <CardTitle className="text-[11px] font-semibold text-red-800">
                Falha no Envio
              </CardTitle>
              <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold text-red-950">
                {forms.filter((f) => f.email_delivery_status === 'falha').length}
              </div>
              <p className="text-[10px] text-muted-foreground">Reenviar no painel</p>
            </CardContent>
          </Card>
        </div>

        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Fichas & Termos dos Pacientes</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Acompanhe preenchimentos, emita novos links e baixe comprovantes em PDF.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={loadForms}
              disabled={loading}
              className="text-xs border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>

            {/* Gerar Link Modal */}
            <Dialog
              open={openNewLinkDialog}
              onOpenChange={(open) => {
                setOpenNewLinkDialog(open)
                if (!open) {
                  setCreatedLinkUrl(null)
                  setNewPatientName('')
                  setNewPatientPhone('')
                  resetScheduling()
                }
              }}
            >
              <DialogTrigger asChild>
                <Button className="bg-rose-900 hover:bg-rose-950 text-white text-xs gap-1.5 shadow-sm">
                  <Plus className="w-4 h-4" />
                  Gerar Novo Link de Ficha
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-rose-950">
                    Gerar Link de Ficha de Anamnese
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    O link gerado tem validade de 7 dias e expira assim que o paciente assinar.
                  </DialogDescription>
                </DialogHeader>

                {!createdLinkUrl ? (
                  <form onSubmit={handleCreateLink} className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="tipo" className="text-xs font-semibold">
                        Tipo de Ficha / Procedimento *
                      </Label>
                      <Select
                        value={newFormType}
                        onValueChange={(val) => setNewFormType(val as FormType)}
                      >
                        <SelectTrigger id="tipo" className="text-xs">
                          <SelectValue placeholder="Selecione o procedimento" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="geral" className="text-xs">
                            Anamnese Geral (Faciais e Corporais)
                          </SelectItem>
                          <SelectItem value="labios" className="text-xs">
                            Lábios & Micropigmentação Labial
                          </SelectItem>
                          <SelectItem value="botox" className="text-xs">
                            Toxina Botulínica (Botox)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="nomePac" className="text-xs font-semibold">
                        Nome do Paciente (opcional)
                      </Label>
                      <Input
                        id="nomePac"
                        placeholder="Ex: Mariana Silva"
                        value={newPatientName}
                        onChange={(e) => setNewPatientName(e.target.value)}
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="telPac" className="text-xs font-semibold">
                        WhatsApp do Paciente (opcional)
                      </Label>
                      <Input
                        id="telPac"
                        placeholder="(11) 90000-0000"
                        value={newPatientPhone}
                        onChange={(e) => setNewPatientPhone(e.target.value)}
                        className="text-xs"
                      />
                    </div>

                    {/* Seção OPCIONAL: Agendamento do procedimento */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                      <button
                        type="button"
                        onClick={() => setShowScheduling((v) => !v)}
                        className="flex w-full items-center justify-between gap-2 text-left"
                      >
                        <span className="flex items-center gap-2">
                          <CalendarDays className="w-4 h-4 text-rose-800" />
                          <span className="text-xs font-semibold text-slate-800">
                            Agendamento do procedimento
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px] border-slate-300 text-slate-500"
                          >
                            opcional
                          </Badge>
                        </span>
                        <span className="text-[10px] font-medium text-rose-800">
                          {showScheduling ? 'Ocultar' : 'Preencher'}
                        </span>
                      </button>

                      {showScheduling && (
                        <div className="mt-3 space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1.5">
                              <Label htmlFor="schedData" className="text-xs font-semibold">
                                Data do procedimento
                              </Label>
                              <Input
                                id="schedData"
                                type="date"
                                value={schedDate}
                                onChange={(e) => setSchedDate(e.target.value)}
                                className="text-xs"
                              />
                              {schedDate && (
                                <p className="text-[10px] text-slate-500">
                                  {formatSchedDateBR(schedDate)}
                                </p>
                              )}
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="schedHora" className="text-xs font-semibold">
                                Hora do procedimento
                              </Label>
                              <Input
                                id="schedHora"
                                type="time"
                                value={schedTime}
                                onChange={(e) => setSchedTime(e.target.value)}
                                className="text-xs"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                            <Label
                              htmlFor="lembrarPaciente"
                              className="text-xs font-medium text-slate-700 cursor-pointer"
                            >
                              Enviar lembrete ao paciente
                            </Label>
                            <Switch
                              id="lembrarPaciente"
                              checked={notifyPatient}
                              onCheckedChange={setNotifyPatient}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <DialogFooter className="pt-2">
                      <Button
                        type="submit"
                        disabled={creatingLink}
                        className="w-full bg-rose-900 hover:bg-rose-950 text-white text-xs gap-1.5"
                      >
                        {creatingLink ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Gerando link seguro...
                          </>
                        ) : (
                          'Criar Link para Envio'
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                ) : (
                  <div className="space-y-4 pt-2">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                      <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-2 text-emerald-700">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <h4 className="font-semibold text-emerald-950 text-sm">
                        Link Seguro Criado!
                      </h4>
                      <p className="text-xs text-emerald-800 mt-1">
                        Copie abaixo e envie ao paciente por WhatsApp ou e-mail.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Link para o paciente:</Label>
                      <div className="flex gap-2">
                        <Input
                          readOnly
                          value={createdLinkUrl}
                          className="text-xs bg-slate-50 font-mono"
                        />
                        <Button
                          type="button"
                          onClick={() => copyToClipboard(createdLinkUrl, 'dialog')}
                          className="bg-rose-900 hover:bg-rose-950 text-white text-xs px-3 shrink-0"
                        >
                          {copiedId === 'dialog' ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="pt-2 flex flex-col gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const msg = encodeURIComponent(
                            `Olá! Segue o link para preenchimento da sua ficha de anamnese da Andresa Souza Clinic: ${createdLinkUrl}`,
                          )
                          window.open(`https://wa.me/?text=${msg}`, '_blank')
                        }}
                        className="w-full text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50 gap-2"
                      >
                        <MessageCircle className="w-4 h-4 text-emerald-600" />
                        Abrir WhatsApp para Compartilhar
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setOpenNewLinkDialog(false)}
                        className="text-xs text-slate-600"
                      >
                        Fechar
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-4 rounded-xl border border-slate-200">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <Input
              placeholder="Buscar por nome, CPF ou e-mail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>

          <div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Filtrar por Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos" className="text-xs">
                  Todos os Status
                </SelectItem>
                <SelectItem value="preenchida" className="text-xs">
                  Preenchida & Assinada
                </SelectItem>
                <SelectItem value="codigo_validado" className="text-xs">
                  Código Validado
                </SelectItem>
                <SelectItem value="pendente" className="text-xs">
                  Pendente de Preenchimento
                </SelectItem>
                <SelectItem value="expirada" className="text-xs">
                  Expirada
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Filtrar por Procedimento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos" className="text-xs">
                  Todos os Procedimentos
                </SelectItem>
                <SelectItem value="geral" className="text-xs">
                  Anamnese Geral
                </SelectItem>
                <SelectItem value="labios" className="text-xs">
                  Lábios & Micropigmentação
                </SelectItem>
                <SelectItem value="botox" className="text-xs">
                  Toxina Botulínica (Botox)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Forms Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-500">
              <Loader2 className="w-8 h-8 text-rose-800 animate-spin mx-auto mb-2" />
              <p className="text-xs">Carregando fichas da clínica...</p>
            </div>
          ) : filteredForms.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="font-semibold text-slate-700 text-sm">Nenhuma ficha encontrada</h3>
              <p className="text-xs mt-1">
                {searchTerm || statusFilter !== 'todos' || typeFilter !== 'todos'
                  ? 'Tente ajustar os filtros ou a busca acima.'
                  : 'Gere um novo link para enviar ao seu primeiro paciente.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Paciente</th>
                    <th className="py-3 px-4">Procedimento</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">PDF no E-mail</th>
                    <th className="py-3 px-4">E-mail Comprovante</th>
                    <th className="py-3 px-4">Data do Aceite</th>
                    <th className="py-3 px-4">Lembrete</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredForms.map((item) => {
                    const linkUrl = `${window.location.origin}/f/${item.token}`
                    const isCopied = copiedId === item.id
                    const itemAppointment = appointments.find((a) => a.form_submission === item.id)

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">
                            {item.patient_name || (
                              <span className="italic text-slate-400">Pendente de nome</span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {item.patient_cpf || item.patient_phone || 'Sem contato prévio'}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-medium text-slate-800">
                          {typeLabelMap[item.form_type] || item.form_type}
                        </td>

                        <td className="py-3.5 px-4">
                          {item.status === 'preenchida' && (
                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200 font-medium text-[11px]">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Termo Assinado
                            </Badge>
                          )}
                          {item.status === 'codigo_validado' && (
                            <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200 font-medium text-[11px]">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Código Validado
                            </Badge>
                          )}
                          {item.status === 'pendente' && (
                            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 font-medium text-[11px]">
                              <Clock className="w-3 h-3 mr-1" /> Pendente
                            </Badge>
                          )}
                          {item.status === 'expirada' && (
                            <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 border-slate-200 font-medium text-[11px]">
                              Expirada
                            </Badge>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {item.status === 'preenchida' ? (
                            item.pdf_attached_to_email ? (
                              <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-emerald-200 font-medium text-[10px] gap-1">
                                <FileText className="w-3 h-3 text-emerald-600" />
                                PDF anexado: Sim
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50 border-amber-200 font-medium text-[10px] gap-1">
                                <FileText className="w-3 h-3 text-amber-600" />
                                PDF anexado: Não
                              </Badge>
                            )
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {item.status === 'preenchida' ? (
                            <div className="flex flex-col gap-1 items-start">
                              {item.email_delivery_status === 'enviado' ? (
                                <span className="text-emerald-700 flex items-center gap-1 font-medium">
                                  <Mail className="w-3.5 h-3.5" /> Enviado
                                </span>
                              ) : item.email_delivery_status === 'falha' ? (
                                <span className="text-red-700 flex items-center gap-1 font-medium">
                                  <AlertTriangle className="w-3.5 h-3.5" /> Falha no envio
                                </span>
                              ) : (
                                <span className="text-slate-400">Não enviado</span>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleResendEmail(item.id)}
                                disabled={resendingId === item.id}
                                className="h-6 px-2 text-[10px] border-slate-200 text-slate-700 hover:bg-rose-50 hover:text-rose-900 gap-1"
                                title="Reenviar e-mail de comprovante com PDF anexado"
                              >
                                {resendingId === item.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Send className="w-3 h-3" />
                                )}
                                Reenviar e-mail
                              </Button>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-slate-600">
                          {item.signed_at
                            ? formatDateBR(item.signed_at)
                            : formatDateBR(item.created)}
                        </td>

                        <td className="py-3.5 px-4">
                          <ReminderStateBadge
                            appointment={itemAppointment}
                            formEmail={item.patient_email}
                            reminders={reminders}
                            onRetry={handleRetryReminder}
                            isRetrying={retryingReminderId === itemAppointment?.id}
                          />
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Copy link button if pending */}
                            {item.status === 'pendente' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => copyToClipboard(linkUrl, item.id)}
                                title="Copiar Link para WhatsApp"
                                className="h-7 px-2 text-xs border-slate-200 text-slate-700"
                              >
                                {isCopied ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                                <span className="ml-1 hidden md:inline">Copiar Link</span>
                              </Button>
                            )}

                            {/* View details button */}
                            <Button
                              asChild
                              size="sm"
                              variant="default"
                              className="h-7 px-2.5 text-xs bg-rose-900 hover:bg-rose-950 text-white"
                            >
                              <Link to={`/painel/ficha/${item.id}`}>
                                <Eye className="w-3.5 h-3.5 sm:mr-1" />
                                <span className="hidden sm:inline">Ver Detalhes</span>
                              </Link>
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteForm(item.id, item.patient_name)}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
                              title="Excluir Ficha"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
