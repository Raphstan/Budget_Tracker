import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { createServerClient } from '@supabase/ssr'

export async function proxy(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)
  const { pathname } = request.nextUrl

  const isPublic =
    pathname === '/' ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/api/webhooks/')

  // Unauthenticated user → redirect to login
  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  // Authenticated user hitting auth pages → redirect to dashboard
  if (user && (pathname === '/auth/login' || pathname === '/auth/signup')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Authenticated user with onboarding not done → redirect to onboarding
  if (user && !isPublic && !pathname.startsWith('/onboarding')) {
    const cookieStore = request.cookies
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll() {},
        },
      }
    )

    const { data: profile } = await supabase
      .from('users')
      .select('onboarding_done')
      .eq('id', user.id)
      .single()

    if (profile && !profile.onboarding_done) {
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding/bank'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
