import { scrapeNaverShoppingPage } from './playwright-scraper'
import { getMockProducts } from './naver-api'

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
  try {
    const products = await scrapeNaverShoppingPage(keyword, topN)
    return { products, isDemoMode: false }
  } catch (error) {
    // 스크래핑 실패 시 데모 데이터로 폴백
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[crawler] Playwright 스크래핑 실패, 데모 모드로 폴백: ${message}`)
    return { products: getMockProducts(keyword, topN), isDemoMode: true }
  }
}
