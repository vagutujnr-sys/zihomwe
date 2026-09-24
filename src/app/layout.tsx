import type { Metadata } from "next";
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
