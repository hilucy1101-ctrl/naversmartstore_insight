// 광고 상품 탐지 규칙
// 네이버 DOM 변경 시 이 파일의 셀렉터/텍스트만 수정하면 됩니다.

export const AD_SELECTORS = [
  '.ad_badge',
  '[class*="ad_badge"]',
  '[class*="adBadge"]',
  '.product_ad',
  '[data-ad="true"]',
  '[data-is-ad]',
]

export const AD_TEXT_PATTERNS = [
  '광고',
  'AD',
  'Sponsored',
  'sponsored',
  '파워링크',
]

export const AD_CLASS_PATTERNS = [
  'power_link',
  'powerLink',
  'ad_wrap',
  'adWrap',
]

export function detectAd(element: { innerHTML: string; className: string; textContent: string }): {
  isAd: boolean
  reason: string | null
} {
  // 클래스 기반 탐지
  for (const pattern of AD_CLASS_PATTERNS) {
    if (element.className.includes(pattern)) {
      return { isAd: true, reason: `광고 클래스 감지: ${pattern}` }
    }
  }

  // 텍스트 패턴 기반 탐지
  for (const text of AD_TEXT_PATTERNS) {
    if (element.textContent.includes(text)) {
      return { isAd: true, reason: `광고 텍스트 감지: "${text}"` }
    }
  }

  return { isAd: false, reason: null }
}
