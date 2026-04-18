import Anthropic from '@anthropic-ai/sdk'
import type { TitleAnalysisResult } from '@/lib/analysis/title-analyzer'
import type { CompetitionScore } from '@/lib/analysis/competition-scorer'

const client = new Anthropic()

export interface RecommendInput {
  keyword: string
  currentTitle?: string
  brandName?: string
  features?: string
  material?: string
  purpose?: string
  targetCustomer?: string
  priceRange?: string
  sellingPoints?: string
}

export interface TitleRecommendation {
  type: 'seo' | 'click' | 'conversion' | 'longtail'
  title: string
  rationale: string
}

export async function generateTitleRecommendations(
  input: RecommendInput,
  titleAnalysis: TitleAnalysisResult,
  competition: CompetitionScore
): Promise<TitleRecommendation[]> {
  const topWordsText = titleAnalysis.topWords
    .slice(0, 10)
    .map(w => `"${w.word}"(${w.count}회)`)
    .join(', ')

  const prompt = `
너는 네이버 스마트스토어 상품명 SEO 전문가다.
아래 데이터를 기반으로 4가지 유형의 상품명을 추천해줘.

## 분석 키워드
${input.keyword}

## 시장 분석
- 광고 점유율: ${Math.round(competition.adRatio * 100)}%
- 카탈로그 점유율: ${Math.round(competition.catalogRatio * 100)}%
- 일반 셀러 기회도: ${competition.opportunityScore}점
- 경쟁 난이도: ${competition.difficulty}

## 상위 일반 셀러 상품명 패턴
- 평균 글자수: ${titleAnalysis.avgCharCount}자
- 평균 단어수: ${titleAnalysis.avgTokenCount}개
- 자주 쓰는 단어: ${topWordsText}

## 내 상품 정보
- 현재 상품명: ${input.currentTitle || '미입력'}
- 브랜드명: ${input.brandName || '미입력'}
- 상품 특성: ${input.features || '미입력'}
- 재질: ${input.material || '미입력'}
- 용도: ${input.purpose || '미입력'}
- 타겟: ${input.targetCustomer || '미입력'}
- 가격대: ${input.priceRange || '미입력'}
- 강조 포인트: ${input.sellingPoints || '미입력'}

## 추천 조건
1. 상위 일반 셀러 패턴을 반영할 것
2. 네이버 상품명 길이 제한(100자) 내로 작성
3. 브랜드/카탈로그 키워드에 과도하게 의존하지 말 것
4. 경쟁이 치열한 키워드는 롱테일로 우회 제안

## 출력 형식 (JSON만 출력, 설명 없이)
[
  {
    "type": "seo",
    "title": "...",
    "rationale": "이 제목을 추천한 이유 1~2문장"
  },
  {
    "type": "click",
    "title": "...",
    "rationale": "..."
  },
  {
    "type": "conversion",
    "title": "...",
    "rationale": "..."
  },
  {
    "type": "longtail",
    "title": "...",
    "rationale": "..."
  }
]
`.trim()

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  // JSON 파싱
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error('AI 응답 파싱 실패')

  const parsed = JSON.parse(jsonMatch[0]) as TitleRecommendation[]
  return parsed
}
