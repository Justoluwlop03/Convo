import { Mic, MicOff, Phone, PhoneOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useCall } from '../../context/CallContext'
import UserAvatar from '../users/UserAvatar'

function durationSince(startedAt) {
  if (!startedAt) return '00:00'
  const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

export default function AudioCallOverlay() {
  const { call, remoteAudioRef, acceptCall, declineCall, endCall, toggleMute, resumeAudio } = useCall()
  const [duration, setDuration] = useState('00:00')

  useEffect(() => {
    if (call.status !== 'connected') return undefined
    const update = () => setDuration(durationSince(call.startedAt))
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [call.startedAt, call.status])

  if (call.status === 'idle') return null
  const incoming = call.status === 'ringing'
  const terminal = ['rejected', 'ended', 'failed', 'busy', 'timeout'].includes(call.status)
  const status = call.status === 'connected' ? duration : call.message || (incoming ? 'Incoming audio call' : 'Calling…')

  return <div className="call-layer" role="dialog" aria-modal="true" aria-label="Audio call" onClick={resumeAudio}>
    <audio ref={remoteAudioRef} autoPlay playsInline />
    <section className="audio-call-card" onClick={event => event.stopPropagation()}>
      <UserAvatar user={call.peer} className="call-avatar" alt="" />
      <p className="call-eyebrow">{incoming ? 'Incoming audio call' : 'Audio call'}</p>
      <h2>{call.peer?.username || 'Convo user'}</h2>
      <p className="call-status" aria-live="polite">{status}</p>
      {!terminal && (incoming ? (
        <div className="call-controls incoming-call-controls">
          <button type="button" className="call-control decline" onClick={declineCall}><PhoneOff size={20} /><span>Decline</span></button>
          <button type="button" className="call-control accept" onClick={acceptCall}><Phone size={20} /><span>Accept</span></button>
        </div>
      ) : (
        <div className="call-controls">
          <button type="button" className="call-control" onClick={toggleMute} disabled={call.status === 'calling'}>{call.muted ? <MicOff size={20} /> : <Mic size={20} />}<span>{call.muted ? 'Unmute' : 'Mute'}</span></button>
          <button type="button" className="call-control decline" onClick={endCall}><PhoneOff size={20} /><span>{call.status === 'calling' ? 'Cancel' : 'End call'}</span></button>
        </div>
      ))}
    </section>
  </div>
}
