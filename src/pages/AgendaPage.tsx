import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, Calendar, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import {
  ProcedureAppointmentRecord,
  FormSubmissionRecord,
  formsService,
  appointmentsService,
} from '@/services/forms'
import {
  AgendaItem,
  getTodayDateString,
  getTomorrowDateString,
  getCurrentWeekRange,
  extractDateKey,
  extractTimeKey,
  formatDayHeaderBR,
} from '@/lib/agendaHelpers'
import { AgendaItemRow } from '@/components/AgendaItemRow'
import { AgendaWarningBanner } from '@/components/AgendaWarningBanner'
import { NewAppointmentDialog } from '@/components/NewAppointmentDialog'
import { RescheduleDialog } from '@/components/RescheduleDialog'
import {
  AgendaHeader,
  AgendaTopCards,
  AgendaFilterPills,
  AgendaTopCardFilter,
  AgendaPillFilter,
} from '@/components/AgendaComponents'

export default function AgendaPage() {
  const { isAuthenticated, isLoading: authLoading, signOut } = useAuth()
  const navigate = useNavigate()

  const [appointments, setAppointments] = useState<ProcedureAppointmentRecord[]>([])
  const [forms, setForms] = useState<FormSubmissionRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros ativos (padrão ao abrir: 'hoje')
  const [pillFilter, setPillFilter] = useState<AgendaPillFilter>('hoje')
  const [topCardFilter, setTopCardFilter] = useState<AgendaTopCardFilter | null>(null)
  const [filterTomorrowOnly, setFilterTomorrowOnly] = useState(false)

  // Modais
  const [openNewApptModal, setOpenNewApptModal] = useState(false)
  const [rescheduleItem, setRescheduleItem] = useState<AgendaItem | null>(null)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login')
    }
  }, [authLoading, isAuthenticated, navigate])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [apptsData, formsData] = await Promise.all([
        appointmentsService.listAll(),
        formsService.listForms(),
      ])
      setAppointments(apptsData)
      setForms(formsData)
    } catch (err) {
      console.warn('Erro ao carregar dados da agenda:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const formsById = useMemo(() => {
    const map = new Map<string, FormSubmissionRecord>()
    for (const f of forms) {
      map.set(f.id, f)
    }
    return map
  }, [forms])

  const todayStr = useMemo(() => getTodayDateString(), [])
  const tomorrowStr = useMemo(() => getTomorrowDateString(), [])
  const weekRange = useMemo(() => getCurrentWeekRange(), [])

  const allAgendaItems: AgendaItem[] = useMemo(() => {
    return appointments.map((appt) => {
      const form = appt.form_submission ? formsById.get(appt.form_submission) : undefined
      const dateKey = extractDateKey(appt.procedure_date)
      const timeKey = extractTimeKey(appt.procedure_time)
      return {
        appointment: appt,
        form,
        dateKey,
        timeKey,
      }
    })
  }, [appointments, formsById])

  const counts = useMemo(() => {
    let countHoje = 0
    let countEstaSemana = 0
    let countFichasPendentes = 0
    let countLembretesFalha = 0
    let countProximos = 0
    let countAmanhaPendentes = 0

    for (const item of allAgendaItems) {
      const { appointment, form, dateKey } = item
      const apptStatus = (appointment.status || 'agendado').toLowerCase()

      // "Hoje": conta todos os de hoje (inclusive faltou; cancelados também contam na agenda do dia)
      if (dateKey === todayStr) countHoje++

      // "Esta semana" e "Próximos": atendimentos futuros/pendentes da semana (faltou e cancelado saem)
      if (
        dateKey >= weekRange.start &&
        dateKey <= weekRange.end &&
        apptStatus !== 'faltou' &&
        apptStatus !== 'cancelado'
      ) {
        countEstaSemana++
      }

      if (dateKey > todayStr && apptStatus !== 'faltou' && apptStatus !== 'cancelado') {
        countProximos++
      }

      // Fichas pendentes: quem ainda precisa preencher; faltou e cancelado NÃO são contados como pendência
      const isSigned = form?.status === 'preenchida'
      if (!isSigned && apptStatus !== 'cancelado' && apptStatus !== 'faltou') {
        countFichasPendentes++
        if (dateKey === tomorrowStr) countAmanhaPendentes++
      }

      // Lembretes com falha: se faltou ou cancelado, não infla alerta de falha
      const remState = (appointment.reminder_state || '').trim().toLowerCase()
      if (remState.includes('falha') && apptStatus !== 'cancelado' && apptStatus !== 'faltou') {
        countLembretesFalha++
      }
    }

    return {
      hoje: countHoje,
      estaSemana: countEstaSemana,
      fichasPendentes: countFichasPendentes,
      lembretesFalha: countLembretesFalha,
      proximos: countProximos,
      todos: allAgendaItems.length,
      amanhaPendentes: countAmanhaPendentes,
    }
  }, [allAgendaItems, todayStr, tomorrowStr, weekRange])

  const filteredItems = useMemo(() => {
    return allAgendaItems.filter((item) => {
      const { appointment, form, dateKey } = item
      const remState = (appointment.reminder_state || '').trim().toLowerCase()
      const isSigned = form?.status === 'preenchida'
      const apptStatus = (appointment.status || 'agendado').toLowerCase()

      if (filterTomorrowOnly) {
        return (
          dateKey === tomorrowStr &&
          !isSigned &&
          apptStatus !== 'cancelado' &&
          apptStatus !== 'faltou'
        )
      }

      if (topCardFilter === 'hoje') return dateKey === todayStr
      if (topCardFilter === 'esta_semana')
        return (
          dateKey >= weekRange.start &&
          dateKey <= weekRange.end &&
          apptStatus !== 'faltou' &&
          apptStatus !== 'cancelado'
        )
      if (topCardFilter === 'fichas_pendentes')
        return !isSigned && apptStatus !== 'cancelado' && apptStatus !== 'faltou'
      if (topCardFilter === 'lembretes_falha')
        return remState.includes('falha') && apptStatus !== 'cancelado' && apptStatus !== 'faltou'

      if (pillFilter === 'hoje') return dateKey === todayStr
      if (pillFilter === 'esta_semana')
        return (
          dateKey >= weekRange.start &&
          dateKey <= weekRange.end &&
          apptStatus !== 'faltou' &&
          apptStatus !== 'cancelado'
        )
      if (pillFilter === 'proximos')
        return dateKey > todayStr && apptStatus !== 'faltou' && apptStatus !== 'cancelado'
      return true
    })
  }, [
    allAgendaItems,
    topCardFilter,
    pillFilter,
    filterTomorrowOnly,
    todayStr,
    tomorrowStr,
    weekRange,
  ])

  const groupedByDay = useMemo(() => {
    const groupsMap = new Map<string, AgendaItem[]>()
    for (const item of filteredItems) {
      const key = item.dateKey || 'sem_data'
      if (!groupsMap.has(key)) groupsMap.set(key, [])
      groupsMap.get(key)!.push(item)
    }

    const sortedDateKeys = Array.from(groupsMap.keys()).sort((a, b) => {
      if (a === 'sem_data') return 1
      if (b === 'sem_data') return -1
      return a.localeCompare(b)
    })

    return sortedDateKeys.map((dateKey) => {
      const itemsInDay = groupsMap.get(dateKey)!
      itemsInDay.sort((a, b) => a.timeKey.localeCompare(b.timeKey))
      return {
        dateKey,
        headerTitle: dateKey === 'sem_data' ? 'DATA NÃO DEFINIDA' : formatDayHeaderBR(dateKey),
        countText: itemsInDay.length === 1 ? '1 paciente' : `${itemsInDay.length} pacientes`,
        items: itemsInDay,
      }
    })
  }, [filteredItems])

  const handleTopCardClick = (card: AgendaTopCardFilter) => {
    setFilterTomorrowOnly(false)
    if (topCardFilter === card) {
      setTopCardFilter(null)
    } else {
      setTopCardFilter(card)
      if (card === 'hoje') setPillFilter('hoje')
      else if (card === 'esta_semana') setPillFilter('esta_semana')
    }
  }

  const handlePillClick = (pill: AgendaPillFilter) => {
    setFilterTomorrowOnly(false)
    setPillFilter(pill)
    if (pill === 'hoje') setTopCardFilter('hoje')
    else if (pill === 'esta_semana') setTopCardFilter('esta_semana')
    else setTopCardFilter(null)
  }

  return (
    <div className="min-h-screen bg-[#F7F7FA]">
      <AgendaHeader onSignOut={signOut} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <AgendaTopCards
          counts={counts}
          topCardFilter={topCardFilter}
          onCardClick={handleTopCardClick}
        />

        <AgendaWarningBanner
          pendingTomorrowCount={counts.amanhaPendentes}
          failedRemindersCount={counts.lembretesFalha}
          onFilterPendingTomorrow={() => {
            setFilterTomorrowOnly(true)
            setTopCardFilter(null)
          }}
          onFilterFailedReminders={() => {
            setFilterTomorrowOnly(false)
            setTopCardFilter('lembretes_falha')
          }}
        />

        <AgendaFilterPills
          counts={counts}
          pillFilter={pillFilter}
          topCardFilter={topCardFilter}
          filterTomorrowOnly={filterTomorrowOnly}
          loading={loading}
          onPillClick={handlePillClick}
          onClearTomorrowFilter={() => {
            setFilterTomorrowOnly(false)
            setPillFilter('hoje')
          }}
          onRefresh={loadData}
          onOpenNewModal={() => setOpenNewApptModal(true)}
        />

        <div className="space-y-6">
          {loading ? (
            <div className="bg-white rounded-[12px] border border-slate-200/80 p-12 text-center text-slate-500 text-sm">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#6B3FA0]" />
              Carregando atendimentos da agenda...
            </div>
          ) : groupedByDay.length === 0 ? (
            <div className="bg-white rounded-[12px] border border-slate-200/80 p-12 text-center shadow-sm space-y-4">
              <div className="w-12 h-12 bg-purple-50 text-[#6B3FA0] rounded-2xl flex items-center justify-center mx-auto">
                <Calendar className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-900">
                  {pillFilter === 'hoje' && !topCardFilter && !filterTomorrowOnly
                    ? 'Nenhum atendimento para hoje'
                    : 'Nenhum atendimento encontrado para este filtro'}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Cadastre um novo agendamento com data e horário para organizar os procedimentos da
                  clínica.
                </p>
              </div>
              <div>
                <Button
                  size="sm"
                  onClick={() => setOpenNewApptModal(true)}
                  className="bg-[#6B3FA0] hover:bg-[#583385] text-white text-xs gap-1.5 font-medium shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Novo agendamento
                </Button>
              </div>
            </div>
          ) : (
            groupedByDay.map((group) => (
              <section key={group.dateKey} className="space-y-2.5">
                <div className="bg-[#EDE7F6] border border-purple-200/60 rounded-xl px-4 py-2.5 flex items-center justify-between text-[#6B3FA0]">
                  <span className="text-xs font-bold tracking-wider uppercase font-mono sm:font-sans">
                    {group.headerTitle}
                  </span>
                  <span className="text-xs text-slate-600 font-medium">{group.countText}</span>
                </div>

                <div className="space-y-2">
                  {group.items.map((item) => (
                    <AgendaItemRow
                      key={item.appointment.id}
                      item={item}
                      onRefresh={loadData}
                      onOpenReschedule={(it) => setRescheduleItem(it)}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </main>

      <NewAppointmentDialog
        open={openNewApptModal}
        onOpenChange={setOpenNewApptModal}
        onSuccess={loadData}
        defaultSchedulingOpen={true}
        defaultDate={todayStr}
      />

      <RescheduleDialog
        appointment={rescheduleItem ? rescheduleItem.appointment : null}
        open={!!rescheduleItem}
        onOpenChange={(open) => {
          if (!open) setRescheduleItem(null)
        }}
        onSuccess={loadData}
      />
    </div>
  )
}
