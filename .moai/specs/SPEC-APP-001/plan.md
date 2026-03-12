---
id: SPEC-APP-001
type: plan
version: "1.0.0"
status: draft
created: "2026-03-12"
updated: "2026-03-12"
author: MoAI
---

# SPEC-APP-001: FocusFlow 구현 계획

## 1. 구현 전략 개요

### 1.1 개발 접근 방식

FocusFlow MVP는 점진적 구축(Incremental Build) 전략을 따른다. 핵심 인프라(인증, DB)를 먼저 구축한 후, 기능 모듈을 독립적으로 개발하여 통합하는 Bottom-Up 방식을 적용한다.

### 1.2 Phase 순서 및 의존성

```
Phase 1: Foundation (인증 + DB 스키마)
    |
    v
Phase 2: Core Task Management (CRUD + UI)
    |
    +---> Phase 3a: Calendar Integration (병렬 가능)
    +---> Phase 3b: Gmail Integration (병렬 가능)
    |
    v
Phase 4: AI Integration (분류 + 분해 + TOP 3)
    |
    v
Phase 5: ADHD UX Features (Focus Mode, Rewards, Timer)
    |
    v
Phase 6: Real-time & Notifications (Supabase Realtime, Push)
    |
    v
Phase 7: PWA & Polish (설치, 오프라인, 최적화)
```

---

## 2. Module별 Task 분해

### Module 1: Authentication (Google OAuth) - Priority High

#### 1.1 Supabase 프로젝트 설정

- [ ] Supabase 프로젝트 생성 및 환경변수 설정
- [ ] Google Cloud Console에서 OAuth 2.0 Client ID 생성
- [ ] Supabase Auth에 Google Provider 등록 및 redirect URL 설정
- [ ] Google Calendar API, Gmail API 활성화 및 scope 설정

#### 1.2 인증 흐름 구현

- [ ] Next.js 16 프로젝트 초기화 (App Router, TypeScript, Tailwind CSS)
- [ ] Supabase Client 설정 (`@supabase/ssr` 사용)
- [ ] 로그인 페이지 구현 (`/login`)
- [ ] Google OAuth 로그인 버튼 및 흐름 구현
- [ ] OAuth Callback 처리 (`/api/auth/callback`)
- [ ] Auth Middleware 구현 (보호된 경로 접근 제어)

#### 1.3 사용자 관리

- [ ] `users` 테이블 Migration 생성
- [ ] Row Level Security 정책 설정
- [ ] 사용자 프로필 자동 생성 Trigger (Supabase Function)
- [ ] Session 관리 및 자동 Token 갱신 구현

#### 복잡도: 중간
#### 의존성: 없음 (최초 시작 모듈)
#### 관련 요구사항: REQ-AUTH-001 ~ REQ-AUTH-007

---

### Module 2: Database Schema & Core Setup - Priority High

#### 2.1 데이터베이스 스키마 구현

- [ ] `tasks` 테이블 Migration
- [ ] `email_metadata` 테이블 Migration
- [ ] `streaks` 테이블 Migration
- [ ] `reminders` 테이블 Migration
- [ ] ENUM 타입 정의 (quadrant, status, source_type, reminder_type)

#### 2.2 Row Level Security

- [ ] 모든 테이블에 RLS 활성화
- [ ] 사용자별 데이터 격리 정책 작성
- [ ] RLS 정책 테스트

#### 2.3 Database Functions

- [ ] Task 완료 시 streak 업데이트 Function
- [ ] Reminder 자동 생성 Function (마감일 설정 시)

#### 복잡도: 중간
#### 의존성: Module 1 (Auth 설정 필요)

---

### Module 3: Core Task Management - Priority High

#### 3.1 Task CRUD API

- [ ] `GET /api/tasks` - 목록 조회 (필터링, 페이지네이션, quadrant별)
- [ ] `POST /api/tasks` - Task 생성 (Server Action)
- [ ] `PATCH /api/tasks/[id]` - Task 수정
- [ ] `DELETE /api/tasks/[id]` - Task 삭제
- [ ] `POST /api/tasks/[id]/complete` - Task 완료 처리

#### 3.2 Task UI 컴포넌트

- [ ] Eisenhower Matrix 4분면 레이아웃 (Grid 기반)
- [ ] Task 카드 컴포넌트 (제목, 마감일, 에너지 아이콘, quadrant 색상)
- [ ] Task 생성/수정 모달 (shadcn/ui Dialog)
- [ ] Task 상세 보기 패널
- [ ] Drag & Drop 재분류 기능 (`@dnd-kit/core`)
- [ ] 에너지 비용 선택 UI (배터리 아이콘 1~5단계)

#### 3.3 대시보드 페이지

- [ ] 메인 대시보드 레이아웃
- [ ] Eisenhower Matrix 뷰
- [ ] 필터 및 정렬 옵션
- [ ] Progressive Disclosure (3~5개 Task 표시 + "더 보기")

#### 복잡도: 높음
#### 의존성: Module 1, Module 2
#### 관련 요구사항: REQ-TASK-001, REQ-TASK-004, REQ-TASK-007, REQ-TASK-010

---

### Module 4: Calendar Integration - Priority Medium

#### 4.1 Google Calendar API 연동

- [ ] Google Calendar API Client 설정 (Server-side)
- [ ] OAuth token 관리 및 갱신 로직
- [ ] `POST /api/calendar/sync` - 동기화 API
- [ ] 이벤트 → Task 변환 로직

#### 4.2 동기화 관리

- [ ] 중복 방지 로직 (source_id 기준)
- [ ] 주기적 동기화 (Supabase Edge Function 또는 클라이언트 setInterval)
- [ ] 수동 동기화 버튼 및 결과 표시
- [ ] 동기화 실패 시 에러 핸들링 UI

#### 복잡도: 높음
#### 의존성: Module 1 (OAuth scope), Module 2 (tasks 테이블)
#### 관련 요구사항: REQ-CAL-001 ~ REQ-CAL-006

---

### Module 5: Gmail Integration - Priority Medium

#### 5.1 Gmail API 연동

- [ ] Gmail API Client 설정 (Server-side)
- [ ] 이메일 조회 및 본문 파싱 로직
- [ ] 민감 정보 필터링/마스킹 로직
- [ ] `POST /api/email/scan` - Gmail 스캔 API

#### 5.2 AI 기반 Action Item 추출

- [ ] Claude API를 활용한 이메일 분석 Prompt 설계
- [ ] Action item 추출 결과 구조화
- [ ] 사용자 확인 미리보기 UI
- [ ] 선택적 Task 등록 기능

#### 5.3 Rate Limiting

- [ ] 사용자별 스캔 빈도 제한 (1시간/1회)
- [ ] Rate limit 상태 표시 UI

#### 복잡도: 높음
#### 의존성: Module 1 (OAuth scope), Module 2 (tasks, email_metadata 테이블)
#### 관련 요구사항: REQ-MAIL-001 ~ REQ-MAIL-006

---

### Module 6: AI Integration (Eisenhower Classification) - Priority High

#### 6.1 Claude API 연동

- [ ] Anthropic SDK 설정 (`@anthropic-ai/sdk`)
- [ ] AI Classification Prompt 설계 및 최적화
- [ ] AI Decomposition Prompt 설계
- [ ] Today's TOP 3 선정 Prompt 설계

#### 6.2 분류 시스템

- [ ] `POST /api/tasks/classify` - 일괄 분류 API
- [ ] 단일 Task 생성 시 자동 분류 통합
- [ ] 분류 이유 저장 및 표시
- [ ] 사용자 수정 시 학습 데이터 수집

#### 6.3 Task 분해

- [ ] `POST /api/tasks/[id]/decompose` - Task 분해 API
- [ ] 하위 Task 생성 및 parent_task_id 연결
- [ ] 분해 결과 UI (접히는 하위 Task 목록)

#### 6.4 Brain Dump 모드

- [ ] `POST /api/tasks/brain-dump` - Brain Dump API
- [ ] 빠른 텍스트 입력 UI (전체 화면 텍스트 영역)
- [ ] 입력 완료 후 일괄 분류 및 결과 표시

#### 6.5 Fallback 처리

- [ ] API 실패 시 "미분류" 상태 저장
- [ ] 지수적 Backoff 재시도 로직 (최대 3회)
- [ ] 수동 분류 Fallback UI

#### 복잡도: 매우 높음
#### 의존성: Module 3 (Task CRUD)
#### 관련 요구사항: REQ-AI-001 ~ REQ-AI-007

---

### Module 7: ADHD UX Features - Priority Medium

#### 7.1 Focus Now 모드

- [ ] Focus Now 전체 화면 뷰 구현
- [ ] Q1 최우선 Task 자동 선택 로직
- [ ] Focus 모드 진입/퇴출 애니메이션

#### 7.2 Completion Rewards 시스템

- [ ] Confetti 애니메이션 (`canvas-confetti` 라이브러리)
- [ ] Streak 카운터 UI 및 로직
- [ ] Progress bar (오늘의 완료율)
- [ ] 격려 메시지 시스템 (3개 Task 완료마다)

#### 7.3 Visual Countdown Timer

- [ ] 원형 타이머 컴포넌트 (SVG 기반)
- [ ] 바 타이머 컴포넌트
- [ ] 타이머 시작/일시정지/리셋 기능
- [ ] 마감까지 남은 시간 실시간 표시

#### 7.4 Today's TOP 3 UI

- [ ] TOP 3 전용 카드 디자인
- [ ] AI 추천 이유 표시
- [ ] TOP 3 완료 시 특별 보상 애니메이션

#### 복잡도: 높음
#### 의존성: Module 3 (Task UI), Module 6 (AI)
#### 관련 요구사항: REQ-TASK-002, REQ-TASK-003, REQ-TASK-006, REQ-TASK-008, REQ-TASK-011

---

### Module 8: Real-time & Notifications - Priority Low

#### 8.1 Supabase Realtime

- [ ] tasks 테이블 Realtime 구독 설정
- [ ] 멀티 디바이스 동기화 구현
- [ ] Optimistic UI 업데이트

#### 8.2 Web Push Notifications

- [ ] Service Worker 등록 및 Push 구독
- [ ] `POST /api/reminders/subscribe` - 구독 API
- [ ] Chain Alarm 로직 (1h, 30m, 10m, 5m)
- [ ] Supabase Edge Function으로 Reminder 전송 스케줄링

#### 복잡도: 높음
#### 의존성: Module 2 (reminders 테이블), Module 3 (Task)
#### 관련 요구사항: REQ-TASK-005, REQ-TASK-009

---

### Module 9: PWA & Polish - Priority Low

#### 9.1 PWA 설정

- [ ] manifest.json 설정
- [ ] Service Worker 오프라인 캐싱 전략
- [ ] 앱 설치 프롬프트 UI

#### 9.2 최적화

- [ ] Next.js Image 최적화
- [ ] Code splitting 및 lazy loading
- [ ] Lighthouse 성능 점수 90+ 달성
- [ ] 접근성 (WCAG 2.1 AA) 검증

#### 복잡도: 중간
#### 의존성: 모든 핵심 모듈 완료 후
#### 관련 요구사항: REQ-TASK-012

---

## 3. 기술 의존성 및 버전

### 3.1 Core Dependencies

| 패키지 | 버전 | 용도 |
|--------|------|------|
| next | ^16.0.0 | App Router 프레임워크 |
| react | ^19.0.0 | UI 라이브러리 |
| react-dom | ^19.0.0 | React DOM 렌더링 |
| typescript | ^5.9.0 | 타입 시스템 |

### 3.2 Supabase

| 패키지 | 버전 | 용도 |
|--------|------|------|
| @supabase/supabase-js | ^2.49.0 | Supabase Client |
| @supabase/ssr | ^0.6.0 | Next.js SSR 지원 |

### 3.3 UI

| 패키지 | 버전 | 용도 |
|--------|------|------|
| tailwindcss | ^4.0.0 | 유틸리티 CSS |
| shadcn/ui | latest | UI 컴포넌트 (복사 기반) |
| @dnd-kit/core | ^6.3.0 | Drag & Drop |
| @dnd-kit/sortable | ^10.0.0 | 정렬 가능 Drag & Drop |
| canvas-confetti | ^1.9.0 | Confetti 애니메이션 |
| framer-motion | ^12.0.0 | 애니메이션 |

### 3.4 AI & API

| 패키지 | 버전 | 용도 |
|--------|------|------|
| @anthropic-ai/sdk | ^0.39.0 | Claude API Client |
| googleapis | ^144.0.0 | Google Calendar/Gmail API |
| zod | ^3.24.0 | 입력 유효성 검증 |

### 3.5 Utilities

| 패키지 | 버전 | 용도 |
|--------|------|------|
| date-fns | ^4.1.0 | 날짜 처리 |
| web-push | ^3.7.0 | Web Push 전송 |

### 3.6 Dev Dependencies

| 패키지 | 버전 | 용도 |
|--------|------|------|
| vitest | ^3.0.0 | 단위 테스트 |
| @testing-library/react | ^16.0.0 | React 테스트 |
| playwright | ^1.50.0 | E2E 테스트 |
| @types/node | ^22.0.0 | Node.js 타입 |

> **참고**: 정확한 최신 안정 버전은 `/moai:2-run` 단계에서 확인합니다.

---

## 4. 데이터베이스 스키마 개요

### 4.1 ERD (Entity Relationship Diagram)

```
users (1) ----< (N) tasks
                     |
                     +----< (N) tasks (parent_task_id, self-referencing)
                     |
                     +---- (1) email_metadata (task_id, optional)
                     |
                     +----< (N) reminders (task_id)

users (1) ----< (1) streaks
```

### 4.2 인덱스 전략

| 테이블 | 인덱스 | 용도 |
|--------|--------|------|
| tasks | (user_id, quadrant, status) | 대시보드 조회 최적화 |
| tasks | (user_id, due_date) | 마감일 기준 조회 |
| tasks | (source_type, source_id) | 중복 방지 조회 |
| tasks | (parent_task_id) | 하위 Task 조회 |
| reminders | (remind_at, sent) | 알림 전송 스케줄 조회 |

### 4.3 RLS 정책

```sql
-- tasks 테이블 예시
CREATE POLICY "Users can only access own tasks"
  ON tasks FOR ALL
  USING (auth.uid() = user_id);

-- 모든 테이블에 동일한 패턴 적용
```

---

## 5. API Endpoint 설계

### 5.1 인증 관련

| Method | Path | Input | Output | 비고 |
|--------|------|-------|--------|------|
| GET | /api/auth/callback | code (query) | Redirect | Google OAuth Callback |
| POST | /api/auth/logout | - | 204 | Session 종료 |

### 5.2 Task 관련

| Method | Path | Input | Output | 비고 |
|--------|------|-------|--------|------|
| GET | /api/tasks | ?quadrant, ?status, ?page, ?limit | Task[] | 필터링, 페이지네이션 |
| POST | /api/tasks | { title, description?, due_date?, energy_cost? } | Task | AI 자동 분류 포함 |
| PATCH | /api/tasks/[id] | { title?, quadrant?, status?, ... } | Task | 부분 업데이트 |
| DELETE | /api/tasks/[id] | - | 204 | Soft delete |
| POST | /api/tasks/[id]/complete | - | Task + Streak | 완료 처리 + Streak 업데이트 |
| POST | /api/tasks/[id]/decompose | - | Task[] | AI 하위 Task 생성 |

### 5.3 AI 관련

| Method | Path | Input | Output | 비고 |
|--------|------|-------|--------|------|
| POST | /api/tasks/classify | { task_ids: string[] } | ClassificationResult[] | 일괄 분류 |
| GET | /api/tasks/top3 | - | Task[3] + reasons | Today's TOP 3 |
| POST | /api/tasks/brain-dump | { text: string } | Task[] | 텍스트에서 Task 추출 |

### 5.4 통합 관련

| Method | Path | Input | Output | 비고 |
|--------|------|-------|--------|------|
| POST | /api/calendar/sync | - | SyncResult | Calendar 동기화 |
| POST | /api/email/scan | - | EmailTaskPreview[] | Gmail 스캔 결과 미리보기 |
| POST | /api/email/import | { task_ids: string[] } | Task[] | 선택한 항목 Task 등록 |

### 5.5 기타

| Method | Path | Input | Output | 비고 |
|--------|------|-------|--------|------|
| GET | /api/streak | - | Streak | 현재 Streak 정보 |
| POST | /api/reminders/subscribe | { subscription: PushSubscription } | 201 | Push 구독 등록 |

---

## 6. 아키텍처 설계 방향

### 6.1 프로젝트 구조 (Next.js 16 App Router)

```
src/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx          # 인증 필수 레이아웃
│   │   ├── page.tsx            # 메인 대시보드
│   │   ├── focus/
│   │   │   └── page.tsx        # Focus Now 모드
│   │   └── brain-dump/
│   │       └── page.tsx        # Brain Dump 모드
│   ├── api/
│   │   ├── auth/
│   │   │   └── callback/
│   │   │       └── route.ts
│   │   ├── tasks/
│   │   │   ├── route.ts
│   │   │   ├── [id]/
│   │   │   │   ├── route.ts
│   │   │   │   ├── complete/
│   │   │   │   │   └── route.ts
│   │   │   │   └── decompose/
│   │   │   │       └── route.ts
│   │   │   ├── classify/
│   │   │   │   └── route.ts
│   │   │   ├── top3/
│   │   │   │   └── route.ts
│   │   │   └── brain-dump/
│   │   │       └── route.ts
│   │   ├── calendar/
│   │   │   └── sync/
│   │   │       └── route.ts
│   │   ├── email/
│   │   │   ├── scan/
│   │   │   │   └── route.ts
│   │   │   └── import/
│   │   │       └── route.ts
│   │   ├── streak/
│   │   │   └── route.ts
│   │   └── reminders/
│   │       └── subscribe/
│   │           └── route.ts
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/                     # shadcn/ui 컴포넌트
│   ├── task/
│   │   ├── TaskCard.tsx
│   │   ├── TaskForm.tsx
│   │   ├── TaskDetail.tsx
│   │   └── EisenhowerMatrix.tsx
│   ├── dashboard/
│   │   ├── Top3Panel.tsx
│   │   ├── StreakCounter.tsx
│   │   ├── ProgressBar.tsx
│   │   └── EnergyIndicator.tsx
│   ├── focus/
│   │   ├── FocusView.tsx
│   │   └── CountdownTimer.tsx
│   ├── brain-dump/
│   │   └── BrainDumpInput.tsx
│   └── rewards/
│       ├── ConfettiEffect.tsx
│       └── EncouragementMessage.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # 브라우저 Client
│   │   ├── server.ts           # Server Client
│   │   └── middleware.ts       # Auth Middleware
│   ├── ai/
│   │   ├── claude.ts           # Claude API Client
│   │   ├── prompts/
│   │   │   ├── classify.ts     # 분류 Prompt
│   │   │   ├── decompose.ts    # 분해 Prompt
│   │   │   ├── top3.ts         # TOP 3 Prompt
│   │   │   └── email-extract.ts # 이메일 추출 Prompt
│   │   └── types.ts
│   ├── google/
│   │   ├── calendar.ts         # Calendar API Client
│   │   └── gmail.ts            # Gmail API Client
│   ├── utils/
│   │   ├── date.ts
│   │   ├── sanitize.ts         # 민감 정보 마스킹
│   │   └── retry.ts            # 재시도 로직
│   └── types/
│       ├── task.ts
│       ├── user.ts
│       └── api.ts
├── hooks/
│   ├── useTask.ts
│   ├── useRealtime.ts
│   ├── useTimer.ts
│   └── useStreak.ts
└── middleware.ts               # Next.js Middleware (Auth)
```

### 6.2 상태 관리 전략

- **Server State**: Supabase Client + React Server Components (데이터 페칭)
- **Client State**: React `useState` / `useReducer` (UI 상태)
- **Real-time State**: Supabase Realtime 구독 (멀티 디바이스 동기화)
- **Form State**: React 19 `useActionState` (Server Actions)
- **별도 상태 관리 라이브러리 불필요** (Next.js 16 + Supabase로 충분)

### 6.3 AI Prompt 전략

- **System Prompt**: 사용자 역할, 선호도, 이전 분류 패턴을 포함
- **Few-shot Examples**: 각 분면별 대표 Task 예시 포함
- **Structured Output**: JSON 형식으로 분류 결과 반환 강제
- **Token 최적화**: 이메일 본문은 최대 2000자로 제한하여 비용 절감

---

## 7. 리스크 분석 및 대응 전략

### 7.1 기술적 리스크

| 리스크 | 영향도 | 발생 가능성 | 대응 전략 |
|--------|--------|------------|-----------|
| Claude API 비용 초과 | 높음 | 중간 | Task당 API 호출 1회로 제한, 캐싱 적용, Brain Dump 일괄 처리 |
| Google API Rate Limit | 중간 | 낮음 | 동기화 간격 조절, 캐싱, Exponential Backoff |
| Supabase 무료 티어 한계 | 높음 | 중간 | DB 쿼리 최적화, 불필요한 데이터 정리, Pro Plan 전환 준비 |
| AI 분류 정확도 부족 | 중간 | 중간 | 사용자 피드백 기반 Prompt 개선, 수동 분류 Fallback |
| Realtime 연결 불안정 | 낮음 | 중간 | 연결 해제 감지 및 자동 재연결, Optimistic UI |

### 7.2 UX 리스크

| 리스크 | 영향도 | 발생 가능성 | 대응 전략 |
|--------|--------|------------|-----------|
| AI 분류 대기 시간으로 인한 사용자 이탈 | 높음 | 중간 | Optimistic UI, 로딩 스켈레톤, 백그라운드 분류 |
| 과도한 알림으로 인한 ADHD 사용자 스트레스 | 높음 | 중간 | 알림 빈도/시간 커스터마이징, 방해 금지 모드 |
| 복잡한 UI로 인한 인지 과부하 | 높음 | 낮음 | Progressive Disclosure 엄격 적용, 단순한 디자인 |

### 7.3 보안 리스크

| 리스크 | 영향도 | 발생 가능성 | 대응 전략 |
|--------|--------|------------|-----------|
| Google OAuth Token 유출 | 매우 높음 | 낮음 | Server-side 전용 보관, 환경변수 관리, Token 암호화 |
| 이메일 내 민감 정보 AI 전송 | 높음 | 중간 | 전송 전 PII 필터링/마스킹, 최소 필요 데이터만 전송 |
| API Key 노출 | 매우 높음 | 낮음 | 환경변수 관리, .env.local 미포함, Server-side 전용 사용 |

---

## 8. 복잡도 분석 요약

| Module | 복잡도 | Priority | 예상 파일 수 |
|--------|--------|----------|-------------|
| Module 1: Authentication | 중간 | High | 8-10 |
| Module 2: DB Schema | 중간 | High | 6-8 |
| Module 3: Task CRUD + UI | 높음 | High | 15-20 |
| Module 4: Calendar | 높음 | Medium | 6-8 |
| Module 5: Gmail | 높음 | Medium | 8-10 |
| Module 6: AI Integration | 매우 높음 | High | 12-15 |
| Module 7: ADHD UX | 높음 | Medium | 10-12 |
| Module 8: Realtime & Push | 높음 | Low | 6-8 |
| Module 9: PWA & Polish | 중간 | Low | 4-6 |
| **합계** | | | **75-97** |

---

## 9. Milestone 정의

### Primary Goal (1차 목표)

**핵심 기능 동작 확인**

- Module 1: Authentication 완료
- Module 2: Database Schema 완료
- Module 3: Core Task Management 완료
- 결과: 로그인 후 Task CRUD가 가능한 기본 앱

### Secondary Goal (2차 목표)

**AI 통합 및 외부 연동**

- Module 4: Calendar Integration 완료
- Module 5: Gmail Integration 완료
- Module 6: AI Integration 완료
- 결과: AI 분류, Google 연동이 작동하는 핵심 제품

### Tertiary Goal (3차 목표)

**ADHD UX 특화 기능**

- Module 7: ADHD UX Features 완료
- 결과: Focus Mode, Rewards, Timer 등 ADHD 특화 UX가 적용된 제품

### Final Goal (최종 목표)

**실시간 동기화 및 PWA**

- Module 8: Real-time & Notifications 완료
- Module 9: PWA & Polish 완료
- 결과: MVP 완성, 배포 준비 완료

---

## 10. Expert 컨설팅 권장 사항

### expert-backend 컨설팅 권장

- API 설계 및 라우팅 전략
- Supabase RLS 정책 설계
- Claude API Prompt Engineering 최적화
- Google API OAuth Token 관리 아키텍처

### expert-frontend 컨설팅 권장

- Eisenhower Matrix Drag & Drop UI 구현
- ADHD UX 패턴 (Progressive Disclosure, Focus Mode)
- 애니메이션 성능 최적화 (Confetti, Timer)
- PWA 설정 및 오프라인 전략

### expert-security 컨설팅 권장

- Google OAuth Token 보안 관리
- 이메일 민감 정보 필터링 로직
- Supabase RLS 보안 검증
- API Key 관리 및 환경변수 전략
