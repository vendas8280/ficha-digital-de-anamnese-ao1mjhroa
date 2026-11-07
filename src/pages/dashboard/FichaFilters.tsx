import React from 'react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search } from 'lucide-react'
import type { PeriodFilter } from './dashboardHelpers'

interface FichaFiltersProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  typeFilter: string
  onTypeFilterChange: (value: string) => void
  periodFilter: PeriodFilter
  onPeriodFilterChange: (value: PeriodFilter) => void
  totalFiltered: number
}

export const FichaFilters: React.FC<FichaFiltersProps> = ({
  searchTerm,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  periodFilter,
  onPeriodFilterChange,
  totalFiltered,
}) => {
  return (
    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
      {/* Input de busca com placeholder exigido pela spec:
          "Buscar por nome, CPF, telefone ou e-mail" */}
      <div className="relative flex-1">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <Input
          type="text"
          placeholder="Buscar por nome, CPF, telefone ou e-mail"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 text-xs h-9 bg-white border-slate-200"
        />
      </div>

      <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center">
        {/* Filtro de Procedimento */}
        <Select value={typeFilter} onValueChange={onTypeFilterChange}>
          <SelectTrigger className="w-full sm:w-[190px] text-xs h-9 bg-white border-slate-200">
            <SelectValue placeholder="Procedimento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos" className="text-xs">
              Todos os procedimentos
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

        {/* Filtro de Período */}
        <Select
          value={periodFilter}
          onValueChange={(val) => onPeriodFilterChange(val as PeriodFilter)}
        >
          <SelectTrigger className="w-full sm:w-[140px] text-xs h-9 bg-white border-slate-200">
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
              Todo o histórico
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Contador rápido */}
        <div className="text-[11px] text-slate-500 whitespace-nowrap px-1 hidden lg:block">
          {totalFiltered} {totalFiltered === 1 ? 'ficha' : 'fichas'}
        </div>
      </div>
    </div>
  )
}
