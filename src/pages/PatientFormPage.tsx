import React, { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { formsService, computeHash } from '@/services/forms'
import type { FormSubmissionRecord } from '@/services/forms'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { TERMS_DATA } from '@/types/form'
import { formatCPF, validateCPF, formatPhone } from '@/lib/formatters'
import { SignatureCanvas } from '@/components/SignatureCanvas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ShieldCheck,
  Lock,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  HeartPulse,
  Sparkles,
  Clock,
  Send,
  Loader2,
  MailCheck,
  KeyRound,
  RefreshCw,
} from 'lucide-react'

export default function PatientFormPage() {
  const { token } = useParams<{ token: string }>()
  const [formRecord, setFormRecord] = useState<FormSubmissionRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submissionComplete, setSubmissionComplete] = useState(false)
  const [submissionError, setSubmissionError] = useState<string | null>(null)

  // Current step:
  // 0: Boas-vindas e Aviso de Privacidade LGPD
  // 1: Dados Pessoais & Documentos
  // 2: Validação de Código de E-mail (Novo)
  // 3: Histórico de Saúde Geral & Alergias
  // 4: Perguntas Específicas do Procedimento
  // 5: Termo de Consentimento (com rolagem obrigatória e aceite)
  // 6: Assinatura Digital e Envio
  const [step, setStep] = useState(0)

  // Step 1: Dados pessoais
  const [patientName, setPatientName] = useState('')
  const [patientCpf, setPatientCpf] = useState('')
  const [patientEmail, setPatientEmail] = useState('')
  const [patientEmailConfirm, setPatientEmailConfirm] = useState('')
  const [patientPhone, setPatientPhone] = useState('')
  const [patientBirthDate, setPatientBirthDate] = useState('')
  const [patientRg, setPatientRg] = useState('')
  const [patientAddress, setPatientAddress] = useState('')
  const [patientProfession, setPatientProfession] = useState('')
  const [patientEmergencyContact, setPatientEmergencyContact] = useState('')

  // Step 2: Validação de E-mail
  const [emailCode, setEmailCode] = useState('')
  const [sendingCode, setSendingCode] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [verifyingCode, setVerifyingCode] = useState(false)
  const [codeVerified, setCodeVerified] = useState(false)
  const [codeError, setCodeError] = useState<string | null>(null)

  // Step 3: Saúde Geral
  const [temAlergias, setTemAlergias] = useState<'sim' | 'nao'>('nao')
  const [detalhesAlergias, setDetalhesAlergias] = useState('')
  const [usaMedicamentos, setUsaMedicamentos] = useState<'sim' | 'nao'>('nao')
  const [detalhesMedicamentos, setDetalhesMedicamentos] = useState('')
  const [gestanteLactante, setGestanteLactante] = useState<'sim' | 'nao'>('nao')
  const [fumante, setFumante] = useState<'sim' | 'nao'>('nao')
  const [historicoCicatrizacao, setHistoricoCicatrizacao] = useState<'normal' | 'queloide'>(
    'normal',
  )
  const [doencasCronicas, setDoencasCronicas] = useState('')

  // Step 4: Procedimento específico
  const [respostasEspecificas, setRespostasEspecificas] = useState<Record<string, string>>({})

  // Step 5: Termo e rolagem
  const termScrollRef = useRef<HTMLDivElement | null>(null)
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false)
  const [termoAceito, setTermoAceito] = useState(false)

  // Step 6: Assinatura
  const [signatureData, setSignatureData] = useState<string | null>(null)

  // Load form record
  useEffect(() => {
    async function load() {
      if (!token) {
        setError('Token de formulário não informado.')
        setLoading(false)
        return
      }

      const record = await formsService.getByToken(token)
      if (!record) {
        setError('Ficha não encontrada. Verifique se o link foi digitado corretamente.')
        setLoading(false)
        return
      }

      // Check status
      if (record.status === 'preenchida') {
        setError('Esta ficha já foi preenchida e assinada anteriormente.')
        setFormRecord(record)
        setLoading(false)
        return
      }

      // Check expiry
      if (record.expires_at && new Date(record.expires_at) < new Date()) {
        setError(
          'Este link de preenchimento expirou (validade de 7 dias ultrapassada). Solicite um novo link à clínica.',
        )
        setFormRecord(record)
        setLoading(false)
        return
      }

      setFormRecord(record)
      if (record.patient_name) setPatientName(record.patient_name)
      if (record.patient_phone) setPatientPhone(record.patient_phone)
      if (record.patient_email) {
        setPatientEmail(record.patient_email)
        setPatientEmailConfirm(record.patient_email)
      }
      if (record.status === 'codigo_validado' || record.email_code_verified_at) {
        setCodeVerified(true)
      }

      // Record audit event: link opened
      formsService.recordAuditEvent({
        token,
        event_type: 'link_aberto',
        description: 'Paciente abriu o link seguro da ficha de anamnese',
        step_number: 0,
      })

      setLoading(false)
    }

    load()
  }, [token])

  // Track term scroll
  const handleTermScroll = () => {
    const el = termScrollRef.current
    if (!el) return
    const tolerance = 25
    if (el.scrollHeight - el.scrollTop - el.clientHeight <= tolerance) {
      setHasScrolledToEnd(true)
    }
  }

  // Get active term info
  const activeTerm = formRecord ? TERMS_DATA[formRecord.form_type] : null

  // Step 1 Validation
  const isStep1Valid = () => {
    if (!patientName.trim()) return false
    if (!validateCPF(patientCpf)) return false
    if (!patientEmail.trim() || !patientEmail.includes('@')) return false
    if (patientEmail.toLowerCase().trim() !== patientEmailConfirm.toLowerCase().trim()) return false
    if (!patientPhone.trim() || patientPhone.length < 14) return false
    if (!patientBirthDate) return false
    return true
  }

  // Transition to step and record audit
  const changeStep = (nextStep: number, stepName: string) => {
    setStep(nextStep)
    if (token) {
      formsService.recordAuditEvent({
        token,
        event_type: 'avanco_etapa',
        description: `Paciente avançou para a etapa ${nextStep}: ${stepName}`,
        step_number: nextStep,
      })
    }
  }

  // Send verification code
  const handleSendCode = async () => {
    if (!token || !patientEmail) return
    setSendingCode(true)
    setCodeError(null)
    try {
      await formsService.sendVerificationCode(token, patientEmail, patientName)
      setCodeSent(true)
    } catch (err: unknown) {
      const msg = getErrorMessage(err)
      setCodeError(
        msg && msg !== 'Something went wrong.' && msg !== 'An unexpected error occurred.'
          ? msg
          : 'Não foi possível enviar o código para o seu e-mail. Por favor, tente novamente.',
      )
    } finally {
      setSendingCode(false)
    }
  }

  // Verify code
  const handleVerifyCode = async () => {
    if (!token || !patientEmail || !emailCode.trim()) return
    setVerifyingCode(true)
    setCodeError(null)
    try {
      await formsService.verifyEmailCode(token, patientEmail, emailCode.trim())
      setCodeVerified(true)
      // Advance to step 3 after slight delay
      setTimeout(() => {
        changeStep(3, 'Histórico de Saúde')
      }, 700)
    } catch (err: unknown) {
      const msg = getErrorMessage(err)
      setCodeError(
        msg && msg !== 'Something went wrong.' && msg !== 'An unexpected error occurred.'
          ? msg
          : 'Código de verificação incorreto ou expirado. Verifique os 6 dígitos ou solicite um novo código.',
      )
    } finally {
      setVerifyingCode(false)
    }
  }

  // Handle Term acceptance toggle
  const handleAcceptTerm = (checked: boolean) => {
    setTermoAceito(checked)
    if (checked && token) {
      formsService.recordAuditEvent({
        token,
        event_type: 'aceite_termo',
        description: `Paciente marcou o aceite no termo de consentimento: ${activeTerm?.title}`,
        step_number: 5,
      })
    }
  }

  // Handle Form Submission
  const handleSubmit = async () => {
    if (!formRecord || !token || !signatureData || !termoAceito || !activeTerm) return

    setSubmitting(true)
    setSubmissionError(null)

    try {
      const signedAt = new Date().toISOString()
      const userAgent = navigator.userAgent

      // Real IP address captured from backend
      const ipAddress = await formsService.getRealClientIp()

      // Compile answers
      const answersCompiled: Record<string, unknown> = {
        alergias: temAlergias === 'sim' ? detalhesAlergias || 'Sim' : 'Não possui',
        medicamentos_em_uso: usaMedicamentos === 'sim' ? detalhesMedicamentos || 'Sim' : 'Nenhum',
        gestante_ou_lactante: gestanteLactante === 'sim' ? 'Sim' : 'Não',
        fumante: fumante === 'sim' ? 'Sim' : 'Não',
        cicatrizacao:
          historicoCicatrizacao === 'queloide' ? 'Tendência a queloide / hipertrófica' : 'Normal',
        doencas_cronicas: doencasCronicas || 'Nenhuma informada',
        ...respostasEspecificas,
      }

      // Compute document integrity hash
      const hashContent = `${patientName}|${patientCpf}|${patientEmail}|${activeTerm.title}|${signedAt}|${token}`
      const docHash = await computeHash(hashContent)

      // Submit form
      await formsService.submitForm(formRecord.id, token, {
        patient_name: patientName,
        patient_cpf: patientCpf,
        patient_email: patientEmail.toLowerCase().trim(),
        patient_phone: patientPhone,
        patient_birth_date: patientBirthDate,
        patient_rg: patientRg,
        patient_address: patientAddress,
        patient_profession: patientProfession,
        patient_emergency_contact: patientEmergencyContact,
        answers: answersCompiled,
        signature_data: signatureData,
        accepted_term_text: activeTerm.content,
        accepted_term_title: activeTerm.title,
        signed_at: signedAt,
        ip_address: ipAddress,
        user_agent: userAgent,
        document_hash: docHash,
      })

      // Register audit event: signed
      await formsService.recordAuditEvent({
        token,
        event_type: 'termo_assinado',
        description: `Paciente concluiu a assinatura eletrônica da ficha de anamnese (Hash: ${docHash})`,
        step_number: 6,
        metadata: {
          ip: ipAddress,
          hash: docHash,
        },
      })

      setSubmissionComplete(true)
    } catch (err: unknown) {
      const msg = getErrorMessage(err)
      setSubmissionError(
        msg.includes('Must be no more than')
          ? 'O tamanho dos dados da assinatura ou respostas excedeu o limite. Por favor, tente novamente.'
          : msg === 'Failed to update record.'
            ? 'Não foi possível salvar o preenchimento da ficha. Por favor, tente novamente.'
            : msg || 'Falha ao processar envio da ficha.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-rose-50/50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-rose-600 animate-spin mb-4" />
        <p className="text-rose-900 font-medium text-sm">Carregando formulário seguro...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white flex flex-col items-center justify-center p-4">
        <Card className="max-w-md w-full border-rose-200 shadow-xl">
          <CardHeader className="text-center pb-2">
            <div className="w-14 h-14 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-2 text-rose-600">
              <AlertCircle className="w-8 h-8" />
            </div>
            <CardTitle className="text-xl text-rose-950">Aviso da Ficha</CardTitle>
            <CardDescription className="text-sm mt-1">{error}</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 flex flex-col gap-3">
            <p className="text-xs text-muted-foreground text-center">
              Para suporte, entre em contato diretamente com a equipe da{' '}
              <strong>Andresa Souza Clinic</strong> pelo WhatsApp.
            </p>
            <Button asChild variant="outline" className="w-full mt-2 border-rose-300 text-rose-800">
              <Link to="/">Voltar ao Início</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Confirmation screen
  if (submissionComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white flex flex-col items-center justify-center p-4">
        <Card className="max-w-lg w-full border-emerald-200 shadow-xl overflow-hidden">
          <div className="bg-emerald-600 p-6 text-white text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold">Ficha Enviada com Sucesso!</h2>
            <p className="text-emerald-100 text-sm mt-1">
              Andresa Souza Clinic agradece sua confiança.
            </p>
          </div>
          <CardContent className="p-6 space-y-4">
            <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200 text-xs text-emerald-900 space-y-2">
              <p className="font-semibold text-sm text-emerald-950 flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-emerald-600" />
                Comprovante Registrado
              </p>
              <p>
                Sua ficha de anamnese e o termo de consentimento foram assinados eletronicamente e
                arquivados com validade jurídica.
              </p>
              <p>
                Enviamos uma cópia completa de confirmação com o PDF em anexo para o seu e-mail:{' '}
                <strong>{patientEmail}</strong>.
              </p>
              <p className="text-emerald-800 font-medium italic">
                Esta é a sua via do documento assinado. Guarde para seus registros.
              </p>
            </div>

            <div className="border rounded-lg p-4 bg-slate-50 text-xs text-slate-700 space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paciente:</span>
                <span className="font-medium">{patientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">CPF:</span>
                <span className="font-medium">{patientCpf}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Procedimento:</span>
                <span className="font-medium">{activeTerm?.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data/Hora:</span>
                <span className="font-medium">{new Date().toLocaleDateString('pt-BR')}</span>
              </div>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              Você já pode fechar esta página. Estamos prontos para recebê-lo(a) na clínica!
            </p>

            <Button asChild className="w-full bg-rose-800 hover:bg-rose-900 text-white">
              <Link to="/">Concluir</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Progress percentage (0 to 6)
  const progressPercent = Math.round((step / 6) * 100)

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50/70 via-white to-rose-50/40 pb-12">
      {/* Top Header */}
      <header className="bg-white border-b border-rose-100 sticky top-0 z-30 shadow-sm">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-rose-950 tracking-tight">
              Andresa Souza Clinic
            </h1>
            <p className="text-[11px] text-rose-700 font-medium">
              Ficha Digital &bull; {activeTerm?.subtitle.split('•')[1] || 'Anamnese Segura'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full text-xs border border-emerald-200 font-medium">
            <Lock className="w-3 h-3" />
            <span>Ambiente Seguro</span>
          </div>
        </div>

        {/* Step indicator bar */}
        {step > 0 && (
          <div className="px-4 pb-2 max-w-xl mx-auto">
            <div className="flex justify-between text-[11px] font-medium text-rose-900 mb-1">
              <span>Etapa {step} de 6</span>
              <span>{progressPercent}% concluído</span>
            </div>
            <Progress value={progressPercent} className="h-1.5 bg-rose-100" />
          </div>
        )}
      </header>

      <main className="max-w-xl mx-auto px-4 pt-6">
        {/* ETAPA 0: Boas-vindas e Aviso LGPD */}
        {step === 0 && (
          <Card className="border-rose-200 shadow-md">
            <CardHeader className="text-center pb-3">
              <div className="w-14 h-14 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-2 text-rose-700">
                <Sparkles className="w-7 h-7" />
              </div>
              <CardTitle className="text-xl text-rose-950 font-bold">
                Boas-vindas à sua Ficha de Anamnese
              </CardTitle>
              <CardDescription className="text-xs text-slate-600 mt-1">
                {activeTerm?.title}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-4 text-xs text-rose-950 space-y-2.5">
                <p className="font-semibold text-rose-900 flex items-center gap-1.5 text-sm">
                  <HeartPulse className="w-4 h-4 text-rose-600" />
                  Sua saúde e segurança em primeiro lugar
                </p>
                <p>
                  Para garantir o melhor resultado estético e total segurança clínica no seu
                  atendimento, solicitamos o preenchimento cuidadoso destas perguntas.
                </p>
                <p>
                  Leva apenas cerca de <strong>3 minutos</strong>. Ao final, você lerá e assinará o
                  termo de consentimento diretamente na tela do seu celular.
                </p>
              </div>

              {/* LGPD Notice */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-700 space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Aviso de Privacidade & LGPD (Lei nº 13.709/2018)
                </div>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  Os dados fornecidos são classificados como dados pessoais e dados de saúde
                  sensíveis, tratados estritamente para tutela da saúde, prontuário clínico e
                  cumprimento de obrigações regulatórias sanitárias. Nenhuma informação é
                  compartilhada com terceiros para fins publicitários.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-rose-800 bg-rose-50/50 p-2.5 rounded-lg border border-rose-100">
                <Clock className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Link válido por 7 dias. Não é necessário criar senha ou cadastro.</span>
              </div>

              <Button
                onClick={() => changeStep(1, 'Dados Cadastrais')}
                className="w-full bg-rose-800 hover:bg-rose-900 text-white font-medium py-2.5 text-sm gap-2"
              >
                Começar Preenchimento <ArrowRight className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ETAPA 1: Dados Pessoais & Documentos */}
        {step === 1 && (
          <Card className="border-rose-200 shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-rose-800 text-xs font-semibold uppercase tracking-wider">
                <span>Etapa 1 de 6</span> &bull; <span>Identificação</span>
              </div>
              <CardTitle className="text-lg text-rose-950 font-bold">
                Seus Dados Cadastrais
              </CardTitle>
              <CardDescription className="text-xs">
                Preencha seus dados para registro do prontuário oficial.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="nome" className="text-xs font-medium text-slate-800">
                  Nome Completo *
                </Label>
                <Input
                  id="nome"
                  placeholder="Seu nome completo"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className="text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cpf" className="text-xs font-medium text-slate-800">
                    CPF *
                  </Label>
                  <Input
                    id="cpf"
                    placeholder="000.000.000-00"
                    value={patientCpf}
                    onChange={(e) => setPatientCpf(formatCPF(e.target.value))}
                    className="text-sm"
                  />
                  {patientCpf && !validateCPF(patientCpf) && (
                    <p className="text-[11px] text-red-600 font-medium">CPF inválido</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="rg" className="text-xs font-medium text-slate-800">
                    RG (opcional)
                  </Label>
                  <Input
                    id="rg"
                    placeholder="Número do RG"
                    value={patientRg}
                    onChange={(e) => setPatientRg(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="nascimento" className="text-xs font-medium text-slate-800">
                    Data de Nascimento *
                  </Label>
                  <Input
                    id="nascimento"
                    type="date"
                    value={patientBirthDate}
                    onChange={(e) => setPatientBirthDate(e.target.value)}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="telefone" className="text-xs font-medium text-slate-800">
                    WhatsApp / Celular *
                  </Label>
                  <Input
                    id="telefone"
                    placeholder="(11) 90000-0000"
                    value={patientPhone}
                    onChange={(e) => setPatientPhone(formatPhone(e.target.value))}
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium text-slate-800">
                  E-mail para Receber o Comprovante Oficial *
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seuemail@exemplo.com"
                  value={patientEmail}
                  onChange={(e) => setPatientEmail(e.target.value)}
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="emailConfirm" className="text-xs font-medium text-slate-800">
                  Confirme seu E-mail *
                </Label>
                <Input
                  id="emailConfirm"
                  type="email"
                  placeholder="Repita o seu e-mail"
                  value={patientEmailConfirm}
                  onChange={(e) => setPatientEmailConfirm(e.target.value)}
                  className="text-sm"
                />
                {patientEmailConfirm &&
                  patientEmail.toLowerCase().trim() !==
                    patientEmailConfirm.toLowerCase().trim() && (
                    <p className="text-[11px] text-red-600 font-medium">
                      Os e-mails não conferem. Verifique a digitação.
                    </p>
                  )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="profissao" className="text-xs font-medium text-slate-800">
                  Profissão / Ocupação
                </Label>
                <Input
                  id="profissao"
                  placeholder="Ex: Advogada, Empresária, etc."
                  value={patientProfession}
                  onChange={(e) => setPatientProfession(e.target.value)}
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="endereco" className="text-xs font-medium text-slate-800">
                  Endereço Residencial (Cidade / Estado)
                </Label>
                <Input
                  id="endereco"
                  placeholder="Ex: Rua, Bairro, Cidade - SP"
                  value={patientAddress}
                  onChange={(e) => setPatientAddress(e.target.value)}
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="emergencia" className="text-xs font-medium text-slate-800">
                  Contato de Emergência (Nome e Telefone)
                </Label>
                <Input
                  id="emergencia"
                  placeholder="Ex: Mãe / Cônjuge - (11) 98888-7777"
                  value={patientEmergencyContact}
                  onChange={(e) => setPatientEmergencyContact(e.target.value)}
                  className="text-sm"
                />
              </div>

              <div className="pt-2 flex justify-between gap-3">
                <Button
                  variant="outline"
                  onClick={() => changeStep(0, 'Boas-vindas')}
                  className="text-xs border-slate-300"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Voltar
                </Button>
                <Button
                  onClick={() => changeStep(2, 'Validação de E-mail')}
                  disabled={!isStep1Valid()}
                  className="bg-rose-800 hover:bg-rose-900 text-white text-xs gap-1.5"
                >
                  Continuar para Validação <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ETAPA 2: Validação de Código de E-mail (Novo) */}
        {step === 2 && (
          <Card className="border-rose-200 shadow-md">
            <CardHeader className="pb-3 text-center">
              <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-2 text-rose-800">
                <KeyRound className="w-6 h-6" />
              </div>
              <div className="flex items-center justify-center gap-2 text-rose-800 text-xs font-semibold uppercase tracking-wider">
                <span>Etapa 2 de 6</span> &bull; <span>Validação de E-mail</span>
              </div>
              <CardTitle className="text-lg text-rose-950 font-bold mt-1">
                Confirmação do seu E-mail
              </CardTitle>
              <CardDescription className="text-xs max-w-sm mx-auto">
                Para sua segurança jurídica e garantia de que você receberá a sua via em PDF do
                documento assinado, validamos seu e-mail: <strong>{patientEmail}</strong>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!codeVerified ? (
                <>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-700 space-y-3 text-center">
                    <p>Clique no botão abaixo para receber um código de 6 dígitos no seu e-mail:</p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSendCode}
                      disabled={sendingCode}
                      className="border-rose-300 text-rose-900 hover:bg-rose-50 text-xs gap-1.5"
                    >
                      {sendingCode ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando código...
                        </>
                      ) : codeSent ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" /> Reenviar Novo Código
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" /> Enviar Código para {patientEmail}
                        </>
                      )}
                    </Button>
                    {codeSent && (
                      <p className="text-[11px] text-emerald-700 font-medium">
                        ✓ Código enviado! Verifique sua caixa de entrada e spam.
                      </p>
                    )}
                    {codeError && !codeSent && (
                      <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 text-left space-y-1">
                        <p className="font-semibold flex items-center gap-1.5 text-red-900">
                          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                          Não foi possível enviar o código
                        </p>
                        <p className="text-[11px] leading-relaxed">{codeError}</p>
                      </div>
                    )}
                  </div>

                  {codeSent && (
                    <div className="space-y-2 pt-2">
                      <Label
                        htmlFor="inputCode"
                        className="text-xs font-semibold text-center block"
                      >
                        Digite o código de 6 dígitos recebido:
                      </Label>
                      <Input
                        id="inputCode"
                        maxLength={6}
                        placeholder="123456"
                        value={emailCode}
                        onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, ''))}
                        className="text-center font-mono text-xl tracking-widest max-w-[200px] mx-auto h-12"
                      />

                      {codeError && (
                        <p className="text-xs text-red-600 text-center font-medium">{codeError}</p>
                      )}

                      <Button
                        type="button"
                        onClick={handleVerifyCode}
                        disabled={emailCode.length < 6 || verifyingCode}
                        className="w-full bg-rose-900 hover:bg-rose-950 text-white text-xs gap-1.5 mt-2"
                      >
                        {verifyingCode ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Validando...
                          </>
                        ) : (
                          <>
                            <MailCheck className="w-3.5 h-3.5" /> Validar Código de E-mail
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <p className="font-bold text-emerald-950 text-sm">E-mail Validado com Sucesso!</p>
                  <p className="text-xs text-emerald-800">
                    O código foi confirmado e o status &quot;código validado&quot; foi registrado na
                    trilha de auditoria.
                  </p>
                </div>
              )}

              <div className="pt-2 flex justify-between gap-3">
                <Button
                  variant="outline"
                  onClick={() => changeStep(1, 'Dados Cadastrais')}
                  className="text-xs border-slate-300"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Voltar
                </Button>
                <Button
                  onClick={() => changeStep(3, 'Histórico de Saúde')}
                  disabled={!codeVerified}
                  className="bg-rose-800 hover:bg-rose-900 text-white text-xs gap-1.5"
                >
                  Continuar para Saúde <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ETAPA 3: Histórico de Saúde Geral */}
        {step === 3 && (
          <Card className="border-rose-200 shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-rose-800 text-xs font-semibold uppercase tracking-wider">
                <span>Etapa 3 de 6</span> &bull; <span>Saúde Geral</span>
              </div>
              <CardTitle className="text-lg text-rose-950 font-bold">
                Histórico Clínico e Alergias
              </CardTitle>
              <CardDescription className="text-xs">
                Informações essenciais para segurança contra reações adversas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Alergias */}
              <div className="p-3 bg-slate-50 border rounded-lg space-y-2">
                <Label className="text-xs font-semibold text-slate-900">
                  Possui alguma alergia conhecida (medicamentos, anestésicos, cosméticos)? *
                </Label>
                <RadioGroup
                  value={temAlergias}
                  onValueChange={(val) => setTemAlergias(val as 'sim' | 'nao')}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="nao" id="alergia-nao" />
                    <Label htmlFor="alergia-nao" className="text-xs">
                      Não
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sim" id="alergia-sim" />
                    <Label htmlFor="alergia-sim" className="text-xs">
                      Sim
                    </Label>
                  </div>
                </RadioGroup>
                {temAlergias === 'sim' && (
                  <Input
                    placeholder="Quais alergias você possui?"
                    value={detalhesAlergias}
                    onChange={(e) => setDetalhesAlergias(e.target.value)}
                    className="text-xs mt-2"
                  />
                )}
              </div>

              {/* Medicamentos */}
              <div className="p-3 bg-slate-50 border rounded-lg space-y-2">
                <Label className="text-xs font-semibold text-slate-900">
                  Faz uso de medicamentos contínuos (ex: anticoagulantes, anti-inflamatórios,
                  Roacutan)? *
                </Label>
                <RadioGroup
                  value={usaMedicamentos}
                  onValueChange={(val) => setUsaMedicamentos(val as 'sim' | 'nao')}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="nao" id="med-nao" />
                    <Label htmlFor="med-nao" className="text-xs">
                      Não
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sim" id="med-sim" />
                    <Label htmlFor="med-sim" className="text-xs">
                      Sim
                    </Label>
                  </div>
                </RadioGroup>
                {usaMedicamentos === 'sim' && (
                  <Input
                    placeholder="Quais medicamentos?"
                    value={detalhesMedicamentos}
                    onChange={(e) => setDetalhesMedicamentos(e.target.value)}
                    className="text-xs mt-2"
                  />
                )}
              </div>

              {/* Gestante/Lactante */}
              <div className="p-3 bg-slate-50 border rounded-lg space-y-2">
                <Label className="text-xs font-semibold text-slate-900">
                  Está gestante ou em período de amamentação (lactante)? *
                </Label>
                <RadioGroup
                  value={gestanteLactante}
                  onValueChange={(val) => setGestanteLactante(val as 'sim' | 'nao')}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="nao" id="gest-nao" />
                    <Label htmlFor="gest-nao" className="text-xs">
                      Não
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sim" id="gest-sim" />
                    <Label htmlFor="gest-sim" className="text-xs">
                      Sim
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Cicatrizacao */}
              <div className="p-3 bg-slate-50 border rounded-lg space-y-2">
                <Label className="text-xs font-semibold text-slate-900">
                  Histórico de cicatrização da sua pele: *
                </Label>
                <RadioGroup
                  value={historicoCicatrizacao}
                  onValueChange={(val) => setHistoricoCicatrizacao(val as 'normal' | 'queloide')}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="normal" id="cic-normal" />
                    <Label htmlFor="cic-normal" className="text-xs">
                      Normal / Boa
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="queloide" id="cic-queloide" />
                    <Label htmlFor="cic-queloide" className="text-xs">
                      Tendência a queloide / manchas
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Fumante */}
              <div className="p-3 bg-slate-50 border rounded-lg space-y-2">
                <Label className="text-xs font-semibold text-slate-900">
                  É fumante ou faz uso de cigarro eletrônico (vape)? *
                </Label>
                <RadioGroup
                  value={fumante}
                  onValueChange={(val) => setFumante(val as 'sim' | 'nao')}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="nao" id="fum-nao" />
                    <Label htmlFor="fum-nao" className="text-xs">
                      Não
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sim" id="fum-sim" />
                    <Label htmlFor="fum-sim" className="text-xs">
                      Sim
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Doenças crônicas */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-800">
                  Possui alguma doença crônica (Diabetes, Hipertensão, Doença Autoimune, Tireoide)?
                </Label>
                <Input
                  placeholder="Se sim, especifique ou digite 'Nenhuma'"
                  value={doencasCronicas}
                  onChange={(e) => setDoencasCronicas(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="pt-2 flex justify-between gap-3">
                <Button
                  variant="outline"
                  onClick={() => changeStep(2, 'Validação de E-mail')}
                  className="text-xs border-slate-300"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Voltar
                </Button>
                <Button
                  onClick={() => changeStep(4, 'Perguntas do Procedimento')}
                  className="bg-rose-800 hover:bg-rose-900 text-white text-xs gap-1.5"
                >
                  Próxima Etapa <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ETAPA 4: Perguntas Específicas do Procedimento */}
        {step === 4 && (
          <Card className="border-rose-200 shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-rose-800 text-xs font-semibold uppercase tracking-wider">
                <span>Etapa 4 de 6</span> &bull; <span>Detalhes Específicos</span>
              </div>
              <CardTitle className="text-lg text-rose-950 font-bold">
                Sobre o Procedimento: {formRecord?.form_type.toUpperCase()}
              </CardTitle>
              <CardDescription className="text-xs">
                Responda com sinceridade para o melhor alinhamento técnico.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* LÁBIOS */}
              {formRecord?.form_type === 'labios' && (
                <>
                  <div className="p-3 bg-rose-50/50 border border-rose-100 rounded-lg space-y-2">
                    <Label className="text-xs font-semibold text-rose-950">
                      Você já teve episódios de Herpes Labial? *
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Importante: Se sim, a clínica orientará a medicação profilática antes do
                      procedimento para evitar novas crises.
                    </p>
                    <RadioGroup
                      value={respostasEspecificas['historico_herpes'] || 'nao'}
                      onValueChange={(val) =>
                        setRespostasEspecificas((prev) => ({ ...prev, historico_herpes: val }))
                      }
                      className="flex gap-4 pt-1"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="nao" id="herpes-nao" />
                        <Label htmlFor="herpes-nao" className="text-xs">
                          Nunca tive
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="raramente" id="herpes-raro" />
                        <Label htmlFor="herpes-raro" className="text-xs">
                          Raramente (1 vez ao ano ou menos)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="frequente" id="herpes-freq" />
                        <Label htmlFor="herpes-freq" className="text-xs">
                          Frequentemente
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-800">
                      Já realizou micropigmentação ou preenchimento labial anteriormente?
                    </Label>
                    <Input
                      placeholder="Ex: Preenchimento com ácido hialurônico há 8 meses"
                      value={respostasEspecificas['procedimentos_labiais_anteriores'] || ''}
                      onChange={(e) =>
                        setRespostasEspecificas((prev) => ({
                          ...prev,
                          procedimentos_labiais_anteriores: e.target.value,
                        }))
                      }
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-800">
                      Qual o seu objetivo principal com os lábios?
                    </Label>
                    <Textarea
                      placeholder="Ex: Definir contorno, dar cor natural, corrigir assimetria..."
                      value={respostasEspecificas['objetivo_labios'] || ''}
                      onChange={(e) =>
                        setRespostasEspecificas((prev) => ({
                          ...prev,
                          objetivo_labios: e.target.value,
                        }))
                      }
                      className="text-xs h-20"
                    />
                  </div>
                </>
              )}

              {/* BOTOX */}
              {formRecord?.form_type === 'botox' && (
                <>
                  <div className="p-3 bg-rose-50/50 border border-rose-100 rounded-lg space-y-2">
                    <Label className="text-xs font-semibold text-rose-950">
                      Já aplicou toxina botulínica antes?
                    </Label>
                    <RadioGroup
                      value={respostasEspecificas['aplicou_botox_antes'] || 'nao'}
                      onValueChange={(val) =>
                        setRespostasEspecificas((prev) => ({ ...prev, aplicou_botox_antes: val }))
                      }
                      className="flex gap-4 pt-1"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="nao" id="botox-nao" />
                        <Label htmlFor="botox-nao" className="text-xs">
                          Primeira vez
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="sim" id="botox-sim" />
                        <Label htmlFor="botox-sim" className="text-xs">
                          Sim, já apliquei
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {respostasEspecificas['aplicou_botox_antes'] === 'sim' && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-800">
                        Quando foi sua última aplicação de botox e qual foi o resultado?
                      </Label>
                      <Input
                        placeholder="Ex: Há 6 meses, resultado excelente"
                        value={respostasEspecificas['tempo_ultima_aplicacao'] || ''}
                        onChange={(e) =>
                          setRespostasEspecificas((prev) => ({
                            ...prev,
                            tempo_ultima_aplicacao: e.target.value,
                          }))
                        }
                        className="text-xs"
                      />
                    </div>
                  )}

                  <div className="p-3 bg-slate-50 border rounded-lg space-y-2">
                    <Label className="text-xs font-semibold text-slate-900">
                      Possui alguma doença neuromuscular (Miastenia Gravis, etc.)?
                    </Label>
                    <RadioGroup
                      value={respostasEspecificas['doenca_neuromuscular'] || 'nao'}
                      onValueChange={(val) =>
                        setRespostasEspecificas((prev) => ({ ...prev, doenca_neuromuscular: val }))
                      }
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="nao" id="neuro-nao" />
                        <Label htmlFor="neuro-nao" className="text-xs">
                          Não
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="sim" id="neuro-sim" />
                        <Label htmlFor="neuro-sim" className="text-xs">
                          Sim
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-800">
                      Quais áreas mais incomodam na sua expressão facial?
                    </Label>
                    <Input
                      placeholder="Ex: Linhas da testa, entre as sobrancelhas (bravo), pés de galinha"
                      value={respostasEspecificas['areas_desejadas'] || ''}
                      onChange={(e) =>
                        setRespostasEspecificas((prev) => ({
                          ...prev,
                          areas_desejadas: e.target.value,
                        }))
                      }
                      className="text-xs"
                    />
                  </div>
                </>
              )}

              {/* ANAMNESE GERAL */}
              {formRecord?.form_type === 'geral' && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-800">
                      Qual o principal motivo da sua consulta e queixas estéticas?
                    </Label>
                    <Textarea
                      placeholder="Descreva o que gostaria de melhorar ou tratar..."
                      value={respostasEspecificas['queixa_principal'] || ''}
                      onChange={(e) =>
                        setRespostasEspecificas((prev) => ({
                          ...prev,
                          queixa_principal: e.target.value,
                        }))
                      }
                      className="text-xs h-20"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-800">
                      Procedimentos estéticos ou cirúrgicos já realizados na face ou corpo:
                    </Label>
                    <Input
                      placeholder="Ex: Bioestimulador de colágeno, rinoplastia, etc."
                      value={respostasEspecificas['procedimentos_anteriores'] || ''}
                      onChange={(e) =>
                        setRespostasEspecificas((prev) => ({
                          ...prev,
                          procedimentos_anteriores: e.target.value,
                        }))
                      }
                      className="text-xs"
                    />
                  </div>

                  <div className="p-3 bg-slate-50 border rounded-lg space-y-2">
                    <Label className="text-xs font-semibold text-slate-900">
                      Costuma se expor ao sol com frequência ou trabalha ao ar livre?
                    </Label>
                    <RadioGroup
                      value={respostasEspecificas['exposicao_solar'] || 'pouco'}
                      onValueChange={(val) =>
                        setRespostasEspecificas((prev) => ({ ...prev, exposicao_solar: val }))
                      }
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="pouco" id="sol-pouco" />
                        <Label htmlFor="sol-pouco" className="text-xs">
                          Pouca exposição / Uso protetor
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="muito" id="sol-muito" />
                        <Label htmlFor="sol-muito" className="text-xs">
                          Muita exposição frequente
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                </>
              )}

              <div className="pt-2 flex justify-between gap-3">
                <Button
                  variant="outline"
                  onClick={() => changeStep(3, 'Histórico de Saúde')}
                  className="text-xs border-slate-300"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Voltar
                </Button>
                <Button
                  onClick={() => changeStep(5, 'Termo de Consentimento')}
                  className="bg-rose-800 hover:bg-rose-900 text-white text-xs gap-1.5"
                >
                  Ir para o Termo <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ETAPA 5: Termo de Consentimento com Rolagem Obrigatória */}
        {step === 5 && activeTerm && (
          <Card className="border-rose-200 shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-rose-800 text-xs font-semibold uppercase tracking-wider">
                <span>Etapa 5 de 6</span> &bull; <span>Termo Legal</span>
              </div>
              <CardTitle className="text-base sm:text-lg text-rose-950 font-bold leading-snug">
                {activeTerm.title}
              </CardTitle>
              <CardDescription className="text-xs">
                Role até o final do documento para habilitar o campo de aceite.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Term Container with required scroll */}
              <div className="relative">
                <div
                  ref={termScrollRef}
                  onScroll={handleTermScroll}
                  className="h-64 sm:h-72 overflow-y-auto p-4 bg-slate-50 border-2 border-slate-300 rounded-xl text-xs text-slate-800 leading-relaxed font-sans whitespace-pre-wrap select-text shadow-inner"
                >
                  {activeTerm.content}
                </div>

                {!hasScrolledToEnd && (
                  <div className="absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none">
                    <span className="bg-rose-900/90 text-white text-[11px] px-3 py-1 rounded-full shadow-lg font-medium animate-bounce flex items-center gap-1">
                      Role até o fim para ler e aceitar &darr;
                    </span>
                  </div>
                )}
              </div>

              {/* Accept Checkbox */}
              <div
                className={`p-3.5 rounded-xl border transition-colors ${
                  hasScrolledToEnd
                    ? 'bg-rose-50/60 border-rose-300'
                    : 'bg-slate-100 border-slate-200 opacity-60'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="aceite-termo"
                    checked={termoAceito}
                    disabled={!hasScrolledToEnd}
                    onCheckedChange={(checked) => handleAcceptTerm(!!checked)}
                    className="mt-0.5 data-[state=checked]:bg-rose-800 data-[state=checked]:border-rose-800"
                  />
                  <div className="grid gap-1 leading-none">
                    <label
                      htmlFor="aceite-termo"
                      className={`text-xs font-medium cursor-pointer ${
                        hasScrolledToEnd ? 'text-rose-950' : 'text-slate-500'
                      }`}
                    >
                      Li integralmente, compreendi e concordo com todos os termos e orientações
                      acima descritos.
                    </label>
                    <p className="text-[11px] text-muted-foreground">
                      Este aceite eletrônico possui validade jurídica equivalente à assinatura
                      física.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-between gap-3">
                <Button
                  variant="outline"
                  onClick={() => changeStep(4, 'Perguntas do Procedimento')}
                  className="text-xs border-slate-300"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Voltar
                </Button>
                <Button
                  onClick={() => changeStep(6, 'Assinatura Digital')}
                  disabled={!termoAceito}
                  className="bg-rose-800 hover:bg-rose-900 text-white text-xs gap-1.5"
                >
                  Avançar para Assinatura <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ETAPA 6: Assinatura Digital e Envio */}
        {step === 6 && (
          <Card className="border-rose-200 shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-rose-800 text-xs font-semibold uppercase tracking-wider">
                <span>Etapa 6 de 6</span> &bull; <span>Assinatura Digital</span>
              </div>
              <CardTitle className="text-lg text-rose-950 font-bold">Assine com o Dedo</CardTitle>
              <CardDescription className="text-xs">
                Desenhe sua assinatura no quadro abaixo para validar seu consentimento.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SignatureCanvas
                onSave={(dataUrl) => setSignatureData(dataUrl)}
                onClear={() => setSignatureData(null)}
                disabled={submitting}
              />

              {/* Integrity audit metadata banner */}
              <div className="bg-slate-50 border rounded-lg p-3 text-[11px] text-slate-600 space-y-1">
                <div className="font-semibold text-slate-800 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Registro de Auditoria Digital & Integridade:
                </div>
                <div>
                  &bull; Nome: {patientName} (CPF: {patientCpf})
                </div>
                <div>&bull; E-mail validado: {patientEmail}</div>
                <div>&bull; Data e Hora: Horário oficial de Brasília (registrado no envio)</div>
                <div>&bull; IP Real do Dispositivo: Capturado no backend no momento do envio</div>
              </div>

              {submissionError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{submissionError}</span>
                </div>
              )}

              <div className="pt-2 flex justify-between gap-3">
                <Button
                  variant="outline"
                  onClick={() => changeStep(5, 'Termo de Consentimento')}
                  disabled={submitting}
                  className="text-xs border-slate-300"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Voltar
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!signatureData || submitting}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs gap-1.5 font-semibold px-4"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Enviando com segurança...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Finalizar e Assinar Ficha
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
