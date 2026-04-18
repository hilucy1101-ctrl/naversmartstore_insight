'use client'

import { useState } from 'react'
import { createBrowserSupabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const supabase = createBrowserSupabase()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setMessage(error.message)
      } else {
        window.location.href = '/'
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setMessage(error.message)
      } else {
        setMessage('가입 확인 이메일을 보냈습니다. 이메일을 확인해주세요.')
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">PriceRank AI</CardTitle>
          <CardDescription>네이버 가격비교 상위노출 분석 서비스</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="이메일"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}
            </Button>
          </form>

          {message && (
            <p className="mt-3 text-sm text-center text-muted-foreground">{message}</p>
          )}

          <p className="mt-4 text-center text-sm">
            {mode === 'login' ? (
              <>계정이 없으신가요?{' '}
                <button className="text-blue-600 hover:underline" onClick={() => setMode('signup')}>
                  회원가입
                </button>
              </>
            ) : (
              <>이미 계정이 있으신가요?{' '}
                <button className="text-blue-600 hover:underline" onClick={() => setMode('login')}>
                  로그인
                </button>
              </>
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
