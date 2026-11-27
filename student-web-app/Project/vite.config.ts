import { defineConfig, type Connect } from 'vite'
import react from '@vitejs/plugin-react'
import handleStudentPortal from './api/student-portal.mjs'

const studentPortalMiddleware: Connect.NextHandleFunction = (req, res, next) => {
  if (req.url?.split('?')[0] === '/api/student-portal') {
    void handleStudentPortal(req, res)
  } else {
    next()
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), {
    name: 'student-portal-api',
    configureServer(server) {
      server.middlewares.use(studentPortalMiddleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(studentPortalMiddleware)
    },
  }],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
})
