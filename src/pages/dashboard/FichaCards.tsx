import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  MoreVertical,
  Calendar,
  Copy,
  Check,
  MessageCircle,
  Send,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react'
import { ReminderStateBadge } from '@/components/ReminderStateBadge'
import { formatDateBR } from '@/lib/formatters'
import type { FormSubmissionRecord, ProcedureAppointmentRecord } from '@/services/forms'
import { TYPE_LABEL_MAP, maskCpfMobile, buildWhatsAppLinkUrl } from './dashboardHelpers'

interface FichaCardsProps {
  forms: FormSubmissionRecord[]
  appointmentsByFormId: Map<string, ProcedureAppointmentRecord>
  copiedId: string | null
  resendingId: string | null
  onCopyLink: (url: string, id: string) => void
  onResendEmail: (id: string) => void
  onOpenDrawerAction: (form: FormSubmissionRecord) => void
}

export const FichaCards: React.FC<FichaCardsProps> = ({
  forms,
  appointmentsByFormId,
  copiedId,
  resendingId,
  onCopyLink,
  onResendEmail,
  onOpenDrawerAction,
}) => {
  // Estado para armazenar quais CPFs foram revelados no mobile
  const [revealedCpfIds, setRevealedCpfIds] = useState<Set<string>>(new Set())

  const toggleCpfVisibility = (id: string) => {
    setRevealedCpfIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div className="block md:hidden divide-y divide-slate-100">
      {forms.map((item) => {
        const isSigned = item.status === 'preenchida'
        const appt = appointmentsByFormId.get(item.id)
        const linkUrl = `${window.location.origin}/f/${item.token}`
        const isCopied = copiedId === item.id
        const patientName = item.patient_name?.trim() || 'Paciente sem nome'
        const hasPhone = !!item.patient_phone?.trim()
        const isCpfRevealed = revealedCpfIds.has(item.id)

        // Exibição do CPF: mascarado por padrão (***.***.915-73), revelado após toque no olho
        const maskedCpf = maskCpfMobile(item.patient_cpf)
        const displayCpf = isCpfRevealed ? item.patient_cpf : maskedCpf

        return (
          <div key={item.id} className="p-4 space-y-3 bg-white">
            {/* Linha 1: Nome da paciente + botão do drawer de ações */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="font-semibold text-sm text-slate-900 truncate">{patientName}</h3>
                </div>

                {/* CPF mascarado no celular com toggle de exibição ao toque */}
                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                  {item.patient_cpf ? (
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] text-slate-700">
                        CPF: {displayCpf}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleCpfVisibility(item.id)}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 active:bg-slate-100 transition-colors"
                        aria-label={isCpfRevealed ? 'Ocultar CPF' : 'Mostrar CPF completo'}
                        title={isCpfRevealed ? 'Ocultar CPF' : 'Mostrar CPF completo'}
                      >
                        {isCpfRevealed ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  ) : (
                    <span className="text-slate-400 text-[11px]">CPF não informado</span>
                  )}
                </div>
              </div>

              {/* Botão de 3 pontos que abre o drawer inferior */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenDrawerAction(item)}
                className="h-10 w-10 text-slate-600 hover:text-slate-900 shrink-0"
                aria-label="Ações da ficha"
              >
                <MoreVertical className="w-5 h-5" />
              </Button>
            </div>

            {/* Linha 2: ATALHOS RÁPIDOS NO CARTÃO (ao lado/abaixo do nome)
                - Se assinada: "Enviar comprovante"
                - Se não assinada: "Copiar link" e "WhatsApp" (ou "Sem telefone cadastrado") */}
            <div className="flex items-center gap-2 flex-wrap pt-0.5">
              {isSigned ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onResendEmail(item.id)}
                  disabled={resendingId === item.id}
                  className="h-7 px-2.5 text-xs gap-1.5 border-purple-200 text-[#6B3FA0] hover:bg-purple-50"
                >
                  {resendingId === item.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Enviar comprovante</span>
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onCopyLink(linkUrl, item.id)}
                    className="h-7 px-2.5 text-xs gap-1.5 text-slate-700 hover:text-slate-900 border-slate-200"
                  >
                    {isCopied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{isCopied ? 'Link copiado.' : 'Copiar link'}</span>
                  </Button>

                  {hasPhone ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      asChild
                      className="h-7 px-2.5 text-xs gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                    >
                      <a
                        href={buildWhatsAppLinkUrl(item.patient_phone!, patientName, linkUrl)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </a>
                    </Button>
                  ) : (
                    <span className="text-[11px] text-slate-400 border border-slate-200 rounded px-2 py-1 bg-slate-50">
                      Sem telefone cadastrado
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Linha 3: Procedimento & Status */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <Badge variant="outline" className="text-[11px] font-normal border-slate-200">
                {TYPE_LABEL_MAP[item.form_type] || item.form_type}
              </Badge>

              {isSigned ? (
                <Badge className="bg-emerald-100 text-emerald-800 text-[11px] font-medium border-0 gap-1">
                  <span>✓</span> Termo assinado
                </Badge>
              ) : (
                <Badge className="bg-amber-100 text-amber-800 text-[11px] font-medium border-0 gap-1">
                  <span>⏳</span> Aguardando paciente
                </Badge>
              )}
            </div>

            {/* Linha 4: Agendamento e selo do lembrete */}
            {appt ? (
              <div className="pt-1 border-t border-slate-100 space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-[#6B3FA0]" />
                  <span>
                    Procedimento: {formatDateBR(appt.procedure_date)}
                    {appt.procedure_time ? ` às ${appt.procedure_time}` : ''}
                  </span>
                </div>
                <div>
                  <ReminderStateBadge
                    appointment={appt}
                    formEmail={item.patient_email}
                    signedAt={item.signed_at}
                  />
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-slate-400">Sem agendamento vinculado</div>
            )}

            {/* Linha 5: Botão principal do cartão */}
            <div className="pt-2">
              {isSigned ? (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="w-full text-xs font-medium border-purple-200 text-[#6B3FA0] hover:bg-purple-50"
                >
                  <Link to={`/painel/ficha/${item.id}`}>Ver detalhes da ficha assinada</Link>
                </Button>
              ) : (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="w-full text-xs font-medium border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  <a href={linkUrl} target="_blank" rel="noreferrer">
                    Abrir link da paciente
                  </a>
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
