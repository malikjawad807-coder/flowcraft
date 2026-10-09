'use client';

import { useRouter } from 'next/navigation';
import { HeroPage } from '@/components/hero/HeroPage';

export default function HeroRoutePage() {
  const router = useRouter();

  return (
    <HeroPage
      onLaunchBuilder={() => router.push('/')}
      onOpenExtractor={() => router.push('/')}
      onOpenAiAssistant={() => router.push('/')}
      onOpenSettings={() => router.push('/')}
      onLoadTemplate={() => router.push('/')}
    />
  );
}
