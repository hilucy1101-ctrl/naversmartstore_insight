-- PriceRank AI — Supabase 스키마
-- Supabase SQL Editor에서 실행하세요.

-- 사용자 프로필 (Supabase Auth 연동)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  plan text not null default 'free',   -- free | pro
  search_count int not null default 0,
  created_at timestamptz not null default now()
);

-- 프로필 자동 생성 트리거
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 프로젝트 (키워드별 분석 묶음)
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  keyword text not null,
  created_at timestamptz not null default now()
);

-- 분석 실행 기록
create table if not exists analysis_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  keyword text not null,
  requested_top_n int not null default 10,
  status text not null default 'pending', -- pending | running | done | error
  ad_ratio numeric,          -- 광고 비중 (0~1)
  catalog_ratio numeric,     -- 카탈로그 비중 (0~1)
  opportunity_score numeric, -- 일반 셀러 기회도 (0~100)
  error_message text,
  created_at timestamptz not null default now()
);

-- 수집된 상품 데이터
create table if not exists scraped_products (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references analysis_runs(id) on delete cascade not null,
  original_rank int not null,       -- 네이버 원본 순위
  effective_rank int,               -- 제외 후 실질 순위 (일반 셀러만)
  title text not null,
  price int,                        -- 최저가 (원)
  review_count int default 0,
  rating numeric,                   -- 평점 (0~5)
  seller_count int default 1,
  shipping_benefit text,
  thumbnail_url text,
  product_url text,
  is_ad boolean not null default false,
  is_catalog boolean not null default false,
  exclusion_reason text,            -- '광고' | '브랜드카탈로그' | null
  raw_payload jsonb                 -- 크롤링 원본 데이터
);

-- AI 상품명 추천 결과
create table if not exists title_recommendations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references analysis_runs(id) on delete cascade not null,
  rec_type text not null,   -- seo | click | conversion | longtail
  title_text text not null,
  rationale text,
  created_at timestamptz not null default now()
);

-- RLS 정책
alter table profiles enable row level security;
alter table projects enable row level security;
alter table analysis_runs enable row level security;
alter table scraped_products enable row level security;
alter table title_recommendations enable row level security;

-- profiles: 본인만 조회/수정
create policy "profiles_select_own" on profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

-- projects: 본인 소유만
create policy "projects_all_own" on projects for all using (auth.uid() = user_id);

-- analysis_runs: 본인 프로젝트만
create policy "runs_all_own" on analysis_runs for all
  using (exists (
    select 1 from projects where projects.id = analysis_runs.project_id and projects.user_id = auth.uid()
  ));

-- scraped_products: 본인 run만
create policy "products_all_own" on scraped_products for all
  using (exists (
    select 1 from analysis_runs ar
    join projects p on p.id = ar.project_id
    where ar.id = scraped_products.run_id and p.user_id = auth.uid()
  ));

-- title_recommendations: 본인 run만
create policy "recs_all_own" on title_recommendations for all
  using (exists (
    select 1 from analysis_runs ar
    join projects p on p.id = ar.project_id
    where ar.id = title_recommendations.run_id and p.user_id = auth.uid()
  ));

-- 인덱스
create index if not exists idx_projects_user_id on projects(user_id);
create index if not exists idx_runs_project_id on analysis_runs(project_id);
create index if not exists idx_products_run_id on scraped_products(run_id);
create index if not exists idx_recs_run_id on title_recommendations(run_id);
