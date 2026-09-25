import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zihomwe",
  description: "A Zimbabwe civic engagement platform for citizens and local admins.",
  icons: {
    icon: [{ url: "/app_icon.png", type: "image/png" }],
    apple: [{ url: "/app_icon.png" }],
    shortcut: ["/app_icon.png"],
  },
  applicationName: "Zihomwe",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Zihomwe",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#047857",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
