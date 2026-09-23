import { Pause, Play } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

let activeVoiceAudio = null
const WAVEFORM = Array.from({ length: 34 }, (_, index) => 22 + ((index * 37 + index * index * 11) % 68))

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0))
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, '0')}:${String(safeSeconds % 60).padStart(2, '0')}`
}

export default function VoiceMessage({ message }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(Number(message.duration) || 0)
  const [speed, setSpeed] = useState(1)
  const [error, setError] = useState('')
  const progress = duration ? Math.min(1, currentTime / duration) : 0

  useEffect(() => {
    const audio = audioRef.current
    return () => {
      audio?.pause()
      if (activeVoiceAudio === audio) activeVoiceAudio = null
    }
  }, [])

  const togglePlayback = async () => {
    const audio = audioRef.current
    if (!audio) return
    setError('')
    if (!audio.paused) { audio.pause(); return }
    if (activeVoiceAudio && activeVoiceAudio !== audio) activeVoiceAudio.pause()
    activeVoiceAudio = audio
    audio.playbackRate = speed
    try { await audio.play() }
    catch { if (activeVoiceAudio === audio) activeVoiceAudio = null; setError('Unable to play this voice note.') }
  }

  const seek = event => {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(audio.duration) || !duration) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width))
    audio.currentTime = ratio * audio.duration
    setCurrentTime(audio.currentTime)
  }

  const changeSpeed = () => {
    const nextSpeed = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1
    setSpeed(nextSpeed)
    if (audioRef.current) audioRef.current.playbackRate = nextSpeed
  }

  return <div className="voice-message-player">
    <audio
      ref={audioRef}
      src={message.audioUrl}
      preload="metadata"
      onLoadedMetadata={event => { if (Number.isFinite(event.currentTarget.duration)) setDuration(event.currentTarget.duration) }}
      onDurationChange={event => { if (Number.isFinite(event.currentTarget.duration)) setDuration(event.currentTarget.duration) }}
      onTimeUpdate={event => setCurrentTime(event.currentTarget.currentTime)}
      onPlay={() => { setPlaying(true); setError('') }}
      onPause={() => { setPlaying(false); if (activeVoiceAudio === audioRef.current) activeVoiceAudio = null }}
      onEnded={() => { setPlaying(false); setCurrentTime(0); if (audioRef.current) audioRef.current.currentTime = 0; if (activeVoiceAudio === audioRef.current) activeVoiceAudio = null }}
      onError={() => setError('This voice note could not be loaded.')}
    />
    <button type="button" className="voice-play-button" onClick={togglePlayback} aria-label={playing ? 'Pause voice note' : 'Play voice note'}>{playing ? <Pause size={18} fill="currentColor"/> : <Play size={18} fill="currentColor"/>}</button>
    <div className="voice-player-content">
      <div className="voice-waveform" role="slider" tabIndex={0} aria-label="Voice note position" aria-valuemin="0" aria-valuemax={Math.floor(duration)} aria-valuenow={Math.floor(currentTime)} onClick={seek} onKeyDown={event => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); const audio = audioRef.current; if (audio) audio.currentTime = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + (event.key === 'ArrowRight' ? 5 : -5))) } }}>
        {WAVEFORM.map((height, index) => <i key={index} style={{ height: `${height}%`, opacity: index / WAVEFORM.length <= progress ? 1 : .38 }}/>) }
      </div>
      <div className="voice-time-row"><span>{formatTime(currentTime)} / {formatTime(duration)}</span>{error && <span className="voice-play-error" role="status">{error}</span>}</div>
    </div>
    <button type="button" className="voice-speed-button" onClick={changeSpeed} aria-label={`Playback speed ${speed} times`}>{speed}x</button>
  </div>
}
