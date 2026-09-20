import { Download, Share, X } from 'lucide-react'
import { useEffect, useState } from 'react'

function isIosDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Mac') && navigator.maxTouchPoints > 1)
}

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
}

export default function InstallConvoButton({ compact = false }) {
  const [prompt, setPrompt] = useState(null)
  const [installed, setInstalled] = useState(isStandalone)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('convo-install-dismissed') === 'true')
  const [showIosGuide, setShowIosGuide] = useState(false)
  const [unavailableMessage, setUnavailableMessage] = useState('')
  const ios = isIosDevice()

  useEffect(() => {
    const onBeforeInstallPrompt = (event) => {
      event.preventDefault()
      setPrompt(event)
    }
    const onInstalled = () => {
      setInstalled(true)
      setPrompt(null)
      localStorage.removeItem('convo-install-dismissed')
    }
    const displayMode = window.matchMedia?.('(display-mode: standalone)')
    const onDisplayModeChange = () => setInstalled(isStandalone())

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onInstalled)
    displayMode?.addEventListener?.('change', onDisplayModeChange)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onInstalled)
      displayMode?.removeEventListener?.('change', onDisplayModeChange)
    }
  }, [])

  const install = async () => {
    if (ios) {
      setShowIosGuide(true)
      return
    }
    if (!prompt) {
      setUnavailableMessage('Install is not ready yet. Refresh after the app finishes loading, or use Chrome, Edge, or Safari.')
      return
    }
    await prompt.prompt()
    const result = await prompt.userChoice
    setPrompt(null)
    if (result.outcome !== 'accepted') {
      localStorage.setItem('convo-install-dismissed', 'true')
      setDismissed(true)
    }
  }

  if (installed || dismissed) return null

  return (
    <>
      <button type="button" className={`icon-button muted install-convo-button ${compact ? 'compact' : ''}`} onClick={install} aria-label="Install Convo" title="Install Convo">
        <Download size={compact ? 19 : 16} />
        {!compact && <span>Install</span>}
      </button>

      {unavailableMessage && (
        <div className="install-unavailable" role="status">{unavailableMessage}</div>
      )}

      {showIosGuide && (
        <div className="ios-install-layer" role="presentation" onClick={() => setShowIosGuide(false)}>
          <section className="ios-install-sheet" role="dialog" aria-modal="true" aria-labelledby="ios-install-title" onClick={(event) => event.stopPropagation()}>
            <div className="ios-install-heading">
              <div><h2 id="ios-install-title">Install Convo</h2><p>Add Convo to your iPhone Home Screen.</p></div>
              <button type="button" className="icon-button" onClick={() => setShowIosGuide(false)} aria-label="Close install instructions"><X size={18} /></button>
            </div>
            <ol>
              <li>Tap the <Share size={16} aria-label="Share" /> Share button in Safari.</li>
              <li>Select <strong>Add to Home Screen</strong>.</li>
              <li>Tap <strong>Add</strong>.</li>
            </ol>
          </section>
        </div>
      )}
    </>
  )
}
