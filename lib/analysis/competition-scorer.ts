import type { ScrapedProduct } from '@/lib/crawler'

export interface CompetitionScore {
  adRatio: number           // 광고 비중 (0~1)
  catalogRatio: number      // 카탈로그 비중 (0~1)
  opportunityScore: number  // 일반 셀러 기회도 (0~100)
  difficulty: 'easy' | 'medium' | 'hard'
  summary: string
}

export function scoreCompetition(products: ScrapedProduct[]): CompetitionScore {
  if (products.length === 0) {
    return {
      adRatio: 0, catalogRatio: 0, opportunityScore: 100,
      difficulty: 'easy', summary: '데이터 없음',
    }
  }

  const total = products.length
  const adCount = products.filter(p => p.isAd).length
  const catalogCount = products.filter(p => p.isCatalog).length
  const normalProducts = products.filter(p => !p.isAd && !p.isCatalog)

  const adRatio = Math.round((adCount / total) * 100) / 100
  const catalogRatio = Math.round((catalogCount / total) * 100) / 100
  const opportunityScore = Math.round((normalProducts.length / total) * 100)

  // 난이도: 광고+카탈로그 점유율 기반 판단
  const exclusionRatio = adRatio + catalogRatio
  let difficulty: 'easy' | 'medium' | 'hard'
  if (opportunityScore >= 60) {
    difficulty = 'easy'
  } else if (opportunityScore >= 30 || exclusionRatio < 0.7) {
    difficulty = 'medium'
  } else {
    difficulty = 'hard'
  }

  const summary = [
    `광고 점유율 ${Math.round(adRatio * 100)}%`,
    `카탈로그 점유율 ${Math.round(catalogRatio * 100)}%`,
    `일반 셀러 기회도 ${opportunityScore}점`,
    difficulty === 'easy' ? '→ 진입 가능한 키워드입니다.'
      : difficulty === 'medium' ? '→ 전략적 접근이 필요한 키워드입니다.'
      : '→ 경쟁이 매우 치열한 키워드입니다.',
  ].join(' | ')

  return { adRatio, catalogRatio, opportunityScore, difficulty, summary }
}
