# Real-time Crypto Trading Dashboard - 디자인 명세서 (DESIGN.md)

**문서 버전**: v1.0
**작성일**: 2026-02-25
**프로젝트 상태**: 설계 단계
**관련 문서**: [PRD.md](./PRD.md)

본 문서는 Real-time Crypto Trading Dashboard의 디자인 시스템, 컴포넌트 구조, 그리드 레이아웃, Canvas 렌더링 파이프라인, 상태 관리 전략, 인터랙션, 반응형, 접근성, 에러 상태 UI에 대한 포괄적 설계 명세를 다룬다. 14년 차 프론트엔드 개발자의 시니어 레벨 설계 역량을 반영한 문서이다.

---

## 1. 디자인 시스템

### 1.1 컬러 팔레트

모든 색상은 CSS Custom Properties(변수)로 정의하여 다크/라이트 테마 전환 시 루트 변수만 교체한다. FOUC(Flash of Unstyled Content)를 방지하기 위해 `<script>`를 `<head>`에 인라인 삽입하여 `document.documentElement.dataset.theme`을 페인트 전에 설정한다.

#### 1.1.1 시맨틱 컬러 토큰

| 토큰 이름 | 다크 모드 | 라이트 모드 | 용도 |
|-----------|-----------|-------------|------|
| `--color-bg-primary` | `#0B0E11` | `#FFFFFF` | 페이지 최상위 배경 |
| `--color-bg-secondary` | `#1E2329` | `#F5F5F5` | 위젯/카드 배경 |
| `--color-bg-tertiary` | `#2B3139` | `#EAECEF` | 호버/선택 배경, 입력 필드 |
| `--color-bg-elevated` | `#363C45` | `#FFFFFF` | 드롭다운, 팝오버, 모달 |
| `--color-surface-overlay` | `rgba(0,0,0,0.5)` | `rgba(0,0,0,0.3)` | 모달 오버레이 |
| `--color-border-primary` | `#2B3139` | `#EAECEF` | 주요 보더 |
| `--color-border-secondary` | `#363C45` | `#D5D8DC` | 보조 보더 |
| `--color-border-focus` | `#F0B90B` | `#F0B90B` | 포커스 링 |
| `--color-text-primary` | `#EAECEF` | `#1E2329` | 주요 텍스트 |
| `--color-text-secondary` | `#848E9C` | `#707A8A` | 보조 텍스트, 레이블 |
| `--color-text-tertiary` | `#5E6673` | `#B7BDC6` | 비활성 텍스트, 힌트 |
| `--color-text-inverse` | `#1E2329` | `#FFFFFF` | 반전 텍스트 (버튼 내부 등) |

#### 1.1.2 트레이딩 컬러

| 토큰 이름 | 값 | 용도 |
|-----------|-----|------|
| `--color-buy` | `#00C087` | 매수/상승 (녹색) |
| `--color-buy-bg` | `rgba(0,192,135,0.12)` | 매수 배경 하이라이트 |
| `--color-buy-hover` | `rgba(0,192,135,0.20)` | 매수 행 호버 |
| `--color-sell` | `#F6465D` | 매도/하락 (적색) |
| `--color-sell-bg` | `rgba(246,70,93,0.12)` | 매도 배경 하이라이트 |
| `--color-sell-hover` | `rgba(246,70,93,0.20)` | 매도 행 호버 |
| `--color-neutral` | `#F0B90B` | 보합/경고/액센트 (노란색) |

#### 1.1.3 시스템 상태 컬러

| 토큰 이름 | 값 | 용도 |
|-----------|-----|------|
| `--color-success` | `#00C087` | 연결 성공, 정상 상태 |
| `--color-warning` | `#F0B90B` | 재연결 중, 주의 |
| `--color-error` | `#F6465D` | 연결 끊김, 에러 |
| `--color-info` | `#1E9AEF` | 정보성 알림 |

#### 1.1.4 Canvas 전용 컬러 (HEX → RGB 변환 캐시)

Canvas 2D Context에서는 CSS 변수를 직접 참조할 수 없으므로, 테마 변경 시 아래 컬러 맵 객체를 갱신하여 Canvas 렌더러에 전달한다.

```typescript
interface CanvasColorTheme {
  bg: string;              // 캔버스 배경
  gridLine: string;        // 그리드 라인
  textPrimary: string;     // 주요 텍스트 (가격, 수량)
  textSecondary: string;   // 보조 텍스트 (시간, 레이블)
  buy: string;             // 매수 색상
  buyBar: string;          // 매수 깊이 바 (반투명)
  buyHighlight: string;    // 매수 하이라이트
  sell: string;            // 매도 색상
  sellBar: string;         // 매도 깊이 바 (반투명)
  sellHighlight: string;   // 매도 하이라이트
  separator: string;       // 행 구분선
  scrollbar: string;       // 스크롤 인디케이터
}

const DARK_CANVAS_THEME: CanvasColorTheme = {
  bg: '#1E2329',
  gridLine: '#2B3139',
  textPrimary: '#EAECEF',
  textSecondary: '#848E9C',
  buy: '#00C087',
  buyBar: 'rgba(0,192,135,0.15)',
  buyHighlight: 'rgba(0,192,135,0.35)',
  sell: '#F6465D',
  sellBar: 'rgba(246,70,93,0.15)',
  sellHighlight: 'rgba(246,70,93,0.35)',
  separator: '#2B3139',
  scrollbar: '#363C45',
};

const LIGHT_CANVAS_THEME: CanvasColorTheme = {
  bg: '#FFFFFF',
  gridLine: '#EAECEF',
  textPrimary: '#1E2329',
  textSecondary: '#707A8A',
  buy: '#00C087',
  buyBar: 'rgba(0,192,135,0.10)',
  buyHighlight: 'rgba(0,192,135,0.25)',
  sell: '#F6465D',
  sellBar: 'rgba(246,70,93,0.10)',
  sellHighlight: 'rgba(246,70,93,0.25)',
  separator: '#EAECEF',
  scrollbar: '#D5D8DC',
};
```

### 1.2 타이포그래피

금융 트레이딩 인터페이스의 핵심은 **숫자의 정렬과 가독성**이다. 모든 숫자(가격, 수량, 변동률)는 모노스페이스 폰트를 사용하여 자릿수가 완벽히 수직 정렬되도록 한다.

#### 1.2.1 폰트 스택

```css
/* UI 텍스트: 레이블, 버튼, 메뉴 */
--font-family-sans: 'Inter', -apple-system, BlinkMacSystemFont,
  'Segoe UI', Roboto, sans-serif;

/* 숫자 데이터: 가격, 수량, 시간 */
--font-family-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono',
  'Cascadia Code', 'Consolas', monospace;
```

#### 1.2.2 타이포그래피 스케일

4px 베이스 그리드에 맞춘 타입 스케일. `line-height`는 4의 배수로 설정한다.

| 토큰 | font-size | line-height | font-weight | 용도 |
|------|-----------|-------------|-------------|------|
| `--text-xs` | 10px | 16px | 400 | 타임스탬프, 미세 레이블 |
| `--text-sm` | 12px | 16px | 400 | 오더북/체결 내역 데이터, 보조 정보 |
| `--text-base` | 14px | 20px | 400 | 기본 UI 텍스트, 버튼, 입력 필드 |
| `--text-md` | 16px | 24px | 500 | 위젯 헤더 타이틀, 현재가 |
| `--text-lg` | 20px | 28px | 600 | 심볼 이름, 주요 가격 표시 |
| `--text-xl` | 24px | 32px | 700 | 대시보드 타이틀 (거의 사용하지 않음) |

#### 1.2.3 Canvas 텍스트 렌더링 규격

Canvas에서 텍스트를 렌더링할 때 `ctx.font`에 직접 전달하는 규격이다.

```typescript
const CANVAS_FONTS = {
  price: '12px "JetBrains Mono", monospace',       // 가격 텍스트
  quantity: '12px "JetBrains Mono", monospace',     // 수량 텍스트
  header: '500 13px "Inter", sans-serif',           // 컬럼 헤더
  timestamp: '10px "JetBrains Mono", monospace',    // 시간 텍스트
  label: '11px "Inter", sans-serif',                // 보조 레이블
} as const;
```

### 1.3 스페이싱 시스템

4px 베이스 그리드를 기반으로 모든 간격을 정의한다. 이는 금융 대시보드의 높은 정보 밀도를 유지하면서도 일관된 시각적 리듬을 보장한다.

| 토큰 | 값 | 용도 |
|------|-----|------|
| `--space-0` | 0px | 리셋 |
| `--space-1` | 4px | 최소 간격, 아이콘과 텍스트 사이 |
| `--space-2` | 8px | 인라인 요소 간격, 오더북 행 패딩 |
| `--space-3` | 12px | 컴팩트 패딩, 위젯 내부 좌우 여백 |
| `--space-4` | 16px | 기본 패딩, 위젯 헤더 패딩 |
| `--space-5` | 20px | 섹션 간격 |
| `--space-6` | 24px | 위젯 간 갭 (그리드 갭) |
| `--space-8` | 32px | 큰 섹션 간격 |
| `--space-10` | 40px | 페이지 레벨 패딩 |

### 1.4 보더 라디우스

| 토큰 | 값 | 용도 |
|------|-----|------|
| `--radius-none` | 0px | 리셋 |
| `--radius-sm` | 4px | 버튼, 입력 필드, 태그 |
| `--radius-md` | 8px | 위젯 컨테이너, 카드 |
| `--radius-lg` | 12px | 모달, 드롭다운 |
| `--radius-full` | 9999px | 원형 아이콘, 상태 인디케이터, 아바타 |

### 1.5 그림자 및 엘리베이션

다크 모드에서는 그림자 대신 보더와 배경색 차이로 엘리베이션을 표현한다. 라이트 모드에서만 그림자가 시각적으로 유의미하다.

| 토큰 | 다크 모드 | 라이트 모드 | 용도 |
|------|-----------|-------------|------|
| `--shadow-sm` | `none` | `0 1px 2px rgba(0,0,0,0.05)` | 카드, 위젯 |
| `--shadow-md` | `none` | `0 4px 6px rgba(0,0,0,0.07)` | 드롭다운, 팝오버 |
| `--shadow-lg` | `none` | `0 10px 15px rgba(0,0,0,0.10)` | 모달, 토스트 |
| `--shadow-xl` | `none` | `0 20px 25px rgba(0,0,0,0.15)` | 플로팅 패널 |

다크 모드에서의 엘리베이션은 배경색 밝기 단계로 구분한다:
- Level 0: `--color-bg-primary` (#0B0E11) - 페이지 배경
- Level 1: `--color-bg-secondary` (#1E2329) - 위젯 배경
- Level 2: `--color-bg-tertiary` (#2B3139) - 내부 요소, 호버
- Level 3: `--color-bg-elevated` (#363C45) - 드롭다운, 팝오버

### 1.6 컴포넌트 토큰 테이블

핵심 UI 요소에 대한 디자인 토큰 매핑이다.

| 컴포넌트 | 배경 | 보더 | 텍스트 | 패딩 | 라디우스 |
|----------|------|------|--------|------|----------|
| 위젯 컨테이너 | `bg-secondary` | `border-primary` 1px | - | 0 (내부 요소가 개별 패딩) | `radius-md` |
| 위젯 헤더 | `bg-secondary` | 하단 `border-primary` 1px | `text-primary` (md) | `space-3` x `space-4` | 상단 `radius-md` |
| 버튼 (기본) | `bg-tertiary` | `border-primary` 1px | `text-primary` (base) | `space-2` x `space-3` | `radius-sm` |
| 버튼 (강조) | `color-neutral` | none | `text-inverse` (base, 600) | `space-2` x `space-4` | `radius-sm` |
| 입력 필드 | `bg-tertiary` | `border-primary` 1px | `text-primary` (base) | `space-2` x `space-3` | `radius-sm` |
| 드롭다운 | `bg-elevated` | `border-secondary` 1px | `text-primary` (base) | `space-2` x `space-3` | `radius-lg` |
| 토스트 알림 | `bg-elevated` | none | `text-primary` (sm) | `space-3` x `space-4` | `radius-md` |
| 상태 뱃지 | 상태별 bg | none | 상태별 color (xs) | `space-1` x `space-2` | `radius-full` |
| 태그/칩 | `bg-tertiary` | none | `text-secondary` (sm) | `space-1` x `space-2` | `radius-sm` |

---

## 2. 컴포넌트 구조 설계

### 2.1 Atomic Design 계층

Atomic Design 방법론을 기반으로 컴포넌트를 설계한다. 금융 대시보드의 특성상 Organisms 레벨에서 대부분의 복잡도가 집중된다.

```
┌─────────────────────────────────────────────────────────────┐
│                      Templates                              │
│  DashboardTemplate, AuthLayout                              │
├─────────────────────────────────────────────────────────────┤
│                      Organisms                              │
│  CandlestickChartWidget, OrderBookWidget,                   │
│  TradeHistoryWidget, WatchlistWidget,                       │
│  SymbolSelector, AppHeader, WidgetToolbar                   │
├─────────────────────────────────────────────────────────────┤
│                      Molecules                              │
│  WidgetContainer, WidgetHeader, SearchInput,                │
│  TimeframeSelector, DepthSelector, PriceDisplay,            │
│  ConnectionBadge, ProfileDropdown, ThemeToggle,             │
│  ToastItem, SkeletonWidget, ErrorFallback                   │
├─────────────────────────────────────────────────────────────┤
│                      Atoms                                  │
│  Button, IconButton, Input, Badge, Spinner,                 │
│  StatusDot, Tooltip, Divider, VisuallyHidden                │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 컴포넌트 계층 트리

```
App (Next.js App Router - layout.tsx)
├── ThemeProvider
│   └── AuthProvider (Supabase)
│       └── DashboardTemplate
│           ├── AppHeader
│           │   ├── Logo
│           │   ├── SymbolSelector
│           │   │   ├── SearchInput (atom)
│           │   │   └── SymbolDropdown (molecule)
│           │   │       └── SymbolItem[] (atom)
│           │   ├── ConnectionStatusIndicator
│           │   │   └── StatusDot (atom)
│           │   ├── ThemeToggle (molecule)
│           │   │   └── IconButton (atom)
│           │   ├── WidgetAddButton (molecule)
│           │   │   └── WidgetTypeDropdown
│           │   ├── LayoutResetButton (atom)
│           │   └── AuthButton / ProfileDropdown
│           │       ├── Avatar (atom)
│           │       └── DropdownMenu (molecule)
│           │
│           ├── DashboardShell (React Grid Layout)
│           │   ├── WidgetContainer[key="chart-1"]
│           │   │   ├── WidgetHeader
│           │   │   │   ├── WidgetTitle (atom)
│           │   │   │   ├── TimeframeSelector (molecule)
│           │   │   │   └── CloseButton (atom)
│           │   │   └── CandlestickChartWidget (organism)
│           │   │       └── <div ref> (Lightweight Charts mount point)
│           │   │
│           │   ├── WidgetContainer[key="orderbook-1"]
│           │   │   ├── WidgetHeader
│           │   │   │   ├── WidgetTitle
│           │   │   │   ├── DepthSelector (molecule)
│           │   │   │   └── CloseButton
│           │   │   └── OrderBookWidget (organism)
│           │   │       ├── <canvas ref> (Canvas 2D)
│           │   │       └── <div aria-live> (a11y 숨김 텍스트)
│           │   │
│           │   ├── WidgetContainer[key="trades-1"]
│           │   │   ├── WidgetHeader
│           │   │   │   ├── WidgetTitle
│           │   │   │   └── CloseButton
│           │   │   └── TradeHistoryWidget (organism)
│           │   │       ├── <canvas ref> (Canvas 2D)
│           │   │       └── <div aria-live> (a11y 숨김 텍스트)
│           │   │
│           │   └── WidgetContainer[key="watchlist-1"]
│           │       ├── WidgetHeader
│           │       │   ├── WidgetTitle
│           │       │   └── CloseButton
│           │       └── WatchlistWidget (organism)
│           │           ├── WatchlistSearchInput
│           │           └── WatchlistItem[] (molecule)
│           │
│           ├── OfflineBanner (조건부 렌더링)
│           └── ToastContainer
│               └── ToastItem[] (molecule)
```

### 2.3 핵심 컴포넌트 Props 인터페이스

#### 2.3.1 위젯 시스템 기반 타입

```typescript
// ===== 위젯 타입 정의 =====

/** 지원하는 위젯 종류 */
type WidgetType = 'candlestick-chart' | 'order-book' | 'trade-history' | 'watchlist';

/** 위젯 인스턴스의 고유 설정 */
interface WidgetConfig {
  id: string;                    // 고유 ID (예: "chart-1", "orderbook-2")
  type: WidgetType;
  symbol?: string;               // 위젯별 심볼 (없으면 글로벌 심볼 사용)
  settings?: Record<string, unknown>; // 위젯별 설정 (타임프레임, 깊이 등)
}

/** React Grid Layout의 레이아웃 아이템 */
interface LayoutItem {
  i: string;    // WidgetConfig.id와 매핑
  x: number;    // 그리드 X 위치 (0~11)
  y: number;    // 그리드 Y 위치
  w: number;    // 너비 (그리드 단위)
  h: number;    // 높이 (그리드 단위)
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

/** 직렬화 가능한 전체 대시보드 상태 */
interface DashboardLayout {
  version: number;               // 스키마 버전 (마이그레이션용)
  widgets: WidgetConfig[];
  layouts: {
    lg: LayoutItem[];
    md: LayoutItem[];
    sm: LayoutItem[];
    xs: LayoutItem[];
  };
  globalSymbol: string;          // 현재 글로벌 심볼
  updatedAt: string;             // ISO 8601
}
```

#### 2.3.2 DashboardShell

```typescript
interface DashboardShellProps {
  /** 초기 레이아웃 (localStorage 또는 Supabase에서 복원) */
  initialLayout: DashboardLayout | null;
  /** 레이아웃 변경 콜백 (debounce 적용 후 저장 레이어 호출) */
  onLayoutChange: (layout: DashboardLayout) => void;
}
```

#### 2.3.3 WidgetContainer

모든 위젯의 공통 래퍼. 헤더(타이틀, 컨트롤, 닫기), Error Boundary, ResizeObserver를 포함한다.

```typescript
interface WidgetContainerProps {
  /** 위젯 설정 */
  config: WidgetConfig;
  /** 위젯 제거 콜백 */
  onClose: (widgetId: string) => void;
  /** 위젯 설정 변경 콜백 */
  onSettingsChange: (widgetId: string, settings: Record<string, unknown>) => void;
  /** 자식 컴포넌트 (실제 위젯) */
  children: React.ReactNode;
}

interface WidgetHeaderProps {
  /** 위젯 타이틀 텍스트 */
  title: string;
  /** 심볼 표시 (선택적) */
  symbol?: string;
  /** 헤더 우측 커스텀 컨트롤 (TimeframeSelector, DepthSelector 등) */
  controls?: React.ReactNode;
  /** 닫기 버튼 콜백 */
  onClose: () => void;
  /** 드래그 핸들로 사용할 className */
  dragHandleClassName: string;
}
```

#### 2.3.4 CandlestickChartWidget

```typescript
interface CandlestickChartWidgetProps {
  /** 표시할 심볼 */
  symbol: string;
  /** 현재 타임프레임 */
  timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  /** 타임프레임 변경 콜백 */
  onTimeframeChange: (tf: string) => void;
  /** 컨테이너 크기 (ResizeObserver로 전달) */
  containerSize: { width: number; height: number };
}
```

#### 2.3.5 OrderBookWidget

```typescript
interface OrderBookWidgetProps {
  /** 표시할 심볼 */
  symbol: string;
  /** 표시 깊이 (행 수) */
  depth: 10 | 25 | 50;
  /** 깊이 변경 콜백 */
  onDepthChange: (depth: 10 | 25 | 50) => void;
  /** 컨테이너 크기 */
  containerSize: { width: number; height: number };
}
```

#### 2.3.6 TradeHistoryWidget

```typescript
interface TradeHistoryWidgetProps {
  /** 표시할 심볼 */
  symbol: string;
  /** 컨테이너 크기 */
  containerSize: { width: number; height: number };
}
```

#### 2.3.7 WatchlistWidget

```typescript
interface WatchlistWidgetProps {
  /** 관심 종목 목록 */
  watchlist: string[];                  // 심볼 배열 (예: ['BTCUSDT', 'ETHUSDT'])
  /** 현재 선택된 글로벌 심볼 */
  activeSymbol: string;
  /** 종목 클릭 콜백 */
  onSymbolSelect: (symbol: string) => void;
  /** 종목 추가 콜백 */
  onAddSymbol: (symbol: string) => void;
  /** 종목 제거 콜백 */
  onRemoveSymbol: (symbol: string) => void;
}

interface WatchlistItemProps {
  symbol: string;
  price: number;
  priceChange24h: number;              // 24시간 변동률 (%)
  isActive: boolean;                   // 현재 선택된 종목인지
  onClick: () => void;
  onRemove: () => void;
}
```

#### 2.3.8 SymbolSelector

```typescript
interface SymbolSelectorProps {
  /** 현재 선택된 심볼 */
  currentSymbol: string;
  /** 심볼 선택 콜백 */
  onSymbolChange: (symbol: string) => void;
}

interface SymbolSearchResult {
  symbol: string;                      // 예: 'BTCUSDT'
  baseAsset: string;                   // 예: 'BTC'
  quoteAsset: string;                  // 예: 'USDT'
  price?: number;
  change24h?: number;
}
```

#### 2.3.9 ConnectionStatusIndicator

```typescript
type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected' | 'failed';

interface ConnectionStatusIndicatorProps {
  /** 현재 연결 상태 */
  status: ConnectionStatus;
  /** 수동 재연결 콜백 (failed 상태에서 표시) */
  onReconnect?: () => void;
  /** 재연결 시도 횟수 (reconnecting 상태에서 표시) */
  retryCount?: number;
}
```

#### 2.3.10 ThemeToggle

```typescript
type ThemeMode = 'dark' | 'light';

interface ThemeToggleProps {
  /** 현재 테마 */
  theme: ThemeMode;
  /** 테마 변경 콜백 */
  onToggle: () => void;
}
```

#### 2.3.11 AuthButton / ProfileDropdown

```typescript
interface AuthButtonProps {
  /** 로그인 버튼 클릭 콜백 */
  onLogin: (provider: 'google' | 'github') => void;
}

interface ProfileDropdownProps {
  /** 사용자 정보 */
  user: {
    name: string;
    email: string;
    avatarUrl: string;
  };
  /** 로그아웃 콜백 */
  onLogout: () => void;
}
```

### 2.4 위젯 등록 시스템

위젯 타입과 컴포넌트 매핑을 중앙에서 관리한다. 새 위젯 타입 추가 시 이 레지스트리만 확장하면 된다.

```typescript
// src/widgets/registry.ts

import { ComponentType, lazy } from 'react';

interface WidgetRegistryEntry {
  /** 표시 이름 */
  displayName: string;
  /** 아이콘 식별자 */
  icon: string;
  /** 위젯 컴포넌트 (lazy import) */
  component: ComponentType<any>;
  /** 기본 그리드 크기 */
  defaultSize: { w: number; h: number };
  /** 최소 그리드 크기 */
  minSize: { w: number; h: number };
  /** 최대 그리드 크기 */
  maxSize: { w: number; h: number };
  /** 기본 설정값 */
  defaultSettings: Record<string, unknown>;
  /** 심볼이 필요한 위젯인지 */
  requiresSymbol: boolean;
}

const WIDGET_REGISTRY: Record<WidgetType, WidgetRegistryEntry> = {
  'candlestick-chart': {
    displayName: 'Candlestick Chart',
    icon: 'chart-candlestick',
    component: lazy(() => import('./CandlestickChartWidget')),
    defaultSize: { w: 8, h: 4 },
    minSize: { w: 4, h: 3 },
    maxSize: { w: 12, h: 8 },
    defaultSettings: { timeframe: '1m' },
    requiresSymbol: true,
  },
  'order-book': {
    displayName: 'Order Book',
    icon: 'book-open',
    component: lazy(() => import('./OrderBookWidget')),
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
    maxSize: { w: 6, h: 8 },
    defaultSettings: { depth: 25 },
    requiresSymbol: true,
  },
  'trade-history': {
    displayName: 'Trade History',
    icon: 'list',
    component: lazy(() => import('./TradeHistoryWidget')),
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
    maxSize: { w: 6, h: 8 },
    defaultSettings: {},
    requiresSymbol: true,
  },
  'watchlist': {
    displayName: 'Watchlist',
    icon: 'star',
    component: lazy(() => import('./WatchlistWidget')),
    defaultSize: { w: 3, h: 4 },
    minSize: { w: 2, h: 3 },
    maxSize: { w: 4, h: 8 },
    defaultSettings: {},
    requiresSymbol: false,
  },
};
```

---

## 3. 대시보드 그리드 설계

### 3.1 React Grid Layout 구성

```typescript
// src/components/DashboardShell.tsx

import { Responsive, WidthProvider } from 'react-grid-layout';

const ResponsiveGridLayout = WidthProvider(Responsive);

const GRID_CONFIG = {
  /** 12 컬럼 그리드 */
  cols: { lg: 12, md: 6, sm: 1, xs: 1 },

  /** 행 높이: 뷰포트 높이 기반 동적 계산 */
  // rowHeight = (viewportHeight - headerHeight - padding) / targetRows
  // 예: (900px - 56px - 48px) / 8 rows = ~99.5px
  rowHeight: 100,

  /** 위젯 간 여백 (px) */
  margin: [12, 12] as [number, number],

  /** 컨테이너 패딩 (px) */
  containerPadding: [16, 16] as [number, number],

  /** 브레이크포인트 (px) */
  breakpoints: { lg: 1200, md: 996, sm: 768, xs: 0 },

  /** 드래그 핸들 CSS 클래스 */
  draggableHandle: '.widget-drag-handle',

  /** 수직 컴팩팅 */
  compactType: 'vertical' as const,

  /** 리사이즈 핸들 위치 */
  resizeHandles: ['se'] as Array<'se'>,
};
```

### 3.2 기본 레이아웃 (BTC/USDT)

```
┌──────────────────────────────────────────────────────┐
│                     AppHeader (56px)                  │
│  Logo | SymbolSelector | Connection | Theme | Auth   │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌────────────────────────────┐ ┌──────────────────┐ │
│  │                            │ │   Order Book     │ │
│  │   Candlestick Chart        │ │                  │ │
│  │   (8 cols x 4 rows)        │ │  (4 cols x 4    │ │
│  │                            │ │   rows)          │ │
│  │                            │ │                  │ │
│  │                            │ │  asks (red)      │ │
│  │                            │ │  ─────────────   │ │
│  │                            │ │  spread          │ │
│  │                            │ │  ─────────────   │ │
│  │                            │ │  bids (green)    │ │
│  └────────────────────────────┘ └──────────────────┘ │
│                                                      │
│  ┌──────────────────────┐ ┌────────────────────────┐ │
│  │   Watchlist           │ │   Trade History        │ │
│  │   (3 cols x 4 rows)  │ │   (5 cols x 4 rows)   │ │
│  │                      │ │                        │ │
│  │   BTC  $67,234  +2%  │ │   12:03:01  67234  0.5 │ │
│  │   ETH  $3,456   -1%  │ │   12:03:00  67233  1.2 │ │
│  │   SOL  $134     +5%  │ │   12:02:59  67235  0.3 │ │
│  │   ...                │ │   ...                  │ │
│  └──────────────────────┘ └────────────────────────┘ │
│                                                      │
└──────────────────────────────────────────────────────┘
```

#### 3.2.1 기본 레이아웃 코드

```typescript
const DEFAULT_LAYOUT: DashboardLayout = {
  version: 1,
  globalSymbol: 'BTCUSDT',
  updatedAt: new Date().toISOString(),
  widgets: [
    { id: 'chart-1', type: 'candlestick-chart', settings: { timeframe: '1m' } },
    { id: 'orderbook-1', type: 'order-book', settings: { depth: 25 } },
    { id: 'watchlist-1', type: 'watchlist' },
    { id: 'trades-1', type: 'trade-history' },
  ],
  layouts: {
    lg: [
      { i: 'chart-1',     x: 0, y: 0, w: 8, h: 4, minW: 4, minH: 3 },
      { i: 'orderbook-1', x: 8, y: 0, w: 4, h: 4, minW: 3, minH: 3 },
      { i: 'watchlist-1', x: 0, y: 4, w: 3, h: 4, minW: 2, minH: 3 },
      { i: 'trades-1',    x: 3, y: 4, w: 5, h: 4, minW: 3, minH: 3 },
    ],
    md: [
      { i: 'chart-1',     x: 0, y: 0, w: 6, h: 4, minW: 4, minH: 3 },
      { i: 'orderbook-1', x: 0, y: 4, w: 3, h: 4, minW: 3, minH: 3 },
      { i: 'trades-1',    x: 3, y: 4, w: 3, h: 4, minW: 3, minH: 3 },
      { i: 'watchlist-1', x: 0, y: 8, w: 6, h: 3, minW: 2, minH: 3 },
    ],
    sm: [
      { i: 'chart-1',     x: 0, y: 0, w: 1, h: 4, minW: 1, minH: 3 },
      { i: 'orderbook-1', x: 0, y: 4, w: 1, h: 4, minW: 1, minH: 3 },
      { i: 'trades-1',    x: 0, y: 8, w: 1, h: 4, minW: 1, minH: 3 },
      { i: 'watchlist-1', x: 0, y: 12, w: 1, h: 3, minW: 1, minH: 3 },
    ],
    xs: [
      { i: 'chart-1',     x: 0, y: 0, w: 1, h: 3, minW: 1, minH: 2 },
      { i: 'orderbook-1', x: 0, y: 3, w: 1, h: 4, minW: 1, minH: 3 },
      { i: 'trades-1',    x: 0, y: 7, w: 1, h: 3, minW: 1, minH: 2 },
      { i: 'watchlist-1', x: 0, y: 10, w: 1, h: 3, minW: 1, minH: 2 },
    ],
  },
};
```

### 3.3 브레이크포인트별 레이아웃 전략

| 브레이크포인트 | 화면 너비 | 컬럼 수 | 전략 |
|---------------|-----------|---------|------|
| **lg** | >= 1200px | 12 | 사용자 자유 배치. 모든 위젯 동시 표시. 차트가 화면의 2/3를 차지하는 기본 레이아웃 |
| **md** | 996-1199px | 6 | 차트가 전체 너비를 차지. 오더북과 체결 내역이 2열로 배치. 관심 종목이 최하단 |
| **sm** | 768-995px | 1 | 단일 컬럼 세로 스택. 차트 > 오더북 > 체결 내역 > 관심 종목 순서 |
| **xs** | < 768px | 1 | 단일 컬럼. 위젯 높이 축소. 오더북 깊이 자동 10단계로 제한 |

### 3.4 위젯별 최소/최대 크기 제약

| 위젯 타입 | minW | minH | maxW | maxH | 설명 |
|-----------|------|------|------|------|------|
| candlestick-chart | 4 | 3 | 12 | 8 | 최소 4열 확보로 캔들 가독성 보장 |
| order-book | 3 | 3 | 6 | 8 | 3열 미만 시 가격/수량 텍스트 겹침 |
| trade-history | 3 | 3 | 6 | 8 | 3열 미만 시 컬럼 가독성 저하 |
| watchlist | 2 | 3 | 4 | 8 | 2열 미만 시 가격 표시 불가 |

### 3.5 레이아웃 직렬화 및 저장 흐름

```
사용자 위젯 드래그/리사이즈
         │
         ▼
onLayoutChange 콜백 발생
         │
         ▼
debounce(500ms) ──── 500ms 이내 추가 변경 시 타이머 리셋
         │
         ▼ (500ms 경과)
┌─────────────────────────┐
│ serializeLayout()       │
│ - WidgetConfig[] 추출    │
│ - LayoutItem[] 추출      │
│ - version, timestamp    │
│ - JSON.stringify()      │
└────────┬────────────────┘
         │
         ├─── 비로그인 ──▶ localStorage.setItem('dashboard-layout', json)
         │
         └─── 로그인 ──▶ supabase.from('layouts')
                          .upsert({ user_id, layout: json })
                          │
                          └─── 실패 시 ──▶ localStorage에 백업
                                          + 재연결 시 재시도 큐에 추가
```

#### 3.5.1 localStorage 키 구조

```typescript
const STORAGE_KEYS = {
  LAYOUT: 'crypto-dashboard:layout',
  WATCHLIST: 'crypto-dashboard:watchlist',
  THEME: 'crypto-dashboard:theme',
  SETTINGS: 'crypto-dashboard:settings',
} as const;
```

---

## 4. Canvas 렌더링 설계 (Order Book)

### 4.1 Canvas 좌표 시스템

```
┌────────────────────────────────────────────┐
│ (0,0)                          (width,0)   │
│                                            │
│  ┌── HEADER_HEIGHT (24px) ───────────────┐ │
│  │  Price    Qty    Total     [10|25|50]  │ │
│  └────────────────────────────────────────┘ │
│                                            │
│  ┌── ASKS SECTION ───────────────────────┐ │
│  │  ask[n-1]  (가장 높은 매도가)          │ │
│  │  ...                                  │ │
│  │  ask[0]    (가장 낮은 매도가)          │ │
│  └────────────────────────────────────────┘ │
│                                            │
│  ┌── SPREAD BAR (20px) ─────────────────┐  │
│  │  Spread: 0.01 (0.00001%)              │  │
│  └────────────────────────────────────────┘ │
│                                            │
│  ┌── BIDS SECTION ───────────────────────┐ │
│  │  bid[0]    (가장 높은 매수가)          │ │
│  │  ...                                  │ │
│  │  bid[n-1]  (가장 낮은 매수가)          │ │
│  └────────────────────────────────────────┘ │
│                                            │
│ (0,height)                  (width,height) │
└────────────────────────────────────────────┘
```

#### 4.1.1 레이아웃 상수

```typescript
const OB_LAYOUT = {
  HEADER_HEIGHT: 24,         // 컬럼 헤더 높이
  SPREAD_HEIGHT: 20,         // 스프레드 바 높이
  ROW_HEIGHT: 20,            // 각 호가 행 높이
  PADDING_X: 8,              // 좌우 여백
  PADDING_Y: 4,              // 상하 여백
  COL_PRICE_X: 0.05,         // 가격 컬럼 시작 (너비 대비 비율)
  COL_QTY_X: 0.45,           // 수량 컬럼 시작
  COL_TOTAL_X: 0.72,         // 누적 수량 컬럼 시작
  DEPTH_BAR_MAX_WIDTH: 0.95, // 깊이 바 최대 너비 (너비 대비 비율)
} as const;
```

### 4.2 렌더링 파이프라인

전체 렌더링은 `requestAnimationFrame` 루프 안에서 dirty flag를 확인한 후 수행된다.

```
┌──────────────────────────────────────────────────────┐
│                 rAF Loop (60fps)                     │
│                                                      │
│  if (!isDirty && !hasActiveAnimations) return;       │
│                                                      │
│  ┌─ Phase 1: Clear ─────────────────────────────┐    │
│  │  ctx.clearRect(0, 0, width, height)           │    │
│  └───────────────────────────────────────────────┘    │
│                        │                             │
│                        ▼                             │
│  ┌─ Phase 2: Background ────────────────────────┐    │
│  │  ctx.fillStyle = theme.bg                     │    │
│  │  ctx.fillRect(0, 0, width, height)            │    │
│  └───────────────────────────────────────────────┘    │
│                        │                             │
│                        ▼                             │
│  ┌─ Phase 3: Column Headers ────────────────────┐    │
│  │  drawText("Price", COL_PRICE_X, HEADER_Y)    │    │
│  │  drawText("Qty", COL_QTY_X, HEADER_Y)        │    │
│  │  drawText("Total", COL_TOTAL_X, HEADER_Y)    │    │
│  │  drawSeparator(HEADER_HEIGHT)                 │    │
│  └───────────────────────────────────────────────┘    │
│                        │                             │
│                        ▼                             │
│  ┌─ Phase 4: Asks (top section, reversed) ──────┐    │
│  │  for (i = depth-1; i >= 0; i--) {             │    │
│  │    y = HEADER_H + (depth-1-i) * ROW_H         │    │
│  │    drawDepthBar(asks[i], 'sell', y)            │    │
│  │    drawHighlight(asks[i], y)                   │    │
│  │    drawPriceText(asks[i].price, y, 'sell')     │    │
│  │    drawQtyText(asks[i].qty, y)                 │    │
│  │    drawTotalText(asks[i].total, y)             │    │
│  │  }                                            │    │
│  └───────────────────────────────────────────────┘    │
│                        │                             │
│                        ▼                             │
│  ┌─ Phase 5: Spread Bar ────────────────────────┐    │
│  │  spreadY = HEADER_H + depth * ROW_H           │    │
│  │  drawSpreadBackground(spreadY)                │    │
│  │  drawSpreadText(spread, spreadPct, spreadY)   │    │
│  └───────────────────────────────────────────────┘    │
│                        │                             │
│                        ▼                             │
│  ┌─ Phase 6: Bids (bottom section) ─────────────┐    │
│  │  for (i = 0; i < depth; i++) {                │    │
│  │    y = spreadY + SPREAD_H + i * ROW_H         │    │
│  │    drawDepthBar(bids[i], 'buy', y)             │    │
│  │    drawHighlight(bids[i], y)                   │    │
│  │    drawPriceText(bids[i].price, y, 'buy')      │    │
│  │    drawQtyText(bids[i].qty, y)                 │    │
│  │    drawTotalText(bids[i].total, y)             │    │
│  │  }                                            │    │
│  └───────────────────────────────────────────────┘    │
│                        │                             │
│                        ▼                             │
│  isDirty = false;                                    │
│  updateAnimations(deltaTime);                        │
│  if (hasActiveAnimations) requestAnimationFrame(loop)│
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 4.3 텍스트 렌더링 전략

Canvas 텍스트 렌더링의 핵심은 **사전 측정(pre-measure)** 과 **모노스페이스 정렬**이다.

```typescript
/**
 * 모노스페이스 폰트에서 단일 문자 폭을 사전 계산하여 캐싱한다.
 * 이 값으로 텍스트 우측 정렬, 소수점 정렬을 O(1)로 수행한다.
 */
class FontMetricsCache {
  private charWidth: number = 0;
  private charHeight: number = 0;
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D, font: string) {
    this.ctx = ctx;
    this.ctx.font = font;
    // 모노스페이스이므로 단일 문자 측정으로 충분
    const metrics = this.ctx.measureText('0');
    this.charWidth = metrics.width;
    this.charHeight =
      metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
  }

  /** 텍스트 우측 정렬 X 좌표 계산 */
  rightAlignX(text: string, rightEdge: number): number {
    return rightEdge - text.length * this.charWidth;
  }

  /** 소수점 정렬 X 좌표 계산 */
  decimalAlignX(text: string, decimalX: number): number {
    const dotIndex = text.indexOf('.');
    if (dotIndex === -1) return decimalX - text.length * this.charWidth;
    return decimalX - dotIndex * this.charWidth;
  }
}
```

#### 텍스트 렌더링 규칙

1. **가격**: 소수점 기준 우측 정렬. 매도가는 `--color-sell`, 매수가는 `--color-buy`.
2. **수량**: 우측 정렬. 색상은 `--color-text-primary`.
3. **누적 수량**: 우측 정렬. 색상은 `--color-text-secondary`.
4. **모든 숫자**: `ctx.textBaseline = 'middle'`로 행 중앙 정렬.

### 4.4 깊이 바 (Depth Bar) 시각화

각 호가 행의 배경에 해당 레벨의 수량을 전체 표시 범위 대비 비율로 바 차트를 그린다.

```typescript
function drawDepthBar(
  ctx: CanvasRenderingContext2D,
  side: 'buy' | 'sell',
  y: number,
  rowHeight: number,
  ratio: number,        // 0.0 ~ 1.0 (해당 레벨 누적수량 / 최대 누적수량)
  canvasWidth: number,
  theme: CanvasColorTheme,
) {
  const maxBarWidth = canvasWidth * OB_LAYOUT.DEPTH_BAR_MAX_WIDTH;
  const barWidth = maxBarWidth * ratio;

  ctx.fillStyle = side === 'buy' ? theme.buyBar : theme.sellBar;

  if (side === 'buy') {
    // 매수: 좌측에서 우측으로 성장
    ctx.fillRect(0, y, barWidth, rowHeight);
  } else {
    // 매도: 우측에서 좌측으로 성장
    ctx.fillRect(canvasWidth - barWidth, y, barWidth, rowHeight);
  }
}
```

### 4.5 하이라이트 애니메이션 시스템

가격 레벨의 수량이 변경되면 해당 행에 300ms 동안 alpha fade 하이라이트를 적용한다.

```typescript
interface PriceHighlight {
  price: number;
  side: 'buy' | 'sell';
  startTime: number;     // performance.now()
  duration: number;      // 300ms
}

/** 활성 하이라이트 목록 (배열, 매 프레임 순회) */
const activeHighlights: PriceHighlight[] = [];

function updateHighlights(currentTime: number): boolean {
  let hasActive = false;

  for (let i = activeHighlights.length - 1; i >= 0; i--) {
    const hl = activeHighlights[i];
    const elapsed = currentTime - hl.startTime;

    if (elapsed >= hl.duration) {
      // 만료된 하이라이트 제거 (순서 보장 불필요, swap & pop)
      activeHighlights[i] = activeHighlights[activeHighlights.length - 1];
      activeHighlights.pop();
    } else {
      hasActive = true;
    }
  }

  return hasActive;
}

function drawHighlight(
  ctx: CanvasRenderingContext2D,
  highlight: PriceHighlight,
  y: number,
  rowHeight: number,
  canvasWidth: number,
  currentTime: number,
  theme: CanvasColorTheme,
) {
  const elapsed = currentTime - highlight.startTime;
  const progress = elapsed / highlight.duration;         // 0.0 → 1.0
  const alpha = 0.35 * (1 - easeOutCubic(progress));    // 0.35 → 0.0

  const baseColor = highlight.side === 'buy' ? theme.buy : theme.sell;
  ctx.fillStyle = colorWithAlpha(baseColor, alpha);
  ctx.fillRect(0, y, canvasWidth, rowHeight);
}

/** easeOutCubic: 빠르게 시작하여 부드럽게 감속 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
```

### 4.6 devicePixelRatio 스케일링

Retina 디스플레이에서 선명한 렌더링을 보장하기 위해 Canvas의 물리적 해상도를 DPR 배수로 설정한다.

```typescript
function setupHighDPICanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): CanvasRenderingContext2D {
  const dpr = window.devicePixelRatio || 1;

  // CSS 크기 (논리적 크기)
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  // Canvas 버퍼 크기 (물리적 크기)
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);

  const ctx = canvas.getContext('2d')!;

  // 모든 드로잉 연산을 DPR 배수로 스케일
  ctx.scale(dpr, dpr);

  return ctx;
}
```

### 4.7 히트 감지 (Hover/Click)

Canvas 위 마우스 이벤트에서 어떤 호가 행 위에 있는지 판별한다.

```typescript
interface HitTestResult {
  type: 'ask' | 'bid' | 'spread' | 'header' | 'none';
  index: number;       // 호가 인덱스 (asks/bids 배열 내)
  price?: number;
}

function hitTestOrderBook(
  mouseY: number,
  depth: number,
  headerH: number,
  rowH: number,
  spreadH: number,
): HitTestResult {
  // 헤더 영역
  if (mouseY < headerH) {
    return { type: 'header', index: -1 };
  }

  const asksStart = headerH;
  const asksEnd = asksStart + depth * rowH;

  // Asks 영역
  if (mouseY >= asksStart && mouseY < asksEnd) {
    const index = Math.floor((mouseY - asksStart) / rowH);
    return { type: 'ask', index: depth - 1 - index };
  }

  const spreadEnd = asksEnd + spreadH;

  // Spread 영역
  if (mouseY >= asksEnd && mouseY < spreadEnd) {
    return { type: 'spread', index: -1 };
  }

  const bidsStart = spreadEnd;

  // Bids 영역
  const bidIndex = Math.floor((mouseY - bidsStart) / rowH);
  if (bidIndex >= 0 && bidIndex < depth) {
    return { type: 'bid', index: bidIndex };
  }

  return { type: 'none', index: -1 };
}
```

---

## 5. Canvas 렌더링 설계 (Trade Feed)

### 5.1 전체 구조

체결 내역은 **스크롤링 리스트**를 Canvas 위에 직접 렌더링한다. React DOM 리스트와 달리 200개 행을 매 프레임 전부 그리지 않고, **뷰포트에 보이는 행만** 그린다.

```
┌────────────────────────────────────────────┐
│  ┌── HEADER (24px) ───────────────────────┐ │
│  │  Time       Price    Qty    Side       │ │
│  └────────────────────────────────────────┘ │
│                                            │
│  ┌── VISIBLE ROWS ────────────────────────┐ │
│  │  12:03:45   67,234.50   0.052   BUY    │ │  ← 새 체결 (slide-in)
│  │  12:03:44   67,233.80   1.200   SELL   │ │
│  │  12:03:44   67,234.10   0.310   BUY    │ │
│  │  12:03:43   67,232.00   0.780   SELL   │ │
│  │  ...                                   │ │
│  │  (뷰포트에 보이는 행만 렌더링)          │ │
│  └────────────────────────────────────────┘ │
│                                            │
│  ┌── SCROLL INDICATOR (선택적) ───────────┐ │
│  │  ▌ (현재 스크롤 위치 표시)              │ │
│  └────────────────────────────────────────┘ │
└────────────────────────────────────────────┘
```

### 5.2 링 버퍼와 시각 매핑

PRD에서 정의한 `Float64Array` 기반 링 버퍼의 데이터를 Canvas 행에 매핑한다.

```typescript
/**
 * Ring Buffer 구조:
 * - capacity: 200 (최대 체결 건수)
 * - fieldsPerEntry: 4 (timestamp, price, quantity, isBuyerMaker)
 * - buffer: Float64Array(200 * 4 = 800)
 * - head: 가장 최근 항목의 인덱스
 * - count: 현재 저장된 항목 수
 */

const TRADE_FIELDS = 4;
const TRADE_CAPACITY = 200;

interface TradeRingBuffer {
  buffer: Float64Array;
  head: number;     // 가장 최근 항목이 기록된 슬롯
  count: number;    // 현재 저장된 항목 수 (0 ~ TRADE_CAPACITY)
}

/** 링 버퍼에서 i번째(최신=0) 항목 읽기 */
function getTradeAt(rb: TradeRingBuffer, i: number): TradeEntry | null {
  if (i >= rb.count) return null;

  const slotIndex =
    ((rb.head - i + TRADE_CAPACITY) % TRADE_CAPACITY) * TRADE_FIELDS;

  return {
    timestamp: rb.buffer[slotIndex],
    price: rb.buffer[slotIndex + 1],
    quantity: rb.buffer[slotIndex + 2],
    isBuyerMaker: rb.buffer[slotIndex + 3] === 1,
  };
}

interface TradeEntry {
  timestamp: number;
  price: number;
  quantity: number;
  isBuyerMaker: boolean;
}
```

### 5.3 행 레이아웃

```typescript
const TF_LAYOUT = {
  HEADER_HEIGHT: 24,
  ROW_HEIGHT: 20,
  PADDING_X: 8,
  COL_TIME_X: 0.02,     // 시간 컬럼 시작 (너비 대비 비율)
  COL_PRICE_X: 0.25,    // 가격 컬럼 시작
  COL_QTY_X: 0.58,      // 수량 컬럼 시작
  COL_SIDE_X: 0.85,     // 매수/매도 인디케이터 시작
} as const;
```

### 5.4 렌더링 파이프라인

```
┌──────────────────────────────────────────────────────┐
│                 rAF Loop (60fps)                     │
│                                                      │
│  if (!isDirty && !hasSlideAnimation) return;         │
│                                                      │
│  ┌─ Phase 1: Clear + Background ────────────────┐    │
│  │  ctx.clearRect(0, 0, width, height)           │    │
│  │  ctx.fillStyle = theme.bg                     │    │
│  │  ctx.fillRect(0, 0, width, height)            │    │
│  └───────────────────────────────────────────────┘    │
│                        │                             │
│                        ▼                             │
│  ┌─ Phase 2: Column Headers ────────────────────┐    │
│  │  drawText("Time", COL_TIME_X)                 │    │
│  │  drawText("Price", COL_PRICE_X)               │    │
│  │  drawText("Qty", COL_QTY_X)                   │    │
│  │  drawSeparator()                              │    │
│  └───────────────────────────────────────────────┘    │
│                        │                             │
│                        ▼                             │
│  ┌─ Phase 3: Visible Rows ──────────────────────┐    │
│  │  visibleCount = floor((height - HEADER) / ROW)│    │
│  │                                               │    │
│  │  for (i = 0; i < visibleCount; i++) {         │    │
│  │    trade = getTradeAt(ringBuffer, i)           │    │
│  │    if (!trade) break;                         │    │
│  │                                               │    │
│  │    y = HEADER + i * ROW + slideOffset(i)      │    │
│  │    color = trade.isBuyerMaker                 │    │
│  │      ? theme.sell : theme.buy                 │    │
│  │                                               │    │
│  │    drawTime(trade.timestamp, y)               │    │
│  │    drawPrice(trade.price, y, color)           │    │
│  │    drawQty(trade.quantity, y)                  │    │
│  │    drawSideIndicator(y, color)                │    │
│  │  }                                            │    │
│  └───────────────────────────────────────────────┘    │
│                        │                             │
│                        ▼                             │
│  isDirty = false;                                    │
│  updateSlideAnimation(deltaTime);                    │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 5.5 새 체결 진입 애니메이션

새 체결이 발생하면 최상단에 "slide-in from top" 애니메이션을 적용한다.

```typescript
interface SlideAnimation {
  active: boolean;
  startTime: number;
  duration: number;      // 150ms
}

function calculateSlideOffset(
  anim: SlideAnimation,
  currentTime: number,
  rowHeight: number,
): number {
  if (!anim.active) return 0;

  const elapsed = currentTime - anim.startTime;
  const progress = Math.min(elapsed / anim.duration, 1);
  const easedProgress = easeOutCubic(progress);

  // 모든 기존 행이 rowHeight만큼 아래로 밀림
  // progress 0 → offset = rowHeight (위에서 내려오는 중)
  // progress 1 → offset = 0 (최종 위치)
  return rowHeight * (1 - easedProgress);
}
```

### 5.6 색상 코딩

```
매수 체결 (taker가 매수 = maker가 매도 = isBuyerMaker === false)
  → 가격 텍스트: #00C087 (green)
  → 사이드 인디케이터: 좌측 2px 녹색 바

매도 체결 (taker가 매도 = maker가 매수 = isBuyerMaker === true)
  → 가격 텍스트: #F6465D (red)
  → 사이드 인디케이터: 좌측 2px 적색 바
```

> **주의**: Binance API에서 `m` (isBuyerMaker) 필드가 `true`이면 매도 체결(시장가 매도), `false`이면 매수 체결(시장가 매수)이다. 이는 "maker가 buy side였다 = taker가 sell"을 의미하므로 색상 매핑에 주의해야 한다.

---

## 6. 상태 업데이트 방어 전략

### 6.1 전체 데이터 흐름 개요

```
WebSocket 메시지 수신                    사용자 인터랙션
       │                                      │
       ▼                                      ▼
┌──────────────┐                    ┌──────────────────┐
│ JSON.parse() │                    │ React 이벤트 핸들러│
│ 메시지 라우팅  │                    │                  │
└──────┬───────┘                    └────────┬─────────┘
       │                                      │
       ▼                                      ▼
┌──────────────────────────────────────────────────────┐
│                  Zustand Store                        │
│                                                      │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌────────┐ │
│  │DepthStore│  │TradeStore│  │KlineStore│ │UIStore │ │
│  │(transient)│  │(transient)│  │(standard)│ │(standard)│
│  └────┬─────┘  └────┬─────┘  └────┬─────┘ └───┬────┘ │
│       │              │              │            │     │
└───────┼──────────────┼──────────────┼────────────┼─────┘
        │              │              │            │
   ┌────▼────┐   ┌────▼────┐   ┌────▼────┐  ┌───▼───┐
   │ Canvas  │   │ Canvas  │   │ LW Charts│  │ React │
   │ rAF loop│   │ rAF loop│   │ update() │  │re-render│
   │(OrderBook)│  │(TradeFeed)│  │         │  │       │
   └─────────┘   └─────────┘   └─────────┘  └───────┘
```

### 6.2 Throttling 전략

| 대상 | 전략 | 이유 |
|------|------|------|
| WebSocket 메시지 → Zustand 상태 | **즉시 반영 (throttle 없음)** | 데이터 레이어는 항상 최신 상태를 유지해야 한다. 지연시키면 오더북 시퀀스 관리가 복잡해진다 |
| Zustand 상태 → Canvas 렌더링 | **requestAnimationFrame (자연스러운 60fps throttle)** | 16.67ms 프레임 예산 내에서 한 번만 그린다. 여러 번의 상태 변경이 자동 배치된다 |
| 레이아웃 저장 | **debounce 500ms** | 드래그/리사이즈 중 매 프레임 저장하면 성능 저하. 사용자 조작 완료 후 저장 |
| 관심 종목 저장 | **debounce 300ms** | 빠른 연속 추가/삭제 시 불필요한 저장 방지 |

### 6.3 Debouncing 전략

```typescript
// src/utils/debounce.ts

function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number,
): T & { cancel: () => void; flush: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  const debounced = ((...args: Parameters<T>) => {
    lastArgs = args;
    if (timeoutId !== null) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      timeoutId = null;
      fn(...args);
      lastArgs = null;
    }, delay);
  }) as T & { cancel: () => void; flush: () => void };

  debounced.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  debounced.flush = () => {
    if (timeoutId !== null && lastArgs !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
      fn(...lastArgs);
      lastArgs = null;
    }
  };

  return debounced;
}
```

| 적용 대상 | 딜레이 | 트리거 |
|-----------|--------|--------|
| 심볼 검색 입력 | 300ms | `onInput` 이벤트 |
| Window resize → Canvas resize | 200ms | `ResizeObserver` 콜백 |
| Layout 변경 → Supabase 저장 | 500ms | `onLayoutChange` 콜백 |
| Watchlist 변경 → 저장 | 300ms | 종목 추가/제거 |

### 6.4 Batching 전략

#### 6.4.1 Zustand Transient Updates (Canvas 데이터용)

오더북과 체결 내역은 초당 수십 건이 업데이트되므로, React 리렌더를 트리거하지 않는 **transient update** 패턴을 사용한다.

```typescript
// src/stores/depthStore.ts

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface DepthState {
  // React 리렌더를 트리거하는 상태 (거의 변하지 않는 메타 정보)
  symbol: string;
  isLoading: boolean;
  error: string | null;

  // Transient 데이터 (Canvas에서 직접 참조, React 구독 안 함)
  // Zustand store 외부 ref로 관리
}

/**
 * Canvas 렌더러가 직접 참조하는 transient 데이터.
 * Zustand store에 넣지 않아 상태 변경 시 React 리렌더가 발생하지 않는다.
 */
interface DepthTransientData {
  asks: Float64Array;     // [price, qty, total, price, qty, total, ...]
  bids: Float64Array;     // 동일 구조
  askCount: number;
  bidCount: number;
  isDirty: boolean;
  lastUpdateId: number;
}

// 모듈 레벨 싱글턴 (Zustand 외부)
export const depthData: DepthTransientData = {
  asks: new Float64Array(50 * 3),  // 최대 50레벨 x 3필드
  bids: new Float64Array(50 * 3),
  askCount: 0,
  bidCount: 0,
  isDirty: false,
  lastUpdateId: 0,
};
```

#### 6.4.2 rAF 내 자동 배치

```
시간축 (16.67ms = 1 프레임)
─────────────────────────────────────────────────────────▶

  WS msg 1    WS msg 2    WS msg 3           rAF 콜백
     │           │           │                    │
     ▼           ▼           ▼                    ▼
  depthData  depthData  depthData          if (isDirty) {
  업데이트    업데이트    업데이트             drawOrderBook()
  isDirty=T  isDirty=T  isDirty=T            isDirty = false
                                            }

  → 3번의 데이터 업데이트가 1번의 Canvas redraw로 통합됨
```

### 6.5 Dirty Flag 패턴

Canvas 렌더러는 매 rAF 콜백에서 `isDirty` 플래그를 확인하고, 변경이 없으면 드로잉을 완전히 스킵한다.

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   WebSocket 메시지 핸들러                                │
│   ┌─────────────────────┐                               │
│   │ depthData.asks = .. │                               │
│   │ depthData.isDirty   │──── true ────┐                │
│   │           = true    │              │                │
│   └─────────────────────┘              │                │
│                                        ▼                │
│   rAF Loop                    ┌──────────────────┐      │
│   ┌────────────────────┐      │                  │      │
│   │ if (isDirty) {     │◀─────│  isDirty = true  │      │
│   │   drawOrderBook()  │      │                  │      │
│   │   isDirty = false  │──┐   └──────────────────┘      │
│   │ } else {           │  │                             │
│   │   // SKIP (0 cost) │  │   ┌──────────────────┐      │
│   │ }                  │  └──▶│  isDirty = false │      │
│   └────────────────────┘      └──────────────────┘      │
│                                                         │
│   [데이터 미수신 구간에서는 rAF 콜백 비용 ≈ 0]           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 6.6 Page Visibility 최적화

```typescript
// src/hooks/usePageVisibility.ts

function usePageVisibility(
  onVisible: () => void,
  onHidden: () => void,
) {
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // 탭 비활성: Canvas 렌더링 루프 중단, 데이터 수신은 계속
        onHidden();
      } else {
        // 탭 활성: 오더북 스냅샷 재요청 + 렌더링 재개
        onVisible();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [onVisible, onHidden]);
}
```

---

## 7. 인터랙션 설계

### 7.1 위젯 드래그

```
┌─────────── WidgetContainer ──────────────┐
│ ┌─── drag handle (.widget-drag-handle) ──┐│
│ │  ☰ Order Book - BTCUSDT         [✕]   ││  ← 커서: grab
│ └─────────────────────────────────────────┘│
│                                           │
│   (위젯 콘텐츠 영역은 드래그 불가)          │
│                                           │
└───────────────────────────────────────────┘

[드래그 시작]
  1. mousedown on .widget-drag-handle
  2. 커서 → grabbing
  3. 위젯에 opacity: 0.7 + transform: scale(1.02) 적용
  4. 드래그 고스트 표시 (React Grid Layout 내장)
  5. 다른 위젯들이 자동으로 자리를 비켜줌

[드래그 중]
  6. 드롭 가능 영역에 파란색 가이드라인 표시
  7. Canvas 위젯의 렌더링은 계속 유지 (중단 없음)

[드롭]
  8. 위젯이 그리드에 스냅
  9. opacity + scale 복원 (transition: 200ms ease)
  10. onLayoutChange 트리거 → debounce → 저장
```

### 7.2 위젯 리사이즈

```
┌───────────────────────────────────────────┐
│                                           │
│                                           │
│          Widget Content                   │
│                                           │
│                                           │
│                                         ╱ │  ← 리사이즈 핸들 (우측 하단)
└───────────────────────────────────────╱───┘
                                    ↕ ↔

[리사이즈 핸들]
  - 위치: 우측 하단 모서리
  - 크기: 16x16px 터치 타겟
  - 커서: se-resize
  - 시각적: 대각선 그립 라인 (3줄)

[리사이즈 중]
  1. ResizeObserver가 새 크기를 감지
  2. debounce(200ms) 후 Canvas/Chart resize 트리거
  3. 최소 크기 제약 적용 (위젯 레지스트리 참조)
  4. 그리드 스냅 적용

[리사이즈 완료]
  5. Canvas/Chart에 최종 크기 전달
  6. devicePixelRatio 반영하여 Canvas 버퍼 재생성
  7. 전체 redraw
  8. onLayoutChange → debounce → 저장
```

### 7.3 심볼 검색

```
┌─────────────────────────────────────┐
│  🔍  BTC                            │  ← 입력 필드 (debounce 300ms)
├─────────────────────────────────────┤
│  ▸ BTCUSDT    $67,234.50    +2.3%   │  ← 키보드 ↑↓로 탐색
│    BTCBUSD    $67,230.00    +2.2%   │     Enter로 선택
│    BTCEUR     EUR 62,100    +2.1%   │     ESC로 닫기
│                                     │
│    검색 결과 없음 시: "No results"   │
└─────────────────────────────────────┘

[인터랙션 흐름]
  1. 입력 필드 포커스 → 드롭다운 열림
  2. 타이핑 → debounce(300ms) → 필터링
  3. 키보드 ↑/↓ → 하이라이트 이동 (aria-activedescendant)
  4. Enter → 심볼 선택 → 드롭다운 닫힘
  5. ESC → 드롭다운 닫힘
  6. 외부 클릭 → 드롭다운 닫힘
  7. 심볼 선택 시:
     - 글로벌 심볼 변경
     - 모든 심볼 의존 위젯에 전파
     - WebSocket 스트림 재구독
     - URL 쿼리 파라미터 업데이트
```

### 7.4 테마 토글

```
[Dark Mode]                    [Light Mode]
  ┌──┐                           ┌──┐
  │🌙│ ──── click ──────────▶   │☀️ │
  └──┘                           └──┘

[FOUC 방지 전략]
  1. <head> 내 인라인 스크립트가 localStorage에서 테마를 읽음
  2. document.documentElement.dataset.theme을 CSS paint 전에 설정
  3. CSS는 [data-theme="dark"] / [data-theme="light"] 선택자로 분기
  4. Canvas 테마 객체도 동시에 교체 → 다음 rAF에서 반영
  5. Lightweight Charts는 chart.applyOptions({ layout: { ... } })로 즉시 적용
  6. transition: background-color 200ms ease 적용 (부드러운 전환)
```

### 7.5 차트 인터랙션

```
[줌 (Mouse Wheel)]
  - Scroll Up   → 확대 (더 적은 캔들, 더 상세한 뷰)
  - Scroll Down → 축소 (더 많은 캔들, 넓은 뷰)
  - Lightweight Charts 내장 기능 활용

[패닝 (Drag)]
  - 차트 영역 드래그 → 좌우 스크롤 (과거/미래)
  - 마우스 커서: default → grabbing

[크로스헤어 (Hover)]
  - 마우스 이동 → 수직/수평 십자선 표시
  - 십자선 위치의 OHLCV 데이터 상단에 표시
  - 가격축에 현재 가격 레이블 표시
  - 시간축에 현재 시간 레이블 표시
```

---

## 8. 반응형 설계

### 8.1 브레이크포인트 전략 테이블

| 구분 | xs (< 768px) | sm (768-995px) | md (996-1199px) | lg (>= 1200px) |
|------|-------------|----------------|-----------------|----------------|
| 그리드 컬럼 | 1 | 1 | 6 | 12 |
| 위젯 배치 | 세로 스택 | 세로 스택 | 2열 배치 | 자유 배치 |
| 차트 높이 | 250px 고정 | 300px 고정 | 그리드 비례 | 그리드 비례 |
| 오더북 깊이 | 10 (자동 축소) | 25 | 25 | 사용자 설정 |
| 드래그 이동 | 비활성 | 비활성 | 활성 | 활성 |
| 리사이즈 | 비활성 | 비활성 | 활성 | 활성 |
| 위젯 순서 | 차트 > OB > Trade > WL | 차트 > OB > Trade > WL | 사용자 정의 | 사용자 정의 |
| AppHeader | 간소화 (햄버거) | 간소화 | 전체 표시 | 전체 표시 |

### 8.2 위젯 행동 변화 (breakpoint별)

#### 8.2.1 CandlestickChartWidget

- **xs/sm**: 타임프레임 선택기를 스크롤 가능한 가로 탭으로 변경. 차트 높이 축소. 줌은 핀치 제스처로 대체.
- **md/lg**: 전체 타임프레임 버튼 표시. 마우스 휠 줌.

#### 8.2.2 OrderBookWidget

- **xs**: 깊이를 10단계로 강제. 누적 수량 컬럼 숨김. 폰트 크기 10px.
- **sm**: 깊이 25단계. 전체 컬럼 표시.
- **md/lg**: 사용자 설정 깊이. 전체 기능.

#### 8.2.3 TradeHistoryWidget

- **xs**: 시간 컬럼을 "HH:mm" 포맷으로 축약. 수량 소수점 축소.
- **sm**: 전체 컬럼 표시.
- **md/lg**: 전체 기능.

#### 8.2.4 WatchlistWidget

- **xs**: 심볼과 가격만 표시. 변동률은 아이콘(화살표)으로 축약.
- **sm/md/lg**: 전체 정보 표시.

### 8.3 Canvas 리사이즈 처리

```typescript
// src/hooks/useCanvasResize.ts

function useCanvasResize(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  onResize: (width: number, height: number) => void,
) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver(
      // debounce(200ms) 적용
      debounce((entries: ResizeObserverEntry[]) => {
        const entry = entries[0];
        if (!entry) return;

        const { width, height } = entry.contentRect;

        // devicePixelRatio 반영
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const ctx = canvas.getContext('2d')!;
        ctx.scale(dpr, dpr);

        onResize(width, height);
      }, 200),
    );

    observer.observe(canvas.parentElement!);

    return () => observer.disconnect();
  }, [canvasRef, onResize]);
}
```

### 8.4 터치 인터랙션 (모바일)

| 제스처 | 대상 | 동작 |
|--------|------|------|
| 탭 (Tap) | 관심 종목 행 | 심볼 선택 |
| 길게 누르기 (Long Press) | 관심 종목 행 | 삭제 확인 팝업 |
| 핀치 (Pinch) | 차트 영역 | 줌 인/아웃 |
| 수평 스와이프 | 차트 영역 | 패닝 |
| 수직 스크롤 | 전체 대시보드 | 위젯 간 스크롤 (sm/xs 모드) |

---

## 9. 접근성 (a11y) 설계

### 9.1 Canvas 위젯 접근성

Canvas는 시각적 렌더링만 수행하므로, 스크린 리더를 위한 숨김 DOM 텍스트를 제공한다.

```typescript
// OrderBookWidget 내부

<div className="orderbook-widget">
  {/* 시각적 Canvas */}
  <canvas
    ref={canvasRef}
    role="img"
    aria-label={`${symbol} 오더북. 최우선 매수호가 ${bestBid}, 최우선 매도호가 ${bestAsk}, 스프레드 ${spread}`}
  />

  {/* 스크린 리더 전용 숨김 텍스트 */}
  <div
    aria-live="polite"
    aria-atomic="true"
    className="visually-hidden"
  >
    {`현재 ${symbol} 오더북: 최우선 매수호가 ${bestBid}, 최우선 매도호가 ${bestAsk}`}
  </div>
</div>
```

```css
/* 시각적으로 숨기되 스크린 리더에서 접근 가능 */
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

> **업데이트 빈도 제어**: `aria-live` 영역은 1초에 수십 번 업데이트되면 스크린 리더가 과부하된다. 가격 업데이트는 **5초마다 1회**로 쓰로틀링하여 aria-live 텍스트를 갱신한다.

### 9.2 포커스 관리

```css
/* 기본 포커스 링 */
:focus-visible {
  outline: 2px solid var(--color-border-focus);   /* #F0B90B */
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

/* 포커스 링 애니메이션 (접근성 사용자가 현재 위치 파악 용이) */
@media (prefers-reduced-motion: no-preference) {
  :focus-visible {
    transition: outline-offset 100ms ease;
  }
}
```

#### 탭 순서 (Tab Order)

```
1. Logo (Skip to content 링크)
2. SymbolSelector (검색 입력)
3. ConnectionStatusIndicator
4. ThemeToggle
5. WidgetAddButton
6. LayoutResetButton
7. AuthButton / ProfileDropdown
8. Widget 1 → Widget Header Controls → Widget Content (탭 가능 요소)
9. Widget 2 → ...
10. Widget N → ...
```

### 9.3 색상 대비 (WCAG 2.1 AA)

| 조합 | 전경 | 배경 | 대비율 | AA 충족 |
|------|------|------|--------|---------|
| 주요 텍스트 (다크) | #EAECEF | #1E2329 | 11.4:1 | 통과 |
| 보조 텍스트 (다크) | #848E9C | #1E2329 | 4.9:1 | 통과 (AA) |
| 매수 색상 (다크) | #00C087 | #1E2329 | 6.8:1 | 통과 |
| 매도 색상 (다크) | #F6465D | #1E2329 | 4.6:1 | 통과 (AA) |
| 주요 텍스트 (라이트) | #1E2329 | #FFFFFF | 15.4:1 | 통과 |
| 보조 텍스트 (라이트) | #707A8A | #FFFFFF | 5.0:1 | 통과 (AA) |
| 매수 색상 (라이트) | #00C087 | #FFFFFF | 2.9:1 | **미달** → 텍스트 레이블 보조 |
| 매도 색상 (라이트) | #F6465D | #FFFFFF | 3.7:1 | **미달** → 텍스트 레이블 보조 |

> **라이트 모드 매수/매도 대비 보완**: 라이트 모드에서 녹색/빨간색 텍스트만으로는 AA 대비를 충족하지 못한다. 반드시 **화살표 아이콘**(상승/하락) 또는 **"+"/"-" 텍스트 접두사**를 함께 표시하여 색상에 의존하지 않는 정보 전달을 보장한다.

### 9.4 키보드 내비게이션 패턴

| 요소 | 키 | 동작 |
|------|-----|------|
| SymbolSelector | Enter/Space | 드롭다운 열기 |
| SymbolSelector 드롭다운 | Arrow Up/Down | 항목 탐색 |
| SymbolSelector 드롭다운 | Enter | 항목 선택 |
| SymbolSelector 드롭다운 | Escape | 드롭다운 닫기 |
| ThemeToggle | Enter/Space | 테마 전환 |
| WidgetContainer 닫기 | Enter/Space | 위젯 닫기 |
| TimeframeSelector | Arrow Left/Right | 타임프레임 전환 |
| DepthSelector | Arrow Up/Down | 깊이 변경 |
| WatchlistItem | Enter | 심볼 선택 |
| WatchlistItem | Delete | 종목 제거 |

### 9.5 Reduced Motion 대응

```css
@media (prefers-reduced-motion: reduce) {
  /* 모든 CSS 애니메이션/트랜지션 비활성화 */
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

```typescript
// Canvas 애니메이션도 reduced motion 반영
const prefersReducedMotion =
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const ANIMATION_CONFIG = {
  highlightDuration: prefersReducedMotion ? 0 : 300,    // ms
  slideInDuration: prefersReducedMotion ? 0 : 150,      // ms
  fadeTransition: prefersReducedMotion ? 0 : 200,        // ms
};
```

---

## 10. 에러 상태 UI 설계

### 10.1 위젯 에러 상태 (Error Boundary)

각 위젯은 독립적인 Error Boundary로 감싸져, 하나의 위젯 오류가 다른 위젯에 영향을 주지 않는다.

```
┌─────── Error State Widget ──────────┐
│ ┌── Header ──────────────────────┐  │
│ │  ⚠ Order Book - BTCUSDT  [✕]  │  │  ← 헤더는 정상 유지
│ └────────────────────────────────┘  │
│                                     │
│         ┌──────────────┐            │
│         │     ⚠️       │            │
│         │              │            │
│         │  문제가       │            │
│         │  발생했습니다  │            │
│         │              │            │
│         │ [다시 시도]   │            │  ← 전체 위젯 재초기화
│         │              │            │
│         │  오류 상세 ▾  │            │  ← 접기/펼치기 (개발자용)
│         └──────────────┘            │
│                                     │
└─────────────────────────────────────┘
```

```typescript
interface WidgetErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
  widgetType: WidgetType;
  widgetId: string;
}

function WidgetErrorFallback({
  error,
  resetErrorBoundary,
  widgetType,
  widgetId,
}: WidgetErrorFallbackProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="widget-error-fallback" role="alert">
      <div className="error-icon">⚠</div>
      <p className="error-message">문제가 발생했습니다</p>
      <button
        className="retry-button"
        onClick={resetErrorBoundary}
        aria-label="위젯 다시 시도"
      >
        다시 시도
      </button>
      <button
        className="details-toggle"
        onClick={() => setShowDetails(!showDetails)}
        aria-expanded={showDetails}
      >
        {showDetails ? '오류 상세 ▴' : '오류 상세 ▾'}
      </button>
      {showDetails && (
        <pre className="error-details">{error.message}</pre>
      )}
    </div>
  );
}
```

### 10.2 연결 상태 인디케이터 디자인

```
[Connected]       [Reconnecting]       [Disconnected]        [Failed]
 ● 연결됨          ◍ 재연결 중...       ○ 연결 끊김            ✕ 연결 실패
 (녹색, 정적)      (노란색, 펄스)       (빨간색, 정적)        (빨간색, 정적)
                                                              [재연결] 버튼

스타일 상세:
─────────────────────────────────────────────────────────────────────

● Connected (연결됨)
  - 색상: #00C087 (--color-success)
  - 크기: 8px 원형
  - 애니메이션: 없음
  - 텍스트: "연결됨" (text-secondary, text-xs)

◍ Reconnecting (재연결 중)
  - 색상: #F0B90B (--color-warning)
  - 크기: 8px 원형
  - 애니메이션: pulse (opacity 0.4 → 1.0, 1.5초 주기)
  - 텍스트: "재연결 중... (시도 N/10)" (text-secondary, text-xs)

○ Disconnected (연결 끊김)
  - 색상: #F6465D (--color-error)
  - 크기: 8px 원형
  - 애니메이션: 없음
  - 텍스트: "연결 끊김" (text-secondary, text-xs)

✕ Failed (연결 실패)
  - 색상: #F6465D (--color-error)
  - 크기: 8px 사각형 내 X 아이콘
  - 텍스트: "연결 실패" (text-error, text-xs)
  - 추가 UI: [재연결] 버튼 (클릭 시 재시도 카운터 리셋 후 재연결)
```

### 10.3 오프라인 배너

```
전체 대시보드 상단에 고정 표시:

┌──────────────────────────────────────────────────────────────┐
│  ⚠  인터넷 연결이 끊어졌습니다. 마지막 수신 데이터를 표시 중입니다.  │
└──────────────────────────────────────────────────────────────┘

스타일:
  - 배경: --color-warning (#F0B90B) opacity 0.15
  - 보더: 하단 1px solid --color-warning
  - 텍스트: --color-warning
  - 높이: 36px
  - 위치: AppHeader 바로 아래, 위젯 영역 위
  - 진입 애니메이션: slideDown 200ms ease
  - 퇴장 애니메이션: slideUp 200ms ease (온라인 복귀 시)
```

### 10.4 토스트 알림 시스템

```
화면 우측 하단에 스택으로 표시:

                                    ┌─────────────────────────┐
                                    │ ✓ ETHUSDT로 전환되었습니다 │
                                    │                    3s   │
                                    └─────────────────────────┘
                                    ┌─────────────────────────┐
                                    │ ⚠ WebSocket 재연결 성공   │
                                    │                    5s   │
                                    └─────────────────────────┘

토스트 타입별 디자인:
───────────────────────────────────────────────────

[success]
  좌측 아이콘: ✓ (#00C087)
  배경: bg-elevated
  보더 좌측: 3px solid #00C087
  자동 닫힘: 3초

[warning]
  좌측 아이콘: ⚠ (#F0B90B)
  배경: bg-elevated
  보더 좌측: 3px solid #F0B90B
  자동 닫힘: 5초

[error]
  좌측 아이콘: ✕ (#F6465D)
  배경: bg-elevated
  보더 좌측: 3px solid #F6465D
  자동 닫힘: 없음 (수동 닫기)

[info]
  좌측 아이콘: ℹ (#1E9AEF)
  배경: bg-elevated
  보더 좌측: 3px solid #1E9AEF
  자동 닫힘: 4초
```

```typescript
interface Toast {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  message: string;
  duration?: number;          // ms (0 = 수동 닫기)
  action?: {
    label: string;
    onClick: () => void;
  };
}

// 토스트 최대 동시 표시: 3개
// 초과 시 가장 오래된 토스트를 자동 제거
const MAX_VISIBLE_TOASTS = 3;
```

### 10.5 빈 상태 (Empty State) 및 스켈레톤

#### 10.5.1 로딩 스켈레톤

초기 로딩 시 위젯 영역에 스켈레톤 UI를 표시하여 CLS를 최소화한다.

```
┌─────── Skeleton: Chart ──────────┐
│ ┌── Header ──────────────────┐   │
│ │  ▓▓▓▓▓▓▓▓    ░░ ░░ ░░ ░░  │   │
│ └────────────────────────────┘   │
│                                  │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░   │  ← 회색 펄스 애니메이션
│  ░░░░░░░░░░░░░░░░░░░░░░░░       │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░     │
│  ░░░░░░░░░░░░░░░░░░░░░          │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░    │
│                                  │
└──────────────────────────────────┘

┌─────── Skeleton: OrderBook ──────┐
│ ┌── Header ──────────────────┐   │
│ │  ▓▓▓▓▓▓▓▓     ░░░░        │   │
│ └────────────────────────────┘   │
│                                  │
│  ░░░░░░░ ░░░░ ░░░░░             │
│  ░░░░░░░ ░░░░ ░░░░░             │
│  ░░░░░░░ ░░░░ ░░░░░             │
│  ──────────────────              │
│  ░░░░░░░ ░░░░ ░░░░░             │
│  ░░░░░░░ ░░░░ ░░░░░             │
│  ░░░░░░░ ░░░░ ░░░░░             │
│                                  │
└──────────────────────────────────┘
```

```css
/* 스켈레톤 펄스 애니메이션 */
.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-bg-tertiary) 25%,
    var(--color-bg-secondary) 50%,
    var(--color-bg-tertiary) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
  border-radius: var(--radius-sm);
}

@keyframes skeleton-pulse {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* reduced motion 시 정적 배경 */
@media (prefers-reduced-motion: reduce) {
  .skeleton {
    animation: none;
    background: var(--color-bg-tertiary);
  }
}
```

#### 10.5.2 데이터 없음 상태

```
┌─────── Empty: Watchlist ──────────┐
│ ┌── Header ──────────────────┐    │
│ │  Watchlist              [✕] │   │
│ └─────────────────────────────┘   │
│                                   │
│          ☆                        │
│                                   │
│    관심 종목이 없습니다             │
│                                   │
│    상단 검색창에서 종목을            │
│    추가해보세요                     │
│                                   │
│         [종목 추가]                │
│                                   │
└───────────────────────────────────┘
```

#### 10.5.3 상태별 UI 매핑 테이블

| 상태 | UI | 사용자 액션 |
|------|-----|-----------|
| 로딩 중 (초기) | 스켈레톤 UI | 대기 |
| 데이터 수신 중 (정상) | 실시간 데이터 표시 | - |
| 데이터 없음 | 빈 상태 일러스트 + 안내 | 종목 추가/변경 |
| WebSocket 재연결 중 | 마지막 데이터 유지 + 연결 상태 배지 | 대기 |
| WebSocket 연결 실패 | 마지막 데이터 유지 + 에러 배너 | 재연결 버튼 클릭 |
| 위젯 오류 | Error Fallback UI | 다시 시도 버튼 |
| 오프라인 | 마지막 데이터 유지 + 오프라인 배너 | 네트워크 복구 대기 |

---

## 부록 A: 파일 구조 (참고)

```
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # 루트 레이아웃 (ThemeProvider, AuthProvider)
│   ├── page.tsx                  # 대시보드 메인 페이지
│   └── globals.css               # CSS 변수, 리셋, 유틸리티
│
├── components/
│   ├── atoms/                    # Button, Input, Badge, StatusDot, ...
│   ├── molecules/                # WidgetHeader, SearchInput, ThemeToggle, ...
│   ├── organisms/                # 각 위젯 컴포넌트
│   └── templates/                # DashboardTemplate
│
├── widgets/
│   ├── registry.ts               # 위젯 타입 → 컴포넌트 매핑
│   ├── CandlestickChartWidget/
│   ├── OrderBookWidget/
│   │   ├── index.tsx             # React 래퍼
│   │   ├── renderer.ts          # Canvas 렌더링 로직
│   │   └── hitTest.ts           # 히트 감지
│   ├── TradeHistoryWidget/
│   │   ├── index.tsx
│   │   └── renderer.ts
│   └── WatchlistWidget/
│
├── stores/                       # Zustand 스토어
│   ├── depthStore.ts
│   ├── tradeStore.ts
│   ├── klineStore.ts
│   ├── uiStore.ts
│   └── authStore.ts
│
├── services/
│   ├── websocket/                # WebSocket 매니저
│   └── supabase/                 # Supabase 클라이언트
│
├── hooks/                        # Custom React Hooks
│   ├── useCanvasResize.ts
│   ├── usePageVisibility.ts
│   └── useWebSocket.ts
│
├── utils/                        # 유틸리티
│   ├── debounce.ts
│   ├── ringBuffer.ts
│   ├── fontMetrics.ts
│   └── formatters.ts
│
├── canvas/                       # Canvas 공통 유틸리티
│   ├── theme.ts                  # CanvasColorTheme
│   ├── dpr.ts                    # devicePixelRatio 유틸
│   └── animation.ts             # 이징 함수, 하이라이트 시스템
│
└── types/                        # 공유 TypeScript 타입
    ├── widget.ts
    ├── binance.ts
    └── layout.ts
```

---

## 부록 B: 디자인 결정 근거 (Design Decision Log)

| 결정 | 선택지 | 선택 | 근거 |
|------|--------|------|------|
| 오더북 렌더링 | DOM vs Canvas vs WebGL | Canvas 2D | DOM은 초당 수십 회 reflow 불가. WebGL은 오버킬. Canvas 2D가 최적의 성능/복잡도 비율 |
| 상태 관리 | Redux vs Zustand vs Jotai | Zustand | selector 기반 구독으로 불필요한 리렌더 최소화. boilerplate 최소. transient update 패턴 가능 |
| Canvas 데이터 저장 | Zustand store vs 외부 ref | 외부 ref (모듈 싱글턴) | React 리렌더를 완전히 우회. dirty flag 패턴과 결합하여 최적 성능 |
| 폰트 | 시스템 폰트 vs 웹폰트 | Inter + JetBrains Mono | 숫자 정렬 정확도가 금융 UI의 핵심. 모노스페이스 필수. Inter는 가독성 우수 |
| 테마 전환 | CSS class vs CSS variables vs CSS-in-JS | CSS Custom Properties + data attribute | FOUC 방지 용이. Canvas 테마는 별도 객체로 관리 |
| 레이아웃 저장 | 실시간 vs debounce | debounce 500ms | 드래그 중 매 프레임 저장은 불필요. 500ms는 사용자 조작 완료를 충분히 기다리는 시간 |

---

*본 문서는 구현 단계에서 지속적으로 업데이트된다. 디자인 결정 변경 시 부록 B에 근거를 기록한다.*
