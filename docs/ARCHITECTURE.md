# Real-time Crypto Trading Dashboard - 시스템 아키텍처

**문서 버전**: v1.0
**작성일**: 2026-02-25
**프로젝트 상태**: 기획 단계

## 1. 시스템 아키텍처 개요

### 1.1 아키텍처 원칙

본 시스템은 **서버 트래픽 비용 Zero**를 핵심 원칙으로, 모든 실시간 데이터를 브라우저에서 거래소 WebSocket에 직접 연결하여 수신한다. 백엔드 프록시 서버가 존재하지 않으며, Supabase는 오직 사용자 설정(레이아웃, 관심 종목)의 영속화에만 사용된다.

### 1.2 고수준 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER (Client-Only)                        │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    Presentation Layer                          │  │
│  │  ┌─────────────┐ ┌──────────────┐ ┌────────────────────────┐ │  │
│  │  │ React DOM   │ │ Lightweight  │ │  Custom Canvas 2D      │ │  │
│  │  │ (UI Chrome) │ │ Charts       │ │  (OrderBook, Trades)   │ │  │
│  │  │ Toolbar,    │ │ (Candlestick)│ │  rAF + dirty flag      │ │  │
│  │  │ Grid Shell, │ │              │ │                        │ │  │
│  │  │ Modals      │ │              │ │                        │ │  │
│  │  └──────┬──────┘ └──────┬───────┘ └───────────┬────────────┘ │  │
│  └─────────┼───────────────┼─────────────────────┼──────────────┘  │
│            │               │                     │                  │
│  ┌─────────┼───────────────┼─────────────────────┼──────────────┐  │
│  │         ▼               ▼                     ▼               │  │
│  │                    State Layer (Zustand)                       │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌───────────┐ │  │
│  │  │ UIStore    │ │ KlineStore │ │ DepthStore │ │ TradeStore│ │  │
│  │  └────────────┘ └─────┬──────┘ └─────┬──────┘ └─────┬─────┘ │  │
│  │  ┌────────────┐       │              │              │        │  │
│  │  │ AuthStore  │       │              │              │        │  │
│  │  └────────────┘       │              │              │        │  │
│  └───────────────────────┼──────────────┼──────────────┼────────┘  │
│                          │              │              │            │
│  ┌───────────────────────┼──────────────┼──────────────┼────────┐  │
│  │                  Data Processing Layer                        │  │
│  │            ┌──────────┴──────────────┴──────────────┘        │  │
│  │            │     Message Router (stream type 분기)            │  │
│  │            └──────────┬──────────────────────────────        │  │
│  └───────────────────────┼──────────────────────────────────────┘  │
│                          │                                         │
│  ┌───────────────────────┼──────────────────────────────────────┐  │
│  │                  Network Layer                                │  │
│  │            ┌──────────┴──────────────┐                       │  │
│  │            │  WebSocketManager       │                       │  │
│  │            │  (Singleton)            │                       │  │
│  │            │  - 연결/재연결 관리        │                       │  │
│  │            │  - Combined Stream      │                       │  │
│  │            │  - 지수 백오프            │                       │  │
│  │            └──────────┬──────────────┘                       │  │
│  └───────────────────────┼──────────────────────────────────────┘  │
└──────────────────────────┼──────────────────────────────────────────┘
                           │
            ┌──────────────┼──────────────────┐
            │              │                  │
            ▼              ▼                  ▼
   ┌────────────────┐ ┌──────────┐  ┌──────────────────┐
   │ Binance WS API │ │ Binance  │  │  Supabase        │
   │ (Real-time)    │ │ REST API │  │  (Auth + DB)     │
   │ wss://stream.  │ │ (History)│  │  (Settings only) │
   │ binance.com    │ │          │  │                  │
   └────────────────┘ └──────────┘  └──────────────────┘
```

### 1.3 레이어 분리 원칙

| 레이어 | 책임 | 기술 |
|--------|------|------|
| **Presentation** | 화면 렌더링, 사용자 인터랙션 | React DOM, Lightweight Charts, Canvas 2D |
| **State** | 애플리케이션 상태 관리, 구독 기반 업데이트 | Zustand (도메인별 분리 스토어) |
| **Data Processing** | 메시지 파싱, 라우팅, 데이터 정규화 | TypeScript 순수 함수 |
| **Network** | WebSocket 연결 관리, REST API 호출 | WebSocket API, Fetch API |

---

## 2. WebSocket 데이터 파이프라인

### 2.1 WebSocketManager 싱글톤 설계

```typescript
interface WebSocketManagerConfig {
  maxReconnectAttempts: number;     // 10
  baseReconnectDelay: number;       // 1000ms
  maxReconnectDelay: number;        // 30000ms
  heartbeatTimeout: number;         // 30000ms
  messageRateLimit: number;         // 5 messages/sec (Binance limit)
}

type ConnectionState =
  | { status: 'idle' }
  | { status: 'connecting' }
  | { status: 'connected'; connectedAt: number }
  | { status: 'reconnecting'; attempt: number; nextRetryAt: number }
  | { status: 'failed'; error: string; lastAttemptAt: number };

interface WebSocketManager {
  // 연결 관리
  connect(): void;
  disconnect(): void;
  getConnectionState(): ConnectionState;

  // 구독 관리
  subscribe(streams: string[]): void;
  unsubscribe(streams: string[]): void;
  getActiveStreams(): Set<string>;

  // 이벤트 리스너
  onMessage(handler: (stream: string, data: unknown) => void): () => void;
  onStateChange(handler: (state: ConnectionState) => void): () => void;
}
```

### 2.2 Binance Combined Stream URL 구성

단일 WebSocket 연결로 최대 1024개 스트림을 구독할 수 있는 Combined Stream을 활용한다.

```
wss://stream.binance.com:9443/stream?streams=btcusdt@kline_1m/btcusdt@depth@100ms/btcusdt@trade/btcusdt@miniTicker
```

**URL 구성 전략**:
- 심볼 변경 시 URL 전체를 재구성하지 않고, WebSocket `SUBSCRIBE` / `UNSUBSCRIBE` 메서드 프레임을 전송하여 동적으로 스트림을 추가/제거한다.
- 이 방식으로 심볼 전환 시 WebSocket 연결 자체를 유지하면서 스트림만 교체한다.

```typescript
// 동적 구독 관리 (연결 유지)
const subscribeMessage = {
  method: 'SUBSCRIBE',
  params: ['ethusdt@kline_1m', 'ethusdt@depth@100ms', 'ethusdt@trade'],
  id: Date.now(),
};

const unsubscribeMessage = {
  method: 'UNSUBSCRIBE',
  params: ['btcusdt@kline_1m', 'btcusdt@depth@100ms', 'btcusdt@trade'],
  id: Date.now(),
};
```

### 2.3 메시지 라우팅

```typescript
// Combined Stream 메시지 구조
interface CombinedStreamMessage {
  stream: string;  // e.g., "btcusdt@kline_1m"
  data: unknown;
}

// 메시지 라우터
function routeMessage(message: CombinedStreamMessage): void {
  const { stream, data } = message;

  if (stream.includes('@kline_')) {
    klineStore.getState().processKline(data as BinanceKlineEvent);
  } else if (stream.includes('@depth')) {
    depthStore.getState().processDepthDiff(data as BinanceDepthEvent);
  } else if (stream.includes('@trade')) {
    tradeStore.getState().processTrade(data as BinanceTradeEvent);
  } else if (stream.includes('@miniTicker')) {
    watchlistStore.getState().processMiniTicker(data as BinanceMiniTickerEvent);
  }
}
```

### 2.4 연결 생명주기 상태 머신

```
                    connect()
  ┌────────┐  ─────────────────▶  ┌──────────────┐
  │  IDLE  │                      │  CONNECTING   │
  └────────┘  ◀─────────────────  └──────┬───────┘
                disconnect()             │
                                   onopen │
                                         ▼
                                  ┌──────────────┐
                         ┌───────│  CONNECTED    │◀──────────────┐
                         │       └──────┬───────┘               │
                         │              │                        │
                   disconnect()   onclose/onerror          onopen │
                         │              │                        │
                         ▼              ▼                        │
                    ┌────────┐   ┌──────────────┐    재연결 성공  │
                    │  IDLE  │   │ RECONNECTING │───────────────┘
                    └────────┘   └──────┬───────┘
                                        │
                                  max retries 초과
                                        │
                                        ▼
                                  ┌──────────┐
                                  │  FAILED  │
                                  └──────────┘
```

### 2.5 지수 백오프 재연결 전략

```typescript
function calculateReconnectDelay(attempt: number): number {
  const base = 1000;  // 1초
  const max = 30000;  // 30초
  const delay = Math.min(base * Math.pow(2, attempt), max);
  // 지터(Jitter) 추가: ±20% 랜덤화로 Thundering Herd 방지
  const jitter = delay * 0.2 * (Math.random() - 0.5);
  return delay + jitter;
}

// 재연결 시퀀스: 1초 → 2초 → 4초 → 8초 → 16초 → 30초 → 30초 → ...
```

### 2.6 하트비트 감지

```typescript
// 30초간 메시지 미수신 시 연결 끊김으로 간주
let heartbeatTimer: ReturnType<typeof setTimeout>;

function resetHeartbeat(): void {
  clearTimeout(heartbeatTimer);
  heartbeatTimer = setTimeout(() => {
    // 연결이 끊어진 것으로 간주 → 재연결 시도
    reconnect();
  }, 30_000);
}

// 모든 onmessage에서 resetHeartbeat() 호출
```

### 2.7 Page Visibility API 연동

```typescript
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // 탭 비활성: 렌더링 중단, 데이터는 계속 수신
    pauseRendering();
  } else {
    // 탭 활성화: 오더북 스냅샷 재요청 → 데이터 정합성 복구 → 렌더링 재개
    refreshOrderBookSnapshot();
    resumeRendering();
  }
});
```

**핵심**: WebSocket 연결 자체는 비활성 탭에서도 유지한다. 끊었다가 재연결하면 스냅샷 재요청과 시퀀스 동기화 비용이 더 크기 때문이다. 오직 **렌더링만 중단**하여 CPU를 절약한다.

---

## 3. 상태 관리 아키텍처 (Zustand)

### 3.1 Store 분리 전략

도메인별로 스토어를 분리하여, 하나의 데이터 스트림 업데이트가 관련 없는 컴포넌트의 리렌더를 트리거하지 않도록 한다.

```
┌─────────────────────────────────────────────────────────┐
│                    Zustand Stores                        │
│                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐ │
│  │ KlineStore│ │DepthStore│ │TradeStore│ │WatchStore │ │
│  │           │ │          │ │          │ │           │ │
│  │ candles[] │ │ bids[]   │ │ ringBuf  │ │ symbols[] │ │
│  │ symbol    │ │ asks[]   │ │ head/tail│ │ prices{}  │ │
│  │ interval  │ │ isDirty  │ │ isDirty  │ │           │ │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘ │
│                                                         │
│  ┌──────────┐ ┌──────────┐                             │
│  │ UIStore  │ │AuthStore │                             │
│  │          │ │          │                             │
│  │ theme    │ │ user     │                             │
│  │ layout   │ │ session  │                             │
│  │ symbol   │ │          │                             │
│  └──────────┘ └──────────┘                             │
└─────────────────────────────────────────────────────────┘
```

### 3.2 각 Store 인터페이스

```typescript
// ── KlineStore ──
interface KlineStore {
  candles: CandleData[];
  symbol: string;
  interval: KlineInterval;
  isLoading: boolean;

  // Actions
  processKline(event: BinanceKlineEvent): void;
  setHistoricalCandles(candles: CandleData[]): void;
  changeSymbol(symbol: string): void;
  changeInterval(interval: KlineInterval): void;
}

// ── DepthStore ──
interface DepthStore {
  bids: PriceLevel[];           // 매수 호가 (가격 내림차순)
  asks: PriceLevel[];           // 매도 호가 (가격 오름차순)
  lastUpdateId: number;
  isDirty: boolean;             // Canvas redraw 플래그

  // Actions
  processDepthDiff(event: BinanceDepthEvent): void;
  setSnapshot(snapshot: DepthSnapshot): void;
  markClean(): void;            // rAF에서 렌더링 후 호출
}

// ── TradeStore ──
interface TradeStore {
  buffer: Float64Array;          // 링 버퍼 (200 * 4 fields)
  head: number;
  count: number;
  isDirty: boolean;

  // Actions
  processTrade(event: BinanceTradeEvent): void;
  markClean(): void;
}

// ── UIStore ──
interface UIStore {
  activeSymbol: string;
  theme: 'dark' | 'light';
  layouts: Record<string, LayoutItem[]>;
  connectionState: ConnectionState;

  // Actions
  setActiveSymbol(symbol: string): void;
  setTheme(theme: 'dark' | 'light'): void;
  updateLayout(breakpoint: string, layout: LayoutItem[]): void;
  setConnectionState(state: ConnectionState): void;
}

// ── AuthStore ──
interface AuthStore {
  user: User | null;
  session: Session | null;
  isLoading: boolean;

  // Actions
  signInWithGoogle(): Promise<void>;
  signInWithGitHub(): Promise<void>;
  signOut(): Promise<void>;
  loadSession(): Promise<void>;
}
```

### 3.3 Selector 기반 구독 패턴

```typescript
// ✅ 올바른 패턴: 필요한 값만 구독
function OrderBookWidget() {
  const bids = useDepthStore((state) => state.bids);
  const asks = useDepthStore((state) => state.asks);
  // bids/asks가 변경될 때만 리렌더 (isDirty 변경에는 반응하지 않음)
}

// ✅ 올바른 패턴: 파생 데이터를 selector 내에서 계산
function BestBidPrice() {
  const bestBid = useDepthStore((state) => state.bids[0]?.price ?? 0);
  // 최고 매수 호가가 변경될 때만 리렌더
}

// ❌ 잘못된 패턴: 전체 스토어 구독
function BadComponent() {
  const store = useDepthStore();  // 모든 상태 변경에 리렌더 발생
}
```

### 3.4 트랜지언트 업데이트 (React 리렌더 우회)

Canvas로 렌더링하는 오더북과 체결 내역은 **React 리렌더가 필요 없다**. Zustand `subscribe`로 스토어 변경을 직접 감지하고, Canvas 렌더링 루프에서 데이터를 직접 읽는다.

```typescript
// Canvas 렌더러에서 직접 스토어 구독 (React 렌더 사이클 우회)
useEffect(() => {
  const unsubscribe = depthStore.subscribe(
    (state) => state.isDirty,
    (isDirty) => {
      if (isDirty) {
        // dirty flag만 설정, 실제 렌더링은 rAF 루프에서 수행
        requestRedraw();
      }
    }
  );
  return unsubscribe;
}, []);
```

---

## 4. 렌더링 아키텍처

### 4.1 3계층 렌더링 전략

```
┌──────────────────────────────────────────────────────────────────┐
│                     렌더링 계층 분리                               │
│                                                                  │
│  Layer 1: React DOM ─────────────────────────────────────────── │
│  │ 역할: UI 크롬 (툴바, 사이드바, 그리드 셸, 모달, 토스트)         │
│  │ 갱신 빈도: 낮음 (사용자 인터랙션 기반)                          │
│  │ 최적화: React.memo, Zustand selector, useCallback            │
│  └─────────────────────────────────────────────────────────────  │
│                                                                  │
│  Layer 2: Lightweight Charts (위임된 Canvas) ─────────────────── │
│  │ 역할: 캔들스틱 차트 렌더링                                      │
│  │ 갱신 빈도: 중간 (캔들 업데이트 시, ~1회/초)                     │
│  │ 최적화: 라이브러리 내부 Canvas 렌더링, update()/addData() API   │
│  └─────────────────────────────────────────────────────────────  │
│                                                                  │
│  Layer 3: Custom Canvas 2D ─────────────────────────────────── │
│  │ 역할: 오더북, 체결 내역 렌더링                                  │
│  │ 갱신 빈도: 높음 (초당 10~100회 데이터 수신)                     │
│  │ 최적화: rAF + dirty flag, DOM 완전 우회, 프레임 예산 4ms 이내   │
│  └─────────────────────────────────────────────────────────────  │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 requestAnimationFrame 렌더링 루프

```typescript
class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animationFrameId: number | null = null;
  private isDirty = false;

  start(): void {
    const loop = (): void => {
      if (this.isDirty) {
        const start = performance.now();
        this.draw();
        this.isDirty = false;
        const elapsed = performance.now() - start;

        if (elapsed > 4) {
          console.warn(`[Canvas] Frame budget exceeded: ${elapsed.toFixed(2)}ms`);
        }
      }
      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  markDirty(): void {
    this.isDirty = true;
  }

  private draw(): void {
    // 구체적 렌더링 로직은 서브클래스에서 구현
  }
}
```

### 4.3 데이터 수신-렌더링 분리 (Decoupling)

```
시간축 →  0ms    4ms    8ms   12ms   16.67ms (1 frame)
          │      │      │      │      │
  데이터   ■──■───■──────■──────────────    (4건의 depth 업데이트)
  수신     │  │   │      │
           ▼  ▼   ▼      ▼
  상태     ●──●───●──────●──────────────    (4회 state 업데이트)
  갱신     │                    │
           └── dirty=true ──────┤
                                ▼
  Canvas                       ████          (1회 Canvas redraw)
  렌더링                        │
                                ▼
                           dirty=false

  → 16.67ms 동안 4건의 데이터 업데이트가 발생했지만,
    Canvas redraw는 단 1회만 실행됨 (자연스러운 배치 처리)
```

### 4.4 devicePixelRatio 처리

```typescript
function setupHighDPICanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number
): CanvasRenderingContext2D {
  const dpr = window.devicePixelRatio || 1;

  // Canvas 물리적 크기 (픽셀)
  canvas.width = width * dpr;
  canvas.height = height * dpr;

  // CSS 논리적 크기
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  return ctx;
}
```

### 4.5 ResizeObserver 통합

```typescript
useEffect(() => {
  const observer = new ResizeObserver(
    debounce((entries: ResizeObserverEntry[]) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setupHighDPICanvas(canvasRef.current!, width, height);
        renderer.markDirty();  // 리사이즈 후 즉시 재렌더링
      }
    }, 200)
  );

  observer.observe(containerRef.current!);
  return () => observer.disconnect();
}, []);
```

---

## 5. 메모리 관리 아키텍처

### 5.1 데이터 용량 제한 정책

| 데이터 타입 | 자료구조 | 최대 용량 | 폐기 전략 |
|------------|---------|----------|----------|
| 캔들 데이터 | `CandleData[]` | 2,000개 | FIFO (shift) |
| 오더북 | `PriceLevel[]` | 매수/매도 각 50레벨 | depth 초과분 절삭 |
| 체결 내역 | `Float64Array` 링 버퍼 | 200건 (200 × 4 fields) | 순환 덮어쓰기 |
| 관심 종목 | `WatchlistItem[]` | 20개 | 사용자 수동 관리 |

### 5.2 링 버퍼 (Ring Buffer) 설계

```typescript
class TradeRingBuffer {
  private buffer: Float64Array;
  private head = 0;
  private count = 0;
  private readonly capacity: number;
  private readonly fieldsPerEntry = 4; // [timestamp, price, quantity, isBuyerMaker]

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Float64Array(capacity * this.fieldsPerEntry);
  }

  push(timestamp: number, price: number, quantity: number, isBuyerMaker: number): void {
    const offset = this.head * this.fieldsPerEntry;
    this.buffer[offset] = timestamp;
    this.buffer[offset + 1] = price;
    this.buffer[offset + 2] = quantity;
    this.buffer[offset + 3] = isBuyerMaker;

    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  // O(1) 접근, GC 압박 Zero, 배열 조작 없음
  getEntry(index: number): [number, number, number, number] {
    const actualIndex = ((this.head - 1 - index + this.capacity) % this.capacity);
    const offset = actualIndex * this.fieldsPerEntry;
    return [
      this.buffer[offset],
      this.buffer[offset + 1],
      this.buffer[offset + 2],
      this.buffer[offset + 3],
    ];
  }
}
```

### 5.3 메모리 누수 방지 체크리스트

```
✅ 모든 useEffect에 cleanup 함수 반환
✅ WebSocket 구독 → 언마운트 시 unsubscribe
✅ addEventListener → 언마운트 시 removeEventListener
✅ setTimeout/setInterval → 언마운트 시 clear
✅ requestAnimationFrame → 언마운트 시 cancelAnimationFrame
✅ Lightweight Charts → 언마운트 시 chart.remove()
✅ ResizeObserver → 언마운트 시 observer.disconnect()
✅ Zustand subscribe → 언마운트 시 unsubscribe 함수 호출
```

---

## 6. 컴포넌트 아키텍처

### 6.1 위젯 시스템 설계

```
┌─ DashboardPage ────────────────────────────────────────────┐
│                                                            │
│  ┌─ DashboardHeader ─────────────────────────────────────┐ │
│  │ SymbolSelector │ ConnectionStatus │ ThemeToggle │ Auth │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌─ WidgetGrid (React Grid Layout) ─────────────────────┐ │
│  │                                                       │ │
│  │  ┌─ WidgetContainer ──┐  ┌─ WidgetContainer ───────┐ │ │
│  │  │ ┌─ WidgetHeader ─┐ │  │ ┌─ WidgetHeader ──────┐ │ │ │
│  │  │ │ Title │ × Close │ │  │ │ Title │ Settings │ × │ │ │ │
│  │  │ └────────────────┘ │  │ └─────────────────────┘ │ │ │
│  │  │ ┌─ ErrorBoundary ┐ │  │ ┌─ ErrorBoundary ────┐ │ │ │
│  │  │ │                 │ │  │ │                     │ │ │ │
│  │  │ │ CandlestickChart│ │  │ │  OrderBookCanvas   │ │ │ │
│  │  │ │ (LW Charts)    │ │  │ │  (Custom Canvas)   │ │ │ │
│  │  │ │                 │ │  │ │                     │ │ │ │
│  │  │ └─────────────────┘ │  │ └─────────────────────┘ │ │ │
│  │  └────────────────────┘  └─────────────────────────┘ │ │
│  │                                                       │ │
│  │  ┌─ WidgetContainer ──┐  ┌─ WidgetContainer ───────┐ │ │
│  │  │ TradeHistoryCanvas │  │ WatchlistWidget          │ │ │
│  │  └────────────────────┘  └─────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

### 6.2 위젯 생명주기

```
mount
  │
  ├──▶ ErrorBoundary 래핑
  ├──▶ Zustand store 구독 (selector 기반)
  ├──▶ WebSocket 스트림 구독
  ├──▶ Canvas 초기화 (devicePixelRatio 설정)
  ├──▶ ResizeObserver 등록
  ├──▶ rAF 렌더링 루프 시작
  │
  ▼ (실행 중)
  │
  ├──▶ 데이터 수신 → store 업데이트 → dirty flag → rAF redraw
  ├──▶ 리사이즈 → Canvas 재설정 → redraw
  ├──▶ 심볼 변경 → 기존 구독 해제 → 새 구독 → 스냅샷 fetch
  │
unmount
  │
  ├──▶ rAF 루프 중단 (cancelAnimationFrame)
  ├──▶ WebSocket 스트림 unsubscribe
  ├──▶ ResizeObserver disconnect
  ├──▶ Zustand unsubscribe
  ├──▶ Chart instance remove (Lightweight Charts)
  └──▶ Canvas 리소스 해제
```

### 6.3 위젯 등록 시스템

```typescript
// 위젯 타입 → 컴포넌트 매핑
const WIDGET_REGISTRY: Record<WidgetType, WidgetRegistration> = {
  candlestick: {
    component: lazy(() => import('@/components/widgets/CandlestickChartWidget')),
    defaultSize: { w: 8, h: 4 },
    minSize: { w: 4, h: 3 },
    title: 'Candlestick Chart',
    streams: (symbol) => [`${symbol}@kline_1m`],
  },
  orderbook: {
    component: lazy(() => import('@/components/widgets/OrderBookWidget')),
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
    title: 'Order Book',
    streams: (symbol) => [`${symbol}@depth@100ms`],
  },
  trades: {
    component: lazy(() => import('@/components/widgets/TradeHistoryWidget')),
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 2 },
    title: 'Recent Trades',
    streams: (symbol) => [`${symbol}@trade`],
  },
  watchlist: {
    component: lazy(() => import('@/components/widgets/WatchlistWidget')),
    defaultSize: { w: 4, h: 2 },
    minSize: { w: 3, h: 2 },
    title: 'Watchlist',
    streams: (symbols) => symbols.map((s) => `${s}@miniTicker`),
  },
};
```

---

## 7. Supabase 연동 구조

### 7.1 인증 흐름

```
┌──────────┐    ┌────────────┐    ┌──────────────┐    ┌──────────┐
│  사용자   │───▶│ AuthButton │───▶│ Supabase Auth│───▶│ OAuth    │
│ (브라우저) │    │ (클릭)     │    │ signInWith   │    │ Provider │
└──────────┘    └────────────┘    │ OAuth()      │    │ (Google/ │
                                  └──────┬───────┘    │  GitHub) │
                                         │            └─────┬────┘
                                         │                  │
                                         │  ◀── redirect ───┘
                                         │     (with code)
                                         ▼
                                  ┌──────────────┐
                                  │ Session 생성  │
                                  │ JWT 토큰 저장 │
                                  │ Auto-refresh  │
                                  └──────┬───────┘
                                         │
                                         ▼
                                  ┌──────────────┐
                                  │ AuthStore    │
                                  │ user/session │
                                  │ 상태 갱신     │
                                  └──────────────┘
```

### 7.2 데이터베이스 스키마

```sql
-- 사용자 대시보드 레이아웃
CREATE TABLE user_layouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL DEFAULT 'Default',
  layout JSONB NOT NULL,           -- React Grid Layout 직렬화 데이터
  active_symbol TEXT DEFAULT 'btcusdt',
  settings JSONB DEFAULT '{}',     -- 위젯별 설정 (타임프레임, 오더북 depth 등)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 사용자 관심 종목
CREATE TABLE user_watchlists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  symbols TEXT[] NOT NULL DEFAULT '{}',  -- ['btcusdt', 'ethusdt', ...]
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_user_layouts_user_id ON user_layouts(user_id);
CREATE INDEX idx_user_watchlists_user_id ON user_watchlists(user_id);
```

### 7.3 RLS (Row Level Security) 정책

```sql
-- user_layouts RLS
ALTER TABLE user_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own layouts"
  ON user_layouts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- user_watchlists RLS
ALTER TABLE user_watchlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own watchlists"
  ON user_watchlists FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### 7.4 localStorage 폴백 및 마이그레이션

```typescript
// 비로그인 → 로그인 시 마이그레이션 흐름
async function migrateLocalToCloud(userId: string): Promise<void> {
  const localLayout = localStorage.getItem('dashboard-layout');
  const localWatchlist = localStorage.getItem('watchlist');

  if (localLayout) {
    await supabase.from('user_layouts').upsert({
      user_id: userId,
      layout: JSON.parse(localLayout),
      is_active: true,
    });
    localStorage.removeItem('dashboard-layout');
  }

  if (localWatchlist) {
    await supabase.from('user_watchlists').upsert({
      user_id: userId,
      symbols: JSON.parse(localWatchlist),
    });
    localStorage.removeItem('watchlist');
  }
}
```

---

## 8. 디렉토리 구조

```
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout (ThemeProvider, AuthProvider)
│   ├── page.tsx                  # Dashboard main page
│   ├── globals.css               # Global styles
│   └── providers.tsx             # Client-side providers wrapper
│
├── components/
│   ├── layout/
│   │   ├── DashboardHeader.tsx   # 상단 헤더 바
│   │   ├── WidgetGrid.tsx        # React Grid Layout 컨테이너
│   │   └── WidgetContainer.tsx   # 개별 위젯 래퍼 (헤더, 에러바운더리)
│   │
│   ├── widgets/
│   │   ├── CandlestickChartWidget.tsx
│   │   ├── OrderBookWidget.tsx
│   │   ├── TradeHistoryWidget.tsx
│   │   └── WatchlistWidget.tsx
│   │
│   └── ui/
│       ├── SymbolSelector.tsx
│       ├── ConnectionStatus.tsx
│       ├── ThemeToggle.tsx
│       ├── AuthButton.tsx
│       ├── ProfileDropdown.tsx
│       ├── Toast.tsx
│       └── ErrorFallback.tsx
│
├── hooks/
│   ├── useWebSocket.ts           # WebSocket 구독 관리 훅
│   ├── useCanvasRenderer.ts      # Canvas rAF 루프 관리 훅
│   ├── useResizeObserver.ts      # ResizeObserver 래퍼 훅
│   ├── useLocalStorage.ts        # localStorage 래퍼 훅
│   └── useAuth.ts                # Supabase Auth 래퍼 훅
│
├── stores/
│   ├── klineStore.ts
│   ├── depthStore.ts
│   ├── tradeStore.ts
│   ├── watchlistStore.ts
│   ├── uiStore.ts
│   └── authStore.ts
│
├── lib/
│   ├── websocket/
│   │   ├── WebSocketManager.ts   # 싱글톤 연결 관리자
│   │   ├── messageRouter.ts      # 메시지 타입별 라우팅
│   │   └── reconnectStrategy.ts  # 지수 백오프 로직
│   │
│   ├── canvas/
│   │   ├── OrderBookRenderer.ts  # 오더북 Canvas 렌더러
│   │   ├── TradeRenderer.ts      # 체결 내역 Canvas 렌더러
│   │   └── canvasUtils.ts        # DPI 설정, 텍스트 측정 등
│   │
│   ├── supabase/
│   │   ├── client.ts             # Supabase 클라이언트 초기화
│   │   ├── layoutService.ts      # 레이아웃 CRUD
│   │   └── watchlistService.ts   # 관심 종목 CRUD
│   │
│   └── binance/
│       ├── restApi.ts            # REST API 호출 (히스토리 데이터)
│       └── streamUrls.ts         # 스트림 URL 생성 유틸
│
├── types/
│   ├── binance.ts                # Binance API 응답 타입
│   ├── chart.ts                  # 차트 관련 타입
│   ├── widget.ts                 # 위젯 시스템 타입
│   └── store.ts                  # Zustand 스토어 타입
│
└── utils/
    ├── formatPrice.ts            # 가격 포맷팅
    ├── formatTime.ts             # 시간 포맷팅
    ├── debounce.ts               # 디바운스 유틸
    ├── ringBuffer.ts             # 링 버퍼 구현
    └── constants.ts              # 상수 정의
```

---

## 9. 데이터 무결성

### 9.1 오더북 시퀀스 추적

```typescript
// Binance 오더북 동기화 프로토콜
// 1. REST로 스냅샷 요청: GET /api/v3/depth?symbol=BTCUSDT&limit=1000
// 2. 스냅샷의 lastUpdateId 기록
// 3. WebSocket diff 이벤트 수신:
//    - U <= lastUpdateId+1 <= u 인 첫 이벤트부터 적용
//    - 이전 이벤트의 u+1 === 현재 이벤트의 U 인지 검증
//    - 갭 발생 시 스냅샷 재요청

interface DepthSyncState {
  lastUpdateId: number;
  isInitialized: boolean;
  pendingDiffs: BinanceDepthEvent[];  // 스냅샷 도착 전 버퍼링
}

function processDepthEvent(
  state: DepthSyncState,
  event: BinanceDepthEvent
): 'apply' | 'skip' | 'resync' {
  if (!state.isInitialized) {
    state.pendingDiffs.push(event);
    return 'skip';
  }

  if (event.u <= state.lastUpdateId) {
    return 'skip';  // 이미 반영된 이벤트
  }

  if (event.U > state.lastUpdateId + 1) {
    return 'resync';  // 시퀀스 갭 → 스냅샷 재요청
  }

  state.lastUpdateId = event.u;
  return 'apply';
}
```

### 9.2 캔들 마감 처리

```typescript
function processKlineEvent(event: BinanceKlineEvent): void {
  const candle: CandleData = {
    time: event.k.t / 1000,
    open: parseFloat(event.k.o),
    high: parseFloat(event.k.h),
    low: parseFloat(event.k.l),
    close: parseFloat(event.k.c),
    volume: parseFloat(event.k.v),
  };

  if (event.k.x) {
    // 캔들 마감: 확정된 캔들 추가
    chartInstance.update(candle);  // 기존 미완성 캔들을 확정값으로 업데이트
  } else {
    // 미완성 캔들: 실시간 업데이트
    chartInstance.update(candle);  // 현재 캔들 실시간 갱신
  }
}
```

---

## 10. 에러 처리 전략

### 10.1 에러 처리 계층

```
┌────────────────────────────────────────────────┐
│ Level 1: Widget Error Boundary                 │
│ - 개별 위젯 크래시 격리                          │
│ - 에러 UI + "다시 시도" 버튼 표시                │
│ - 다른 위젯은 정상 동작 유지                      │
├────────────────────────────────────────────────┤
│ Level 2: WebSocket 에러 처리                    │
│ - 연결 끊김 → 지수 백오프 자동 재연결             │
│ - 상태 표시기 업데이트 (녹색/노란색/빨간색)        │
│ - 비침입적 토스트 알림                           │
├────────────────────────────────────────────────┤
│ Level 3: API 에러 처리                          │
│ - REST 요청 실패 → 최대 3회 재시도 (백오프)       │
│ - 최종 실패 시 에러 상태 표시                     │
├────────────────────────────────────────────────┤
│ Level 4: 네트워크 에러 처리                      │
│ - navigator.onLine / online/offline 이벤트 감지  │
│ - 오프라인 배너 표시                             │
│ - 온라인 복귀 시 자동 복구                        │
├────────────────────────────────────────────────┤
│ Level 5: Global Error Boundary                 │
│ - 전체 앱 크래시 방어 (최후의 보루)               │
│ - 에러 리포팅 + 새로고침 안내                     │
└────────────────────────────────────────────────┘
```

### 10.2 에러 복구 전략

| 에러 유형 | 감지 방법 | 복구 전략 |
|----------|----------|----------|
| WebSocket 연결 끊김 | `onclose`, `onerror` | 지수 백오프 재연결 (최대 10회) |
| 오더북 시퀀스 갭 | `lastUpdateId` 불일치 | 스냅샷 재요청 |
| REST API 실패 | HTTP status code | 3회 재시도 후 에러 표시 |
| 위젯 렌더링 크래시 | Error Boundary `componentDidCatch` | 에러 UI 표시, 수동 재시도 |
| 메모리 임계치 초과 | `performance.measureUserAgentSpecificMemory()` | 오래된 데이터 강제 정리, 사용자 알림 |
| 네트워크 오프라인 | `navigator.onLine`, `offline` event | 오프라인 배너, 온라인 복귀 시 자동 재연결 |
