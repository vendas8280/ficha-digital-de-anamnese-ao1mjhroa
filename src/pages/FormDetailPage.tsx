import React, { useEffect, useState, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { formsService } from '@/services/forms'
import type { FormSubmissionRecord, AuditEventRecord } from '@/services/forms'
import { printFormPDF } from '@/lib/pdf'
import { formatDateBR } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft,
  Download,
  Mail,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  User,
  Phone,
  Calendar,
  MapPin,
  Briefcase,
  FileText,
  FileCheck,
  Loader2,
  Copy,
  Check,
  Send,
} from 'lucide-react'
import { downloadAuditProofPdf } from '@/services/auditProofDownload'
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
import { useToast } from '@/hooks/use-toast'

export default function FormDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [form, setForm] = useState<FormSubmissionRecord | null>(null)
  const [auditEvents, setAuditEvents] = useState<AuditEventRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [resendingEmail, setResendingEmail] = useState(false)
  const [sendingAuditProof, setSendingAuditProof] = useState(false)
  const [confirmAuditProofOpen, setConfirmAuditProofOpen] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login')
    }
  }, [authLoading, isAuthenticated, navigate])

  const loadForm = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await formsService.getById(id)
      setForm(data)
      try {
        const events = await formsService.listAuditEvents(id)
        setAuditEvents(events)
      } catch {
        /* intentionally ignored */
      }
    } catch {
      toast({
        title: 'Ficha não encontrada',
        description: 'Não foi possível carregar os dados desta ficha.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [id, toast])

  useEffect(() => {
    if (isAuthenticated && id) {
      loadForm()
    }
  }, [isAuthenticated, id, loadForm])

  const handleResendEmail = async () => {
    if (!form) return
    setResendingEmail(true)
    try {
      const res = await formsService.resendReceiptEmail(form.id)
      toast({
        title: 'E-mail reenviado com sucesso!',
        description: res.message || 'Comprovante reenviado ao paciente e à clínica.',
      })
      loadForm()
    } catch (err: unknown) {
      toast({
        title: 'Erro ao reenviar e-mail',
        description: err instanceof Error ? err.message : 'Falha na comunicação com o servidor.',
        variant: 'destructive',
      })
    } finally {
      setResendingEmail(false)
    }
  }

  const handleSendAuditProof = async () => {
    if (!form) return
    setConfirmAuditProofOpen(false)
    setSendingAuditProof(true)
    try {
      const res = await formsService.sendAuditProofEmail(form.id)
      toast({
        title: 'Comprovante completo enviado.',
        description:
          res.message ||
          'Comprovante completo com o PDF da ficha e a trilha de auditoria enviado com sucesso à paciente.',
      })
      loadForm()
    } catch (err: unknown) {
      toast({
        title: 'Erro ao enviar comprovante completo',
        description: err instanceof Error ? err.message : 'Falha ao enviar comprovante com trilha.',
        variant: 'destructive',
      })
    } finally {
      setSendingAuditProof(false)
    }
  }

  const handleCopyLink = () => {
    if (!form) return
    const url = `${window.location.origin}/f/${form.token}`
    navigator.clipboard.writeText(url)
    setCopiedLink(true)
    toast({ title: 'Link copiado para a área de transferência!' })
    setTimeout(() => setCopiedLink(false), 2500)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-rose-900 animate-spin mb-3" />
        <p className="text-xs text-slate-600 font-medium">Carregando detalhes da ficha...</p>
      </div>
    )
  }

  if (!form) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <p className="text-sm text-slate-700 mb-4">Ficha não encontrada.</p>
        <Button asChild variant="outline" size="sm">
          <Link to="/painel">Voltar ao Painel</Link>
        </Button>
      </div>
    )
  }

  const typeLabelMap: Record<string, string> = {
    geral: 'Anamnese Geral',
    labios: 'Lábios & Micropigmentação Labial',
    botox: 'Toxina Botulínica (Botox)',
  }

  return (
    <div className="min-h-screen bg-slate-50/70 pb-16">
      {/* Top Header */}
      <header className="bg-white border-b border-rose-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-xs gap-1 text-slate-600 hover:text-rose-900"
            >
              <Link to="/painel">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Voltar
              </Link>
            </Button>
            <div>
              <h1 className="text-base font-bold text-rose-950">
                Ficha: {form.patient_name || 'Sem nome'}
              </h1>
              <p className="text-xs text-rose-700 font-medium">
                {typeLabelMap[form.form_type]} &bull; {formatDateBR(form.created)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {form.status === 'preenchida' && (
              <>
                <Button
                  onClick={async () => {
                    try {
                      await downloadAuditProofPdf(form)
                      toast({
                        title: 'Comprovante baixado',
                        description: 'O PDF do comprovante de assinatura foi gerado com sucesso.',
                      })
                      const updatedEvents = await formsService.listAuditEvents(form.id)
                      setAuditEvents(updatedEvents)
                    } catch (err: any) {
                      toast({
                        title: 'Erro ao baixar comprovante',
                        description: err?.message || 'Falha ao gerar comprovante de assinatura.',
                        variant: 'destructive',
                      })
                    }
                  }}
                  variant="outline"
                  size="sm"
                  className="text-xs h-9 px-3 border-emerald-300 text-emerald-800 hover:bg-emerald-50 rounded-md font-medium shadow-sm transition-colors gap-1.5"
                >
                  <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Baixar comprovante de assinatura
                </Button>

                <Button
                  onClick={() => setConfirmAuditProofOpen(true)}
                  disabled={sendingAuditProof}
                  variant="outline"
                  size="sm"
                  className="text-xs h-9 px-3 border-purple-300 text-[#6B3FA0] hover:bg-purple-50 rounded-md font-medium shadow-sm transition-colors gap-1.5"
                >
                  {sendingAuditProof ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  Enviar comprovante completo (com trilha)
                </Button>

                <Button
                  onClick={async () => {
                    printFormPDF(form)
                    try {
                      await formsService.recordPdfExportAudit(form.id, 'impressao')
                      const updatedEvents = await formsService.listAuditEvents(form.id)
                      setAuditEvents(updatedEvents)
                    } catch {
                      /* não bloqueia a interface */
                    }
                  }}
                  size="sm"
                  className="text-xs h-9 px-3.5 bg-rose-900 hover:bg-rose-950 text-white rounded-md font-medium shadow-sm transition-colors gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Visualizar / Imprimir PDF Oficial
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-6 space-y-6">
        {/* Status and Action Banners */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className="border-slate-200">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">
                  Situação
                </p>
                <div className="mt-1">
                  {form.status === 'preenchida' && (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Termo Assinado & Preenchida
                    </Badge>
                  )}
                  {form.status === 'codigo_validado' && (
                    <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Código Validado
                    </Badge>
                  )}
                  {form.status === 'pendente' && (
                    <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">
                      <Clock className="w-3 h-3 mr-1" /> Pendente de Preenchimento
                    </Badge>
                  )}
                  {form.status === 'expirada' && (
                    <Badge className="bg-slate-100 text-slate-700 text-xs">Expirada</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">
                  PDF Anexado ao E-mail
                </p>
                <div className="mt-1">
                  {form.status === 'preenchida' ? (
                    form.pdf_attached_to_email ? (
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs font-semibold">
                        PDF anexado: Sim
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs font-semibold">
                        PDF anexado: Não
                      </Badge>
                    )
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">
                  Envio de Comprovante
                </p>
                <div className="mt-1 text-xs font-medium">
                  {form.email_delivery_status === 'enviado' ? (
                    <span className="text-emerald-700 flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" /> Enviado por e-mail
                    </span>
                  ) : form.email_delivery_status === 'falha' ? (
                    <span className="text-red-700 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Falha no envio
                    </span>
                  ) : (
                    <span className="text-slate-400">Pendente de preenchimento</span>
                  )}
                </div>
              </div>

              {form.status === 'preenchida' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleResendEmail}
                  disabled={resendingEmail}
                  className="text-xs h-8 border-slate-300 hover:bg-rose-50 hover:text-rose-900"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 mr-1 ${resendingEmail ? 'animate-spin' : ''}`}
                  />
                  Reenviar
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">
                  Link de Preenchimento
                </p>
                <p className="text-xs text-slate-600 mt-1 truncate max-w-[160px] font-mono">
                  /f/{form.token.slice(0, 10)}...
                </p>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyLink}
                className="text-xs h-8 border-slate-300"
              >
                {copiedLink ? (
                  <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5 mr-1" />
                )}
                Copiar
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* 1. Patient Identification */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <User className="w-4 h-4 text-rose-800" />
              1. Identificação do Paciente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">Nome Completo:</span>
                <span className="font-semibold text-slate-900 text-sm">
                  {form.patient_name || '—'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">CPF:</span>
                <span className="font-semibold text-slate-900">{form.patient_cpf || '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">RG:</span>
                <span className="text-slate-800">{form.patient_rg || '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Data de Nascimento:</span>
                <span className="text-slate-800">{form.patient_birth_date || '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">
                  WhatsApp / Telefone:
                </span>
                <span className="text-slate-800 font-medium">{form.patient_phone || '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">E-mail para Recibo:</span>
                <span className="text-slate-800 font-medium">{form.patient_email || '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Profissão:</span>
                <span className="text-slate-800">{form.patient_profession || '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">
                  Contato de Emergência:
                </span>
                <span className="text-slate-800">{form.patient_emergency_contact || '—'}</span>
              </div>
              <div className="sm:col-span-3">
                <span className="text-muted-foreground block text-[11px]">
                  Endereço Residencial:
                </span>
                <span className="text-slate-800">{form.patient_address || '—'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. Questionnaire Answers */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-rose-800" />
              2. Respostas do Questionário de Saúde & Anamnese
            </CardTitle>
          </CardHeader>
          <CardContent>
            {form.answers && Object.keys(form.answers).length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {Object.entries(form.answers).map(([key, val]) => {
                  const formattedKey = key
                    .replace(/_/g, ' ')
                    .replace(/\b\w/g, (l) => l.toUpperCase())
                  let displayVal = String(val)
                  if (typeof val === 'boolean') displayVal = val ? 'Sim' : 'Não'

                  return (
                    <div
                      key={key}
                      className="p-3 bg-slate-50 border rounded-lg border-slate-200 flex flex-col justify-between"
                    >
                      <span className="text-[11px] font-semibold text-slate-600">
                        {formattedKey}
                      </span>
                      <span className="text-slate-900 font-medium mt-1">
                        {displayVal || 'Não informado'}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-2">
                Nenhuma resposta registrada ainda (ficha pendente).
              </p>
            )}
          </CardContent>
        </Card>

        {/* 3. Audit Trail / Trilha de Auditoria Completa */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-rose-800" />
              3. Trilha de Auditoria Completa da Ficha
            </CardTitle>
            <CardDescription className="text-xs">
              Histórico cronológico detalhado com data/hora, endereço IP e dispositivo registrado a
              cada evento.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {auditEvents.length > 0 ? (
              <div className="space-y-3">
                <div className="border-l-2 border-rose-300 ml-3 pl-4 space-y-4">
                  {auditEvents.map((ev, idx) => (
                    <div key={ev.id || idx} className="relative text-xs">
                      <div className="absolute -left-[23px] top-0.5 w-3.5 h-3.5 rounded-full bg-rose-700 border-2 border-white shadow-sm" />
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span className="font-semibold text-slate-900 capitalize">
                          {ev.event_type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {formatDateBR(ev.timestamp || ev.created)}
                        </span>
                      </div>
                      <p className="text-slate-700 mt-0.5">{ev.description}</p>
                      <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-3 gap-y-0.5 mt-1 font-mono">
                        <span>IP: {ev.ip_address || 'Não disponível'}</span>
                        {ev.user_agent && (
                          <span className="truncate max-w-xs">Navegador: {ev.user_agent}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-2">
                Nenhum evento registrado ainda na trilha de auditoria para esta ficha.
              </p>
            )}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span className="italic">Registro de auditoria. Não pode ser alterado.</span>
              <span className="text-[10px] text-slate-400 font-mono">
                Imutabilidade com encadeamento SHA-256
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Modal de confirmação para envio de comprovante completo (com trilha) */}
        <AlertDialog open={confirmAuditProofOpen} onOpenChange={setConfirmAuditProofOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-slate-900">
                Enviar comprovante completo (com trilha)
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-slate-600 space-y-2">
                <span>
                  Enviar à paciente <strong>{form.patient_name || 'paciente'}</strong> o comprovante
                  completo com a trilha de auditoria anexada?
                </span>
                <span className="block text-slate-500 text-[11px]">
                  A paciente receberá no e-mail{' '}
                  <strong className="text-slate-700 font-mono">
                    {form.patient_email || 'cadastrado'}
                  </strong>{' '}
                  o PDF oficial da ficha e o arquivo de auditoria cronológica detalhado com
                  encadeamento criptográfico SHA-256.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="text-xs">Voltar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleSendAuditProof}
                className="bg-[#6B3FA0] hover:bg-[#583385] text-white text-xs"
              >
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* 4. Term of Consent & Digital Signature */}
        {form.status === 'preenchida' && (
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                3. Termo Aceito e Assinatura Digital do Paciente
              </CardTitle>
              <CardDescription className="text-xs">
                {form.accepted_term_title || 'Termo de Consentimento'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Term text preview */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 max-h-40 overflow-y-auto whitespace-pre-wrap font-sans">
                {form.accepted_term_text}
              </div>

              {/* Signature and Audit footer */}
              <div className="bg-slate-100/80 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs">
                <div className="space-y-1.5 w-full sm:w-auto">
                  <div className="font-bold text-slate-900">CERTIFICADO DE AUDITORIA DIGITAL</div>
                  <div>
                    <span className="text-muted-foreground">Assinado em:</span>{' '}
                    <strong>{formatDateBR(form.signed_at || form.created)}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Endereço IP:</span>{' '}
                    <code>{form.ip_address || 'Registrado'}</code>
                  </div>
                  <div className="max-w-md break-all">
                    <span className="text-muted-foreground">Hash SHA-256 de Integridade:</span>{' '}
                    <code className="text-[11px] bg-white px-1.5 py-0.5 rounded border border-slate-300 font-mono">
                      {form.document_hash || 'SHA256-REGISTRADO'}
                    </code>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Dispositivo: {form.user_agent || 'Navegador Web'}
                  </div>
                </div>

                <div className="text-center bg-white p-3 rounded-lg border border-slate-300 shadow-sm min-w-[220px]">
                  {form.signature_data ? (
                    <img
                      src={form.signature_data}
                      alt="Assinatura"
                      className="max-h-20 max-w-[200px] mx-auto border-b border-slate-400 pb-1"
                    />
                  ) : (
                    <div className="h-16 flex items-center justify-center text-xs text-slate-400">
                      Assinado Eletronicamente
                    </div>
                  )}
                  <p className="text-[11px] font-semibold text-slate-800 mt-1">
                    Assinatura Digital com Dedo
                  </p>
                  <p className="text-[10px] text-slate-500">{form.patient_name}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
