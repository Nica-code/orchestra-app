import type { Metadata } from "next";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: 'Callscade — Automate Substitute Musician Outreach',
  description:
    'Find substitute musicians faster. Callscade automates ranked email outreach so orchestra managers fill positions in minutes, not hours.',
  openGraph: {
    title: 'Callscade — Automate Substitute Musician Outreach',
    description:
      'Find substitute musicians faster. Callscade automates ranked email outreach so orchestra managers fill positions in minutes, not hours.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-50 text-slate-900`}>
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
