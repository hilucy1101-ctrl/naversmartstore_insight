import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase-server'
import { generateTitleRecommendations } from '@/lib/ai/recommend'
import { analyzeTitles } from '@/lib/analysis/title-analyzer'
import { scoreCompetition } from '@/lib/analysis/competition-scorer'
import type { ScrapedProduct } from '@/lib/crawler'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const body = await req.json()
  const { runId, ...userInput } = body

  if (!runId) return NextResponse.json({ error: 'runId 필요' }, { status: 400 })

  // 해당 run의 상품 데이터 조회
  const { data: products } = await supabase
    .from('scraped_products')
    .select('*')
    .eq('run_id', runId)

  if (!products || products.length === 0) {
    return NextResponse.json({ error: '분석 데이터가 없습니다.' }, { status: 404 })
  }

  const normalTitles = products.filter(p => !p.is_ad && !p.is_catalog).map(p => p.title)
  const titleAnalysis = analyzeTitles(normalTitles)
  const competition = scoreCompetition(
    products.map(p => ({
      ...p,
      isAd: p.is_ad,
      isCatalog: p.is_catalog,
      reviewCount: p.review_count,
      sellerCount: p.seller_count,
      shippingBenefit: p.shipping_benefit,
      thumbnailUrl: p.thumbnail_url,
      productUrl: p.product_url,
      originalRank: p.original_rank,
      effectiveRank: p.effective_rank,
      exclusionReason: p.exclusion_reason,
      rawPayload: p.raw_payload,
    })) as ScrapedProduct[]
  )

  const { data: run } = await supabase
    .from('analysis_runs')
    .select('keyword')
    .eq('id', runId)
    .single()

  const recommendations = await generateTitleRecommendations(
    { keyword: run?.keyword || '', ...userInput },
    titleAnalysis,
    competition
  )

  // DB 저장
  const adminSupabase = createAdminSupabase()
  await adminSupabase.from('title_recommendations').insert(
    recommendations.map(r => ({
      run_id: runId,
      rec_type: r.type,
      title_text: r.title,
      rationale: r.rationale,
    }))
  )

  return NextResponse.json({ recommendations })
}
