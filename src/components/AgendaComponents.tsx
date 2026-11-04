import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays,
  CalendarCheck2,
  Clock,
  AlertCircle,
  Plus,
  RefreshCw,
  Settings,
  LogOut,
  Calendar,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
export type AgendaTopCardFilter = 'hoje' | 'esta_semana' | 'fichas_pendentes' | 'lembretes_falha'
export type AgendaPillFilter = 'hoje' | 'esta_semana' | 'proximos' | 'todos'

interface AgendaHeaderProps {
  onSignOut: () => void
}

export function AgendaHeader({ onSignOut }: AgendaHeaderProps) {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#6B3FA0] text-white rounded-xl flex items-center justify-center shadow-md">
            <Calendar className="w-5 h-5 text-purple-200" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Andresa Souza Clinic
            </h1>
            <p className="text-xs text-[#6B3FA0] font-medium">Agenda de Procedimentos</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Item 1 da spec: Agenda como primeiro item do menu, antes do painel */}
          <Button
            asChild
            variant="default"
            size="sm"
            className="text-xs gap-1.5 bg-[#6B3FA0] hover:bg-[#583385] text-white shadow-xs"
          >
            <Link to="/agenda">
              <Calendar className="w-3.5 h-3.5" />
              <span>Agenda</span>
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="text-xs gap-1.5 border-purple-200 text-[#6B3FA0] hover:bg-purple-50"
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
            onClick={onSignOut}
            className="text-xs gap-1 text-slate-600 hover:text-red-700"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </div>
    </header>
  )
}

interface AgendaTopCardsProps {
  counts: {
    hoje: number
    estaSemana: number
    fichasPendentes: number
    lembretesFalha: number
  }
  topCardFilter: AgendaTopCardFilter | null
  onCardClick: (card: AgendaTopCardFilter) => void
}

export function AgendaTopCards({ counts, topCardFilter, onCardClick }: AgendaTopCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* Card 1: Hoje */}
      <Card
        role="button"
        tabIndex={0}
        aria-pressed={topCardFilter === 'hoje'}
        onClick={() => onCardClick('hoje')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onCardClick('hoje')
          }
        }}
        className={`rounded-[12px] bg-white border cursor-pointer select-none transition-all duration-150 hover:shadow-md active:bg-slate-50 ${
          topCardFilter === 'hoje'
            ? 'border-[#6B3FA0] ring-2 ring-[#6B3FA0]/25 shadow-sm bg-purple-50/20'
            : 'border-slate-200/80 hover:border-purple-300'
        }`}
      >
        <CardHeader className="p-3.5 sm:p-4 pb-1 sm:pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Hoje
          </CardTitle>
          <Calendar className="w-4 h-4 text-[#6B3FA0]" />
        </CardHeader>
        <CardContent className="p-3.5 sm:p-4 pt-1">
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono">
            {counts.hoje}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">Atendimentos de hoje</p>
        </CardContent>
      </Card>

      {/* Card 2: Esta semana */}
      <Card
        role="button"
        tabIndex={0}
        aria-pressed={topCardFilter === 'esta_semana'}
        onClick={() => onCardClick('esta_semana')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onCardClick('esta_semana')
          }
        }}
        className={`rounded-[12px] bg-white border cursor-pointer select-none transition-all duration-150 hover:shadow-md active:bg-slate-50 ${
          topCardFilter === 'esta_semana'
            ? 'border-[#6B3FA0] ring-2 ring-[#6B3FA0]/25 shadow-sm bg-purple-50/20'
            : 'border-slate-200/80 hover:border-purple-300'
        }`}
      >
        <CardHeader className="p-3.5 sm:p-4 pb-1 sm:pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Esta semana
          </CardTitle>
          <CalendarDays className="w-4 h-4 text-[#6B3FA0]" />
        </CardHeader>
        <CardContent className="p-3.5 sm:p-4 pt-1">
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono">
            {counts.estaSemana}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">Da semana corrente</p>
        </CardContent>
      </Card>

      {/* Card 3: Fichas pendentes */}
      <Card
        role="button"
        tabIndex={0}
        aria-pressed={topCardFilter === 'fichas_pendentes'}
        onClick={() => onCardClick('fichas_pendentes')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onCardClick('fichas_pendentes')
          }
        }}
        className={`rounded-[12px] bg-white border cursor-pointer select-none transition-all duration-150 hover:shadow-md active:bg-slate-50 ${
          topCardFilter === 'fichas_pendentes'
            ? 'border-[#D99A00] ring-2 ring-[#D99A00]/25 shadow-sm bg-amber-50/20'
            : 'border-slate-200/80 hover:border-amber-400'
        }`}
      >
        <CardHeader className="p-3.5 sm:p-4 pb-1 sm:pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-xs font-semibold text-[#D99A00] uppercase tracking-wider">
            Fichas pendentes
          </CardTitle>
          <Clock className="w-4 h-4 text-[#D99A00]" />
        </CardHeader>
        <CardContent className="p-3.5 sm:p-4 pt-1">
          <div className="text-2xl sm:text-3xl font-extrabold text-[#D99A00] font-mono">
            {counts.fichasPendentes}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">Aguardando ficha assinada</p>
        </CardContent>
      </Card>

      {/* Card 4: Lembretes com falha */}
      <Card
        role="button"
        tabIndex={0}
        aria-pressed={topCardFilter === 'lembretes_falha'}
        onClick={() => onCardClick('lembretes_falha')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onCardClick('lembretes_falha')
          }
        }}
        className={`rounded-[12px] bg-white border cursor-pointer select-none transition-all duration-150 hover:shadow-md active:bg-slate-50 ${
          topCardFilter === 'lembretes_falha'
            ? 'border-[#C0392B] ring-2 ring-[#C0392B]/25 shadow-sm bg-rose-50/20'
            : 'border-slate-200/80 hover:border-rose-400'
        }`}
      >
        <CardHeader className="p-3.5 sm:p-4 pb-1 sm:pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-xs font-semibold text-[#C0392B] uppercase tracking-wider">
            Lembretes com falha
          </CardTitle>
          <AlertCircle className="w-4 h-4 text-[#C0392B]" />
        </CardHeader>
        <CardContent className="p-3.5 sm:p-4 pt-1">
          <div className="text-2xl sm:text-3xl font-extrabold text-[#C0392B] font-mono">
            {counts.lembretesFalha}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">Lembretes que falharam</p>
        </CardContent>
      </Card>
    </div>
  )
}

interface AgendaFilterPillsProps {
  counts: {
    hoje: number
    estaSemana: number
    proximos: number
    todos: number
  }
  pillFilter: AgendaPillFilter
  topCardFilter: AgendaTopCardFilter | null
  filterTomorrowOnly: boolean
  loading: boolean
  onPillClick: (pill: AgendaPillFilter) => void
  onClearTomorrowFilter: () => void
  onRefresh: () => void
  onOpenNewModal: () => void
}

export function AgendaFilterPills({
  counts,
  pillFilter,
  topCardFilter,
  filterTomorrowOnly,
  loading,
  onPillClick,
  onClearTomorrowFilter,
  onRefresh,
  onOpenNewModal,
}: AgendaFilterPillsProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
        <button
          type="button"
          onClick={() => onPillClick('hoje')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold tracking-tight transition-all duration-150 shrink-0 ${
            !filterTomorrowOnly &&
            pillFilter === 'hoje' &&
            topCardFilter !== 'fichas_pendentes' &&
            topCardFilter !== 'lembretes_falha'
              ? 'bg-[#6B3FA0] text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:border-purple-300 hover:text-[#6B3FA0]'
          }`}
        >
          Hoje ({counts.hoje})
        </button>

        <button
          type="button"
          onClick={() => onPillClick('esta_semana')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold tracking-tight transition-all duration-150 shrink-0 ${
            !filterTomorrowOnly &&
            pillFilter === 'esta_semana' &&
            topCardFilter !== 'fichas_pendentes' &&
            topCardFilter !== 'lembretes_falha'
              ? 'bg-[#6B3FA0] text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:border-purple-300 hover:text-[#6B3FA0]'
          }`}
        >
          Esta semana ({counts.estaSemana})
        </button>

        <button
          type="button"
          onClick={() => onPillClick('proximos')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold tracking-tight transition-all duration-150 shrink-0 ${
            !filterTomorrowOnly && pillFilter === 'proximos' && !topCardFilter
              ? 'bg-[#6B3FA0] text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:border-purple-300 hover:text-[#6B3FA0]'
          }`}
        >
          Próximos ({counts.proximos})
        </button>

        <button
          type="button"
          onClick={() => onPillClick('todos')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold tracking-tight transition-all duration-150 shrink-0 ${
            !filterTomorrowOnly && pillFilter === 'todos' && !topCardFilter
              ? 'bg-[#6B3FA0] text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:border-purple-300 hover:text-[#6B3FA0]'
          }`}
        >
          Todos ({counts.todos})
        </button>

        {filterTomorrowOnly && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-amber-100 text-amber-900 font-medium">
            Filtrando: Amanhã pendente
            <button
              type="button"
              onClick={onClearTomorrowFilter}
              className="font-bold hover:underline"
            >
              ✕
            </button>
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          className="text-xs h-9 border-slate-200 text-slate-600 hover:text-slate-900"
          title="Atualizar agenda"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>

        <Button
          size="sm"
          onClick={onOpenNewModal}
          className="bg-[#6B3FA0] hover:bg-[#583385] text-white text-xs gap-1.5 font-medium shadow-sm h-9"
        >
          <Plus className="w-4 h-4" />
          Novo agendamento
        </Button>
      </div>
    </div>
  )
}
