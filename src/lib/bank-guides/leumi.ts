export interface GuideStep {
  step: number
  he: string
  en: string
  icon: string
}

export interface BankGuide {
  bank: string
  steps: GuideStep[]
}

export const leumiGuide: BankGuide = {
  bank: 'leumi',
  steps: [
    {
      step: 1,
      he: 'היכנס לאתר bankleumi.co.il',
      en: 'Go to bankleumi.co.il and log in',
      icon: '🌐',
    },
    {
      step: 2,
      he: 'לחץ על "חשבונות" ובחר את החשבון שלך',
      en: 'Click "Accounts" and select your account',
      icon: '🏦',
    },
    {
      step: 3,
      he: 'לחץ על "תנועות בחשבון"',
      en: 'Click "Account movements"',
      icon: '📋',
    },
    {
      step: 4,
      he: 'בחר טווח תאריכים — 3 חודשים אחרונים מומלץ',
      en: 'Select date range — last 3 months recommended',
      icon: '📅',
    },
    {
      step: 5,
      he: 'לחץ על אייקון האקסל (⬇) בתחתית הרשימה',
      en: 'Click the Excel icon (⬇) at the bottom of the list',
      icon: '⬇️',
    },
  ],
}
