import { v2 as cloudinary } from 'cloudinary'

const requiredKeys = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']

export function configureCloudinary() {
    const missingKeys = requiredKeys.filter(key => !process.env[key])
    if (missingKeys.length) throw new Error(`Missing Cloudinary configuration: ${missingKeys.join(', ')}`)

    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    })
}

export function uploadAvatar(buffer) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: 'convo/avatars', resource_type: 'image' },
            (error, result) => error ? reject(error) : resolve(result),
        )
        stream.end(buffer)
    })
}

export function deleteAvatar(publicId) {
    return cloudinary.uploader.destroy(publicId, { resource_type: 'image' })
}
