// 상품명 분석 엔진 — 규칙 기반 토큰 분류 (MVP)

const MATERIAL_KEYWORDS = ['스텐', '스테인리스', '실리콘', '나무', '대나무', '플라스틱', '알루미늄', '유리', '세라믹', '면', '폴리에스터', '가죽', '인조가죽', '금속', '철', '동', '황동']
const SIZE_KEYWORDS = ['대형', '소형', '중형', '대', '소', '중', '특대', 'XL', 'L', 'M', 'S', '1단', '2단', '3단', '대용량', '소용량']
const TARGET_KEYWORDS = ['여성', '남성', '아이', '어린이', '유아', '성인', '노인', '시니어', '반려동물', '강아지', '고양이']
const PURPOSE_KEYWORDS = ['보온', '보냉', '방수', '방풍', '방오', '수납', '정리', '건조', '세척', '충전', '휴대', '이동', '접이식', '분리형']

interface TokenAnalysis {
  token: string
  type: 'material' | 'size' | 'target' | 'purpose' | 'number' | 'main' | 'sub' | 'unknown'
}

export interface TitleAnalysisResult {
  avgCharCount: number
  avgTokenCount: number
  numberRatio: number
  materialRatio: number
  purposeRatio: number
  targetRatio: number
  topWords: Array<{ word: string; count: number }>
  tokenPatterns: TokenAnalysis[][]
  patternSummary: string
}

function tokenize(title: string): string[] {
  return title.split(/[\s,\/\|]+/).filter(t => t.length > 0)
}

function classifyToken(token: string): TokenAnalysis['type'] {
  if (/\d/.test(token)) return 'number'
  if (MATERIAL_KEYWORDS.some(k => token.includes(k))) return 'material'
  if (SIZE_KEYWORDS.some(k => token.includes(k))) return 'size'
  if (TARGET_KEYWORDS.some(k => token.includes(k))) return 'target'
  if (PURPOSE_KEYWORDS.some(k => token.includes(k))) return 'purpose'
  return 'unknown'
}

export function analyzeTitles(titles: string[]): TitleAnalysisResult {
  if (titles.length === 0) {
    return {
      avgCharCount: 0,
      avgTokenCount: 0,
      numberRatio: 0,
      materialRatio: 0,
      purposeRatio: 0,
      targetRatio: 0,
      topWords: [],
      tokenPatterns: [],
      patternSummary: '분석할 상품명이 없습니다.',
    }
  }

  const wordFreq: Record<string, number> = {}
  let totalChars = 0
  let totalTokens = 0
  let numberCount = 0
  let materialCount = 0
  let purposeCount = 0
  let targetCount = 0

  const tokenPatterns: TokenAnalysis[][] = titles.map(title => {
    totalChars += title.length
    const tokens = tokenize(title)
    totalTokens += tokens.length

    return tokens.map(token => {
      const type = classifyToken(token)
      if (type === 'number') numberCount++
      if (type === 'material') materialCount++
      if (type === 'purpose') purposeCount++
      if (type === 'target') targetCount++

      // 단어 빈도 집계
      const normalized = token.trim()
      if (normalized.length > 1) {
        wordFreq[normalized] = (wordFreq[normalized] || 0) + 1
      }

      return { token, type }
    })
  })

  const n = titles.length
  const totalTokensAll = tokenPatterns.flat().length

  const topWords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word, count]) => ({ word, count }))

  // 패턴 요약 생성
  const patternTypes = tokenPatterns.map(tokens =>
    tokens.map(t => t.type).join(' → ')
  )
  const patternSummary = `상위 상품 주요 패턴:\n${patternTypes.slice(0, 5).map((p, i) => `${i + 1}. ${p}`).join('\n')}`

  return {
    avgCharCount: Math.round(totalChars / n),
    avgTokenCount: Math.round(totalTokens / n),
    numberRatio: totalTokensAll > 0 ? Math.round((numberCount / totalTokensAll) * 100) / 100 : 0,
    materialRatio: totalTokensAll > 0 ? Math.round((materialCount / totalTokensAll) * 100) / 100 : 0,
    purposeRatio: totalTokensAll > 0 ? Math.round((purposeCount / totalTokensAll) * 100) / 100 : 0,
    targetRatio: totalTokensAll > 0 ? Math.round((targetCount / totalTokensAll) * 100) / 100 : 0,
    topWords,
    tokenPatterns,
    patternSummary,
  }
}
