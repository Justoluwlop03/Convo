import { httpError } from '../middleware/errorMiddleware.js'
import { deleteVoiceNote, uploadVoiceNote } from '../config/cloudinary.js'

const maximumDuration = () => Math.max(1, Number(process.env.VOICE_MAX_DURATION_SECONDS) || 300)

export function voiceNotePlaybackUrl(audioUrl) {
  if (!audioUrl) return ''
  try {
    const url = new URL(audioUrl)
    if (url.hostname !== 'res.cloudinary.com') return audioUrl
    const path = url.pathname
    if (!/\.(webm|mp4|m4a|ogg|wav|mp3|aac)$/i.test(path)) return audioUrl
    url.pathname = path.replace(/\.(webm|mp4|m4a|ogg|wav|mp3|aac)$/i, '.mp3')
    return url.toString()
  } catch {
    return audioUrl
  }
}

function detectAudioFormat(buffer) {
  if (buffer.length >= 4 && buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return 'webm'
  if (buffer.length >= 4 && buffer.toString('ascii', 0, 4) === 'OggS') return 'ogg'
  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') return 'mp4'
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE') return 'wav'
  if (buffer.length >= 3 && buffer.toString('ascii', 0, 3) === 'ID3') return 'mp3'
  if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return 'mp3'
  if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xf6) === 0xf0) return 'aac'
  return null
}

export async function storeVoiceNote(file) {
  if (!file?.buffer?.length) throw httpError(400, 'Record a voice note before sending')
  const format = detectAudioFormat(file.buffer)
  if (!format) throw httpError(400, 'The uploaded file is not a supported audio recording')

  const uploaded = await uploadVoiceNote(file.buffer)
  const actualDuration = Number(uploaded.duration ?? uploaded.audio_duration)
  if (!Number.isFinite(actualDuration) || actualDuration <= 0) {
    await deleteVoiceNote(uploaded.public_id).catch(() => {})
    throw httpError(400, 'Unable to verify the voice note duration')
  }
  if (actualDuration > maximumDuration()) {
    await deleteVoiceNote(uploaded.public_id).catch(() => {})
    throw httpError(400, `Voice notes must be ${maximumDuration()} seconds or shorter`)
  }
  return { audioUrl: uploaded.secure_url, audioPublicId: uploaded.public_id, duration: Math.ceil(actualDuration) }
}

export { maximumDuration }
