'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setInfo('')

    const supabase = createBrowserSupabase()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      if (error.message.includes('User already registered')) {
        setError('이미 가입된 이메일입니다. 로그인을 시도해주세요.')
      } else if (error.message.includes('Password should be at least')) {
        setError('비밀번호는 최소 6자 이상이어야 합니다.')
      } else {
        setError(error.message)
      }
    } else {
      setInfo('가입 확인 이메일을 보냈습니다. 받은 편지함을 확인하고 링크를 클릭해주세요.')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">PriceRank AI</CardTitle>
          <CardDescription>새 계정 만들기</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="이메일"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              disabled={loading || !!info}
            />
            <Input
              type="password"
              placeholder="비밀번호 (6자 이상)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              disabled={loading || !!info}
            />
            <Button type="submit" className="w-full" disabled={loading || !!info}>
              {loading ? '처리 중...' : '회원가입'}
            </Button>
          </form>

          {error && (
            <p className="mt-3 text-sm text-center text-red-600 font-medium">{error}</p>
          )}
          {info && (
            <p className="mt-3 text-sm text-center text-green-600 font-medium">{info}</p>
          )}

          <p className="mt-4 text-center text-sm text-gray-600">
            이미 계정이 있으신가요?{' '}
            <button
              className="text-blue-600 hover:underline font-medium"
              onClick={() => router.push('/login')}
            >
              로그인
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
