import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase-server'
import { crawlNaverPriceComparison } from '@/lib/crawler'
import { analyzeTitles } from '@/lib/analysis/title-analyzer'
import { scoreCompetition } from '@/lib/analysis/competition-scorer'

export const maxDuration = 300 // Vercel Fluid Compute 최대 5분

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const body = await req.json()
  const { keyword, topN = 10, projectTitle } = body

  if (!keyword || typeof keyword !== 'string') {
    return NextResponse.json({ error: '키워드를 입력하세요.' }, { status: 400 })
  }

  const adminSupabase = createAdminSupabase()

  // 1. 프로젝트 생성 또는 조회
  const { data: project, error: projectError } = await adminSupabase
    .from('projects')
    .insert({
      user_id: user.id,
      title: projectTitle || `${keyword} 분석`,
      keyword,
    })
    .select()
    .single()

  if (projectError) {
    return NextResponse.json({ error: '프로젝트 생성 실패' }, { status: 500 })
  }

  // 2. 분석 실행 레코드 생성
  const { data: run, error: runError } = await adminSupabase
    .from('analysis_runs')
    .insert({
      project_id: project.id,
      keyword,
      requested_top_n: topN,
      status: 'running',
    })
    .select()
    .single()

  if (runError) {
    return NextResponse.json({ error: '분석 실행 생성 실패' }, { status: 500 })
  }

  try {
    // 3. 데이터 수집 (API 키 있으면 실제, 없으면 데모)
    const { products, isDemoMode } = await crawlNaverPriceComparison(keyword, topN)

    // 4. 경쟁강도 분석
    const competition = scoreCompetition(products)

    // 5. 상품명 분석 (일반 셀러만)
    const normalTitles = products
      .filter(p => !p.isAd && !p.isCatalog)
      .map(p => p.title)
    const titleAnalysis = analyzeTitles(normalTitles)

    // 6. DB 저장
    await adminSupabase
      .from('analysis_runs')
      .update({
        status: 'done',
        ad_ratio: competition.adRatio,
        catalog_ratio: competition.catalogRatio,
        opportunity_score: competition.opportunityScore,
      })
      .eq('id', run.id)

    if (products.length > 0) {
      await adminSupabase.from('scraped_products').insert(
        products.map(p => ({
          run_id: run.id,
          original_rank: p.originalRank,
          effective_rank: p.effectiveRank,
          title: p.title,
          price: p.price,
          review_count: p.reviewCount,
          rating: p.rating,
          seller_count: p.sellerCount,
          shipping_benefit: p.shippingBenefit,
          thumbnail_url: p.thumbnailUrl,
          product_url: p.productUrl,
          is_ad: p.isAd,
          is_catalog: p.isCatalog,
          exclusion_reason: p.exclusionReason,
          raw_payload: p.rawPayload,
        }))
      )
    }

    return NextResponse.json({
      runId: run.id,
      projectId: project.id,
      products,
      competition,
      titleAnalysis,
      isDemoMode,
    })
  } catch (err) {
    await adminSupabase
      .from('analysis_runs')
      .update({ status: 'error', error_message: String(err) })
      .eq('id', run.id)

    console.error('[analyze] 실패:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const runId = req.nextUrl.searchParams.get('runId')
  if (!runId) return NextResponse.json({ error: 'runId 필요' }, { status: 400 })

  // 3개 쿼리 병렬 실행 (순차 대비 ~200ms 단축)
  const [
    { data: products },
    { data: run },
    { data: recs },
  ] = await Promise.all([
    supabase.from('scraped_products').select('*').eq('run_id', runId).order('original_rank'),
    supabase.from('analysis_runs').select('*, projects(keyword, title)').eq('id', runId).single(),
    supabase.from('title_recommendations').select('*').eq('run_id', runId),
  ])

  return NextResponse.json({ run, products, recommendations: recs })
}
