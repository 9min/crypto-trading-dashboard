# Real-time Crypto Trading Dashboard

Binance WebSocket API를 브라우저에서 직접 연결하여 서버 중계 비용 없이 실시간 암호화폐 시세를 60fps로 시각화하는 고성능 트레이딩 대시보드.

오더북과 체결 내역은 Canvas 2D Context로 렌더링하여 DOM 병목을 제거하고, `requestAnimationFrame` 기반 렌더링 파이프라인으로 데이터 수신과 화면 갱신을 분리한다.

## Tech Stack

| Area               | Technology                     | Purpose                            |
| ------------------ | ------------------------------ | ---------------------------------- |
| Framework          | Next.js 16.1.6 (App Router)    | SSG 기반 초기 로딩 최적화          |
| Language           | TypeScript (strict)            | WebSocket 메시지 타입 안전성       |
| State              | Zustand                        | selector 기반 구독, 리렌더 최소화  |
| Chart              | TradingView Lightweight Charts | Canvas 기반 캔들스틱 차트          |
| OrderBook / Trades | Canvas 2D API                  | DOM 완전 우회, Reflow/Repaint Zero |
| Layout             | React Grid Layout              | 드래그/리사이즈/반응형 그리드      |
| Auth + DB          | Supabase                       | OAuth, 레이아웃/관심종목 영속화    |
| Style              | Tailwind CSS 4                 | 유틸리티 기반 스타일링             |
| Test               | Vitest + Playwright            | 단위 테스트 + E2E                  |
| Code Quality       | ESLint + Prettier + Husky      | 린트, 포맷팅, Git 훅               |
| Deploy             | Vercel                         | 글로벌 CDN                         |

## Architecture

```
Browser ──WebSocket──▶ Binance Combined Stream (wss://stream.binance.com)
   │
   ├─ kline ──▶ klineStore ──▶ Lightweight Charts (Canvas)
   ├─ depth ──▶ depthStore ──▶ OrderBookRenderer (Canvas 2D)
   └─ trade ──▶ tradeStore ──▶ TradesFeedRenderer (Canvas 2D)
                    │
                    └─ Float64Array RingBuffer (GC 압박 최소화)
```

- **WebSocketManager**: 싱글톤, 지수 백오프 재연결, 하트비트 감지, Page Visibility 연동
- **Canvas Renderers**: `requestAnimationFrame` + dirty flag 패턴으로 React 렌더 사이클과 완전 분리
- **RingBuffer**: `Float64Array` 기반 고정 용량 순환 버퍼로 체결 내역 관리

## Project Structure

```
src/
├── app/                  # Next.js App Router
├── components/
│   ├── widgets/          # 대시보드 위젯 (캔들스틱, 오더북, 체결, 관심종목)
│   ├── ui/               # 재사용 UI 프리미티브
│   └── layout/           # 레이아웃 컴포넌트
├── hooks/                # 커스텀 React 훅
├── stores/               # Zustand 스토어 (도메인별 분리)
├── lib/
│   ├── websocket/        # WebSocket 매니저 + 메시지 라우터
│   ├── binance/          # Binance REST API + 스트림 URL 빌더
│   ├── canvas/           # Canvas 렌더러
│   └── supabase/         # Supabase 클라이언트
├── types/                # TypeScript 타입 정의
└── utils/                # 유틸리티 (ringBuffer, formatPrice, formatTime)
```

## Getting Started

### Prerequisites

- Node.js >= 22
- pnpm >= 10

### Installation

```bash
git clone https://github.com/9min/crypto-trading-dashboard.git
cd crypto-trading-dashboard
pnpm install
```

### Development

```bash
pnpm dev
```

`http://localhost:3000`으로 접속.

### Build

```bash
pnpm build
pnpm start
```

## Scripts

| Command              | Description            |
| -------------------- | ---------------------- |
| `pnpm dev`           | 개발 서버 (Turbopack)  |
| `pnpm build`         | 프로덕션 빌드          |
| `pnpm lint`          | ESLint (zero warnings) |
| `pnpm format`        | Prettier 포맷팅        |
| `pnpm type-check`    | TypeScript 타입 체크   |
| `pnpm test`          | Vitest 단위 테스트     |
| `pnpm test:watch`    | Vitest watch 모드      |
| `pnpm test:coverage` | 테스트 커버리지        |
| `pnpm test:e2e`      | Playwright E2E 테스트  |

## Performance Targets

| Metric                   | Target            |
| ------------------------ | ----------------- |
| Frame Rate               | 60fps (min 55fps) |
| Canvas Redraw            | < 4ms             |
| JS Heap (1hr)            | < 200MB           |
| Heap Growth              | < 2MB/hr          |
| LCP                      | < 2.0s            |
| FCP                      | < 1.0s            |
| DOM Nodes                | < 500             |
| Initial JS Bundle (gzip) | < 150KB           |
| WebSocket Reconnect      | < 3s              |

## License

MIT
