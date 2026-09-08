import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "sweetalert2/dist/sweetalert2.min.css";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://infinityshop.com.ar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "InfinityShop", template: "%s | InfinityShop" },
  description: "Plataforma ecommerce multi-tenant para gestionar y hacer crecer tu tienda.",
  applicationName: "InfinityShop",
  openGraph: {
    type: "website",
    locale: "es_AR",
    siteName: "InfinityShop",
    title: "InfinityShop — Tu tienda online, simple y escalable",
    description: "Creá y administrá tu ecommerce con catálogo, pagos, pedidos y herramientas para crecer.",
    images: [{ url: "/infinityshop-logo.png", alt: "InfinityShop" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "InfinityShop — Tu tienda online, simple y escalable",
    description: "Creá y administrá tu ecommerce con catálogo, pagos, pedidos y herramientas para crecer.",
    images: ["/infinityshop-logo.png"],
  },
  icons: {
    icon: "/infinityshop-mark.png",
    shortcut: "/infinityshop-mark.png",
    apple: "/infinityshop-mark.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
