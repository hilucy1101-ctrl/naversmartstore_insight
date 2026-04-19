import type { ScrapedProduct } from './index'

interface NaverShopItem {
  title: string
  link: string
  image: string
  lprice: string
  hprice: string
  mallName: string
  productId: string
  productType: string // '1' = 개별셀러, '2' = 카탈로그(다수판매처)
  brand: string
  maker: string
  category1: string
  category2: string
  category3: string
  category4: string
}

interface NaverShopResponse {
  lastBuildDate: string
  total: number
  start: number
  display: number
  items: NaverShopItem[]
  errorMessage?: string
}

function stripHtml(str: string): string {
  return str.replace(/<[^>]+>/g, '')
}

export async function fetchNaverShoppingApi(
  keyword: string,
  topN: number = 20
): Promise<ScrapedProduct[]> {
  const clientId = process.env.NAVER_CLIENT_ID
  const clientSecret = process.env.NAVER_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error(
      'NAVER_API_KEY_MISSING: 네이버 쇼핑 API 키가 설정되지 않았습니다. ' +
      '.env.local에 NAVER_CLIENT_ID와 NAVER_CLIENT_SECRET을 추가하세요. ' +
      '발급: https://developers.naver.com → 애플리케이션 등록 → 검색(쇼핑) API'
    )
  }

  const display = 100 // 카탈로그 제외 후 topN개 확보를 위해 최대치 요청
  const url = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(keyword)}&display=${display}&sort=sim`

  const res = await fetch(url, {
    headers: {
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`네이버 API 응답 오류 (${res.status}): ${text}`)
  }

  const data: NaverShopResponse = await res.json()

  if (!data.items || data.items.length === 0) {
    return []
  }

  // 카탈로그(묶음) 판별:
  // - productType === '2': 다수 판매처 묶음
  // - link에 /catalog/ 포함: 카탈로그 URL
  // 브랜드 공식 스토어(brand.naver.com)는 개별 상품이므로 포함
  const isCatalogItem = (item: NaverShopItem) =>
    item.productType === '2' || item.link.includes('/catalog/')

  // 전체 API 결과를 순서대로 순회하며 originalRank를 보존
  // 카탈로그는 제거하지 않고 isCatalog: true로 포함 → 비율 통계에 반영
  // effectiveRank는 일반 상품(개별 셀러)에만 부여
  let effectiveRank = 0
  let individualCount = 0
  const result: ScrapedProduct[] = []

  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i]
    const isCatalog = isCatalogItem(item)
    const originalRank = i + 1

    const rawPayload = {
      mallName: item.mallName,
      productId: item.productId,
      productType: item.productType,
      brand: item.brand,
      maker: item.maker,
      category: [item.category1, item.category2, item.category3, item.category4].filter(Boolean).join(' > '),
    }

    if (!isCatalog) {
      individualCount++
      if (individualCount > topN) break // topN개 일반 상품 확보 후 중단
      effectiveRank++
      result.push({
        originalRank,
        effectiveRank,
        title: stripHtml(item.title),
        price: item.lprice ? parseInt(item.lprice, 10) : null,
        reviewCount: 0,
        rating: null,
        sellerCount: 1,
        shippingBenefit: '',
        thumbnailUrl: item.image,
        productUrl: item.link,
        isAd: false,
        isCatalog: false,
        exclusionReason: null,
        rawPayload,
      })
    } else {
      // 카탈로그 상품도 결과에 포함 — 광고/카탈로그 비율 계산에 필요
      result.push({
        originalRank,
        effectiveRank: null,
        title: stripHtml(item.title),
        price: item.lprice ? parseInt(item.lprice, 10) : null,
        reviewCount: 0,
        rating: null,
        sellerCount: item.productType === '2' ? 3 : 1,
        shippingBenefit: '',
        thumbnailUrl: item.image,
        productUrl: item.link,
        isAd: false,
        isCatalog: true,
        exclusionReason: '카탈로그 묶음',
        rawPayload,
      })
    }
  }

  // originalRank 순서(1위→N위) 정렬
  result.sort((a, b) => a.originalRank - b.originalRank)

  return result
}

// API 키 없을 때 데모용 mock 데이터
export function getMockProducts(keyword: string, topN: number): ScrapedProduct[] {
  const mockItems = [
    { title: `${keyword} 프리미엄 스테인리스 28cm 인덕션 가능`, price: 29800, isAd: false, isCatalog: false, mall: '주방나라몰' },
    { title: `[무료배송] ${keyword} 3종세트 가정용 주방`, price: 45000, isAd: true, isCatalog: false, mall: '생활공구마트' },
    { title: `테팔 ${keyword} 공식`, price: 55000, isAd: false, isCatalog: true, mall: 'NAVER' },
    { title: `${keyword} 두꺼운 바닥 가스레인지 인덕션 겸용 국내산`, price: 18900, isAd: false, isCatalog: false, mall: '홈쿠킹샵' },
    { title: `한국산 ${keyword} 무코팅 위생 주방용품`, price: 23000, isAd: false, isCatalog: false, mall: '그린키친' },
    { title: `${keyword} IH 전기레인지 인덕션 28cm 호환`, price: 31500, isAd: false, isCatalog: true, mall: 'NAVER' },
    { title: `[당일발송] ${keyword} 소형 20cm 1인용 캠핑`, price: 12800, isAd: false, isCatalog: false, mall: '캠핑아웃도어' },
    { title: `${keyword} 오믈렛팬 계란후라이 전용 논스틱`, price: 15900, isAd: false, isCatalog: false, mall: '쿡앤라이프' },
    { title: `쿠쿠 ${keyword} 공식 스토어`, price: 48000, isAd: false, isCatalog: true, mall: 'NAVER' },
    { title: `${keyword} 핸들분리형 오븐 사용가능 다용도`, price: 27500, isAd: false, isCatalog: false, mall: '더키친몰' },
    { title: `${keyword} 뚜껑포함 2종세트 주방실용템`, price: 34900, isAd: false, isCatalog: false, mall: '생활주방마켓' },
    { title: `국내산 ${keyword} 고급형 두꺼운바닥 5mm`, price: 52000, isAd: false, isCatalog: false, mall: '프리미엄주방' },
  ]

  let effectiveRank = 0
  return mockItems.slice(0, topN).map((item, index) => {
    if (!item.isAd && !item.isCatalog) effectiveRank++
    return {
      originalRank: index + 1,
      effectiveRank: (item.isAd || item.isCatalog) ? null : effectiveRank,
      title: item.title,
      price: item.price,
      reviewCount: 0,
      rating: null,
      sellerCount: item.isCatalog ? 5 : 1,
      shippingBenefit: '',
      thumbnailUrl: '',
      productUrl: '',
      isAd: item.isAd,
      isCatalog: item.isCatalog,
      exclusionReason: item.isAd ? '광고 상품' : item.isCatalog ? '카탈로그 묶음' : null,
      rawPayload: { mock: true, mallName: item.mall },
    }
  })
}
