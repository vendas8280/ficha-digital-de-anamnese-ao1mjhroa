import React, { useEffect, useState, useCallback, useMemo } from 'react'
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
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  Calendar,
  CalendarCheck2,
  CalendarDays,
  MoreVertical,
  ChevronDown,
  FileCheck,
  FileText,
  FilterX,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'

export type PatientCardCategory = 'com_pendencia' | 'fichas_prontas' | 'aguardando_paciente'

export type PeriodFilter = '7d' | '30d' | 'ano' | 'todos'

/**
 * Estados do lembrete considerados como falha ou não envio que exigem ação / pendência.
 * Cobre:
 * - Lembrete com falha de envio ('falha no envio', 'falha')
 * - Lembrete não enviado por atraso ('não enviado por atraso', 'fora do prazo',
 *   'sem ficha, lembrete não enviado', 'sem ficha, não enviado')
 */
export const REMINDER_PENDING_STATES = new Set([
  'falha no envio',
  'falha',
  'não enviado por atraso',
  'fora do prazo',
  'sem ficha, lembrete não enviado',
  'sem ficha, não enviado',
])

/**
 * Avalia se o procedimento está agendado para menos de 24h a partir do momento de referência (now).
 */
export function isAppointmentWithin24Hours(
  appointment?: ProcedureAppointmentRecord,
  now: Date = new Date(),
): boolean {
  if (!appointment?.procedure_date) return false
  const dateStr = appointment.procedure_date.trim()
  const timeStr = (appointment.procedure_time || '00:00').trim()
  const apptDateTime = new Date(`${dateStr}T${timeStr.length === 5 ? `${timeStr}:00` : timeStr}`)
  if (isNaN(apptDateTime.getTime())) return false

  const diffMs = apptDateTime.getTime() - now.getTime()
  // No futuro e em menos de 24h (ou já passado em até 12h sem assinatura)
  return diffMs <= 24 * 60 * 60 * 1000
}

/**
 * Classifica a ficha em EXATAMENTE UM dos três cartões novos,
 * com prioridade estrita:
 * 1. "Com pendência" (vermelho #C0392B):
 *    - lembrete com falha de envio
 *    - lembrete não enviado por atraso
 *    - comprovante não entregue (quando a ficha foi assinada e comprovante está em falha ou não enviado)
 *    - ficha gerada e ainda não assinada com procedimento em menos de 24h
 * 2. "Fichas prontas" (verde #2E9E5B):
 *    - termo assinado (status === 'preenchida') E comprovante entregue (email_delivery_status === 'enviado')
 *    - lembrete não está em falha/atraso
 * 3. "Aguardando a paciente" (âmbar #D99A00):
 *    - link gerado, ficha ainda não assinada (e procedimento em > 24h ou sem agendamento urgente)
 */
export function classifyFormCategory(
  form: FormSubmissionRecord,
  appointment?: ProcedureAppointmentRecord,
  now: Date = new Date(),
): PatientCardCategory {
  const isSigned = form.status === 'preenchida'
  const rawProofStatus = String(form.email_delivery_status || '').toLowerCase()
  const remState = (appointment?.reminder_state || '').trim().toLowerCase()

  // Regra 1: Lembrete com falha ou não enviado por atraso
  const hasReminderIssue = REMINDER_PENDING_STATES.has(remState)

  // Regra 2: Comprovante não entregue quando a ficha já foi assinada
  // (se foi assinada e o comprovante falhou OU não foi enviado)
  const hasProofIssue =
    isSigned &&
    (rawProofStatus === 'falha' ||
      rawProofStatus === 'nao_enviado' ||
      rawProofStatus === '' ||
      rawProofStatus === 'pendente')

  // Regra 3: Ficha gerada e ainda não assinada com procedimento em menos de 24h
  const isUrgentUnsigned = !isSigned && isAppointmentWithin24Hours(appointment, now)

  // Se algum caso de pendência estiver presente:
  if (hasReminderIssue || hasProofIssue || isUrgentUnsigned) {
    return 'com_pendencia'
  }

  // 2. Fichas prontas: termo assinado E comprovante entregue
  if (isSigned && rawProofStatus === 'enviado') {
    return 'fichas_prontas'
  }

  // 3. Aguardando a paciente: link gerado, ficha ainda não assinada
  return 'aguardando_paciente'
}

export default function DashboardPage() {
  const { isAuthenticated, isLoading: authLoading, signOut } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [forms, setForms] = useState<FormSubmissionRecord[]>([])
  const [appointments, setAppointments] = useState<ProcedureAppointmentRecord[]>([])
  const [reminders, setReminders] = useState<AppointmentReminderRecord[]>([])
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
  const [newFormType, setNewFormType] = useState<FormType>('geral')
  const [newPatientName, setNewPatientName] = useState('')
  const [newPatientPhone, setNewPatientPhone] = useState('')
  const [creatingLink, setCreatingLink] = useState(false)
  const [createdLinkUrl, setCreatedLinkUrl] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [retryingReminderId, setRetryingReminderId] = useState<string | null>(null)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(() => new Date())
  const [drawerActionForm, setDrawerActionForm] = useState<FormSubmissionRecord | null>(null)

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
      appointmentsService
        .listAll()
        .then(setAppointments)
        .catch(() => setAppointments([]))
      appointmentsService
        .listAllReminders()
        .then(setReminders)
        .catch(() => setReminders([]))
      setLastRefreshedAt(new Date())
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

  // Contagens dos 3 cartões de estado único (calculados sobre todas as fichas ou no período)
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

  // Contagens das 6 etapas antigas (para exibição secundária em "Ver etapas do processo")
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

  // Filtro de período (baseado no created da ficha)
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

  // Fichas filtradas
  const filteredForms = useMemo(() => {
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

      // 4. Busca por nome, CPF ou e-mail
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        const matchesName = f.patient_name?.toLowerCase().includes(searchLower)
        const matchesCpf = f.patient_cpf?.includes(searchTerm)
        const matchesEmail = f.patient_email?.toLowerCase().includes(searchLower)
        const matchesPhone = f.patient_phone?.includes(searchTerm)
        if (!matchesName && !matchesCpf && !matchesEmail && !matchesPhone) {
          return false
        }
      }

      return true
    })
  }, [forms, isWithinPeriod, categoryFilter, typeFilter, searchTerm, appointmentsByFormId])

  // Link generation handler
  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault()

    if (showScheduling && (schedDate.trim() || schedTime.trim())) {
      if (!schedDate.trim() || !schedTime.trim()) {
        toast({
          title: 'Agendamento incompleto',
          description: 'Preencha data e hora do procedimento, ou deixe os dois em branco.',
          variant: 'destructive',
        })
        return
      }
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
    labios: 'Lábios & Micropigmentação',
    botox: 'Toxina Botulínica (Botox)',
  }

  return (
    <div className="min-h-screen bg-[#F7F7FA]">
      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Andresa Souza Clinic
              </h1>
              <p className="text-xs text-[#6B3FA0] font-medium">Painel de Fichas de Anamnese</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
=======
        </div>

        {/* Actions Bar & Cabeçalho */}          <div className="flex items-center gap-2">
=======
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
=======
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Andresa Souza Clinic
              </h1>
              <p className="text-xs text-[#6B3FA0] font-medium">Painel de Fichas de Anamnese</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
=======
        </div>

        {/* Actions Bar & Cabeçalho */}          <div className="flex items-center gap-2">
            {/* Item 1 da spec: Agenda como primeiro item do menu, antes do painel */}
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

      {/* Main Content Area - pb-28 sm:pb-8 garante espaço extra no rodapé do mobile (safe-area + margem) para nunca cobrir a última linha com banner */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28 sm:pb-8 space-y-6">
        {/* 1. Três Cartões de Estado Único no COMPUTADOR (>= 768px) - Clicáveis e mutuamente exclusivos */}
        <div className="hidden md:block space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Card 1: Aguardando a paciente (âmbar #D99A00) - Clicável por inteiro */}
            <Card
              role="button"
              tabIndex={0}
              aria-pressed={categoryFilter === 'aguardando_paciente'}
              onClick={() => {
                setCategoryFilter((prev) =>
                  prev === 'aguardando_paciente' ? null : 'aguardando_paciente',
                )
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setCategoryFilter((prev) =>
                    prev === 'aguardando_paciente' ? null : 'aguardando_paciente',
                  )
                }
              }}
              className={`rounded-[12px] bg-white border cursor-pointer select-none transition-all duration-150 hover:bg-slate-50/90 hover:shadow-md active:bg-slate-100 ${
                categoryFilter === 'aguardando_paciente'
                  ? 'border-[#D99A00] ring-2 ring-[#D99A00]/25 shadow-sm bg-amber-50/20'
                  : 'border-slate-200/80 hover:border-amber-400'
              }`}
            >
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#D99A00]" />
                  <CardTitle className="text-xs font-semibold text-[#D99A00] uppercase tracking-wider">
                    Aguardando a paciente
                  </CardTitle>
                </div>
                <Clock className="w-4 h-4 text-[#D99A00]" />
              </CardHeader>
              <CardContent className="p-4 pt-1">
                <div className="text-3xl font-extrabold text-[#D99A00]">
                  {categoryCounts.aguardando}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-slate-500">Link gerado, ficha ainda não assinada</p>
                  {categoryFilter === 'aguardando_paciente' && (
                    <span className="text-[11px] font-medium text-[#D99A00] underline decoration-dotted">
                      Filtrando (clique p/ limpar)
                    </span>
                  )}
                </div>
                {/* No celular, mostra a data de última atualização em texto pequeno abaixo do cartão com ícone de relógio */}
                <div className="md:hidden mt-2 pt-2 border-t border-amber-100 flex items-center gap-1 text-[10px] text-amber-700/80">
                  <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                  <span>
                    Última atualização: {formatDateBR(lastRefreshedAt.toISOString())} às{' '}
                    {lastRefreshedAt.toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Fichas prontas (verde #2E9E5B) - Clicável por inteiro */}
            <Card
              role="button"
              tabIndex={0}
              aria-pressed={categoryFilter === 'fichas_prontas'}
              onClick={() => {
                setCategoryFilter((prev) => (prev === 'fichas_prontas' ? null : 'fichas_prontas'))
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setCategoryFilter((prev) => (prev === 'fichas_prontas' ? null : 'fichas_prontas'))
                }
              }}
              className={`rounded-[12px] bg-white border cursor-pointer select-none transition-all duration-150 hover:bg-slate-50/90 hover:shadow-md active:bg-slate-100 ${
                categoryFilter === 'fichas_prontas'
                  ? 'border-[#2E9E5B] ring-2 ring-[#2E9E5B]/25 shadow-sm bg-emerald-50/20'
                  : 'border-slate-200/80 hover:border-emerald-400'
              }`}
            >
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#2E9E5B]" />
                  <CardTitle className="text-xs font-semibold text-[#2E9E5B] uppercase tracking-wider">
                    Fichas prontas
                  </CardTitle>
                </div>
                <CheckCircle2 className="w-4 h-4 text-[#2E9E5B]" />
              </CardHeader>
              <CardContent className="p-4 pt-1">
                <div className="text-3xl font-extrabold text-[#2E9E5B]">
                  {categoryCounts.prontas}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-slate-500">Termo assinado e comprovante entregue</p>
                  {categoryFilter === 'fichas_prontas' && (
                    <span className="text-[11px] font-medium text-[#2E9E5B] underline decoration-dotted">
                      Filtrando (clique p/ limpar)
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Card 3: Com pendência (vermelho #C0392B) - Clicável por inteiro */}
            <Card
              role="button"
              tabIndex={0}
              aria-pressed={categoryFilter === 'com_pendencia'}
              onClick={() => {
                setCategoryFilter((prev) => (prev === 'com_pendencia' ? null : 'com_pendencia'))
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setCategoryFilter((prev) => (prev === 'com_pendencia' ? null : 'com_pendencia'))
                }
              }}
              className={`rounded-[12px] bg-white border cursor-pointer select-none transition-all duration-150 hover:bg-slate-50/90 hover:shadow-md active:bg-slate-100 ${
                categoryFilter === 'com_pendencia'
                  ? 'border-[#C0392B] ring-2 ring-[#C0392B]/25 shadow-sm bg-red-50/20'
                  : 'border-slate-200/80 hover:border-red-400'
              }`}
            >
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#C0392B]" />
                  <CardTitle className="text-xs font-semibold text-[#C0392B] uppercase tracking-wider">
                    Com pendência
                  </CardTitle>
                </div>
                <AlertTriangle className="w-4 h-4 text-[#C0392B]" />
              </CardHeader>
              <CardContent className="p-4 pt-1">
                <div className="text-3xl font-extrabold text-[#C0392B]">
                  {categoryCounts.pendencia}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-slate-500">Falha no comprovante ou lembrete</p>
                  {categoryFilter === 'com_pendencia' && (
                    <span className="text-[11px] font-medium text-[#C0392B] underline decoration-dotted">
                      Filtrando (clique p/ limpar)
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Link discreto "Ver etapas do processo" */}
          <div className="flex items-center justify-between pt-1 px-1">
            <button
              type="button"
              onClick={() => setShowProcessSteps((v) => !v)}
              className="text-xs text-slate-500 hover:text-[#6B3FA0] flex items-center gap-1 font-medium transition-colors"
            >
              <span>
                {showProcessSteps ? 'Ocultar etapas do processo' : 'Ver etapas do processo'}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${showProcessSteps ? 'rotate-180' : ''}`}
              />
            </button>

            {categoryFilter && (
              <button
                type="button"
                onClick={() => setCategoryFilter(null)}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
              >
                <FilterX className="w-3.5 h-3.5" />
                Limpar filtro do cartão
              </button>
            )}
          </div>

          {/* Seção retrátil com os seis números antigos das etapas */}
          {showProcessSteps && (
            <div className="p-4 bg-white rounded-xl border border-slate-200/90 shadow-sm animate-in fade-in duration-200">
              <div className="text-xs font-semibold text-slate-700 mb-3">
                Contagem detalhada por etapas do fluxo:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                <div className="rounded-lg bg-amber-50/50 border border-amber-200/70 p-2.5">
                  <div className="flex items-center justify-between text-[11px] text-amber-800 font-medium">
                    <span>Pendente</span>
                    <Clock className="w-3 h-3 text-amber-600" />
                  </div>
                  <div className="text-lg font-bold text-amber-950 mt-1">
                    {legacyStepCounts.pendente}
                  </div>
                  <p className="text-[10px] text-amber-700">Aguardando início</p>
                </div>

                <div className="rounded-lg bg-blue-50/50 border border-blue-200/70 p-2.5">
                  <div className="flex items-center justify-between text-[11px] text-blue-800 font-medium">
                    <span>Código Validado</span>
                    <FileCheck className="w-3 h-3 text-blue-600" />
                  </div>
                  <div className="text-lg font-bold text-blue-950 mt-1">
                    {legacyStepCounts.codigoValidado}
                  </div>
                  <p className="text-[10px] text-blue-700">E-mail confirmado</p>
                </div>

                <div className="rounded-lg bg-purple-50/50 border border-purple-200/70 p-2.5">
                  <div className="flex items-center justify-between text-[11px] text-purple-800 font-medium">
                    <span>Termo Assinado</span>
                    <CheckCircle2 className="w-3 h-3 text-purple-600" />
                  </div>
                  <div className="text-lg font-bold text-purple-950 mt-1">
                    {legacyStepCounts.termoAssinado}
                  </div>
                  <p className="text-[10px] text-purple-700">Assinado em tela</p>
                </div>

                <div className="rounded-lg bg-emerald-50/50 border border-emerald-200/70 p-2.5">
                  <div className="flex items-center justify-between text-[11px] text-emerald-800 font-medium">
                    <span>Preenchida</span>
                    <FileText className="w-3 h-3 text-emerald-600" />
                  </div>
                  <div className="text-lg font-bold text-emerald-950 mt-1">
                    {legacyStepCounts.preenchida}
                  </div>
                  <p className="text-[10px] text-emerald-700">Ficha completa</p>
                </div>

                <div className="rounded-lg bg-teal-50/50 border border-teal-200/70 p-2.5">
                  <div className="flex items-center justify-between text-[11px] text-teal-800 font-medium">
                    <span>E-mail Enviado</span>
                    <Mail className="w-3 h-3 text-teal-600" />
                  </div>
                  <div className="text-lg font-bold text-teal-950 mt-1">
                    {legacyStepCounts.emailEnviado}
                  </div>
                  <p className="text-[10px] text-teal-700">Comprovante entregue</p>
                </div>

                <div className="rounded-lg bg-red-50/50 border border-red-200/70 p-2.5">
                  <div className="flex items-center justify-between text-[11px] text-red-800 font-medium">
                    <span>Falha no Envio</span>
                    <AlertTriangle className="w-3 h-3 text-red-500" />
                  </div>
                  <div className="text-lg font-bold text-red-950 mt-1">
                    {legacyStepCounts.falhaEnvio}
                  </div>
                  <p className="text-[10px] text-red-700">Reenviar no painel</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 1. Três Cartões de Resumo COMPACTOS no CELULAR (< 768px): numa linha compacta entre o cabeçalho e a busca */}
        <div className="md:hidden">
          <div className="grid grid-cols-3 gap-2">
            {/* Cartão Mobile 1: Aguardando */}
            <button
              type="button"
              onClick={() => {
                setCategoryFilter((prev) =>
                  prev === 'aguardando_paciente' ? null : 'aguardando_paciente',
                )
              }}
              className={`rounded-xl p-2.5 text-center border transition-all select-none active:scale-[0.98] ${
                categoryFilter === 'aguardando_paciente'
                  ? 'bg-amber-50 border-[#D99A00] ring-2 ring-[#D99A00]/30 shadow-xs'
                  : 'bg-white border-slate-200 shadow-2xs hover:border-amber-300'
              }`}
            >
              <div className="text-[11px] font-semibold text-[#D99A00] truncate leading-tight">
                Aguardando
              </div>
              <div className="text-2xl font-black text-[#D99A00] mt-0.5 leading-none">
                {categoryCounts.aguardando}
              </div>
            </button>

            {/* Cartão Mobile 2: Prontas */}
            <button
              type="button"
              onClick={() => {
                setCategoryFilter((prev) => (prev === 'fichas_prontas' ? null : 'fichas_prontas'))
              }}
              className={`rounded-xl p-2.5 text-center border transition-all select-none active:scale-[0.98] ${
                categoryFilter === 'fichas_prontas'
                  ? 'bg-emerald-50 border-[#2E9E5B] ring-2 ring-[#2E9E5B]/30 shadow-xs'
                  : 'bg-white border-slate-200 shadow-2xs hover:border-emerald-300'
              }`}
            >
              <div className="text-[11px] font-semibold text-[#2E9E5B] truncate leading-tight">
                Prontas
              </div>
              <div className="text-2xl font-black text-[#2E9E5B] mt-0.5 leading-none">
                {categoryCounts.prontas}
              </div>
            </button>

            {/* Cartão Mobile 3: Pendência */}
            <button
              type="button"
              onClick={() => {
                setCategoryFilter((prev) => (prev === 'com_pendencia' ? null : 'com_pendencia'))
              }}
              className={`rounded-xl p-2.5 text-center border transition-all select-none active:scale-[0.98] ${
                categoryFilter === 'com_pendencia'
                  ? 'bg-red-50 border-[#C0392B] ring-2 ring-[#C0392B]/30 shadow-xs'
                  : 'bg-white border-slate-200 shadow-2xs hover:border-red-300'
              }`}
            >
              <div className="text-[11px] font-semibold text-[#C0392B] truncate leading-tight">
                Pendência
              </div>
              <div className="text-2xl font-black text-[#C0392B] mt-0.5 leading-none">
                {categoryCounts.pendencia}
              </div>
            </button>
          </div>

          {/* Indicador de filtro ativo no mobile para limpar com 1 toque */}
          {categoryFilter && (
            <div className="flex items-center justify-between mt-1.5 px-1">
              <span className="text-[11px] text-slate-500 font-medium">
                Filtrando:{' '}
                {categoryFilter === 'aguardando_paciente'
                  ? 'Aguardando'
                  : categoryFilter === 'fichas_prontas'
                    ? 'Prontas'
                    : 'Pendência'}
              </span>
              <button
                type="button"
                onClick={() => setCategoryFilter(null)}
                className="text-[11px] text-slate-600 hover:text-slate-900 underline flex items-center gap-1"
              >
                <FilterX className="w-3 h-3" />
                Limpar filtro
              </button>
            </div>
          )}
        </div>


=======
        {/* Actions Bar & Cabeçalho */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 sm:p-5 rounded-[12px] shadow-sm border border-slate-200/90">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Fichas & Termos dos Pacientes</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Acompanhe preenchimentos, emita novos links e baixe comprovantes em PDF.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Botão Atualizar: no celular toque apenas recarrega sem depender de tooltip; no desktop preserva tooltip */}
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

            {/* Gerar Link Modal - Botão Primário ROXO (#6B3FA0) no desktop; no mobile aparecerá abaixo da busca */}
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
                <Button className="hidden sm:inline-flex bg-[#6B3FA0] hover:bg-[#583385] text-white text-xs gap-1.5 shadow-sm font-medium">
                  <Plus className="w-4 h-4" />
                  Gerar Novo Link de Ficha
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-slate-900">
                    Gerar Link de Ficha de Anamnese
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500">
                    O link gerado tem validade de 7 dias e expira assim que o paciente assinar.
                  </DialogDescription>
                </DialogHeader>

                {!createdLinkUrl ? (
                  <form onSubmit={handleCreateLink} className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="tipo" className="text-xs font-semibold text-slate-800">
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
                      <Label htmlFor="nomePac" className="text-xs font-semibold text-slate-800">
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
                      <Label htmlFor="telPac" className="text-xs font-semibold text-slate-800">
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
                          <CalendarDays className="w-4 h-4 text-[#6B3FA0]" />
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
                        <span className="text-[10px] font-medium text-[#6B3FA0]">
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
                        className="w-full bg-[#6B3FA0] hover:bg-[#583385] text-white text-xs gap-1.5 font-medium"
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
                      <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-2 text-[#2E9E5B]">
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
                          className="bg-[#6B3FA0] hover:bg-[#583385] text-white text-xs px-3 shrink-0"
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
                        className="w-full text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50 gap-2 font-medium"
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

        {/* Três Cartões de Resumo COMPACTOS no CELULAR (< 768px): linha compacta entre o título e a busca */}
        <div className="md:hidden">
          <div className="grid grid-cols-3 gap-2">
            {/* Cartão Mobile 1: Aguardando */}
            <button
              type="button"
              onClick={() => {
                setCategoryFilter((prev) =>
                  prev === 'aguardando_paciente' ? null : 'aguardando_paciente',
                )
              }}
              className={`rounded-xl p-2.5 text-center border transition-all select-none active:scale-[0.98] ${
                categoryFilter === 'aguardando_paciente'
                  ? 'bg-amber-50 border-[#D99A00] ring-2 ring-[#D99A00]/30 shadow-xs'
                  : 'bg-white border-slate-200 shadow-2xs hover:border-amber-300'
              }`}
            >
              <div className="text-[11px] font-semibold text-[#D99A00] truncate leading-tight">
                Aguardando
              </div>
              <div className="text-2xl font-black text-[#D99A00] mt-0.5 leading-none">
                {categoryCounts.aguardando}
              </div>
            </button>

            {/* Cartão Mobile 2: Prontas */}
            <button
              type="button"
              onClick={() => {
                setCategoryFilter((prev) =>
                  prev === 'fichas_prontas' ? null : 'fichas_prontas',
                )
              }}
              className={`rounded-xl p-2.5 text-center border transition-all select-none active:scale-[0.98] ${
                categoryFilter === 'fichas_prontas'
                  ? 'bg-emerald-50 border-[#2E9E5B] ring-2 ring-[#2E9E5B]/30 shadow-xs'
                  : 'bg-white border-slate-200 shadow-2xs hover:border-emerald-300'
              }`}
            >
              <div className="text-[11px] font-semibold text-[#2E9E5B] truncate leading-tight">
                Prontas
              </div>
              <div className="text-2xl font-black text-[#2E9E5B] mt-0.5 leading-none">
                {categoryCounts.prontas}
              </div>
            </button>

            {/* Cartão Mobile 3: Pendência */}
            <button
              type="button"
              onClick={() => {
                setCategoryFilter((prev) =>
                  prev === 'com_pendencia' ? null : 'com_pendencia',
                )
              }}
              className={`rounded-xl p-2.5 text-center border transition-all select-none active:scale-[0.98] ${
                categoryFilter === 'com_pendencia'
                  ? 'bg-red-50 border-[#C0392B] ring-2 ring-[#C0392B]/30 shadow-xs'
                  : 'bg-white border-slate-200 shadow-2xs hover:border-red-300'
              }`}
            >
              <div className="text-[11px] font-semibold text-[#C0392B] truncate leading-tight">
                Pendência
              </div>
              <div className="text-2xl font-black text-[#C0392B] mt-0.5 leading-none">
                {categoryCounts.pendencia}
              </div>
            </button>
          </div>

          {/* Indicador de filtro ativo no mobile para limpar com 1 toque */}
          {categoryFilter && (
            <div className="flex items-center justify-between mt-1.5 px-1">
              <span className="text-[11px] text-slate-500 font-medium">
                Filtrando: {categoryFilter === 'aguardando_paciente' ? 'Aguardando' : categoryFilter === 'fichas_prontas' ? 'Prontas' : 'Pendência'}
              </span>
              <button
                type="button"
                onClick={() => setCategoryFilter(null)}
                className="text-[11px] text-slate-600 hover:text-slate-900 underline flex items-center gap-1"
              >
                <FilterX className="w-3 h-3" />
                Limpar filtro
              </button>
            </div>
          )}
        </div>

        {/* 4. Filtros: Busca, Procedimento e Filtro de Período (Padrão: Últimos 30 dias) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3.5 sm:p-4 rounded-[12px] border border-slate-200/90 shadow-sm">
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <Input
                placeholder="Buscar por nome, CPF ou e-mail..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 text-xs h-9"
              />
            </div>
            {/* Botão Novo Link em largura total abaixo da busca no mobile */}
            <Button
              onClick={() => setOpenNewLinkDialog(true)}
              className="sm:hidden w-full bg-[#6B3FA0] hover:bg-[#583385] text-white text-xs h-9 gap-1.5 shadow-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Novo link
            </Button>
          </div>

          <div>
            <Select
              value={periodFilter}
              onValueChange={(val) => setPeriodFilter(val as PeriodFilter)}
            >
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d" className="text-xs">
                  Últimos 7 dias
                </SelectItem>
                <SelectItem value="30d" className="text-xs">
                  Últimos 30 dias
                </SelectItem>
                <SelectItem value="ano" className="text-xs">
                  Este ano
                </SelectItem>
                <SelectItem value="todos" className="text-xs">
                  Todos
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="text-xs h-9">
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

        {/* 3. Tabela Enxuta (6 colunas: Paciente | Procedimento | Ficha | Comprovante | Lembrete | Ações) */}
        <div className="bg-white rounded-[12px] border border-slate-200/90 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-500">
              <Loader2 className="w-8 h-8 text-[#6B3FA0] animate-spin mx-auto mb-2" />
              <p className="text-xs">Carregando fichas da clínica...</p>
            </div>
          ) : filteredForms.length === 0 ? (
            /* 5. Estado Vazio com botão de gerar novo link */
            <div className="p-12 text-center text-slate-500 space-y-3">
              <Clock className="w-10 h-10 text-slate-300 mx-auto" />
              <div className="space-y-1">
                <h3 className="font-semibold text-slate-800 text-sm">
                  Nenhuma ficha neste período.
                </h3>
                <p className="text-xs text-slate-500">
                  {searchTerm || typeFilter !== 'todos' || categoryFilter
                    ? 'Tente ajustar os filtros ou a busca acima.'
                    : 'Gere um novo link de ficha para enviar aos seus pacientes.'}
                </p>
              </div>
              <div className="pt-2">
                <Button
                  onClick={() => setOpenNewLinkDialog(true)}
                  className="bg-[#6B3FA0] hover:bg-[#583385] text-white text-xs gap-1.5 font-medium shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Gerar Novo Link de Ficha
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* 1. VISÃO MOBILE (< 768px): Cartões Empilhados sem rolagem horizontal */}
              <div className="md:hidden divide-y divide-slate-100">
                {filteredForms.map((item) => {
                  const itemAppointment = appointmentsByFormId.get(item.id)
                  const isSigned = item.status === 'preenchida'

                  return (
                    <div
                      key={`card-${item.id}`}
                      className="p-4 bg-white space-y-3 transition-colors active:bg-slate-50/60"
                    >
                      {/* Topo: Nome da paciente em negrito + botão 3 pontos (área mínima 44x44px) */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-slate-900 text-sm leading-snug truncate">
                            {item.patient_name || (
                              <span className="italic font-normal text-slate-400">
                                Pendente de nome
                              </span>
                            )}
                          </h3>
                          {/* CPF em letra pequena e cinza */}
                          <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                            {item.patient_cpf || item.patient_phone || 'Sem contato prévio'}
                          </p>
                        </div>

                        {/* Botão de 3 pontos com área de toque mínima de 44x44px */}
                        <button
                          type="button"
                          onClick={() => setDrawerActionForm(item)}
                          className="w-11 h-11 -mr-2 -mt-2 inline-flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200 transition-colors shrink-0"
                          aria-label={`Ações da ficha de ${item.patient_name || 'paciente'}`}
                        >
                          <MoreVertical className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Etiqueta lavanda do procedimento */}
                      <div>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#EDE7F6] text-[#6B3FA0] border border-purple-200/60">
                          {typeLabelMap[item.form_type] || item.form_type}
                        </span>
                      </div>

                      {/* Etiquetas da ficha e do lembrete lado a lado */}
                      <div className="flex items-center gap-2 flex-wrap pt-0.5">
                        {isSigned ? (
                          <Badge className="bg-emerald-50 text-[#2E9E5B] hover:bg-emerald-50 border-emerald-200 font-medium text-[11px] gap-1 whitespace-nowrap">
                            <CheckCircle2 className="w-3 h-3" />
                            Assinada
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-50 text-[#D99A00] hover:bg-amber-50 border-amber-200 font-medium text-[11px] gap-1 whitespace-nowrap">
                            <Clock className="w-3 h-3" />
                            Aguardando
                          </Badge>
                        )}

                        <ReminderStateBadge
                          appointment={itemAppointment}
                          formEmail={item.patient_email}
                          signedAt={item.signed_at}
                          reminders={reminders}
                          onRetry={handleRetryReminder}
                          isRetrying={retryingReminderId === itemAppointment?.id}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* 2. VISÃO DESKTOP (>= 768px): Tabela intocada */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                      <th className="py-2.5 px-4">Paciente</th>
                      <th className="py-2.5 px-4">Procedimento</th>
                      <th className="py-2.5 px-4">Ficha</th>
                      <th className="py-2.5 px-4">Comprovante</th>
                      <th className="py-2.5 px-4">Lembrete</th>
                      <th className="py-2.5 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredForms.map((item) => {
                      const linkUrl = `${window.location.origin}/f/${item.token}`
                      const isCopied = copiedId === item.id
                      const itemAppointment = appointmentsByFormId.get(item.id)
                      const isSigned = item.status === 'preenchida'

                      // Lembrete em falha
                      const remState = (itemAppointment?.reminder_state || '').trim().toLowerCase()
                      const hasReminderFailure =
                        remState === 'falha no envio' || remState === 'falha'
                      const hasProofFailure = item.email_delivery_status === 'falha'

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* Coluna 1: Paciente (nome em negrito, CPF em letra pequena e cinza na linha de baixo) */}
                          <td className="py-2.5 px-4">
                            <div className="font-bold text-slate-900 leading-snug">
                              {item.patient_name || (
                                <span className="italic font-normal text-slate-400">
                                  Pendente de nome
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 leading-snug">
                              {item.patient_cpf || item.patient_phone || 'Sem contato prévio'}
                            </div>
                          </td>

                          {/* Coluna 2: Procedimento (etiqueta lavanda #EDE7F6) */}
                          <td className="py-2.5 px-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#EDE7F6] text-[#6B3FA0] border border-purple-200/60 whitespace-nowrap">
                              {typeLabelMap[item.form_type] || item.form_type}
                            </span>
                          </td>

                          {/* Coluna 3: Ficha (Aguardando em âmbar #D99A00 ou Assinada em verde #2E9E5B) */}
                          <td className="py-2.5 px-4">
                            {isSigned ? (
                              <Badge className="bg-emerald-50 text-[#2E9E5B] hover:bg-emerald-50 border-emerald-200 font-medium text-[11px] gap-1 whitespace-nowrap">
                                <CheckCircle2 className="w-3 h-3" />
                                Assinada
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-50 text-[#D99A00] hover:bg-amber-50 border-amber-200 font-medium text-[11px] gap-1 whitespace-nowrap">
                                <Clock className="w-3 h-3" />
                                Aguardando
                              </Badge>
                            )}
                          </td>

                          {/* Coluna 4: Comprovante (Enviado verde c/ data, Falha vermelho c/ Reenviar, Não enviado cinza) */}
                          <td className="py-2.5 px-4">
                            {item.email_delivery_status === 'enviado' ? (
                              <div className="flex flex-col items-start leading-tight">
                                <span className="text-[#2E9E5B] font-semibold text-[11px] flex items-center gap-1">
                                  <Mail className="w-3 h-3" /> Enviado
                                </span>
                                <span className="text-[10px] text-slate-500 mt-0.5">
                                  {formatDateBR(
                                    item.email_sent_at || item.signed_at || item.created,
                                  )}
                                </span>
                              </div>
                            ) : item.email_delivery_status === 'falha' ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[#C0392B] font-semibold text-[11px] flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" /> Falha
                                </span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleResendEmail(item.id)}
                                  disabled={resendingId === item.id}
                                  className="h-5 px-1.5 text-[10px] text-[#C0392B] border-red-300 hover:bg-red-50 hover:text-red-800 gap-1"
                                  title="Reenviar comprovante por e-mail"
                                >
                                  {resendingId === item.id ? (
                                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                  ) : (
                                    <Send className="w-2.5 h-2.5" />
                                  )}
                                  Reenviar
                                </Button>
                              </div>
                            ) : (
                              <span className="text-slate-400 font-medium text-[11px]">
                                Não enviado
                              </span>
                            )}
                          </td>

                          {/* Coluna 5: Lembrete (ocupa uma linha só, sem a linha 'Proc.: ...') */}
                          <td className="py-2.5 px-4">
                            <ReminderStateBadge
                              appointment={itemAppointment}
                              formEmail={item.patient_email}
                              signedAt={item.signed_at}
                              reminders={reminders}
                              onRetry={handleRetryReminder}
                              isRetrying={retryingReminderId === itemAppointment?.id}
                            />
                          </td>

                          {/* Coluna 6: Ações (Menu dropdown de 3 pontos) */}
                          <td className="py-2.5 px-4 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                                  aria-label="Ações da ficha"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48 text-xs">
                                {/* Ver detalhes */}
                                <DropdownMenuItem asChild>
                                  <Link
                                    to={`/painel/ficha/${item.id}`}
                                    className="flex items-center gap-2 cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Ver detalhes</span>
                                  </Link>
                                </DropdownMenuItem>

                                {/* Abrir ficha (link público do token) */}
                                <DropdownMenuItem
                                  onClick={() => window.open(linkUrl, '_blank')}
                                  className="flex items-center gap-2 cursor-pointer"
                                >
                                  <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Abrir ficha</span>
                                </DropdownMenuItem>

                                {/* Copiar link se ainda pendente */}
                                {item.status === 'pendente' && (
                                  <DropdownMenuItem
                                    onClick={() => copyToClipboard(linkUrl, item.id)}
                                    className="flex items-center gap-2 cursor-pointer"
                                  >
                                    {isCopied ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                                    )}
                                    <span>{isCopied ? 'Link copiado!' : 'Copiar link'}</span>
                                  </DropdownMenuItem>
                                )}

                                {/* Reenviar comprovante (habilitado se assinado; destaque se houver falha) */}
                                {isSigned && (
                                  <DropdownMenuItem
                                    onClick={() => handleResendEmail(item.id)}
                                    disabled={resendingId === item.id}
                                    className={`flex items-center gap-2 cursor-pointer ${
                                      hasProofFailure
                                        ? 'text-[#C0392B] focus:text-[#C0392B]'
                                        : 'text-slate-700'
                                    }`}
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                    <span>Reenviar comprovante</span>
                                  </DropdownMenuItem>
                                )}

                                {/* Reenviar lembrete (disponível quando há agendamento vinculado) */}
                                {itemAppointment && (
                                  <DropdownMenuItem
                                    onClick={() => handleRetryReminder(itemAppointment.id)}
                                    disabled={retryingReminderId === itemAppointment.id}
                                    className={`flex items-center gap-2 cursor-pointer ${
                                      hasReminderFailure
                                        ? 'text-[#C0392B] focus:text-[#C0392B]'
                                        : 'text-slate-700'
                                    }`}
                                  >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    <span>Reenviar lembrete</span>
                                  </DropdownMenuItem>
                                )}

                                <DropdownMenuSeparator />

                                {/* Excluir (com confirmação) */}
                                <DropdownMenuItem
                                  onClick={() => setFormToDelete(item)}
                                  className="flex items-center gap-2 text-red-600 focus:text-red-700 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Excluir</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Drawer / Bottom sheet de ações mobile para a ficha selecionada */}
      <Drawer
        open={!!drawerActionForm}
        onOpenChange={(open) => {
          if (!open) setDrawerActionForm(null)
        }}
      >
        <DrawerContent className="bg-white max-h-[85vh] p-0 rounded-t-[20px]">
          {drawerActionForm &&
            (() => {
              const item = drawerActionForm
              const linkUrl = `${window.location.origin}/f/${item.token}`
              const isCopied = copiedId === item.id
              const itemAppointment = appointmentsByFormId.get(item.id)
              const isSigned = item.status === 'preenchida'
              const remState = (itemAppointment?.reminder_state || '').trim().toLowerCase()
              const hasReminderFailure = remState === 'falha no envio' || remState === 'falha'
              const hasProofFailure = item.email_delivery_status === 'falha'

              return (
                <div className="flex flex-col">
                  <DrawerHeader className="text-left px-5 pt-3 pb-2 border-b border-slate-100">
                    <DrawerTitle className="text-base font-bold text-slate-900 truncate">
                      {item.patient_name || 'Ficha do paciente'}
                    </DrawerTitle>
                    <DrawerDescription className="text-xs text-slate-500 truncate">
                      {item.patient_cpf ||
                        item.patient_phone ||
                        typeLabelMap[item.form_type] ||
                        item.form_type}
                    </DrawerDescription>
                  </DrawerHeader>

                  <div className="py-2 px-2 flex flex-col divide-y divide-slate-100">
                    {/* Ver detalhes */}
                    <Link
                      to={`/painel/ficha/${item.id}`}
                      onClick={() => setDrawerActionForm(null)}
                      className="flex items-center gap-3 px-4 min-h-[48px] rounded-lg text-sm text-slate-800 hover:bg-slate-50 active:bg-slate-100 transition-colors"
                    >
                      <Eye className="w-5 h-5 text-slate-500 shrink-0" />
                      <span className="font-medium">Ver detalhes da ficha</span>
                    </Link>

                    {/* Abrir ficha pública */}
                    <button
                      type="button"
                      onClick={() => {
                        setDrawerActionForm(null)
                        window.open(linkUrl, '_blank')
                      }}
                      className="flex items-center gap-3 px-4 min-h-[48px] rounded-lg text-sm text-slate-800 hover:bg-slate-50 active:bg-slate-100 transition-colors text-left w-full"
                    >
                      <ExternalLink className="w-5 h-5 text-slate-500 shrink-0" />
                      <span className="font-medium">Abrir ficha (link do paciente)</span>
                    </button>

                    {/* Copiar link se pendente */}
                    {item.status === 'pendente' && (
                      <button
                        type="button"
                        onClick={() => {
                          copyToClipboard(linkUrl, item.id)
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

                    {/* Reenviar comprovante (disponível quando a ficha foi assinada) */}
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

                    {/* Reenviar lembrete (disponível quando há agendamento vinculado) */}
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
