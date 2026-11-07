import React from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Copy, Check, MessageCircle, Send, Loader2, Calendar } from 'lucide-react'
import { ReminderStateBadge } from '@/components/ReminderStateBadge'
import { formatDateBR } from '@/lib/formatters'
import type { FormSubmissionRecord, ProcedureAppointmentRecord } from '@/services/forms'
import { TYPE_LABEL_MAP, buildWhatsAppLinkUrl } from './dashboardHelpers'
import { FichaActionsMenu } from './FichaActionsMenu'

interface FichaTableProps {
  forms: FormSubmissionRecord[]
  appointmentsByFormId: Map<string, ProcedureAppointmentRecord>
  copiedId: string | null
  resendingId: string | null
  retryingReminderId: string | null
  sendingAuditProofId?: string | null
  onCopyLink: (url: string, id: string) => void
  onResendEmail: (id: string) => void
  onSendAuditProof?: (form: FormSubmissionRecord) => void
  onRetryReminder: (appointmentId: string) => void
  onOpenDelete: (form: FormSubmissionRecord) => void
}

export const FichaTable: React.FC<FichaTableProps> = ({
  forms,
  appointmentsByFormId,
  copiedId,
  resendingId,
  retryingReminderId,
  sendingAuditProofId,
  onCopyLink,
  onResendEmail,
  onSendAuditProof,
  onRetryReminder,
  onOpenDelete,
}) => {
  return (
    <div className="hidden md:block overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            <th className="py-3 px-4">Paciente</th>
            <th className="py-3 px-4">Procedimento</th>
            <th className="py-3 px-4">Status da Ficha</th>
            <th className="py-3 px-4">Agendamento & Lembrete</th>
            <th className="py-3 px-4">Criada em</th>
            <th className="py-3 px-4 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-xs">
          {forms.map((item) => {
            const isSigned = item.status === 'preenchida'
            const appt = appointmentsByFormId.get(item.id)
            const linkUrl = `${window.location.origin}/f/${item.token}`
            const isCopied = copiedId === item.id
            const patientName = item.patient_name?.trim() || 'Paciente sem nome'
            const hasPhone = !!item.patient_phone?.trim()

            return (
              <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                {/* Paciente + CPF completo no desktop + atalhos rápidos */}
                <td className="py-3.5 px-4 font-medium text-slate-900">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900">{patientName}</span>

                    {/* ATALHOS RÁPIDOS AO LADO DO NOME:
                        - Se a ficha já estiver assinada: "Enviar comprovante"
                        - Se não assinada: "Copiar link" e "WhatsApp" (ou "Sem telefone cadastrado") */}
                    {isSigned ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onResendEmail(item.id)}
                        disabled={resendingId === item.id}
                        className="h-6 px-2 text-[11px] gap-1 border-purple-200 text-[#6B3FA0] hover:bg-purple-50"
                      >
                        {resendingId === item.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Send className="w-3 h-3" />
                        )}
                        <span>Enviar comprovante</span>
                      </Button>
                    ) : (
                      <div className="inline-flex items-center gap-1">
                        {/* Copiar link */}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onCopyLink(linkUrl, item.id)}
                          className="h-6 px-2 text-[11px] gap-1 text-slate-600 hover:text-slate-900 border-slate-200"
                        >
                          {isCopied ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span>{isCopied ? 'Link copiado.' : 'Copiar link'}</span>
                        </Button>

                        {/* WhatsApp ou Sem telefone cadastrado */}
                        {hasPhone ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            asChild
                            className="h-6 px-2 text-[11px] gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                          >
                            <a
                              href={buildWhatsAppLinkUrl(item.patient_phone!, patientName, linkUrl)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <MessageCircle className="w-3 h-3" />
                              <span>WhatsApp</span>
                            </a>
                          </Button>
                        ) : (
                          <TooltipProvider delayDuration={150}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 border border-slate-200 rounded px-1.5 py-0.5 bg-slate-50 cursor-default">
                                  <MessageCircle className="w-3 h-3 text-slate-300" />
                                  <span>Sem telefone</span>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                Sem telefone cadastrado (use Copiar link)
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    )}
                  </div>

                  {/* CPF completo no computador (sempre completo no desktop) */}
                  <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                    {item.patient_cpf ? (
                      <span>CPF: {item.patient_cpf}</span>
                    ) : (
                      <span className="text-slate-400">CPF não informado</span>
                    )}
                    {item.patient_phone && (
                      <span className="text-slate-400">• Tel: {item.patient_phone}</span>
                    )}
                  </div>
                </td>

                {/* Procedimento */}
                <td className="py-3.5 px-4 text-slate-700">
                  <Badge variant="outline" className="text-[11px] font-normal border-slate-200">
                    {TYPE_LABEL_MAP[item.form_type] || item.form_type}
                  </Badge>
                </td>

                {/* Status da Ficha */}
                <td className="py-3.5 px-4">
                  {isSigned ? (
                    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-[11px] font-medium border-0 gap-1">
                      <span>✓</span> Termo assinado
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-[11px] font-medium border-0 gap-1">
                      <span>⏳</span> Aguardando paciente
                    </Badge>
                  )}
                  {isSigned && (
                    <div className="text-[11px] text-slate-400 mt-1">
                      {item.email_delivery_status === 'enviado' ? (
                        <span className="text-emerald-700">Comprovante enviado</span>
                      ) : item.email_delivery_status === 'falha' ? (
                        <span className="text-[#C0392B] font-medium">Falha no comprovante</span>
                      ) : (
                        <span className="text-slate-400">Comprovante pendente</span>
                      )}
                    </div>
                  )}
                </td>

                {/* Agendamento & Lembrete */}
                <td className="py-3.5 px-4">
                  {appt ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-700 font-medium text-[11px]">
                        <Calendar className="w-3 h-3 text-[#6B3FA0]" />
                        <span>
                          {formatDateBR(appt.procedure_date)}
                          {appt.procedure_time ? ` às ${appt.procedure_time}` : ''}
                        </span>
                      </div>
                      <ReminderStateBadge
                        appointment={appt}
                        formEmail={item.patient_email}
                        signedAt={item.signed_at}
                      />
                    </div>
                  ) : (
                    <span className="text-slate-400 text-[11px]">Sem agendamento</span>
                  )}
                </td>

                {/* Data de criação */}
                <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap text-[11px]">
                  {formatDateBR(item.created)}
                </td>

                {/* Ações */}
                <td className="py-3.5 px-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {isSigned ? (
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-[#6B3FA0] hover:text-[#583385] hover:bg-purple-50"
                      >
                        <Link to={`/painel/ficha/${item.id}`}>Ver ficha</Link>
                      </Button>
                    ) : (
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-slate-700 hover:text-slate-900"
                      >
                        <a href={linkUrl} target="_blank" rel="noreferrer">
                          Abrir link
                        </a>
                      </Button>
                    )}

                    <FichaActionsMenu
                      form={item}
                      appointment={appt}
                      copiedId={copiedId}
                      resendingId={resendingId}
                      retryingReminderId={retryingReminderId}
                      sendingAuditProofId={sendingAuditProofId}
                      onCopyLink={onCopyLink}
                      onResendEmail={onResendEmail}
                      onSendAuditProof={onSendAuditProof}
                      onRetryReminder={onRetryReminder}
                      onOpenDelete={onOpenDelete}
                    />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
