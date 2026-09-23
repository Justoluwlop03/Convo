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

const statusUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (_req, file, callback) => callback(null, statusMimeTypes.has(file.mimetype)),
})

export const storyUpload = statusUpload.single('media')
