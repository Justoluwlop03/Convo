import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import { useChat } from './ChatContext'
import { createAudioPeerConnection, requestMicrophone } from '../services/webrtc'

const CallContext = createContext(null)
const TERMINAL_STATES = new Set(['rejected', 'ended', 'failed', 'busy', 'timeout'])

function acknowledgement(socket, event, payload) {
  return new Promise((resolve, reject) => socket.emit(event, payload, response => response?.error ? reject(new Error(response.error)) : resolve(response)))
}

export function CallProvider({ children }) {
  const { user } = useAuth()
  const { socket } = useChat()
  const [call, setCall] = useState({ status: 'idle', callId: null, chatId: null, peer: null, message: '', muted: false, startedAt: null })
  const peerConnectionRef = useRef(null)
  const localStreamRef = useRef(null)
  const pendingCandidatesRef = useRef([])
  const remoteAudioRef = useRef(null)
  const callRef = useRef(call)
  const resetTimerRef = useRef(null)

  useEffect(() => { callRef.current = call }, [call])

  const releaseMedia = useCallback(() => {
    clearTimeout(resetTimerRef.current)
    pendingCandidatesRef.current = []
    peerConnectionRef.current?.close()
    peerConnectionRef.current = null
    localStreamRef.current?.getTracks().forEach(track => track.stop())
    localStreamRef.current = null
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause()
      remoteAudioRef.current.srcObject = null
    }
  }, [])

  const finish = useCallback((status = 'ended', message = '') => {
    releaseMedia()
    setCall(current => ({ ...current, status, message, muted: false }))
    if (TERMINAL_STATES.has(status)) {
      resetTimerRef.current = setTimeout(() => setCall({ status: 'idle', callId: null, chatId: null, peer: null, message: '', muted: false, startedAt: null }), 2800)
    }
  }, [releaseMedia])

  const addCandidate = useCallback(async candidate => {
    const connection = peerConnectionRef.current
    if (!connection || !candidate) return
    if (!connection.remoteDescription) {
      pendingCandidatesRef.current.push(candidate)
      return
    }
    await connection.addIceCandidate(candidate)
  }, [])

  const createConnection = useCallback(async (callId) => {
    if (peerConnectionRef.current) return peerConnectionRef.current
    const stream = localStreamRef.current || await requestMicrophone()
    localStreamRef.current = stream
    const connection = createAudioPeerConnection()
    peerConnectionRef.current = connection
    stream.getAudioTracks().forEach(track => connection.addTrack(track, stream))
    connection.onicecandidate = event => {
      if (event.candidate) socket?.emit('call:ice-candidate', { callId, candidate: event.candidate.toJSON() })
    }
    connection.ontrack = event => {
      const audio = remoteAudioRef.current
      if (!audio) return
      audio.srcObject = event.streams[0] || new MediaStream([event.track])
      audio.play().catch(() => setCall(current => ({ ...current, message: 'Tap the call screen to play remote audio.' })))
    }
    connection.onconnectionstatechange = () => {
      if (connection.connectionState === 'connected') setCall(current => ({ ...current, status: 'connected', startedAt: current.startedAt || Date.now(), message: '' }))
      if (['failed', 'closed'].includes(connection.connectionState)) finish('failed', 'The audio connection failed.')
      if (connection.connectionState === 'disconnected') setCall(current => ({ ...current, message: 'Connection interrupted…' }))
    }
    connection.oniceconnectionstatechange = () => {
      if (connection.iceConnectionState === 'failed') finish('failed', 'Unable to establish an audio connection.')
    }
    return connection
  }, [finish, socket])

  const makeOffer = useCallback(async callId => {
    try {
      const connection = await createConnection(callId)
      const offer = await connection.createOffer()
      await connection.setLocalDescription(offer)
      socket?.emit('call:offer', { callId, offer: connection.localDescription })
    } catch (error) {
      socket?.emit('call:end', { callId })
      finish('failed', error.name === 'NotAllowedError' ? 'Microphone permission is required to make an audio call.' : error.message || 'Unable to start the call.')
    }
  }, [createConnection, finish, socket])

  useEffect(() => {
    if (!socket || !user?.id) return undefined
    const incoming = ({ callId, chatId, caller }) => {
      if (callRef.current.status !== 'idle') return socket.emit('call:reject', { callId })
      setCall({ status: 'ringing', callId, chatId, peer: caller, message: 'Incoming audio call', muted: false, startedAt: null })
    }
    const accepted = ({ callId }) => {
      if (callRef.current.callId !== callId || callRef.current.status !== 'calling') return
      setCall(current => ({ ...current, status: 'connecting', message: 'Connecting…' }))
      makeOffer(callId)
    }
    const offered = async ({ callId, offer }) => {
      if (callRef.current.callId !== callId || !['connecting', 'ringing'].includes(callRef.current.status)) return
      try {
        const connection = await createConnection(callId)
        await connection.setRemoteDescription(offer)
        for (const candidate of pendingCandidatesRef.current.splice(0)) await connection.addIceCandidate(candidate)
        const answer = await connection.createAnswer()
        await connection.setLocalDescription(answer)
        socket.emit('call:answer', { callId, answer: connection.localDescription })
        setCall(current => ({ ...current, status: 'connecting', message: 'Connecting…' }))
      } catch (error) {
        socket.emit('call:end', { callId })
        finish('failed', error.name === 'NotAllowedError' ? 'Microphone permission is required to answer this call.' : 'Unable to answer the call.')
      }
    }
    const answered = async ({ callId, answer }) => {
      if (callRef.current.callId !== callId || !peerConnectionRef.current) return
      try {
        await peerConnectionRef.current.setRemoteDescription(answer)
        for (const candidate of pendingCandidatesRef.current.splice(0)) await peerConnectionRef.current.addIceCandidate(candidate)
      } catch { finish('failed', 'Unable to complete the call connection.') }
    }
    const candidate = ({ callId, candidate: nextCandidate }) => { if (callRef.current.callId === callId) addCandidate(nextCandidate).catch(() => finish('failed', 'Unable to connect the call.')) }
    const rejected = ({ callId, reason }) => { if (callRef.current.callId === callId) finish('rejected', reason || 'Call declined.') }
    const ended = ({ callId, reason }) => { if (callRef.current.callId === callId) finish('ended', reason === 'missed' ? 'Missed call.' : reason || 'Call ended.') }
    const busy = ({ chatId }) => { if (callRef.current.chatId === chatId) finish('busy', 'The recipient is busy.') }
    const timedOut = ({ callId, chatId, reason }) => { if (!callId || callRef.current.callId === callId || callRef.current.chatId === chatId) finish('timeout', reason || 'No answer.') }
    const disconnected = () => { if (callRef.current.status !== 'idle') finish('failed', 'Network connection lost. Call ended.') }
    socket.on('call:incoming', incoming); socket.on('call:accept', accepted); socket.on('call:offer', offered); socket.on('call:answer', answered); socket.on('call:ice-candidate', candidate); socket.on('call:reject', rejected); socket.on('call:end', ended); socket.on('call:busy', busy); socket.on('call:timeout', timedOut); socket.on('disconnect', disconnected)
    return () => { socket.off('call:incoming', incoming); socket.off('call:accept', accepted); socket.off('call:offer', offered); socket.off('call:answer', answered); socket.off('call:ice-candidate', candidate); socket.off('call:reject', rejected); socket.off('call:end', ended); socket.off('call:busy', busy); socket.off('call:timeout', timedOut); socket.off('disconnect', disconnected) }
  }, [addCandidate, createConnection, finish, makeOffer, socket, user?.id])

  useEffect(() => () => releaseMedia(), [releaseMedia])

  const startCall = useCallback(async chat => {
    if (!socket?.connected) return finish('failed', 'You need an internet connection to place a call.')
    if (!chat || chat.type === 'group' || !chat.participant || chat.participant.id === user?.id) return finish('failed', 'Audio calls are available only in private conversations.')
    if (callRef.current.status !== 'idle') return
    try {
      const stream = await requestMicrophone()
      localStreamRef.current = stream
      const response = await acknowledgement(socket, 'call:initiate', { chatId: chat.id })
      setCall({ status: 'calling', callId: response.callId, chatId: chat.id, peer: chat.participant, message: 'Calling…', muted: false, startedAt: null })
    } catch (error) {
      releaseMedia()
      finish('failed', error.name === 'NotAllowedError' ? 'Microphone permission is required to make an audio call.' : error.message || 'Unable to start the call.')
    }
  }, [finish, releaseMedia, socket, user?.id])

  const acceptCall = useCallback(async () => {
    const current = callRef.current
    if (!socket || current.status !== 'ringing') return
    try {
      await requestMicrophone().then(stream => { stream.getTracks().forEach(track => track.stop()) })
      await acknowledgement(socket, 'call:accept', { callId: current.callId })
      setCall(value => ({ ...value, status: 'connecting', message: 'Connecting…' }))
    } catch (error) { finish('failed', error.name === 'NotAllowedError' ? 'Microphone permission is required to answer this call.' : error.message || 'Unable to answer the call.') }
  }, [finish, socket])

  const declineCall = useCallback(() => { const current = callRef.current; if (current.callId) socket?.emit('call:reject', { callId: current.callId }); finish('ended') }, [finish, socket])
  const endCall = useCallback(() => { const current = callRef.current; if (current.callId) socket?.emit('call:end', { callId: current.callId }); finish('ended', 'Call ended.') }, [finish, socket])
  const toggleMute = useCallback(() => { const track = localStreamRef.current?.getAudioTracks()[0]; if (!track) return; track.enabled = !track.enabled; setCall(current => ({ ...current, muted: !track.enabled })) }, [])
  const resumeAudio = useCallback(() => remoteAudioRef.current?.play().catch(() => {}), [])

  const value = useMemo(() => ({ call, remoteAudioRef, startCall, acceptCall, declineCall, endCall, toggleMute, resumeAudio }), [acceptCall, call, declineCall, endCall, resumeAudio, startCall, toggleMute])
  return <CallContext.Provider value={value}>{children}</CallContext.Provider>
}

export function useCall() {
  const context = useContext(CallContext)
  if (!context) throw new Error('useCall must be used within a CallProvider')
  return context
}
