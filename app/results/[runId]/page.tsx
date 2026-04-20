'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { ProductAnalysisTable } from '@/components/ProductAnalysisTable'
import type { ProductDetailAnalysis } from '@/lib/analyzer/product-detail-scraper'

interface Product {
  id: string
  original_rank: number
  effective_rank: number | null
  title: string
  price: number | null
  seller_count: number
  thumbnail_url: string
  product_url: string
  is_ad: boolean
  is_catalog: boolean
  exclusion_reason: string | null
  raw_payload: { mallName?: string; brand?: string; mock?: boolean } | null
}

interface Run {
  id: string
  keyword: string
  ad_ratio: number
  catalog_ratio: number
  opportunity_score: number
  projects: { keyword: string; title: string }
}

interface Recommendation {
  id: string
  rec_type: string
  title_text: string
  rationale: string
}

const REC_TYPE_LABELS: Record<string, string> = {
  seo: 'SEO형',
  click: '클릭유도형',
  conversion: '전환형',
  longtail: '롱테일 우회형',
}

export default function ResultsPage() {
  const { runId } = useParams<{ runId: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isDemoMode = searchParams.get('demo') === '1'

  const [run, setRun] = useState<Run | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [showAds, setShowAds] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  const [recInput, setRecInput] = useState({
    currentTitle: '', brandName: '', features: '', material: '', sellingPoints: '',
  })
  const [recLoading, setRecLoading] = useState(false)

  // 2단계 분석 상태
  type AnalysisResult = ProductDetailAnalysis & { id: string; error?: string }
  const [step2Analyses, setStep2Analyses] = useState<AnalysisResult[]>([])
  const [step2Loading, setStep2Loading] = useState(false)
  const [step2Error, setStep2Error] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('products')

  async function handleStep2() {
    if (selectedIds.size === 0) return
    setStep2Loading(true)
    setStep2Error(null)

    const selected = products.filter(p => selectedIds.has(p.id))
    try {
      const res = await fetch('/api/product-detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: run?.keyword ?? '',
          products: selected.map(p => ({
            id: p.id,
            title: p.title,
            price: p.price,
            thumbnailUrl: p.thumbnail_url,
            productUrl: p.product_url,
          })),
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setStep2Analyses(data.analyses)
      setActiveTab('step2')
    } catch (e) {
      setStep2Error(e instanceof Error ? e.message : '분석 실패')
    } finally {
      setStep2Loading(false)
    }
  }

  useEffect(() => {
    fetch(`/api/analyze?runId=${runId}`)
      .then(r => r.json())
      .then(data => {
        setRun(data.run)
        setProducts(data.products || [])
        setRecommendations(data.recommendations || [])
      })
      .finally(() => setLoading(false))
  }, [runId])

  async function handleRecommend(e: React.FormEvent) {
    e.preventDefault()
    setRecLoading(true)
    const res = await fetch('/api/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId, keyword: run?.keyword, ...recInput }),
    })
    const data = await res.json()
    if (data.recommendations) setRecommendations(data.recommendations)
    setRecLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">분석 결과 불러오는 중...</p>
      </div>
    )
  }

  // 기본: 광고만 제외, 카탈로그는 포함. 토글 시 광고도 표시
  const displayProducts = showAds ? products : products.filter(p => !p.is_ad)
  const normalProducts = products.filter(p => !p.is_ad && !p.is_catalog)
  const adCount = products.filter(p => p.is_ad).length
  const catalogCount = products.filter(p => p.is_catalog).length
  const opportunityScore = run?.opportunity_score ?? 0

  const difficultyLabel =
    opportunityScore >= 60 ? { text: '진입 용이', color: 'text-green-600' }
    : opportunityScore >= 30 ? { text: '보통', color: 'text-yellow-600' }
    : { text: '경쟁 치열', color: 'text-red-600' }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <button onClick={() => router.push('/')} className="font-bold text-lg">PriceRank AI</button>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={() => router.push('/projects')}>내 프로젝트</Button>
          <Button variant="outline" onClick={() => router.push('/')}>새 분석</Button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* 데모 모드 배너 */}
        {isDemoMode && (
          <div className="mb-5 p-4 bg-amber-50 border border-amber-300 rounded-lg text-sm">
            <p className="font-semibold text-amber-800 mb-1">데모 모드 — 샘플 데이터로 표시 중</p>
            <p className="text-amber-700">
              실제 네이버 쇼핑 데이터를 사용하려면{' '}
              <a href="https://developers.naver.com" target="_blank" rel="noopener noreferrer"
                className="underline font-medium">developers.naver.com</a>
              에서 <strong>검색 → 쇼핑 API</strong>를 신청(무료)하고,{' '}
              <code className="bg-amber-100 px-1 rounded">.env.local</code>에
              <code className="bg-amber-100 px-1 ml-1 rounded">NAVER_CLIENT_ID</code>와
              <code className="bg-amber-100 px-1 ml-1 rounded">NAVER_CLIENT_SECRET</code>을 추가하세요.
            </p>
          </div>
        )}

        {/* 페이지 헤더 */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold">&quot;{run?.keyword}&quot; 분석 결과</h1>
          <p className="text-muted-foreground text-sm mt-1">
            네이버 원본 1~{products.length}위 스캔 → 광고 {adCount}개 · 카탈로그 {catalogCount}개 제외 → 일반 셀러 {normalProducts.length}개
          </p>
          {normalProducts.length > 0 && normalProducts[0].original_rank > 1 && (
            <p className="text-xs text-amber-600 mt-0.5">
              ※ 첫 일반 셀러가 원본 {normalProducts[0].original_rank}위 — 앞 {normalProducts[0].original_rank - 1}개가 광고·카탈로그로 채워짐
            </p>
          )}
        </div>

        {/* 요약 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">광고 점유율</p>
              <p className="text-2xl font-bold">{Math.round((run?.ad_ratio ?? 0) * 100)}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">카탈로그 점유율</p>
              <p className="text-2xl font-bold">{Math.round((run?.catalog_ratio ?? 0) * 100)}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">일반 셀러 기회도</p>
              <p className={`text-2xl font-bold ${difficultyLabel.color}`}>{opportunityScore}점</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">경쟁 난이도</p>
              <p className={`text-2xl font-bold ${difficultyLabel.color}`}>{difficultyLabel.text}</p>
            </CardContent>
          </Card>
        </div>

        {/* 2단계 분석 버튼 */}
        {selectedIds.size > 0 && (
          <div className="mb-4 flex items-center gap-3">
            <Button
              onClick={handleStep2}
              disabled={step2Loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {step2Loading
                ? `분석 중... (${selectedIds.size}개)`
                : `2단계 분석 시작 — 선택 ${selectedIds.size}개`}
            </Button>
            {step2Error && (
              <span className="text-sm text-red-500">{step2Error}</span>
            )}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="products">1단계 · 상품 비교표</TabsTrigger>
            <TabsTrigger value="step2" disabled={step2Analyses.length === 0}>
              2단계 · 상세 분석{step2Analyses.length > 0 ? ` (${step2Analyses.length})` : ''}
            </TabsTrigger>
            <TabsTrigger value="recommend">AI 상품명 추천</TabsTrigger>
          </TabsList>

          {/* 상품 비교표 */}
          <TabsContent value="products">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <CardTitle className="text-base">
                  {showAds ? `전체 ${products.length}개` : `광고 제외 ${displayProducts.length}개`}
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => setShowAds(!showAds)}>
                  {showAds ? '광고 숨기기' : `광고 ${adCount}개 포함 보기`}
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14">실질순위</TableHead>
                        <TableHead className="w-14">원본순위</TableHead>
                        <TableHead>상품명</TableHead>
                        <TableHead className="w-28">가격</TableHead>
                        <TableHead className="w-28">쇼핑몰</TableHead>
                        <TableHead className="w-20 text-center">[선택]</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayProducts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            표시할 상품이 없습니다.
                          </TableCell>
                        </TableRow>
                      ) : displayProducts.map(p => (
                        <TableRow key={p.id} className={p.is_ad ? 'opacity-40 bg-gray-50' : p.is_catalog ? 'bg-blue-50/40' : ''}>
                          <TableCell className="font-medium">
                            {p.effective_rank ?? <span className="text-gray-300">—</span>}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{p.original_rank}</TableCell>
                          <TableCell>
                            {p.product_url ? (
                              <a href={p.product_url} target="_blank" rel="noopener noreferrer"
                                className="hover:underline text-blue-700 text-sm leading-snug">
                                {p.title}
                              </a>
                            ) : (
                              <span className="text-sm leading-snug">{p.title}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {p.price ? `${p.price.toLocaleString()}원` : '—'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {p.raw_payload?.mallName || '—'}
                          </TableCell>
                          <TableCell className="text-center">
                            {p.is_ad
                              ? <Badge variant="destructive">광고</Badge>
                              : (
                                <button
                                  onClick={() => toggleSelect(p.id)}
                                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                                    selectedIds.has(p.id)
                                      ? 'bg-black text-white border-black'
                                      : 'border-gray-300 text-gray-500 hover:border-gray-500'
                                  }`}
                                >
                                  {selectedIds.has(p.id) ? '✓ 선택됨' : '선택'}
                                </button>
                              )
                            }
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 2단계 상세 분석 탭 */}
          <TabsContent value="step2">
            {step2Loading ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <p className="text-lg mb-2">상품 페이지 분석 중...</p>
                  <p className="text-sm">각 상품 페이지 접근 및 AI 분석 중입니다. 잠시 기다려주세요.</p>
                </CardContent>
              </Card>
            ) : step2Analyses.length > 0 ? (
              <ProductAnalysisTable
                analyses={step2Analyses}
                keyword={run?.keyword ?? ''}
              />
            ) : (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground text-sm">
                  1단계에서 상품을 선택한 뒤 &quot;2단계 분석 시작&quot; 버튼을 눌러주세요.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* AI 추천 탭 */}
          <TabsContent value="recommend">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-base">내 상품 정보 입력</CardTitle></CardHeader>
                <CardContent>
                  <form onSubmit={handleRecommend} className="space-y-3">
                    {[
                      { key: 'currentTitle', label: '현재 상품명', placeholder: '기존 상품명 입력' },
                      { key: 'brandName', label: '브랜드명', placeholder: '브랜드 또는 상호명' },
                      { key: 'features', label: '상품 특성', placeholder: '예: 접이식, 대용량, 친환경' },
                      { key: 'material', label: '재질', placeholder: '예: 스테인리스, 실리콘' },
                      { key: 'sellingPoints', label: '강조 포인트', placeholder: '예: 무료배송, 당일발송, 국내산' },
                    ].map(({ key, label, placeholder }) => (
                      <div key={key}>
                        <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
                        <Input
                          placeholder={placeholder}
                          value={recInput[key as keyof typeof recInput]}
                          onChange={e => setRecInput(prev => ({ ...prev, [key]: e.target.value }))}
                        />
                      </div>
                    ))}
                    <Button type="submit" className="w-full" disabled={recLoading}>
                      {recLoading ? 'AI 생성 중...' : 'AI 상품명 추천 받기'}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <div className="space-y-3">
                {recommendations.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6 text-center text-muted-foreground text-sm">
                      왼쪽 양식을 작성하고 추천 버튼을 눌러주세요.
                    </CardContent>
                  </Card>
                ) : recommendations.map(r => (
                  <Card key={r.id}>
                    <CardContent className="pt-4">
                      <Badge className="mb-2">{REC_TYPE_LABELS[r.rec_type] ?? r.rec_type}</Badge>
                      <p className="font-medium text-sm mb-1">{r.title_text}</p>
                      <p className="text-xs text-muted-foreground">{r.rationale}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
