# Real-time Crypto Trading Dashboard - 개발 환경 설정 가이드

**문서 버전**: v1.0
**작성일**: 2026-02-25
**대상 독자**: 프로젝트에 참여하는 모든 개발자

본 문서는 Real-time Crypto Trading Dashboard 프로젝트의 개발 환경을 처음부터 구축하고, 로컬에서 실행하며, 외부 API와 연동하는 전체 과정을 다룬다. 이 문서만으로 프로젝트 셋업부터 배포까지 진행할 수 있도록 작성되었다.

---

## 목차

1. [사전 요구사항](#1-사전-요구사항)
2. [프로젝트 초기 설정](#2-프로젝트-초기-설정)
3. [로컬 개발 서버 실행](#3-로컬-개발-서버-실행)
4. [거래소 API 연결 가이드](#4-거래소-api-연결-가이드)
5. [Supabase 설정 가이드](#5-supabase-설정-가이드)
6. [개발 도구 설정](#6-개발-도구-설정)
7. [테스트 환경](#7-테스트-환경)
8. [성능 프로파일링 가이드](#8-성능-프로파일링-가이드)
9. [프로젝트 스크립트 목록](#9-프로젝트-스크립트-목록)
10. [트러블슈팅](#10-트러블슈팅)

---

## 1. 사전 요구사항

### 1.1 Node.js

- **필수 버전**: v20 LTS (v20.11.0 이상 권장)
- Node.js 20 LTS는 장기 지원 버전으로, 2026년 4월까지 Active LTS를 유지한다.
- `nvm`(Node Version Manager) 사용을 강력히 권장한다. 프로젝트 루트의 `.nvmrc` 파일로 팀 전체가 동일한 Node 버전을 사용할 수 있다.

```bash
# nvm으로 Node.js 20 LTS 설치
nvm install 20
nvm use 20

# 버전 확인
node -v  # v20.x.x
```

### 1.2 pnpm (패키지 매니저)

- **필수 버전**: v9 이상
- 본 프로젝트는 `pnpm`을 패키지 매니저로 사용한다.

**npm/yarn 대신 pnpm을 선택한 이유**:

| 항목 | pnpm | npm | yarn |
|------|------|-----|------|
| 디스크 사용량 | Content-addressable 저장소로 중복 제거. 전역에 한 번만 저장하고 심볼릭 링크로 참조 | 프로젝트마다 node_modules에 전체 복사 | npm과 동일하게 복사 (PnP 모드 제외) |
| 설치 속도 | 가장 빠름 (하드 링크 + 병렬 처리) | 느림 | pnpm보다 느림 |
| 유령 의존성 방지 | 엄격한 node_modules 구조로 package.json에 선언하지 않은 패키지 접근을 차단 | flat 구조로 유령 의존성 허용 | 동일 |
| 모노레포 지원 | 내장 workspace 프로토콜 지원 | workspaces 지원 (제한적) | workspaces 지원 |

```bash
# pnpm 전역 설치
npm install -g pnpm

# 또는 corepack으로 활성화 (Node.js 16.13+ 내장)
corepack enable
corepack prepare pnpm@latest --activate

# 버전 확인
pnpm -v  # 9.x.x
```

### 1.3 Git

- **필수 버전**: v2.40 이상 권장
- Git이 설치되어 있어야 하며, GitHub 계정과 SSH 키 또는 Personal Access Token이 설정되어 있어야 한다.

```bash
git --version  # git version 2.x.x
```

### 1.4 VS Code (권장 에디터)

본 프로젝트는 VS Code를 기본 에디터로 권장한다. 프로젝트에 `.vscode/settings.json`과 `.vscode/extensions.json`이 포함되어 있어 팀 전체가 동일한 개발 환경을 공유한다.

**필수 확장 프로그램**:

| 확장 프로그램 | ID | 용도 |
|--------------|-----|------|
| ESLint | `dbaeumer.vscode-eslint` | 실시간 린트 오류 표시 |
| Prettier | `esbenp.prettier-vscode` | 저장 시 자동 포맷팅 |
| TypeScript Importer | `pmneo.tsimporter` | 자동 import 경로 완성 |
| Tailwind CSS IntelliSense | `bradlc.vscode-tailwindcss` | Tailwind 클래스 자동완성 (사용 시) |
| Error Lens | `usernamehw.errorlens` | 에러/경고를 코드 라인에 인라인 표시 |
| GitLens | `eamodio.gitlens` | Git blame, 히스토리 인라인 표시 |
| Pretty TypeScript Errors | `yoavbls.pretty-ts-errors` | TypeScript 에러 메시지를 읽기 쉽게 변환 |
| Auto Rename Tag | `formulahendry.auto-rename-tag` | HTML/JSX 태그 자동 이름 동기화 |

**선택 확장 프로그램**:

| 확장 프로그램 | ID | 용도 |
|--------------|-----|------|
| Thunder Client | `rangav.vscode-thunder-client` | VS Code 내 REST API 테스트 |
| TODO Highlight | `wayou.vscode-todo-highlight` | TODO/FIXME 하이라이트 |
| Import Cost | `wix.vscode-import-cost` | import 크기 실시간 표시 |

### 1.5 브라우저

- **필수**: Chrome 최신 버전
- Chrome DevTools의 Performance 탭, Memory 탭, Network 탭의 WebSocket 프레임 인스펙터를 활용하여 프로파일링을 수행한다.
- React Developer Tools 확장 프로그램을 Chrome에 설치할 것을 권장한다.

---

## 2. 프로젝트 초기 설정

### 2.1 저장소 클론

```bash
# SSH 방식 (권장)
git clone git@github.com:<organization>/crypto-trading-dashboard.git

# HTTPS 방식
git clone https://github.com/<organization>/crypto-trading-dashboard.git

# 디렉토리 이동
cd crypto-trading-dashboard
```

### 2.2 의존성 설치

```bash
pnpm install
```

`pnpm-lock.yaml` 파일이 존재하므로, 정확히 동일한 버전의 패키지가 설치된다. **`npm install`이나 `yarn install`을 사용하지 말 것** -- lock 파일 불일치로 예측 불가능한 문제가 발생할 수 있다.

### 2.3 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 생성하고 아래 변수들을 설정한다.

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**환경 변수 설명**:

| 변수명 | 설명 | 노출 범위 |
|--------|------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트의 API URL | 클라이언트 (브라우저) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 익명(anon) 공개 키 | 클라이언트 (브라우저) |

> **보안 참고**: `NEXT_PUBLIC_` 접두어가 붙은 변수는 Next.js 빌드 시 클라이언트 번들에 포함된다. Supabase의 `anon key`는 **의도적으로 공개용으로 설계된 키**이다. 이 키는 Supabase의 Row Level Security(RLS) 정책에 의해 보호되므로, 클라이언트에 노출되어도 안전하다. 실제 데이터 접근 권한은 RLS 정책이 제어한다. 단, `service_role` 키는 **절대로** 클라이언트에 노출해서는 안 된다.

### 2.4 .env.example 파일

팀원 온보딩을 위해 프로젝트 루트에 `.env.example` 파일이 포함되어 있다.

```bash
# .env.example
# Supabase 설정 (https://supabase.com 에서 프로젝트 생성 후 Settings > API에서 확인)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

새로운 팀원은 아래 명령으로 `.env.local`을 생성한다:

```bash
cp .env.example .env.local
# 이후 실제 값으로 교체
```

> `.env.local`은 `.gitignore`에 포함되어 있으므로 Git에 커밋되지 않는다.

---

## 3. 로컬 개발 서버 실행

### 3.1 개발 서버 시작

```bash
pnpm dev
```

- **기본 포트**: `http://localhost:3000`
- 포트가 이미 사용 중이면 Next.js가 자동으로 다음 사용 가능한 포트(3001, 3002 등)를 할당한다.
- 특정 포트를 지정하려면:

```bash
pnpm dev --port 3001
```

### 3.2 Hot Reload (Fast Refresh)

Next.js의 Fast Refresh가 활성화되어 있어, 코드 변경 시 브라우저가 자동으로 업데이트된다.

**동작 방식**:
- **React 컴포넌트 파일 수정**: 컴포넌트 상태를 유지한 채로 변경 사항만 반영한다 (Hot Module Replacement).
- **비-컴포넌트 파일 수정** (유틸리티, 상수, 타입 등): 전체 모듈이 리로드된다.
- **CSS/스타일 수정**: 즉시 반영된다 (전체 리로드 없음).
- **`.env.local` 수정**: 개발 서버를 재시작해야 한다 (`Ctrl+C` 후 `pnpm dev`).

### 3.3 대시보드 접근

개발 서버가 시작되면 브라우저에서 아래 URL로 접근한다:

```
http://localhost:3000
```

- 기본 대시보드가 BTC/USDT 데이터와 함께 로딩된다.
- 특정 심볼로 직접 접근하려면 쿼리 파라미터를 사용한다:

```
http://localhost:3000?symbol=ETHUSDT
```

---

## 4. 거래소 API 연결 가이드

본 프로젝트는 거래소의 **퍼블릭 API만** 사용한다. API 키나 시크릿은 필요하지 않다.

### 4.1 Binance WebSocket API

#### 기본 정보

| 항목 | 내용 |
|------|------|
| 엔드포인트 | `wss://stream.binance.com:9443` |
| 인증 | 불필요 (퍼블릭 스트림) |
| 프로토콜 | WebSocket |
| 데이터 형식 | JSON |

#### Combined Stream (복합 스트림)

본 프로젝트는 Combined Stream 방식을 사용하여 단일 WebSocket 연결로 여러 스트림을 동시에 구독한다.

**URL 형식**:
```
wss://stream.binance.com:9443/stream?streams=<streamName1>/<streamName2>/<streamName3>
```

**예시** (BTC/USDT의 캔들 + 호가 + 체결을 단일 연결로 구독):
```
wss://stream.binance.com:9443/stream?streams=btcusdt@kline_1m/btcusdt@depth@100ms/btcusdt@trade
```

Combined Stream에서 수신하는 메시지는 다음과 같은 래퍼 형식을 가진다:

```json
{
  "stream": "btcusdt@kline_1m",
  "data": {
    // 실제 스트림 데이터
  }
}
```

`stream` 필드를 파싱하여 메시지 타입을 분기한다.

#### 사용 스트림 목록

**1. Kline (캔들스틱) 스트림**

- 형식: `<symbol>@kline_<interval>`
- 예시: `btcusdt@kline_1m`, `ethusdt@kline_5m`, `btcusdt@kline_1h`
- 지원 인터벌: `1m`, `3m`, `5m`, `15m`, `30m`, `1h`, `2h`, `4h`, `6h`, `8h`, `12h`, `1d`, `3d`, `1w`, `1M`
- 본 프로젝트에서 사용하는 인터벌: `1m`, `5m`, `15m`, `1h`, `4h`, `1d`

```json
// Kline 메시지 예시
{
  "e": "kline",
  "E": 1672515782136,
  "s": "BTCUSDT",
  "k": {
    "t": 1672515780000,    // 캔들 시작 시간
    "T": 1672515839999,    // 캔들 종료 시간
    "s": "BTCUSDT",
    "i": "1m",             // 인터벌
    "o": "16800.00",       // 시가 (Open)
    "c": "16810.50",       // 종가 (Close)
    "h": "16815.00",       // 고가 (High)
    "l": "16798.00",       // 저가 (Low)
    "v": "125.45",         // 거래량 (Volume)
    "x": false             // 캔들 마감 여부 (true = 확정된 캔들)
  }
}
```

> `k.x` 필드가 핵심이다. `false`이면 현재 진행 중인 캔들이므로 `update()`로 처리하고, `true`이면 확정된 캔들이므로 `addData()`로 처리한다.

**2. Depth (호가) 스트림**

- 형식: `<symbol>@depth@100ms`
- 예시: `btcusdt@depth@100ms`
- diff 방식으로 변경된 호가만 전송한다 (100ms 주기).
- 수량이 `0`인 가격 레벨은 해당 레벨 삭제를 의미한다.

```json
// Depth 메시지 예시
{
  "e": "depthUpdate",
  "E": 1672515782136,
  "s": "BTCUSDT",
  "U": 157,               // First update ID
  "u": 160,               // Final update ID
  "b": [                   // Bids (매수)
    ["16800.00", "1.500"], // [가격, 수량] -- 수량 0이면 해당 가격 레벨 삭제
    ["16799.50", "0.000"]  // 이 레벨은 삭제
  ],
  "a": [                   // Asks (매도)
    ["16801.00", "2.300"],
    ["16802.00", "0.800"]
  ]
}
```

**3. Trade (체결) 스트림**

- 형식: `<symbol>@trade`
- 예시: `btcusdt@trade`
- 개별 체결 건이 실시간으로 전송된다.

```json
// Trade 메시지 예시
{
  "e": "trade",
  "E": 1672515782136,
  "s": "BTCUSDT",
  "t": 12345,            // Trade ID
  "p": "16800.50",       // 가격
  "q": "0.150",          // 수량
  "T": 1672515782136,    // 체결 시간
  "m": true              // Buyer is maker? (true = 매도 체결, false = 매수 체결)
}
```

> `m` 필드 주의: `true`이면 매수자(buyer)가 maker이므로 매도(sell) 체결로 해석한다. `false`이면 매수(buy) 체결이다.

**4. Mini Ticker (24시간 통계) 스트림**

- 형식: `<symbol>@miniTicker`
- 예시: `btcusdt@miniTicker`
- 관심 종목 위젯에서 실시간 가격과 24시간 변동률 표시에 사용한다.

```json
// Mini Ticker 메시지 예시
{
  "e": "24hrMiniTicker",
  "E": 1672515782136,
  "s": "BTCUSDT",
  "c": "16810.50",       // 현재가 (Close)
  "o": "16500.00",       // 24시간 시가 (Open)
  "h": "16900.00",       // 24시간 고가
  "l": "16400.00",       // 24시간 저가
  "v": "28500.50",       // 24시간 거래량
  "q": "475000000.00"    // 24시간 거래대금
}
```

#### 연결 제한

| 제한 항목 | 수치 | 비고 |
|-----------|------|------|
| IP당 최대 WebSocket 연결 수 | 5개 | Combined Stream을 활용하여 1~2개로 유지할 것 |
| 연결당 최대 스트림 수 | 1,024개 | 충분한 여유 |
| 메시지 전송 속도 (subscribe/unsubscribe) | 초당 5건 | 구독 변경 시 debounce 적용 필요 |
| 연결 유지 시간 | 24시간 | 24시간 후 자동 끊김, 재연결 로직 필수 |

#### 한국 IP 접근 제한

> **중요**: Binance는 한국 IP에서의 접근을 제한할 수 있다. 한국에서 개발하는 경우 VPN(Virtual Private Network)을 사용해야 할 수 있다. 일본, 싱가포르 등의 VPN 서버 연결을 권장한다. VPN 없이 테스트하려면 [섹션 10 트러블슈팅](#101-binance-websocket-연결-실패)을 참고하라.

### 4.2 Binance REST API

#### 기본 정보

| 항목 | 내용 |
|------|------|
| Base URL | `https://api.binance.com` |
| 인증 | 불필요 (퍼블릭 엔드포인트) |
| 형식 | JSON |
| Rate Limit | IP당 1,200 요청/분 |

#### 사용 엔드포인트

**1. GET /api/v3/klines -- 과거 캔들 데이터**

차트 초기 로딩 시 과거 500개 캔들을 불러오는 데 사용한다.

```
GET https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=500
```

| 파라미터 | 필수 | 설명 |
|----------|------|------|
| `symbol` | Yes | 심볼 (예: `BTCUSDT`) |
| `interval` | Yes | 캔들 인터벌 (예: `1m`, `5m`, `1h`) |
| `limit` | No | 캔들 수 (기본 500, 최대 1000) |
| `startTime` | No | 시작 시간 (밀리초 타임스탬프) |
| `endTime` | No | 종료 시간 (밀리초 타임스탬프) |

```json
// 응답 형식 (배열의 배열)
[
  [
    1672515780000,   // Open time
    "16800.00",      // Open
    "16815.00",      // High
    "16798.00",      // Low
    "16810.50",      // Close
    "125.45",        // Volume
    1672515839999,   // Close time
    "2107500.00",    // Quote asset volume
    150,             // Number of trades
    "62.70",         // Taker buy base volume
    "1053700.00",    // Taker buy quote volume
    "0"              // Ignore
  ]
]
```

**2. GET /api/v3/depth -- 오더북 스냅샷**

오더북 초기화 및 WebSocket 시퀀스 갭 복구 시 사용한다.

```
GET https://api.binance.com/api/v3/depth?symbol=BTCUSDT&limit=1000
```

| 파라미터 | 필수 | 설명 |
|----------|------|------|
| `symbol` | Yes | 심볼 |
| `limit` | No | 호가 깊이 (5, 10, 20, 50, 100, 500, 1000; 기본 100) |

```json
// 응답 형식
{
  "lastUpdateId": 1027024,
  "bids": [
    ["16800.00", "1.500"],  // [가격, 수량]
    ["16799.50", "2.300"]
  ],
  "asks": [
    ["16801.00", "0.800"],
    ["16802.00", "1.200"]
  ]
}
```

> `lastUpdateId`를 기록하여 WebSocket diff 이벤트와의 시퀀스를 관리한다. diff 이벤트의 `U <= lastUpdateId+1`이고 `u >= lastUpdateId+1`인 이벤트부터 적용한다.

**3. GET /api/v3/exchangeInfo -- 심볼 목록 및 거래 규칙**

심볼 검색 UI에서 사용 가능한 거래 쌍 목록을 불러오는 데 사용한다.

```
GET https://api.binance.com/api/v3/exchangeInfo
```

응답이 매우 크므로 (수 MB), 앱 초기화 시 한 번만 호출하고 결과를 캐싱한다. USDT 마켓 심볼만 필터링하여 사용한다.

```json
// 응답 중 필요한 부분
{
  "symbols": [
    {
      "symbol": "BTCUSDT",
      "status": "TRADING",
      "baseAsset": "BTC",
      "quoteAsset": "USDT",
      "baseAssetPrecision": 8,
      "quotePrecision": 8,
      "filters": [...]
    }
  ]
}
```

#### Rate Limit 관리

- IP당 1,200 요청/분 (weight 기준)
- 각 엔드포인트의 weight:
  - `/api/v3/klines`: weight 2
  - `/api/v3/depth` (limit 1000): weight 10
  - `/api/v3/exchangeInfo`: weight 20
- 응답 헤더의 `X-MBX-USED-WEIGHT-1M`으로 현재 사용량을 확인할 수 있다
- 초과 시 HTTP 429 응답과 함께 `Retry-After` 헤더가 반환된다

### 4.3 Upbit API (Phase 2 참조)

Phase 2에서 한국 원화(KRW) 마켓 지원을 위해 Upbit API를 연동할 계획이다. 아래는 향후 참조를 위한 개요이다.

#### WebSocket

| 항목 | 내용 |
|------|------|
| 엔드포인트 | `wss://api.upbit.com/websocket/v1` |
| 인증 | 불필요 (퍼블릭 스트림) |
| 구독 방식 | 연결 후 JSON 배열로 구독 메시지 전송 |

```json
// 구독 메시지 예시
[
  {"ticket": "unique-ticket-id"},
  {"type": "ticker", "codes": ["KRW-BTC", "KRW-ETH"]},
  {"type": "trade", "codes": ["KRW-BTC"]},
  {"type": "orderbook", "codes": ["KRW-BTC"]}
]
```

#### REST API

| 항목 | 내용 |
|------|------|
| Base URL | `https://api.upbit.com/v1` |
| 주요 엔드포인트 | `/candles/minutes/{unit}`, `/orderbook`, `/trades/ticks` |
| Rate Limit | 초당 10회 (퍼블릭 API) |

> Upbit는 한국 거래소이므로 한국 IP에서 접근 제한 없이 사용 가능하다. Binance 접근이 제한되는 환경에서 대안으로 활용할 수 있다.

---

## 5. Supabase 설정 가이드

Supabase는 사용자 인증(OAuth)과 데이터 영속화(레이아웃, 관심 종목 저장)에만 사용한다. 실시간 시세 데이터는 거래소 WebSocket에서 직접 수신하므로, Supabase 무료 티어의 사용량 한도 내에서 충분히 운영 가능하다.

### 5.1 프로젝트 생성

1. [https://supabase.com](https://supabase.com) 에 접속하여 GitHub 계정으로 로그인한다.
2. **"New Project"** 를 클릭한다.
3. 프로젝트 정보를 입력한다:
   - **Organization**: 개인 또는 팀 조직 선택
   - **Name**: `crypto-trading-dashboard`
   - **Database Password**: 안전한 비밀번호 설정 (나중에 직접 DB 접근 시 필요)
   - **Region**: 사용자 기반에 가까운 리전 선택 (한국: Northeast Asia - Tokyo)
   - **Pricing Plan**: Free 선택
4. 프로젝트 생성 완료 후 **Settings > API** 에서 다음 값을 확인한다:
   - **Project URL**: `NEXT_PUBLIC_SUPABASE_URL`에 사용
   - **anon public key**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`에 사용

### 5.2 Auth Providers 설정

#### Google OAuth 설정

**1단계: Google Cloud Console에서 OAuth 2.0 클라이언트 생성**

1. [Google Cloud Console](https://console.cloud.google.com) 접속
2. 프로젝트 생성 또는 기존 프로젝트 선택
3. **APIs & Services > Credentials** 이동
4. **"+ CREATE CREDENTIALS" > "OAuth client ID"** 클릭
5. Application type: **Web application**
6. Name: `Crypto Dashboard`
7. Authorized redirect URIs에 다음을 추가:
   ```
   https://your-project-id.supabase.co/auth/v1/callback
   ```
8. **Client ID**와 **Client Secret**을 메모한다.

**2단계: Supabase에서 Google Provider 활성화**

1. Supabase Dashboard > **Authentication > Providers**
2. **Google** 항목을 클릭하여 활성화
3. **Client ID**와 **Client Secret**을 입력
4. 저장

#### GitHub OAuth 설정

**1단계: GitHub에서 OAuth App 생성**

1. [GitHub Settings > Developer settings > OAuth Apps](https://github.com/settings/developers) 이동
2. **"New OAuth App"** 클릭
3. 정보 입력:
   - **Application name**: `Crypto Trading Dashboard`
   - **Homepage URL**: `https://your-domain.vercel.app` (또는 `http://localhost:3000` 개발 시)
   - **Authorization callback URL**:
     ```
     https://your-project-id.supabase.co/auth/v1/callback
     ```
4. **Client ID**와 **Client Secret**을 메모한다.

**2단계: Supabase에서 GitHub Provider 활성화**

1. Supabase Dashboard > **Authentication > Providers**
2. **GitHub** 항목을 클릭하여 활성화
3. **Client ID**와 **Client Secret**을 입력
4. 저장

#### Redirect URL 구성

개발 환경과 프로덕션 환경 모두 지원하려면 Supabase Dashboard > **Authentication > URL Configuration**에서 다음을 설정한다:

| 항목 | 값 |
|------|-----|
| Site URL | `https://your-domain.vercel.app` |
| Redirect URLs | `http://localhost:3000/**`, `https://your-domain.vercel.app/**` |

> `/**` 와일드카드를 추가하여 모든 하위 경로에서의 리디렉트를 허용한다.

### 5.3 데이터베이스 테이블 생성

Supabase SQL Editor에서 다음 SQL을 실행하여 필요한 테이블을 생성한다.

#### user_layouts 테이블

사용자의 대시보드 레이아웃(위젯 종류, 위치, 크기, 심볼 설정)을 저장한다.

```sql
CREATE TABLE public.user_layouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL DEFAULT 'Default',
  layout JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- user_id 기준 인덱스 (조회 성능 최적화)
CREATE INDEX idx_user_layouts_user_id ON public.user_layouts(user_id);

-- 활성 레이아웃 조회를 위한 복합 인덱스
CREATE INDEX idx_user_layouts_user_active ON public.user_layouts(user_id, is_active);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_layouts_updated_at
  BEFORE UPDATE ON public.user_layouts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

**`layout` JSONB 필드의 구조 예시**:

```json
{
  "widgets": [
    {
      "i": "chart-1",
      "type": "candlestick",
      "symbol": "BTCUSDT",
      "interval": "1m",
      "x": 0, "y": 0, "w": 8, "h": 4
    },
    {
      "i": "orderbook-1",
      "type": "orderbook",
      "symbol": "BTCUSDT",
      "depth": 25,
      "x": 8, "y": 0, "w": 4, "h": 4
    },
    {
      "i": "trades-1",
      "type": "trades",
      "symbol": "BTCUSDT",
      "x": 8, "y": 4, "w": 4, "h": 3
    }
  ],
  "activeSymbol": "BTCUSDT"
}
```

#### user_watchlists 테이블

사용자의 관심 종목 목록을 저장한다.

```sql
CREATE TABLE public.user_watchlists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  symbols TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT max_symbols CHECK (array_length(symbols, 1) <= 20 OR symbols = '{}')
);

-- user_id 유니크 (사용자당 하나의 관심 종목 목록)
CREATE UNIQUE INDEX idx_user_watchlists_user_id ON public.user_watchlists(user_id);

-- updated_at 자동 갱신 트리거
CREATE TRIGGER trigger_user_watchlists_updated_at
  BEFORE UPDATE ON public.user_watchlists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

### 5.4 RLS (Row Level Security) 정책 설정

Supabase에서 RLS는 데이터 보안의 핵심이다. 각 사용자가 오직 자신의 데이터만 읽고 쓸 수 있도록 정책을 설정한다.

```sql
-- user_layouts 테이블 RLS 활성화
ALTER TABLE public.user_layouts ENABLE ROW LEVEL SECURITY;

-- 자신의 레이아웃만 조회 가능
CREATE POLICY "Users can view own layouts"
  ON public.user_layouts
  FOR SELECT
  USING (auth.uid() = user_id);

-- 자신의 레이아웃만 생성 가능
CREATE POLICY "Users can create own layouts"
  ON public.user_layouts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 자신의 레이아웃만 수정 가능
CREATE POLICY "Users can update own layouts"
  ON public.user_layouts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 자신의 레이아웃만 삭제 가능
CREATE POLICY "Users can delete own layouts"
  ON public.user_layouts
  FOR DELETE
  USING (auth.uid() = user_id);

-- user_watchlists 테이블 RLS 활성화
ALTER TABLE public.user_watchlists ENABLE ROW LEVEL SECURITY;

-- 자신의 관심 종목만 조회 가능
CREATE POLICY "Users can view own watchlist"
  ON public.user_watchlists
  FOR SELECT
  USING (auth.uid() = user_id);

-- 자신의 관심 종목만 생성 가능
CREATE POLICY "Users can create own watchlist"
  ON public.user_watchlists
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 자신의 관심 종목만 수정 가능
CREATE POLICY "Users can update own watchlist"
  ON public.user_watchlists
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 자신의 관심 종목만 삭제 가능
CREATE POLICY "Users can delete own watchlist"
  ON public.user_watchlists
  FOR DELETE
  USING (auth.uid() = user_id);
```

### 5.5 프로젝트 내 Supabase 클라이언트 초기화

프로젝트에서 Supabase 클라이언트는 다음과 같이 초기화한다:

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,    // JWT 토큰 자동 갱신
    persistSession: true,      // 세션 localStorage 유지
    detectSessionInUrl: true,  // OAuth 리디렉트 후 세션 감지
  },
});
```

> 이 클라이언트 인스턴스는 앱 전체에서 싱글톤으로 재사용한다. 컴포넌트마다 `createClient`를 호출하지 말 것.

---

## 6. 개발 도구 설정

### 6.1 ESLint 설정

본 프로젝트의 ESLint 설정은 코드 품질과 성능 최적화를 모두 고려한다.

**핵심 규칙**:

```json
// .eslintrc.json
{
  "extends": [
    "next/core-web-vitals",
    "next/typescript",
    "prettier"
  ],
  "rules": {
    // --- 필수 규칙 ---
    "react-hooks/exhaustive-deps": "error",
    "react-hooks/rules-of-hooks": "error",
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }
    ],
    "@typescript-eslint/no-explicit-any": "warn",
    "no-console": [
      "warn",
      {
        "allow": ["warn", "error"]
      }
    ],

    // --- 성능 관련 커스텀 규칙 ---
    "react/jsx-no-constructed-context-values": "error",
    "react/no-unstable-nested-components": "error",
    "react/jsx-no-bind": [
      "warn",
      {
        "allowArrowFunctions": true,
        "allowFunctions": false,
        "allowBind": false
      }
    ]
  },
  "overrides": [
    {
      "files": ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts"],
      "rules": {
        "no-console": "off",
        "@typescript-eslint/no-explicit-any": "off"
      }
    }
  ]
}
```

**규칙 설명**:

| 규칙 | 수준 | 이유 |
|------|------|------|
| `react-hooks/exhaustive-deps` | error | WebSocket 구독/해제, Canvas cleanup 등에서 의존성 누락은 메모리 누수로 직결된다 |
| `@typescript-eslint/no-unused-vars` | error | 미사용 변수는 코드 가독성을 떨어뜨린다. `_` 접두어로 의도적 무시 표시 |
| `no-console` | warn | `console.log`는 프로덕션에서 불필요한 문자열 직렬화를 유발한다. `warn`/`error`만 허용 |
| `jsx-no-constructed-context-values` | error | 매 렌더마다 새 객체를 Context value로 전달하면 모든 consumer가 리렌더된다 |
| `no-unstable-nested-components` | error | 렌더 함수 내 컴포넌트 정의는 매번 새 인스턴스를 생성하여 상태 초기화를 유발한다 |
| `jsx-no-bind` | warn | 인라인 함수 바인딩은 매 렌더마다 새 참조를 생성한다 (arrow function은 허용) |

### 6.2 Prettier 설정

```json
// .prettierrc
{
  "semi": true,
  "trailingComma": "all",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf",
  "jsxSingleQuote": false,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

**설정 근거**:

| 옵션 | 값 | 이유 |
|------|-----|------|
| `semi: true` | 세미콜론 사용 | ASI(Automatic Semicolon Insertion) 함정 방지 |
| `trailingComma: "all"` | 후행 쉼표 | Git diff가 깔끔해지며 줄 추가/삭제 시 불필요한 변경을 줄인다 |
| `singleQuote: true` | 작은따옴표 | JSX에서는 큰따옴표(`jsxSingleQuote: false`)를 사용하여 HTML 관행을 따른다 |
| `printWidth: 100` | 줄 길이 100자 | 80자는 TypeScript의 긴 타입 선언에 너무 좁고, 120자는 노트북 화면에 불편 |
| `endOfLine: "lf"` | LF 줄바꿈 | Windows/Mac 혼합 환경에서 Git diff 오염 방지 |

**Prettier 무시 파일** (`.prettierignore`):

```
node_modules/
.next/
out/
coverage/
pnpm-lock.yaml
```

### 6.3 Husky + lint-staged

Git 훅을 통해 커밋 전 코드 품질을 자동으로 검증한다.

**설치 및 초기화**:

```bash
pnpm add -D husky lint-staged
pnpm exec husky init
```

**Pre-commit 훅** (`.husky/pre-commit`):

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

pnpm exec lint-staged
```

**lint-staged 설정** (`package.json` 내):

```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix --max-warnings=0",
      "prettier --write"
    ],
    "*.{json,md,css}": [
      "prettier --write"
    ]
  }
}
```

- `--max-warnings=0`: 경고도 0건이어야 커밋이 통과한다. 경고를 방치하면 쌓이기 때문에 엄격하게 관리한다.

**Pre-push 훅** (`.husky/pre-push`):

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

pnpm type-check
```

- `pnpm type-check`는 `tsc --noEmit`을 실행한다.
- 푸시 전에 전체 프로젝트의 TypeScript 타입 오류를 검증한다.
- CI에서도 타입 검사를 수행하지만, 로컬에서 미리 잡으면 피드백 루프가 빨라진다.

### 6.4 VS Code 추천 설정

프로젝트 루트에 다음 파일들을 포함한다:

**`.vscode/extensions.json`** (권장 확장 프로그램):

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "pmneo.tsimporter",
    "bradlc.vscode-tailwindcss",
    "usernamehw.errorlens",
    "eamodio.gitlens",
    "yoavbls.pretty-ts-errors",
    "formulahendry.auto-rename-tag"
  ]
}
```

**`.vscode/settings.json`** (프로젝트 설정):

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "explicit"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "editor.tabSize": 2,
  "files.eol": "\n",
  "files.trimTrailingWhitespace": true,
  "files.insertFinalNewline": true,
  "search.exclude": {
    "**/node_modules": true,
    "**/.next": true,
    "**/coverage": true
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[json]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

---

## 7. 테스트 환경

### 7.1 Vitest (단위 테스트)

#### 설정

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/test/**',
        'src/**/index.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

#### 테스트 실행 명령

```bash
# 단위 테스트 실행
pnpm test

# Watch 모드 (파일 변경 시 자동 재실행)
pnpm test --watch

# 커버리지 리포트 생성
pnpm test:coverage
```

#### 주요 테스트 대상

| 대상 | 설명 | 예시 |
|------|------|------|
| Zustand 스토어 | 상태 변경 로직, selector 동작 검증 | `useDepthStore`에 depth 이벤트 적용 후 정렬 검증 |
| WebSocket 메시지 파서 | JSON 파싱, 타입 분기, 데이터 변환 | Kline 메시지를 차트 데이터 형식으로 변환 |
| 링 버퍼 (Ring Buffer) | 삽입, 오버플로, 순회 동작 검증 | 200건 초과 시 가장 오래된 항목 덮어쓰기 확인 |
| 유틸리티 함수 | 포맷터, 계산 로직, 순수 함수 | 가격 포맷팅, 변동률 계산, debounce |
| 오더북 자료구조 | 호가 정렬, upsert, 삭제 동작 | 수량 0인 레벨 삭제, 새 레벨 삽입 후 정렬 유지 |

#### 테스트 작성 예시

```typescript
// src/stores/__tests__/useTradeStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useTradeStore } from '../useTradeStore';

describe('useTradeStore', () => {
  beforeEach(() => {
    useTradeStore.getState().reset();
  });

  it('새 체결 데이터를 링 버퍼에 추가한다', () => {
    const trade = {
      id: 1,
      price: 16800.5,
      quantity: 0.15,
      time: Date.now(),
      isBuyerMaker: false,
    };

    useTradeStore.getState().addTrade(trade);

    const trades = useTradeStore.getState().trades;
    expect(trades).toHaveLength(1);
    expect(trades[0].price).toBe(16800.5);
  });

  it('200건 초과 시 가장 오래된 항목을 덮어쓴다', () => {
    for (let i = 0; i < 250; i++) {
      useTradeStore.getState().addTrade({
        id: i,
        price: 16800 + i,
        quantity: 0.1,
        time: Date.now() + i,
        isBuyerMaker: i % 2 === 0,
      });
    }

    const trades = useTradeStore.getState().trades;
    expect(trades).toHaveLength(200);
  });
});
```

### 7.2 Playwright (E2E 테스트)

#### 설정

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
```

#### 테스트 실행 명령

```bash
# E2E 테스트 실행
pnpm test:e2e

# 특정 브라우저에서만 실행
pnpm test:e2e --project=chromium

# UI 모드 (시각적 디버깅)
pnpm exec playwright test --ui

# 테스트 리포트 확인
pnpm exec playwright show-report
```

#### 주요 E2E 테스트 시나리오

| 시나리오 | 검증 내용 |
|----------|-----------|
| WebSocket 연결 | 대시보드 접속 시 WebSocket 연결 성공 및 데이터 수신 확인 |
| 위젯 인터랙션 | 드래그 앤 드롭 이동, 리사이즈, 위젯 추가/제거 |
| 심볼 변경 | 심볼 검색 -> 선택 -> 차트/오더북/체결 내역 데이터 전환 확인 |
| 레이아웃 영속성 | 레이아웃 변경 -> 페이지 새로고침 -> 변경 사항 복원 확인 |
| 타임프레임 전환 | 차트 타임프레임 변경 -> 새 캔들 데이터 로딩 확인 |
| 연결 복구 | 네트워크 단절 시뮬레이션 -> 재연결 -> 데이터 정합성 확인 |

---

## 8. 성능 프로파일링 가이드

본 프로젝트의 핵심 가치는 **60fps 실시간 렌더링**과 **장시간 운용 안정성**이다. 다음 도구들을 활용하여 정기적으로 성능을 검증한다.

### 8.1 Chrome DevTools Performance 탭

프레임 레이트, Long Task, 렌더링 파이프라인을 분석한다.

**프로파일링 절차**:

1. Chrome에서 대시보드를 열고 `F12`로 DevTools를 연다
2. **Performance** 탭으로 이동
3. 좌측 상단의 빨간 원(Record) 버튼을 클릭하여 녹화를 시작한다
4. 10~30초간 대시보드를 사용한다 (심볼 변경, 타임프레임 전환 등)
5. 녹화를 중지하고 결과를 분석한다

**확인 포인트**:

| 항목 | 목표 | 확인 방법 |
|------|------|-----------|
| Frames | 60fps 일정하게 유지 | Frames 레인에서 빨간 프레임(드롭) 확인 |
| Long Tasks | 50ms 이상 태스크 < 0.5% | Main 스레드에서 빨간 삼각형 마크 확인 |
| Scripting 비중 | 프레임당 < 8ms | Summary 탭에서 Scripting 시간 확인 |
| Rendering 비중 | 프레임당 < 4ms | Summary 탭에서 Rendering 시간 확인 |

### 8.2 메모리 프로파일링 (Heap 스냅샷)

메모리 누수와 Detached DOM 노드를 검사한다.

**힙 스냅샷 비교 절차**:

1. **Memory** 탭으로 이동
2. "Heap snapshot"을 선택하고 **"Take snapshot"** 을 클릭 (Snapshot 1)
3. 대시보드를 5분간 사용한다 (심볼 변경, 위젯 추가/제거 등)
4. 다시 **"Take snapshot"** 을 클릭 (Snapshot 2)
5. Snapshot 2를 선택하고 드롭다운에서 **"Comparison"** 을 선택한다
6. **"# Delta"** 컬럼을 기준으로 정렬하여 증가한 객체를 확인한다

**Detached DOM 검사**:

1. 힙 스냅샷을 찍는다
2. 상단 필터에 `Detached`를 입력한다
3. 검색 결과가 0이어야 한다. Detached DOM이 있으면 메모리 누수의 징후이다

**메모리 목표**:

| 지표 | 목표 |
|------|------|
| 초기 로딩 후 | < 80MB (JS Heap) |
| 1시간 연속 사용 후 | < 200MB (JS Heap) |
| Heap 증가율 | < 2MB/hr (안정 상태 도달 후) |
| Detached DOM | 0개 |

### 8.3 WebSocket 프레임 인스펙션

**Network 탭에서 WebSocket 메시지를 확인하는 절차**:

1. **Network** 탭으로 이동
2. 필터에서 **"WS"** 를 선택하여 WebSocket 연결만 표시한다
3. 연결을 클릭하고 **"Messages"** 탭으로 이동한다
4. 수신/발신 메시지를 실시간으로 확인한다

**확인 포인트**:

- 메시지 수신 빈도가 예상 범위 내인지 확인 (depth: 약 10건/초, trade: 종목별 상이)
- 메시지 크기가 비정상적으로 큰 건이 없는지 확인
- 연결 끊김/재연결 이벤트가 정상적으로 처리되는지 확인

### 8.4 React DevTools Profiler

React 컴포넌트의 불필요한 리렌더를 감지한다.

**사용 절차**:

1. Chrome에 React Developer Tools 확장 프로그램을 설치한다
2. DevTools에서 **"Profiler"** 탭으로 이동한다
3. **"Highlight updates when components render"** 를 활성화한다 (설정 아이콘)
4. 녹화를 시작하고 대시보드를 사용한다
5. 녹화를 중지하고 **Flamegraph** 또는 **Ranked** 뷰에서 분석한다

**확인 포인트**:

- 오더북 데이터 업데이트 시 차트 위젯이 리렌더되지 않아야 한다
- 위젯 간 상태 격리가 정상적으로 동작하는지 확인한다
- `React.memo`가 적용된 컴포넌트가 실제로 리렌더를 방지하는지 확인한다

### 8.5 Lighthouse 감사

초기 로딩 성능과 접근성을 종합적으로 평가한다.

**실행 절차**:

1. Chrome DevTools > **Lighthouse** 탭
2. Categories에서 **Performance**, **Accessibility**, **Best Practices**, **SEO** 를 선택한다
3. Device는 **Desktop** 을 선택한다
4. **"Analyze page load"** 를 클릭한다

**성능 목표**:

| 지표 | 목표 |
|------|------|
| Performance Score | 90+ |
| FCP (First Contentful Paint) | < 1.0초 |
| LCP (Largest Contentful Paint) | < 2.0초 |
| TTI (Time to Interactive) | < 3.0초 |
| CLS (Cumulative Layout Shift) | < 0.1 |
| 초기 JS 번들 (gzip) | < 150KB |

---

## 9. 프로젝트 스크립트 목록

`package.json`에 정의된 전체 스크립트 목록이다.

| 명령어 | 설명 | 용도 |
|--------|------|------|
| `pnpm dev` | Next.js 개발 서버 시작 | 로컬 개발 시 사용. Fast Refresh 활성화, `http://localhost:3000` |
| `pnpm build` | 프로덕션 빌드 | `next build` 실행. 빌드 결과가 `.next/` 디렉토리에 생성된다 |
| `pnpm start` | 프로덕션 서버 시작 | `pnpm build` 후 빌드 결과물을 서빙한다. 프로덕션 환경 로컬 테스트용 |
| `pnpm lint` | ESLint 실행 | 전체 프로젝트의 린트 오류를 검사한다. CI에서도 실행된다 |
| `pnpm format` | Prettier 포맷팅 | 전체 프로젝트의 코드 스타일을 자동 교정한다 |
| `pnpm format:check` | Prettier 검사 (수정 없이) | CI에서 포맷팅 위반 여부만 확인한다 |
| `pnpm test` | Vitest 단위 테스트 | Zustand 스토어, 유틸리티, 파서 등의 단위 테스트를 실행한다 |
| `pnpm test:coverage` | 테스트 커버리지 | 단위 테스트 실행 + 커버리지 리포트 생성 (`coverage/` 디렉토리) |
| `pnpm test:e2e` | Playwright E2E 테스트 | 브라우저 기반 종합 테스트. 개발 서버를 자동으로 시작한다 |
| `pnpm type-check` | TypeScript 타입 검사 | `tsc --noEmit` 실행. 컴파일 없이 타입 오류만 검사한다 |

**`package.json` scripts 섹션 예시**:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "type-check": "tsc --noEmit"
  }
}
```

---

## 10. 트러블슈팅

### 10.1 Binance WebSocket 연결 실패

**증상**: WebSocket 연결이 즉시 끊어지거나 `ERR_CONNECTION_REFUSED` 오류 발생

**원인**: Binance는 한국 IP를 포함한 일부 국가에서 API 접근을 제한한다.

**해결 방법**:

1. **VPN 사용** (권장): 일본, 싱가포르, 미국 등의 VPN 서버에 연결 후 개발한다.
2. **프록시 설정**: 개발 환경에서 WebSocket 프록시를 설정한다.
3. **Upbit 대체 사용**: Phase 2의 Upbit API를 먼저 연동하여 한국 IP에서 직접 개발한다.
4. **Mock 서버 사용**: 로컬에 WebSocket Mock 서버를 구축하여 개발한다.

```typescript
// 개발용 환경 변수로 Mock 모드 전환 예시
// .env.local
// NEXT_PUBLIC_USE_MOCK_WS=true
```

**VPN 확인 방법**:

```bash
# 현재 IP 확인
curl https://api.ipify.org?format=json

# Binance API 접근 가능 여부 테스트
curl -s https://api.binance.com/api/v3/ping
# 정상 응답: {}
```

### 10.2 REST API CORS 오류

**증상**: `Access-Control-Allow-Origin` 관련 오류가 브라우저 콘솔에 표시

**원인**: Binance REST API는 기본적으로 CORS를 허용하지만, 일부 엔드포인트나 네트워크 환경에서 제한이 발생할 수 있다.

**해결 방법**:

1. **Next.js API Route 프록시 사용**:

```typescript
// src/app/api/binance/klines/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol');
  const interval = searchParams.get('interval');
  const limit = searchParams.get('limit') || '500';

  const response = await fetch(
    `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
  );
  const data = await response.json();

  return NextResponse.json(data);
}
```

2. **next.config.js에서 rewrites 설정**:

```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/binance/:path*',
        destination: 'https://api.binance.com/api/v3/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
```

### 10.3 Supabase OAuth 리디렉트 불일치

**증상**: OAuth 로그인 후 "redirect_uri_mismatch" 에러 발생

**원인**: OAuth 제공자(Google/GitHub)에 등록된 Redirect URI와 실제 요청의 Redirect URI가 일치하지 않는다.

**해결 방법**:

1. Supabase Dashboard > **Authentication > URL Configuration**에서 Redirect URLs를 확인한다:
   ```
   http://localhost:3000/**
   https://your-domain.vercel.app/**
   ```

2. Google Cloud Console / GitHub OAuth App의 Authorized redirect URI가 다음 형식인지 확인한다:
   ```
   https://your-project-id.supabase.co/auth/v1/callback
   ```

3. 프로토콜(http vs https), 포트 번호, 후행 슬래시를 정확히 일치시킨다.

4. 설정 변경 후 Google OAuth의 경우 반영에 최대 5분이 소요될 수 있다.

### 10.4 Canvas 렌더링이 흐릿하게 보이는 경우

**증상**: 오더북이나 체결 내역의 Canvas 텍스트와 선이 흐릿하게 렌더링된다.

**원인**: Retina(HiDPI) 디스플레이에서 Canvas의 물리적 해상도와 CSS 크기가 일치하지 않는다.

**해결 방법**:

Canvas 초기화 시 `devicePixelRatio`를 반영한다:

```typescript
function setupCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d')!;
  const dpr = window.devicePixelRatio || 1;

  // CSS 크기 가져오기
  const rect = canvas.getBoundingClientRect();

  // Canvas 물리적 크기를 CSS 크기 * DPR로 설정
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  // CSS 크기는 그대로 유지
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;

  // 컨텍스트 스케일 조정
  ctx.scale(dpr, dpr);

  return ctx;
}
```

**주의 사항**:

- 위젯 리사이즈 시에도 이 로직을 다시 실행해야 한다 (`ResizeObserver` 활용).
- `devicePixelRatio`가 변경될 수 있으므로 (예: 모니터 간 창 이동) `matchMedia`로 변경을 감지한다:

```typescript
const mql = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
mql.addEventListener('change', handleDprChange);
```

### 10.5 메모리 누수 감지 팁

**증상**: 장시간 사용 시 브라우저 탭의 메모리가 지속적으로 증가한다.

**일반적인 원인과 해결**:

| 원인 | 증상 | 해결 |
|------|------|------|
| WebSocket 이벤트 리스너 미해제 | 심볼 변경 후 이전 심볼의 리스너가 남아있음 | `useEffect` cleanup에서 `ws.removeEventListener` 또는 `unsubscribe` 호출 |
| Chart 인스턴스 미정리 | 위젯 제거 후 TradingView Chart 인스턴스가 남아있음 | `useEffect` cleanup에서 `chart.remove()` 호출 |
| `setInterval`/`setTimeout` 미해제 | 컴포넌트 unmount 후에도 타이머가 동작 | `useEffect` cleanup에서 `clearInterval`/`clearTimeout` 호출 |
| Canvas Context 참조 유지 | Canvas 요소가 DOM에서 제거된 후에도 context 참조가 남아있음 | context 변수를 `null`로 설정 |
| 클로저에 의한 대량 데이터 유지 | 이벤트 핸들러 클로저가 이전 상태 전체를 캡처 | Zustand selector로 필요한 데이터만 구독 |
| `requestAnimationFrame` 미취소 | unmount 후에도 rAF 루프가 계속 동작 | `cancelAnimationFrame(rafId)` 호출 |

**메모리 누수 진단 스크립트**:

DevTools Console에서 다음을 실행하여 간단한 메모리 추세를 확인할 수 있다:

```javascript
// 10초 간격으로 메모리 사용량을 콘솔에 출력
const memoryLog = setInterval(() => {
  if (performance.memory) {
    console.log({
      usedJSHeapSize: `${(performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
      totalJSHeapSize: `${(performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
    });
  }
}, 10000);

// 중지: clearInterval(memoryLog)
```

> `performance.memory`는 Chrome에서만 지원된다. `--enable-precise-memory-info` 플래그로 Chrome을 실행하면 더 정확한 수치를 얻을 수 있다.

---

## 부록: 프로젝트 디렉토리 구조 (참고)

```
crypto-trading-dashboard/
├── .github/                    # GitHub Actions CI/CD
├── .husky/                     # Git hooks
│   ├── pre-commit
│   └── pre-push
├── .vscode/                    # VS Code 프로젝트 설정
│   ├── extensions.json
│   └── settings.json
├── e2e/                        # Playwright E2E 테스트
├── public/                     # 정적 파일
├── src/
│   ├── app/                    # Next.js App Router 페이지
│   ├── components/             # React 컴포넌트
│   │   ├── chart/              # 캔들스틱 차트 위젯
│   │   ├── orderbook/          # 오더북 (Canvas) 위젯
│   │   ├── trades/             # 체결 내역 (Canvas) 위젯
│   │   ├── watchlist/          # 관심 종목 위젯
│   │   ├── grid/               # 대시보드 그리드
│   │   └── ui/                 # 공통 UI 컴포넌트
│   ├── hooks/                  # 커스텀 React 훅
│   ├── lib/                    # 외부 라이브러리 초기화 (Supabase 등)
│   ├── services/               # WebSocket 매니저, API 클라이언트
│   ├── stores/                 # Zustand 상태 관리
│   ├── types/                  # TypeScript 타입 정의
│   ├── utils/                  # 유틸리티 함수 (링 버퍼, 포맷터 등)
│   └── test/                   # 테스트 설정 및 헬퍼
├── .env.example                # 환경 변수 템플릿
├── .env.local                  # 로컬 환경 변수 (Git 미추적)
├── .eslintrc.json              # ESLint 설정
├── .gitignore
├── .nvmrc                      # Node.js 버전 고정
├── .prettierrc                 # Prettier 설정
├── .prettierignore
├── next.config.js              # Next.js 설정
├── package.json
├── playwright.config.ts        # Playwright 설정
├── pnpm-lock.yaml              # pnpm 잠금 파일
├── tsconfig.json               # TypeScript 설정
└── vitest.config.ts            # Vitest 설정
```

---

본 문서에 대한 질문이나 개선 사항은 프로젝트 이슈 트래커에 등록하라.
