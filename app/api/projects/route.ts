import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const { data: projects } = await supabase
    .from('projects')
    .select('*, analysis_runs(id, status, created_at, ad_ratio, catalog_ratio, opportunity_score)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ projects })
}
