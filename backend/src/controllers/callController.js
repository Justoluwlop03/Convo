import { httpError } from '../middleware/errorMiddleware.js'

const fallbackIceServers = [{ urls: 'stun:stun.l.google.com:19302' }]

export async function getIceServers(req, res) {
  const keyId = process.env.CLOUDFLARE_TURN_KEY_ID
  const apiToken = process.env.CLOUDFLARE_TURN_API_TOKEN

  if (!keyId || !apiToken) return res.json({ iceServers: fallbackIceServers })

  let response
  try {
    response = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: 86400 }),
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    throw httpError(502, 'Unable to retrieve call connection credentials')
  }

  if (!response.ok) throw httpError(502, 'Unable to retrieve call connection credentials')
  const payload = await response.json()
  if (!Array.isArray(payload.iceServers) || !payload.iceServers.length) throw httpError(502, 'Call connection credentials were invalid')
  res.json({ iceServers: payload.iceServers })
}
