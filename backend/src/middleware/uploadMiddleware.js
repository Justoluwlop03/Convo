import multer from 'multer'

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const statusMimeTypes = new Set([...allowedMimeTypes, 'video/mp4', 'video/webm', 'video/quicktime'])

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, callback) => {
        callback(null, allowedMimeTypes.has(file.mimetype))
    },
})

export const avatarUpload = upload.single('avatar')

const messageImageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, callback) => {
        if (!allowedMimeTypes.has(file.mimetype)) return callback(Object.assign(new Error('Choose a JPEG, PNG, WebP, or GIF image'), { statusCode: 400 }))
        callback(null, true)
    },
})

export const privateMessageImageUpload = messageImageUpload.single('image')

let voiceNoteUpload
export const voiceNoteFileUpload = (req, res, next) => {
    if (!voiceNoteUpload) {
        const maxSizeMb = Math.max(1, Number(process.env.VOICE_MAX_FILE_SIZE_MB) || 15)
        const allowedAudioTypes = new Set(['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/aac', 'audio/mp4a-latm', 'application/octet-stream'])
        voiceNoteUpload = multer({
            storage: multer.memoryStorage(),
            limits: { fileSize: maxSizeMb * 1024 * 1024 },
            fileFilter: (_request, file, callback) => {
                const mimeType = file.mimetype.toLowerCase().split(';')[0]
                if (!allowedAudioTypes.has(mimeType)) return callback(Object.assign(new Error('Unsupported voice note format'), { statusCode: 400 }))
                callback(null, true)
            },
        }).single('audio')
    }
    voiceNoteUpload(req, res, next)
}

const statusUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (_req, file, callback) => callback(null, statusMimeTypes.has(file.mimetype)),
})

export const storyUpload = statusUpload.single('media')
