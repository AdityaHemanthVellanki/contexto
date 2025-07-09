import type { Metadata } from "next";
import { Inter, Poppins } from 'next/font/google';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider } from '@/context/AuthContext';
import AppShell from '@/components/layout/AppShell';
import { ToastProvider } from '@/components/ui/toast';
import ApiErrorHandler from '@/components/layout/ApiErrorHandler';
import { initAuthListeners } from '@/lib/auth-interceptor';
import "./globals.css";

// Initialize auth listeners as early as possible
if (typeof window !== 'undefined') {
  initAuthListeners();
}

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const poppins = Poppins({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: 'Contexto - Your data. Your context. No code.',
  description: 'Build & Deploy AI Context Pipelines—No Code Required',
  keywords: 'AI, context, no-code, MCP, Model Context Protocol, vector database',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `
            // Prevent Phantom wallet extension from overriding window.solana
            Object.defineProperty(window, 'solana', {
              value: undefined,
              configurable: false,
              writable: false
            });
          `
        }} />
      </head>
      <body className={`${inter.variable} ${poppins.variable} font-sans antialiased bg-gray-50 dark:bg-gray-900 dark:text-white`}>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <ApiErrorHandler>
                <AppShell>
                  {children}
                </AppShell>
              </ApiErrorHandler>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
