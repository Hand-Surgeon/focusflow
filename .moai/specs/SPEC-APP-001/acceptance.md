---
id: SPEC-APP-001
type: acceptance
version: "1.0.0"
status: draft
created: "2026-03-12"
updated: "2026-03-12"
author: MoAI
---

# SPEC-APP-001: FocusFlow 인수 테스트 기준

## 1. Module 1: Authentication (Google OAuth)

### AC-AUTH-001: Google OAuth 로그인 성공

```gherkin
Given 사용자가 로그인 페이지에 있다
When "Google로 로그인" 버튼을 클릭한다
Then Google OAuth 동의 화면이 표시된다

Given 사용자가 Google OAuth 동의 화면에서 권한을 승인한다
When OAuth callback이 처리된다
Then Supabase session이 생성된다
And 사용자 프로필이 users 테이블에 저장된다
And 대시보드 페이지로 redirect된다
```

### AC-AUTH-002: Google API Scope 동의

```gherkin
Given 사용자가 최초로 Google OAuth 로그인을 시도한다
When Google 동의 화면이 표시된다
Then Google Calendar (read-only) scope가 요청 목록에 포함된다
And Gmail (read-only) scope가 요청 목록에 포함된다
```

### AC-AUTH-003: 미인증 사용자 접근 차단

```gherkin
Given 사용자가 로그인하지 않은 상태이다
When 대시보드 URL "/dashboard"에 직접 접근한다
Then 로그인 페이지 "/login"으로 redirect된다
And 원래 접근하려던 URL이 redirect 파라미터로 보존된다
```

### AC-AUTH-004: Session Token 자동 갱신

```gherkin
Given 사용자가 로그인된 상태이다
And Supabase access token의 만료 시간이 5분 이내이다
When 사용자가 API 요청을 보낸다
Then refresh token으로 새로운 access token이 자동 발급된다
And API 요청이 정상적으로 처리된다
```

### AC-AUTH-005: 로그아웃

```gherkin
Given 사용자가 로그인된 상태이다
When 로그아웃 버튼을 클릭한다
Then Supabase session이 종료된다
And 로컬 스토리지의 인증 정보가 삭제된다
And 로그인 페이지로 redirect된다
```

### AC-AUTH-006: Row Level Security 데이터 격리

```gherkin
Given 사용자 A와 사용자 B가 각각 Task를 생성했다
When 사용자 A가 Task 목록을 조회한다
Then 사용자 A의 Task만 반환된다
And 사용자 B의 Task는 반환되지 않는다
```

---

## 2. Module 2: Calendar Integration

### AC-CAL-001: Google Calendar 이벤트 동기화

```gherkin
Given 사용자가 Google Calendar에 향후 7일간 이벤트 5개를 가지고 있다
When 대시보드에 접속한다
Then Google Calendar API가 호출된다
And 5개의 이벤트가 Task로 변환되어 표시된다
And 각 Task에는 원본 이벤트의 제목, 시작/종료 시간이 포함된다
```

### AC-CAL-002: 중복 이벤트 방지

```gherkin
Given Google Calendar 이벤트 "프로젝트 미팅"이 이미 Task로 동기화되어 있다
When Calendar 동기화가 다시 실행된다
Then 동일한 event ID를 가진 새 Task가 생성되지 않는다
And 기존 Task의 정보(시간 변경 등)만 업데이트된다
```

### AC-CAL-003: 동기화 실패 처리

```gherkin
Given 사용자가 대시보드에 접속한 상태이다
And Google Calendar API가 503 에러를 반환한다
When Calendar 동기화가 실행된다
Then "캘린더 동기화에 실패했습니다. 잠시 후 다시 시도해주세요." 메시지가 표시된다
And 이전에 동기화된 Task 데이터는 유지된다
And 사용자의 수동 Task에는 영향이 없다
```

### AC-CAL-004: 수동 동기화

```gherkin
Given 사용자가 대시보드에 있다
When "지금 동기화" 버튼을 클릭한다
Then 동기화 진행 표시(로딩 스피너)가 나타난다
And Calendar 동기화가 즉시 실행된다
And 새로 가져온 이벤트 수가 결과로 표시된다
```

### AC-CAL-005: 주기적 자동 동기화

```gherkin
Given 사용자가 대시보드를 30분 이상 열어두고 있다
When 마지막 동기화로부터 30분이 경과한다
Then 백그라운드에서 자동 동기화가 실행된다
And 새로운 이벤트가 있으면 Task 목록이 업데이트된다
```

---

## 3. Module 3: Gmail Integration

### AC-MAIL-001: Gmail 이메일 스캔

```gherkin
Given 사용자가 최근 3일간 수신 이메일 10개를 가지고 있다
When "이메일에서 Task 가져오기" 기능을 활성화한다
Then Gmail API가 최근 3일간의 이메일을 조회한다
And Claude API가 각 이메일에서 action item을 분석한다
And 추출된 action item 목록이 미리보기로 표시된다
```

### AC-MAIL-002: 사용자 확인 후 Task 등록

```gherkin
Given AI가 이메일에서 5개의 action item을 추출했다
And 미리보기 화면에 5개 항목이 체크박스와 함께 표시된다
When 사용자가 3개 항목만 선택하고 "Task로 등록" 버튼을 클릭한다
Then 선택된 3개 항목만 Task로 생성된다
And 각 Task에 원본 이메일의 발신자, 제목, 날짜가 메타데이터로 저장된다
And 선택되지 않은 2개 항목은 무시된다
```

### AC-MAIL-003: 민감 정보 필터링

```gherkin
Given 이메일 본문에 주민등록번호 패턴 "123456-1234567"이 포함되어 있다
When AI 분석을 위해 이메일 본문을 처리한다
Then 주민등록번호가 "***-***" 형태로 마스킹된다
And 마스킹된 본문만 Claude API로 전송된다
And 원본 민감 정보는 서버 메모리에서 즉시 삭제된다
```

### AC-MAIL-004: Gmail 스캔 빈도 제한

```gherkin
Given 사용자가 10분 전에 Gmail 스캔을 수행했다
When 다시 Gmail 스캔을 요청한다
Then "다음 스캔까지 50분 남았습니다" 메시지가 표시된다
And Gmail API 호출이 실행되지 않는다
```

### AC-MAIL-005: 이메일 출처 추적

```gherkin
Given 이메일에서 추출된 Task "보고서 제출"이 존재한다
When 해당 Task의 상세 정보를 조회한다
Then 원본 이메일 정보가 표시된다:
  | 필드 | 값 |
  | 발신자 | manager@company.com |
  | 제목 | Re: 월간 보고서 제출 요청 |
  | 수신일 | 2026-03-10 14:30 |
And "이메일" 소스 배지가 Task 카드에 표시된다
```

---

## 4. Module 4: AI Task Classification (Eisenhower Matrix)

### AC-AI-001: 자동 Eisenhower 분류

```gherkin
Given 사용자가 "내일까지 프레젠테이션 자료 준비"라는 Task를 생성한다
When Task가 저장된다
Then Claude API가 호출되어 Eisenhower Matrix 분류를 수행한다
And Task가 Q1 (긴급+중요) 분면에 빨간색으로 배치된다
And 분류 이유가 "마감이 임박하고 업무 성과에 직접적인 영향" 형태로 표시된다
```

### AC-AI-002: 사용자 분류 수정

```gherkin
Given AI가 Task를 Q1 (긴급+중요)로 분류했다
When 사용자가 해당 Task를 Q2 (중요, 비긴급)로 drag & drop한다
Then Task의 quadrant이 Q2로 업데이트된다
And 데이터베이스에 변경 사항이 즉시 저장된다
And AI 분류 이유가 "사용자에 의해 수정됨"으로 업데이트된다
```

### AC-AI-003: Task 분해

```gherkin
Given "웹사이트 리뉴얼 프로젝트"라는 복잡한 Task가 존재한다
When 사용자가 "분해하기" 버튼을 클릭한다
Then Claude API가 호출되어 3~7개의 하위 Task가 생성된다
And 각 하위 Task에 예상 소요 시간이 표시된다
And 각 하위 Task에 에너지 비용(1~5)이 AI에 의해 제안된다
And 하위 Task들이 parent_task_id로 원본 Task에 연결된다
```

### AC-AI-004: Today's TOP 3

```gherkin
Given 사용자에게 다양한 분면에 총 15개의 Task가 있다
When 대시보드에 접속하거나 "오늘의 TOP 3" 버튼을 클릭한다
Then Claude API가 사용자의 Task 목록을 분석한다
And 가장 중요한 3개 Task가 선정된다
And 각 Task에 대해 선정 이유가 한 문장으로 표시된다
And TOP 3 패널이 대시보드 상단에 강조 표시된다
```

### AC-AI-005: Brain Dump 모드

```gherkin
Given 사용자가 Brain Dump 모드를 활성화한다
When 텍스트 입력 영역에 다음을 입력한다:
  """
  장보기 가야 함
  세금 신고 마감 3월 31일
  운동 다시 시작하기
  프로젝트 중간 발표 준비
  """
And "정리하기" 버튼을 클릭한다
Then 각 줄이 개별 Task로 분리된다
And Claude API가 각 Task를 Eisenhower Matrix로 분류한다
And 분류 결과가 미리보기로 표시된다
And 사용자가 "확인"을 누르면 모든 Task가 생성된다
```

### AC-AI-006: AI API 실패 시 Fallback

```gherkin
Given Claude API가 일시적으로 응답하지 않는다 (timeout)
When 사용자가 새 Task "보고서 작성"을 생성한다
Then Task가 "미분류(UNCLASSIFIED)" 상태로 저장된다
And "AI 분류가 일시적으로 불가합니다. 수동으로 분류해주세요." 메시지가 표시된다
And 사용자에게 Q1~Q4 수동 선택 옵션이 제공된다
And 백그라운드에서 최대 3회 재시도(지수적 backoff)가 수행된다
```

### AC-AI-007: AI 컨텍스트 기반 분류 향상

```gherkin
Given 사용자가 이전에 "회의" 관련 Task를 3번 Q3으로 수정한 이력이 있다
When 새로운 "팀 회의 참석" Task가 생성된다
Then Claude API 호출 시 사용자의 분류 수정 이력이 컨텍스트로 포함된다
And AI가 사용자의 패턴을 학습하여 Q3으로 분류할 확률이 높아진다
```

---

## 5. Module 5: Task Management & ADHD UX

### AC-TASK-001: Task CRUD

```gherkin
Given 사용자가 로그인된 상태이다
When Task 생성 버튼을 클릭하고 다음을 입력한다:
  | 필드 | 값 |
  | 제목 | 주간 보고서 작성 |
  | 설명 | 이번 주 성과 정리 |
  | 마감일 | 2026-03-15 |
  | 에너지 비용 | 3 |
And "저장" 버튼을 클릭한다
Then Task가 데이터베이스에 저장된다
And AI 자동 분류가 실행된다
And Task가 Eisenhower Matrix의 해당 분면에 표시된다
```

### AC-TASK-002: Task 수정

```gherkin
Given "주간 보고서 작성" Task가 존재한다
When 사용자가 해당 Task를 클릭하여 상세 보기를 열고
And 제목을 "월간 보고서 작성"으로 변경한다
And "저장" 버튼을 클릭한다
Then Task 제목이 "월간 보고서 작성"으로 업데이트된다
And updated_at 타임스탬프가 갱신된다
```

### AC-TASK-003: Task 삭제

```gherkin
Given "불필요한 Task" Task가 존재한다
When 사용자가 삭제 버튼을 클릭한다
And 확인 대화상자에서 "삭제"를 선택한다
Then Task가 목록에서 사라진다
And 데이터베이스에서 soft delete 처리된다
```

### AC-TASK-004: Complete-to-Trash Flow

```gherkin
Given 사용자에게 "발표 준비" Task가 있다
When 사용자가 체크박스를 클릭하여 Task를 완료 표시한다
Then confetti 애니메이션이 재생된다 (최소 1초 지속)
And Task가 "Done" pile로 이동한다
And streak 카운터가 1 증가한다
And 오늘의 progress bar가 업데이트된다
```

### AC-TASK-005: Focus Now 모드

```gherkin
Given 사용자에게 Q1에 3개의 Task가 있다
When "Focus Now" 버튼을 클릭한다
Then 화면이 전체 화면 모드로 전환된다
And Q1에서 가장 중요한 단일 Task만 표시된다
And 네비게이션, 사이드바 등 다른 UI 요소가 숨겨진다
And "Focus 종료" 버튼만 표시된다
```

### AC-TASK-006: Progressive Disclosure

```gherkin
Given 사용자의 Q1 분면에 8개의 Task가 있다
When 대시보드에 접속한다
Then Q1 분면에 상위 3개의 Task만 표시된다
And "5개 더 보기" 버튼이 하단에 표시된다
When "5개 더 보기" 버튼을 클릭한다
Then 나머지 5개 Task가 추가로 표시된다
```

### AC-TASK-007: Smart Reminders (Chain Alarm)

```gherkin
Given Task "프레젠테이션"의 마감일이 2026-03-15 14:00으로 설정되어 있다
And 사용자가 Push 알림 구독을 완료했다
When 현재 시각이 2026-03-15 13:00이 된다
Then "프레젠테이션 마감 1시간 전입니다" Push 알림이 전송된다

When 현재 시각이 2026-03-15 13:30이 된다
Then "프레젠테이션 마감 30분 전입니다" Push 알림이 전송된다

When 현재 시각이 2026-03-15 13:50이 된다
Then "프레젠테이션 마감 10분 전입니다" Push 알림이 전송된다

When 현재 시각이 2026-03-15 13:55이 된다
Then "프레젠테이션 마감 5분 전입니다" Push 알림이 전송된다
```

### AC-TASK-008: Visual Countdown Timer

```gherkin
Given 사용자가 "보고서 작성" Task의 타이머를 25분으로 설정한다
When "시작" 버튼을 클릭한다
Then 원형 타이머가 25:00에서 카운트다운을 시작한다
And 시각적으로 남은 시간이 줄어드는 것이 표시된다
When 5분이 경과한다
Then 타이머에 20:00이 표시된다
And 원형 그래프가 80% 남은 상태를 표시한다
```

### AC-TASK-009: Energy Cost Indicator

```gherkin
Given Task "대청소"의 에너지 비용이 5로 설정되어 있다
When 대시보드에서 해당 Task 카드를 확인한다
Then 5개의 배터리 아이콘이 모두 채워진 상태로 표시된다

Given Task "이메일 확인"의 에너지 비용이 1로 설정되어 있다
When 대시보드에서 해당 Task 카드를 확인한다
Then 1개의 배터리 아이콘만 채워진 상태로 표시된다
```

### AC-TASK-010: Completion Rewards

```gherkin
Given 사용자가 오늘 2개의 Task를 완료한 상태이다
And streak 카운터가 "3일 연속"을 표시하고 있다
When 3번째 Task를 완료한다
Then confetti 애니메이션이 재생된다
And streak 카운터가 "3일 연속" 상태를 유지한다
And 격려 메시지 "3개 Task를 완료했어요! 대단해요!" 가 표시된다
And progress bar가 업데이트된다
```

### AC-TASK-011: Drag & Drop 재분류

```gherkin
Given Task "보고서 작성"이 Q2 (중요, 비긴급) 분면에 있다
When 사용자가 해당 Task를 Q1 (긴급+중요) 분면으로 drag & drop한다
Then Task의 quadrant이 Q1으로 변경된다
And Task 카드의 색상이 파란색에서 빨간색으로 변경된다
And 변경 사항이 데이터베이스에 즉시 저장된다
```

### AC-TASK-012: Deadline Countdown

```gherkin
Given Task "발표 준비"의 마감일이 현재로부터 2시간 32분 후이다
When 대시보드에서 해당 Task 카드를 확인한다
Then "2시간 32분 남음" 텍스트가 실시간으로 표시된다
And 1분마다 카운트다운이 업데이트된다

Given Task "발표 준비"의 마감일이 이미 지났다
When 대시보드에서 해당 Task 카드를 확인한다
Then "마감 경과" 텍스트가 빨간색으로 강조 표시된다
```

### AC-TASK-013: Realtime 동기화

```gherkin
Given 사용자가 데스크톱과 모바일 두 디바이스에서 앱을 열고 있다
When 데스크톱에서 Task "장보기"를 완료 표시한다
Then 1초 이내에 모바일에서도 해당 Task가 완료 상태로 표시된다
And streak 정보가 두 디바이스 모두에서 동일하게 표시된다
```

---

## 6. Edge Case 테스트 시나리오

### EC-001: 빈 Task 목록

```gherkin
Given 신규 사용자가 최초 로그인한다
And 생성된 Task가 없다
When 대시보드에 접속한다
Then "아직 Task가 없습니다" 안내 메시지가 표시된다
And "첫 Task 만들기" 또는 "Brain Dump 시작하기" 가이드 버튼이 표시된다
And Eisenhower Matrix는 빈 상태로 4분면 레이블만 표시된다
```

### EC-002: 동시 편집 충돌

```gherkin
Given 사용자가 디바이스 A와 디바이스 B에서 동일한 Task를 편집 중이다
When 디바이스 A에서 제목을 "보고서 A"로 변경하고 저장한다
And 디바이스 B에서 제목을 "보고서 B"로 변경하고 저장한다
Then 마지막으로 저장된 값("보고서 B")이 적용된다
And 두 디바이스 모두 Realtime으로 최종 상태를 반영한다
```

### EC-003: Google API 권한 취소

```gherkin
Given 사용자가 Google 계정 설정에서 앱의 Calendar/Gmail 권한을 취소한다
When 앱에서 Calendar 동기화를 시도한다
Then 401 Unauthorized 에러가 감지된다
And "Google 연동이 해제되었습니다. 다시 연결해주세요." 메시지가 표시된다
And 재연결 버튼이 제공된다
```

### EC-004: 매우 긴 Task 제목

```gherkin
Given 사용자가 500자 이상의 Task 제목을 입력한다
When "저장" 버튼을 클릭한다
Then "제목은 200자 이내로 입력해주세요" 유효성 검증 에러가 표시된다
And Task가 저장되지 않는다
```

### EC-005: 네트워크 끊김 상태

```gherkin
Given 사용자가 앱을 사용 중이다
When 네트워크 연결이 끊긴다
Then "오프라인 상태입니다" 배너가 화면 상단에 표시된다
And 이전에 로드된 Task 목록은 계속 표시된다
And Task 생성/수정 시도 시 "네트워크 연결을 확인해주세요" 메시지가 표시된다

When 네트워크가 복구된다
Then "온라인 상태로 복구되었습니다" 알림이 표시된다
And 데이터가 자동으로 새로고침된다
```

### EC-006: 대량 Brain Dump

```gherkin
Given 사용자가 Brain Dump 모드에서 50줄 이상의 텍스트를 입력한다
When "정리하기" 버튼을 클릭한다
Then 처리 진행률이 표시된다
And 최대 30개까지만 Task로 변환된다
And "최대 30개 Task까지 한 번에 처리할 수 있습니다" 안내가 표시된다
```

### EC-007: 마감일이 이미 지난 Task 생성

```gherkin
Given 사용자가 Task를 생성하면서 마감일을 어제 날짜로 설정한다
When "저장" 버튼을 클릭한다
Then "마감일이 이미 지났습니다. 그래도 저장하시겠습니까?" 확인 대화상자가 표시된다
And 사용자가 확인하면 Task가 저장되고 "마감 경과" 상태로 표시된다
```

---

## 7. 성능 기준

### PERF-001: 페이지 로드 성능

| 메트릭 | 목표값 | 측정 방법 |
|--------|--------|-----------|
| LCP (Largest Contentful Paint) | < 3.0초 | Lighthouse |
| FID (First Input Delay) | < 100ms | Lighthouse |
| CLS (Cumulative Layout Shift) | < 0.1 | Lighthouse |
| TTI (Time to Interactive) | < 4.0초 | Lighthouse |
| Lighthouse Performance Score | > 90 | Lighthouse |

### PERF-002: API 응답 시간

| API | 목표값 | 조건 |
|-----|--------|------|
| GET /api/tasks | < 300ms | 100개 이하 Task |
| POST /api/tasks | < 500ms | AI 분류 제외 |
| POST /api/tasks (AI 포함) | < 5초 | Claude API 포함 |
| POST /api/tasks/[id]/decompose | < 8초 | Claude API 포함 |
| POST /api/calendar/sync | < 10초 | 30일 이내 이벤트 |
| POST /api/email/scan | < 15초 | 최근 3일 이메일 |
| GET /api/tasks/top3 | < 5초 | Claude API 포함 |

### PERF-003: 실시간 동기화 지연

| 메트릭 | 목표값 |
|--------|--------|
| Supabase Realtime 지연 | < 1초 |
| UI 업데이트 반영 | < 500ms (Realtime 수신 후) |

### PERF-004: 번들 사이즈

| 메트릭 | 목표값 |
|--------|--------|
| 초기 JavaScript 번들 | < 200KB (gzipped) |
| 전체 번들 (lazy loading 포함) | < 500KB (gzipped) |

---

## 8. ADHD UX 검증 기준

### UX-ADHD-001: 인지 과부하 방지

```gherkin
Given 사용자에게 20개의 Task가 있다
When 대시보드에 접속한다
Then 각 분면에 최대 3~5개의 Task만 표시된다
And 화면에 동시에 보이는 총 Task 수가 20개를 초과하지 않는다
And "더 보기" 버튼으로 추가 Task에 접근할 수 있다
```

### UX-ADHD-002: Focus 모드 효과성

```gherkin
Given 사용자가 Focus Now 모드에 진입했다
Then 화면에 정확히 1개의 Task만 표시된다
And 사이드바, 네비게이션, 기타 알림이 모두 숨겨진다
And Task의 제목, 설명, 에너지 비용, 마감일만 표시된다
And "완료", "건너뛰기", "Focus 종료" 3개 액션 버튼만 제공된다
```

### UX-ADHD-003: 즉각적 피드백

```gherkin
Given 사용자가 Task를 완료한다
Then 100ms 이내에 시각적 피드백(체크 애니메이션)이 시작된다
And 500ms 이내에 confetti 애니메이션이 재생된다
And streak 카운터가 즉시 업데이트된다
And 격려 메시지가 애니메이션과 함께 표시된다 (해당 시)
```

### UX-ADHD-004: 시간 맹시 지원

```gherkin
Given Task에 마감일이 설정되어 있다
Then 마감까지 남은 시간이 자연어 형태로 표시된다:
  | 남은 시간 | 표시 형식 |
  | 7일 이상 | "X일 남음" |
  | 1~7일 | "X일 Y시간 남음" |
  | 1일 이내 | "X시간 Y분 남음" (실시간 업데이트) |
  | 경과 | "X시간 경과" (빨간색) |
```

### UX-ADHD-005: Brain Dump 진입 속도

```gherkin
Given 사용자가 어디서든 앱을 사용 중이다
When Brain Dump 모드 진입 버튼 또는 단축키(Ctrl+B)를 누른다
Then 500ms 이내에 전체 화면 텍스트 입력 영역이 표시된다
And 분류, 마감일, 에너지 비용 입력 없이 순수 텍스트 입력만 가능하다
And 즉시 타이핑을 시작할 수 있다 (자동 포커스)
```

---

## 9. Quality Gate 기준 (TRUST 5)

### Tested (테스트)

- [ ] 단위 테스트 커버리지: 85% 이상 (API Routes, lib 유틸리티)
- [ ] 통합 테스트: 각 API endpoint에 대한 최소 3개 테스트 케이스
- [ ] E2E 테스트: 핵심 사용자 흐름 5개 이상 (로그인, Task CRUD, AI 분류, Brain Dump, Focus Mode)
- [ ] 에러 시나리오 테스트: AI API 실패, 네트워크 끊김, API Rate Limit 케이스

### Readable (가독성)

- [ ] 모든 컴포넌트와 함수에 JSDoc 또는 TSDoc 주석
- [ ] 명확한 변수/함수 네이밍 (예: `classifyTaskWithEisenhower`, `extractActionItemsFromEmail`)
- [ ] 파일당 300줄 이내, 함수당 50줄 이내 권장
- [ ] AI Prompt는 별도 파일로 분리 (`lib/ai/prompts/`)

### Unified (일관성)

- [ ] ESLint 설정 적용 (Next.js 권장 + 추가 규칙)
- [ ] Prettier 포맷팅 적용 (tailwind plugin 포함)
- [ ] shadcn/ui 컴포넌트 사용 시 프로젝트 디자인 시스템 준수
- [ ] API Response 형식 통일 (`{ data, error, meta }` 패턴)

### Secured (보안)

- [ ] Supabase RLS 정책 모든 테이블에 적용 및 테스트
- [ ] Google OAuth Token 서버 측 전용 관리
- [ ] Claude API Key 환경변수로만 접근
- [ ] 이메일 민감 정보 필터링 로직 동작 검증
- [ ] XSS 방지: 사용자 입력 sanitization
- [ ] CSRF 보호: Next.js Server Actions 기본 보호 활용

### Trackable (추적성)

- [ ] Conventional Commits 형식 준수
- [ ] 각 기능 구현 시 SPEC-APP-001 태그 참조
- [ ] PR 단위로 Module별 구현 분리
- [ ] CHANGELOG.md 업데이트

---

## 10. Definition of Done

SPEC-APP-001 MVP는 다음 조건을 모두 충족할 때 완료로 간주한다:

1. **기능 완성**: spec.md의 모든 REQ 항목이 구현되었다
2. **인수 테스트 통과**: 이 문서의 모든 AC 시나리오가 통과되었다
3. **성능 충족**: PERF-001 ~ PERF-004의 모든 메트릭을 충족한다
4. **ADHD UX 검증**: UX-ADHD-001 ~ UX-ADHD-005 기준을 통과한다
5. **TRUST 5 준수**: Quality Gate의 모든 항목이 체크되었다
6. **배포 준비**: Vercel Preview 환경에서 정상 동작을 확인했다
7. **문서화**: API 문서와 사용자 가이드가 작성되었다
