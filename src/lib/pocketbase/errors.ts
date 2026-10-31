import { ClientResponseError } from 'pocketbase'

export type FieldErrors = Record<string, string>

export function extractFieldErrors(error: unknown): FieldErrors {
  if (!(error instanceof ClientResponseError)) return {}
  const data = error.response?.data
  if (!data || typeof data !== 'object') return {}
  const errors: FieldErrors = {}
  for (const [field, detail] of Object.entries(data)) {
    if (
      detail &&
      typeof detail === 'object' &&
      'message' in detail &&
      typeof (detail as { message: unknown }).message === 'string'
    ) {
      errors[field] = (detail as { message: string }).message
    }
  }
  return errors
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    if (error instanceof Error) {
      if (
        error.message === 'Something went wrong.' ||
        error.message === 'An unexpected error occurred.'
      ) {
        return 'Ocorreu uma falha na comunicação com o servidor. Tente novamente.'
      }
      return error.message
    }
    return 'Ocorreu um erro inesperado. Tente novamente.'
  }

  // PocketBase response payload can have { error: "...", message: "..." }
  const resp = error.response as Record<string, unknown> | undefined
  if (resp) {
    if (typeof resp.error === 'string' && resp.error.trim()) {
      return resp.error
    }
    if (
      typeof resp.message === 'string' &&
      resp.message.trim() &&
      resp.message !== 'Something went wrong.'
    ) {
      return resp.message
    }
  }

  const msgs = Object.values(extractFieldErrors(error))
  if (msgs.length > 0) return msgs.join(' ')

  if (error.message && error.message !== 'Something went wrong.') {
    return error.message
  }

  return 'Ocorreu um erro ao processar sua solicitação. Tente novamente.'
}
