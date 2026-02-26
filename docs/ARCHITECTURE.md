# Real-time Crypto Trading Dashboard - 시스템 아키텍처

**문서 버전**: v2.0
**최종 수정일**: 2026-02-27
**프로젝트 상태**: M0~M5 구현 완료 (셋업, 데이터 레이어, 렌더링, 그리드, 인증, 업비트 통합)

---

## 1. 시스템 아키텍처 개요

### 1.1 아키텍처 원칙

본 시스템은 **서버 트래픽 비용 Zero**를 핵심 원칙으로, 모든 실시간 데이터를 브라우저에서 바이낸스 WebSocket에 직접 연결하여 수신한다. 백엔드 프록시 서버가 존재하지 않으며, Supabase는 오직 사용자 설정(레이아웃, 관심 종목)의 영속화에만 사용된다.

### 1.2 고수준 아키텍처 다이어그램

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER (Client-Only)                        │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    Presentation Layer                          │  │
│  │  ┌─────────────┐ ┌──────────────┐ ┌────────────────────────┐ │  │
│  │  │ React DOM   │ │ Lightweight  │ │  Custom Canvas 2D      │ │  │
│  │  │ (UI Chrome) │ │ Charts       │ │  (OrderBook, Trades)   │ │  │
│  │  │ Header,     │ │ (Candlestick)│ │  rAF + dirty flag      │ │  │
│  │  │ Grid Shell, │ │              │ │                        │ │  │
│  │  │ ThemeToggle │ │              │ │                        │ │  │
│  │  └──────┬──────┘ └──────┬───────┘ └───────────┬────────────┘ │  │
│  └─────────┼───────────────┼─────────────────────┼──────────────┘  │
│            │               │                     │                  │
│  ┌─────────┼───────────────┼─────────────────────┼──────────────┐  │
│  │         ▼               ▼                     ▼               │  │
│  │                    State Layer (Zustand v5)                    │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌───────────┐ │  │
│  │  │ uiStore    │ │ klineStore │ │ depthStore │ │tradeStore │ │  │
│  │  └────────────┘ └─────┬──────┘ └─────┬──────┘ └─────┬─────┘ │  │
│  │  ┌────────────┐       │              │              │        │  │
│  │  │ authStore  │       │              │              │        │  │
│  │  └────────────┘       │              │              │        │  │
│  └───────────────────────┼──────────────┼──────────────┼────────┘  │
│                          │              │              │            │
│  ┌───────────────────────┼──────────────┼──────────────┼────────┐  │
│  │              Data Orchestration Layer                         │  │
│  │            ┌──────────┴──────────────┴──────────────┘        │  │
│  │            │     useWebSocket Hook (생명주기 오케스트레이터)     │  │
│  │            │       ↕ createMessageRouter (이벤트 타입별 분기)   │  │
│  │            └──────────┬──────────────────────────────        │  │
│  └───────────────────────┼──────────────────────────────────────┘  │
│                          │                                         │
│  ┌───────────────────────┼──────────────────────────────────────┐  │
│  │                  Network Layer                                │  │
│  │            ┌──────────┴──────────────┐                       │  │
│  │            │  WebSocketManager       │                       │  │
│  │            │  (Singleton)            │                       │  │
│  │            │  - Combined Stream 연결  │                       │  │
│  │            │  - 지수 백오프 재연결      │                       │  │
│  │            │  - 하트비트 감지           │                       │  │
│  │            │  - Page Visibility API   │                       │  │
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

| 레이어                 | 책임                                   | 구현 모듈                                                           |
| ---------------------- | -------------------------------------- | ------------------------------------------------------------------- |
| **Presentation**       | 화면 렌더링, 사용자 인터랙션           | React DOM, Lightweight Charts, Canvas 2D                            |
| **State**              | 도메인별 상태 관리, selector 기반 구독 | Zustand v5 (uiStore, klineStore, depthStore, tradeStore, authStore) |
| **Data Orchestration** | WebSocket ↔ Store 연결, 메시지 라우팅  | `useWebSocket` 훅, `createMessageRouter`                            |
| **Network**            | WebSocket 연결 관리, REST API 호출     | `WebSocketManager` 싱글톤, `fetchWithRetry`                         |

---

## 2. WebSocket 데이터 파이프라인

### 2.1 WebSocketManager 싱글톤

`src/lib/websocket/WebSocketManager.ts`에 구현된 싱글톤 클래스로, 애플리케이션 전체에서 단일 WebSocket 연결을 관리한다.

```typescript
// 싱글톤 접근
const manager = WebSocketManager.getInstance();

// 공개 API
manager.connect(url: string): void;              // Combined Stream URL로 연결
manager.disconnect(): void;                       // 연결 해제 + 상태 idle로 초기화
manager.subscribe(callback): () => void;          // 메시지 구독 → unsubscribe 함수 반환
manager.onStateChange(callback): () => void;      // 연결 상태 변경 구독
manager.getState(): ConnectionState;              // 현재 연결 상태 조회
```

**핵심 설계 결정**:

- `private constructor()`: 외부에서 인스턴스 생성 차단
- `static getInstance()`: 지연 초기화 싱글톤
- `static resetInstance()`: 테스트 전용 인스턴스 리셋
- 메시지 구독자와 상태 구독자를 `Set`으로 관리하여 O(1) 추가/삭제
- SSR 안전: `typeof window !== 'undefined'` 가드로 서버 측 실행 방지
- 구독자 콜백을 `try/catch`로 감싸 하나의 에러가 다른 구독자에게 전파되지 않도록 격리

### 2.2 Binance Combined Stream URL 구성

`src/lib/binance/streamUrls.ts`에서 URL을 생성한다. 단일 WebSocket 연결로 kline, depth, trade 3개 스트림을 동시에 구독한다.

```typescript
// buildCombinedStreamUrl('BTCUSDT', '1m') 호출 시 생성되는 URL:
// wss://stream.binance.com:9443/stream?streams=btcusdt@kline_1m/btcusdt@depth@100ms/btcusdt@trade

export function buildCombinedStreamUrl(symbol: string, interval: string): string {
  const streams = [
    getKlineStream(symbol, interval), // btcusdt@kline_1m
    getDepthStream(symbol), // btcusdt@depth@100ms
    getTradeStream(symbol), // btcusdt@trade
  ];
  return buildStreamUrl(streams);
}
```

**현재 구현**: 심볼/인터벌 변경 시 기존 WebSocket 연결을 닫고 새 URL로 재연결하는 방식을 사용한다. Combined Stream URL 자체를 재구성하여 `manager.connect(newUrl)`을 호출한다.

### 2.3 메시지 라우팅

`src/lib/websocket/messageRouter.ts`에서 Combined Stream 메시지를 파싱하고 이벤트 타입별로 핸들러에 분배한다.

```text
WebSocket.onmessage
  │
  ▼
parseCombinedStreamMessage(rawJSON)     ← JSON.parse + data 필드 추출
  │
  ▼
{ stream: "btcusdt@kline_1m", data: { e: "kline", ... } }
  │                                      ↓
  │                               data.e 판별 유니온
  │
  ▼
createMessageRouter({                    ← switch(message.e) 분기
  onKline:  → handleKline(),            ← 'kline' → klineStore
  onDepth:  → handleDepth(),            ← 'depthUpdate' → depthStore
  onTrade:  → handleTrade(),            ← 'trade' → tradeStore
})
```

**판별 유니온(Discriminated Union)** 기반 라우팅:

```typescript
// WebSocketStreamMessage = BinanceKlineEvent | BinanceDepthEvent | BinanceTradeEvent | BinanceMiniTickerEvent
// e 필드가 판별자: 'kline' | 'depthUpdate' | 'trade' | '24hrMiniTicker'

export function createMessageRouter(handlers: MessageHandlers) {
  return (message: WebSocketStreamMessage): void => {
    switch (message.e) {
      case 'kline':
        handlers.onKline?.(message);
        break;
      case 'depthUpdate':
        handlers.onDepth?.(message);
        break;
      case 'trade':
        handlers.onTrade?.(message);
        break;
      case '24hrMiniTicker':
        handlers.onMiniTicker?.(message);
        break;
    }
  };
}
```

### 2.4 연결 생명주기 상태 머신

`ConnectionState` 판별 유니온 타입으로 5가지 상태를 추적한다 (`src/types/chart.ts`).

```text
                    connect(url)
  ┌────────┐  ─────────────────▶  ┌──────────────┐
  │  IDLE  │                      │  CONNECTING   │
  └────────┘  ◀─────────────────  └──────┬───────┘
                disconnect()             │
                                   onopen │
                                         ▼
                                  ┌──────────────┐
                         ┌───────│  CONNECTED    │◀──────────────┐
                         │       │ connectedAt   │               │
                         │       └──────┬───────┘               │
                         │              │                        │
                   disconnect()   onclose                  onopen │
                         │              │                        │
                         ▼              ▼                        │
                    ┌────────┐   ┌──────────────┐    재연결 성공  │
                    │  IDLE  │   │ RECONNECTING │───────────────┘
                    └────────┘   │ attempt: n   │
                                 └──────┬───────┘
                                        │
                                  attempt >= 10 (최대)
                                        │
                                        ▼
                                  ┌──────────┐
                                  │  FAILED  │
                                  │  error   │
                                  └──────────┘
```

각 상태의 타입 정의:

```typescript
type ConnectionState =
  | { status: 'idle' }
  | { status: 'connecting' }
  | { status: 'connected'; connectedAt: number }
  | { status: 'reconnecting'; attempt: number }
  | { status: 'failed'; error: string };
```

### 2.5 지수 백오프 재연결 전략

`WebSocketManager.getReconnectDelay()`에 구현:

```typescript
private getReconnectDelay(attempt: number): number {
  return Math.min(
    RECONNECT_BASE_DELAY_MS * Math.pow(2, attempt - 1),
    RECONNECT_MAX_DELAY_MS,
  );
}
// 재연결 시퀀스: 1s → 2s → 4s → 8s → 16s → 30s → 30s → ... (최대 10회)
```

| 상수                        | 값       | 역할                  |
| --------------------------- | -------- | --------------------- |
| `RECONNECT_BASE_DELAY_MS`   | 1,000ms  | 첫 재연결 대기 시간   |
| `RECONNECT_MAX_DELAY_MS`    | 30,000ms | 최대 재연결 대기 시간 |
| `WS_MAX_RECONNECT_ATTEMPTS` | 10       | 최대 재연결 시도 횟수 |

### 2.6 하트비트 감지

30초간 메시지를 수신하지 못하면 연결이 끊어진 것으로 간주한다.

```typescript
// WebSocketManager 내부 구현
private resetHeartbeat(): void {
  this.clearHeartbeat();
  this.heartbeatTimeoutId = setTimeout(() => {
    // 타임아웃 → 기존 WebSocket 강제 종료 → handleClose에서 reconnect 트리거
    if (this.ws) {
      this.ws.close();
    }
  }, HEARTBEAT_TIMEOUT_MS);  // 30,000ms
}
```

- 모든 `handleMessage`에서 `resetHeartbeat()` 호출
- `handleOpen`에서도 `resetHeartbeat()` 호출
- 타임아웃 발생 시 `ws.close()`를 호출하여 `handleClose` → `scheduleReconnect` 흐름으로 재연결

### 2.7 Page Visibility API 연동

```typescript
// WebSocketManager 내부 구현
private handleVisibilityChange(): void {
  if (document.visibilityState === 'hidden') {
    // 탭 비활성: 하트비트 타이머 일시 중지
    // (브라우저가 타이머를 throttle하므로 오탐 방지)
    this.clearHeartbeat();
  } else {
    // 탭 활성화
    if (this.ws?.readyState === WebSocket.OPEN) {
      // 연결 유지 중 → 하트비트 모니터링 재개
      this.resetHeartbeat();
    } else if (this.currentUrl && this.state.status !== 'connecting') {
      // 연결 끊어짐 → 즉시 재연결 (attempt 카운터 초기화)
      this.reconnectAttempt = 0;
      this.cleanup();
      this.setState({ status: 'connecting' });
      this.createWebSocket(this.currentUrl);
    }
  }
}
```

**핵심 결정**: WebSocket 연결 자체는 비활성 탭에서도 유지한다. 오직 하트비트 타이머만 중지하여 브라우저의 타이머 throttle로 인한 오탐(false-positive timeout)을 방지한다.

---

## 3. 상태 관리 아키텍처 (Zustand v5)

### 3.1 Store 분리 전략

도메인별로 5개의 독립 스토어로 분리하여, 하나의 데이터 스트림 업데이트가 관련 없는 컴포넌트의 리렌더를 트리거하지 않도록 한다.

```text
┌─────────────────────────────────────────────────────────┐
│                    Zustand Stores (v5)                    │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │klineStore│ │depthStore│ │tradeStore│ │  uiStore  │  │
│  │          │ │          │ │          │ │           │  │
│  │ candles[]│ │ bids[]   │ │ trades[] │ │ theme     │  │
│  │ interval │ │ asks[]   │ │ lastPrice│ │ symbol    │  │
│  │ isLoading│ │ isDirty  │ │ direction│ │ connState │  │
│  │          │ │ updateId │ │          │ │ layout    │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
│                                                          │
│  ┌──────────┐                                           │
│  │authStore │                                           │
│  │ user     │                                           │
│  │ isLoading│                                           │
│  └──────────┘                                           │
└─────────────────────────────────────────────────────────┘
```

### 3.2 각 Store 인터페이스 (실제 구현)

#### klineStore (`src/stores/klineStore.ts`)

캔들스틱 차트 데이터를 관리한다. 최대 2,000개 캔들을 FIFO 방식으로 유지한다.

```typescript
interface KlineStoreState {
  candles: CandleData[]; // oldest-first 정렬
  interval: KlineInterval; // 기본값: '1m'
  isLoading: boolean;
}

interface KlineStoreActions {
  setCandles: (candles: CandleData[]) => void; // REST API 초기 데이터 설정 (slice로 MAX_CANDLES 적용)
  addCandle: (candle: CandleData) => void; // 마감된 캔들 append + FIFO
  updateLastCandle: (candle: CandleData) => void; // 미완성 캔들 실시간 갱신
  setInterval: (interval: KlineInterval) => void;
  setLoading: (isLoading: boolean) => void;
  reset: () => void;
}
```

**FIFO 전략**: `addCandle`에서 `[...state.candles, newCandle]` 후 `slice(-MAX_CANDLES)`로 오래된 캔들부터 제거. `Array.unshift`를 사용하지 않아 O(1) 삽입 비용.

#### depthStore (`src/stores/depthStore.ts`)

오더북 상태를 관리한다. 증분 업데이트(incremental update)를 지원하며, Canvas 렌더러와의 연동을 위한 `isDirty` 플래그를 제공한다.

```typescript
interface DepthStoreState {
  bids: PriceLevel[]; // 가격 내림차순 (최고 매수가 먼저)
  asks: PriceLevel[]; // 가격 오름차순 (최저 매도가 먼저)
  lastUpdateId: number; // 시퀀스 추적용
  isDirty: boolean; // Canvas redraw 시그널
}

interface DepthStoreActions {
  setBids: (bids: PriceLevel[]) => void;
  setAsks: (asks: PriceLevel[]) => void;
  setSnapshot: (bids, asks, lastUpdateId) => void; // REST 스냅샷 초기화
  applyDepthUpdate: (bidUpdates, askUpdates, finalUpdateId) => void; // WS 증분 적용
  markClean: () => void; // rAF 렌더링 후 호출
  reset: () => void;
}
```

**증분 업데이트 알고리즘** (`applyLevelUpdates`):

1. 기존 레벨을 `Map<price, quantity>`로 변환 (O(n))
2. 업데이트 순회: quantity === 0이면 `map.delete`, 아니면 `map.set` (O(m))
3. Map → 배열 변환 → 정렬 → `slice(0, MAX_DEPTH_LEVELS)` (매수/매도 각 50레벨)

#### tradeStore (`src/stores/tradeStore.ts`)

체결 내역을 newest-first 배열로 관리하며, 최근 가격과 가격 방향을 추적한다.

```typescript
interface TradeStoreState {
  trades: TradeEntry[]; // newest-first
  lastPrice: number; // 최근 체결가 (0이면 미수신)
  lastPriceDirection: PriceDirection; // 'up' | 'down' | 'neutral'
}

interface TradeStoreActions {
  addTrade: (trade: TradeEntry) => void; // prepend + MAX_TRADES(200) 초과 시 slice
  setTrades: (trades: TradeEntry[]) => void; // REST 초기 데이터
  reset: () => void;
}
```

**가격 방향 계산**: `computePriceDirection(newPrice, previousPrice)`로 'up', 'down', 'neutral' 판별. 최초 거래(previousPrice === 0)는 항상 'neutral'.

#### uiStore (`src/stores/uiStore.ts`)

전역 UI 상태를 관리한다.

```typescript
interface UiStoreState {
  theme: 'dark' | 'light';
  symbol: string; // 기본값: 'BTCUSDT'
  connectionState: ConnectionState; // 판별 유니온
  layout: LayoutItem[];
}

interface UiStoreActions {
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setSymbol: (symbol: string) => void;
  setConnectionState: (state: ConnectionState) => void;
  setLayout: (layout: LayoutItem[]) => void;
}
```

#### authStore (`src/stores/authStore.ts`)

사용자 인증 상태를 관리한다 (Supabase 연동 예정).

```typescript
interface AuthStoreState {
  user: UserProfile | null;
  isLoading: boolean;
}
```

### 3.3 Selector 기반 구독 패턴 (실제 사용 예)

`useWebSocket` 훅에서의 실제 구독 패턴:

```typescript
// ✅ 실제 코드: 필요한 액션/값만 개별 구독 (리렌더 최소화)
const storeSymbol = useUiStore((state) => state.symbol);
const setConnectionState = useUiStore((state) => state.setConnectionState);
const connectionState = useUiStore((state) => state.connectionState);

const storeInterval = useKlineStore((state) => state.interval);
const setCandles = useKlineStore((state) => state.setCandles);
const addCandle = useKlineStore((state) => state.addCandle);
const updateLastCandle = useKlineStore((state) => state.updateLastCandle);

const applyDepthUpdate = useDepthStore((state) => state.applyDepthUpdate);
const addTrade = useTradeStore((state) => state.addTrade);
```

```typescript
// ❌ 금지: 스토어 전체 구독
const store = useDepthStore(); // 모든 상태 변경에 리렌더
const { bids, asks } = useDepthStore(); // 구조분해도 전체 구독과 동일
```

---

## 4. useWebSocket: 데이터 오케스트레이션 훅

`src/hooks/useWebSocket.ts`는 WebSocket 생명주기를 관리하는 핵심 훅이다. 심볼/인터벌에 따라 연결을 생성하고, 메시지를 파싱하여 적절한 스토어로 라우팅한다.

### 4.1 데이터 흐름

```text
useWebSocket({ symbol?, interval? })
  │
  ├── 1. 기존 스토어 리셋 (resetKlineStore, resetDepthStore, resetTradeStore)
  │
  ├── 2. createMessageRouter 생성
  │       ├── onKline  → handleKline  → addCandle / updateLastCandle
  │       ├── onDepth  → handleDepth  → applyDepthUpdate
  │       └── onTrade  → handleTrade  → addTrade
  │
  ├── 3. manager.subscribe(router)         ← WebSocket 메시지 구독
  ├── 4. manager.onStateChange(callback)   ← 연결 상태 → uiStore 동기화
  ├── 5. manager.connect(url)              ← Combined Stream 연결
  │
  ├── 6. fetchKlines(symbol, interval)     ← REST API로 히스토리 캔들 fetch
  │       └── setCandles(candles)           ← 초기 차트 데이터 설정
  │
  └── cleanup (언마운트 또는 의존성 변경 시)
        ├── unsubscribeMessages()
        ├── unsubscribeState()
        └── manager.disconnect()
```

### 4.2 메시지 핸들러 상세

```typescript
// Kline 핸들러: k.x (캔들 마감 여부)로 분기
const handleKline = useCallback(
  (event: BinanceKlineEvent): void => {
    const candle = {
      time: k.t / 1000, // ms → s (TradingView 형식)
      open: parseFloat(k.o),
      high: parseFloat(k.h),
      low: parseFloat(k.l),
      close: parseFloat(k.c),
      volume: parseFloat(k.v),
    };

    if (k.x) {
      addCandle(candle); // 마감 → 새 캔들 추가
    } else {
      updateLastCandle(candle); // 미완성 → 마지막 캔들 실시간 갱신
    }
  },
  [addCandle, updateLastCandle],
);

// Depth 핸들러: string 튜플 → PriceLevel 파싱
const handleDepth = useCallback(
  (event: BinanceDepthEvent): void => {
    const bidUpdates = event.b.map(parseDepthLevel); // [string, string] → { price, quantity }
    const askUpdates = event.a.map(parseDepthLevel);
    applyDepthUpdate(bidUpdates, askUpdates, event.u);
  },
  [applyDepthUpdate],
);

// Trade 핸들러: 필드 추출 + 타입 변환
const handleTrade = useCallback(
  (event: BinanceTradeEvent): void => {
    addTrade({
      id: event.t,
      price: parseFloat(event.p),
      quantity: parseFloat(event.q),
      time: event.T,
      isBuyerMaker: event.m,
    });
  },
  [addTrade],
);
```

### 4.3 Stale Closure 방지

`isActiveRef` 패턴으로 비동기 작업(REST fetch)이 완료된 시점에 컴포넌트가 이미 언마운트되었는지 확인한다:

```typescript
const isActiveRef = useRef(true);

useEffect(() => {
  isActiveRef.current = true;

  fetchKlines(symbol, interval)
    .then((candles) => {
      if (isActiveRef.current) {   // 아직 활성 상태인 경우에만 상태 업데이트
        setCandles(candles);
      }
    });

  return () => {
    isActiveRef.current = false;   // cleanup에서 비활성 마킹
  };
}, [symbol, interval, ...]);
```

---

## 5. 렌더링 아키텍처

### 5.1 3계층 렌더링 전략

```text
┌──────────────────────────────────────────────────────────────────┐
│                     렌더링 계층 분리                               │
│                                                                  │
│  Layer 1: React DOM ─────────────────────────────────────────── │
│  │ 역할: UI 크롬 (헤더, 테마 토글, 연결 상태, 그리드 셸)            │
│  │ 갱신 빈도: 낮음 (사용자 인터랙션 기반)                          │
│  │ 구현: DashboardShell, DashboardHeader, ConnectionStatus      │
│  │ 최적화: React.memo, Zustand selector, useCallback            │
│  └─────────────────────────────────────────────────────────────  │
│                                                                  │
│  Layer 2: Lightweight Charts (위임된 Canvas) ─────────────────── │
│  │ 역할: 캔들스틱 차트 렌더링                                      │
│  │ 갱신 빈도: 중간 (캔들 업데이트 시, ~1회/초)                     │
│  │ 최적화: 라이브러리 내부 Canvas 렌더링, update()/addData() API   │
│  │ 상태: M2에서 구현 예정                                          │
│  └─────────────────────────────────────────────────────────────  │
│                                                                  │
│  Layer 3: Custom Canvas 2D ─────────────────────────────────── │
│  │ 역할: 오더북, 체결 내역 렌더링                                  │
│  │ 갱신 빈도: 높음 (초당 10~100회 데이터 수신)                     │
│  │ 최적화: rAF + dirty flag, DOM 완전 우회, 프레임 예산 4ms 이내   │
│  │ 상태: M2에서 구현 예정 (depthStore.isDirty 인프라 준비 완료)     │
│  └─────────────────────────────────────────────────────────────  │
└──────────────────────────────────────────────────────────────────┘
```

### 5.2 데이터 수신-렌더링 분리 패턴 (설계)

```text
시간축 →  0ms    4ms    8ms   12ms   16.67ms (1 frame)
          │      │      │      │      │
  데이터   ■──■───■──────■──────────────    (4건의 depth 업데이트)
  수신     │  │   │      │
           ▼  ▼   ▼      ▼
  상태     ●──●───●──────●──────────────    (4회 state 업데이트, isDirty = true)
  갱신     │                    │
           └── dirty=true ──────┤
                                ▼
  Canvas                       ████          (1회 Canvas redraw)
  렌더링                        │
                                ▼
                           isDirty=false (markClean)

  → 16.67ms 동안 4건의 데이터 업데이트가 발생했지만,
    Canvas redraw는 단 1회만 실행됨 (자연스러운 배치 처리)
```

이 패턴의 인프라는 `depthStore.isDirty` / `depthStore.markClean()`으로 이미 준비되어 있다.

---

## 6. 메모리 관리 아키텍처

### 6.1 데이터 용량 제한 정책

| 데이터 타입 | 스토어     | 자료구조       | 최대 용량           | 폐기 전략                                     |
| ----------- | ---------- | -------------- | ------------------- | --------------------------------------------- |
| 캔들 데이터 | klineStore | `CandleData[]` | 2,000개             | FIFO (`slice(-MAX_CANDLES)`)                  |
| 오더북      | depthStore | `PriceLevel[]` | 매수/매도 각 50레벨 | 정렬 후 `slice(0, MAX_DEPTH_LEVELS)`          |
| 체결 내역   | tradeStore | `TradeEntry[]` | 200건               | newest-first prepend + `slice(0, MAX_TRADES)` |

모든 상한값은 `src/utils/constants.ts`에 상수로 정의:

```typescript
export const MAX_CANDLES = 2000;
export const MAX_TRADES = 200;
export const MAX_DEPTH_LEVELS = 50;
```

### 6.2 링 버퍼 (Ring Buffer)

`src/utils/ringBuffer.ts`에 `Float64Array` 기반 범용 링 버퍼를 구현했다. 현재 Canvas 렌더러에서 사용할 수 있도록 준비된 상태이다.

```typescript
export class RingBuffer {
  private buffer: Float64Array; // capacity × fieldsPerEntry 크기의 고정 배열
  private head: number; // 다음 쓰기 위치
  private count: number; // 현재 저장된 항목 수

  constructor(capacity: number, fieldsPerEntry: number);

  push(entry: number[]): void; // O(1) 순환 쓰기
  getAt(index: number): number[] | null; // O(1) 인덱스 접근 (oldest-first)
  toArray(): number[][]; // 전체 데이터를 일반 배열로 변환
  get length(): number;
  get capacity(): number;
  clear(): void;
}
```

**특성**:

- `Float64Array` 사용으로 GC 압박 최소화
- O(1) 삽입 (헤드 포인터 이동, 모듈러 연산)
- O(1) 인덱스 접근 (오프셋 계산)
- 용량 초과 시 자동 순환 덮어쓰기 (별도 삭제 비용 없음)

### 6.3 메모리 누수 방지 체크리스트

`useWebSocket` 훅의 cleanup 패턴:

```typescript
useEffect(() => {
  // ... 리소스 할당

  return () => {
    isActiveRef.current = false; // ✅ stale closure 방지
    unsubscribeMessages(); // ✅ WebSocket 메시지 구독 해제
    unsubscribeState(); // ✅ 상태 변경 구독 해제
    manager.disconnect(); // ✅ WebSocket 연결 종료
  };
}, [dependencies]);
```

`WebSocketManager.cleanup()` 내부:

```text
✅ clearTimeout(reconnectTimeoutId)          — 재연결 타이머 해제
✅ clearTimeout(heartbeatTimeoutId)          — 하트비트 타이머 해제
✅ ws.removeEventListener (open, close, error, message)  — 이벤트 리스너 제거
✅ ws.close()                                 — WebSocket 연결 종료
✅ document.removeEventListener('visibilitychange', ...) — resetInstance에서 처리
```

---

## 7. 타입 시스템

### 7.1 Binance API 타입 계층

`src/types/binance.ts`에 14개의 타입을 정의했다.

```text
WebSocket 타입:
  BinanceCombinedStreamMessage<T>     ← Combined Stream 래퍼 { stream, data }
  ├── BinanceKlineEvent               ← e: 'kline'
  │   └── BinanceKlineData            ← OHLCV + 메타데이터
  ├── BinanceDepthEvent               ← e: 'depthUpdate'
  │   └── DepthLevel                  ← [price: string, quantity: string]
  ├── BinanceTradeEvent               ← e: 'trade'
  └── BinanceMiniTickerEvent          ← e: '24hrMiniTicker'

  WebSocketStreamMessage = BinanceKlineEvent | BinanceDepthEvent
                         | BinanceTradeEvent | BinanceMiniTickerEvent

REST API 타입:
  BinanceKlineRaw                     ← 12-element tuple
  BinanceDepthSnapshot                ← { lastUpdateId, bids, asks }
  BinanceExchangeInfo                 ← { symbols, rateLimits, ... }
  ├── BinanceSymbolInfo               ← 심볼 상세 정보
  │   └── BinanceSymbolFilter         ← PRICE_FILTER, LOT_SIZE 등
  └── BinanceRateLimit                ← 요율 제한 규칙
```

### 7.2 내부 타입 계층

`src/types/chart.ts`에 차트/거래 관련 타입을 정의했다.

```typescript
// const assertion + 유니온 타입 파생
const KLINE_INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
type KlineInterval = (typeof KLINE_INTERVALS)[number];

// 데이터 인터페이스 (모든 값은 number로 사전 파싱)
interface CandleData { time, open, high, low, close, volume }
interface PriceLevel { price, quantity }
interface TradeEntry { id, price, quantity, time, isBuyerMaker }

// 판별 유니온
type ConnectionState = { status: 'idle' } | { status: 'connecting' } | ...
```

`src/types/widget.ts`에 위젯 시스템 타입을 정의했다:

```typescript
const WIDGET_TYPES = ['candlestick', 'orderbook', 'trades', 'watchlist'] as const;
type WidgetType = (typeof WIDGET_TYPES)[number];

interface WidgetConfig {
  id;
  type;
  title;
}
interface LayoutItem extends WidgetConfig {
  x;
  y;
  w;
  h;
}
type DashboardLayout = LayoutItem[];
```

---

## 8. REST API 클라이언트

`src/lib/binance/restApi.ts`에 3개의 엔드포인트 래퍼를 구현했다.

### 8.1 fetchWithRetry 패턴

모든 REST 호출은 지수 백오프 재시도(최대 3회)를 적용한다:

```typescript
async function fetchWithRetry<T>(url: string, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return (await response.json()) as T;
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      await new Promise(
        (resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt)), // 1s → 2s → 4s
      );
    }
  }
  throw new Error('Unreachable');
}
```

### 8.2 엔드포인트

| 함수                                    | 엔드포인트             | 용도                                    |
| --------------------------------------- | ---------------------- | --------------------------------------- |
| `fetchKlines(symbol, interval, limit?)` | `/api/v3/klines`       | 히스토리 캔들 데이터 (ms → s 변환 포함) |
| `fetchDepthSnapshot(symbol, limit?)`    | `/api/v3/depth`        | 오더북 초기 스냅샷                      |
| `fetchExchangeInfo()`                   | `/api/v3/exchangeInfo` | 심볼 메타데이터                         |

---

## 9. 디렉토리 구조 (현재 구현)

```text
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # 루트 레이아웃 (Inter + JetBrains Mono 폰트, Providers)
│   ├── page.tsx                  # 메인 대시보드 페이지 (DashboardShell 렌더)
│   ├── globals.css               # 디자인 시스템 (CSS Custom Properties, Tailwind v4 테마)
│   └── providers.tsx             # 클라이언트 컴포넌트 (테마 → document.documentElement 동기화)
│
├── components/
│   ├── layout/
│   │   ├── DashboardShell.tsx    # 메인 레이아웃 셸 (memo)
│   │   ├── DashboardHeader.tsx   # 상단 헤더 바 (심볼, 연결 상태, 테마)
│   │   └── ConnectionStatus.tsx  # 5-상태 연결 인디케이터 (색상 도트 + 레이블)
│   │
│   ├── widgets/                  # M2에서 구현 예정
│   │
│   └── ui/
│       ├── ThemeToggle.tsx       # 다크/라이트 토글 (SVG 아이콘)
│       └── ErrorFallback.tsx     # Error Boundary 폴백 UI (재시도 버튼)
│
├── hooks/
│   └── useWebSocket.ts           # WebSocket 생명주기 오케스트레이터
│
├── stores/
│   ├── klineStore.ts             # 캔들 데이터 (2,000개 FIFO)
│   ├── depthStore.ts             # 오더북 (50레벨, isDirty 플래그)
│   ├── tradeStore.ts             # 체결 내역 (200건, 가격 방향 추적)
│   ├── uiStore.ts                # 테마, 심볼, 연결 상태, 레이아웃
│   └── authStore.ts              # 인증 상태 (Supabase 연동 예정)
│
├── lib/
│   ├── websocket/
│   │   ├── WebSocketManager.ts   # 싱글톤 (연결, 재연결, 하트비트, Visibility API)
│   │   └── messageRouter.ts      # 판별 유니온 기반 메시지 라우팅 + JSON 파서
│   │
│   ├── binance/
│   │   ├── streamUrls.ts         # Combined Stream URL 빌더
│   │   └── restApi.ts            # REST API 클라이언트 (fetchWithRetry)
│   │
│   ├── canvas/                   # M2에서 구현 예정
│   │
│   └── supabase/
│       └── client.ts             # Supabase 클라이언트 (환경변수 미설정 시 null)
│
├── types/
│   ├── binance.ts                # Binance API 타입 14개 (WS + REST)
│   ├── chart.ts                  # CandleData, PriceLevel, TradeEntry, ConnectionState
│   └── widget.ts                 # WidgetType, WidgetConfig, LayoutItem, DashboardLayout
│
├── utils/
│   ├── constants.ts              # 모든 설정 상수 (URL, 기본값, 제한값, 색상)
│   ├── ringBuffer.ts             # Float64Array 기반 범용 링 버퍼
│   ├── formatPrice.ts            # 가격/거래량/퍼센트 포맷팅
│   ├── formatTime.ts             # 시간/날짜 포맷팅
│   └── debounce.ts               # 제네릭 디바운스 유틸
│
└── test/
    └── setup.ts                  # Vitest 테스트 셋업 (@testing-library/jest-dom)
```

---

## 10. 에러 처리 전략

### 10.1 에러 처리 계층 (현재 구현 + 계획)

```text
┌────────────────────────────────────────────────┐
│ Level 1: Widget Error Boundary                 │  ← ErrorFallback.tsx 준비 완료
│ - 개별 위젯 크래시 격리                          │
│ - "다시 시도" 버튼 제공                          │
│ - 다른 위젯은 정상 동작 유지                      │
├────────────────────────────────────────────────┤
│ Level 2: WebSocket 에러 처리                    │  ← WebSocketManager 구현 완료
│ - 연결 끊김 → 지수 백오프 자동 재연결 (최대 10회)  │
│ - ConnectionStatus 컴포넌트로 상태 시각화         │
│ - 구독자 콜백 에러 격리 (try/catch)              │
├────────────────────────────────────────────────┤
│ Level 3: REST API 에러 처리                     │  ← fetchWithRetry 구현 완료
│ - 최대 3회 재시도 (1s → 2s → 4s 백오프)          │
│ - 최종 실패 시 console.error 로깅               │
├────────────────────────────────────────────────┤
│ Level 4: 메시지 파싱 에러 처리                    │  ← parseCombinedStreamMessage
│ - JSON 파싱 실패 시 null 반환 (무시)             │
│ - 에러 로깅 후 다음 메시지 정상 처리              │
└────────────────────────────────────────────────┘
```

### 10.2 연결 상태 시각화

`ConnectionStatus` 컴포넌트가 5가지 상태를 시각적으로 표현한다:

| 상태         | 색상                     | 레이블          | 애니메이션 |
| ------------ | ------------------------ | --------------- | ---------- |
| idle         | 회색 (`text-text-muted`) | 대기중          | 없음       |
| connecting   | 노란색 (`text-warning`)  | 연결중...       | 점 깜빡임  |
| connected    | 녹색 (`text-buy`)        | 연결됨          | 없음       |
| reconnecting | 노란색 (`text-warning`)  | 재연결중 (n/10) | 점 깜빡임  |
| failed       | 빨간색 (`text-sell`)     | 연결 실패       | 없음       |

---

## 11. 테스트 인프라

### 11.1 테스트 환경

| 도구                      | 버전 | 용도                                    |
| ------------------------- | ---- | --------------------------------------- |
| Vitest                    | -    | 테스트 러너 (globals: true, jsdom 환경) |
| @testing-library/react    | -    | React 컴포넌트 테스트                   |
| @testing-library/jest-dom | -    | DOM assertion 확장                      |

### 11.2 현재 테스트 커버리지 (105개 테스트)

| 파일                  | 테스트 수 | 검증 대상                                                        |
| --------------------- | --------- | ---------------------------------------------------------------- |
| `ringBuffer.test.ts`  | 22        | push, getAt, toArray, 순환, 오버플로, clear                      |
| `formatPrice.test.ts` | 28        | 가격/거래량/퍼센트 포맷팅 엣지 케이스                            |
| `formatTime.test.ts`  | 7         | 시간/날짜/날짜시간 포맷팅                                        |
| `depthStore.test.ts`  | 19        | 증분 업데이트, 정렬, isDirty 플래그, 스냅샷, reset               |
| `tradeStore.test.ts`  | 14        | addTrade, 가격 방향, MAX_TRADES 초과, setTrades, reset           |
| `klineStore.test.ts`  | 15        | addCandle FIFO, updateLastCandle, setCandles, setInterval, reset |

---

## 12. 디자인 시스템

### 12.1 색상 토큰

CSS Custom Properties로 정의하며, `[data-theme='light']` 속성으로 테마를 전환한다.

| 토큰                   | 다크 테마 | 라이트 테마 | 용도                      |
| ---------------------- | --------- | ----------- | ------------------------- |
| `--color-buy`          | `#00C087` | `#00C087`   | 매수 가격, 연결됨 표시    |
| `--color-sell`         | `#F6465D` | `#F6465D`   | 매도 가격, 연결 실패 표시 |
| `--color-warning`      | `#F0B90B` | `#F0B90B`   | 재연결 중 표시            |
| `--color-bg-primary`   | `#0B0E11` | `#FFFFFF`   | 메인 배경                 |
| `--color-bg-secondary` | `#1E2329` | `#F5F5F5`   | 카드/위젯 배경            |
| `--color-bg-tertiary`  | `#2B3139` | `#EAECEF`   | 입력/호버 배경            |

### 12.2 타이포그래피

| 폰트                       | 용도                    |
| -------------------------- | ----------------------- |
| Inter (sans-serif)         | UI 텍스트, 레이블, 버튼 |
| JetBrains Mono (monospace) | 가격, 수량, 숫자 데이터 |

### 12.3 Tailwind CSS v4 테마 확장

`globals.css`에서 `@theme inline`으로 CSS Custom Properties를 Tailwind 유틸리티 클래스와 연결:

```css
@theme inline {
  --color-bg-primary: var(--color-bg-primary);
  --color-text-primary: var(--color-text-primary);
  --color-buy: var(--color-buy);
  --color-sell: var(--color-sell);
  /* ... */
}
```

---

## 부록: 주요 상수 참조

`src/utils/constants.ts`에서 관리:

```typescript
// 외부 서비스 URL
BINANCE_WS_BASE_URL = 'wss://stream.binance.com:9443/stream';
BINANCE_REST_BASE_URL = 'https://api.binance.com/api/v3';

// 기본값
DEFAULT_SYMBOL = 'BTCUSDT';
DEFAULT_INTERVAL = '1m';

// 데이터 용량 제한
MAX_CANDLES = 2000; // 캔들스틱 최대 개수
MAX_TRADES = 200; // 체결 내역 최대 개수
MAX_DEPTH_LEVELS = 50; // 매수/매도 각 호가 레벨 수

// WebSocket 재연결 설정
RECONNECT_BASE_DELAY_MS = 1000; // 1초
RECONNECT_MAX_DELAY_MS = 30000; // 30초
HEARTBEAT_TIMEOUT_MS = 30000; // 30초
WS_MAX_RECONNECT_ATTEMPTS = 10;

// 색상 코딩
COLORS.BUY = '#00C087';
COLORS.SELL = '#F6465D';
COLORS.CONNECTED = '#00C087';
COLORS.RECONNECTING = '#F0B90B';
COLORS.DISCONNECTED = '#F6465D';
```
