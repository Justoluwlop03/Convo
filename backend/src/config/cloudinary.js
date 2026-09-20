import { v2 as cloudinary } from 'cloudinary'

const requiredKeys = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']

function isConfigured() {
    return requiredKeys.every(key => process.env[key])
}

export function configureCloudinary() {
    if (!isConfigured()) {
        console.warn('Cloudinary is not configured; avatar uploads are disabled.')
        return false
    }

    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    })
    return true
}

function requireConfiguration() {
    if (!isConfigured()) throw new Error('Avatar uploads are unavailable because Cloudinary is not configured')
}

export function uploadAvatar(buffer) {
    requireConfiguration()
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: 'convo/avatars', resource_type: 'image' },
            (error, result) => error ? reject(error) : resolve(result),
        )
        stream.end(buffer)
    })
}

export function deleteAvatar(publicId) {
    requireConfiguration()
    return cloudinary.uploader.destroy(publicId, { resource_type: 'image' })
}
