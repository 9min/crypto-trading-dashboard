# CLAUDE.md — Real-time Crypto Trading Dashboard AI 컨텍스트

> **이 문서는 Claude(AI 어시스턴트)가 본 프로젝트의 코드를 작성하기 전에 반드시 읽어야 하는 단일 진실 공급원(Single Source of Truth)이다.**
> 모든 규칙은 명령형이며, "MUST", "NEVER", "ALWAYS"로 표기된 항목은 예외 없이 준수해야 한다.

---

## 1. 프로젝트 개요

바이낸스 퍼블릭 WebSocket API를 브라우저에서 직접 연결하여, 서버 중계 비용 Zero로 실시간 암호화폐 시세를 60fps로 시각화하는 고성능 트레이딩 대시보드이다. 오더북과 체결 내역은 Canvas 2D Context로 렌더링하여 DOM 병목을 완전히 제거하고, `requestAnimationFrame` 기반 렌더링 파이프라인으로 데이터 수신과 화면 갱신을 분리한다. 14년 차 프론트엔드 개발자의 포트폴리오 프로젝트로서, 코드 품질은 시니어 레벨의 코드 리뷰를 통과할 수 있는 수준이어야 한다.

### 기술 스택 요약

| 영역               | 기술                           | 용도                                       |
| ------------------ | ------------------------------ | ------------------------------------------ |
| 프레임워크         | Next.js 16.1.6 (App Router)    | SSG 기반 초기 로딩 최적화, 라우팅          |
| 언어               | TypeScript (strict mode)       | 타입 안전성, WebSocket 메시지 타입 정의    |
| 상태 관리          | Zustand                        | selector 기반 구독, 불필요한 리렌더 최소화 |
| 차트               | TradingView Lightweight Charts | Canvas 기반 고성능 캔들스틱 차트           |
| 오더북/체결 렌더링 | Canvas 2D API                  | DOM 완전 우회, Reflow/Repaint 비용 Zero    |
| 대시보드 레이아웃  | React Grid Layout              | 드래그/리사이즈/반응형 그리드              |
| 인증 + DB          | Supabase                       | Google OAuth, 레이아웃/관심종목 영속화     |
| 배포               | Vercel                         | Next.js 최적 배포, 글로벌 CDN              |
| 테스트             | Vitest + Playwright            | 단위 테스트 + E2E 테스트                   |
| 코드 품질          | ESLint + Prettier + Husky      | 린트, 포맷팅, Git 훅                       |

### 디렉터리 구조

```
src/
├── app/                  # Next.js App Router 페이지
│   ├── auth/             # 인증 관련
│   │   └── callback/
│   │       └── route.ts  # OAuth 콜백 핸들러
│   ├── layout.tsx        # 루트 레이아웃
│   ├── page.tsx          # 메인 대시보드 페이지
│   ├── providers.tsx     # 클라이언트 프로바이더
│   └── globals.css       # 글로벌 스타일
├── components/           # React 컴포넌트
│   ├── widgets/          # 대시보드 위젯 컴포넌트
│   │   ├── CandlestickWidget.tsx
│   │   ├── DepthChartWidget.tsx
│   │   ├── KimchiPremiumWidget.tsx
│   │   ├── OrderBookWidget.tsx
│   │   ├── PerformanceMonitorWidget.tsx
│   │   ├── TradesFeedWidget.tsx
│   │   ├── WatchlistWidget.tsx
│   │   └── WidgetWrapper.tsx
│   ├── ui/               # 재사용 가능한 UI 프리미티브
│   │   ├── Button.tsx
│   │   ├── ErrorBoundary.tsx
│   │   ├── ErrorFallback.tsx
│   │   ├── ExchangeSelector.tsx
│   │   ├── IndicatorToggle.tsx
│   │   ├── PriceAlertPopover.tsx
│   │   ├── ResetLayoutButton.tsx
│   │   ├── Sparkline.tsx
│   │   ├── ThemeToggle.tsx
│   │   ├── Toast.tsx
│   │   ├── ToastContainer.tsx
│   │   ├── UserMenu.tsx
│   │   ├── WatchlistManagePopover.tsx
│   │   └── WidgetSelector.tsx
│   └── layout/           # 레이아웃 컴포넌트
│       ├── ConnectionStatus.tsx
│       ├── DashboardGrid.tsx
│       ├── DashboardHeader.tsx
│       ├── DashboardShell.tsx
│       └── IntervalSelector.tsx
├── hooks/                # 커스텀 React 훅
│   ├── useAuth.ts
│   ├── useCanvasRenderer.ts
│   ├── useExchangeWatchlistStream.ts
│   ├── useExchangeWebSocket.ts
│   ├── useHistoricalLoader.ts
│   ├── useIndicatorSeries.ts
│   ├── useNotification.ts
│   ├── usePreferencesSync.ts
│   ├── usePremiumStream.ts
│   ├── usePriceAlertMonitor.ts
│   ├── useResizeObserver.ts
│   ├── useSparklineData.ts
│   ├── useSymbolFromUrl.ts
│   ├── useUpbitStream.ts
│   ├── useUpbitWatchlistStream.ts
│   ├── useWatchlistStream.ts
│   └── useWebSocket.ts
├── stores/               # Zustand 스토어
│   ├── alertStore.ts
│   ├── authStore.ts
│   ├── depthStore.ts
│   ├── indicatorStore.ts
│   ├── klineStore.ts
│   ├── premiumStore.ts
│   ├── toastStore.ts
│   ├── tradeStore.ts
│   ├── uiStore.ts
│   ├── watchlistStore.ts
│   └── widgetStore.ts
├── lib/                  # 핵심 라이브러리
│   ├── websocket/        # WebSocket 매니저
│   │   ├── WebSocketManager.ts
│   │   ├── WatchlistStreamManager.ts
│   │   └── messageRouter.ts
│   ├── canvas/           # Canvas 렌더러
│   │   ├── DepthChartRenderer.ts
│   │   ├── OrderBookRenderer.ts
│   │   ├── PerformanceMonitorRenderer.ts
│   │   └── TradesFeedRenderer.ts
│   ├── binance/          # Binance API 클라이언트
│   │   ├── restApi.ts
│   │   └── streamUrls.ts
│   ├── upbit/            # Upbit API 클라이언트
│   │   ├── UpbitWebSocketManager.ts
│   │   ├── messageRouter.ts
│   │   └── restClient.ts
│   ├── exchange/         # 환율 서비스
│   │   └── exchangeRateService.ts
│   └── supabase/         # Supabase 클라이언트
│       ├── client.ts
│       └── preferencesService.ts
├── types/                # TypeScript 타입 정의
│   ├── binance.ts        # Binance API 응답 타입
│   ├── chart.ts          # 차트 관련 타입 (CandleData, ConnectionState 등)
│   ├── exchange.ts       # 거래소 공통 타입
│   ├── indicator.ts      # 차트 지표 타입
│   ├── supabase.ts       # Supabase 데이터베이스 타입
│   ├── upbit.ts          # Upbit API 응답 타입
│   └── widget.ts         # 위젯 관련 타입
└── utils/                # 유틸리티 함수
    ├── constants.ts
    ├── debounce.ts
    ├── formatPrice.ts
    ├── formatSymbol.ts
    ├── formatTime.ts
    ├── indicators.ts
    ├── intervalAlign.ts
    ├── layoutStorage.ts
    ├── localPreferences.ts
    ├── ringBuffer.ts
    ├── symbolMap.ts
    ├── symbolSearch.ts
    └── widgetStorage.ts
```

---

## 2. 코딩 컨벤션

### 2.1 TypeScript 규칙

- `tsconfig.json`에서 `strict: true`를 반드시 활성화한다.
- **`any` 타입 사용을 절대 금지한다.** 모든 값에 명시적인 타입 또는 인터페이스를 정의한다.
- 객체 형태(shape) 정의에는 `interface`를 사용한다.
- 유니온 타입, 인터섹션 타입, 유틸리티 타입 조합에는 `type`을 사용한다.

```typescript
// ✅ GOOD: interface로 객체 형태 정의
interface OrderBookLevel {
  price: number;
  quantity: number;
}

// ✅ GOOD: type으로 유니온/인터섹션 정의
type WebSocketMessage = KlineMessage | DepthMessage | TradeMessage;
```

- **모든 WebSocket 메시지 타입에 명시적 인터페이스를 정의한다.** Binance API 응답 구조를 정확히 반영해야 한다.

```typescript
interface BinanceKlineEvent {
  e: 'kline';
  E: number; // Event time
  s: string; // Symbol
  k: {
    t: number; // Kline start time
    T: number; // Kline close time
    s: string; // Symbol
    i: string; // Interval
    o: string; // Open price
    c: string; // Close price
    h: string; // High price
    l: string; // Low price
    v: string; // Volume
    x: boolean; // Is this kline closed?
  };
}
```

- **모든 컴포넌트 props에 명시적 인터페이스를 정의한다.** 인라인 타입을 사용하지 않는다.

```typescript
// ❌ BAD: 인라인 타입
const Widget = ({ title, onClose }: { title: string; onClose: () => void }) => {};

// ✅ GOOD: 명시적 인터페이스
interface WidgetHeaderProps {
  title: string;
  onClose: () => void;
}
const WidgetHeader = ({ title, onClose }: WidgetHeaderProps) => {};
```

- **WebSocket 연결 상태 등 상태 머신 패턴에는 판별 유니온(Discriminated Union)을 사용한다.**

```typescript
type ConnectionState =
  | { status: 'idle' }
  | { status: 'connecting' }
  | { status: 'connected'; connectedAt: number }
  | { status: 'reconnecting'; attempt: number }
  | { status: 'failed'; error: string };
```

- 리터럴 타입에는 `const` assertion을 우선 사용한다.

```typescript
const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
type Timeframe = (typeof TIMEFRAMES)[number];
```

- **non-null assertion(`!`)을 사용하지 않는다.** 절대적으로 불가피한 경우에만 사용하되, 반드시 그 이유를 주석으로 명시한다.

```typescript
// ❌ BAD: 무조건적 non-null assertion
const ctx = canvasRef.current!.getContext('2d')!;

// ✅ GOOD: null 체크 후 early return
const canvas = canvasRef.current;
if (!canvas) return;
const ctx = canvas.getContext('2d');
if (!ctx) return;
```

### 2.2 React 규칙

- **함수형 컴포넌트만 사용한다.** 클래스 컴포넌트를 절대 사용하지 않는다.
- **named export를 사용한다.** `page.tsx`만 예외적으로 default export를 허용한다.

```typescript
// ✅ GOOD
export const OrderBookWidget = memo(({ symbol }: OrderBookWidgetProps) => {
  // ...
});

// ❌ BAD
export default function OrderBookWidget() {
  /* ... */
}
```

- **파일 네이밍 규칙**:
  - 컴포넌트 파일: `PascalCase.tsx` (예: `OrderBookWidget.tsx`, `ConnectionStatus.tsx`)
  - 훅 파일: `useCamelCase.ts` (예: `useWebSocket.ts`, `useCanvasRenderer.ts`)
  - 유틸리티 파일: `camelCase.ts` (예: `formatPrice.ts`, `ringBuffer.ts`)
  - 타입 정의 파일: `camelCase.ts` (예: `binance.ts`, `websocket.ts`)
  - 스토어 파일: `camelCase.ts` (예: `depthStore.ts`, `klineStore.ts`)

---

## 3. 렌더링 최적화 규칙 (CRITICAL)

> 이 섹션의 모든 규칙은 60fps 보장과 장시간 운용 안정성을 위해 **반드시** 준수해야 한다.

### 3.1 불필요한 리렌더링 방지 (MUST FOLLOW)

- **모든 위젯 컴포넌트에 `React.memo()`를 적용한다.**

```typescript
export const OrderBookWidget = memo(({ symbol }: OrderBookWidgetProps) => {
  // ...
});
```

- **Zustand 스토어에서 반드시 selector를 사용하여 특정 상태 슬라이스만 구독한다.**

```typescript
// ✅ GOOD: 특정 상태만 구독 — 해당 값이 변할 때만 리렌더
const bestBid = useDepthStore((state) => state.bestBid);
const bestAsk = useDepthStore((state) => state.bestAsk);

// ❌ BAD: 스토어 전체 구독 — 어떤 상태가 바뀌어도 리렌더
const store = useDepthStore();
const { bestBid, bestAsk } = useDepthStore();
```

- **인라인 객체/배열/함수를 props로 전달하지 않는다.** 매 렌더마다 새 참조가 생성되어 자식 컴포넌트의 리렌더를 유발한다.

```typescript
// ❌ BAD: 매 렌더마다 새 객체 생성
<Widget style={{ color: 'red' }} />
<Widget data={[1, 2, 3]} />
<Widget onClick={() => handleClick(id)} />

// ✅ GOOD: 안정적 참조
const style = useMemo(() => ({ color: 'red' }), []);
const data = useMemo(() => [1, 2, 3], []);
const handleWidgetClick = useCallback(() => handleClick(id), [id]);

<Widget style={style} />
<Widget data={data} />
<Widget onClick={handleWidgetClick} />
```

- **props로 전달하는 이벤트 핸들러에 항상 `useCallback`을 사용한다.**
- **파생 데이터(계산된 값)에 항상 `useMemo`를 사용한다.**
- **동적 리스트에서 index를 React key로 절대 사용하지 않는다.** 고유한 식별자(ID, 가격 등)를 key로 사용한다.

```typescript
// ❌ BAD
{items.map((item, index) => <Item key={index} {...item} />)}

// ✅ GOOD
{items.map((item) => <Item key={item.id} {...item} />)}
```

### 3.2 Canvas 렌더링 규칙 (MUST FOLLOW)

- **Canvas 렌더링은 React 렌더 사이클과 완전히 분리한다.** React 컴포넌트의 render 함수 안에서 Canvas draw 메서드를 절대 호출하지 않는다.
- **`requestAnimationFrame` 루프 + dirty flag 패턴을 사용한다.**

```typescript
// 패턴: WebSocket 데이터 → dirty flag 설정 → rAF에서 flag 확인 → dirty일 때만 렌더 → flag 초기화

class OrderBookRenderer {
  private isDirty = false;
  private rafId: number | null = null;

  // WebSocket 콜백에서 호출
  setData(bids: OrderBookLevel[], asks: OrderBookLevel[]): void {
    this.bids = bids;
    this.asks = asks;
    this.isDirty = true; // flag만 설정, 직접 draw 호출 금지
  }

  // rAF 루프
  private loop = (): void => {
    if (this.isDirty) {
      this.draw(); // dirty일 때만 렌더링
      this.isDirty = false;
    }
    this.rafId = requestAnimationFrame(this.loop);
  };

  destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
  }
}
```

- **`window.devicePixelRatio`를 반드시 처리하여 Retina 디스플레이에서 선명하게 렌더링한다.**

```typescript
const dpr = window.devicePixelRatio || 1;
canvas.width = rect.width * dpr;
canvas.height = rect.height * dpr;
canvas.style.width = `${rect.width}px`;
canvas.style.height = `${rect.height}px`;
ctx.scale(dpr, dpr);
```

- **컴포넌트 언마운트 시 Canvas 리소스를 반드시 정리한다.** `cancelAnimationFrame`을 호출한다.
- **`ResizeObserver`로 Canvas 크기를 컨테이너와 동기화한다.** `window.onresize` 대신 `ResizeObserver`를 사용한다.
- **단일 Canvas redraw는 4ms 이내에 완료되어야 한다.** `performance.mark()`로 계측하고, 초과 시 렌더링 로직을 최적화한다.

### 3.3 DOM 최적화 규칙

- **오더북과 체결 내역은 반드시 Canvas로 렌더링한다.** React DOM 엘리먼트로 렌더링하지 않는다.
- **전체 대시보드의 DOM 노드 수를 500개 미만으로 유지한다.**
- **`document.getElementById`를 사용하지 않는다.** React ref를 사용한다.
- **Layout thrashing을 방지한다.** DOM 읽기(offsetWidth 등)를 먼저 배치하고, DOM 쓰기(style 변경 등)를 그 후에 배치한다.

---

## 4. WebSocket 생명주기 관리 규칙 (CRITICAL)

> WebSocket 연결의 안정성은 대시보드의 핵심 가치이다. 이 섹션의 모든 규칙을 반드시 준수한다.

### 4.1 연결 관리

- **WebSocketManager는 반드시 싱글톤으로 구현한다.** 애플리케이션 전체에서 하나의 인스턴스만 존재해야 한다.

```typescript
class WebSocketManager {
  private static instance: WebSocketManager | null = null;

  static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  private constructor() {
    // 외부 생성 차단
  }
}
```

- **지수 백오프(Exponential Backoff) 재연결을 반드시 구현한다.** 재연결 간격: 1s -> 2s -> 4s -> 8s -> 16s -> 30s(최대).

```typescript
private getReconnectDelay(attempt: number): number {
  return Math.min(1000 * Math.pow(2, attempt), 30000);
}
```

- **연결 상태를 판별 유니온 타입으로 추적한다.**

```typescript
type ConnectionState =
  | { status: 'idle' }
  | { status: 'connecting' }
  | { status: 'connected'; connectedAt: number }
  | { status: 'reconnecting'; attempt: number }
  | { status: 'failed'; error: string };
```

- **하트비트(Heartbeat) 감지를 반드시 구현한다.** 30초간 메시지를 수신하지 못하면 연결이 끊어진 것으로 간주하고 재연결을 시도한다.
- **Page Visibility API와 반드시 연동한다.** 탭이 비활성화되면 렌더링을 중단하고, 탭이 활성화되면 렌더링을 재개하며 오더북 스냅샷을 재요청하여 데이터 정합성을 확보한다.

### 4.2 구독 관리

- **심볼 변경 시 기존 스트림을 반드시 먼저 구독 해제(unsubscribe)한 후 새 스트림을 구독(subscribe)한다.**
- **동일 목적의 WebSocket 연결을 절대 중복 생성하지 않는다.**
- **Binance Combined Stream을 사용하여 WebSocket 연결 수를 최소화한다.**

```
wss://stream.binance.com:9443/stream?streams=btcusdt@kline_1m/btcusdt@depth@100ms/btcusdt@trade
```

- **활성 구독 목록을 추적하여 중복 구독을 방지한다.**

```typescript
private activeSubscriptions = new Set<string>();

subscribe(stream: string): void {
  if (this.activeSubscriptions.has(stream)) return; // 중복 방지
  this.activeSubscriptions.add(stream);
  // ... 구독 로직
}
```

### 4.3 리소스 정리

- **컴포넌트 언마운트 시 WebSocket 구독을 반드시 정리한다.**
- **컴포넌트 언마운트 시 이벤트 리스너를 반드시 제거한다.**
- **컴포넌트 언마운트 시 `setTimeout`/`setInterval`을 반드시 취소한다.**
- **컴포넌트 언마운트 시 Lightweight Charts 인스턴스의 `chart.remove()`를 반드시 호출한다.**
- **컴포넌트 언마운트 시 `cancelAnimationFrame`을 반드시 호출한다.**
- **다음 cleanup 패턴을 따른다:**

```typescript
useEffect(() => {
  const manager = WebSocketManager.getInstance();
  const unsubscribe = manager.subscribe(streams, handleMessage);

  const rafId = requestAnimationFrame(renderLoop);

  const resizeObserver = new ResizeObserver(handleResize);
  resizeObserver.observe(containerRef.current);

  return () => {
    unsubscribe(); // WebSocket 구독 해제
    cancelAnimationFrame(rafId); // rAF 취소
    resizeObserver.disconnect(); // ResizeObserver 해제
    chartInstance?.remove(); // 차트 인스턴스 정리
  };
}, []);
```

---

## 5. 상태 관리 규칙 (Zustand)

### 5.1 Store 설계 규칙

- **도메인별로 스토어를 분리한다.** 하나의 거대한 스토어에 모든 상태를 넣지 않는다.

| 스토어           | 역할                                       |
| ---------------- | ------------------------------------------ |
| `klineStore`     | 캔들스틱 데이터, 타임프레임, 차트 상태     |
| `depthStore`     | 오더북 데이터 (bids/asks), 최고 호가       |
| `tradeStore`     | 체결 내역 링 버퍼, 최근 체결가             |
| `uiStore`        | 현재 심볼, 테마, 레이아웃, 연결 상태       |
| `authStore`      | 사용자 인증 상태, 프로필 정보              |
| `alertStore`     | 가격 알림 관리, 조건 및 트리거 상태        |
| `indicatorStore` | 차트 지표 설정 (이동평균, 볼린저밴드 등)   |
| `premiumStore`   | 김치 프리미엄 데이터, Binance-Upbit 가격차 |
| `toastStore`     | 토스트 알림 메시지 큐 및 표시 상태         |
| `watchlistStore` | 관심 종목 목록, 실시간 가격 업데이트       |
| `widgetStore`    | 위젯 표시 설정, 활성/비활성 상태           |

- **스토어의 모든 액션은 named function으로 정의한다.** 인라인 함수를 사용하지 않는다.

```typescript
// ✅ GOOD: named function
interface DepthStoreActions {
  updateBids: (bids: OrderBookLevel[]) => void;
  updateAsks: (asks: OrderBookLevel[]) => void;
  setDirty: () => void;
}

// ❌ BAD: 인라인 함수
create((set) => ({
  updateBids: (bids) => set({ bids }), // 이름이 있지만 타입이 명확하지 않음
}));
```

- **`immer` 미들웨어는 깊은 중첩 상태 업데이트가 필요한 경우에만 사용한다.** 불필요하게 적용하지 않는다.

### 5.2 고빈도 데이터 처리

- **Canvas로 렌더링하는 데이터(오더북, 체결 내역)는 React 리렌더를 트리거하지 않도록 업데이트한다.** Zustand의 `setState`와 transient update 패턴을 활용한다.

```typescript
// Canvas 렌더러가 직접 참조하는 데이터는 React 구독을 우회
const useDepthStore = create<DepthStore>()((set, get) => ({
  bids: [],
  asks: [],
  isDirty: false,

  // 이 함수는 React 리렌더를 트리거하지 않음
  // Canvas 렌더러가 직접 get()으로 접근
  updateDepth: (bids, asks) => {
    set({ bids, asks, isDirty: true });
  },
}));
```

- **오더북 데이터 구조: 매수(bids)와 매도(asks)를 각각 가격 기준 정렬 배열로 유지한다.**
- **체결 내역: `Float64Array` 기반 링 버퍼로 고정 용량(200건) 유지.** 각 체결 건은 `[timestamp, price, quantity, isBuyerMaker]` 4개 필드로 고정 크기 슬롯에 기록한다.
- **캔들 데이터: 최대 2,000개 캔들 유지.** 초과 시 FIFO 방식으로 가장 오래된 캔들부터 폐기한다.

---

## 6. 메모리 관리 규칙

- **고빈도 데이터에 `Array.prototype.unshift()` 또는 `Array.prototype.splice()`를 절대 사용하지 않는다.** 링 버퍼를 사용한다.
- **수치 데이터 버퍼에 반드시 Typed Array(`Float64Array`)를 사용한다.** GC 압박을 최소화한다.
- **데이터 컬렉션에 반드시 상한(cap)을 적용한다:**

| 데이터              | 최대 용량           |
| ------------------- | ------------------- |
| 캔들 (kline)        | 2,000개             |
| 체결 내역 (trades)  | 200건               |
| 오더북 레벨 (depth) | 매수/매도 각 50레벨 |

- **WebSocket에서 수신한 raw JSON을 절대 저장하지 않는다.** 즉시 파싱하고, 필요한 필드만 추출한 뒤 원본 JSON 문자열은 폐기한다.
- **모든 이벤트 리스너를 cleanup 함수에서 반드시 제거한다.**
- **목표: 1시간 연속 사용 후 JS Heap < 200MB**
- **Detached DOM Node는 0개를 유지한다 (Zero Detached DOM Nodes 정책).**

---

## 7. 에러 처리 규칙

- **모든 위젯을 React Error Boundary로 반드시 감싼다.**

```typescript
<ErrorBoundary fallback={<WidgetErrorFallback onRetry={handleRetry} />}>
  <OrderBookWidget symbol={symbol} />
</ErrorBoundary>
```

- **하나의 위젯 오류가 전체 대시보드를 절대 크래시시키지 않는다.** 위젯 단위로 에러를 격리한다.
- **WebSocket 에러는 비침입적 토스트 알림으로 표시한다.** 모달이나 페이지 전체 에러 화면을 사용하지 않는다.
- **API fetch 에러 시 지수 백오프로 최대 3회 재시도한다.**

```typescript
async function fetchWithRetry<T>(url: string, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
    }
  }
  throw new Error('Unreachable');
}
```

- **사용자에게 보이는 WebSocket 연결 상태 인디케이터를 반드시 제공한다.**
  - 연결됨: 녹색 점
  - 재연결 중: 노란색 점 (깜빡임)
  - 연결 끊김: 빨간색 점 + 수동 재연결 버튼
- **모든 에러를 콘솔에 컨텍스트(컴포넌트 이름, 액션, 타임스탬프)와 함께 로깅한다.**

```typescript
console.error(`[OrderBookWidget] Failed to update depth data`, {
  symbol,
  action: 'updateDepth',
  timestamp: Date.now(),
  error,
});
```

---

## 8. 파일/폴더 구조 규칙

```
src/
├── app/              # Next.js App Router 페이지
│   ├── layout.tsx    # 루트 레이아웃 (default export)
│   ├── page.tsx      # 메인 페이지 (default export)
│   └── globals.css   # 글로벌 CSS
├── components/       # React 컴포넌트
│   ├── widgets/      # 대시보드 위젯 컴포넌트 (PascalCase.tsx)
│   ├── ui/           # 재사용 UI 프리미티브 (PascalCase.tsx)
│   └── layout/       # 레이아웃 컴포넌트 (PascalCase.tsx)
├── hooks/            # 커스텀 React 훅 (useCamelCase.ts)
├── stores/           # Zustand 스토어 (camelCase.ts)
├── lib/              # 핵심 라이브러리
│   ├── websocket/    # WebSocket 매니저
│   ├── canvas/       # Canvas 렌더러
│   └── supabase/     # Supabase 클라이언트
├── types/            # TypeScript 타입 정의 (camelCase.ts)
└── utils/            # 유틸리티 함수 (camelCase.ts)
```

- **새 파일을 생성할 때 반드시 위 구조를 따른다.** 임의의 위치에 파일을 생성하지 않는다.
- **컴포넌트는 기능별로 하위 디렉터리에 배치한다.** `components/` 루트에 직접 파일을 두지 않는다.
- **한 파일에 하나의 컴포넌트만 export한다.** 밀접하게 관련된 서브 컴포넌트는 같은 파일에 둘 수 있으나, 파일명은 주요 export의 이름을 따른다.
- **`index.ts` 배럴 파일은 `components/`, `hooks/`, `stores/`, `utils/` 등 각 디렉터리의 루트에만 허용한다.** 남용하지 않는다.

---

## 9. 테스트 규칙

- **모든 Zustand 스토어 액션에 단위 테스트를 작성한다.**

```typescript
describe('depthStore', () => {
  it('updateBids는 매수 호가를 가격 내림차순으로 정렬한다', () => {
    // ...
  });
});
```

- **모든 WebSocket 메시지 파서에 단위 테스트를 작성한다.** Binance API 응답의 다양한 케이스를 커버한다.
- **링 버퍼 연산에 단위 테스트를 작성한다.** 오버플로, 언더플로, 순환 동작을 검증한다.
- **Canvas 렌더러는 데이터 변환 로직만 테스트한다.** 시각적 출력은 테스트하지 않는다.
- **Canvas 컴포넌트에 스냅샷 테스트를 사용하지 않는다.**
- **테스트 파일 위치:** 테스트 대상 파일과 같은 디렉터리에 `*.test.ts` 또는 `*.test.tsx`로 배치한다.

---

## 10. 커밋 전 체크리스트

코드를 커밋하기 전에 다음 항목을 반드시 확인한다:

- [ ] **TypeScript 타입 에러 없음**: `tsc --noEmit` 통과
- [ ] **ESLint 경고/에러 없음**: `eslint --max-warnings 0` 통과
- [ ] **`console.log` 미포함**: 커밋할 코드에 `console.log`가 없어야 한다. 디버깅용이 아닌 에러 로깅에는 `console.error`를 사용한다.
- [ ] **모든 `useEffect`에 적절한 cleanup 함수가 있는가**
- [ ] **메모리 누수 패턴 없음**: `addEventListener`에 대응하는 `removeEventListener`가 있는가
- [ ] **Zustand selector가 세분화(granular)되어 있는가**: 스토어 전체를 구독하지 않는가
- [ ] **Canvas 리소스가 정리되는가**: `cancelAnimationFrame`, `ResizeObserver.disconnect()` 등
- [ ] **WebSocket 구독이 해제되는가**: 컴포넌트 언마운트 시 unsubscribe 호출

---

## 11. 금지 패턴 목록 (NEVER DO)

아래 패턴은 **어떤 상황에서도 절대 사용하지 않는다.**

| 금지 패턴                                     | 이유                              | 대안                                               |
| --------------------------------------------- | --------------------------------- | -------------------------------------------------- |
| `setInterval`로 렌더링                        | 프레임 타이밍과 불일치, CPU 낭비  | `requestAnimationFrame` 사용                       |
| React render 안에서 동기 무거운 계산          | Jank(프레임 드롭) 유발            | `useMemo` 또는 Web Worker 사용                     |
| Zustand 스토어에 DOM 참조 저장                | 메모리 누수, React 생명주기 충돌  | React ref 사용                                     |
| `innerHTML` 사용                              | XSS 취약점                        | React JSX 또는 Canvas 렌더링                       |
| `var` 키워드                                  | 스코프 혼동, 호이스팅 문제        | `const` 또는 `let` 사용                            |
| `==` 비교 연산자                              | 타입 강제 변환으로 인한 버그      | `===` 사용                                         |
| 상태 직접 변경(mutation)                      | React 리렌더 누락, 상태 불일치    | 새 참조 생성 (spread, map 등)                      |
| `@ts-ignore`                                  | 타입 에러를 숨겨 런타임 버그 유발 | `@ts-expect-error`와 설명 주석 (불가피한 경우에만) |
| `window.location.reload()` 에러 복구          | 사용자 경험 파괴, 상태 손실       | Error Boundary + 재시도 로직                       |
| `.env` 파일 커밋                              | 민감 정보 노출                    | `.gitignore`에 등록, 환경변수로 관리               |
| `any` 타입                                    | 타입 안전성 무력화                | 명시적 타입/인터페이스 정의                        |
| 클래스 컴포넌트                               | 레거시 패턴, 훅 사용 불가         | 함수형 컴포넌트 + 훅                               |
| `Array.unshift`/`splice`로 고빈도 데이터 처리 | O(n) 복사 비용, GC 압박           | 링 버퍼 (`Float64Array`)                           |
| `document.getElementById`                     | React 생명주기 무시               | `useRef` 사용                                      |
| default export (page.tsx 제외)                | 리팩터링 시 이름 추적 불가        | named export                                       |
| 인라인 props 타입                             | 재사용성 저하, 가독성 감소        | 명시적 인터페이스 정의                             |

---

## 부록: 핵심 구현 참조

### A. Binance Combined Stream URL 형식

```
wss://stream.binance.com:9443/stream?streams=<stream1>/<stream2>/<stream3>
```

예시:

```
wss://stream.binance.com:9443/stream?streams=btcusdt@kline_1m/btcusdt@depth@100ms/btcusdt@trade
```

### B. 링 버퍼 구현 참조

```typescript
class RingBuffer {
  private buffer: Float64Array;
  private head = 0;
  private count = 0;
  private readonly fieldsPerEntry: number;
  private readonly capacity: number;

  constructor(capacity: number, fieldsPerEntry: number) {
    this.capacity = capacity;
    this.fieldsPerEntry = fieldsPerEntry;
    this.buffer = new Float64Array(capacity * fieldsPerEntry);
  }

  push(entry: number[]): void {
    const offset = this.head * this.fieldsPerEntry;
    for (let i = 0; i < this.fieldsPerEntry; i++) {
      this.buffer[offset + i] = entry[i];
    }
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  // ... getAt, forEach, clear 등
}
```

### C. 색상 코딩 표준

| 의미        | 색상   | HEX       |
| ----------- | ------ | --------- |
| 매수 (Buy)  | 녹색   | `#00C087` |
| 매도 (Sell) | 빨간색 | `#F6465D` |
| 연결됨      | 녹색   | `#00C087` |
| 재연결 중   | 노란색 | `#F0B90B` |
| 연결 끊김   | 빨간색 | `#F6465D` |

### D. 성능 목표 요약

| 지표                   | 목표               |
| ---------------------- | ------------------ |
| 프레임 레이트          | 60fps (최소 55fps) |
| Canvas 단일 redraw     | < 4ms              |
| Long Task (>50ms) 비율 | < 0.5%             |
| JS Heap (1시간 후)     | < 200MB            |
| Heap 증가율            | < 2MB/hr           |
| LCP                    | < 2.0s             |
| FCP                    | < 1.0s             |
| TTI                    | < 3.0s             |
| 초기 JS 번들 (gzip)    | < 150KB            |
| WebSocket 재연결       | < 3s               |
| DOM 노드 수            | < 500개            |
| Detached DOM Nodes     | 0개                |
