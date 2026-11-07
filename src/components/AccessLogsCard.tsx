import { useEffect, useState } from 'react'
import { authService, AuthAccessLogItem } from '@/services/auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { History, Loader2, Monitor, Smartphone, Tablet } from 'lucide-react'

/** Formata "2026-11-07 12:34:56.789Z" para data e hora no fuso de São Paulo. */
function formatLogDateTime(raw: string): string {
  const iso = raw.includes('T') ? raw : raw.replace(' ', 'T') + (raw.endsWith('Z') ? '' : 'Z')
  const date = new Date(iso)
  if (isNaN(date.getTime())) return raw
  const dateStr = date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const timeStr = date.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${dateStr} às ${timeStr}`
}

/** Traduz o User-Agent para um nome de dispositivo/navegador legível. */
function describeDevice(userAgent: string): string {
  const ua = (userAgent || '').toLowerCase()
  if (!ua) return 'Dispositivo desconhecido'

  const isTablet = ua.includes('ipad') || (ua.includes('android') && !ua.includes('mobile'))
  const isMobile =
    ua.includes('iphone') || ua.includes('android') || ua.includes('windows phone') || isTablet

  let browser = 'Navegador'
  if (ua.includes('edg/')) browser = 'Edge'
  else if (ua.includes('opr/') || ua.includes('opera')) browser = 'Opera'
  else if (ua.includes('chrome') && !ua.includes('chromium')) browser = 'Chrome'
  else if (ua.includes('firefox')) browser = 'Firefox'
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari'

  let system = ''
  if (ua.includes('windows')) system = 'Windows'
  else if (ua.includes('mac os') || ua.includes('macintosh')) system = 'Mac'
  else if (ua.includes('iphone')) system = 'iPhone'
  else if (isTablet) system = 'Tablet'
  else if (ua.includes('android')) system = 'Android'
  else if (ua.includes('linux')) system = 'Linux'

  const parts = [browser, system].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : 'Dispositivo desconhecido'
}

function EventLabel({ event }: { event: string }) {
  const map: Record<string, { label: string; className: string }> = {
    login: {
      label: 'Entrou no painel',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    logout: {
      label: 'Saiu do painel',
      className: 'bg-slate-100 text-slate-600 border-slate-200',
    },
    senha_redefinida: {
      label: 'Senha redefinida',
      className: 'bg-amber-50 text-amber-800 border-amber-200',
    },
  }
  const item = map[event] || {
    label: event,
    className: 'bg-slate-100 text-slate-600 border-slate-200',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${item.className}`}
    >
      {item.label}
    </span>
  )
}

/**
 * Card "Últimos acessos" (Configurações): data, hora e dispositivo/navegador
 * de cada login do administrador, do acesso mais recente para o mais antigo.
 * Os registros vêm da rota autenticada /backend/v1/auth/access-logs.
 */
export function AccessLogsCard() {
  const [logs, setLogs] = useState<AuthAccessLogItem[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    authService
      .accessLogs()
      .then((items) => {
        if (active) setLogs(items)
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <History className="w-5 h-5 text-rose-800" />
          Últimos acessos
        </CardTitle>
        <CardDescription className="text-xs">
          Registro dos acessos recentes ao painel — data, hora e dispositivo utilizados. Se algo
          parecer estranho, troque a senha em &quot;Esqueci minha senha&quot;.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {logs === null && !failed && (
          <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Carregando acessos...
          </div>
        )}

        {failed && (
          <p className="text-xs text-slate-500 py-2">
            Não foi possível carregar os últimos acessos agora.
          </p>
        )}

        {logs !== null && logs.length === 0 && (
          <p className="text-xs text-slate-500 py-2">Nenhum acesso registrado até agora.</p>
        )}

        {logs !== null && logs.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {logs.map((log, index) => {
              const isMobileDevice = /iphone|android|windows phone|ipad/i.test(log.user_agent || '')
              const DeviceIcon = isMobileDevice ? Smartphone : Tablet
              return (
                <li key={`${log.created}-${index}`} className="py-2.5 flex items-start gap-3">
                  <div className="mt-0.5 w-7 h-7 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                    <DeviceIcon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <EventLabel event={log.event} />
                      <span className="text-xs font-medium text-slate-800">
                        {formatLogDateTime(log.created)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                      <Monitor className="w-3 h-3" />
                      {describeDevice(log.user_agent)}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export default AccessLogsCard
