import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import helmet from 'helmet'
import { Server } from 'socket.io'
import { connectDatabase } from './config/db.js'
import authRoutes from './routes/authRoutes.js'
import userRoutes from './routes/userRoutes.js'
import chatRoutes from './routes/chatRoutes.js'
import messageRoutes from './routes/messageRoutes.js'
import groupRoutes from './routes/groupRoutes.js'
import storyRoutes from './routes/storyRoutes.js'
import stickerRoutes from './routes/stickerRoutes.js'
import { configureSocket } from './socket/socket.js'
import { errorHandler, notFound } from './middleware/errorMiddleware.js'
import { configureCloudinary } from './config/cloudinary.js'

// Load the backend configuration regardless of the directory used to start Node.
// The previous path pointed into the frontend source tree, so the API ignored
// backend/.env and authentication could not access its database/JWT settings.
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') })
configureCloudinary()

const app = express()
const server = http.createServer(app)
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map(origin => origin.trim())
const io = new Server(server, { cors: { origin: allowedOrigins, credentials: true } })
app.set('io', io)

app.use(helmet())
app.use(cors({ origin: allowedOrigins, credentials: true }))
app.use(express.json({ limit: '1mb' }))
app.get('/health', (req, res) => res.json({ status: 'ok' }))
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/chats', chatRoutes)
app.use('/api/messages', messageRoutes)
app.use('/api/groups', groupRoutes)
app.use('/api/stories', storyRoutes)
app.use('/api/stickers', stickerRoutes)
app.use(notFound)
app.use(errorHandler)
configureSocket(io)

const port = Number(process.env.PORT || 5000)
if (process.env.NODE_ENV !== 'test') {
  connectDatabase().then(() => server.listen(port, () => console.log(`API listening on http://localhost:${port}`))).catch(error => {
    console.error('Unable to start server:', error.message)
    process.exitCode = 1
  })
}

export { app, io, server }
