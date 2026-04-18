'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface AnalysisRun {
  id: string
  status: string
  created_at: string
  opportunity_score: number | null
}

interface Project {
  id: string
  title: string
  keyword: string
  created_at: string
  analysis_runs: AnalysisRun[]
}

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(data => setProjects(data.projects || []))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center min-h-screen">로딩 중...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <button onClick={() => router.push('/')} className="font-bold text-lg">PriceRank AI</button>
        <Button onClick={() => router.push('/')}>새 분석 시작</Button>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">내 프로젝트</h1>

        {projects.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              아직 분석한 키워드가 없습니다.{' '}
              <button onClick={() => router.push('/')} className="text-blue-600 hover:underline">
                첫 분석 시작하기
              </button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {projects.map(project => {
              const latestRun = project.analysis_runs?.[0]
              return (
                <Card key={project.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="py-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{project.title}</p>
                      <p className="text-sm text-muted-foreground">
                        키워드: {project.keyword} · {new Date(project.created_at).toLocaleDateString('ko-KR')}
                      </p>
                      {latestRun?.opportunity_score != null && (
                        <p className="text-xs mt-1">
                          기회도:{' '}
                          <span className={`font-semibold ${
                            latestRun.opportunity_score >= 60 ? 'text-green-600'
                              : latestRun.opportunity_score >= 30 ? 'text-yellow-600'
                              : 'text-red-600'
                          }`}>
                            {latestRun.opportunity_score}점
                          </span>
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {latestRun && (
                        <Badge variant={latestRun.status === 'done' ? 'outline' : 'secondary'}>
                          {latestRun.status === 'done' ? '완료' : latestRun.status}
                        </Badge>
                      )}
                      {latestRun?.id && (
                        <Button size="sm" onClick={() => router.push(`/results/${latestRun.id}`)}>
                          결과 보기
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
