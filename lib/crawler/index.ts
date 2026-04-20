import { fetchNaverShoppingApi, getMockProducts } from './naver-api'
import { scrapeNaverShoppingPage } from './playwright-scraper'

export interface ScrapedProduct {
  originalRank: number
  effectiveRank: number | null
  title: string
  price: number | null
  reviewCount: number
  rating: number | null
  sellerCount: number
  shippingBenefit: string
  thumbnailUrl: string
  productUrl: string
  isAd: boolean
  isCatalog: boolean
  exclusionReason: string | null
  rawPayload: Record<string, unknown>
}

export async function crawlNaverPriceComparison(
  keyword: string,
  topN: number = 10
): Promise<{ products: ScrapedProduct[]; isDemoMode: boolean }> {
  // 1순위: 네이버 공식 쇼핑 검색 API
  const hasApiKey = !!(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET)
  if (hasApiKey) {
    try {
      const products = await fetchNaverShoppingApi(keyword, topN)
      return { products, isDemoMode: false }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[crawler] 네이버 API 실패, Playwright로 폴백: ${message}`)
    }
  }

  // 2순위: Playwright 스크래핑
  try {
    const products = await scrapeNaverShoppingPage(keyword, topN)
    return { products, isDemoMode: false }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[crawler] Playwright 실패, 데모 모드로 폴백: ${message}`)
    return { products: getMockProducts(keyword, topN), isDemoMode: true }
  }
}
