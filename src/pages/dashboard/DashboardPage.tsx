import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { formsService, appointmentsService } from '@/services/forms'
import type {
  FormSubmissionRecord,
  ProcedureAppointmentRecord,
  AppointmentReminderRecord,
} from '@/services/forms'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Sparkles,
  Plus,
  Copy,
  Check,
  Settings,
  LogOut,
  RefreshCw,
  ExternalLink,
  Loader2,
  Send,
  Trash2,
  Calendar,
  CalendarCheck2,
  FileCheck,
  ChevronDown,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  PatientCardCategory,
  PeriodFilter,
  classifyFormCategory,
  normalizeDigits,
  REMINDER_PENDING_STATES,
} from './dashboardHelpers'
import { SummaryCards } from './SummaryCards'
import { FichaFilters } from './FichaFilters'
import { FichaTable } from './FichaTable'
import { FichaCards } from './FichaCards'
import { GenerateLinkDialog } from './GenerateLinkDialog'

export default function DashboardPage() {
  const { isAuthenticated, isLoading: authLoading, signOut } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [forms, setForms] = useState<FormSubmissionRecord[]>([])
  const [appointments, setAppointments] = useState<ProcedureAppointmentRecord[]>([])
  const [, setReminders] = useState<AppointmentReminderRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('todos')
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('30d')
  const [categoryFilter, setCategoryFilter] = useState<PatientCardCategory | null>(null)

  // Expansão das etapas legadas
  const [showProcessSteps, setShowProcessSteps] = useState(false)

  // Exclusão com confirmação
  const [formToDelete, setFormToDelete] = useState<FormSubmissionRecord | null>(null)

  // Generate Link Dialog
  const [openNewLinkDialog, setOpenNewLinkDialog] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [retryingReminderId, setRetryingReminderId] = useState<string | null>(null)
  const [drawerActionForm, setDrawerActionForm] = useState<FormSubmissionRecord | null>(null)

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

  // Mapa de agendamentos indexado por form_submission
  const appointmentsByFormId = useMemo(() => {
    const map = new Map<string, ProcedureAppointmentRecord>()
    for (const a of appointments) {
      if (a.form_submission) {
        map.set(a.form_submission, a)
      }
    }
    return map
  }, [appointments])

  // Contagens dos 3 cartões de estado único
  const categoryCounts = useMemo(() => {
    let pendencia = 0
    let prontas = 0
    let aguardando = 0

    for (const form of forms) {
      const appt = appointmentsByFormId.get(form.id)
      const cat = classifyFormCategory(form, appt)
      if (cat === 'com_pendencia') pendencia++
      else if (cat === 'fichas_prontas') prontas++
      else if (cat === 'aguardando_paciente') aguardando++
    }

    return { pendencia, prontas, aguardando }
  }, [forms, appointmentsByFormId])

  // Contagens das etapas antigas
  const legacyStepCounts = useMemo(() => {
    return {
      pendente: forms.filter((f) => f.status === 'pendente').length,
      codigoValidado: forms.filter((f) => f.status === 'codigo_validado').length,
      termoAssinado: forms.filter((f) => f.status === 'preenchida').length,
      preenchida: forms.filter((f) => f.status === 'preenchida').length,
      emailEnviado: forms.filter((f) => f.email_delivery_status === 'enviado').length,
      falhaEnvio: forms.filter((f) => f.email_delivery_status === 'falha').length,
    }
  }, [forms])

  // Filtro de período
  const isWithinPeriod = useCallback(
    (createdIso?: string): boolean => {
      if (!createdIso) return true
      if (periodFilter === 'todos') return true

      const createdDate = new Date(createdIso)
      if (isNaN(createdDate.getTime())) return true

      const now = new Date()

      if (periodFilter === '7d') {
        const diffMs = now.getTime() - createdDate.getTime()
        return diffMs <= 7 * 24 * 60 * 60 * 1000 && diffMs >= 0
      }

      if (periodFilter === '30d') {
        const diffMs = now.getTime() - createdDate.getTime()
        return diffMs <= 30 * 24 * 60 * 60 * 1000 && diffMs >= 0
      }

      if (periodFilter === 'ano') {
        return createdDate.getFullYear() === now.getFullYear()
      }

      return true
    },
    [periodFilter],
  )

  // Fichas filtradas com normalização de telefone, CPF, nome e e-mail
  const filteredForms = useMemo(() => {
    const rawSearch = searchTerm.trim()
    const searchLower = rawSearch.toLowerCase()
    const searchDigits = normalizeDigits(rawSearch)

    return forms.filter((f) => {
      // 1. Período
      if (!isWithinPeriod(f.created)) return false

      // 2. Categoria clicada no cartão
      if (categoryFilter) {
        const appt = appointmentsByFormId.get(f.id)
        const cat = classifyFormCategory(f, appt)
        if (cat !== categoryFilter) return false
      }

      // 3. Procedimento
      if (typeFilter !== 'todos' && f.form_type !== typeFilter) {
        return false
      }

      // 4. Busca por nome, CPF, telefone ou e-mail
      if (rawSearch) {
        const matchesName = f.patient_name?.toLowerCase().includes(searchLower)
        const matchesEmail = f.patient_email?.toLowerCase().includes(searchLower)

        // CPF: tanto raw quanto por dígitos normalizados
        const fCpfDigits = normalizeDigits(f.patient_cpf)
        const matchesCpf =
          (f.patient_cpf && f.patient_cpf.includes(rawSearch)) ||
          (searchDigits.length > 0 && fCpfDigits.includes(searchDigits))

        // Telefone: aceita "79998091314", "(79) 99809-1314", "79 99809-1314"
        const fPhoneDigits = normalizeDigits(f.patient_phone)
        const matchesPhone =
          (f.patient_phone && f.patient_phone.includes(rawSearch)) ||
          (searchDigits.length > 0 && fPhoneDigits.includes(searchDigits))

        if (!matchesName && !matchesCpf && !matchesEmail && !matchesPhone) {
          return false
        }
      }

      return true
    })
  }, [forms, isWithinPeriod, categoryFilter, typeFilter, searchTerm, appointmentsByFormId])

  const copyToClipboard = (url: string, id: string) => {
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    toast({
      title: 'Link copiado!',
      description: 'Pronto para colar no WhatsApp ou enviar por e-mail.',
    })
    setTimeout(() => setCopiedId(null), 2500)
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Verifique as configurações de e-mail.'
      toast({
        title: 'Erro ao reenviar e-mail',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setResendingId(null)
    }
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

  const handleDeleteFormConfirmed = async () => {
    if (!formToDelete) return
    const id = formToDelete.id
    try {
      await formsService.deleteForm(id)
      toast({ title: 'Ficha excluída com sucesso.' })
      setFormToDelete(null)
      loadForms()
    } catch {
      toast({ title: 'Erro ao excluir ficha.', variant: 'destructive' })
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F7FA]">
      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#6B3FA0] text-white rounded-xl flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5 text-purple-200" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Andresa Souza Clinic
              </h1>
              <p className="text-xs text-[#6B3FA0] font-medium">Painel de Fichas de Anamnese</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="text-xs gap-1.5 border-purple-200 text-[#6B3FA0] hover:bg-purple-50"
            >
              <Link to="/agenda">
                <Calendar className="w-3.5 h-3.5" />
                <span>Agenda</span>
              </Link>
            </Button>

            <Button
              asChild
              variant="default"
              size="sm"
              className="text-xs gap-1.5 bg-[#6B3FA0] hover:bg-[#583385] text-white shadow-xs"
            >
              <Link to="/painel">
                <CalendarCheck2 className="w-3.5 h-3.5" />
                <span>Painel de Fichas</span>
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              size="sm"
              className="text-xs gap-1.5 border-purple-200 text-[#6B3FA0] hover:bg-purple-50"
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
              className="text-xs gap-1 text-slate-600 hover:text-red-700"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {/* Actions Bar & Cabeçalho */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 sm:p-5 rounded-[12px] shadow-sm border border-slate-200/90">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Fichas & Termos dos Pacientes</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Acompanhe preenchimentos, emita novos links e baixe comprovantes em PDF.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="hidden sm:block">
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={loadForms}
                      disabled={loading}
                      className="h-9 w-9 border-slate-200 text-slate-700 hover:bg-slate-50 shrink-0"
                      aria-label="Atualizar dados do painel"
                    >
                      <RefreshCw
                        className={`w-4 h-4 ${loading ? 'animate-spin text-[#6B3FA0]' : ''}`}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    Atualizar dados
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="block sm:hidden">
              <Button
                variant="outline"
                size="icon"
                onClick={loadForms}
                disabled={loading}
                className="h-9 w-9 border-slate-200 text-slate-700 hover:bg-slate-50 shrink-0"
                aria-label="Atualizar dados do painel"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#6B3FA0]' : ''}`} />
              </Button>
            </div>

            <Button
              onClick={() => setOpenNewLinkDialog(true)}
              className="hidden sm:inline-flex bg-[#6B3FA0] hover:bg-[#583385] text-white text-xs gap-1.5 shadow-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Gerar Novo Link de Ficha
            </Button>
          </div>
        </div>

        {/* 3 Cartões de Resumo: SummaryCards */}
        <SummaryCards
          counts={categoryCounts}
          categoryFilter={categoryFilter}
          onSelectCategory={setCategoryFilter}
        />

        {/* Expansão secundária das 6 etapas antigas */}
        <div className="bg-white rounded-lg border border-slate-200/80 px-4 py-2.5">
          <button
            type="button"
            onClick={() => setShowProcessSteps((v) => !v)}
            className="w-full flex items-center justify-between text-left text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            <span className="flex items-center gap-1.5">
              <FileCheck className="w-3.5 h-3.5 text-[#6B3FA0]" />
              Ver etapas do processo detalhadas (6 passos)
            </span>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform ${
                showProcessSteps ? 'rotate-180' : ''
              }`}
            />
          </button>

          {showProcessSteps && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-3 mt-2 border-t border-slate-100">
              <div className="p-2 rounded bg-slate-50 text-center">
                <p className="text-[10px] text-slate-500 uppercase">1. Link Gerado</p>
                <p className="text-base font-bold text-slate-800">{legacyStepCounts.pendente}</p>
              </div>
              <div className="p-2 rounded bg-slate-50 text-center">
                <p className="text-[10px] text-slate-500 uppercase">2. Tel. Validado</p>
                <p className="text-base font-bold text-slate-800">
                  {legacyStepCounts.codigoValidado}
                </p>
              </div>
              <div className="p-2 rounded bg-slate-50 text-center">
                <p className="text-[10px] text-slate-500 uppercase">3. Assinada</p>
                <p className="text-base font-bold text-emerald-600">
                  {legacyStepCounts.termoAssinado}
                </p>
              </div>
              <div className="p-2 rounded bg-slate-50 text-center">
                <p className="text-[10px] text-slate-500 uppercase">4. Preenchida</p>
                <p className="text-base font-bold text-slate-800">{legacyStepCounts.preenchida}</p>
              </div>
              <div className="p-2 rounded bg-slate-50 text-center">
                <p className="text-[10px] text-slate-500 uppercase">5. E-mail Enviado</p>
                <p className="text-base font-bold text-emerald-600">
                  {legacyStepCounts.emailEnviado}
                </p>
              </div>
              <div className="p-2 rounded bg-slate-50 text-center">
                <p className="text-[10px] text-slate-500 uppercase">6. Falha no Envio</p>
                <p className="text-base font-bold text-[#C0392B]">{legacyStepCounts.falhaEnvio}</p>
              </div>
            </div>
          )}
        </div>

        {/* Barra de Filtros e Busca: FichaFilters */}
        <FichaFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          periodFilter={periodFilter}
          onPeriodFilterChange={setPeriodFilter}
          totalFiltered={filteredForms.length}
        />

        {/* Botão Novo Link no Mobile: largura total abaixo da busca */}
        <div className="block sm:hidden">
          <Button
            onClick={() => setOpenNewLinkDialog(true)}
            className="w-full h-11 bg-[#6B3FA0] hover:bg-[#583385] text-white text-xs font-semibold gap-2 shadow-sm rounded-xl"
          >
            <Plus className="w-4 h-4" />
            Gerar Novo Link de Ficha
          </Button>
        </div>

        {/* Lista de Fichas: FichaTable (desktop) e FichaCards (mobile) */}
        <div className="bg-white rounded-[12px] shadow-sm border border-slate-200/90 overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-[#6B3FA0]" />
              <span>Carregando fichas...</span>
            </div>
          ) : filteredForms.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-xs px-4">
              <p className="font-semibold text-slate-700 text-sm mb-1">Nenhuma ficha encontrada</p>
              <p className="text-slate-400">
                {searchTerm || categoryFilter || typeFilter !== 'todos'
                  ? 'Tente ajustar os filtros ou o termo de busca.'
                  : 'Clique no botão acima para gerar seu primeiro link de anamnese.'}
              </p>
            </div>
          ) : (
            <>
              {/* Tabela Desktop */}
              <FichaTable
                forms={filteredForms}
                appointmentsByFormId={appointmentsByFormId}
                copiedId={copiedId}
                resendingId={resendingId}
                retryingReminderId={retryingReminderId}
                onCopyLink={copyToClipboard}
                onResendEmail={handleResendEmail}
                onRetryReminder={handleRetryReminder}
                onOpenDelete={setFormToDelete}
              />

              {/* Cartões Empilhados Mobile */}
              <FichaCards
                forms={filteredForms}
                appointmentsByFormId={appointmentsByFormId}
                copiedId={copiedId}
                resendingId={resendingId}
                onCopyLink={copyToClipboard}
                onResendEmail={handleResendEmail}
                onOpenDrawerAction={setDrawerActionForm}
              />
            </>
          )}
        </div>
      </main>

      {/* Modal Gerar Novo Link */}
      <GenerateLinkDialog
        open={openNewLinkDialog}
        onOpenChange={setOpenNewLinkDialog}
        onSuccess={loadForms}
      />

      {/* Drawer inferior de Ações (Mobile) */}
      <Drawer
        open={!!drawerActionForm}
        onOpenChange={(open) => {
          if (!open) setDrawerActionForm(null)
        }}
      >
        <DrawerContent className="max-h-[85vh] focus:outline-hidden">
          {drawerActionForm &&
            (() => {
              const item = drawerActionForm
              const isSigned = item.status === 'preenchida'
              const itemAppointment = appointmentsByFormId.get(item.id)
              const linkUrl = `${window.location.origin}/f/${item.token}`
              const isCopied = copiedId === item.id
              const patientName = item.patient_name?.trim() || 'Paciente sem nome'
              const rawProofStatus = String(item.email_delivery_status || '').toLowerCase()
              const hasProofFailure =
                isSigned && (rawProofStatus === 'falha' || rawProofStatus === 'nao_enviado')
              const remState = (itemAppointment?.reminder_state || '').trim().toLowerCase()
              const hasReminderFailure = REMINDER_PENDING_STATES.has(remState)

              return (
                <div className="flex flex-col">
                  <DrawerHeader className="text-left pb-2 border-b border-slate-100">
                    <DrawerTitle className="text-base font-bold text-slate-900 truncate">
                      {patientName}
                    </DrawerTitle>
                    <DrawerDescription className="text-xs text-slate-500">
                      Escolha uma ação para esta ficha
                    </DrawerDescription>
                  </DrawerHeader>

                  <div className="p-3 space-y-1">
                    {/* Ver detalhes ou abrir link */}
                    <a
                      href={isSigned ? `/painel/ficha/${item.id}` : linkUrl}
                      target={isSigned ? undefined : '_blank'}
                      rel={isSigned ? undefined : 'noreferrer'}
                      onClick={() => setDrawerActionForm(null)}
                      className="flex items-center gap-3 px-4 min-h-[48px] rounded-lg text-sm text-slate-800 hover:bg-slate-50 active:bg-slate-100 transition-colors"
                    >
                      <ExternalLink className="w-5 h-5 text-slate-500 shrink-0" />
                      <span className="font-medium">
                        {isSigned ? 'Ver detalhes da ficha completa' : 'Abrir link da paciente'}
                      </span>
                    </a>

                    {/* Copiar link */}
                    {!isSigned && (
                      <button
                        type="button"
                        onClick={() => {
                          copyToClipboard(linkUrl, item.id)
                          setDrawerActionForm(null)
                        }}
                        className="flex items-center gap-3 px-4 min-h-[48px] rounded-lg text-sm text-slate-800 hover:bg-slate-50 active:bg-slate-100 transition-colors text-left w-full"
                      >
                        {isCopied ? (
                          <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                        ) : (
                          <Copy className="w-5 h-5 text-slate-500 shrink-0" />
                        )}
                        <span className="font-medium">
                          {isCopied ? 'Link copiado com sucesso!' : 'Copiar link da ficha'}
                        </span>
                      </button>
                    )}

                    {/* Reenviar comprovante */}
                    {isSigned && (
                      <button
                        type="button"
                        onClick={() => {
                          handleResendEmail(item.id)
                          setDrawerActionForm(null)
                        }}
                        disabled={resendingId === item.id}
                        className={`flex items-center gap-3 px-4 min-h-[48px] rounded-lg text-sm hover:bg-slate-50 active:bg-slate-100 transition-colors text-left w-full ${
                          hasProofFailure ? 'text-[#C0392B] font-semibold' : 'text-slate-800'
                        }`}
                      >
                        {resendingId === item.id ? (
                          <Loader2 className="w-5 h-5 animate-spin shrink-0" />
                        ) : (
                          <Send className="w-5 h-5 shrink-0" />
                        )}
                        <span className="font-medium">Reenviar comprovante por e-mail</span>
                      </button>
                    )}

                    {/* Reenviar lembrete */}
                    {itemAppointment && (
                      <button
                        type="button"
                        onClick={() => {
                          handleRetryReminder(itemAppointment.id)
                          setDrawerActionForm(null)
                        }}
                        disabled={retryingReminderId === itemAppointment.id}
                        className={`flex items-center gap-3 px-4 min-h-[48px] rounded-lg text-sm hover:bg-slate-50 active:bg-slate-100 transition-colors text-left w-full ${
                          hasReminderFailure ? 'text-[#C0392B] font-semibold' : 'text-slate-800'
                        }`}
                      >
                        {retryingReminderId === itemAppointment.id ? (
                          <Loader2 className="w-5 h-5 animate-spin shrink-0" />
                        ) : (
                          <RefreshCw className="w-5 h-5 shrink-0" />
                        )}
                        <span className="font-medium">Reenviar lembrete</span>
                      </button>
                    )}

                    {/* Excluir ficha */}
                    <button
                      type="button"
                      onClick={() => {
                        const toDelete = item
                        setDrawerActionForm(null)
                        setFormToDelete(toDelete)
                      }}
                      className="flex items-center gap-3 px-4 min-h-[48px] rounded-lg text-sm text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors text-left w-full"
                    >
                      <Trash2 className="w-5 h-5 shrink-0" />
                      <span className="font-medium">Excluir ficha</span>
                    </button>
                  </div>

                  <DrawerFooter className="px-4 py-3 border-t border-slate-100">
                    <DrawerClose asChild>
                      <Button
                        variant="outline"
                        className="w-full h-11 text-sm font-medium border-slate-200 text-slate-700"
                      >
                        Fechar
                      </Button>
                    </DrawerClose>
                  </DrawerFooter>
                </div>
              )
            })()}
        </DrawerContent>
      </Drawer>

      {/* Modal de confirmação de exclusão */}
      <AlertDialog
        open={!!formToDelete}
        onOpenChange={(open) => {
          if (!open) setFormToDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900">
              Confirmar exclusão de ficha
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600">
              Deseja realmente excluir a ficha de{' '}
              <strong>{formToDelete?.patient_name || 'paciente sem nome'}</strong>? Essa ação não
              poderá ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFormConfirmed}
              className="bg-red-600 hover:bg-red-700 text-white text-xs"
            >
              Excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
