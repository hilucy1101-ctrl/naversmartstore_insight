import { fetchNaverShoppingApi, getMockProducts } from './naver-api'

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
  const hasApiKeys = !!(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET)

  if (!hasApiKeys) {
    // API 키 없을 때 데모 데이터로 UI 테스트 가능하게 함
    return { products: getMockProducts(keyword, topN), isDemoMode: true }
  }

  const products = await fetchNaverShoppingApi(keyword, topN)
  return { products, isDemoMode: false }
}
