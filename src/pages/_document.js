import { Html, Head, Main, NextScript } from 'next/document'
import { Analytics } from '@vercel/analytics/react';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Page Title */}
        <title>Open-Audio TTS</title>
        
        {/* Favicon */}
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon.png" />
        
        {/* Meta Tags for SEO */}
        <meta name="description" content="An KaniTTS-powered Text-to-Speech tool." />
        
        {/* Add additional meta tags as needed */}
      </Head>
      <body>
        <Main />
        <NextScript />
        <Analytics />

      </body>
    </Html>
  )
}
