import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FlowCraft | Visual AI Workflow Automation Studio',
  description: 'Next-generation visual node workflow engine inspired by n8n. Connect file triggers, input forms, OpenAI reasoning, and Gmail dispatches seamlessly.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full">
      <head>
        <link rel="preload" href="/hero-video.mp4" as="video" type="video/mp4" />
      </head>
      <body className="h-full bg-[#0b0f17] text-slate-100 antialiased selection:bg-rose-500/30 selection:text-rose-200">
        {children}
      </body>
    </html>
  );
}
