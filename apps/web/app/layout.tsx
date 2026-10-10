import type { Metadata } from 'next';
import { AuthProvider } from '@/context/AuthContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'FlowCart | Visual AI Workflow Automation Studio',
  description: 'Next-generation visual node workflow engine. Connect triggers, forms, AI models, and email dispatches seamlessly.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full">
      <body className="h-full bg-bg text-text antialiased selection:bg-red/30 selection:text-text font-sans">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
