import { ImagePlus, Mic, SendHorizontal, Square, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_IMAGE_SIZE = 10 * 1024 * 1024
const MAX_RECORDING_SECONDS = Math.max(1, Number(import.meta.env.VITE_VOICE_MAX_DURATION_SECONDS) || 300)
const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/ogg']

function formatTime(seconds) {
    const safeSeconds = Math.max(0, Math.floor(seconds || 0))
    return `${String(Math.floor(safeSeconds / 60)).padStart(2, '0')}:${String(safeSeconds % 60).padStart(2, '0')}`
}

function microphoneError(error) {
    if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') return 'Allow microphone access in your browser settings to record a voice note.'
    if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') return 'No microphone was found on this device.'
    if (error?.name === 'NotReadableError' || error?.name === 'TrackStartError') return 'The microphone is busy or unavailable. Close other apps using it and try again.'
    return error?.message || 'Unable to start microphone recording.'
}

export default function MessageComposer({ onSend, onSendImage, onSendVoice, allowImages = false, onTypingStart, onTypingStop, replyTo, onCancelReply, disabled = false, disabledMessage = '' }) {
    const [value, setValue] = useState('')
    const [image, setImage] = useState(null)
    const [composerError, setComposerError] = useState('')
    const [sendingImage, setSendingImage] = useState(false)
    const [sendingVoice, setSendingVoice] = useState(false)
    const [previewUrl, setPreviewUrl] = useState('')
    const [acquiringMicrophone, setAcquiringMicrophone] = useState(false)
    const [recording, setRecording] = useState(false)
    const [stoppingRecording, setStoppingRecording] = useState(false)
    const [recordingSeconds, setRecordingSeconds] = useState(0)
    const [voiceAttachment, setVoiceAttachment] = useState(null)
    const imageInputRef = useRef(null)
    const recorderRef = useRef(null)
    const streamRef = useRef(null)
    const chunksRef = useRef([])
    const startedAtRef = useRef(0)
    const stopDurationRef = useRef(0)
    const canceledRecordingRef = useRef(false)
    const mountedRef = useRef(true)
    const recordingTimerRef = useRef(null)
    const microphoneOperationRef = useRef(false)
    const uploadLockRef = useRef(false)
    const typingTimeoutRef = useRef(null)
    const isTypingRef = useRef(false)
    const stopTypingRef = useRef(null)

    const stopTyping = () => {
        if (!isTypingRef.current) return
        isTypingRef.current = false
        onTypingStop?.()
    }

    useEffect(() => { stopTypingRef.current = stopTyping })
    useEffect(() => {
        mountedRef.current = true
        return () => {
            mountedRef.current = false
            clearTimeout(typingTimeoutRef.current)
            clearInterval(recordingTimerRef.current)
            stopTypingRef.current?.()
            canceledRecordingRef.current = true
            if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
            streamRef.current?.getTracks().forEach(track => track.stop())
        }
    }, [])
    useEffect(() => {
        return () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }
    }, [previewUrl])
    useEffect(() => {
        const url = voiceAttachment?.previewUrl
        return () => { if (url) URL.revokeObjectURL(url) }
    }, [voiceAttachment?.previewUrl])

    const handleChange = event => {
        setValue(event.target.value)
        if (!isTypingRef.current) {
            isTypingRef.current = true
            onTypingStart?.()
        }
        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = setTimeout(stopTyping, 1200)
    }

    const chooseImage = event => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) return
        if (!IMAGE_TYPES.has(file.type)) { setComposerError('Choose a JPEG, PNG, WebP, or GIF image.'); return }
        if (file.size > MAX_IMAGE_SIZE) { setComposerError('Images must be 10 MB or smaller.'); return }
        setComposerError('')
        setPreviewUrl(URL.createObjectURL(file))
        setImage(file)
    }

    const stopRecording = () => {
        const recorder = recorderRef.current
        if (!recorder || recorder.state !== 'recording') return
        stopDurationRef.current = Math.min(MAX_RECORDING_SECONDS, (performance.now() - startedAtRef.current) / 1000)
        clearInterval(recordingTimerRef.current)
        setStoppingRecording(true)
        recorder.stop()
    }
    const startRecording = async () => {
        if (disabled || microphoneOperationRef.current || acquiringMicrophone || recording || stoppingRecording || sendingVoice || sendingImage) return
        setComposerError('')
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
            setComposerError(window.isSecureContext === false ? 'Microphone access requires HTTPS. Use localhost for development or open the secure app address.' : 'Voice recording is not supported by this browser. Try a recent version of Chrome or Safari.')
            return
        }

        microphoneOperationRef.current = true
        setAcquiringMicrophone(true)
        let stream
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            if (!mountedRef.current) { stream.getTracks().forEach(track => track.stop()); return }
            streamRef.current = stream
            const mimeType = MIME_CANDIDATES.find(candidate => MediaRecorder.isTypeSupported?.(candidate)) || ''
            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
            chunksRef.current = []
            canceledRecordingRef.current = false
            startedAtRef.current = performance.now()
            stopDurationRef.current = 0
            recorder.ondataavailable = event => { if (event.data?.size) chunksRef.current.push(event.data) }
            recorder.onerror = () => {
                canceledRecordingRef.current = true
                setComposerError('Recording failed. Check microphone access and try again.')
                if (recorder.state === 'recording') recorder.stop()
            }
            recorder.onstop = () => {
                clearInterval(recordingTimerRef.current)
                stream.getTracks().forEach(track => track.stop())
                if (streamRef.current === stream) streamRef.current = null
                if (recorderRef.current === recorder) recorderRef.current = null
                if (mountedRef.current) { setRecording(false); setStoppingRecording(false) }
                if (!mountedRef.current || canceledRecordingRef.current) { chunksRef.current = []; return }
                const duration = stopDurationRef.current
                const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || 'application/octet-stream' })
                chunksRef.current = []
                if (duration < 0.7 || blob.size < 300) {
                    setComposerError('That recording was too short. Record at least one second and try again.')
                    setRecordingSeconds(0)
                    return
                }
                setVoiceAttachment({ blob, mimeType: blob.type || mimeType, duration, previewUrl: URL.createObjectURL(blob) })
            }
            recorderRef.current = recorder
            recorder.start(250)
            setRecording(true)
            setRecordingSeconds(0)
            recordingTimerRef.current = setInterval(() => {
                const elapsed = (performance.now() - startedAtRef.current) / 1000
                setRecordingSeconds(Math.min(Math.floor(elapsed), MAX_RECORDING_SECONDS))
                if (elapsed >= MAX_RECORDING_SECONDS) stopRecording()
            }, 200)
        } catch (error) {
            stream?.getTracks().forEach(track => track.stop())
            if (recorderRef.current?.state === 'recording') {
                canceledRecordingRef.current = true
                recorderRef.current.stop()
            }
            recorderRef.current = null
            streamRef.current = null
            if (mountedRef.current) setComposerError(microphoneError(error))
        } finally {
            microphoneOperationRef.current = false
            if (mountedRef.current) setAcquiringMicrophone(false)
        }
    }

    const cancelRecording = () => {
        canceledRecordingRef.current = true
        clearInterval(recordingTimerRef.current)
        setRecording(false)
        setStoppingRecording(false)
        setRecordingSeconds(0)
        chunksRef.current = []
        streamRef.current?.getTracks().forEach(track => track.stop())
        streamRef.current = null
        if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
        recorderRef.current = null
    }

    const handleSubmit = async event => {
        event.preventDefault()
        if (disabled || uploadLockRef.current || sendingImage || sendingVoice || recording || acquiringMicrophone || stoppingRecording) return
        const text = value.trim()
        if (voiceAttachment) {
            if (!onSendVoice) return
            uploadLockRef.current = true
            setSendingVoice(true)
            setComposerError('')
            try {
                await onSendVoice(voiceAttachment.blob, voiceAttachment.mimeType, replyTo)
                setVoiceAttachment(null)
                setPreviewUrl('')
                setRecordingSeconds(0)
                clearTimeout(typingTimeoutRef.current)
                stopTyping()
                onCancelReply?.()
            } catch (error) {
                setComposerError(error.response?.data?.message || error.message || 'Unable to send this voice note.')
            } finally { uploadLockRef.current = false; setSendingVoice(false) }
            return
        }
        if (image) {
            if (!onSendImage) return
            uploadLockRef.current = true
            setSendingImage(true)
            setComposerError('')
            try {
                await onSendImage(image, text, replyTo)
                setImage(null)
                setPreviewUrl('')
                setValue('')
                clearTimeout(typingTimeoutRef.current)
                stopTyping()
                onCancelReply?.()
            } catch (error) {
                setComposerError(error.response?.data?.message || error.message || 'Unable to send this image.')
            } finally { uploadLockRef.current = false; setSendingImage(false) }
            return
        }
        if (!text) return
        await onSend(text, replyTo)
        clearTimeout(typingTimeoutRef.current)
        stopTyping()
        setValue('')
    }

    const canSendVoice = Boolean(voiceAttachment && onSendVoice)
    const busy = sendingImage || sendingVoice || acquiringMicrophone || stoppingRecording

    return <form className={`composer ${recording ? 'composer-recording' : ''}`} onSubmit={handleSubmit}>
        {replyTo && <div className="composer-reply"><div><strong>Replying to {replyTo.sender?.username || 'message'}</strong><span>{replyTo.text || (replyTo.imageUrl ? 'Photo' : '')}</span></div><button type="button" onClick={onCancelReply} aria-label="Cancel reply"><X size={15}/></button></div>}
        {previewUrl && <div className="composer-image-preview"><img src={previewUrl} alt="Image to send"/><button type="button" onClick={() => { setImage(null); setPreviewUrl('') }} aria-label="Remove image" disabled={busy}><X size={16}/></button></div>}
        {recording && <div className="voice-recording-row" role="status"><span className="voice-recording-dot"/><strong>Recording {formatTime(recordingSeconds)}</strong><button type="button" className="voice-cancel-button" onClick={cancelRecording} aria-label="Cancel recording"><Trash2 size={17}/></button><button type="button" className="voice-stop-button" onClick={stopRecording} aria-label="Stop recording"><Square size={17}/><span>Stop</span></button></div>}
        {voiceAttachment?.previewUrl && <div className="voice-preview-row"><audio src={voiceAttachment.previewUrl} controls preload="metadata" aria-label="Preview voice note"/><span>{formatTime(voiceAttachment.duration)}</span><button type="button" className="voice-cancel-button" onClick={() => { setVoiceAttachment(null); setRecordingSeconds(0) }} disabled={busy} aria-label="Delete voice note"><Trash2 size={17}/></button></div>}
        {composerError && <p className="inline-error" role="alert">{composerError}</p>}
        <textarea value={value} onChange={handleChange} placeholder={disabled ? disabledMessage || 'Messaging is unavailable.' : image ? 'Add a caption (optional)…' : 'Write a message…'} rows={1} disabled={disabled || busy || recording || Boolean(voiceAttachment)}/>
        <div className="composer-actions">
            {allowImages && !voiceAttachment && !recording && !acquiringMicrophone && <><input ref={imageInputRef} className="composer-image-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={chooseImage} disabled={disabled || busy}/><button type="button" className="composer-image-button" onClick={() => imageInputRef.current?.click()} aria-label="Attach an image" title="Share image" disabled={disabled || busy}><ImagePlus size={18}/></button></>}
            {!image && !voiceAttachment && !recording && !acquiringMicrophone && !value.trim() && <button type="button" className="composer-image-button voice-record-button" onClick={startRecording} aria-label="Record a voice note" title="Record voice note" disabled={disabled || busy}><Mic size={18}/></button>}
            <button type="submit" className="primary-button send-button" disabled={disabled || busy || recording || (!value.trim() && !image && !canSendVoice)} aria-label={sendingImage || sendingVoice ? 'Uploading attachment' : 'Send message'}>
                <SendHorizontal size={16}/><span>{sendingImage || sendingVoice ? 'Uploading…' : canSendVoice ? 'Send voice' : 'Send'}</span>
            </button>
        </div>
    </form>
}
