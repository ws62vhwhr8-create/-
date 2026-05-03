# 워크플로우 관리 기능 코드 리뷰

> **작성일:** 2026-05-03  
> **리뷰 대상:** 고객사 상세페이지 — 워크플로우 단계 관리, 파일 라이브러리, WBS PDF 출력  
> **리뷰어:** GitHub Copilot (Claude Sonnet 4.6)

---

## 프로젝트 개요

| 항목 | 내용 |
|---|---|
| 프레임워크 | Next.js 14 (App Router), TypeScript |
| 상태관리 | Zustand + `persist` (localStorage) |
| 데이터베이스 | Prisma (PostgreSQL) — 고객/솔루션/사용자 |
| 파일 스토리지 | Azure Cosmos DB — 마일스톤 파일(`MilestoneFile`) |
| 인증 | NextAuth + Microsoft Entra ID |

---

## 검토 대상 파일

| 파일 경로 | 역할 |
|---|---|
| `app/customers/[id]/page.tsx` | 고객사 상세페이지 (2,300줄 monolith) |
| `app/solutions/[id]/page.tsx` | 솔루션(표준 워크플로우) 관리 페이지 |
| `app/api/milestone-files/route.ts` | 파일 CRUD API (Cosmos DB) |
| `components/pdf-export-button.tsx` | WBS 간트차트 PDF 내보내기 |
| `lib/store.ts` | Zustand 전역 스토어 (샘플 데이터 포함) |
| `lib/types.ts` | 공통 타입 정의 |
| `lib/cosmos.ts` | Cosmos DB 연결 및 컨테이너 |
| `prisma/schema.prisma` | DB 스키마 |

---

## 1. 데이터 모델 관점 리뷰

### 1-1. 표준 워크플로우 → 고객 워크플로우 관계

`addCustomer()`가 호출될 때 `generateMilestones()`가 솔루션의 `stages`를 **스냅샷** 방식으로 복사한다. 이후 `stageId`는 참조용으로만 남으며, 솔루션 업데이트가 기존 고객에게 **전파되지 않는다**.

```
Solution.stages ──→ generateMilestones() ──→ Milestone[] (스냅샷)
                                                      ↑
                                          이후 연결 단절 (의도된 설계)
```

- **원본 보호 여부:** ✅ 원본 `Solution.stages`는 변경되지 않음
- **문제:** 코드/문서 어디에도 이 설계 의도가 명시되어 있지 않음

### 1-2. `Milestone.stageLevel` — Prisma 스키마 누락 (P0)

`lib/types.ts`와 `app/customers/[id]/page.tsx`에서 `stageLevel` 필드를 사용하지만, `prisma/schema.prisma`의 `Milestone` 모델에는 해당 필드가 없다.

```prisma
// prisma/schema.prisma — 현재
model Milestone {
  id         String   @id @default(cuid())
  customerId String
  stageId    String
  stageName  String
  dueDate    DateTime
  notifyDate DateTime
  role       String
  status     String   @default("pending")
  // ❌ stageLevel 없음
}
```

**영향도:** 실제 PostgreSQL에서 데이터를 읽을 경우 `stageLevel`이 `undefined`가 되어 계층 표시 전체가 level 0으로 평탄화됨.

### 1-3. `MilestoneNote` — Prisma 스키마 없음 (P2)

`MilestoneNote`는 Prisma 스키마에 존재하지 않는다. 노트 데이터는 `Milestone.notes` 배열 안에 중첩되어 Zustand `persist`(localStorage)에만 저장된다.

**영향도:** 브라우저 스토리지 초기화, 다른 기기/브라우저 접근 시 데이터 유실.

### 1-4. `role` 필드 모호성 (P2)

`Milestone.role`과 `MilestoneNote.ownerName`이 `User.displayName` 문자열을 저장한다. `User.id` 기반이 아니므로 담당자 이름 변경 시 기존 레코드가 자동 갱신되지 않는다.

```ts
// lib/types.ts
export interface Milestone {
  role: string  // displayName 문자열, userId 아님
}
```

---

## 2. UX 관점 리뷰

### 2-1. 긍정적 요소

- 마감일 변경 시 알림일 오프셋 자동 계산 (`handleEditingMilestoneDueDateChange`) ✅
- 단계 삭제 시 하위 단계 일괄 삭제 (`removeMilestoneBranch`) ✅
- 파일 드래그&드롭 단계 간 이동 ✅
- 파괴적 작업에 AlertDialog 확인 패턴 적용 ✅

### 2-2. 문제점

| 문제 | 파일/함수 | 우선순위 |
|---|---|---|
| 파일 업로드 성공 시 toast 없음 (`console.log`만 출력) | `handleFileUpload` | P2 |
| PDF/Excel export 오류 시 `alert()` 사용 (toast와 불일치) | `pdf-export-button.tsx` | P3 |
| 탭명 "공유된 파일"이 실제 기능(단계별 파일 라이브러리)과 불일치 | 탭 레이블 | P3 |
| 비편집 모드에서 `+` 버튼으로 하위 단계 즉시 추가 — 저장/취소 없음 | `addChildMilestone()` | P2 |
| 폴더 생성은 가능하나 폴더 안에 파일을 배치하는 UX 없음 | 파일 라이브러리 | P3 |

---

## 3. 컴포넌트 구조 리뷰

`app/customers/[id]/page.tsx`는 **2,300줄 이상의 단일 컴포넌트**다.

```
CustomerDetailPage (2300+ lines)
├── 20+ useState 훅
├── renderNotesTree() — 컴포넌트 내부 재귀 함수 (추출 필요)
├── 마일스톤 테이블 렌더링
├── 파일 라이브러리 UI
├── GanttChart (dynamic import — ✅ 이미 분리됨)
└── 8개의 AlertDialog/Dialog 상태 변수
```

**추출이 필요한 단위:**

| 추출 대상 | 현재 위치 |
|---|---|
| `<FileLibraryPanel>` | 파일 탭 전체 (TabsContent value="milestone-detail") |
| `<MilestoneNoteTree>` | `renderNotesTree()` 함수 |
| `<MilestoneTableRow>` | 테이블 행 + 확장 패널 Fragment |
| `useFileLibrary()` 커스텀 훅 | 파일 관련 state 12개 |

---

## 4. 잠재 버그

### [P0] ① `Milestone.stageLevel` Prisma 스키마 누락

- **파일:** `prisma/schema.prisma`
- **증상:** DB 연동 시 계층 구조 전체가 level 0으로 렌더링됨
- **수정:** `stageLevel Int @default(0)` 필드 추가 후 마이그레이션

---

### [P0] ② 5MB 초과 파일 업로드 후 다운로드 불가

- **파일:** `app/customers/[id]/page.tsx` — `handleFileUpload()`
- **원인:**
  ```ts
  const isSmallFile = file.size < 5 * 1024 * 1024
  // isSmallFile === false 이면 base64Content = undefined
  // contentUrl도 설정되지 않음 → 업로드는 성공처럼 보이나 내용 없음
  ```
- **추가 문제:** SharePoint 동기화 실패 → Cosmos 롤백 실패 시 `.catch(() => undefined)`로 조용히 무시됨
- **수정 방향:** 5MB 초과 파일은 Azure Blob Storage presigned URL 기반 업로드로 전환하거나, 파일 크기 제한 + 명확한 에러 메시지 제공

---

### [P1] ③ 파일 API 접근 권한 검증 없음

- **파일:** `app/api/milestone-files/route.ts` — `DELETE`, `GET`, `POST`, `PATCH`
- **현황:** `session` 존재 여부만 확인하고, 해당 `milestoneId`가 요청자의 고객사 파일인지 검증하지 않음
- **위험:** 인증된 사용자라면 타 고객사 파일을 삭제/열람 가능 (OWASP A01: Broken Access Control)
- **수정 방향:** `milestoneId → customerId → sharedUserIds/sharedGroupIds` 체인 검증 추가

---

### [P1] ④ 진행률 division-by-zero

- **파일:** `app/customers/[id]/page.tsx` 약 1,610줄
- **코드:**
  ```tsx
  Math.round((progress.completed / progress.total) * 100)
  // progress.total === 0 이면 NaN 렌더링
  ```
- **수정:**
  ```tsx
  progress.total === 0 ? 0 : Math.round((progress.completed / progress.total) * 100)
  ```

---

### [P2] ⑤ `uploadedBy` 미설정

- **파일:** `app/api/milestone-files/route.ts` — `POST` 핸들러
- **원인:** `uploadedBy` 필드가 `undefined`로 저장됨 (`session.user` 정보 미기입)
- **수정:** `uploadedBy: session.user?.id ?? session.user?.email` 추가

---

### [P2] ⑥ `getFileTargetKey` 키 충돌 가능성

- **파일:** `app/customers/[id]/page.tsx` — `getFileTargetKey()`
- **원인:**
  ```ts
  target.noteId ? `${milestoneId}::${noteId}` : `${milestoneId}::stage`
  // noteId 값이 문자열 "stage"이면 stage 폴더 키와 충돌
  ```
- **수정:** 구분자를 `::note::` 같은 예약어로 변경

---

### [P2] ⑦ Excel 가져오기 시 계층 구조 소실

- **파일:** `app/customers/[id]/page.tsx` — `handleMilestoneExcelUpload()`
- **원인:**
  ```ts
  stageLevel: 0  // 모든 Excel 행에 하드코딩
  ```
- **수정:** Excel 컬럼에 들여쓰기 레벨 또는 `부모단계명` 컬럼 추가

---

### [P3] ⑧ PDF 출력 포함 정보 부족

- **파일:** `components/pdf-export-button.tsx`
- **현재:** 고객명 + 생성일만 포함
- **추가 필요:** 솔루션명, 담당자, 영업 시작일, 완료율, 상태 범례
- **추가 문제:** `alert()` 사용 → `toast`로 교체 필요

---

## 5. 우선순위 요약

| 순위 | 항목 | 파일/함수 | 근거 |
|---|---|---|---|
| **P0** | `Milestone.stageLevel` Prisma 스키마 누락 | `prisma/schema.prisma` | DB 연동 시 계층 기능 전체 불동작 |
| **P0** | 5MB 초과 파일 처리 플로우 | `handleFileUpload()` | 업로드 성공처럼 보이나 다운로드 불가 |
| **P1** | 파일 API 접근 권한 검증 | `app/api/milestone-files/route.ts` | OWASP A01 Broken Access Control |
| **P1** | 진행률 division-by-zero | `CustomerDetailPage` ~1610줄 | 빈 마일스톤 고객에서 NaN 렌더링 |
| **P2** | `MilestoneNote` Prisma 모델화 | `prisma/schema.prisma`, `lib/types.ts` | localStorage 의존 → 데이터 유실 위험 |
| **P2** | `role` 필드 userId 기반으로 개선 | `lib/types.ts`, `lib/store.ts` | 담당자 변경 추적 불가 |
| **P2** | 파일 업로드 성공 toast 추가 | `handleFileUpload()` | UX 일관성 |
| **P2** | `uploadedBy` 필드 기입 | `route.ts` POST | 파일 소유자 추적 불가 |
| **P3** | `CustomerDetailPage` 컴포넌트 분리 | `app/customers/[id]/page.tsx` | 2300줄 monolith → 유지보수성 |
| **P3** | PDF 출력 정보 확장 + `alert()` → `toast` | `pdf-export-button.tsx` | 기능 완성도, UX 일관성 |
| **P3** | 탭명 "공유된 파일" → "파일 라이브러리" | `page.tsx` 탭 레이블 | 기능 명칭 불일치 |

---

## 6. 아키텍처 개선 방향 (장기)

```
현재
  Solution.stages (Json)
  Customer.milestones (Milestone[])
  Milestone.notes (MilestoneNote[]) ← localStorage만
  MilestoneFile ← Cosmos DB

권장
  Solution
    └── SolutionStage (별도 테이블, parentStageId FK)
  Customer
    └── Milestone (stageLevel, userId FK)
        └── MilestoneNote (별도 테이블, Prisma)
            └── MilestoneFile (Cosmos DB 유지 또는 Blob Storage)
```

---

## 다음 세션용 요약 프롬프트

이 프로젝트의 워크플로우 관리 기능 코드 리뷰 결과는 `WORKFLOW_REVIEW.md`에 정리되어 있다.  
우선순위는 다음과 같다.

1. P0: Prisma `Milestone.stageLevel` 누락 수정
2. P0: 5MB 초과 파일 업로드/다운로드 불가 문제 수정
3. P1: 파일 API 접근 권한 검증 추가
4. P1: 진행률 division-by-zero 수정
5. P2: `MilestoneNote` Prisma 모델화
6. P2: `role` 필드 사용자 ID 기반으로 개선
7. P3: `CustomerDetailPage` 컴포넌트 분리
8. P3: PDF 출력 정보 확장

먼저 `WORKFLOW_REVIEW.md`를 읽고, P0 항목부터 수정 계획과 코드 변경안을 제시해줘.
