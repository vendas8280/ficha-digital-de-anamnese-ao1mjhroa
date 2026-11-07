/**
 * Gerenciador do selo/banner "Criado com o Skip".
 * 1. Permite fechar em definitivo com preferência salva no localStorage.
 * 2. Garante que no carregamento o banner respeite a preferência salva.
 */

const STORAGE_KEY = 'skip_badge_dismissed_permanently'

export function isSkipBannerDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function dismissSkipBannerPermanently(): void {
  try {
    localStorage.setItem(STORAGE_KEY, 'true')
  } catch {
    // ignore
  }
  applySkipBannerPreference()
}

export function applySkipBannerPreference(): void {
  const dismissed = isSkipBannerDismissed()

  const findSkipBanners = (): HTMLElement[] => {
    const matched: HTMLElement[] = []
    // Procura elementos pelo texto "Criado com o Skip"
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT)
    let node = walker.nextNode()
    while (node) {
      if (node instanceof HTMLElement) {
        // Se for um container direto do selo Skip (tem texto "Criado com o Skip")
        if (
          node.innerText?.includes('Criado com o Skip') &&
          node.tagName.toLowerCase() !== 'body' &&
          node.tagName.toLowerCase() !== 'html' &&
          node.id !== 'root'
        ) {
          // Identificar se é o elemento flutuante (fixed/absolute) ou container do badge
          const style = window.getComputedStyle(node)
          if (
            style.position === 'fixed' ||
            style.position === 'absolute' ||
            node.getAttribute('data-skip-badge') ||
            node.className?.includes?.('skip')
          ) {
            matched.push(node)
          } else if (node.parentElement && node.parentElement.id === 'root') {
            matched.push(node)
          }
        }
      }
      node = walker.nextNode()
    }
    return matched
  }

  const banners = findSkipBanners()
  for (const b of banners) {
    if (dismissed) {
      b.style.setProperty('display', 'none', 'important')
    } else {
      // Adicionar listener no botão fechar (X)
      const closeButtons = b.querySelectorAll('button, svg, [role="button"], span, div')
      closeButtons.forEach((btn) => {
        const text = btn.textContent?.trim()
        if (
          text === '×' ||
          text === 'x' ||
          text === 'X' ||
          btn.getAttribute('aria-label')?.includes('fechar') ||
          btn.getAttribute('aria-label')?.includes('close')
        ) {
          btn.addEventListener(
            'click',
            () => {
              dismissSkipBannerPermanently()
            },
            { once: true },
          )
        }
      })
    }
  }
}

export function initSkipBannerObserver(): () => void {
  if (typeof window === 'undefined') return () => {}

  // Executar imediatamente e após timeout
  applySkipBannerPreference()
  const t1 = setTimeout(applySkipBannerPreference, 300)
  const t2 = setTimeout(applySkipBannerPreference, 1000)
  const t3 = setTimeout(applySkipBannerPreference, 2500)

  // Escutar clique global em botão X de qualquer banner Skip
  const handleGlobalClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null
    if (!target) return
    const text = target.textContent?.trim()
    const isClose =
      text === '×' ||
      text === 'x' ||
      text === 'X' ||
      target.getAttribute('aria-label')?.toLowerCase().includes('fechar') ||
      target.getAttribute('aria-label')?.toLowerCase().includes('close')

    if (isClose) {
      const bannerParent = target.closest('div, aside, section')
      if (bannerParent?.textContent?.includes('Criado com o Skip')) {
        dismissSkipBannerPermanently()
      }
    }
  }

  window.addEventListener('click', handleGlobalClick, true)

  const observer = new MutationObserver(() => {
    applySkipBannerPreference()
  })

  observer.observe(document.body, { childList: true, subtree: true })

  return () => {
    clearTimeout(t1)
    clearTimeout(t2)
    clearTimeout(t3)
    window.removeEventListener('click', handleGlobalClick, true)
    observer.disconnect()
  }
}
