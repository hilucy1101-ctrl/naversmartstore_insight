'use client'

import Image from 'next/image'
import type { ProductDetailAnalysis } from '@/lib/analyzer/product-detail-scraper'

interface Props {
  analyses: (ProductDetailAnalysis & { id: string; error?: string })[]
  keyword: string
}

function OX({ value }: { value: boolean | null }) {
  if (value === null) return <span className="text-gray-300">—</span>
  return (
    <span className={value ? 'text-green-600 font-bold' : 'text-red-500'}>
      {value ? 'O' : 'X'}
    </span>
  )
}

function Val({ v }: { v: unknown }) {
  if (v === null || v === undefined) return <span className="text-gray-300">—</span>
  return <span>{String(v)}</span>
}

const ROWS: { label: string; render: (a: ProductDetailAnalysis) => React.ReactNode }[] = [
  {
    label: '썸네일',
    render: a =>
      a.thumbnailUrl ? (
        <a href={a.productUrl} target="_blank" rel="noopener noreferrer">
          <Image
            src={a.thumbnailUrl}
            alt={a.productName}
            width={72}
            height={72}
            className="rounded object-cover border"
            unoptimized
          />
        </a>
      ) : (
        <span className="text-gray-300">—</span>
      ),
  },
  {
    label: '소비자가',
    render: a =>
      a.consumerPrice ? `${a.consumerPrice.toLocaleString()}원` : '—',
  },
  {
    label: '할인율',
    render: a => (a.discountRate != null ? `${a.discountRate}%` : '—'),
  },
  { label: '상품등록일', render: a => <Val v={a.registrationDate} /> },
  {
    label: '글자수',
    render: a => (
      <span className={a.titleLength > 50 ? 'text-red-500' : ''}>
        {a.titleLength}자
      </span>
    ),
  },
  { label: '상품명 구조', render: a => <Val v={a.titleStructure} /> },
  { label: '핵심키워드', render: a => <Val v={a.coreKeyword} /> },
  {
    label: '서브키워드',
    render: a =>
      a.subKeywords?.length ? (
        <div className="flex flex-wrap gap-1">
          {a.subKeywords.map((k, i) => (
            <span
              key={i}
              className="bg-blue-50 text-blue-700 text-xs px-1.5 py-0.5 rounded"
            >
              {k}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-gray-300">—</span>
      ),
  },
  { label: '썸네일 개수', render: a => <Val v={a.thumbnailCount} /> },
  { label: '알림쿠폰', render: a => <OX value={a.hasNotificationCoupon} /> },
  { label: '이벤트', render: a => <OX value={a.hasEvent} /> },
  { label: '사은품', render: a => <OX value={a.hasGift} /> },
  {
    label: '등급혜택',
    render: a =>
      a.gradeBenefits ? (
        <span className="text-xs">{a.gradeBenefits}</span>
      ) : (
        <span className="text-gray-300">X</span>
      ),
  },
  { label: '옵션개수', render: a => <Val v={a.optionCount} /> },
  {
    label: '전체리뷰수',
    render: a =>
      a.totalReviews != null ? (
        <span className="font-medium">{a.totalReviews.toLocaleString()}</span>
      ) : (
        <span className="text-gray-300">—</span>
      ),
  },
  { label: '포토·동영상리뷰', render: a => <Val v={a.photoVideoReviews} /> },
  {
    label: '리뷰 평점',
    render: a =>
      a.reviewRating != null ? (
        <span className="text-yellow-600 font-medium">★ {a.reviewRating}</span>
      ) : (
        <span className="text-gray-300">—</span>
      ),
  },
  {
    label: '최근6개월 평점',
    render: a =>
      a.recentSixMonthRating != null ? (
        <span className="text-yellow-600">★ {a.recentSixMonthRating}</span>
      ) : (
        <span className="text-gray-300">—</span>
      ),
  },
  { label: '최근6개월 리뷰수', render: a => <Val v={a.recentSixMonthReviews} /> },
  { label: '리뷰 적립금', render: a => <Val v={a.reviewPoints} /> },
  {
    label: '관련 태그',
    render: a =>
      a.relatedTags?.length ? (
        <div className="flex flex-wrap gap-1">
          {a.relatedTags.slice(0, 6).map((t, i) => (
            <span
              key={i}
              className="bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded"
            >
              #{t}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-gray-300">—</span>
      ),
  },
]

export function ProductAnalysisTable({ analyses, keyword }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="text-sm border-collapse min-w-max">
        <thead>
          <tr className="bg-gray-50 border-b">
            <th className="sticky left-0 z-10 bg-gray-50 text-left px-3 py-2.5 font-semibold text-gray-700 min-w-[120px] border-r">
              항목 / 상품
            </th>
            {analyses.map((a, i) => (
              <th
                key={a.id}
                className="text-left px-3 py-2 font-medium text-gray-800 min-w-[180px] border-r last:border-r-0 align-top"
              >
                <div className="flex items-start gap-1.5">
                  <span className="text-xs text-gray-400 shrink-0 mt-0.5">#{i + 1}</span>
                  <a
                    href={a.productUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 hover:underline text-xs leading-snug"
                  >
                    {a.productName}
                  </a>
                </div>
                {a.error && (
                  <p className="text-red-500 text-xs mt-1">{a.error}</p>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map(({ label, render }) => (
            <tr key={label} className="border-b hover:bg-gray-50/50">
              <td className="sticky left-0 z-10 bg-white border-r px-3 py-2 font-medium text-gray-600 text-xs whitespace-nowrap">
                {label}
              </td>
              {analyses.map(a => (
                <td
                  key={a.id}
                  className="px-3 py-2 border-r last:border-r-0 align-top"
                >
                  {a.error ? (
                    <span className="text-gray-300">—</span>
                  ) : (
                    render(a)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-gray-400 px-3 py-2 border-t">
        검색 키워드: <strong className="text-gray-500">{keyword}</strong> ·
        스크래핑 데이터는 페이지 접근 가능 여부에 따라 일부 항목이 표시되지 않을 수 있습니다.
      </p>
    </div>
  )
}
