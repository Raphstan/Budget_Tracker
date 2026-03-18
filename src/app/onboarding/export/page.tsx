'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { leumiGuide } from '@/lib/bank-guides/leumi'
import type { BankGuide } from '@/lib/bank-guides/leumi'
import { Suspense } from 'react'

const GUIDES: Record<string, BankGuide> = {
  leumi: leumiGuide,
}

function ExportGuideContent() {
  const t = useTranslations('onboarding')
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const bank = searchParams.get('bank') ?? 'leumi'
  const guide = GUIDES[bank] ?? leumiGuide

  function handleContinue() {
    router.push(`/onboarding/upload?bank=${bank}`)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        {/* Progress indicator */}
        <p className="text-sm text-muted-foreground text-center mb-2">
          {t('step_of', { current: 2, total: 3 })}
        </p>

        <h1 className="text-2xl font-semibold text-center mb-8">
          {t('export_title')}
        </h1>

        {/* Step list */}
        <ol className="space-y-4 mb-10">
          {guide.steps.map((step) => (
            <li
              key={step.step}
              className="flex items-start gap-4 rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <span className="text-2xl leading-none mt-0.5" aria-hidden="true">
                {step.icon}
              </span>
              <div className="flex-1 min-w-0">
                <span className="block text-xs font-medium text-muted-foreground mb-0.5">
                  {t('step_of', { current: step.step, total: guide.steps.length })}
                </span>
                <p className="text-sm font-medium leading-snug">
                  {locale === 'he' ? step.he : step.en}
                </p>
              </div>
            </li>
          ))}
        </ol>

        {/* CTA */}
        <Button className="w-full" size="lg" onClick={handleContinue}>
          {t('downloaded_file')}
          <span className="ms-2" aria-hidden="true">←</span>
        </Button>
      </div>
    </div>
  )
}

export default function ExportGuidePage() {
  return (
    <Suspense>
      <ExportGuideContent />
    </Suspense>
  )
}
