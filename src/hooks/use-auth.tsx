import React, { createContext, useContext, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import type { RecordModel } from 'pocketbase'

export interface AuthContextType {
  user: RecordModel | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null; status?: number }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<RecordModel | null>(pb.authStore.record)
  const [token, setToken] = useState<string | null>(pb.authStore.token)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = pb.authStore.onChange((newToken, newModel) => {
      setToken(newToken)
      setUser(newModel)
    })

    // Confirma a sessão com o servidor ANTES de qualquer dado ser renderizado.
    // authRefresh também renova o token de 7 dias (renovação contínua da sessão).
    if (pb.authStore.isValid) {
      pb.collection('users')
        .authRefresh()
        .then((res) => {
          setUser(res.record)
          setToken(res.token)
        })
        .catch(() => {
          pb.authStore.clear()
          setUser(null)
          setToken(null)
        })
        .finally(() => setIsLoading(false))
    } else {
      pb.authStore.clear()
      setIsLoading(false)
    }

    return () => {
      unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      // Login via rota server-side: aplica bloqueio de 5 tentativas/15min
      // e registra o acesso (data, hora, IP e dispositivo) em auth_access_logs.
      const res = await pb.send('/backend/v1/auth/login', {
        method: 'POST',
        body: { email: email.trim().toLowerCase(), password },
      })
      const data = res as { token?: string; record?: RecordModel }
      if (data.token && data.record) {
        pb.authStore.save(data.token, data.record)
        setUser(data.record)
        setToken(data.token)
        return { error: null }
      }
      return { error: new Error('E-mail ou senha incorretos.') }
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status
      return { error: err as Error, status }
    }
  }

  const signOut = async () => {
    // Invalida a sessão de verdade: informa o servidor e limpa o token local.
    try {
      await pb.send('/backend/v1/auth/logout', { method: 'POST' })
    } catch (_) {
      // mesmo se o servidor falhar, o token local é descartado
    }
    pb.authStore.clear()
    setUser(null)
    setToken(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}
