import pb from '@/lib/pocketbase/client'
import type { RecordModel } from 'pocketbase'

// Tipos das rotas de autenticação do painel (auth.pb.js).
export interface AuthAccessLogItem {
  event: string
  ip: string
  user_agent: string
  created: string
}

export interface AuthAccessLogsResponse {
  logs: AuthAccessLogItem[]
}

export const authService = {
  // Indica se o painel ainda não tem administrador (fluxo de primeiro acesso)
  async getSetupStatus(): Promise<boolean> {
    const res = await pb.send('/backend/v1/auth/status', { method: 'GET' })
    return !!(res as { setup_required?: boolean }).setup_required
  },

  // Cria o ÚNICO administrador, com e-mail e senha definidos pela clínica em tela
  async setupAdmin(email: string, password: string): Promise<RecordModel> {
    const res = await pb.send('/backend/v1/auth/setup', {
      method: 'POST',
      body: { email, password },
    })
    return res as RecordModel
  },

  // Login server-side com bloqueio de 5 tentativas por e-mail em 15 minutos
  async login(email: string, password: string): Promise<void> {
    await pb.send('/backend/v1/auth/login', {
      method: 'POST',
      body: { email, password },
    })
  },

  // Registra o logout no servidor (audit trail)
  async logout(): Promise<void> {
    await pb.send('/backend/v1/auth/logout', { method: 'POST' })
  },

  // Envia o link de redefinição (validade de 1 hora) para o e-mail cadastrado
  async forgotPassword(email: string): Promise<void> {
    const base = window.location.origin
    await pb.send('/backend/v1/auth/forgot-password', {
      method: 'POST',
      body: { email, reset_url_base: base + '/redefinir-senha' },
    })
  },

  // Define a nova senha a partir do token do e-mail
  async resetPassword(token: string, password: string): Promise<void> {
    await pb.send('/backend/v1/auth/reset-password', {
      method: 'POST',
      body: { token, password },
    })
  },

  // Últimos acessos do administrador (exibidos em Configurações)
  async accessLogs(): Promise<AuthAccessLogItem[]> {
    const res = await pb.send('/backend/v1/auth/access-logs', { method: 'GET' })
    return (res as AuthAccessLogsResponse).logs || []
  },
}
