import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Armenia Services Marketplace",
  description: "Armenia-only services marketplace",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL@24,400,0&display=swap" rel="stylesheet" />
      </head>
      <body className="flex min-h-screen flex-col bg-white font-display text-slate-900 antialiased">
        <AuthProvider>
          <Nav />
          <main className="flex-1 px-4 py-8">{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
