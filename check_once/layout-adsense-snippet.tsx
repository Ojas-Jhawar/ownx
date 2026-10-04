// Not a real route — paste this into app/layout.tsx once you have a real
// AdSense (or other network) client id in NEXT_PUBLIC_ADSENSE_CLIENT.
//
// import Script from "next/script"
//
// Inside RootLayout's <head> (Next 16 lets you render <Script> anywhere in
// the tree and it hoists correctly), add:
//
// {process.env.NEXT_PUBLIC_ADSENSE_CLIENT && (
//   <Script
//     async
//     src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_CLIENT}`}
//     crossOrigin="anonymous"
//     strategy="afterInteractive"
//   />
// )}
//
// Then set in .env.local / your host's env vars:
// NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-xxxxxxxxxxxxxxxx
//
// Until that env var is set, every <AdSlot> renders a harmless placeholder
// box instead — see components/ads/ad-slot.tsx.
export {}
