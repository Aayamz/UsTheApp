import type { Metadata, Viewport } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
  preload: false,
});

export const metadata: Metadata = {
  title: "U& — Couples Companion",
  description: "A quiet, intimate space built just for the two of you.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "U&",
  },
  icons: {
    apple: '/apple-touch-icon.png',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#1F1324",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={cn("h-full dark select-none", spaceGrotesk.variable)}
      style={{ colorScheme: "dark" }}
    >
      <body className="h-full w-full bg-[#1F1324] text-[#F6EFE9] font-sans antialiased overflow-hidden flex flex-col">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
