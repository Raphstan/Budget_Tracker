'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'

interface Bank {
  id: string
  nameKey: string
  icon: string
  available: boolean
}

const BANKS: Bank[] = [
  { id: 'leumi',     nameKey: 'leumi',     icon: '🏦', available: true  },
  { id: 'hapoalim',  nameKey: 'hapoalim',  icon: '🏦', available: false },
  { id: 'discount',  nameKey: 'discount',  icon: '🏦', available: false },
  { id: 'mizrahi',   nameKey: 'mizrahi',   icon: '🏦', available: false },
  { id: 'yahav',     nameKey: 'yahav',     icon: '🏦', available: false },
  { id: 'jerusalem', nameKey: 'jerusalem', icon: '🏦', available: false },
]

export default function BankSelectorPage() {
  const t = useTranslations('onboarding')
  const router = useRouter()

  function handleBankClick(bank: Bank) {
    if (!bank.available) return
    router.push(`/onboarding/export?bank=${bank.id}`)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-12">
      <h1 className="text-2xl font-semibold text-center mb-8">
        {t('select_bank')}
      </h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full max-w-lg">
        {BANKS.map((bank) => (
          <BankCard
            key={bank.id}
            bank={bank}
            name={t(`banks.${bank.nameKey}`)}
            comingSoonLabel={t('coming_soon')}
            onClick={() => handleBankClick(bank)}
          />
        ))}
      </div>
    </div>
  )
}

function BankCard({
  bank,
  name,
  comingSoonLabel,
  onClick,
}: {
  bank: Bank
  name: string
  comingSoonLabel: string
  onClick: () => void
}) {
  if (bank.available) {
    return (
      <button
        onClick={onClick}
        className="relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-border bg-card p-6 text-card-foreground shadow-sm transition-all hover:border-primary hover:shadow-md active:scale-95 cursor-pointer"
      >
        <BankLogo icon={bank.icon} id={bank.id} />
        <span className="text-sm font-medium">{name}</span>
      </button>
    )
  }

  return (
    <div className="relative flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-muted/40 p-6 text-muted-foreground cursor-not-allowed opacity-60">
      <BankLogo icon={bank.icon} id={bank.id} />
      <span className="text-sm font-medium">{name}</span>
      <Badge variant="secondary" className="absolute top-2 end-2 text-xs px-1.5 py-0">
        {comingSoonLabel}
      </Badge>
    </div>
  )
}

function BankLogo({ icon, id }: { icon: string; id: string }) {
  // Placeholder — swap with <Image> when real logos are available
  // Structure: data-bank-id attr for easy targeting
  return (
    <div
      data-bank-id={id}
      className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-2xl"
      aria-hidden="true"
    >
      {icon}
    </div>
  )
}
