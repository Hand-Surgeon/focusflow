---
id: SPEC-APP-001
version: "1.0.0"
status: draft
created: "2026-03-12"
updated: "2026-03-12"
author: MoAI
priority: high
tags: [adhd, task-management, ai, eisenhower-matrix, google-integration]
---

# SPEC-APP-001: FocusFlow - ADHD 사용자를 위한 AI 기반 Task 관리 앱

## HISTORY

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 1.0.0 | 2026-03-12 | 최초 작성 | MoAI |

---

## 1. Overview

### 1.1 프로젝트 개요

FocusFlow는 ADHD를 가진 사용자가 Task를 효과적으로 관리할 수 있도록 돕는 AI 기반 웹 애플리케이션이다. Google Calendar와 Gmail과 연동하여 자동으로 Task를 수집하고, Claude API를 활용하여 Eisenhower Matrix(긴급/중요도 4분면)로 자동 분류한다.

### 1.2 핵심 가치

- **인지 부하 최소화**: ADHD 사용자의 overwhelm을 방지하는 Progressive Disclosure UX
- **자동 분류**: AI가 Task의 긴급/중요도를 판단하여 Eisenhower Matrix에 자동 배치
- **통합 수집**: Google Calendar, Gmail에서 Task를 자동으로 추출하여 한 곳에서 관리
- **동기 부여**: Completion reward, streak 시스템으로 지속적인 동기 부여

### 1.3 대상 사용자

- ADHD 진단을 받았거나 집중력 관리에 어려움을 겪는 성인
- Google Workspace를 사용하는 직장인 및 학생
- Task 관리 도구에 쉽게 압도당하는 사용자

### 1.4 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 16 (App Router), shadcn/ui, Tailwind CSS |
| Backend | Next.js API Routes, Server Actions |
| Database | Supabase (PostgreSQL), Row Level Security |
| Auth | Supabase Auth (Google OAuth 2.0) |
| AI | Claude API (Anthropic) |
| Real-time | Supabase Realtime |
| Notifications | Web Push API (Service Workers) |
| Deployment | Vercel (frontend) + Supabase (backend) |
| Mobile | PWA (Progressive Web App) |

---

## 2. Environment

### ENV-001: 운영 환경

- 시스템은 Vercel Edge Network에서 실행되며 전 세계적으로 낮은 지연 시간을 제공한다.
- 데이터베이스는 Supabase 관리형 PostgreSQL에서 운영되며 Row Level Security가 활성화된다.
- 모든 통신은 HTTPS/TLS 1.3 이상으로 암호화되어야 한다.

### ENV-002: 브라우저 호환성

- 시스템은 Chrome 120+, Firefox 120+, Safari 17+, Edge 120+ 환경에서 동작해야 한다.
- PWA로서 모바일 Chrome 및 Safari에서 설치 가능해야 한다.

### ENV-003: 외부 서비스 의존성

- Google OAuth 2.0 API (인증)
- Google Calendar API v3 (캘린더 연동)
- Gmail API v1 (이메일 연동)
- Anthropic Claude API (AI 분류 및 분해)
- Supabase Platform (DB, Auth, Realtime, Storage)

---

## 3. Assumptions

### ASM-001: 사용자 전제 조건

- 사용자는 Google 계정을 보유하고 있다.
- 사용자는 Google Calendar와 Gmail을 활발히 사용하고 있다.
- 사용자는 최신 웹 브라우저를 사용한다.

### ASM-002: 기술 전제 조건

- Supabase 무료 티어로 MVP 운영이 가능하다 (500MB DB, 50K MAU).
- Claude API의 응답 시간은 평균 2초 이내이다.
- Google API의 Rate Limit 내에서 일반 사용자의 사용량을 처리할 수 있다.

### ASM-003: 비즈니스 전제 조건

- MVP는 개인 사용자를 대상으로 하며 팀/협업 기능은 Phase 2 이후에 추가한다.
- 초기 언어 지원은 한국어와 영어이다.
- 무료 서비스로 시작하며 프리미엄 기능은 추후 검토한다.

---

## 4. Requirements

### Module 1: Authentication (Google OAuth)

#### REQ-AUTH-001: Google OAuth 로그인 (Ubiquitous)

시스템은 **항상** Supabase Auth를 통한 Google OAuth 2.0 인증을 유일한 로그인 방법으로 제공해야 한다.

#### REQ-AUTH-002: Session 관리 (Event-Driven)

**WHEN** 사용자가 Google OAuth 로그인에 성공하면 **THEN** 시스템은 Supabase session을 생성하고, 사용자 프로필 정보(이름, 이메일, 프로필 이미지)를 `users` 테이블에 저장해야 한다.

#### REQ-AUTH-003: Token 갱신 (Event-Driven)

**WHEN** Supabase access token이 만료되면 **THEN** 시스템은 refresh token을 사용하여 자동으로 새로운 access token을 발급해야 한다.

#### REQ-AUTH-004: Google API Scope 요청 (Event-Driven)

**WHEN** 사용자가 최초 로그인할 때 **THEN** 시스템은 Google Calendar (read-only)와 Gmail (read-only) scope에 대한 권한을 요청해야 한다.

#### REQ-AUTH-005: 로그아웃 (Event-Driven)

**WHEN** 사용자가 로그아웃을 요청하면 **THEN** 시스템은 Supabase session을 종료하고, 로컬에 저장된 모든 인증 정보를 삭제하고, 로그인 페이지로 redirect해야 한다.

#### REQ-AUTH-006: 미인증 접근 차단 (Unwanted Behavior)

시스템은 인증되지 않은 사용자가 대시보드, Task 관리, 설정 등 보호된 페이지에 접근**하지 않아야 한다**. 미인증 접근 시도 시 로그인 페이지로 redirect한다.

#### REQ-AUTH-007: Row Level Security (Ubiquitous)

시스템은 **항상** Supabase Row Level Security 정책을 통해 사용자가 자신의 데이터에만 접근할 수 있도록 보장해야 한다.

---

### Module 2: Calendar Integration

#### REQ-CAL-001: Google Calendar 동기화 (Event-Driven)

**WHEN** 사용자가 대시보드에 접속하면 **THEN** 시스템은 Google Calendar API를 호출하여 향후 7일간의 이벤트를 가져와야 한다.

#### REQ-CAL-002: 이벤트에서 Task 추출 (Event-Driven)

**WHEN** Calendar 이벤트가 수집되면 **THEN** 시스템은 이벤트 제목, 설명, 시작/종료 시간, 반복 여부를 분석하여 Task로 변환해야 한다.

#### REQ-CAL-003: 중복 방지 (Ubiquitous)

시스템은 **항상** Google Calendar event ID를 기준으로 중복 Task 생성을 방지해야 한다. 이미 존재하는 이벤트는 업데이트만 수행한다.

#### REQ-CAL-004: 주기적 동기화 (State-Driven)

**IF** 사용자가 앱을 활성 상태로 사용 중이면 **THEN** 시스템은 30분마다 Google Calendar과 자동으로 동기화해야 한다.

#### REQ-CAL-005: 수동 동기화 (Event-Driven)

**WHEN** 사용자가 "지금 동기화" 버튼을 누르면 **THEN** 시스템은 즉시 Google Calendar 동기화를 실행하고 결과를 표시해야 한다.

#### REQ-CAL-006: 동기화 실패 처리 (Unwanted Behavior)

**IF** Google Calendar API 호출이 실패하면 **THEN** 시스템은 사용자에게 "캘린더 동기화에 실패했습니다. 잠시 후 다시 시도해주세요." 메시지를 표시하고, 마지막 성공한 동기화 데이터를 유지해야 한다.

---

### Module 3: Gmail Integration

#### REQ-MAIL-001: Gmail 스캔 (Event-Driven)

**WHEN** 사용자가 "이메일에서 Task 가져오기" 기능을 활성화하면 **THEN** 시스템은 최근 3일간의 수신 이메일을 스캔하여 action item을 추출해야 한다.

#### REQ-MAIL-002: AI 기반 Action Item 추출 (Event-Driven)

**WHEN** 이메일이 수집되면 **THEN** 시스템은 Claude API를 사용하여 이메일 본문에서 해야 할 일(action item)을 식별하고, Task로 변환해야 한다.

#### REQ-MAIL-003: 이메일 출처 추적 (Ubiquitous)

시스템은 **항상** 이메일에서 추출된 Task에 원본 이메일의 발신자, 제목, 날짜 정보를 메타데이터로 저장해야 한다.

#### REQ-MAIL-004: 민감 정보 필터링 (Ubiquitous)

시스템은 **항상** 이메일 본문에서 개인정보(주민등록번호, 카드번호, 비밀번호 등)를 감지하고 AI 분석 요청에서 제외해야 한다.

#### REQ-MAIL-005: Gmail 스캔 빈도 제한 (Unwanted Behavior)

시스템은 사용자당 1시간에 1회 이상의 Gmail 전체 스캔을 수행**하지 않아야 한다**. Rate limit 초과 시 남은 대기 시간을 표시한다.

#### REQ-MAIL-006: 사용자 확인 (Event-Driven)

**WHEN** AI가 이메일에서 Task를 추출하면 **THEN** 시스템은 추출된 Task 목록을 사용자에게 미리보기로 보여주고, 사용자가 선택한 항목만 Task로 등록해야 한다.

---

### Module 4: AI Task Classification (Eisenhower Matrix)

#### REQ-AI-001: Eisenhower Matrix 자동 분류 (Event-Driven)

**WHEN** 새로운 Task가 생성되면 **THEN** 시스템은 Claude API를 사용하여 Task를 Eisenhower Matrix의 4분면 중 하나로 자동 분류해야 한다:
- **Q1 (긴급+중요)**: Do Now - 빨간색
- **Q2 (중요, 비긴급)**: Schedule - 파란색
- **Q3 (긴급, 비중요)**: Delegate - 노란색
- **Q4 (비긴급, 비중요)**: Eliminate - 회색

#### REQ-AI-002: 분류 근거 제공 (Event-Driven)

**WHEN** AI가 Task를 분류하면 **THEN** 시스템은 해당 분류의 이유를 한 문장으로 제공하고, 사용자가 분류 결과를 수정할 수 있도록 해야 한다.

#### REQ-AI-003: Task 분해 (Event-Driven)

**WHEN** 사용자가 Task의 "분해하기" 버튼을 누르면 **THEN** 시스템은 Claude API를 사용하여 해당 Task를 3~7개의 작은 하위 Task로 분해하고, 각 하위 Task에 예상 소요 시간과 에너지 비용을 표시해야 한다.

#### REQ-AI-004: Today's TOP 3 선정 (Event-Driven)

**WHEN** 사용자가 대시보드에 접속하거나 "오늘의 TOP 3" 버튼을 누르면 **THEN** 시스템은 Claude API를 사용하여 오늘 해야 할 가장 중요한 3개의 Task를 선정하고 이유를 설명해야 한다.

#### REQ-AI-005: Brain Dump 모드 (Event-Driven)

**WHEN** 사용자가 "Brain Dump" 모드를 활성화하면 **THEN** 시스템은 분류 없이 빠른 텍스트 입력 인터페이스를 제공하고, 입력이 완료되면 Claude API로 일괄 분류를 수행해야 한다.

#### REQ-AI-006: AI API 실패 시 Fallback (Unwanted Behavior)

**IF** Claude API 호출이 실패하면 **THEN** 시스템은 Task를 "미분류" 상태로 저장하고, 사용자에게 수동 분류 옵션을 제공하며, 백그라운드에서 재시도(최대 3회, 지수적 backoff)해야 한다.

#### REQ-AI-007: AI 컨텍스트 최적화 (Ubiquitous)

시스템은 **항상** Claude API 호출 시 사용자의 이전 분류 패턴, 수정 이력, 직업/역할 정보를 컨텍스트로 포함하여 분류 정확도를 향상시켜야 한다.

---

### Module 5: Task Management & ADHD UX

#### REQ-TASK-001: CRUD 기본 기능 (Ubiquitous)

시스템은 **항상** Task에 대해 생성(Create), 조회(Read), 수정(Update), 삭제(Delete) 기능을 제공해야 한다. 각 Task는 제목, 설명, 마감일, 분류(Q1-Q4), 에너지 비용, 상태를 포함한다.

#### REQ-TASK-002: Complete-to-Trash Flow (Event-Driven)

**WHEN** 사용자가 Task를 완료 표시하면 **THEN** 시스템은 만족스러운 confetti 애니메이션을 표시하고, 해당 Task를 "Done" pile로 이동하며, streak 카운터를 업데이트해야 한다.

#### REQ-TASK-003: Focus Now 모드 (Event-Driven)

**WHEN** 사용자가 "Focus Now" 버튼을 누르면 **THEN** 시스템은 Q1에서 가장 중요한 단일 Task만 전체 화면으로 표시하고, 다른 모든 UI 요소를 숨겨야 한다.

#### REQ-TASK-004: Progressive Disclosure (State-Driven)

**IF** 사용자의 대시보드에 5개 이상의 Task가 있으면 **THEN** 시스템은 한 번에 3~5개의 Task만 표시하고, 나머지는 "더 보기" 버튼 아래에 숨겨야 한다.

#### REQ-TASK-005: Smart Reminders (Event-Driven)

**WHEN** Task의 마감일이 설정되어 있으면 **THEN** 시스템은 체인 알람(마감 1시간 전, 30분 전, 10분 전, 5분 전)을 Web Push로 전송해야 한다.

#### REQ-TASK-006: Visual Countdown Timer (State-Driven)

**IF** 사용자가 Task에 대해 타이머를 시작하면 **THEN** 시스템은 원형 또는 바 형태의 시각적 카운트다운 타이머를 표시하여 시간 맹시(time blindness)를 보완해야 한다.

#### REQ-TASK-007: Energy Cost Indicator (Ubiquitous)

시스템은 **항상** 각 Task에 에너지 비용 지표를 배터리 아이콘으로 표시해야 한다 (1~5단계). AI가 초기 값을 제안하며 사용자가 수정할 수 있다.

#### REQ-TASK-008: Completion Rewards (Event-Driven)

**WHEN** 사용자가 Task를 완료하면 **THEN** 시스템은 다음을 제공해야 한다:
- Confetti 애니메이션 (Task 완료 즉시)
- Streak 카운터 업데이트 (연속 완료 일수)
- Progress bar 업데이트 (오늘의 완료율)
- 격려 메시지 (3개 Task 완료마다)

#### REQ-TASK-009: Real-time 동기화 (Ubiquitous)

시스템은 **항상** Supabase Realtime을 사용하여 여러 디바이스 간 Task 상태를 실시간으로 동기화해야 한다.

#### REQ-TASK-010: Drag & Drop 재분류 (Event-Driven)

**WHEN** 사용자가 Task를 다른 Eisenhower Matrix 분면으로 drag & drop하면 **THEN** 시스템은 해당 Task의 분류를 즉시 업데이트하고 데이터베이스에 저장해야 한다.

#### REQ-TASK-011: Deadline Countdown (State-Driven)

**IF** Task에 마감일이 설정되어 있으면 **THEN** 시스템은 마감까지 남은 시간을 "2시간 32분 남음" 형식으로 실시간 표시해야 한다.

#### REQ-TASK-012: PWA 지원 (Optional)

**가능하면** 시스템은 PWA manifest와 Service Worker를 제공하여 모바일에서 앱 설치 및 오프라인 기본 화면 표시 기능을 제공한다.

---

## 5. Specifications

### SPEC-001: 데이터 모델

#### users 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID (PK) | Supabase Auth user ID |
| email | TEXT | Google 이메일 |
| name | TEXT | 사용자 이름 |
| avatar_url | TEXT | 프로필 이미지 URL |
| role | TEXT | 직업/역할 (AI 컨텍스트용) |
| preferences | JSONB | 사용자 설정 |
| created_at | TIMESTAMPTZ | 생성일시 |
| updated_at | TIMESTAMPTZ | 수정일시 |

#### tasks 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID (PK) | Task 고유 ID |
| user_id | UUID (FK) | 소유자 ID |
| title | TEXT | Task 제목 |
| description | TEXT | Task 상세 설명 |
| quadrant | ENUM | Q1, Q2, Q3, Q4, UNCLASSIFIED |
| status | ENUM | PENDING, IN_PROGRESS, COMPLETED, ARCHIVED |
| energy_cost | INTEGER | 에너지 비용 (1-5) |
| due_date | TIMESTAMPTZ | 마감일 |
| source_type | ENUM | MANUAL, CALENDAR, EMAIL, BRAIN_DUMP |
| source_id | TEXT | 원본 소스 ID (Calendar event ID, Email ID 등) |
| ai_reason | TEXT | AI 분류 이유 |
| parent_task_id | UUID (FK) | 상위 Task ID (분해된 하위 Task용) |
| position | INTEGER | 표시 순서 |
| completed_at | TIMESTAMPTZ | 완료일시 |
| created_at | TIMESTAMPTZ | 생성일시 |
| updated_at | TIMESTAMPTZ | 수정일시 |

#### email_metadata 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID (PK) | 메타데이터 고유 ID |
| task_id | UUID (FK) | 연결된 Task ID |
| sender | TEXT | 이메일 발신자 |
| subject | TEXT | 이메일 제목 |
| received_at | TIMESTAMPTZ | 이메일 수신일시 |

#### streaks 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID (PK) | Streak 고유 ID |
| user_id | UUID (FK) | 소유자 ID |
| current_streak | INTEGER | 현재 연속 일수 |
| longest_streak | INTEGER | 최장 연속 일수 |
| last_completed_date | DATE | 마지막 완료 날짜 |

#### reminders 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID (PK) | Reminder 고유 ID |
| task_id | UUID (FK) | 연결된 Task ID |
| remind_at | TIMESTAMPTZ | 알림 시각 |
| type | ENUM | CHAIN_1H, CHAIN_30M, CHAIN_10M, CHAIN_5M |
| sent | BOOLEAN | 전송 여부 |

### SPEC-002: API Endpoints 개요

| Method | Path | 설명 |
|--------|------|------|
| GET | /api/auth/callback | Google OAuth callback |
| POST | /api/auth/logout | 로그아웃 |
| GET | /api/tasks | Task 목록 조회 (필터, 페이지네이션) |
| POST | /api/tasks | Task 생성 |
| PATCH | /api/tasks/[id] | Task 수정 |
| DELETE | /api/tasks/[id] | Task 삭제 |
| POST | /api/tasks/[id]/complete | Task 완료 처리 |
| POST | /api/tasks/[id]/decompose | AI Task 분해 |
| POST | /api/tasks/classify | AI 일괄 분류 |
| GET | /api/tasks/top3 | Today's TOP 3 조회 |
| POST | /api/tasks/brain-dump | Brain Dump 입력 |
| POST | /api/calendar/sync | Calendar 동기화 |
| POST | /api/email/scan | Gmail 스캔 |
| GET | /api/streak | Streak 정보 조회 |
| POST | /api/reminders/subscribe | Push 구독 등록 |

### SPEC-003: 보안 요구사항

- 모든 API endpoint는 Supabase Auth JWT 검증을 수행해야 한다.
- Google API token은 Supabase 서버 측에서만 사용하며 클라이언트에 노출하지 않는다.
- Claude API key는 서버 환경변수로만 관리하며 클라이언트 코드에 포함하지 않는다.
- 이메일 본문의 민감 정보는 AI 전송 전에 마스킹 처리한다.
- Row Level Security 정책으로 사용자 간 데이터 격리를 보장한다.

---

## 6. Constraints

### CON-001: 성능 제약

- 페이지 초기 로드: 3초 이내 (LCP 기준)
- API 응답 시간: 500ms 이내 (AI 호출 제외)
- AI 분류 응답: 5초 이내
- Realtime 동기화 지연: 1초 이내

### CON-002: 외부 API 제약

- Google Calendar API: 일일 1,000,000 requests (충분)
- Gmail API: 일일 1,000,000,000 quota units (충분)
- Claude API: 요청당 비용 발생, 불필요한 호출 최소화 필요
- Supabase 무료 티어: 500MB DB, 2GB bandwidth, 50K MAU

### CON-003: 접근성 제약

- WCAG 2.1 AA 수준 준수
- 키보드 내비게이션 완전 지원
- 스크린 리더 호환성 보장
- 최소 색상 대비 비율 4.5:1 준수

---

## 7. Traceability

| SPEC 항목 | 관련 요구사항 | 검증 방법 |
|-----------|--------------|-----------|
| Module 1 | REQ-AUTH-001 ~ REQ-AUTH-007 | acceptance.md AC-AUTH 시나리오 |
| Module 2 | REQ-CAL-001 ~ REQ-CAL-006 | acceptance.md AC-CAL 시나리오 |
| Module 3 | REQ-MAIL-001 ~ REQ-MAIL-006 | acceptance.md AC-MAIL 시나리오 |
| Module 4 | REQ-AI-001 ~ REQ-AI-007 | acceptance.md AC-AI 시나리오 |
| Module 5 | REQ-TASK-001 ~ REQ-TASK-012 | acceptance.md AC-TASK 시나리오 |
