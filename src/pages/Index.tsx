import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import pb from '@/lib/pocketbase/client'
import { Card, CardContent } from '@/components/ui/card'
import {
  Sparkles,
  FileCheck2,
  Lock,
  Smartphone,
  MailCheck,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react'

export default function Index() {
  // Trigger do teste de conector para validar envio nos logs
  const [testFired, setTestFired] = useState(false)
  useEffect(() => {
    if (!testFired) {
      setTestFired(true)
      pb.collection('clinic_settings')
        .getOne('ce4i2hdd3182g13')
        .catch(() => {})
    }
  }, [testFired])

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50/80 via-white to-rose-100/40 flex flex-col">
      {/* Navbar */}
      <header className="bg-white/80 backdrop-blur-md border-b border-rose-100 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-rose-900 text-white rounded-xl flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5 text-rose-200" />
            </div>
            <div>
              <span className="text-base font-bold text-rose-950 tracking-tight">
                Andresa Souza Clinic
              </span>
              <span className="block text-[11px] text-rose-700 font-medium -mt-0.5">
                Fichas de Anamnese & Termos Digitais
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              asChild
              className="bg-rose-900 hover:bg-rose-950 text-white text-xs gap-1.5 shadow-sm"
            >
              <Link to="/painel">
                Painel da Clínica
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-5xl mx-auto px-4 py-12 sm:py-16 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-1.5 bg-rose-100 text-rose-900 px-3 py-1 rounded-full text-xs font-semibold mb-6 border border-rose-200">
          <ShieldCheck className="w-4 h-4 text-rose-700" />
          <span>Validade Jurídica &bull; Em conformidade com a LGPD</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold text-rose-950 tracking-tight max-w-3xl leading-tight">
          Fichas de Anamnese on-line com Assinatura Digital no Celular
        </h1>

        <p className="mt-4 text-sm sm:text-base text-slate-600 max-w-2xl leading-relaxed">
          A clínica gera links seguros e os envia ao paciente pelo WhatsApp ou e-mail. O paciente
          preenche em 5 etapas no celular sem precisar de cadastro, assina o termo de consentimento
          com o dedo e recebe comprovante automático com registro de auditoria e PDF.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 w-full max-w-md justify-center">
          <Button
            asChild
            size="lg"
            className="bg-rose-900 hover:bg-rose-950 text-white font-semibold text-sm shadow-md gap-2"
          >
            <Link to="/painel">
              Acessar Painel de Fichas
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            size="lg"
            className="border-rose-300 text-rose-900 hover:bg-rose-50 text-sm font-medium"
          >
            <Link to="/login">Entrar como Administradora</Link>
          </Button>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-16 text-left w-full">
          <Card className="border-rose-100 shadow-sm hover:shadow-md transition-shadow bg-white/90">
            <CardContent className="p-6 space-y-2.5">
              <div className="w-10 h-10 bg-rose-50 text-rose-800 rounded-lg flex items-center justify-center">
                <Smartphone className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Preenchimento Móvel em 5 Etapas</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Interface fluida e sem atrito otimizada para smartphones, com barra de progresso,
                validação de CPF e confirmação de e-mail.
              </p>
            </CardContent>
          </Card>

          <Card className="border-rose-100 shadow-sm hover:shadow-md transition-shadow bg-white/90">
            <CardContent className="p-6 space-y-2.5">
              <div className="w-10 h-10 bg-rose-50 text-rose-800 rounded-lg flex items-center justify-center">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Termo com Rolagem & Assinatura</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Rolagem obrigatória do texto integral do termo, aceite em checkbox e captura da
                assinatura manuscrita desenhada com o dedo em canvas.
              </p>
            </CardContent>
          </Card>

          <Card className="border-rose-100 shadow-sm hover:shadow-md transition-shadow bg-white/90">
            <CardContent className="p-6 space-y-2.5">
              <div className="w-10 h-10 bg-rose-50 text-rose-800 rounded-lg flex items-center justify-center">
                <MailCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Comprovante, Hash & Download PDF</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Gravação de IP, data/hora e hash de integridade SHA-256. Envio de recibo por e-mail
                e exportação completa em PDF no painel da clínica.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 3 Forms Attached Notice */}
        <div className="mt-12 bg-white border border-rose-200 rounded-2xl p-6 max-w-3xl w-full text-left flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
          <div>
            <h4 className="font-bold text-rose-950 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />3 Procedimentos Integrados
            </h4>
            <p className="text-xs text-slate-600 mt-1">
              Anamnese Geral &bull; Lábios / Micropigmentação Labial &bull; Toxina Botulínica
              (Botox), cada um com seu questionário técnico específico e termo homologado.
            </p>
          </div>
          <Button
            asChild
            size="sm"
            className="bg-rose-900 hover:bg-rose-950 text-white text-xs shrink-0"
          >
            <Link to="/painel">Ver no Painel</Link>
          </Button>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-rose-100 bg-white py-6 text-center text-xs text-slate-500">
        <p>
          Andresa Souza Clinic &bull; Estética Avançada &bull; Prontuário Digital com Validade
          Jurídica
        </p>
      </footer>
    </div>
  )
}
