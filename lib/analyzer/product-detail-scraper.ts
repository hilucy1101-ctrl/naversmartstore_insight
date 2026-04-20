import Anthropic from '@anthropic-ai/sdk'

export interface ProductDetailAnalysis {
  // 기본 정보 (API에서)
  productName: string
  consumerPrice: number | null
  discountRate: number | null
  titleLength: number
  thumbnailUrl: string
  productUrl: string

  // 스크래핑 데이터
  registrationDate: string | null
  thumbnailCount: number | null
  videoCount: number | null
  hasNotificationCoupon: boolean | null
  hasEvent: boolean | null
  hasGift: boolean | null
  gradeBenefits: string | null
  optionCount: number | null
  totalReviews: number | null
  photoVideoReviews: number | null
  reviewRating: number | null
  recentSixMonthRating: number | null
  recentSixMonthReviews: number | null
  reviewPoints: string | null
  relatedTags: string[]

  // AI 분석
  titleStructure: string | null
  coreKeyword: string | null
  subKeywords: string[]
}

interface PageData {
  registrationDate: string | null
  thumbnailCount: number | null
  videoCount: number | null
  hasNotificationCoupon: boolean | null
  hasEvent: boolean | null
  hasGift: boolean | null
  gradeBenefits: string | null
  optionCount: number | null
  totalReviews: number | null
  photoVideoReviews: number | null
  reviewRating: number | null
  recentSixMonthRating: number | null
  recentSixMonthReviews: number | null
  reviewPoints: string | null
  relatedTags: string[]
}

function extractNextData(html: string): Record<string, unknown> | null {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
  if (!match) return null
  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepGet(obj: any, path: string[]): any {
  return path.reduce((cur, key) => (cur && typeof cur === 'object' ? cur[key] : undefined), obj)
}

function parseSmartStoreNextData(nextData: Record<string, unknown>): Partial<PageData> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const state = deepGet(nextData, ['props', 'pageProps', 'initialState']) as any
  if (!state) return {}

  const result: Partial<PageData> = {}

  // 상품 등록일
  const productDetail = state.product?.A ?? state.productInfo ?? state.product
  if (productDetail) {
    const regDate = productDetail.registrationDate ?? productDetail.saleStartDate
    if (regDate) result.registrationDate = String(regDate).slice(0, 10)

    // 옵션 개수
    const options =
      productDetail.optionInfo?.optionCombinations ??
      productDetail.options ??
      []
    if (Array.isArray(options)) result.optionCount = options.length
  }

  // 리뷰 정보
  const reviewSummary = state.reviewSummary ?? state.review?.summary
  if (reviewSummary) {
    result.totalReviews = reviewSummary.totalReviewCount ?? reviewSummary.count ?? null
    result.reviewRating = reviewSummary.averageReviewScore ?? reviewSummary.avgScore ?? null
    result.photoVideoReviews = reviewSummary.imageReviewCount ?? reviewSummary.photoCount ?? null
    result.recentSixMonthRating = reviewSummary.recentAverageReviewScore ?? null
    result.recentSixMonthReviews = reviewSummary.recentReviewCount ?? null
  }

  // 관련 태그
  const tags = state.product?.A?.representativeSectionTag ?? state.tags ?? []
  if (Array.isArray(tags)) {
    result.relatedTags = tags
      .map((t: Record<string, unknown>) => String(t.tagName ?? t.name ?? t))
      .filter(Boolean)
  }

  return result
}

async function scrapeProductPage(url: string): Promise<Partial<PageData>> {
  if (!url || !url.startsWith('http')) return {}

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) return {}

    const html = await res.text()
    const result: Partial<PageData> = {}

    // __NEXT_DATA__ 파싱 (Smartstore / Brand Store)
    const nextData = extractNextData(html)
    if (nextData) {
      Object.assign(result, parseSmartStoreNextData(nextData))
    }

    // 텍스트 기반 키워드 검색
    const bodyText = html.replace(/<[^>]+>/g, ' ')

    result.hasNotificationCoupon = bodyText.includes('알림쿠폰')
    result.hasGift = bodyText.includes('사은품')

    const gradeMatch = bodyText.match(/등급\s*혜택[^.。\n]{0,100}/)
    result.gradeBenefits = gradeMatch ? gradeMatch[0].trim().slice(0, 100) : null

    result.hasEvent = /기획전|이벤트할인|특가|타임세일|flash\s*sale/i.test(bodyText)

    // 썸네일 개수 (갤러리 슬라이드 기준)
    if (result.thumbnailCount == null) {
      const imgSlides = html.match(/swiper-slide|product-image|_thumbnail/gi)
      result.thumbnailCount = imgSlides ? Math.min(imgSlides.length, 20) : null
    }

    // 영상 개수
    if (result.videoCount == null) {
      const videoMatches = html.match(/<video|youtube\.com\/embed|player\.vimeo/gi)
      result.videoCount = videoMatches ? videoMatches.length : 0
    }

    // 리뷰 적립금
    if (!result.reviewPoints) {
      const pointMatch = bodyText.match(/리뷰\s*작성시?\s*[^\n.。]{0,40}적립/)
      result.reviewPoints = pointMatch ? pointMatch[0].trim() : null
    }

    // 관련 태그 (해시태그)
    if (!result.relatedTags || result.relatedTags.length === 0) {
      const tagMatches = html.match(/#([가-힣a-zA-Z0-9_]{2,20})/g)
      result.relatedTags = tagMatches
        ? [...new Set(tagMatches.map(t => t.slice(1)))].slice(0, 10)
        : []
    }

    return result
  } catch {
    return {}
  }
}

async function analyzeMultipleWithAI(
  keyword: string,
  titles: string[]
): Promise<Array<{ titleStructure: string; coreKeyword: string; subKeywords: string[] }>> {
  const defaultResult = { titleStructure: '', coreKeyword: keyword, subKeywords: [] as string[] }
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return titles.map(() => ({ titleStructure: '분석 불가 (API 키 없음)', coreKeyword: keyword, subKeywords: [] }))
  }

  const client = new Anthropic({ apiKey })
  const titlesText = titles.map((t, i) => `${i + 1}. "${t}"`).join('\n')

  const prompt = `아래 네이버 쇼핑 상품명들을 분석해주세요.

검색 키워드: "${keyword}"

상품명 목록:
${titlesText}

각 상품명에 대해 순서대로 JSON 배열로만 응답하세요 (다른 텍스트 없이):
[
  {
    "titleStructure": "브랜드명/재질/카테고리명/단수/옵션명/서브키워드/핵심키워드 순서로 실제 구조 설명 (예: 브랜드없음 / 스테인리스 / 프라이팬 / 1개 / 28cm인덕션 / 무코팅친환경 / 프라이팬)",
    "coreKeyword": "실제 고객이 검색 시 입력할 핵심 키워드 1~2단어",
    "subKeywords": ["핵심키워드 외 고객이 검색할 만한 키워드 3~5개"]
  }
]`

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: Math.min(4096, 200 * titles.length),
      messages: [{ role: 'user', content: prompt }],
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      if (Array.isArray(parsed) && parsed.length === titles.length) {
        return parsed.map(p => ({
          titleStructure: p.titleStructure ?? '',
          coreKeyword: p.coreKeyword ?? keyword,
          subKeywords: Array.isArray(p.subKeywords) ? p.subKeywords : [],
        }))
      }
    }
  } catch {
    // AI 실패 시 기본값 반환
  }

  return titles.map(() => ({ ...defaultResult }))
}

function buildProductDetailResult(
  product: { title: string; price: number | null; thumbnailUrl: string; productUrl: string },
  pageData: Partial<PageData>,
  aiData: { titleStructure: string; coreKeyword: string; subKeywords: string[] }
): ProductDetailAnalysis {
  return {
    productName: product.title,
    consumerPrice: product.price,
    discountRate: null,
    titleLength: product.title.length,
    thumbnailUrl: product.thumbnailUrl,
    productUrl: product.productUrl,
    registrationDate: pageData.registrationDate ?? null,
    thumbnailCount: pageData.thumbnailCount ?? null,
    videoCount: pageData.videoCount ?? null,
    hasNotificationCoupon: pageData.hasNotificationCoupon ?? null,
    hasEvent: pageData.hasEvent ?? null,
    hasGift: pageData.hasGift ?? null,
    gradeBenefits: pageData.gradeBenefits ?? null,
    optionCount: pageData.optionCount ?? null,
    totalReviews: pageData.totalReviews ?? null,
    photoVideoReviews: pageData.photoVideoReviews ?? null,
    reviewRating: pageData.reviewRating ?? null,
    recentSixMonthRating: pageData.recentSixMonthRating ?? null,
    recentSixMonthReviews: pageData.recentSixMonthReviews ?? null,
    reviewPoints: pageData.reviewPoints ?? null,
    relatedTags: pageData.relatedTags ?? [],
    titleStructure: aiData.titleStructure,
    coreKeyword: aiData.coreKeyword,
    subKeywords: aiData.subKeywords,
  }
}

// 여러 상품 한 번에 분석: 페이지 스크래핑 병렬 + AI 배치 1회 호출
export async function analyzeMultipleProductDetails(
  keyword: string,
  products: Array<{ title: string; price: number | null; thumbnailUrl: string; productUrl: string }>
): Promise<ProductDetailAnalysis[]> {
  const [pageDataResults, aiResults] = await Promise.all([
    Promise.allSettled(products.map(p => scrapeProductPage(p.productUrl))),
    analyzeMultipleWithAI(keyword, products.map(p => p.title)),
  ])

  return products.map((product, i) => {
    const pageData = pageDataResults[i].status === 'fulfilled' ? pageDataResults[i].value : {}
    return buildProductDetailResult(product, pageData, aiResults[i])
  })
}

export async function analyzeProductDetail(
  keyword: string,
  product: {
    title: string
    price: number | null
    thumbnailUrl: string
    productUrl: string
  }
): Promise<ProductDetailAnalysis> {
  const results = await analyzeMultipleProductDetails(keyword, [product])
  return results[0]
}
