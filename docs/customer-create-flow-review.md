# 고객 추가 플로우 UX 리뷰 및 개선 계획

> 작성일: 2026-05-03  
> 목적: 고객 추가 플로우 개선 작업을 위한 참조 문서  
> 상태: 리뷰 완료 / 구현 진행 완료(정책 결정 잔여)  
> 주의: 이 문서를 새 Copilot Chat 세션에서 읽고 개선 작업을 이어갈 수 있습니다.

---

## 1. 고객 추가 플로우 개요

이 앱은 B2B 영업 로드맵 SaaS로, 고객을 등록하면 **솔루션 템플릿에서 마일스톤을 자동 생성**하는 구조입니다.  
고객 추가는 단순 CRUD가 아니라, 적합한 솔루션 선택 → 일정 계산 → 담당자 지정이 한 플로우에 묶여 있습니다.

- **진입점**: `/customers` (고객 관리 목록 페이지)
- **등록 페이지**: `/customers/new`
- **등록 후 이동**: `/customers/{id}` (고객 상세 페이지)
- **상태 저장 방식**: Zustand store (`useAppStore`) + `localStorage` persist (클라이언트 사이드)

---

## 2. 현재 사용자 흐름

```
[고객 관리 /customers]
  ↓ "고객 등록" 버튼 클릭 → router.push('/customers/new')
[고객 등록 /customers/new]
  ↓ 고객사명 입력 (Text Input)
  ↓ 솔루션 선택 (Select 드롭다운)
  ↓ 영업 시작일 선택 (Calendar Popover)
  ↓ 담당자 선택 (EntraPicker 다이얼로그)
  ↓ 마일스톤 미리보기 (우측 카드, 자동 갱신)
  ↓ "등록하기" 버튼 클릭
[고객 상세 /customers/{id}]
  ↓ 마일스톤 목록 확인
  ↓ "수정" 버튼 → 편집 모드(isEditing=true)
  ↓ 마일스톤 단계별 상태/날짜/담당자 수정
  ↓ "저장" or "취소"
```

---

## 3. 현재 코드/화면 구조 요약

### 파일 위치

| 역할 | 파일 경로 |
|------|-----------|
| 고객 목록 | `app/customers/page.tsx` |
| 고객 등록 폼 | `app/customers/new/page.tsx` |
| 고객 상세 | `app/customers/[id]/page.tsx` |
| 전역 상태 | `lib/store.ts` (Zustand + persist) |
| 담당자 선택 다이얼로그 | `components/entra-picker.tsx` |
| 사용자 선택 다이얼로그(미사용) | `components/entra-user-select-dialog.tsx` |
| 공통 폼 유틸 | `components/ui/form.tsx` (react-hook-form 기반) |
| 타입 정의 | `lib/types.ts` |

### `app/customers/new/page.tsx` 구조 요약

```
NewCustomerPage()
  상태: useState 수동 관리
    - companyName: string
    - solutionId: string
    - salesStartDate: Date | undefined
    - ownerName: string (이름 문자열만 저장)
    - isOwnerPickerOpen: boolean

  handleSubmit()
    - 필수값 검사: if (!companyName || !solutionId || !salesStartDate || !ownerName) return
    - addCustomer() 호출
    - router.push(customerId ? `/customers/${customerId}` : "/customers")

  isValid = companyName && solutionId && salesStartDate && ownerName
  
  렌더
    ├── 좌측 카드: 고객 정보 폼 (Input, Select, Calendar Popover, EntraPicker)
    └── 우측 카드: 마일스톤 미리보기 (솔루션 + 시작일 선택 시 자동 표시)
```

### `app/customers/[id]/page.tsx` 구조 요약

```
CustomerDetailPage()
  상태: useState 다수
    - isEditing: boolean (URL query ?edit=true 또는 수정 버튼으로 전환)
    - editedStartDate, editedOwner: string
    - editingMilestones: EditableMilestone[]

  handleSaveEdits()
    - updateCustomer() 호출
    - setIsEditing(false)
    - router.push(`/customers/${customer.id}`)

  handleCancelEdits()
    - setIsEditing(false)
    - setEditingMilestones([])   ← 변경사항 경고 없이 즉시 폐기

  마일스톤 상태 변경 (편집 모드 밖에서도 가능)
    - 상태 Select는 isEditing 여부와 무관하게 항상 onValueChange 동작
    - isEditing 아닐 때: updateMilestoneStatus() 즉시 적용
    - isEditing 일 때: updateEditingMilestone() (임시 저장)
```

### `lib/store.ts` 핵심 사항

- `addCustomer()`: 솔루션 ID로 마일스톤 자동 생성, 신규 ID 반환
- 실패 시 (`solution` 없음): `return undefined` — 조용한 실패
- `persist` + `onRehydrateStorage`: 날짜 ISO→Date 역직렬화 처리됨 ✅
- ID 생성: `Math.random().toString(36).substring(2, 15)` — UUID 아님

### `components/entra-picker.tsx` 핵심 사항

- 사용자/그룹 검색+선택 다이얼로그 (검색 필드 있음 ✅)
- onConfirm 시그니처: `(selectedUsers: PickerUser[], groupIds: string[]) => void`
- 하지만 신규 등록 폼에서는: `setOwnerName(selectedUsers[0].displayName)` — **이름 문자열 하나만 사용**, 그룹 선택 결과 무시됨

---

## 4. 발견된 문제점

### 🔴 High — 구조적 결함

#### H-1. 담당자 데이터 모델 불일치
- **위치**: `app/customers/new/page.tsx:44`, `app/customers/new/page.tsx:234-241`
- **문제**: `ownerName` 문자열만 저장됨. EntraPicker는 다중 사용자/그룹 선택을 지원하는데, 폼에서는 `selectedUsers[0].displayName` 하나만 사용함. 그룹 선택 결과, 사용자 ID, 이메일 모두 손실됨.
- **영향**: 향후 알림 발송(`OUTLOOK_SENDER_UPN`) 연동 시 수신자 확인 불가, 담당자 변경 추적 불가

#### H-2. 솔루션 선택 UI가 드롭다운 단일 Select
- **위치**: `app/customers/new/page.tsx:137-148`
- **문제**: 솔루션이 5개 이상으로 늘어나면 드롭다운이 길어져 인지 부담 급증. 솔루션 특성(단계 수, 총 기간, 업종)을 비교하며 선택할 수 없음. 검색/필터 없음.
- **솔루션 표시 포맷**: `{solution.name} · {단계수}단계 · {총기간}일` — 텍스트만 제공, 설명(`description`) 표시 없음

#### H-3. 필수값 검증 방식이 버튼 비활성화만
- **위치**: `app/customers/new/page.tsx:52`, `app/customers/new/page.tsx:231`
- **문제**: 저장 버튼이 비활성화되어도 어느 필드가 누락인지 안내하지 않음. 필드별 오류 메시지, 필수 항목 표기(`*`), 제출 시도 후 포커스 이동이 없음. `react-hook-form`/`zod` 미사용 — 필드 에러 상태(dirty, touched, invalid) 추적 불가.

#### H-4. 입력 이탈 방지 없음
- **위치**: `app/customers/new/page.tsx:226` (취소 버튼 = `router.back()` 즉시 실행)
- **문제**: 입력 도중 취소, 탭 닫기, 브라우저 뒤로가기, 메뉴 내비게이션 시 모든 입력 데이터 손실. `beforeunload`, Next.js 라우트 이탈 감지(`router.events`) 모두 미구현.
- 상세 페이지 편집 취소에도 동일 문제: `handleCancelEdits()` → 경고 없이 `setEditingMilestones([])` 즉시 폐기

### 🟡 Medium — 사용성 저하

#### M-1. 저장 성공/실패 피드백 없음
- **위치**: `app/customers/new/page.tsx:61`
- **문제**: 저장 성공 시 토스트/메시지 없이 즉시 라우팅. `addCustomer()` 반환값이 `undefined`이면 `/customers` 목록으로 이동 — 실패 이유를 사용자가 알 수 없음. 현재 `toast` 컴포넌트(`components/ui/sonner.tsx`, `components/ui/use-toast.ts`) 있으나 미사용.

#### M-2. 저장 중 중복 제출 방지 없음
- **위치**: `app/customers/new/page.tsx:50-62`
- **문제**: `handleSubmit`이 동기 함수, `isSubmitting` 상태 없음. 버튼을 빠르게 연속 클릭하면 중복 등록 가능성 있음.

#### M-3. 상세 페이지 전역 편집 모드의 범위 과다
- **위치**: `app/customers/[id]/page.tsx:174`, `app/customers/[id]/page.tsx:1516-1532`
- **문제**: 수정 버튼 하나로 전체 마일스톤 테이블이 편집 모드로 전환됨. 단일 단계만 수정해도 전체를 저장해야 함. 대량 마일스톤 환경에서 실수 가능성 증가.

#### M-4. `alert()`/`confirm()` 사용
- **위치**: 
  - `app/customers/page.tsx:180` — `alert()` 공유 결과 알림
  - `app/customers/[id]/page.tsx:586` — `confirm()` 단계 삭제 확인
  - `app/customers/[id]/page.tsx:934` — `confirm()` 파일 삭제 확인
  - `app/customers/[id]/page.tsx:738`, `841`, `889`, `927` — `alert()` 오류 메시지
- **문제**: 브라우저 기본 다이얼로그는 스타일 불일치, 스크린리더 혼란, 사용자 경험 저하. `AlertDialog` 컴포넌트(`components/ui/alert-dialog.tsx`)가 이미 있음.

#### M-5. 영업 시작일과 담당자 선택 순서 및 위치
- **위치**: `app/customers/new/page.tsx:151-219`
- **문제**: 솔루션 선택 직후 마일스톤 미리보기가 우측에 보이지만, 영업 시작일을 입력해야 날짜가 계산됨. 즉 솔루션 선택 → 시작일 → 미리보기 순서를 사용자가 직관적으로 파악하기 어려움. 담당자는 폼 마지막에 위치해 솔루션 템플릿의 `role` 정보와 연관성이 낮음.

### 🟢 Low — 개선 가능

#### L-1. 솔루션 없을 때 Empty State 경로만 제공
- **위치**: `app/customers/new/page.tsx:94-114`
- **현재**: "솔루션 관리로 이동" 버튼만 있음. 솔루션 등록 후 돌아올 때 입력 중이던 고객사명 등 손실.

#### L-2. ID 생성 방식이 UUID 미사용
- **위치**: `lib/store.ts:36`
- **현재**: `Math.random().toString(36).substring(2, 15)` — 충돌 가능성은 낮으나 표준 UUID 아님. 향후 DB 연동 시 충돌 위험.

#### L-3. 접근성 경고 (브라우저 콘솔 확인됨)
- **위치**: 브라우저 콘솔 로그 기준
- **문제**: `DialogContent requires a DialogTitle` 경고 다수 발생. `aria-describedby={undefined}` 경고도 다수. 스크린리더 지원 미비.

---

## 5. 개선 목표

1. **폼 안전성**: react-hook-form + zod 도입, 필드별 실시간 검증, dirty 상태 추적
2. **이탈 방지**: 입력 데이터가 있을 때 취소/이탈 시 확인 다이얼로그
3. **피드백 품질**: toast 알림으로 성공/실패 명시, `alert()`/`confirm()` 전면 교체
4. **솔루션 선택 개선**: 드롭다운 → 카드 그리드(검색/필터 포함)
5. **담당자 데이터 정규화**: 이름 문자열 → `ownerId + ownerName + ownerEmail`
6. **상세 페이지 편집 UX**: 인라인 수정 + 변경사항 경고 추가

---

## 6. 화면/기능별 개선 제안

### 6-1. 고객 등록 폼 (`app/customers/new/page.tsx`)

#### 필드 구성 개선
```
현재: 고객사명 → 솔루션(드롭다운) → 영업시작일 → 담당자
개선: 고객사명 → 솔루션(카드 그리드+검색) → 영업시작일 → 담당자 → [마일스톤 미리보기 우측]
```

#### 솔루션 선택 방식 변경
- **현재**: `<Select>` 드롭다운 — 이름+단계수+기간만 표시
- **개선**: `SolutionCardGrid` 컴포넌트 — 카드마다 이름, 설명(`solution.description`), 단계 수, 총 기간, 최근 사용 뱃지 표시
- 카드 수 ≥ 5개 시 검색 바 노출
- 단계 수/기간 기준 정렬 옵션

#### 필수값 표기 및 검증
- 모든 필수 라벨에 `*` 뱃지 추가
- blur 시 즉시 검증 (미입력: "고객사명을 입력해주세요" 등)
- 제출 시도 시 첫 번째 오류 필드로 포커스 이동
- `react-hook-form` + `zod` 스키마 도입:
  ```ts
  // 예시 스키마
  z.object({
    companyName: z.string().min(1, "고객사명을 입력해주세요"),
    solutionId: z.string().min(1, "솔루션을 선택해주세요"),
    salesStartDate: z.date({ required_error: "영업 시작일을 선택해주세요" }),
    ownerId: z.string().min(1, "담당자를 선택해주세요"),
    ownerName: z.string(),
    ownerEmail: z.string().optional(),
  })
  ```

#### 이탈 방지
- `isDirty` 상태 (react-hook-form 자동 제공) 확인
- 취소 버튼: isDirty → `UnsavedChangesDialog` → 폐기/계속 선택
- `useEffect` + `window.addEventListener('beforeunload', ...)` 브라우저 이탈 감지
- Next.js App Router에서는 `router.events` 대신 `useBeforeUnload` 커스텀 훅 필요 (확인 필요)

#### 저장 처리
- handleSubmit 비동기화: `async (data) => { ... }`
- `isSubmitting` 상태로 버튼 로딩 표시 + 중복 클릭 방지
- 성공 시: `toast.success("고객이 등록되었습니다")` + 상세 페이지 이동
- 실패 시: `toast.error("등록에 실패했습니다. 다시 시도해주세요")` + 폼 유지

#### 담당자 데이터 개선
- `ownerName: string` 단일 필드 → `ownerId, ownerName, ownerEmail` 분리
- EntraPicker를 단일 선택 모드로 호출하거나, 단일 선택 전용 `OwnerSinglePicker` 별도 구현
- `lib/types.ts`의 `Customer` 타입 수정 필요
- `lib/store.ts`의 `addCustomer`, `updateCustomer` 파라미터 수정 필요

### 6-2. 고객 상세 페이지 (`app/customers/[id]/page.tsx`)

#### 편집 모드 UX 개선
- 취소 버튼 클릭 시, `editingMilestones`가 원본과 다른 경우 확인 다이얼로그:
  ```
  "저장하지 않은 변경사항이 있습니다. 폐기하시겠습니까?"
  [계속 편집] [변경사항 폐기]
  ```
  - 현재 `AlertDialog` 컴포넌트 있음 → 바로 사용 가능
- 저장 성공 시 `toast.success("변경사항이 저장되었습니다")`

#### alert/confirm 교체 (우선순위 낮음이지만 확인됨)

| 현재 위치 | 현재 방식 | 교체 컴포넌트 |
|-----------|-----------|---------------|
| L.586 단계 삭제 | `confirm()` | `AlertDialog` |
| L.934 파일 삭제 | `confirm()` | `AlertDialog` |
| L.738 파일 다운로드 오류 | `alert()` | `toast.error()` |
| L.841 파일 업로드 오류 | `alert()` | `toast.error()` |
| L.889 폴더 생성 오류 | `alert()` | `toast.error()` |
| L.927 파일 이동 오류 | `alert()` | `toast.error()` |
| `app/customers/page.tsx:180` 공유 완료 | `alert()` | `toast.success()` |

### 6-3. Zustand Store (`lib/store.ts`)

#### addCustomer 오류 처리
- 현재: 솔루션 없으면 `return undefined` (조용한 실패)
- 개선: 명시적 에러 throw 또는 `{ success: false, error: '...' }` 반환
  ```ts
  // 개선 예시
  addCustomer: (customerData) => {
    const solution = get().solutions.find(s => s.id === customerData.solutionId)
    if (!solution) throw new Error('선택한 솔루션을 찾을 수 없습니다')
    // ...
  }
  ```

#### Customer 타입 정규화 (`lib/types.ts` 수정)
```ts
// 현재
ownerName: string

// 개선
ownerId?: string
ownerName: string
ownerEmail?: string
```

---

## 7. 우선순위 작업 목록

### 🔴 High (빠른 시일 내 필수)

| # | 작업 | 파일 | 종류 |
|---|------|------|------|
| H1 | EntraPicker 단일 선택 모드 또는 OwnerSinglePicker 구현 | `components/entra-picker.tsx` 또는 신규 | 코드 |
| H2 | Customer 타입에 ownerId, ownerEmail 필드 추가 | `lib/types.ts`, `lib/store.ts` | 코드 |
| H3 | 신규 고객 폼에 react-hook-form + zod 적용 | `app/customers/new/page.tsx` | 코드 |
| H4 | 필드별 오류 메시지 및 필수 표기 추가 | `app/customers/new/page.tsx` | 코드+UX |
| H5 | 취소/이탈 시 UnsavedChangesDialog 추가 | `app/customers/new/page.tsx` | 코드 |
| H6 | handleSubmit 비동기화 + isSubmitting 처리 | `app/customers/new/page.tsx` | 코드 |
| H7 | 저장 성공/실패 toast 알림 추가 | `app/customers/new/page.tsx` | 코드+UX |
| H8 | addCustomer 조용한 실패 개선 | `lib/store.ts` | 코드 |

### 🟡 Medium

| # | 작업 | 파일 | 종류 |
|---|------|------|------|
| M1 | 솔루션 선택 UI를 카드 그리드로 변경 | `app/customers/new/page.tsx` 또는 신규 `SolutionCardGrid` | 코드+UX |
| M2 | 카드 수 ≥ 5 시 솔루션 검색/필터 바 추가 | `app/customers/new/page.tsx` | 코드 |
| M3 | 상세 페이지 취소 시 변경사항 경고 다이얼로그 | `app/customers/[id]/page.tsx` | 코드 |
| M4 | 상세 페이지 저장 성공 toast 추가 | `app/customers/[id]/page.tsx` | 코드+UX |
| M5 | `alert()` → `toast.error()` 전환 (오류 메시지) | `app/customers/[id]/page.tsx` | 코드+UX |
| M6 | `alert()` → `toast.success()` 전환 (공유 완료) | `app/customers/page.tsx` | 코드+UX |

### 🟢 Low

| # | 작업 | 파일 | 종류 |
|---|------|------|------|
| L1 | `confirm()` → `AlertDialog` 전환 (삭제 확인) | `app/customers/[id]/page.tsx:586,934` | 코드+UX |
| L2 | 접근성: DialogContent에 DialogTitle/aria-describedby 추가 | `app/customers/[id]/page.tsx` (확인 필요) | 코드 |
| L3 | ID 생성을 `crypto.randomUUID()` 등 표준 방식으로 변경 | `lib/store.ts:36` | 코드 |
| L4 | 마일스톤 미리보기에 날짜 범위 강조 표시 추가 | `app/customers/new/page.tsx:261-305` | UX |
| L5 | 솔루션 없을 때 Empty State에서 입력 데이터 임시 보존 | `app/customers/new/page.tsx:94-114` | UX |

---

## 8. 수정 대상 파일/컴포넌트/라우트/API

### 수정 대상

| 파일 | 수정 내용 |
|------|-----------|
| `app/customers/new/page.tsx` | 폼 전체 재구성: react-hook-form, zod, 이탈 방지, toast, 솔루션 카드 UI |
| `app/customers/[id]/page.tsx` | 편집 취소 경고, 저장 toast, alert/confirm 교체 |
| `app/customers/page.tsx` | alert() → toast 교체 |
| `lib/types.ts` | Customer 타입 ownerId/ownerEmail 필드 추가 |
| `lib/store.ts` | addCustomer 오류 처리 개선, Customer 타입 변경 반영 |
| `components/entra-picker.tsx` | 단일 선택 모드 prop 추가 또는 OwnerSinglePicker 분리 |

### 신규 생성 가능 (필요 시)

| 파일 (예정) | 용도 |
|-------------|------|
| `components/solution-card-grid.tsx` | 솔루션 카드 선택 UI |
| `components/owner-single-picker.tsx` | 담당자 단일 선택 전용 (EntraPicker에서 분기) |
| `hooks/use-unsaved-changes.ts` | 이탈 방지 커스텀 훅 |

### 변경 불필요 (현재 구조 유지)

- `components/ui/form.tsx` — 이미 react-hook-form 기반 공통 컴포넌트 준비됨, 그대로 활용
- `components/ui/alert-dialog.tsx` — 이미 있음, 활용만 하면 됨
- `components/ui/sonner.tsx`, `components/ui/use-toast.ts` — 이미 있음, 활용만 하면 됨
- `app/api/milestone-files/route.ts` — 이번 작업 범위 외

---

## 9. 예외 상태 및 검증 항목

### 입력 유효성

- [ ] 고객사명: 공백 trim 후 최소 1자 이상 (공백만 입력 시 오류 표시)
- [ ] 솔루션: 선택 안 했을 때 오류 표시
- [ ] 영업 시작일: 미래 날짜만 허용할지, 과거 날짜도 허용할지 정책 결정 필요
- [ ] 담당자: 선택 안 했을 때 오류 표시; 선택된 사용자가 store에 없는 경우 처리

### 외부 상태 예외

- [ ] 솔루션 목록이 비어 있을 때 → Empty State 화면 표시 (현재 구현됨, 개선 여지 있음)
- [ ] addCustomer 실패 시 (솔루션 ID 불일치) → 오류 메시지 + 폼 유지
- [ ] EntraPicker가 빈 선택으로 닫혔을 때 → 담당자 미선택 상태 유지 (현재 동작 확인됨)
- [ ] 동일 고객사명 중복 등록 → 현재 제한 없음, 정책 결정 필요

### 상세 페이지 편집 예외

- [ ] 편집 모드 중 취소 → 변경사항 폐기 경고 (현재 미구현)
- [ ] 편집 모드 중 마일스톤 status Select 변경 → 현재 즉시 저장(updateMilestoneStatus), 편집 모드에선 임시 저장(updateEditingMilestone) — 동작 일관성 확인 필요
- [ ] 마일스톤 날짜 직접 입력 시 잘못된 날짜 형식 (예: 2999-99-99) 처리
- [ ] 편집 저장 후 router.push 시 새로고침과 데이터 일관성

---

## 10. 구현 순서

> 의존성 순서를 고려한 구현 권장 순서입니다.

```
Phase 1 — 데이터 모델 정리 (다른 모든 작업의 기반)
  1. lib/types.ts: Customer 타입에 ownerId?, ownerEmail? 추가
  2. lib/store.ts: addCustomer/updateCustomer 파라미터 반영, 오류 처리 개선

Phase 2 — 폼 안전성 (신규 등록 화면)
  3. app/customers/new/page.tsx: react-hook-form + zod 스키마 적용
  4. app/customers/new/page.tsx: 필드별 오류 메시지 + 필수 표기 추가
  5. app/customers/new/page.tsx: handleSubmit 비동기화 + isSubmitting 처리
  6. app/customers/new/page.tsx: toast 알림 추가 (성공/실패)
  7. app/customers/new/page.tsx: 이탈 방지 (취소 버튼 + beforeunload)
  8. components/entra-picker.tsx 또는 신규: 단일 담당자 선택 처리

Phase 3 — 상세 페이지 편집 UX
  9. app/customers/[id]/page.tsx: 취소 시 변경사항 경고 다이얼로그
  10. app/customers/[id]/page.tsx: 저장 toast 추가

Phase 4 — 메시지 통일성
  11. app/customers/[id]/page.tsx: alert() → toast.error()
  12. app/customers/page.tsx: alert() → toast.success()
  13. app/customers/[id]/page.tsx: confirm() → AlertDialog (삭제 확인)

Phase 5 — 솔루션 선택 UI 개선 (독립 작업)
  14. app/customers/new/page.tsx: 솔루션 카드 그리드 구현 또는 신규 컴포넌트
```

---

## 11. 테스트 시나리오

### 기능 테스트 (수동)

| # | 시나리오 | 기대 동작 |
|---|----------|-----------|
| T1 | 고객사명만 입력 후 다른 필드 blur | 솔루션, 시작일, 담당자 필드에 오류 표시 |
| T2 | 모든 필드 입력 후 "등록하기" 클릭 | 로딩 → toast.success → 상세 페이지 이동 |
| T3 | 필드 입력 후 "취소" 클릭 | 확인 다이얼로그 → [폐기] 클릭 시 목록으로 이동 |
| T4 | 필드 미입력 상태에서 "취소" 클릭 | 확인 없이 바로 뒤로 이동 (dirty 아님) |
| T5 | 고객사명 입력 후 탭 닫기 시도 | 브라우저 이탈 경고 |
| T6 | 솔루션 선택 후 마일스톤 미리보기 확인 | 솔루션 단계가 우측에 즉시 표시됨 |
| T7 | 영업 시작일 선택 후 마일스톤 날짜 확인 | 각 마일스톤 날짜가 자동 계산됨 |
| T8 | 담당자 선택 후 이름 표시 및 변경 | 아바타+이름 표시, X로 제거, 변경 버튼 동작 |
| T9 | 솔루션 없는 상태에서 /customers/new 접근 | Empty State + 솔루션 관리로 이동 버튼 |
| T10 | 상세 페이지 편집 → 취소 클릭 | 경고 다이얼로그 → [폐기] → 원상복귀 |
| T11 | 상세 페이지 편집 → 저장 클릭 | toast.success → 편집 모드 해제 |
| T12 | 마일스톤 상태 드롭다운 변경 (편집 모드 외) | 즉시 저장, 목록 상태 반영됨 |
| T13 | 비편집 모드에서 상태 변경 후 페이지 새로고침 | 변경 상태가 서버 데이터로 유지됨 |
| T14 | 편집 모드에서 상태 변경 후 [취소] | 저장 전 변경 상태가 폐기되고 원복됨 |
| T15 | 편집 모드에서 상태 변경 후 [저장] | 변경 상태가 일괄 저장되고 유지됨 |
| T16 | 비편집 모드 상태 변경 시 API 실패(네트워크 단절) | 이전 상태로 롤백 + toast.error 표시 |

### 예외 시나리오

| # | 시나리오 | 기대 동작 |
|---|----------|-----------|
| E1 | 고객사명에 공백만 입력 | trim 후 오류 메시지 |
| E2 | 동일 고객사명 중복 등록 시도 | 409 감지 후 경고 다이얼로그 표시, 승인 시 중복 허용 등록 |
| E3 | EntraPicker에서 선택 없이 다이얼로그 닫기 | 담당자 미선택 상태 유지 |
| E4 | 네트워크 오류 상황에서 저장 (Cosmos DB 미연결) | toast.error + 폼 유지 |
| E5 | 영업 시작일을 오늘+180일 초과로 선택 | 필드 검증 에러 표시, 제출 차단 |
| E6 | 잘못된 날짜 값 입력/전달 | 즉시 검증 에러 또는 400 응답 처리 |

---

## 12. 다음 세션에서 사용할 프롬프트

```
docs/customer-create-flow-review.md 파일을 먼저 읽어줘.

이 프로젝트는 Next.js + Zustand 기반 B2B 영업 로드맵 앱이야.
고객 추가 플로우의 UX 리뷰가 완료되어 있고, 구현은 아직 시작하지 않았어.

지금부터 customer-create-flow-review.md의 구현 순서에 따라 개선 작업을 진행해줘.
현재 진행하려는 단계는 [Phase X — 작업명] 이야.

작업 전에 반드시:
1. 수정 대상 파일을 먼저 읽어서 현재 코드 구조 파악
2. 문서에 적힌 라인 번호가 최신인지 확인
3. 아직 코드를 고치지 말고 수정 계획을 먼저 설명해줘
```

> 위 프롬프트에서 `[Phase X — 작업명]` 부분을 현재 진행할 단계로 교체하세요.  
> 예: `Phase 1 — lib/types.ts Customer 타입 수정`

---

## 13. 최종 점검표 (2026-05-25)

아래는 **섹션 10 구현 순서(To-do 1~14)** 기준의 최종 상태입니다.

| ID | 작업 | 상태 | 비고 |
|---|---|---|---|
| 1 | `lib/types.ts` Customer 타입에 `ownerId?`, `ownerEmail?` 추가 | 완료 | 타입 반영됨 |
| 2 | `lib/store.ts` addCustomer/updateCustomer 파라미터 반영, 오류 처리 개선 | 완료 | 입력 정규화/유효성 검증/오류 로그 반영 |
| 3 | `app/customers/new/page.tsx` react-hook-form + zod 스키마 적용 | 완료 | RHF `useForm` + `zodResolver` 전면 적용 |
| 4 | `app/customers/new/page.tsx` 필드별 오류 메시지 + 필수 표기 | 완료 | 필드별 에러 메시지 노출/필수표기 유지 |
| 5 | `app/customers/new/page.tsx` handleSubmit 비동기화 + isSubmitting 처리 | 완료 | RHF `formState.isSubmitting`으로 통합 |
| 6 | `app/customers/new/page.tsx` toast 알림 추가 (성공/실패) | 완료 | 성공/부분실패/실패 toast 반영 |
| 7 | `app/customers/new/page.tsx` 이탈 방지 (취소 버튼 + beforeunload) | 완료 | dirty 상태 기반 이탈 방지 동작 |
| 8 | `components/entra-picker.tsx` 또는 신규: 단일 담당자 선택 처리 | 완료 | 신규 고객 등록 플로우에서 단일 사용자만 반영 |
| 9 | `app/customers/[id]/page.tsx` 취소 시 변경사항 경고 다이얼로그 | 완료 | 경고 다이얼로그 적용 |
| 10 | `app/customers/[id]/page.tsx` 저장 toast 추가 | 완료 | 저장 성공 toast 적용 |
| 11 | `app/customers/[id]/page.tsx` `alert()` → `toast.error()` | 완료 | 사용자 메시지 toast로 통일 |
| 12 | `app/customers/page.tsx` `alert()` → `toast.success()` | 완료 | 공유 성공 메시지 toast 처리 |
| 13 | `app/customers/[id]/page.tsx` `confirm()` → AlertDialog (삭제 확인) | 완료 | 삭제/취소 확인 다이얼로그 패턴 적용 |
| 14 | `app/customers/new/page.tsx` 솔루션 카드 그리드 구현 | 완료 | `SolutionCardGrid` 적용 |

### 잔여 항목 (정책/운영 결정 필요)

- 영업 시작일 정책 확정: 미래일만 허용할지, 과거일도 허용할지
- 동일 고객사명 중복 등록 정책 확정: 허용/경고/차단
- 상세 편집 시 마일스톤 상태 즉시저장과 편집모드 임시저장의 일관성 규칙 명문화
- 잘못된 날짜 형식 입력(예: `2999-99-99`) 처리 규칙 확정

---

## 14. 정책 결정 템플릿 (잔여 4건)

아래 항목은 회의/리뷰 시 바로 체크할 수 있도록 구성했습니다.

### D1. 영업 시작일 허용 범위

| 선택지 | 설명 | 장점 | 리스크 |
|---|---|---|---|
| A. 과거/오늘/미래 모두 허용 | 현재처럼 자유 입력 | 유연성 높음, 과거 계약 데이터 등록 용이 | 잘못된 미래일/과거일 입력 가능 |
| B. 오늘 이후만 허용 | 과거일 차단 | 데이터 정합성 높음 | 기존/과거 영업건 등록이 번거로움 |
| C. 과거 허용 + 미래 상한 제한 | 예: 미래 180일 이내만 허용 | 실무 유연성과 오입력 방지 균형 | 정책 복잡도 증가 |

- 권장안: C
- 구현 포인트: `app/customers/new/page.tsx` Zod 스키마에 날짜 범위 검증 추가
- 결정:
  - [ ] A
  - [ ] B
  - [x] C
  - [ ] 보류

### D2. 동일 고객사명 중복 등록 정책

| 선택지 | 설명 | 장점 | 리스크 |
|---|---|---|---|
| A. 완전 허용 | 현재와 동일 | 운영 유연성 | 중복 데이터 누적 가능 |
| B. 경고 후 허용 | 중복 감지 toast/dialog 후 진행 허용 | 사용자 실수 예방 + 예외 수용 | 중복 탐지 로직 추가 필요 |
| C. 강제 차단 | 동일명 존재 시 저장 불가 | 데이터 품질 향상 | 법인명/지사명 케이스 대응 어려움 |

- 권장안: B
- 구현 포인트: 서버(`app/api/customers/route.ts`)에서 중복 탐지 후 상태코드/메시지 반환
- 결정:
  - [ ] A
  - [x] B
  - [ ] C
  - [ ] 보류

### D3. 상세 편집 시 상태 변경 규칙

| 선택지 | 설명 | 장점 | 리스크 |
|---|---|---|---|
| A. 항상 즉시 저장 | 편집 모드 여부와 무관 | 단순함, 실시간 반영 | 취소 개념 약화 |
| B. 편집 모드에서는 임시 저장, 저장 버튼 시 일괄 반영 | 현재 의도와 유사 | 사용자가 변경 확정 통제 가능 | 구현/테스트 복잡도 상승 |
| C. 전면 즉시 저장 + 변경 이력 제공 | 저장 버튼 제거 가능 | UX 간결 | 감사 로그/되돌리기 설계 필요 |

- 권장안: B
- 구현 포인트: `app/customers/[id]/page.tsx` 상태 변경 핸들러를 모드별로 명시하고 적용 완료
- 결정:
  - [ ] A
  - [x] B
  - [ ] C
  - [ ] 보류

### D4. 잘못된 날짜 형식 처리

| 선택지 | 설명 | 장점 | 리스크 |
|---|---|---|---|
| A. 입력 즉시 차단 | 유효하지 않은 날짜 즉시 에러 | 품질 우수 | 입력 UX 엄격 |
| B. 저장 시점 검증 | 입력은 허용, 저장 시 에러 | 입력 UX 유연 | 에러 발견 시점 지연 |
| C. 즉시 차단 + 자동 보정 제안 | 예: `2026-13-40` 입력 시 보정 제안 | 품질/UX 균형 | 구현 난이도 높음 |

- 권장안: A
- 구현 포인트: RHF + Zod 스키마에서 날짜 파싱 실패 시 필드 에러 반환
- 결정:
  - [x] A
  - [ ] B
  - [ ] C
  - [ ] 보류

### 결정 로그

| 항목 | 결정 | 결정일 | 결정자 | 비고 |
|---|---|---|---|---|
| D1 영업 시작일 | C | 2026-05-25 | 제품팀(초안) | 과거 허용, 미래 180일 상한 |
| D2 중복 등록 | B | 2026-05-25 | 제품팀(초안) | 중복 감지 후 경고, 사용자 재확인 |
| D3 상태 변경 규칙 | B | 2026-05-25 | 제품팀(초안) | 편집 모드 임시저장 + 저장 시 일괄 반영 |
| D4 날짜 형식 처리 | A | 2026-05-25 | 제품팀(초안) | 잘못된 날짜 즉시 검증 에러 |

---

## 부록: 코드 참조 위치

| 항목 | 파일 | 라인 (작성 시점 기준, 변경 가능) |
|------|------|----------------------------------|
| 신규 고객 폼 상태 선언 | `app/customers/new/page.tsx` | L41-45 |
| handleSubmit | `app/customers/new/page.tsx` | L50-62 |
| isValid 계산 | `app/customers/new/page.tsx` | L64 |
| 솔루션 Select 드롭다운 | `app/customers/new/page.tsx` | L137-148 |
| 취소 버튼 (router.back) | `app/customers/new/page.tsx` | L223-230 |
| 등록하기 버튼 (disabled) | `app/customers/new/page.tsx` | L231 |
| EntraPicker onConfirm | `app/customers/new/page.tsx` | L234-242 |
| isEditing 상태 선언 | `app/customers/[id]/page.tsx` | L174 |
| handleSaveEdits | `app/customers/[id]/page.tsx` | L431-450 |
| handleCancelEdits | `app/customers/[id]/page.tsx` | L452-455 |
| 저장/취소 버튼 UI | `app/customers/[id]/page.tsx` | L1516-1533 |
| confirm() 단계 삭제 | `app/customers/[id]/page.tsx` | L586 |
| alert() 파일 오류들 | `app/customers/[id]/page.tsx` | L738, L841, L889, L927 |
| confirm() 파일 삭제 | `app/customers/[id]/page.tsx` | L934 |
| alert() 공유 완료 | `app/customers/page.tsx` | L180 |
| addCustomer 구현 | `lib/store.ts` | L459-479 |
| EntraPicker onConfirm 전체 | `components/entra-picker.tsx` | L266-283 |
| Customer 타입 (확인 필요) | `lib/types.ts` | — |
