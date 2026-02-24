# Git Workflow Guide

**프로젝트**: Real-time Crypto Trading Dashboard
**문서 버전**: v1.0
**작성일**: 2026-02-25

> 1인 개발 프로젝트이지만, 팀 수준의 전문적인 Git 워크플로우를 적용하여 포트폴리오 품질을 보장한다.

---

## 1. 브랜치 전략

Git Flow의 간소화 변형을 채택한다. 1인 개발에 불필요한 복잡성은 제거하되, 프로덕션 안정성과 기능 격리는 엄격히 유지한다.

### 1.1 브랜치 종류

| 브랜치 | 목적 | 생명주기 |
|--------|------|----------|
| `main` | 프로덕션 배포 브랜치. 항상 배포 가능 상태를 유지한다. | 영구 |
| `develop` | 개발 통합 브랜치. 다음 릴리즈를 준비한다. | 영구 |
| `feature/<name>` | 새로운 기능 개발 | develop에서 분기 → develop으로 병합 후 삭제 |
| `fix/<description>` | 버그 수정 | develop에서 분기 → develop으로 병합 후 삭제 |
| `refactor/<description>` | 리팩토링 (기능 변경 없음) | develop에서 분기 → develop으로 병합 후 삭제 |
| `docs/<description>` | 문서 작업 | develop에서 분기 → develop으로 병합 후 삭제 |
| `release/v<version>` | 릴리즈 준비 및 최종 QA | develop에서 분기 → main + develop 병합 후 삭제 |

### 1.2 브랜치 네이밍 규칙

- **소문자(lowercase)** 만 사용한다.
- **kebab-case** 로 단어를 구분한다.
- 기능을 명확하게 설명하는 이름을 사용한다.

```
# 올바른 예시
feature/websocket-manager
feature/orderbook-canvas-renderer
feature/candlestick-chart
fix/websocket-reconnect-memory-leak
fix/orderbook-sequence-gap
refactor/zustand-store-selectors
docs/api-architecture-diagram
release/v0.1.0

# 잘못된 예시
feature/feat1              # 설명이 불충분
feature/WebSocket_Manager  # 대문자, 언더스코어 사용
fix/bug                    # 무엇을 수정하는지 알 수 없음
my-branch                  # 접두사(타입) 누락
```

### 1.3 브랜치 생명주기 다이어그램

```
main       ─────────────────●──────────────────●──────────── (프로덕션)
                           ↑                   ↑
                     merge commit          merge commit
                           │                   │
release    ──────── release/v0.1.0 ──  release/v0.2.0 ──
                     ↑                   ↑
                     │                   │
develop    ──●──●──●──●──●──●──●──●──●──●──●──●──●──────── (통합)
              ↑  ↑     ↑        ↑  ↑        ↑
              │  │     │        │  │        │
feature    ───┘  │     │        │  └────────┘
fix        ──────┘     │        │
refactor   ────────────┘        │
docs       ─────────────────────┘
```

### 1.4 병합 전략

| 병합 방향 | 전략 | 이유 |
|-----------|------|------|
| `feature/*` → `develop` | **Squash Merge** | 기능 브랜치의 중간 커밋을 정리하여 develop 히스토리를 깔끔하게 유지 |
| `fix/*` → `develop` | **Squash Merge** | 동일 |
| `refactor/*` → `develop` | **Squash Merge** | 동일 |
| `docs/*` → `develop` | **Squash Merge** | 동일 |
| `develop` → `main` | **Merge Commit** | 릴리즈 지점을 명확하게 기록하여 롤백 용이성 확보 |
| `release/*` → `main` | **Merge Commit** | 릴리즈 히스토리 보존 |

### 1.5 브랜치 운영 규칙

1. `main` 브랜치에 직접 커밋하지 않는다.
2. `develop` 브랜치에 직접 커밋하지 않는다 (긴급 설정 변경 제외).
3. 기능 브랜치는 작업 완료 후 PR을 통해 병합한다.
4. 병합 완료된 브랜치는 즉시 삭제한다.
5. 장기간(3일 이상) 미병합 브랜치는 develop을 rebase하여 충돌을 예방한다.

---

## 2. 커밋 컨벤션

[Conventional Commits](https://www.conventionalcommits.org/) 스펙을 따른다. 커밋 메시지는 **영어** 로 작성한다.

### 2.1 커밋 메시지 형식

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

- **type**: 변경의 종류 (필수)
- **scope**: 변경 영향 범위 (권장)
- **description**: 변경 내용 요약, 명령형 현재 시제 사용 (필수)
- **body**: 변경의 동기와 상세 내용 (선택)
- **footer**: Breaking Changes, 이슈 참조 등 (선택)

### 2.2 커밋 타입

| 타입 | 설명 | 예시 |
|------|------|------|
| `feat` | 새로운 기능 추가 | WebSocket 매니저 구현, 오더북 위젯 추가 |
| `fix` | 버그 수정 | 메모리 누수 수정, 재연결 로직 오류 수정 |
| `perf` | 성능 개선 (기능 변경 없음) | Canvas 렌더링 최적화, 메모리 사용량 감소 |
| `refactor` | 리팩토링 (기능 변경 없음) | 상태 관리 구조 개선, 코드 분리 |
| `style` | 코드 스타일 변경 (포맷팅, 세미콜론 등) | Prettier 적용, import 정렬 |
| `test` | 테스트 추가 또는 수정 | 단위 테스트 추가, E2E 시나리오 작성 |
| `docs` | 문서 변경 | README 업데이트, JSDoc 추가 |
| `build` | 빌드 설정 변경 | Next.js 설정 수정, 번들 최적화 |
| `ci` | CI/CD 설정 변경 | GitHub Actions 워크플로우 수정 |
| `chore` | 기타 잡무 (코드 변경 없음) | 의존성 업데이트, .gitignore 수정 |

### 2.3 스코프 (Scope)

프로젝트 도메인에 맞는 스코프를 사용한다.

| 스코프 | 대상 영역 |
|--------|-----------|
| `websocket` | WebSocket 매니저, 연결/재연결/구독 관리 |
| `chart` | 캔들스틱 차트 (TradingView Lightweight Charts) |
| `orderbook` | 오더북 위젯 (Canvas 렌더링, depth 데이터) |
| `trades` | 체결 내역 위젯 (Canvas 렌더링, 링 버퍼) |
| `grid` | 대시보드 그리드 레이아웃 (React Grid Layout) |
| `auth` | Supabase 인증 (OAuth, 세션 관리) |
| `watchlist` | 관심 종목 (검색, 추가/제거, 실시간 가격) |
| `canvas` | Canvas 2D 렌더링 공통 (devicePixelRatio, rAF 루프) |
| `store` | Zustand 상태 관리 (스토어 설계, selector) |
| `ui` | 일반 UI 컴포넌트 (테마, 레이아웃, 공통 UI) |

### 2.4 좋은 커밋 메시지 예시

```
# 1. 새 기능 추가 - 명확한 scope와 설명
feat(websocket): implement connection manager with auto-reconnect

# 2. 성능 개선 - 구체적인 개선 내용 기술
perf(orderbook): skip canvas redraw when data is unchanged

# 3. 버그 수정 - 무엇이 잘못되었고 어떻게 수정했는지
fix(websocket): prevent duplicate subscriptions on symbol change

# 4. 리팩토링 - 구조 변경의 의도 전달
refactor(store): split monolithic store into domain-specific slices

# 5. Canvas 관련 기능 추가
feat(canvas): add Retina display support with devicePixelRatio scaling

# 6. 테스트 추가
test(websocket): add unit tests for exponential backoff reconnection

# 7. 빌드 설정
build: configure dynamic import for TradingView Lightweight Charts

# 8. 성능 최적화 - body로 상세 설명 포함
perf(trades): replace Array.shift with ring buffer for trade feed

Migrate trade history storage from dynamic array to Float64Array-based
ring buffer. Eliminates O(n) shift operations and reduces GC pressure
during high-frequency trade updates.

# 9. Breaking Change - footer 활용
feat(store): migrate state management from Context API to Zustand

BREAKING CHANGE: All components using useTradeContext() must migrate
to useTradeStore() selector pattern.

# 10. 이슈 참조
fix(orderbook): resolve sequence gap causing stale price levels

Closes #42
```

### 2.5 나쁜 커밋 메시지 예시

```
# 1. 의미 없는 메시지
fix: fix bug

# 2. 타입 누락
updated websocket manager

# 3. 너무 장황한 제목
feat(websocket): implement the websocket connection manager that handles
automatic reconnection with exponential backoff strategy and subscription management

# 4. 한국어 사용 (커밋 메시지는 영어로)
feat(chart): 캔들스틱 차트 추가

# 5. 과거 시제 사용 (명령형 현재 시제를 사용해야 함)
feat(orderbook): added canvas renderer

# 6. scope 불명확
feat(stuff): add new component

# 7. 대문자로 시작
feat(chart): Add candlestick chart component

# 8. 마침표로 끝남
fix(websocket): resolve reconnection issue.

# 9. 여러 변경사항을 하나의 커밋에
feat(orderbook,trades,chart): add all trading widgets

# 10. WIP 커밋을 그대로 병합
WIP: working on something
```

### 2.6 Breaking Change 표기

하위 호환이 깨지는 변경은 반드시 커밋 메시지에 명시한다.

```
feat(store)!: redesign trade data schema for typed array support

Migrate trade records from plain objects to Float64Array slots.
Components accessing trade data must update their data access patterns.

BREAKING CHANGE: TradeRecord interface replaced with TypedTradeBuffer.
Previously: { price: number, quantity: number, time: number }
Now: Float64Array with fixed-slot access via TradeBuffer.get(index)
```

---

## 3. PR (Pull Request) 컨벤션

1인 개발이지만, 모든 기능 브랜치는 PR을 통해 병합한다. Self-review 습관을 통해 코드 품질을 유지하고, PR 히스토리가 프로젝트 이력의 핵심 문서로 기능한다.

### 3.1 PR 제목 형식

커밋 컨벤션과 동일한 형식을 사용한다.

```
<type>(<scope>): <description>
```

```
feat(websocket): implement connection manager with auto-reconnect
fix(orderbook): resolve canvas memory leak on widget unmount
perf(trades): optimize ring buffer for high-frequency updates
```

### 3.2 PR 템플릿

```markdown
## Summary
<!-- 무엇을 변경했고, 왜 변경했는지 1~2문장으로 요약 -->


## Changes
<!-- 구체적인 변경 사항을 나열 -->
-
-
-

## Testing
<!-- 변경 사항을 어떻게 검증했는지 기술 -->
- [ ] 수동 테스트:
- [ ] 단위 테스트:
- [ ] E2E 테스트:

## Screenshots
<!-- UI 변경이 있는 경우 스크린샷 첨부 (없으면 "N/A") -->


## Performance Impact
<!-- 성능에 영향이 있는 경우 기술 (없으면 "N/A") -->
- FPS 영향:
- 메모리 영향:
- 번들 크기 영향:

## Checklist
- [ ] TypeScript 타입 에러 없음 (`tsc --noEmit` 통과)
- [ ] ESLint 경고/에러 없음
- [ ] Prettier 포맷팅 적용됨
- [ ] 콘솔 에러/경고 없음
- [ ] 단위 테스트 통과
- [ ] 새로운 기능에 대한 테스트 추가됨
- [ ] 메모리 누수 점검 완료 (이벤트 리스너, 구독, 타이머)
- [ ] Canvas/Chart 리소스 정리 확인
- [ ] WebSocket 구독 해제 확인
- [ ] 반응형 레이아웃에서 정상 동작 확인
```

### 3.3 PR 크기 가이드라인

| 규모 | 변경 라인 수 | 권장 여부 |
|------|-------------|-----------|
| Small | < 200줄 | 권장 |
| Medium | 200 ~ 500줄 | 허용 |
| Large | 500 ~ 1000줄 | 가급적 분리 |
| X-Large | > 1000줄 | 반드시 분리 |

- 하나의 PR은 하나의 관심사에 집중한다.
- 리팩토링과 기능 추가를 동일 PR에 섞지 않는다.
- 대규모 기능은 여러 단계의 PR로 분리한다.

```
# 올바른 예시: WebSocket 매니저를 여러 PR로 분리
PR #1: feat(websocket): add connection state machine
PR #2: feat(websocket): implement message routing by stream type
PR #3: feat(websocket): add exponential backoff reconnection
PR #4: test(websocket): add integration tests for reconnection scenarios
```

### 3.4 병합 전 Self-Review 체크리스트

PR을 병합하기 전 반드시 다음을 확인한다.

1. **Files Changed** 탭에서 모든 변경 사항을 한 줄씩 직접 읽었는가?
2. `console.log`, 디버그 코드, TODO 주석이 남아있지 않은가?
3. 불필요한 파일 변경(포맷팅 변경으로 인한 diff 오염 등)이 없는가?
4. 새로 추가한 이벤트 리스너, 구독, 타이머에 대한 정리 코드가 있는가?
5. 에러 핸들링이 빠짐없이 적용되어 있는가?

---

## 4. 코드 리뷰 가이드라인

1인 개발이라도 Self-Review 규율을 엄격하게 유지한다. PR을 생성한 후 최소 **10분 이상** 시간을 두고 코드를 다시 읽는다.

### 4.1 핵심 리뷰 포인트

#### 메모리 누수 점검
- [ ] `addEventListener`에 대응하는 `removeEventListener`가 있는가?
- [ ] `setInterval` / `setTimeout`에 대응하는 `clearInterval` / `clearTimeout`이 있는가?
- [ ] WebSocket `onmessage`, `onclose` 핸들러가 컴포넌트 unmount 시 정리되는가?
- [ ] Zustand `subscribe()`의 반환값(unsubscribe)을 호출하고 있는가?
- [ ] `ResizeObserver`, `IntersectionObserver` 등이 disconnect 되는가?

#### 불필요한 리렌더 점검
- [ ] Zustand selector가 필요한 상태만 정확하게 구독하는가?
- [ ] `React.memo`가 적절하게 적용되어 있는가?
- [ ] `useCallback`, `useMemo`의 의존성 배열이 정확한가?
- [ ] 객체/배열 리터럴이 렌더링 시마다 새로 생성되지 않는가?

#### WebSocket 생명주기 점검
- [ ] 심볼 변경 시 이전 스트림이 완전히 해제되는가?
- [ ] 재연결 시 중복 구독이 발생하지 않는가?
- [ ] 컴포넌트 unmount 시 구독이 해제되는가?
- [ ] 에러/close 이벤트에 대한 처리가 있는가?

#### Canvas 리소스 점검
- [ ] `requestAnimationFrame` ID가 `cancelAnimationFrame`으로 정리되는가?
- [ ] Canvas context 참조가 컴포넌트 unmount 시 null로 설정되는가?
- [ ] 리사이즈 시 Canvas 해상도가 올바르게 재설정되는가?
- [ ] devicePixelRatio가 변경될 수 있는 환경(외부 모니터 연결)에 대응하는가?

#### TypeScript 타입 안전성
- [ ] `any` 타입을 사용하지 않았는가?
- [ ] WebSocket 메시지에 대한 런타임 타입 검증이 있는가?
- [ ] 외부 API 응답에 대한 타입 가드가 적용되어 있는가?
- [ ] `as` 타입 단언(assertion) 사용을 최소화했는가?

#### 에러 핸들링
- [ ] 네트워크 요청에 try-catch 또는 에러 핸들러가 있는가?
- [ ] JSON.parse에 try-catch가 있는가?
- [ ] Error Boundary가 위젯 단위로 적용되어 있는가?
- [ ] 사용자에게 에러 상태가 적절하게 표시되는가?

---

## 5. 버전 관리

[Semantic Versioning (SemVer)](https://semver.org/) 을 따른다.

### 5.1 버전 형식

```
MAJOR.MINOR.PATCH

MAJOR: 하위 호환이 깨지는 변경 (API 변경, 데이터 스키마 변경)
MINOR: 하위 호환을 유지하는 새 기능 추가
PATCH: 하위 호환을 유지하는 버그 수정
```

### 5.2 버전 마일스톤

| 버전 | 내용 | 비고 |
|------|------|------|
| `v0.1.0` | WebSocket 매니저 + 캔들스틱 차트 | Binance 연동, 기본 데이터 파이프라인 |
| `v0.2.0` | 오더북 + 체결 내역 Canvas 렌더링 | Canvas 2D 커스텀 렌더러, 링 버퍼 |
| `v0.3.0` | 대시보드 그리드 시스템 | React Grid Layout, 위젯 드래그/리사이즈 |
| `v0.4.0` | 인증 + 클라우드 영속화 | Supabase Auth, 레이아웃/관심 종목 저장 |
| `v0.5.0` | 업비트 통합 | KRW 마켓, 거래소 전환, 김치 프리미엄 |
| `v1.0.0` | 프로덕션 릴리즈 | 성능 최적화 완료, E2E 테스트 통과 |

### 5.3 릴리즈 절차

```bash
# 1. develop에서 release 브랜치 생성
git checkout develop
git checkout -b release/v0.2.0

# 2. 버전 번호 업데이트
npm version minor --no-git-tag-version

# 3. CHANGELOG.md 업데이트

# 4. 최종 QA 및 수정

# 5. main으로 병합 및 태그
git checkout main
git merge --no-ff release/v0.2.0
git tag -a v0.2.0 -m "Release v0.2.0: Orderbook + Trade feed Canvas rendering"

# 6. develop에도 병합
git checkout develop
git merge --no-ff release/v0.2.0

# 7. release 브랜치 삭제
git branch -d release/v0.2.0

# 8. 태그 푸시
git push origin main develop --tags
```

### 5.4 CHANGELOG 형식

[Keep a Changelog](https://keepachangelog.com/) 규격을 따른다.

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.0] - 2026-03-15
### Added
- Canvas 2D orderbook renderer with depth heatmap bars
- Ring buffer-based trade feed with 200-entry capacity
- Retina display support for all Canvas widgets

### Changed
- Migrate orderbook rendering from React DOM to Canvas 2D

### Fixed
- Orderbook sequence gap causing stale price levels

### Performance
- Canvas redraw skipped when data unchanged (dirty flag pattern)
- Trade feed O(1) append via Float64Array ring buffer

## [0.1.0] - 2026-03-01
### Added
- WebSocket connection manager with exponential backoff
- Binance kline/depth/trade stream integration
- TradingView Lightweight Charts candlestick chart
- Zustand store architecture with domain-specific slices
- Basic dark theme UI shell
```

---

## 6. Git Hooks

[Husky](https://typicode.github.io/husky/) 와 관련 도구를 사용하여 커밋/푸시 시점에 코드 품질을 자동으로 검증한다.

### 6.1 설치

```bash
npm install -D husky lint-staged @commitlint/cli @commitlint/config-conventional
npx husky init
```

### 6.2 pre-commit 훅

`lint-staged`를 사용하여 스테이징된 파일에 대해서만 ESLint와 Prettier를 실행한다.

```bash
# .husky/pre-commit
npx lint-staged
```

```json
// package.json
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

### 6.3 pre-push 훅

TypeScript 타입 체크를 실행하여, 타입 에러가 있는 코드가 원격에 올라가지 않도록 한다.

```bash
# .husky/pre-push
npx tsc --noEmit
```

### 6.4 commit-msg 훅

`commitlint`를 사용하여 Conventional Commits 형식을 강제한다.

```bash
# .husky/commit-msg
npx --no -- commitlint --edit ${1}
```

```js
// commitlint.config.js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', 'fix', 'perf', 'refactor', 'style',
        'test', 'docs', 'build', 'ci', 'chore',
      ],
    ],
    'scope-enum': [
      1,
      'always',
      [
        'websocket', 'chart', 'orderbook', 'trades', 'grid',
        'auth', 'watchlist', 'canvas', 'store', 'ui',
      ],
    ],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-max-length': [2, 'always', 72],
    'body-max-line-length': [1, 'always', 100],
  },
};
```

### 6.5 훅 실행 흐름 요약

```
git commit
  │
  ├─ [pre-commit]  lint-staged → ESLint + Prettier (스테이징 파일만)
  │     실패 시 → 커밋 중단, 에러 출력
  │
  └─ [commit-msg]  commitlint → Conventional Commits 형식 검증
        실패 시 → 커밋 중단, 형식 에러 출력

git push
  │
  └─ [pre-push]  tsc --noEmit → TypeScript 전체 타입 체크
        실패 시 → 푸시 중단, 타입 에러 출력
```

---

## 7. .gitignore 가이드

프로젝트에 커밋하지 않아야 하는 파일과 디렉토리 목록이다.

```gitignore
# Dependencies
node_modules/
.pnp
.pnp.js

# Next.js
.next/
out/

# Build
build/
dist/

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Vercel
.vercel

# Testing
coverage/
playwright-report/
test-results/

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db
ehthumbs.db
Desktop.ini

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*

# TypeScript
*.tsbuildinfo
next-env.d.ts

# Misc
*.pem
.turbo
```

### 7.1 주의 사항

- `.env.local`은 절대 커밋하지 않는다. Supabase URL, anon key 등 환경 변수를 포함한다.
- `.env.example` 파일을 만들어 필요한 환경 변수의 키 이름만 기록하고 커밋한다.
- `next-env.d.ts`는 Next.js가 자동 생성하므로 커밋하지 않는다.
- `coverage/`와 `playwright-report/`는 CI에서 생성되므로 커밋하지 않는다.

---

## 부록: 일상 워크플로우 요약

### 새 기능 개발 시

```bash
# 1. develop에서 feature 브랜치 생성
git checkout develop
git pull origin develop
git checkout -b feature/orderbook-canvas

# 2. 작업 및 커밋
git add src/components/OrderBook/
git commit -m "feat(orderbook): implement canvas 2d renderer with depth bars"

# 3. develop 최신 변경 반영 (필요 시)
git fetch origin
git rebase origin/develop

# 4. 푸시 및 PR 생성
git push -u origin feature/orderbook-canvas
gh pr create --base develop

# 5. Self-Review 후 Squash Merge
gh pr merge --squash

# 6. 로컬 브랜치 정리
git checkout develop
git pull origin develop
git branch -d feature/orderbook-canvas
```

### 버그 수정 시

```bash
git checkout develop
git checkout -b fix/websocket-duplicate-subscription
# ... 수정 및 커밋 ...
git push -u origin fix/websocket-duplicate-subscription
gh pr create --base develop
# Self-Review 후 Squash Merge
```

### 릴리즈 시

```bash
git checkout develop
git checkout -b release/v0.2.0
# 버전 업데이트, CHANGELOG 작성, 최종 QA
git push -u origin release/v0.2.0
gh pr create --base main
# QA 통과 후 Merge Commit으로 병합, 태그 생성
```
