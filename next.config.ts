import type { NextConfig } from 'next';
import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb', // Matches MAX_AUDIO_SIZE_MB and MAX_IMAGE_SIZE_MB from config/limits.ts
    },
  },
  // Security headers - separated by route type for flexibility
  async headers() {
    const isDev = process.env.NODE_ENV === 'development';

    // Common security headers for all routes
    const commonHeaders = [
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      },
      {
        key: 'X-Frame-Options',
        value: 'DENY',
      },
      {
        key: 'X-XSS-Protection',
        value: '1; mode=block',
      },
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
      },
    ];

    // Content Security Policy - only in production
    const cspHeader = isDev
      ? []
      : [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js requires unsafe-eval
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              // Future-ready: Add analytics/monitoring domains here
              // "connect-src 'self' https://api.groq.com https://generativelanguage.googleapis.com https://analytics.example.com",
              "connect-src 'self' https://api.groq.com https://generativelanguage.googleapis.com",
              "media-src 'self' blob:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              'upgrade-insecure-requests',
            ].join('; '),
          },
        ];

    return [
      // App routes - strict CSP
      {
        source: '/((?!api).*)', // All routes except /api/*
        headers: [...commonHeaders, ...cspHeader],
      },
      // API routes - relaxed headers (may need CORS in future)
      {
        source: '/api/:path*',
        headers: commonHeaders,
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
