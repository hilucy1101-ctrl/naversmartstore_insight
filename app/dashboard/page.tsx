'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const TOP_N_OPTIONS = [5, 10, 20]

export default function DashboardPage() {
  const [keyword, setKeyword] = useState('')
  const [topN, setTopN] = useState(10)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault()
    if (!keyword.trim()) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: keyword.trim(), topN }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '분석 실패')
      router.push(`/results/${data.runId}${data.isDemoMode ? '?demo=1' : ''}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    const { createBrowserSupabase } = await import('@/lib/supabase-client')
    await createBrowserSupabase().auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <span className="font-bold text-lg">PriceRank AI</span>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={() => router.push('/projects')}>내 프로젝트</Button>
          <Button variant="outline" onClick={handleLogout}>로그아웃</Button>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold mb-2">네이버 가격비교 상위노출 분석</h1>
          <p className="text-muted-foreground">
            광고·브랜드 카탈로그를 제외한 <strong>일반 셀러 실질 경쟁</strong>을 분석합니다
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>키워드 분석 시작</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAnalyze} className="space-y-4">
              <Input
                placeholder="예: 식기건조대, 스텐팬, 텀블러"
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                disabled={loading}
                className="text-base"
              />

              <div>
                <p className="text-sm text-muted-foreground mb-2">분석 범위</p>
                <div className="flex gap-2">
                  {TOP_N_OPTIONS.map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setTopN(n)}
                      className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
                        topN === n
                          ? 'bg-black text-white border-black'
                          : 'border-gray-300 hover:border-gray-500'
                      }`}
                    >
                      TOP {n}
                    </button>
                  ))}
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading || !keyword.trim()}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    분석 중... (최대 30초 소요)
                  </span>
                ) : '분석 시작'}
              </Button>

              {error && <p className="text-sm text-red-500 text-center">{error}</p>}
            </form>
          </CardContent>
        </Card>

        <div className="mt-8 grid grid-cols-3 gap-4 text-center text-sm text-muted-foreground">
          <div className="p-3 bg-white rounded-lg border">
            <div className="text-2xl mb-1">🚫</div>
            <div>광고 자동 제외</div>
          </div>
          <div className="p-3 bg-white rounded-lg border">
            <div className="text-2xl mb-1">📦</div>
            <div>카탈로그 자동 제외</div>
          </div>
          <div className="p-3 bg-white rounded-lg border">
            <div className="text-2xl mb-1">📊</div>
            <div>실질 순위 재계산</div>
          </div>
        </div>
      </main>
    </div>
  )
}
