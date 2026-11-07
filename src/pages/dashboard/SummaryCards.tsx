import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { FilterX } from 'lucide-react'
import type { PatientCardCategory } from './dashboardHelpers'

interface SummaryCardsProps {
  counts: {
    aguardando: number
    prontas: number
    pendencia: number
  }
  categoryFilter: PatientCardCategory | null
  onSelectCategory: (cat: PatientCardCategory | null) => void
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  counts,
  categoryFilter,
  onSelectCategory,
}) => {
  const toggle = (cat: PatientCardCategory) => {
    onSelectCategory(categoryFilter === cat ? null : cat)
  }

  return (
    <>
      {/* Desktop (md:grid): 3 cartões grandes na ordem solicitada: Aguardando a paciente, Fichas prontas, Com pendência */}
      <div className="hidden md:grid md:grid-cols-3 gap-4">
        {/* Cartão 1: Aguardando a paciente */}
        <Card
          onClick={() => toggle('aguardando_paciente')}
          className={`cursor-pointer transition-all border select-none ${
            categoryFilter === 'aguardando_paciente'
              ? 'border-[#D99A00] ring-2 ring-[#D99A00]/30 shadow-sm bg-amber-50/40'
              : 'border-slate-200/80 hover:border-amber-300 hover:shadow-xs'
          }`}
        >
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Aguardando a paciente
              </p>
              <p className="text-2xl sm:text-3xl font-black text-[#D99A00] mt-1">
                {counts.aguardando}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Link gerado, ficha ainda não assinada
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-100/70 text-[#D99A00] flex items-center justify-center font-bold text-lg">
              ⏳
            </div>
          </CardContent>
        </Card>

        {/* Cartão 2: Fichas prontas */}
        <Card
          onClick={() => toggle('fichas_prontas')}
          className={`cursor-pointer transition-all border select-none ${
            categoryFilter === 'fichas_prontas'
              ? 'border-[#2E9E5B] ring-2 ring-[#2E9E5B]/30 shadow-sm bg-emerald-50/40'
              : 'border-slate-200/80 hover:border-emerald-300 hover:shadow-xs'
          }`}
        >
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Fichas prontas
              </p>
              <p className="text-2xl sm:text-3xl font-black text-[#2E9E5B] mt-1">
                {counts.prontas}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Termo assinado e comprovante entregue
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-100/70 text-[#2E9E5B] flex items-center justify-center font-bold text-lg">
              ✓
            </div>
          </CardContent>
        </Card>

        {/* Cartão 3: Com pendência */}
        <Card
          onClick={() => toggle('com_pendencia')}
          className={`cursor-pointer transition-all border select-none ${
            categoryFilter === 'com_pendencia'
              ? 'border-[#C0392B] ring-2 ring-[#C0392B]/30 shadow-sm bg-red-50/40'
              : 'border-slate-200/80 hover:border-red-300 hover:shadow-xs'
          }`}
        >
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Com pendência
              </p>
              <p className="text-2xl sm:text-3xl font-black text-[#C0392B] mt-1">
                {counts.pendencia}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Falhas de envio ou prazo urgente &lt;24h
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-red-100/70 text-[#C0392B] flex items-center justify-center font-bold text-lg">
              !
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mobile (md:hidden): Grade compacta 3 colunas */}
      <div className="block md:hidden">
        <div className="grid grid-cols-3 gap-2">
          {/* Mobile 1: Aguardando */}
          <button
            type="button"
            onClick={() => toggle('aguardando_paciente')}
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
              {counts.aguardando}
            </div>
          </button>

          {/* Mobile 2: Prontas */}
          <button
            type="button"
            onClick={() => toggle('fichas_prontas')}
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
              {counts.prontas}
            </div>
          </button>

          {/* Mobile 3: Pendência */}
          <button
            type="button"
            onClick={() => toggle('com_pendencia')}
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
              {counts.pendencia}
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
              onClick={() => onSelectCategory(null)}
              className="text-[11px] text-slate-600 hover:text-slate-900 underline flex items-center gap-1"
            >
              <FilterX className="w-3 h-3" />
              Limpar filtro
            </button>
          </div>
        )}
      </div>
    </>
  )
}
