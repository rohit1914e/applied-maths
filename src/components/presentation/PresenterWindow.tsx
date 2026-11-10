import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Renders children into a separate browser window (for a laptop + projector setup:
 * drag this window to the laptop screen, the stage goes fullscreen on the projector).
 * Styles are copied from the main document so the notes look the same.
 */
export function PresenterWindow({ children, onClose, onReady }: { children: ReactNode; onClose: () => void; onReady: (win: Window | null) => void }) {
  const [container, setContainer] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const win = window.open('', 'latency-presenter-notes', 'width=560,height=860')
    if (!win) {
      onClose()
      return
    }
    win.document.title = 'Presenter notes — Network Latency Predictor'
    win.document.head.querySelectorAll('style, link[rel="stylesheet"]').forEach((n) => n.remove())
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
      win.document.head.appendChild(node.cloneNode(true))
    })
    win.document.body.style.margin = '0'
    win.document.body.innerHTML = ''
    const root = win.document.createElement('div')
    root.style.height = '100vh'
    win.document.body.appendChild(root)
    setContainer(root)
    onReady(win)
    const handleUnload = () => onClose()
    win.addEventListener('pagehide', handleUnload)
    return () => {
      win.removeEventListener('pagehide', handleUnload)
      onReady(null)
      win.close()
    }
    // the window lives for the lifetime of this component
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return container ? createPortal(children, container) : null
}
