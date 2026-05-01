import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import Navbar from "@/components/Navbar";
import { Toaster } from "sonner";

const geist = Geist({ variable: "--font-sans", subsets: ["latin"] });

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.heritage-cooperative.com.ng";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#059669",
};

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Heritage Multipurpose Cooperative Society | Save Daily. Build Wealth. Access Loans.",
    template: "%s | Heritage Cooperative",
  },
  description:
    "Heritage Multipurpose Cooperative Society is a legally registered Nigerian cooperative. Save daily for 90 days and unlock loans up to ₦2,000,000. Secure payments via Squadco.",
  keywords: [
    "cooperative society Nigeria",
    "daily savings Nigeria",
    "cooperative loan Nigeria",
    "Heritage Cooperative",
    "savings plan Nigeria",
    "loan access cooperative",
    "multipurpose cooperative",
    "heritage cooperative society",
  ],
  authors: [{ name: "Heritage Multipurpose Cooperative Society", url: BASE_URL }],
  creator: "Heritage Multipurpose Cooperative Society",
  publisher: "Heritage Multipurpose Cooperative Society",
  category: "finance",
  openGraph: {
    title: "Heritage Multipurpose Cooperative Society | Save Daily. Build Wealth. Access Loans.",
    description:
      "Save daily for 90 days and unlock loans up to ₦2,000,000. Join 500+ members in Nigeria's trusted cooperative society.",
    url: BASE_URL,
    siteName: "Heritage Cooperative",
    type: "website",
    locale: "en_NG",
    images: [
      {
        url: "/opengraph-image.jpg",
        width: 1200,
        height: 630,
        alt: "Heritage Multipurpose Cooperative Society – Save Daily. Build Wealth. Access Loans.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Heritage Multipurpose Cooperative Society",
    description: "Save daily for 90 days. Access loans up to ₦2,000,000. Join Nigeria's trusted cooperative.",
    images: ["/opengraph-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  alternates: {
    canonical: BASE_URL,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${BASE_URL}/#organization`,
      name: "Heritage Multipurpose Cooperative Society",
      url: BASE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}/icon.svg`,
      },
      description:
        "A legally registered Nigerian multipurpose cooperative society offering daily savings plans and loans up to ₦2,000,000.",
      foundingLocation: {
        "@type": "Place",
        addressCountry: "NG",
      },
      areaServed: "NG",
      knowsAbout: ["cooperative savings", "microfinance", "daily savings", "cooperative loans"],
    },
    {
      "@type": "WebSite",
      "@id": `${BASE_URL}/#website`,
      url: BASE_URL,
      name: "Heritage Cooperative",
      description: "Save Daily. Build Wealth. Access Loans.",
      publisher: { "@id": `${BASE_URL}/#organization` },
      inLanguage: "en-NG",
    },
    {
      "@type": "FinancialService",
      "@id": `${BASE_URL}/#service`,
      name: "Heritage Multipurpose Cooperative Society",
      url: BASE_URL,
      image: `${BASE_URL}/opengraph-image.jpg`,
      description: "Daily savings cooperative offering loans up to ₦2,000,000 for registered members in Nigeria.",
      priceRange: "₦500 – ₦10,000/day",
      address: {
        "@type": "PostalAddress",
        addressCountry: "NG",
      },
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.9",
        reviewCount: "500",
      },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG" className={geist.variable} suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-emerald-600 focus:text-white focus:rounded-md focus:outline-none"
        >
          Skip to main content
        </a>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <ClerkProvider>
            <ConvexClientProvider>
              <Navbar />
              <main id="main-content">{children}</main>
              <Toaster position="top-right" richColors />
            </ConvexClientProvider>
          </ClerkProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
