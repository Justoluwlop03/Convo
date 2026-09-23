const stunUrl = import.meta.env.VITE_STUN_SERVER_URL || 'stun:stun.l.google.com:19302'
const turnUrl = import.meta.env.VITE_TURN_SERVER_URL
const turnUsername = import.meta.env.VITE_TURN_USERNAME
const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL

export const iceServers = [
  { urls: stunUrl },
  ...(turnUrl && turnUsername && turnCredential ? [{ urls: turnUrl, username: turnUsername, credential: turnCredential }] : []),
]

export function createAudioPeerConnection() {
  return new RTCPeerConnection({ iceServers })
}

export async function requestMicrophone() {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Audio calling is not supported by this browser.')
  return navigator.mediaDevices.getUserMedia({ audio: true, video: false })
}
