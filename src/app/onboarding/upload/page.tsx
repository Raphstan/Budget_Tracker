'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Suspense } from 'react'
import { FileUploader } from '@/components/FileUploader'

function UploadContent() {
  const t = useTranslations('onboarding')
  const router = useRouter()
  const searchParams = useSearchParams()
  const bank = searchParams.get('bank') ?? 'leumi'

  function handleSuccess() {
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <p className="text-sm text-muted-foreground text-center mb-2">
          {t('step_of', { current: 3, total: 3 })}
        </p>

        <h1 className="text-2xl font-semibold text-center mb-8">
          {t('upload_title')}
        </h1>

        <FileUploader bank={bank} onSuccess={handleSuccess} />
      </div>
    </div>
  )
}

export default function UploadPage() {
  return (
    <Suspense>
      <UploadContent />
    </Suspense>
  )
}
