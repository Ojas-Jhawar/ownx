/** @type {import('next').NextConfig} */
const nextConfig = {
  // Re-enabled: this was set to `true`, which was silently hiding two real
  // type errors (see lib/anthropic.ts's PDF content-block cast and
  // app/actions/profile.ts's return type) rather than just suppressing
  // noise. If a future change introduces a genuine type error, `next build`
  // will now fail loudly instead of shipping it. If you hit a false
  // positive from a library's types, prefer a narrow, documented `as any`
  // at that call site (see lib/anthropic.ts for the pattern) over flipping
  // this back to `true`.
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
