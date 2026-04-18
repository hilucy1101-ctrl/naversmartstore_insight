# PriceRank AI

네이버 쇼핑 가격비교 탭에서 광고·브랜드 카탈로그를 제외하고, 일반 셀러 기준 실질 경쟁을 분석하는 SaaS MVP.

## 기술 스택

- **Frontend/Backend**: Next.js 14 App Router
- **UI**: Tailwind CSS + shadcn/ui
- **DB + Auth**: Supabase
- **크롤링**: Playwright
- **AI 추천**: Anthropic Claude API

## 로컬 실행 방법

### 1. 환경변수 설정

```bash
cp .env.local.example .env.local
```

`.env.local`에 아래 값을 채워주세요:

| 변수 | 설명 | 획득 방법 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | Supabase 대시보드 → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | 위와 동일 |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (서버 전용) | 위와 동일 |
| `ANTHROPIC_API_KEY` | Claude API 키 | console.anthropic.com |

### 2. Supabase DB 스키마 적용

1. [Supabase 대시보드](https://app.supabase.com) 접속
2. 프로젝트 선택 → SQL Editor
3. `supabase/schema.sql` 파일 내용 전체 복사 후 실행

### 3. Playwright 브라우저 설치

```bash
npx playwright install chromium
```

### 4. 개발 서버 실행

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:3000 접속

## 주요 기능

### 핵심 분석 흐름

1. 키워드 입력 (예: 식기건조대, 텀블러)
2. 네이버 가격비교 탭 자동 크롤링
3. **광고 상품 자동 제외** (광고 배지·클래스 탐지)
4. **브랜드 카탈로그 자동 제외** (다수 판매처 UI 탐지)
5. 일반 셀러 기준 실질 순위 재계산
6. 경쟁강도 분석 (광고 점유율·카탈로그 점유율·기회도)
7. AI 상품명 4가지 유형 추천

### 광고/카탈로그 탐지 규칙 수정

네이버 DOM이 변경되면 아래 파일만 수정하면 됩니다:

- `lib/crawler/rules/ad-detector.ts` — 광고 탐지 셀렉터/패턴
- `lib/crawler/rules/catalog-detector.ts` — 카탈로그 탐지 셀렉터/패턴

## 폴더 구조

```
app/
  page.tsx                   # 메인 검색 페이지
  results/[runId]/page.tsx   # 분석 결과 페이지
  projects/page.tsx          # 저장된 프로젝트 목록
  (auth)/login/page.tsx      # 로그인/회원가입
  api/
    analyze/route.ts         # 분석 실행 API
    projects/route.ts        # 프로젝트 목록 API
    recommend/route.ts       # AI 추천 API
lib/
  crawler/
    index.ts                 # Playwright 크롤러
    rules/
      ad-detector.ts         # 광고 탐지 규칙 (수정 가능)
      catalog-detector.ts    # 카탈로그 탐지 규칙 (수정 가능)
  analysis/
    title-analyzer.ts        # 상품명 분석 엔진
    competition-scorer.ts    # 경쟁강도 분석
  ai/
    recommend.ts             # Claude API 추천 생성
  supabase.ts
supabase/
  schema.sql                 # DB 스키마
```

## Vercel 배포

```bash
npm i -g vercel
vercel
```

환경변수는 Vercel 대시보드 → Settings → Environment Variables에서 설정하세요.

> 주의: Playwright는 Vercel Functions에서 실행됩니다. 크롤링 요청은 최대 5분(300초) 내로 완료되어야 합니다.
