import { chromium, type Browser, type Response as PlaywrightResponse } from 'playwright'
import OpenAI from 'openai'

export interface ProductDetailAnalysis {
  productName: string
  consumerPrice: number | null
  discountRate: number | null
  titleLength: number
  thumbnailUrl: string
  productUrl: string
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

  const productDetail = state.product?.A ?? state.productInfo ?? state.product
  if (productDetail) {
    const regDate = productDetail.registrationDate ?? productDetail.saleStartDate
    if (regDate) result.registrationDate = String(regDate).slice(0, 10)

    const options =
      productDetail.optionInfo?.optionCombinations ??
      productDetail.options ??
      []
    if (Array.isArray(options)) result.optionCount = options.length
  }

  const reviewSummary = state.reviewSummary ?? state.review?.summary
  if (reviewSummary) {
    result.totalReviews = reviewSummary.totalReviewCount ?? reviewSummary.count ?? null
    result.reviewRating = reviewSummary.averageReviewScore ?? reviewSummary.avgScore ?? null
    result.photoVideoReviews = reviewSummary.imageReviewCount ?? reviewSummary.photoCount ?? null
    result.recentSixMonthRating = reviewSummary.recentAverageReviewScore ?? null
    result.recentSixMonthReviews = reviewSummary.recentReviewCount ?? null
  }

  const tags = state.product?.A?.representativeSectionTag ?? state.tags ?? []
  if (Array.isArray(tags)) {
    result.relatedTags = tags
      .map((t: Record<string, unknown>) => String(t.tagName ?? t.name ?? t))
      .filter(Boolean)
  }

  return result
}

// XHR 인터셉션으로 획득한 API 응답 파싱
function parseInterceptedApis(
  productApi: Record<string, unknown> | null,
  reviewApi: Record<string, unknown> | null,
): Partial<PageData> {
  const result: Partial<PageData> = {}

  if (productApi) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = productApi as any
    const origin =
      d?.product?.originProduct ??
      d?.originProduct ??
      d?.product ??
      d

    const saleStart =
      origin?.saleStartDate ??
      origin?.registrationDate ??
      origin?.channelProduct?.saleStartDate
    if (saleStart) result.registrationDate = String(saleStart).slice(0, 10)

    const optCombinations =
      origin?.productOption?.optionCombinations ??
      origin?.optionInfo?.optionCombinations ??
      []
    if (Array.isArray(optCombinations)) result.optionCount = optCombinations.length

    const images = origin?.productImages ?? d?.product?.productImages ?? []
    if (Array.isArray(images) && images.length > 0) result.thumbnailCount = images.length

    const tags =
      origin?.productTag ??
      origin?.representativeSectionTag ??
      d?.productTag ??
      []
    if (Array.isArray(tags)) {
      result.relatedTags = tags
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((t: any) => String(t.tagName ?? t.name ?? t))
        .filter((s: string) => s && s !== '[object Object]')
    }
  }

  if (reviewApi) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = reviewApi as any
    const stats = r?.reviewStatistics ?? r?.statistics ?? r?.data ?? r

    result.totalReviews = stats?.totalReviewCount ?? stats?.totalCount ?? null
    result.reviewRating = stats?.averageReviewScore ?? stats?.avgScore ?? null
    result.photoVideoReviews = stats?.imageReviewCount ?? stats?.photoCount ?? null
    result.recentSixMonthRating = stats?.recentAverageReviewScore ?? null
    result.recentSixMonthReviews = stats?.recentReviewCount ?? null
    if (stats?.reviewPointInfo) result.reviewPoints = String(stats.reviewPointInfo)
  }

  return result
}

// 두 PageData를 병합: override의 non-null 값으로 base를 덮음
function mergePageData(base: Partial<PageData>, override: Partial<PageData>): Partial<PageData> {
  const result = { ...base }
  for (const key of Object.keys(override) as (keyof PageData)[]) {
    const val = override[key]
    if (val !== null && val !== undefined && !(Array.isArray(val) && val.length === 0)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(result as any)[key] = val
    }
  }
  return result
}

const BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-blink-features=AutomationControlled',
]

const CONTEXT_OPTIONS = {
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  locale: 'ko-KR',
  extraHTTPHeaders: { 'Accept-Language': 'ko-KR,ko;q=0.9' },
}

// Playwright로 상품 페이지 접속 + XHR 인터셉션 + __NEXT_DATA__ 파싱
async function scrapeWithPlaywright(browser: Browser, url: string): Promise<Partial<PageData>> {
  if (!url || !url.startsWith('http')) return {}

  const context = await browser.newContext(CONTEXT_OPTIONS)
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false })
  })

  const page = await context.newPage()

  let productApiData: Record<string, unknown> | null = null
  let reviewApiData: Record<string, unknown> | null = null

  const onResponse = async (response: PlaywrightResponse) => {
    if (response.status() !== 200) return
    const respUrl = response.url()

    const isNaverStore =
      respUrl.includes('smartstore.naver.com') || respUrl.includes('brand.naver.com')
    if (!isNaverStore) return

    try {
      const ct = response.headers()['content-type'] ?? ''
      if (!ct.includes('json')) return

      const json = (await response.json()) as Record<string, unknown>

      // 상품 상세 API: /products/{숫자} 패턴이고 review 아닌 경우
      if (/\/products\/\d+/.test(respUrl) && !/review/i.test(respUrl)) {
        productApiData = json
      }
      // 리뷰 API
      else if (/\/review/i.test(respUrl)) {
        reviewApiData = json
      }
    } catch {
      // JSON 파싱 실패 무시
    }
  }

  page.on('response', onResponse)

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })

    // networkidle 또는 8초 타임아웃 중 먼저 완료되는 쪽 대기
    await Promise.race([
      page.waitForLoadState('networkidle').catch(() => {}),
      new Promise<void>(resolve => setTimeout(resolve, 8000)),
    ])

    const html = await page.content()
    const nextData = extractNextData(html)
    const fromNextData = nextData ? parseSmartStoreNextData(nextData) : {}
    const fromApi = parseInterceptedApis(productApiData, reviewApiData)

    // 텍스트 기반 boolean 필드 보완
    const bodyText = html.replace(/<[^>]+>/g, ' ')
    const textData: Partial<PageData> = {
      hasNotificationCoupon: bodyText.includes('알림쿠폰'),
      hasGift: bodyText.includes('사은품'),
      hasEvent: /기획전|이벤트할인|특가|타임세일|flash\s*sale/i.test(bodyText),
    }

    const gradeMatch = bodyText.match(/등급\s*혜택[^.。\n]{0,100}/)
    if (gradeMatch) textData.gradeBenefits = gradeMatch[0].trim().slice(0, 100)

    const pointMatch = bodyText.match(/리뷰\s*작성시?\s*[^\n.。]{0,40}적립/)
    textData.reviewPoints = pointMatch ? pointMatch[0].trim() : null

    // 썸네일/영상 개수 HTML 기반 보완
    if (!fromApi.thumbnailCount && !fromNextData.thumbnailCount) {
      const imgSlides = html.match(/swiper-slide|product-image|_thumbnail/gi)
      textData.thumbnailCount = imgSlides ? Math.min(imgSlides.length, 20) : null
    }
    const videoMatches = html.match(/<video|youtube\.com\/embed|player\.vimeo/gi)
    textData.videoCount = videoMatches ? videoMatches.length : 0

    return mergePageData(mergePageData(fromNextData, fromApi), textData)
  } catch {
    return {}
  } finally {
    page.off('response', onResponse)
    await context.close()
  }
}

async function analyzeMultipleWithAI(
  keyword: string,
  titles: string[]
): Promise<Array<{ titleStructure: string; coreKeyword: string; subKeywords: string[] }>> {
  const defaultResult = { titleStructure: '', coreKeyword: keyword, subKeywords: [] as string[] }
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return titles.map(() => ({
      titleStructure: '분석 불가 (API 키 없음)',
      coreKeyword: keyword,
      subKeywords: [],
    }))
  }

  const client = new OpenAI({ apiKey })
  const titlesText = titles.map((t, i) => `${i + 1}. "${t}"`).join('\n')

  const prompt = `아래 네이버 쇼핑 상품명들을 분석해주세요.

검색 키워드: "${keyword}"

상품명 목록:
${titlesText}

[분석 규칙]
- 상품명 구조: 브랜드명 / 재질 / 카테고리명 / 단수 / 옵션명 / 서브키워드 / 핵심키워드 순서로 구성 요소를 ' / ' 구분자로 나열
- 해당 구성 요소가 없으면 해당 항목은 생략
- 핵심키워드: 실제 고객이 검색 시 입력한 키워드 (검색 키워드와 동일하거나 가장 근접한 단어)
- 서브키워드: 핵심키워드 외 고객이 검색할 만한 키워드 3~5개

다음 JSON 형식으로 응답하세요:
{
  "analyses": [
    {
      "titleStructure": "쉐프원 / 스테인리스 / 프라이팬 / 1개 / 24cm인덕션 / 무코팅친환경 / 스텐프라이팬",
      "coreKeyword": "스텐프라이팬",
      "subKeywords": ["인덕션프라이팬", "스테인리스팬", "무코팅팬"]
    }
  ]
}`

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: Math.min(4096, 200 * titles.length),
      messages: [
        {
          role: 'system',
          content: '당신은 네이버 쇼핑 상품명 구조를 분석하는 전문가입니다. 반드시 {"analyses": [...]} 형식의 JSON으로만 응답하세요.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    })

    const text = response.choices[0]?.message?.content ?? ''
    const parsed = JSON.parse(text)
    const arr = parsed.analyses

    if (Array.isArray(arr) && arr.length === titles.length) {
      return arr.map(p => ({
        titleStructure: p.titleStructure ?? '',
        coreKeyword: p.coreKeyword ?? keyword,
        subKeywords: Array.isArray(p.subKeywords) ? p.subKeywords : [],
      }))
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

// 브라우저 1회 실행, 3개씩 병렬 스크래핑
export async function analyzeMultipleProductDetails(
  keyword: string,
  products: Array<{ title: string; price: number | null; thumbnailUrl: string; productUrl: string }>
): Promise<ProductDetailAnalysis[]> {
  const browser = await chromium.launch({ headless: true, args: BROWSER_ARGS })
  const pageDataResults: Partial<PageData>[] = []

  try {
    const BATCH_SIZE = 3
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE)
      const batchResults = await Promise.allSettled(
        batch.map(p => scrapeWithPlaywright(browser, p.productUrl))
      )
      pageDataResults.push(
        ...batchResults.map(r => (r.status === 'fulfilled' ? r.value : {}))
      )
    }
  } finally {
    await browser.close()
  }

  const aiResults = await analyzeMultipleWithAI(keyword, products.map(p => p.title))

  return products.map((product, i) =>
    buildProductDetailResult(product, pageDataResults[i] ?? {}, aiResults[i])
  )
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
