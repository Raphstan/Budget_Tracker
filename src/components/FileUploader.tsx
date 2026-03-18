'use client'

import { useState, useCallback } from 'react'
import { useDropzone, type FileRejection } from 'react-dropzone'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'

const ACCEPTED_TYPES = {
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'text/csv': ['.csv'],
}

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

type State =
  | { status: 'idle' }
  | { status: 'selected'; file: File }
  | { status: 'uploading' }
  | { status: 'success'; transactionCount: number }
  | { status: 'error'; message: string }

interface FileUploaderProps {
  bank: string
  onSuccess?: (transactionCount: number) => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileUploader({ bank, onSuccess }: FileUploaderProps) {
  const t = useTranslations('onboarding')
  const tErrors = useTranslations('errors')
  const [state, setState] = useState<State>({ status: 'idle' })

  const onDrop = useCallback((accepted: File[], rejected: FileRejection[]) => {
    if (rejected.length > 0) {
      const err = rejected[0].errors[0]
      if (err.code === 'file-too-large') {
        setState({ status: 'error', message: tErrors('file_size') })
      } else {
        setState({ status: 'error', message: tErrors('file_type') })
      }
      return
    }
    if (accepted.length > 0) {
      setState({ status: 'selected', file: accepted[0] })
    }
  }, [tErrors])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_SIZE,
    multiple: false,
    disabled: state.status === 'uploading' || state.status === 'success',
  })

  async function handleUpload() {
    if (state.status !== 'selected') return
    setState({ status: 'uploading' })

    const formData = new FormData()
    formData.append('file', state.file)

    try {
      const res = await fetch(`/api/upload?bank=${bank}`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const msg = body?.error ?? tErrors('generic')
        setState({ status: 'error', message: msg })
        return
      }

      const data = await res.json()
      setState({ status: 'success', transactionCount: data.transactionCount })
      onSuccess?.(data.transactionCount)
    } catch {
      setState({ status: 'error', message: tErrors('generic') })
    }
  }

  function reset() {
    setState({ status: 'idle' })
  }

  // Success state
  if (state.status === 'success') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-8 text-center">
        <span className="text-4xl" aria-hidden="true">✅</span>
        <p className="font-medium">
          {t('transactions_found', { count: state.transactionCount })}
        </p>
      </div>
    )
  }

  // Error state
  if (state.status === 'error') {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-destructive bg-destructive/5 p-8 text-center">
        <span className="text-4xl" aria-hidden="true">⚠️</span>
        <p className="text-sm text-destructive font-medium">{state.message}</p>
        <Button variant="outline" onClick={reset}>
          {t('try_again')}
        </Button>
      </div>
    )
  }

  // File selected state
  if (state.status === 'selected') {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-center">
        <span className="text-4xl" aria-hidden="true">📄</span>
        <div>
          <p className="font-medium text-sm truncate max-w-xs">{state.file.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{formatBytes(state.file.size)}</p>
        </div>
        <div className="flex gap-2 w-full">
          <Button variant="outline" className="flex-1" onClick={reset}>
            {t('try_again')}
          </Button>
          <Button className="flex-1" onClick={handleUpload}>
            {t('upload_analyze')}
          </Button>
        </div>
      </div>
    )
  }

  // Uploading state
  if (state.status === 'uploading') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-8 text-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{t('analyzing')}</p>
      </div>
    )
  }

  // Idle / drop zone state
  return (
    <div
      {...getRootProps()}
      className={[
        'flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-12 text-center cursor-pointer transition-colors',
        isDragActive
          ? 'border-primary bg-primary/5'
          : 'border-border bg-card hover:border-primary/50',
      ].join(' ')}
    >
      <input {...getInputProps()} />
      <span className="text-4xl" aria-hidden="true">📂</span>
      <div>
        <p className="font-medium text-sm">
          {isDragActive ? t('drop_active') : t('upload_cta')}
        </p>
        <p className="text-xs text-muted-foreground mt-1">XLS · XLSX · CSV · max 10 MB</p>
      </div>
    </div>
  )
}
