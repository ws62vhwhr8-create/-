import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: __dirname,
  },
  // 대용량 파일 업로드를 위해 Route Handler 요청 바디 크기 제한 상향
  experimental: {
    serverActions: {
      bodySizeLimit: '250mb',
    },
  },
}

export default nextConfig
