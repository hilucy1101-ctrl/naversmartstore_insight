import { chromium } from 'playwright'
import type { ScrapedProduct } from './index'

// 페이지에서 추출한 원시 데이터 구조
interface RawProductData {
  title: string
  price: string
  thumbnailUrl: string
  productUrl: string
  isAd: boolean
  isCatalog: boolean
  reviewCount: string
  rating: string
}

// 숫자 문자열에서 쉼표/원화 기호 제거 후 정수 변환
function parseNumber(str: string): number | null {
  const cleaned = str.replace(/[^0-9]/g, '')
  if (!cleaned) return null
  const num = parseInt(cleaned, 10)
  return isNaN(num) ? null : num
}

// 소수점 포함 숫자 파싱 (평점용)
function parseFloatSafe(str: string): number | null {
  const cleaned = str.replace(/[^0-9.]/g, '')
  if (!cleaned) return null
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

export async function scrapeNaverShoppingPage(
  keyword: string,
  topN: number = 10
): Promise<ScrapedProduct[]> {
  const url = `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(keyword)}&sort=rel`

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  })

  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      locale: 'ko-KR',
      extraHTTPHeaders: {
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    })

    // webdriver 플래그 제거
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false })
    })

    const page = await context.newPage()

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })

    // 상품 목록 컨테이너 대기 (다중 폴백 셀렉터)
    const containerSelectors = [
      '[id^="listProductInfo"]',
      'li[class*="product_item"]',
      'li[class*="_item"]',
    ]

    let containerFound = false
    for (const sel of containerSelectors) {
      try {
        await page.waitForSelector(sel, { timeout: 15_000 })
        containerFound = true
        break
      } catch {
        // 다음 셀렉터 시도
      }
    }

    if (!containerFound) {
      throw new Error('상품 목록 컨테이너를 찾을 수 없습니다.')
    }

    // page.evaluate 내부: 원시 데이터만 추출 (복잡한 로직 최소화)
    const rawProducts: RawProductData[] = await page.evaluate(() => {
      // 상품 li 요소 탐색 (다중 폴백)
      let items: Element[] = []

      const containerEl = document.querySelector('[id^="listProductInfo"]')
      if (containerEl) {
        items = Array.from(containerEl.querySelectorAll('li'))
      }

      if (items.length === 0) {
        items = Array.from(document.querySelectorAll('li[class*="product_item"]'))
      }

      if (items.length === 0) {
        items = Array.from(document.querySelectorAll('li[class*="_item"]'))
      }

      const results: RawProductData[] = []

      for (const li of items) {
        // 광고 탐지: badge 요소에서 "광고" 텍스트 탐색
        const badgeCandidates = Array.from(
          li.querySelectorAll('[class*="ad_badge"], em, span')
        )
        const isAd = badgeCandidates.some((el) => el.textContent?.trim() === '광고')

        // 상품 링크 탐색 (첫 번째 a 태그)
        const allLinks = Array.from(li.querySelectorAll('a[href]')) as HTMLAnchorElement[]
        const productUrl = allLinks.length > 0 ? allLinks[0].href : ''

        // 카탈로그 탐지: href에 /catalog/ 포함
        const isCatalog = productUrl.includes('/catalog/')

        // 제목: 가장 긴 텍스트를 가진 a 또는 strong 태그
        const titleCandidates = Array.from(li.querySelectorAll('a, strong'))
        let title = ''
        let maxLen = 0
        for (const el of titleCandidates) {
          const text = el.textContent?.trim() ?? ''
          if (text.length > maxLen) {
            maxLen = text.length
            title = text
          }
        }

        // 가격: [class*="price_num"] 우선, 없으면 숫자 패턴 탐색
        let price = ''
        const priceEl = li.querySelector('[class*="price_num"]')
        if (priceEl) {
          price = priceEl.textContent?.trim() ?? ''
        } else {
          const numEls = Array.from(li.querySelectorAll('span, strong, em'))
          for (const el of numEls) {
            const text = el.textContent?.trim() ?? ''
            if (/^[\d,]+원?$/.test(text) && text.replace(/[^0-9]/g, '').length >= 3) {
              price = text
              break
            }
          }
        }

        // 썸네일: 첫 번째 img
        const imgEl = li.querySelector('img') as HTMLImageElement | null
        const thumbnailUrl = imgEl?.src ?? imgEl?.getAttribute('data-src') ?? ''

        // 리뷰 수
        let reviewCount = '0'
        const reviewEl = li.querySelector('[class*="review"], [class*="count"]')
        if (reviewEl) {
          reviewCount = reviewEl.textContent?.replace(/[^0-9]/g, '') ?? '0'
        }

        // 평점
        let rating = ''
        const ratingEl = li.querySelector('[class*="rating"], [class*="grade"]')
        if (ratingEl) {
          rating = ratingEl.textContent?.trim() ?? ''
        }

        if (!title) continue

        results.push({
          title,
          price,
          thumbnailUrl,
          productUrl,
          isAd,
          isCatalog,
          reviewCount: reviewCount || '0',
          rating,
        })
      }

      return results
    })

    if (rawProducts.length === 0) {
      throw new Error(`키워드 "${keyword}" 검색 결과를 추출하지 못했습니다.`)
    }

    // originalRank, effectiveRank 계산 및 ScrapedProduct 변환
    let effectiveRank = 0
    let individualCount = 0
    const result: ScrapedProduct[] = []

    for (let i = 0; i < rawProducts.length; i++) {
      const raw = rawProducts[i]
      const originalRank = i + 1
      const excluded = raw.isAd || raw.isCatalog

      let exclusionReason: string | null = null
      if (raw.isAd) exclusionReason = '광고 상품'
      else if (raw.isCatalog) exclusionReason = '카탈로그 묶음'

      if (!excluded) {
        individualCount++
        effectiveRank++
      }

      result.push({
        originalRank,
        effectiveRank: excluded ? null : effectiveRank,
        title: raw.title,
        price: parseNumber(raw.price),
        reviewCount: parseNumber(raw.reviewCount) ?? 0,
        rating: parseFloatSafe(raw.rating),
        sellerCount: raw.isCatalog ? 3 : 1,
        shippingBenefit: '',
        thumbnailUrl: raw.thumbnailUrl,
        productUrl: raw.productUrl,
        isAd: raw.isAd,
        isCatalog: raw.isCatalog,
        exclusionReason,
        rawPayload: {
          title: raw.title,
          price: raw.price,
          productUrl: raw.productUrl,
        },
      })

      // topN개의 일반 상품이 채워지면 중단
      if (individualCount >= topN) break
    }

    return result
  } finally {
    await browser.close()
  }
}
