// Utilitário para formatar User-Agent em descrição legível de dispositivo/navegador
// Exemplo: "Mac — Google Chrome", "iPhone — Safari", "Windows — Microsoft Edge"
// NUNCA exibe user-agent bruto no Comprovante de Assinatura.

export function formatFriendlyDevice(userAgent?: string): string {
  const ua = (userAgent || '').trim()
  if (!ua) return 'Dispositivo não informado'

  const uaLower = ua.toLowerCase()

  // Detecta Sistema Operacional / Dispositivo
  let os = 'Dispositivo'
  if (uaLower.includes('iphone')) {
    os = 'iPhone'
  } else if (uaLower.includes('ipad')) {
    os = 'iPad'
  } else if (uaLower.includes('android')) {
    if (uaLower.includes('mobile')) {
      os = 'Android (Smartphone)'
    } else {
      os = 'Android (Tablet)'
    }
  } else if (
    uaLower.includes('macintosh') ||
    uaLower.includes('mac os x') ||
    uaLower.includes('macos')
  ) {
    os = 'Mac'
  } else if (uaLower.includes('windows')) {
    os = 'Windows'
  } else if (uaLower.includes('linux')) {
    os = 'Linux'
  }

  // Detecta Navegador
  let browser = 'Navegador Web'
  if (uaLower.includes('edg/') || uaLower.includes('edge/')) {
    browser = 'Microsoft Edge'
  } else if (uaLower.includes('opr/') || uaLower.includes('opera')) {
    browser = 'Opera'
  } else if (uaLower.includes('chrome') && !uaLower.includes('chromium')) {
    browser = 'Google Chrome'
  } else if (uaLower.includes('firefox')) {
    browser = 'Mozilla Firefox'
  } else if (
    uaLower.includes('safari') &&
    !uaLower.includes('chrome') &&
    !uaLower.includes('android')
  ) {
    browser = 'Safari'
  } else if (uaLower.includes('samsungbrowser')) {
    browser = 'Samsung Internet'
  }

  return `${os} — ${browser}`
}
