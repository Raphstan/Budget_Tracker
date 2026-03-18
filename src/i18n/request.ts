import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'
import { routing } from './routing'

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const stored = cookieStore.get('NEXT_LOCALE')?.value
  const locale = routing.locales.includes(stored as (typeof routing.locales)[number])
    ? (stored as (typeof routing.locales)[number])
    : routing.defaultLocale

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  }
})
