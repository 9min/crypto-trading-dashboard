# Real-time Crypto Trading Dashboard - 배포 가이드

**문서 버전**: v1.0
**작성일**: 2026-02-25
**대상 독자**: 프로젝트를 Zero에서 Production까지 배포하려는 개발자

---

## 목차

1. [배포 아키텍처 개요](#1-배포-아키텍처-개요)
2. [Vercel 배포 설정](#2-vercel-배포-설정)
3. [CI/CD 파이프라인](#3-cicd-파이프라인)
4. [Supabase 프로덕션 설정](#4-supabase-프로덕션-설정)
5. [성능 최적화 (배포 관점)](#5-성능-최적화-배포-관점)
6. [모니터링](#6-모니터링)
7. [배포 체크리스트](#7-배포-체크리스트)
8. [롤백 전략](#8-롤백-전략)
9. [비용 관리](#9-비용-관리)

---

## 1. 배포 아키텍처 개요

본 프로젝트는 **서버 트래픽 비용 Zero** 아키텍처를 채택한다. 실시간 금융 데이터는 브라우저에서 바이낸스 WebSocket에 직접 연결하여 수신하며, 백엔드 프록시 서버가 존재하지 않는다. Supabase는 오직 사용자 인증과 설정 영속화(레이아웃, 관심 종목)에만 사용된다.

### 1.1 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────────────┐
│                        배포 아키텍처 개요                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐     정적 자산 제공      ┌───────────────────────┐  │
│  │              │◄──────────────────────►│                       │  │
│  │   Vercel     │  (HTML/JS/CSS/Images)  │     사용자 브라우저     │  │
│  │   (CDN +     │                        │                       │  │
│  │   Edge)      │     Next.js SSG 페이지   │  ┌─────────────────┐ │  │
│  │              │     + Static Assets    │  │  Next.js App     │ │  │
│  └──────────────┘                        │  │  (Client-side)   │ │  │
│                                          │  └────────┬────────┘ │  │
│                                          │           │          │  │
│                                          │     ┌─────┴─────┐    │  │
│                                          │     │           │    │  │
│                                          │     ▼           ▼    │  │
│  ┌──────────────┐  Auth + DB (설정 저장)   │ ┌───────┐ ┌───────┐ │  │
│  │  Supabase    │◄────────────────────── │ │  Auth  │ │  WS   │ │  │
│  │  (Auth +     │  사용자 설정 CRUD만 발생  │ │ Client│ │Manager│ │  │
│  │  PostgreSQL) │  (트래픽 극소량)         │ └───────┘ └───┬───┘ │  │
│  └──────────────┘                        │               │      │  │
│                                          │               │      │  │
│  ┌──────────────┐  WebSocket 직접 연결     │               │      │  │
│  │  Binance     │◄───────────────────────┼───────────────┘      │  │
│  │  WebSocket   │  (실시간 시세 데이터)     │                      │  │
│  │  API         │  서버 경유 없음!         │  kline / depth /     │  │
│  │  (Public)    │                        │  trade 스트림          │  │
│  └──────────────┘                        └───────────────────────┘  │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│  핵심 포인트:                                                        │
│  - Vercel: 정적 자산 서빙만 담당 (빌드 시 생성된 HTML/JS/CSS)          │
│  - 브라우저 → Binance: WebSocket 직접 연결 (서버 프록시 없음)          │
│  - Supabase: Auth + 사용자 설정 저장만 (실시간 데이터 무관)            │
│  - 서버 트래픽 비용: $0 (실시간 데이터는 브라우저가 직접 수신)          │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 데이터 흐름 요약

| 데이터 종류                       | 흐름                         | 서버 경유 여부                     |
| --------------------------------- | ---------------------------- | ---------------------------------- |
| 실시간 시세 (kline, depth, trade) | Binance WebSocket → 브라우저 | 경유 없음 (직접 연결)              |
| 히스토리 캔들/오더북 스냅샷       | Binance REST API → 브라우저  | 경유 없음 (직접 fetch)             |
| 사용자 인증                       | Supabase Auth → 브라우저     | Supabase 경유                      |
| 레이아웃/관심 종목 저장           | 브라우저 → Supabase DB       | Supabase 경유 (극소량 트래픽)      |
| 정적 페이지/자산                  | Vercel CDN → 브라우저        | Vercel CDN 경유 (초기 로딩 시 1회) |

---

## 2. Vercel 배포 설정

### 2.1 Vercel 프로젝트 연결

#### 사전 준비

- [Vercel 계정](https://vercel.com/signup) 생성 (GitHub 계정으로 가입 권장)
- GitHub에 프로젝트 리포지토리 생성 및 코드 push 완료

#### Step 1: Vercel에 프로젝트 import

1. [Vercel Dashboard](https://vercel.com/dashboard)에 접속한다.
2. **"Add New..."** → **"Project"** 버튼을 클릭한다.
3. **"Import Git Repository"** 섹션에서 GitHub 리포지토리를 선택한다.
   - 처음이라면 **"Adjust GitHub App Permissions"** 링크를 클릭하여 Vercel에 리포지토리 접근 권한을 부여한다.
4. 프로젝트 리포지토리(`crypto-trading-dashboard`)를 찾아 **"Import"** 버튼을 클릭한다.

#### Step 2: 빌드 설정 확인

Vercel은 Next.js 프로젝트를 자동 감지하여 아래 설정을 기본 적용한다. 확인 후 필요 시 수정한다.

| 설정 항목        | 값             | 비고                               |
| ---------------- | -------------- | ---------------------------------- |
| Framework Preset | **Next.js**    | 자동 감지됨                        |
| Build Command    | `pnpm build`   | package.json의 build 스크립트 사용 |
| Output Directory | `.next`        | Next.js 기본값                     |
| Install Command  | `pnpm install` | pnpm 사용 시 명시 필요             |
| Root Directory   | `./ `          | 모노레포가 아니면 기본값 유지      |
| Node.js Version  | `20.x`         | Settings → General에서 변경 가능   |

> **참고**: pnpm을 패키지 매니저로 사용하는 경우, Vercel은 `pnpm-lock.yaml` 파일을 감지하여 자동으로 pnpm을 사용한다. 별도의 설정이 불필요하다.

#### Step 3: 배포 실행

**"Deploy"** 버튼을 클릭하면 첫 번째 프로덕션 배포가 시작된다. 빌드 로그를 실시간으로 확인할 수 있다.

### 2.2 환경 변수 설정

#### 필수 환경 변수

본 프로젝트에서 필요한 환경 변수는 다음과 같다.

| 변수명                          | 설명                       | 예시 값                        | 클라이언트 노출              |
| ------------------------------- | -------------------------- | ------------------------------ | ---------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase 프로젝트 URL      | `https://abcdefgh.supabase.co` | 노출됨 (NEXT*PUBLIC* 접두어) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 익명 키 (공개 키) | `eyJhbGciOiJIUzI1NiIs...`      | 노출됨 (RLS가 보호)          |

> **보안 참고**: `NEXT_PUBLIC_` 접두어가 붙은 변수는 클라이언트 번들에 포함되어 브라우저에서 접근 가능하다. Supabase Anon Key는 공개되어도 안전하다. RLS(Row Level Security) 정책이 데이터를 보호하기 때문이다. 단, **Service Role Key는 절대로 `NEXT_PUBLIC_` 변수에 설정하지 않는다.**

#### Vercel 대시보드에서 환경 변수 설정 방법

1. Vercel Dashboard에서 프로젝트를 선택한다.
2. **Settings** 탭으로 이동한다.
3. 좌측 메뉴에서 **"Environment Variables"** 를 클릭한다.
4. 각 변수를 아래와 같이 추가한다:

```
Key:   NEXT_PUBLIC_SUPABASE_URL
Value: https://your-project-id.supabase.co

Key:   NEXT_PUBLIC_SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### 환경 스코핑 (Environment Scoping)

Vercel은 환경 변수를 배포 환경별로 분리하여 관리할 수 있다.

| 환경            | 적용 시점              | 용도                                 |
| --------------- | ---------------------- | ------------------------------------ |
| **Production**  | `main` 브랜치 배포     | 프로덕션 Supabase 프로젝트 연결      |
| **Preview**     | PR 및 기타 브랜치 배포 | 개발용 Supabase 프로젝트 연결 (권장) |
| **Development** | `vercel dev` 로컬 실행 | 로컬 개발 환경                       |

**권장 설정**:

- **Production 환경**: 프로덕션 Supabase 프로젝트의 URL과 Anon Key를 설정한다.
- **Preview 환경**: 개발/스테이징용 별도 Supabase 프로젝트의 URL과 Anon Key를 설정한다. 이렇게 하면 Preview 배포에서 프로덕션 데이터에 영향을 주지 않는다.
- **Development 환경**: 로컬 `.env.local` 파일의 값과 동일하게 설정하거나, `vercel env pull` 명령어로 로컬에 동기화한다.

```bash
# 로컬 개발 환경에 Vercel 환경 변수 동기화
vercel env pull .env.local
```

### 2.3 도메인 설정

#### 기본 Vercel 도메인

배포 완료 시 Vercel이 자동으로 부여하는 도메인 형식:

| 도메인 유형     | 형식                                            | 예시                                                     |
| --------------- | ----------------------------------------------- | -------------------------------------------------------- |
| 프로젝트 도메인 | `{project-name}.vercel.app`                     | `crypto-trading-dashboard.vercel.app`                    |
| 배포별 도메인   | `{project-name}-{hash}.vercel.app`              | `crypto-trading-dashboard-abc123.vercel.app`             |
| Preview 도메인  | `{project-name}-git-{branch}-{user}.vercel.app` | `crypto-trading-dashboard-git-feature-x-user.vercel.app` |

기본 도메인만으로도 프로덕션 서비스를 운영할 수 있다. HTTPS가 자동으로 적용된다.

#### 커스텀 도메인 설정 (선택 사항)

커스텀 도메인을 연결하려면 다음 단계를 따른다.

1. Vercel Dashboard → 프로젝트 → **Settings** → **Domains** 이동
2. 보유한 도메인을 입력하고 **"Add"** 클릭 (예: `crypto-dashboard.example.com`)
3. 도메인 DNS 설정에서 Vercel이 안내하는 레코드를 추가:

```
# 루트 도메인 (example.com)
A 레코드: 76.76.21.21

# 서브도메인 (crypto-dashboard.example.com)
CNAME 레코드: cname.vercel-dns.com
```

4. DNS 전파 대기 (보통 수 분~최대 48시간)
5. Vercel이 자동으로 **Let's Encrypt SSL 인증서**를 발급하여 HTTPS를 활성화한다.

> **참고**: 커스텀 도메인을 설정한 경우, Supabase의 OAuth Redirect URL도 해당 도메인으로 업데이트해야 한다 (4.1절 참고).

---

## 3. CI/CD 파이프라인

### 3.0 GitHub Actions CI

모든 PR과 `main`/`develop` 브랜치 push에서 GitHub Actions CI가 자동 실행된다. CI가 통과해야 PR 병합이 가능하다.

#### 워크플로우 파일

`.github/workflows/ci.yml`에 정의되어 있다.

#### CI 실행 단계

```
lint-typecheck-test (Job 1)
├── Checkout
├── Setup pnpm + Node.js (.nvmrc 버전)
├── pnpm install --frozen-lockfile
├── pnpm lint          (ESLint --max-warnings=0)
├── pnpm type-check    (tsc --noEmit)
└── pnpm test          (Vitest 단위 테스트)

build (Job 2, Job 1 통과 후 실행)
├── Checkout
├── Setup pnpm + Node.js
├── pnpm install --frozen-lockfile
└── pnpm build         (next build)
```

#### CI 트리거 조건

| Git 이벤트                                  | 트리거  |
| ------------------------------------------- | ------- |
| `main` 또는 `develop` 브랜치에 push         | CI 실행 |
| `main` 또는 `develop` 대상 PR 생성/업데이트 | CI 실행 |

#### Concurrency 설정

동일 브랜치에서 여러 CI가 동시에 실행되면 이전 실행을 자동 취소한다. 이를 통해 GitHub Actions 분 수를 절약한다.

### 3.0.1 CodeRabbit AI 코드 리뷰

PR 생성 시 [CodeRabbit](https://coderabbit.ai)이 자동으로 코드 리뷰를 수행한다.

#### 설정 파일

프로젝트 루트의 `.coderabbit.yaml`에 정의되어 있다.

```yaml
language: ko-KR # 리뷰 언어: 한국어
reviews:
  auto_review:
    enabled: true # PR 생성 시 자동 리뷰
    drafts: false # Draft PR은 리뷰하지 않음
  high_level_summary: true # 변경사항 요약 제공
```

#### 사전 요구사항

- GitHub Apps에서 CodeRabbit 앱이 해당 리포지토리에 설치되어 있어야 한다.
- 설치: https://github.com/apps/coderabbitai → **Configure** → 리포지토리 선택

### 3.1 자동 배포 흐름 (Vercel)

Vercel은 GitHub 리포지토리와 연동하여 별도의 CI/CD 설정 없이 자동 배포를 제공한다.

#### 배포 트리거 규칙

| Git 이벤트                 | Vercel 배포 유형    | URL                                        |
| -------------------------- | ------------------- | ------------------------------------------ |
| `main` 브랜치에 push       | **Production** 배포 | `{project}.vercel.app`                     |
| 기타 브랜치에 push         | **Preview** 배포    | `{project}-git-{branch}-{user}.vercel.app` |
| Pull Request 생성/업데이트 | **Preview** 배포    | PR 코멘트에 URL 자동 게시                  |

#### 전체 배포 흐름 다이어그램

```
┌─────────────────────────────────────────────────────────────────┐
│                      CI/CD 파이프라인 흐름                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  개발자 로컬                                                     │
│  ┌──────────┐                                                   │
│  │ git push │                                                   │
│  └────┬─────┘                                                   │
│       │                                                         │
│       ▼                                                         │
│  ┌──────────┐     Webhook      ┌────────────────────────────┐   │
│  │  GitHub   │ ───────────────► │        Vercel Build        │   │
│  │          │                  │                            │   │
│  │  main    │─── Production ──►│  1. pnpm install           │   │
│  │  branch  │                  │  2. ESLint 검사             │   │
│  │          │                  │  3. TypeScript 타입 체크     │   │
│  │  PR /    │─── Preview ────►│  4. next build             │   │
│  │  feature │                  │  5. 정적 자산 최적화          │   │
│  └──────────┘                  └─────────────┬──────────────┘   │
│                                              │                  │
│                                              ▼                  │
│                                 ┌────────────────────────┐      │
│                                 │     Vercel Deploy       │      │
│                                 │                        │      │
│                                 │  - Edge Network 배포    │      │
│                                 │  - CDN 캐시 무효화       │      │
│                                 │  - SSL 인증서 적용       │      │
│                                 │  - Health Check         │      │
│                                 └────────────┬───────────┘      │
│                                              │                  │
│                                              ▼                  │
│                                 ┌────────────────────────┐      │
│                                 │        Live!           │      │
│                                 │                        │      │
│                                 │  Production 또는        │      │
│                                 │  Preview URL 활성화     │      │
│                                 └────────────────────────┘      │
│                                                                 │
│  소요 시간: 약 1~3분 (프로젝트 규모에 따라 상이)                    │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 빌드 프로세스

#### 빌드 단계 상세

```bash
# Vercel이 실행하는 빌드 프로세스 (순차 실행)

# 1단계: 의존성 설치
pnpm install --frozen-lockfile

# 2단계: 코드 품질 검사 (package.json scripts에 정의)
pnpm lint          # ESLint 검사
pnpm type-check    # TypeScript 타입 체크 (tsc --noEmit)

# 3단계: Next.js 프로덕션 빌드
pnpm build         # next build

# 4단계: Vercel이 빌드 결과물을 Edge Network에 배포
```

> **참고**: `pnpm lint`와 `pnpm type-check`는 `next build` 이전에 실행되도록 `package.json`의 `build` 스크립트에 체이닝하는 것을 권장한다.

```json
{
  "scripts": {
    "build": "next build",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "prebuild": "pnpm lint && pnpm type-check"
  }
}
```

#### Standalone Output Mode 설정

Next.js standalone 출력 모드를 활성화하면 배포 크기를 대폭 줄일 수 있다. `next.config.js`에 다음을 추가한다.

```js
// next.config.js (또는 next.config.mjs)
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Vercel에서는 standalone이 자동 최적화되지만,
  // 명시적으로 설정하면 빌드 크기를 확인할 수 있다.
};

module.exports = nextConfig;
```

#### Bundle Analyzer 설정

번들 크기를 시각적으로 분석하기 위해 `@next/bundle-analyzer`를 설정한다.

```bash
# 설치
pnpm add -D @next/bundle-analyzer
```

```js
// next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... 기존 설정
};

module.exports = withBundleAnalyzer(nextConfig);
```

```bash
# 번들 분석 실행 (로컬)
ANALYZE=true pnpm build
# 빌드 완료 후 브라우저에서 번들 분석 리포트가 자동으로 열린다.
```

### 3.3 Preview Deployments

#### 개요

모든 Pull Request에 대해 Vercel이 자동으로 고유한 Preview URL을 생성한다. 이를 통해 코드 리뷰어가 변경 사항을 실제 환경에서 확인할 수 있다.

#### 작동 방식

1. 개발자가 feature 브랜치에서 PR을 생성한다.
2. Vercel이 해당 브랜치를 자동으로 빌드하고 Preview URL을 생성한다.
3. PR 코멘트에 Preview URL이 자동으로 게시된다.
4. PR에 새 커밋이 push될 때마다 Preview가 자동으로 재빌드된다.
5. PR이 merge/close되면 Preview 배포는 유지되지만 더 이상 업데이트되지 않는다.

```
PR #42: "feat: 오더북 깊이 바 애니메이션 추가"

  Vercel Bot commented:
  ┌─────────────────────────────────────────────────────┐
  │ Preview: https://crypto-dashboard-git-feat-orderbook│
  │          -animation-username.vercel.app              │
  │                                                     │
  │ Build Logs: https://vercel.com/...                  │
  │ Inspect:    https://vercel.com/...                  │
  └─────────────────────────────────────────────────────┘
```

#### Preview 환경 변수

Preview 배포에서 사용할 환경 변수는 Vercel 대시보드에서 **Preview** 스코프로 별도 설정할 수 있다.

| 환경       | Supabase 프로젝트          | 용도               |
| ---------- | -------------------------- | ------------------ |
| Production | `prod-project.supabase.co` | 실제 사용자 데이터 |
| Preview    | `dev-project.supabase.co`  | 테스트/개발 데이터 |

> **권장**: Preview 환경에서는 개발용 Supabase 프로젝트를 연결하여, PR 테스트 중 프로덕션 데이터에 영향을 주지 않도록 한다.

---

## 4. Supabase 프로덕션 설정

### 4.1 프로젝트 설정

#### 프로덕션 프로젝트 생성

개발 환경과 프로덕션 환경의 Supabase 프로젝트를 분리하는 것을 강력히 권장한다.

| 환경                | Supabase 프로젝트       | 용도              |
| ------------------- | ----------------------- | ----------------- |
| 로컬 개발           | `crypto-dashboard-dev`  | 개발 및 테스트    |
| Preview (Vercel)    | `crypto-dashboard-dev`  | PR Preview 테스트 |
| Production (Vercel) | `crypto-dashboard-prod` | 실제 운영         |

#### Supabase 프로젝트 생성 절차

1. [Supabase Dashboard](https://supabase.com/dashboard)에 접속한다.
2. **"New Project"** 클릭
3. 다음 정보를 입력한다:

| 항목              | 설정값                                                                 |
| ----------------- | ---------------------------------------------------------------------- |
| Organization      | 본인의 Organization 선택                                               |
| Name              | `crypto-dashboard-prod`                                                |
| Database Password | 강력한 비밀번호 생성 및 안전하게 보관                                  |
| Region            | 사용자 대다수의 지역과 가까운 리전 선택 (예: `Northeast Asia (Tokyo)`) |
| Pricing Plan      | Free tier (시작 시)                                                    |

4. **"Create new project"** 클릭 후 프로젝트 생성을 기다린다 (약 1~2분).

#### API 키 확인

프로젝트 생성 후, **Settings** → **API** 에서 다음 키를 확인한다:

| 키                | 위치                                               | Vercel 환경 변수                    |
| ----------------- | -------------------------------------------------- | ----------------------------------- |
| Project URL       | `Settings > API > Project URL`                     | `NEXT_PUBLIC_SUPABASE_URL`          |
| anon (public) key | `Settings > API > Project API keys > anon`         | `NEXT_PUBLIC_SUPABASE_ANON_KEY`     |
| service_role key  | `Settings > API > Project API keys > service_role` | **절대 클라이언트에 노출하지 않음** |

#### OAuth Redirect URL 설정

소셜 로그인(Google, GitHub)이 프로덕션 도메인에서 정상 동작하도록 Redirect URL을 설정한다.

1. Supabase Dashboard → **Authentication** → **URL Configuration**
2. **Site URL** 설정:

```
https://crypto-trading-dashboard.vercel.app
```

3. **Redirect URLs**에 다음을 추가:

```
# 프로덕션 도메인
https://crypto-trading-dashboard.vercel.app/**

# 커스텀 도메인 (있는 경우)
https://your-custom-domain.com/**

# Preview 배포 (와일드카드 패턴)
https://crypto-trading-dashboard-*-username.vercel.app/**

# 로컬 개발
http://localhost:3000/**
```

> **중요**: Redirect URL을 설정하지 않으면 OAuth 로그인 후 "Invalid redirect URL" 에러가 발생한다.

#### 데이터베이스 마이그레이션 전략

Supabase CLI를 활용하여 데이터베이스 스키마를 코드로 관리한다.

```bash
# Supabase CLI 설치
pnpm add -D supabase

# 프로젝트 초기화 (처음 한 번)
npx supabase init

# 로컬에서 마이그레이션 생성
npx supabase migration new create_user_layouts

# 마이그레이션 파일 작성 (supabase/migrations/ 디렉토리)
# 예: 20260225000000_create_user_layouts.sql
```

```sql
-- supabase/migrations/20260225000000_create_user_layouts.sql

-- 사용자 레이아웃 테이블
CREATE TABLE public.user_layouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  layout JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id)
);

-- 관심 종목 테이블
CREATE TABLE public.user_watchlists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  symbols TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id)
);

-- RLS 활성화
ALTER TABLE public.user_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_watchlists ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 사용자 본인의 데이터만 접근 가능
CREATE POLICY "Users can view own layout"
  ON public.user_layouts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own layout"
  ON public.user_layouts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own layout"
  ON public.user_layouts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own watchlist"
  ON public.user_watchlists FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own watchlist"
  ON public.user_watchlists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own watchlist"
  ON public.user_watchlists FOR UPDATE
  USING (auth.uid() = user_id);
```

```bash
# 프로덕션 Supabase에 마이그레이션 적용
npx supabase db push --linked
```

### 4.2 보안 설정

#### RLS (Row Level Security) 필수 활성화

RLS는 Supabase 보안의 핵심이다. 모든 테이블에 RLS를 활성화하고 적절한 정책을 설정해야 한다.

```sql
-- RLS가 활성화되어 있는지 확인
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

| RLS 상태               | 의미                                       |
| ---------------------- | ------------------------------------------ |
| RLS 활성화 + 정책 있음 | 정책에 맞는 데이터만 접근 가능 (정상)      |
| RLS 활성화 + 정책 없음 | 모든 접근 차단 (안전하지만 사용 불가)      |
| RLS 비활성화           | **위험!** anon key로 모든 데이터 접근 가능 |

#### Anon Key vs Service Role Key

| 키                       | 노출 가능 여부         | 용도                       | 권한                       |
| ------------------------ | ---------------------- | -------------------------- | -------------------------- |
| `anon` (공개 키)         | 클라이언트에 노출 가능 | 브라우저에서 Supabase 접근 | RLS 정책에 따라 제한됨     |
| `service_role` (비밀 키) | **절대 노출 금지**     | 서버 사이드에서만 사용     | RLS 우회, 모든 데이터 접근 |

> **핵심 원칙**: 본 프로젝트는 클라이언트 전용 아키텍처이므로 `service_role` 키를 사용할 필요가 없다. 만약 어드민 기능이 필요하다면, Supabase Dashboard에서 직접 수행하거나 별도의 서버 사이드 스크립트를 사용한다.

#### 추가 보안 권장 사항

1. **이메일 확인 활성화**: Authentication → Settings → Enable email confirmations
2. **비밀번호 정책 강화**: 최소 8자, 대소문자+숫자+특수문자 조합 (소셜 로그인 전용이면 해당 없음)
3. **JWT 만료 시간 설정**: 기본 3600초(1시간)가 적절. 자동 갱신으로 사용자 경험 유지.
4. **Rate Limiting**: Supabase 기본 Rate Limit이 적용되어 있으나, 무료 티어에서는 조정 불가.

---

## 5. 성능 최적화 (배포 관점)

### 5.1 Next.js 빌드 최적화

#### Static Generation (SSG) 활용

대시보드의 셸 페이지(레이아웃, 헤더, 사이드바)는 빌드 시점에 정적으로 생성하여 초기 로딩 속도를 극대화한다.

```tsx
// app/page.tsx
// Next.js App Router에서 기본적으로 Server Component이며,
// 동적 데이터가 없으면 자동으로 Static Generation이 적용된다.

export default function DashboardPage() {
  return (
    <main>
      {/* 정적 셸: 빌드 시 HTML로 생성됨 */}
      <DashboardHeader />

      {/* 동적 위젯: 클라이언트에서 hydration 후 WebSocket 연결 */}
      <DashboardGrid />
    </main>
  );
}
```

#### Dynamic Import로 무거운 라이브러리 지연 로딩

```tsx
// 캔들스틱 차트 (Lightweight Charts) - 동적 import
import dynamic from 'next/dynamic';

const CandlestickChart = dynamic(() => import('@/components/widgets/CandlestickChart'), {
  loading: () => <ChartSkeleton />,
  ssr: false, // Canvas 기반이므로 서버 사이드 렌더링 불필요
});

// 오더북 Canvas 렌더러 - 동적 import
const OrderBookWidget = dynamic(() => import('@/components/widgets/OrderBookWidget'), {
  loading: () => <OrderBookSkeleton />,
  ssr: false,
});
```

#### Image 최적화

```tsx
// next/image를 사용하여 자동 최적화
import Image from 'next/image';

// 로고 등 정적 이미지
<Image
  src="/logo.svg"
  alt="Crypto Dashboard"
  width={120}
  height={40}
  priority // LCP 요소는 priority 설정
/>;
```

#### Font 최적화

```tsx
// app/layout.tsx
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap', // FOIT 방지
  variable: '--font-inter',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
```

### 5.2 CDN 및 캐싱

#### Vercel Edge Network

Vercel은 전 세계에 분산된 Edge Network를 통해 정적 자산을 사용자에게 가장 가까운 서버에서 제공한다. 별도의 CDN 설정이 불필요하다.

```
사용자 요청 → 가장 가까운 Vercel Edge → 캐시 히트 시 즉시 응답
                                       → 캐시 미스 시 Origin에서 가져와 캐시 후 응답
```

#### Cache-Control 헤더 설정

```js
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // 정적 자산에 대한 캐시 헤더 (Next.js가 자동으로 설정하지만 커스텀 가능)
  async headers() {
    return [
      {
        // 정적 자산 (JS, CSS, 이미지): 1년 캐시 (immutable)
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // 폰트 파일: 1년 캐시
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};
```

#### Stale-While-Revalidate (API Route 사용 시)

본 프로젝트는 클라이언트 전용 아키텍처이므로 API Route 사용이 최소화되지만, 향후 필요 시 다음과 같이 설정한다.

```tsx
// app/api/symbols/route.ts (예시: 종목 목록 캐싱)
import { NextResponse } from 'next/server';

export async function GET() {
  const symbols = await fetchBinanceSymbols();

  return NextResponse.json(symbols, {
    headers: {
      // 5분간 캐시, 만료 후 백그라운드에서 갱신
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
```

### 5.3 번들 크기 관리

#### 목표

| 메트릭              | 목표        | 설명                               |
| ------------------- | ----------- | ---------------------------------- |
| 초기 JS 번들 (gzip) | **< 150KB** | 첫 페이지 로딩에 필요한 JavaScript |
| First Load JS       | **< 200KB** | Next.js 프레임워크 + 페이지 코드   |
| Largest Page Bundle | **< 300KB** | 모든 위젯 포함 시                  |

#### 코드 스플리팅 전략

```
초기 번들 (< 150KB gzip)
├── Next.js Runtime
├── React + ReactDOM
├── Zustand (상태 관리)
├── 대시보드 셸 (Header, Grid Layout)
└── 기본 스타일

지연 로딩 청크 (사용자 인터랙션 후 로딩)
├── lightweight-charts (캔들스틱 차트 라이브러리)
├── Canvas 렌더러 (오더북, 체결 내역)
├── Supabase Client (로그인 시점에 로딩)
├── react-grid-layout (드래그 시작 시)
└── 테마 설정 UI
```

#### Tree Shaking 검증

```bash
# 번들 분석 실행
ANALYZE=true pnpm build

# 빌드 결과에서 각 페이지의 번들 크기 확인
# next build 출력 예시:
# Route (app)                 Size     First Load JS
# ┌ ○ /                       5.2 kB   142 kB
# ├ ○ /_not-found             0 B      87 kB
# └ ○ /login                  2.1 kB   89 kB
```

#### @next/bundle-analyzer 사용법

```bash
# 1. 번들 분석 리포트 생성
ANALYZE=true pnpm build

# 2. 자동으로 열리는 브라우저에서 확인할 내용:
#    - 가장 큰 모듈 식별
#    - 중복 포함된 라이브러리 확인
#    - 사용하지 않는 코드 탐지

# 3. 문제가 발견되면:
#    - 큰 라이브러리를 dynamic import로 전환
#    - 부분 import 사용 (예: import { debounce } from 'lodash-es')
#    - 사용하지 않는 dependency 제거
```

---

## 6. 모니터링

### 6.1 Vercel Analytics

#### Web Vitals 모니터링

Vercel Analytics는 실제 사용자 데이터 기반(RUM, Real User Monitoring)으로 Web Vitals를 측정한다.

##### 설정 방법

1. Vercel Dashboard → 프로젝트 → **Analytics** 탭 이동
2. **"Enable"** 버튼 클릭 (무료 티어에서 사용 가능)
3. 프로젝트에 `@vercel/analytics` 패키지를 추가:

```bash
pnpm add @vercel/analytics
```

4. 루트 레이아웃에 Analytics 컴포넌트 추가:

```tsx
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

##### 모니터링 지표

| 지표                           | 설명                                  | 목표    |
| ------------------------------ | ------------------------------------- | ------- |
| LCP (Largest Contentful Paint) | 가장 큰 콘텐츠가 화면에 표시되는 시간 | < 2.0초 |
| FCP (First Contentful Paint)   | 첫 번째 콘텐츠가 표시되는 시간        | < 1.0초 |
| CLS (Cumulative Layout Shift)  | 레이아웃 이동 누적 점수               | < 0.1   |
| FID (First Input Delay)        | 첫 사용자 입력에 대한 응답 지연       | < 100ms |
| TTFB (Time to First Byte)      | 서버 응답까지의 시간                  | < 200ms |

#### Speed Insights 설정 (선택 사항)

더 상세한 성능 모니터링이 필요하면 Vercel Speed Insights를 추가한다.

```bash
pnpm add @vercel/speed-insights
```

```tsx
// app/layout.tsx
import { SpeedInsights } from '@vercel/speed-insights/next';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
```

### 6.2 에러 모니터링

#### Console 에러 추적 (기본)

프로덕션 환경에서의 에러를 추적하기 위해 전역 에러 핸들러를 설정한다.

```tsx
// app/error.tsx (Next.js App Router 에러 바운더리)
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // 프로덕션에서 에러 리포팅
  useEffect(() => {
    console.error('Application Error:', error);
    // 향후 Sentry 등 에러 추적 서비스로 전송
  }, [error]);

  return (
    <div>
      <h2>오류가 발생했습니다</h2>
      <button onClick={() => reset()}>다시 시도</button>
    </div>
  );
}
```

#### Sentry 통합 (선택 사항, 프로덕션 권장)

프로덕션 환경에서 체계적인 에러 추적이 필요하다면 Sentry를 통합한다.

```bash
# Sentry Next.js SDK 설치
pnpm add @sentry/nextjs

# Sentry 설정 마법사 실행
npx @sentry/wizard@latest -i nextjs
```

```js
// sentry.client.config.js
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 프로덕션에서만 활성화
  enabled: process.env.NODE_ENV === 'production',

  // 성능 모니터링 샘플링 비율
  tracesSampleRate: 0.1, // 10% 샘플링 (무료 티어 제한 고려)

  // 세션 리플레이 (에러 발생 시)
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.01, // 1% 세션만 기록

  integrations: [Sentry.replayIntegration()],
});
```

Sentry 무료 티어 한도:

| 항목          | 무료 티어 한도 |
| ------------- | -------------- |
| 에러 이벤트   | 5,000건/월     |
| 성능 트랜잭션 | 10,000건/월    |
| 세션 리플레이 | 50건/월        |

---

## 7. 배포 체크리스트

프로덕션 배포 전 아래 항목을 모두 확인한다.

### 7.1 코드 품질

- [ ] 모든 테스트 통과 (`pnpm test`)
- [ ] TypeScript 타입 에러 없음 (`pnpm type-check` 또는 `tsc --noEmit`)
- [ ] ESLint 경고/에러 없음 (`pnpm lint`)
- [ ] 프로덕션 코드에 `console.log` 제거 (디버깅용 로그만 `console.warn`/`console.error` 허용)
- [ ] 사용하지 않는 import 및 변수 제거

### 7.2 번들 및 성능

- [ ] 번들 크기 목표 이내 (초기 번들 < 150KB gzip)
- [ ] `ANALYZE=true pnpm build`로 번들 분석 완료
- [ ] 무거운 라이브러리 Dynamic Import 적용 확인 (lightweight-charts, canvas 렌더러 등)
- [ ] Lighthouse 성능 점수 > 90 (Chrome DevTools → Lighthouse 탭)
- [ ] CLS (Cumulative Layout Shift) < 0.1 확인

### 7.3 환경 및 인프라

- [ ] Vercel 환경 변수 설정 완료 (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- [ ] Production/Preview 환경별 환경 변수 분리 확인
- [ ] Supabase OAuth Redirect URL에 프로덕션 도메인 등록 완료
- [ ] Supabase RLS 정책 활성화 및 테스트 완료
- [ ] 데이터베이스 마이그레이션 프로덕션 적용 완료

### 7.4 기능 검증

- [ ] WebSocket 연결 정상 작동 (Binance 실시간 데이터 수신 확인)
- [ ] WebSocket 재연결 로직 테스트 (네트워크 단절 시뮬레이션)
- [ ] 소셜 로그인(Google, GitHub) 프로덕션 도메인에서 정상 동작
- [ ] 레이아웃 저장/복원 동작 확인 (localStorage 및 Supabase)
- [ ] 관심 종목 추가/제거 및 영속화 확인

### 7.5 UX 및 접근성

- [ ] Error Boundary가 각 위젯에 적용됨
- [ ] Meta 태그 설정 (title, description, viewport)
- [ ] Open Graph 태그 설정 (og:title, og:description, og:image)
- [ ] Favicon 및 앱 아이콘 설정 (`app/favicon.ico`, `app/apple-icon.png`)
- [ ] 다크/라이트 테마 전환 확인
- [ ] 반응형 레이아웃 (Desktop, Tablet, Mobile) 확인
- [ ] 키보드 접근성 확인 (Tab 순회, Enter/Space 활성화)

### 7.6 최종 검증

```bash
# 프로덕션 빌드 로컬 테스트
pnpm build && pnpm start

# Lighthouse CI 실행 (선택 사항)
npx lighthouse https://localhost:3000 --output=json --output=html

# 빌드 크기 확인
# next build 출력에서 "First Load JS" 값 확인
```

---

## 8. 롤백 전략

### 8.1 Vercel Instant Rollback

Vercel은 모든 배포의 스냅샷을 보관하며, 이전 배포로 **즉시 롤백**할 수 있다. 새로운 빌드 과정 없이 이전 배포 아티팩트를 그대로 활성화하므로 수 초 내에 완료된다.

### 8.2 Vercel 대시보드를 통한 롤백

1. [Vercel Dashboard](https://vercel.com/dashboard) 접속
2. 프로젝트 선택
3. **"Deployments"** 탭 클릭
4. 배포 목록에서 롤백하고자 하는 이전 배포를 찾는다
5. 해당 배포의 오른쪽 **"..."** 메뉴 클릭
6. **"Promote to Production"** 선택
7. 확인 대화상자에서 **"Promote"** 클릭

```
배포 목록 (Deployments 탭)
┌─────────────────────────────────────────────────────────────────┐
│ Deployment            Branch    Status      Age     Actions     │
├─────────────────────────────────────────────────────────────────┤
│ dpl_abc123 (Current)  main      Ready       2m ago  ...        │
│ dpl_xyz789            main      Ready       1h ago  ... → [Promote to Production]
│ dpl_def456            main      Ready       3h ago  ...        │
│ dpl_ghi012            main      Ready       1d ago  ...        │
└─────────────────────────────────────────────────────────────────┘
```

### 8.3 Vercel CLI를 통한 롤백

터미널에서 빠르게 롤백해야 하는 경우 Vercel CLI를 사용한다.

```bash
# Vercel CLI 설치 (최초 1회)
pnpm add -g vercel

# 로그인
vercel login

# 현재 프로덕션 배포 확인
vercel ls --prod

# 특정 배포 URL로 롤백
vercel promote [deployment-url]

# 예시:
vercel promote crypto-trading-dashboard-abc123.vercel.app

# 또는 배포 ID로 롤백
vercel promote dpl_xyz789
```

### 8.4 롤백 시 주의 사항

| 항목            | 설명                                                                               |
| --------------- | ---------------------------------------------------------------------------------- |
| 환경 변수       | 롤백 시 현재 설정된 환경 변수가 적용됨 (배포 당시의 환경 변수가 아님)              |
| DB 마이그레이션 | 코드를 롤백해도 데이터베이스 스키마는 롤백되지 않음. 하위 호환성 유지 필수.        |
| 캐시            | 롤백 후 일부 사용자에게 CDN 캐시된 이전 자산이 표시될 수 있음. 보통 수 분 내 갱신. |

### 8.5 롤백 프로세스 다이어그램

```
문제 감지 → 심각도 판단 → 롤백 결정
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
              긴급 (P0/P1)         일반 (P2/P3)
              Vercel CLI로          대시보드에서
              즉시 롤백              롤백 실행
                    │                   │
                    ▼                   ▼
              이전 배포 활성화 (수 초 이내)
                    │
                    ▼
              문제 원인 분석 → 수정 → 재배포
```

---

## 9. 비용 관리

### 9.1 Vercel 무료 티어 (Hobby Plan) 한도

| 항목                     | 무료 한도           | 초과 시                                       |
| ------------------------ | ------------------- | --------------------------------------------- |
| 대역폭 (Bandwidth)       | **100 GB/월**       | 서비스 중단 (다음 달까지 대기 또는 유료 전환) |
| Serverless Function 실행 | **100 GB-Hours/월** | 서비스 중단                                   |
| Edge Function 실행       | **500,000 호출/월** | 서비스 중단                                   |
| 빌드 실행 시간           | **6,000분/월**      | 빌드 큐 대기                                  |
| 동시 빌드                | **1개**             | 큐 대기                                       |
| 배포 수                  | **100회/일**        | 배포 불가                                     |
| 팀원 수                  | **1명**             | 유료 전환 필요                                |
| 도메인 수                | **50개**            | 추가 불가                                     |
| Analytics                | **2,500 이벤트/월** | 이벤트 수집 중단                              |

> **본 프로젝트에서의 예상 사용량**: 정적 자산만 서빙하고 실시간 데이터는 브라우저에서 직접 처리하므로, 대역폭 사용량은 매우 낮다. 월 500 UV 기준 약 1~5 GB/월 예상.

### 9.2 Supabase 무료 티어 (Free Plan) 한도

| 항목                        | 무료 한도           | 초과 시                               |
| --------------------------- | ------------------- | ------------------------------------- |
| 데이터베이스 크기           | **500 MB**          | 쓰기 차단                             |
| 파일 스토리지               | **1 GB**            | 업로드 차단                           |
| 대역폭 (DB + Storage)       | **5 GB/월**         | 서비스 중단                           |
| Auth 활성 사용자            | **50,000 MAU**      | 인증 실패                             |
| Edge Functions              | **500,000 호출/월** | 호출 실패                             |
| 실시간 메시지               | **2,000,000 건/월** | 메시지 전달 중단                      |
| 프로젝트 수                 | **2개**             | 추가 불가                             |
| 데이터베이스 자동 일시 중지 | **7일 비활동 시**   | 다음 요청 시 자동 재시작 (수 초 지연) |

> **주의**: Supabase 무료 티어에서는 7일 동안 데이터베이스 활동이 없으면 프로젝트가 자동으로 일시 중지(pause)된다. 포트폴리오 프로젝트의 경우 정기적으로 방문하거나, 간단한 헬스 체크 스크립트를 실행하여 일시 중지를 방지할 수 있다.

### 9.3 월간 비용 전망표

| 시나리오                    | Vercel 비용 | Supabase 비용 | 총 비용    | 비고                                 |
| --------------------------- | ----------- | ------------- | ---------- | ------------------------------------ |
| **개발 단계** (트래픽 없음) | $0          | $0            | **$0**     | 무료 티어 내                         |
| **포트폴리오** (월 500 UV)  | $0          | $0            | **$0**     | 대역폭 약 2 GB/월, DB 약 10 MB       |
| **성장기** (월 5,000 UV)    | $0          | $0            | **$0**     | 대역폭 약 20 GB/월, 여전히 무료 범위 |
| **활성** (월 20,000 UV)     | $0~$20      | $0            | **$0~$20** | 대역폭 80 GB/월 접근, Pro 전환 검토  |
| **대규모** (월 50,000+ UV)  | $20/월      | $25/월        | **$45/월** | Pro Plan 전환 필요                   |

> **핵심**: 실시간 데이터를 브라우저에서 직접 수신하는 아키텍처 덕분에, 서버 트래픽 비용이 발생하지 않는다. 사용자 수가 늘어도 Vercel/Supabase의 서버 측 비용 증가는 극히 미미하다. 비용의 대부분은 초기 정적 자산 서빙 대역폭이다.

### 9.4 비용 모니터링 방법

#### Vercel 사용량 확인

1. Vercel Dashboard → **Settings** → **Billing** → **Usage**
2. 대역폭, 빌드 시간, Function 실행 등의 현재 사용량과 한도를 확인할 수 있다.

#### Supabase 사용량 확인

1. Supabase Dashboard → 프로젝트 선택 → **Settings** → **Billing** → **Usage**
2. 데이터베이스 크기, API 요청 수, Auth 사용자 수 등을 확인할 수 있다.

#### 무료 티어 유지를 위한 팁

1. **정적 자산 최적화**: 이미지 압축, Next.js Image 최적화, 불필요한 폰트 제거로 대역폭 절약
2. **Supabase 쿼리 최소화**: 레이아웃 저장 시 debounce 적용 (500ms), 불필요한 DB 호출 방지
3. **배포 횟수 관리**: 하루 100회 배포 제한을 고려하여 불필요한 push 자제
4. **번들 크기 관리**: 번들이 작을수록 대역폭 사용량이 줄어든다
5. **CDN 캐시 활용**: 적절한 Cache-Control 헤더로 Origin 요청을 최소화

---

## 부록: 빠른 시작 가이드

처음부터 프로덕션 배포까지의 요약 절차:

```bash
# 1. 프로젝트 클론 및 의존성 설치
git clone https://github.com/your-username/crypto-trading-dashboard.git
cd crypto-trading-dashboard
pnpm install

# 2. 로컬 환경 변수 설정
cp .env.example .env.local
# .env.local 파일에 Supabase URL과 Anon Key 입력

# 3. 로컬 개발 서버 실행 및 동작 확인
pnpm dev

# 4. 코드 품질 검사
pnpm lint
pnpm type-check
pnpm test

# 5. 프로덕션 빌드 로컬 테스트
pnpm build
pnpm start

# 6. Vercel 배포
#    (Vercel 대시보드에서 GitHub 리포 연결 후 자동 배포)
#    또는 CLI 사용:
vercel --prod

# 7. Vercel 환경 변수 설정 (대시보드에서)
#    NEXT_PUBLIC_SUPABASE_URL
#    NEXT_PUBLIC_SUPABASE_ANON_KEY

# 8. Supabase 프로덕션 설정
#    - OAuth Redirect URL 등록
#    - RLS 정책 확인
#    - DB 마이그레이션 적용

# 9. 배포 확인
#    https://crypto-trading-dashboard.vercel.app 접속
#    WebSocket 연결, 실시간 데이터, 로그인 기능 확인

# 10. 모니터링 활성화
#     Vercel Analytics + Speed Insights 설정
```

---

_본 문서는 Real-time Crypto Trading Dashboard의 배포 가이드이다. 프로젝트의 아키텍처 변경 시 이 문서도 함께 업데이트한다._
