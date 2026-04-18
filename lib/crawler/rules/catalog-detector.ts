// 브랜드 카탈로그 묶음 상품 탐지 규칙
// 네이버 DOM 변경 시 이 파일의 셀렉터/텍스트만 수정하면 됩니다.

export const CATALOG_SELECTORS = [
  '.catalog_product',
  '[class*="catalog"]',
  '.brand_catalog',
  '[class*="brandCatalog"]',
  '.multi_seller',
  '[class*="multiSeller"]',
]

export const CATALOG_TEXT_PATTERNS = [
  '판매처 보기',
  '최저가 보기',
  '판매처',
]

// 판매처 수가 이 값 이상이면 카탈로그로 판단
export const CATALOG_SELLER_COUNT_THRESHOLD = 3

export const CATALOG_CLASS_PATTERNS = [
  'catalog',
  'multi_seller',
  'multiSeller',
  'brand_store',
  'brandStore',
]

export function detectCatalog(element: {
  innerHTML: string
  className: string
  textContent: string
  sellerCount?: number
}): {
  isCatalog: boolean
  reason: string | null
} {
  // 클래스 기반 탐지
  for (const pattern of CATALOG_CLASS_PATTERNS) {
    if (element.className.includes(pattern)) {
      return { isCatalog: true, reason: `카탈로그 클래스 감지: ${pattern}` }
    }
  }

  // 텍스트 패턴 기반 탐지
  for (const text of CATALOG_TEXT_PATTERNS) {
    if (element.textContent.includes(text)) {
      return { isCatalog: true, reason: `카탈로그 텍스트 감지: "${text}"` }
    }
  }

  // 판매처 수 기반 탐지 (다수 판매처 묶음)
  if (element.sellerCount && element.sellerCount >= CATALOG_SELLER_COUNT_THRESHOLD) {
    return {
      isCatalog: true,
      reason: `판매처 ${element.sellerCount}개 (${CATALOG_SELLER_COUNT_THRESHOLD}개 이상 = 카탈로그)`,
    }
  }

  return { isCatalog: false, reason: null }
}
