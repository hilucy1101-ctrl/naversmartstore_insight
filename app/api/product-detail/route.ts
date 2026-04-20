import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { analyzeMultipleProductDetails } from '@/lib/analyzer/product-detail-scraper'

export const maxDuration = 300

interface ProductInput {
  id: string
  title: string
  price: number | null
  thumbnailUrl: string
  productUrl: string
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const body = await req.json()
  const { keyword, products } = body as { keyword: string; products: ProductInput[] }

  if (!keyword || !Array.isArray(products) || products.length === 0) {
    return NextResponse.json({ error: '키워드와 상품 목록이 필요합니다.' }, { status: 400 })
  }

  if (products.length > 10) {
    return NextResponse.json({ error: '최대 10개까지 분석 가능합니다.' }, { status: 400 })
  }

  const result = await analyzeMultipleProductDetails(keyword, products)

  const analyses = result.map((analysis, i) => ({ id: products[i].id, ...analysis }))

  return NextResponse.json({ analyses })
}
