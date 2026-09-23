import multer from 'multer'

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const storyMimeTypes = new Set([...allowedMimeTypes, 'video/mp4', 'video/webm', 'video/quicktime'])

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, callback) => {
        callback(null, allowedMimeTypes.has(file.mimetype))
    },
})

export const avatarUpload = upload.single('avatar')

const storyUploadMiddleware = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (_req, file, callback) => callback(null, storyMimeTypes.has(file.mimetype)),
})

export const storyUpload = storyUploadMiddleware.single('media')
