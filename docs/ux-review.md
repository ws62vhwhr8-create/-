# UX 리뷰 및 개선 가이드 - 영업 로드맵 Management Portal

**최종 업데이트**: 2026년 5월 3일  
**상태**: 이어서 작업할 항목 정리 (세션 1 완료 후)

---

## 1. 앱 컨셉 요약

### 1.1 애플리케이션 개요
**영업 로드맵 관리 시스템** - B2B SaaS 기반 고객 프로젝트 관리 플랫폼

### 1.2 핵심 구성
- **Admin**: 솔루션별 표준 워크플로우(WBS) 설계 → 마일스톤 자동 생성
- **User(영업담당자)**: 고객 추가 시 기존 솔루션/프로젝트 템플릿 선택 → 진행 상태 관리

### 1.3 주요 기능
1. 솔루션별 마일스톤 템플릿 관리
2. 고객별 상세 페이지에서 워크플로우 단계별 진행 상태 관리
3. 단계별 파일 정리 (SharePoint 연동)
4. WBS PDF 출력 기능
5. 고객 공유 및 알림 기능

---

## 2. 사용자 역할

| 역할 | 이름 | ID | 특징 | 접근 권한 |
|------|------|-----|------|----------|
| **Admin** | 시스템 관리자 | `admin` | 워크플로우 설계, 권한 관리 | 모든 고객, 솔루션 관리 |
| **User** | 김영업 | `u1` | 개별 고객 관리, 진행 상황 추적 | 자신의 담당 고객만 조회 |

### 2.1 권한 구분
- **Admin 메뉴**: 솔루션 관리, 사용자 관리, 전체 대시보드
- **User 메뉴**: 고객 관리, 개인 대시보드 (담당 고객만)

---

## 3. 핵심 플로우

### 3.1 신규 고객 추가 플로우
```
User/Admin → 고객 관리 페이지
    ↓
[고객 등록] 버튼 클릭
    ↓
/customers/new 페이지 (전용 폼)
    ↓
입력 [필수]:
  - 고객사명
  - 솔루션 선택
  - 영업시작일
  - 담당자
    ↓
마일스톤 미리보기 (우측)
    ↓
[등록] 버튼 → 새 고객 ID 반환
    ↓
자동으로 /customers/{id} 상세 페이지로 이동
```

### 3.2 솔루션 관리 (Admin 전용)
```
Admin → 솔루션 관리
    ↓
새 솔루션 생성 또는 기존 솔루션 수정
    ↓
워크플로우 단계 설계
  - 최대 3단계 (레벨 0~2)
  - 단계별 소요 기간, 담당자 역할 설정
    ↓
저장 → 고객 추가 시 템플릿으로 활용
```

### 3.3 고객 상세 페이지
```
/customers/{id}
    ↓
마일스톤 목록 테이블
  - 상태 변경 (pending → in-progress → completed)
  - Excel 가져오기 기능 (마일스톤 수정)
    ↓
파일 관리 (단계별)
  - 폴더 구조 (계층형)
  - SharePoint 자동 동기화
    ↓
Gantt 차트 / WBS 뷰
  - PDF 다운로드
```

---

## 4. 발견된 UX 문제

### [🔴 HIGH] 4.1 권한 보호 부족

**문제**: 현재 Admin 메뉴는 **프론트엔드에서만 숨겨짐**
- `/solutions`, `/users` 라우트에 직접 URL 접근 가능
- API 레이어에 권한 검증 없음

**영향**: 권한 없는 사용자가 URL을 직접 입력하여 관리 페이지 접근 가능

**현재 상태**: ❌ 미완료

---

### [🔴 HIGH] 4.2 대시보드 통계 필터링 미흡

**문제**: `components/dashboard/stats-cards.tsx`에서 `tone` 구분하지만 **필터링 미적용**
- User 대시보드에서 **모든 고객의 통계**를 포함
- 자신의 담당 고객만 표시해야 함

**영향**: User 대시보드의 통계 정확도 감소

**현재 상태**: ❌ 미완료

---

### [🟠 MEDIUM] 4.3 루트 리다이렉트 부재

**문제**: `/` 경로가 **정적 대시보드** (`app/page.tsx`) 또는 라우팅 불명확
- Admin과 User가 다른 대시보드로 가야 하는데 고정 라우팅

**기대 동작**: 
- 로그인 후 `/` 접근 시 역할에 따라 자동 리다이렉트
- Admin → `/dashboard` (전체 대시보드)
- User → `/` 또는 `/customers` (개인 대시보드)

**현재 상태**: ❌ 미완료

---

### [🟠 MEDIUM] 4.4 미들웨어 인증 부재

**문제**: Next.js `middleware.ts` 없음
- 라우트 접근 전 세션 체크 불가능
- 보호된 라우트 검증은 개별 API에서만 처리

**기대 동작**: 모든 protected 라우트에 대한 **서버 단 인증**

**기술 스택**:
- `getServerSession(authOptions)` 활용
- 라우트별 권한 검증

**현재 상태**: ❌ 미완료

---

### [🟠 MEDIUM] 4.5 NextAuth 세션 미통합

**문제**: 현재 `currentUserId`는 **zustand store + localStorage 기반**
- 실제 NextAuth 세션과 동기화되지 않음
- 토큰 만료, 세션 갱신 로직 없음

**기대 동작**: `getServerSession(authOptions)`와 zustand 동기화

**현재 상태**: ❌ 미완료

---

### [🟠 MEDIUM] 4.6 고객 공유 기능의 권한 체크 부재

**문제**: `shareCustomer()` API에 **접근 제어 없음**
- 누가 공유했는지 로그 없음
- 공유 권한 검증 없음

**기대 동작**:
- 소유자(ownerName) 또는 Admin만 공유 가능
- 공유 기록 감사 로그 기록

**현재 상태**: ❌ 미완료

---

### [🟠 MEDIUM] 4.7 워크플로우 수정 후 마일스톤 동기화 미흡

**문제**: `app/customers/[id]/page.tsx`에서 워크플로우 수정 후 **마일스톤 재계산 로직 불명확**
- Excel 가져오기 시 기존 마일스톤과의 충돌 처리 불완전

**기대 동작**:
1. Excel에서 새 단계 가져오기
2. 기존 마일스톤과 매핑 (중복 제거)
3. 변경 사항 요약 표시 후 사용자 확인

**현재 상태**: ❌ 미완료

---

### [🟡 MEDIUM] 4.8 파일 관리의 계층 구조 UX 복잡

**문제**: 단계별 폴더와 노트별 파일 구분이 복잡
- 사용자가 어디에 파일을 올려야 하는지 혼동 가능
- 시각적 구분 부족

**기대 개선**:
- 시각적 표시: 아이콘, 색상, 라벨 구분
- 드래그 앤 드롭 이동 기능
- "이 폴더의 용도" 안내 텍스트

**현재 상태**: ❌ 미완료

---

### [🟡 LOW] 4.9 대시보드 커스터마이제이션 부족

**문제**: User 대시보드에 필터링 옵션 제한적
- 자신의 담당 고객만 강제 표시 (필터 토글 불가)

**기대 개선**: "내 고객만 보기" 토글 추가 (기본값: ON)

**현재 상태**: ❌ 미완료

---

### [🟡 LOW] 4.10 모바일 반응형 미흡

**문제**: 테이블, 카드 레이아웃이 작은 화면에서 동작 확인 필요

**기대 개선**:
- 테이블 → 카드 레이아웃 자동 변환
- 사이드바 접기 기능
- 터치 UI 최적화

**현재 상태**: ❌ 미완료

---

## 5. 개선 제안 (우선순위순)

### [🔴 CRITICAL] 5.1 미들웨어 인증 추가

**파일**: `middleware.ts` (신규)

**목표**: 보호된 라우트 접근 전 세션 검증

**구현 방법**:
```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Admin 전용 라우트 보호
  const adminRoutes = ['/solutions', '/users']
  
  if (adminRoutes.some(route => pathname.startsWith(route))) {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.redirect(new URL('/customers', request.url))
    }
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: ['/solutions/:path*', '/users/:path*']
}
```

**우선순위**: 🔴 **CRITICAL** - 보안 필수

---

### [🔴 HIGH] 5.2 User 대시보드 통계 필터링

**파일**: `components/dashboard/stats-cards.tsx`

**목표**: User 대시보드에서 자신의 담당 고객만 통계 포함

**구현 개요**:
```typescript
// 변경 전
const stats = {
  total: customers.length,
  active: customers.filter(c => c.status === 'active').length,
  ...
}

// 변경 후 (User 모드일 때)
const relevantCustomers = isUser 
  ? customers.filter(c => c.ownerName === currentOwnerName)
  : customers

const stats = {
  total: relevantCustomers.length,
  active: relevantCustomers.filter(c => c.status === 'active').length,
  ...
}
```

**우선순위**: 🔴 **HIGH** - 데이터 무결성

---

### [🔴 HIGH] 5.3 루트 경로 역할별 리다이렉트

**파일**: `app/page.tsx` 또는 root 미들웨어

**목표**: `/` 접근 시 역할에 따라 리다이렉트

**구현 개요**:
```typescript
// app/page.tsx
import { redirect } from 'next/navigation'
import { useAppStore } from '@/lib/store'

// 클라이언트 컴포넌트에서 처리 또는 middleware에서 처리
// Option 1: middleware.ts에서
// - 루트 경로 체크 추가
// - Admin인 경우 /dashboard로 리다이렉트

// Option 2: 클라이언트 useEffect에서
// - RootLayout 또는 page.tsx에서 useRouter().replace() 사용
```

**우선순위**: 🟠 **MEDIUM-HIGH** - UX 흐름

---

### [🟠 MEDIUM] 5.4 NextAuth 세션 통합

**파일**: `lib/store.ts`, `app/layout.tsx`, middleware

**목표**: 실제 NextAuth 세션과 zustand currentUserId 동기화

**구현 개요**:
```typescript
// app/layout.tsx에서 SessionProvider + Store 초기화
// components/store-initializer.tsx 신규 컴포넌트
// 라이프사이클:
// 1. SessionProvider로 NextAuth 세션 관리
// 2. StoreInitializer에서 useSession() 훅
// 3. session 변경 시 zustand store 업데이트
```

**우선순위**: 🟠 **MEDIUM** - 아키텍처 정리

---

### [🟠 MEDIUM] 5.5 공유 기능 권한 검증

**파일**: `app/api/notifications/customer/route.ts`, `lib/store.ts`

**목표**: 고객 공유 시 권한 검증 및 감사 로그

**구현 개요**:
```typescript
// API 라우트에서 공유 권한 검증
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json(
    { error: 'Unauthorized' }, 
    { status: 401 }
  )
  
  // 공유 권한: 소유자(ownerName) 또는 Admin만 가능
  const { customerId } = body
  const customer = await getCustomer(customerId)
  
  if (
    customer.ownerName !== session.user.name && 
    session.user.role !== 'admin'
  ) {
    return NextResponse.json(
      { error: 'Forbidden' }, 
      { status: 403 }
    )
  }
  
  // 공유 기록 저장 (감사 로그)
  // ...
}
```

**우선순위**: 🟠 **MEDIUM** - 보안 강화

---

### [🟠 MEDIUM] 5.6 워크플로우 수정 후 마일스톤 동기화

**파일**: `app/customers/[id]/page.tsx`

**목표**: 워크플로우 변경 시 마일스톤 자동 갱신

**현황**: Excel 가져오기 기능 있으나 기존 마일스톤과의 병합 로직 불명확

**기대 동작**:
1. Excel에서 새 단계 가져오기
2. 기존 마일스톤과 매핑 (중복 제거)
3. 변경 사항 요약 표시 후 확인

**구현 세부사항**:
- Excel 파싱 후 단계명, 기간 추출
- 기존 마일스톤 ID와 매핑 (fuzzy match)
- 추가/삭제된 항목 구분
- 사용자 확인 다이얼로그 표시

**우선순위**: 🟠 **MEDIUM** - 기능 완성도

---

### [🟡 MEDIUM] 5.7 파일 관리 계층 구조 개선

**파일**: `app/customers/[id]/page.tsx` - FileLibrary 섹션

**목표**: 단계/노트 폴더 구분 명확화

**기대 개선**:
- 시각적 표시: 아이콘, 색상, 라벨 구분
- 드래그 앤 드롭 이동 기능
- "이 폴더의 용도" 안내 텍스트

**우선순위**: 🟡 **MEDIUM** - 사용성

---

### [🟡 LOW] 5.8 대시보드 필터 옵션 추가

**파일**: `components/dashboard/customer-table.tsx`

**목표**: User 모드에서도 필터링 옵션 제공 (선택사항)

**구현**: "내 고객만 보기" 토글 (기본값: ON)

**우선순위**: 🟡 **LOW** - 편의성

---

### [🟡 LOW] 5.9 모바일 반응형 테스트 및 개선

**파일**: 모든 페이지

**목표**: 테블릿, 모바일 화면에서 동작 확인

**기대 개선**:
- 테이블 → 카드 레이아웃 자동 변환
- 사이드바 접기 기능
- 터치 UI 최적화

**우선순위**: 🟡 **LOW** - 반응형

---

## 6. 우선순위 매트릭스

| 우선순위 | 등급 | 파일/항목 | 작업 | 난이도 |
|---------|------|---------|------|--------|
| 🔴 1 | CRITICAL | `middleware.ts` (신규) | Admin 라우트 보호 생성 | 보통 |
| 🔴 2 | HIGH | `components/dashboard/stats-cards.tsx` | User 필터링 추가 | 낮음 |
| 🔴 3 | HIGH | `app/page.tsx` / 미들웨어 | 역할별 리다이렉트 | 낮음 |
| 🟠 4 | MEDIUM | `lib/store.ts` | NextAuth 세션 통합 | 중간 |
| 🟠 5 | MEDIUM | `app/api/notifications/customer/route.ts` | 공유 권한 검증 | 낮음 |
| 🟠 6 | MEDIUM | `app/customers/[id]/page.tsx` | 마일스톤 동기화 로직 | 높음 |
| 🟠 7 | MEDIUM | `app/customers/[id]/page.tsx` - FileLibrary | 파일 관리 UX 개선 | 중간 |
| 🟡 8 | LOW | `components/dashboard/customer-table.tsx` | 필터 옵션 추가 | 낮음 |
| 🟡 9 | LOW | 모든 페이지 | 모바일 테스트 및 개선 | 중간 |

---

## 7. 수정 대상 파일 및 컴포넌트

### 7.1 신규 생성 파일

- [ ] `middleware.ts` - Admin 라우트 보호 미들웨어

### 7.2 수정할 파일 (우선순위순)

| 순서 | 파일 | 작업 내용 | 예상 난이도 |
|------|------|---------|-----------|
| 1 | `middleware.ts` | 신규 생성: Admin 라우트 접근 제어 | ⭐⭐ |
| 2 | `components/dashboard/stats-cards.tsx` | User 필터링 추가 | ⭐ |
| 3 | `app/page.tsx` | 역할별 리다이렉트 로직 또는 미들웨어 추가 | ⭐ |
| 4 | `lib/store.ts` | NextAuth 세션 연동 로직 | ⭐⭐ |
| 5 | `app/api/notifications/customer/route.ts` | 공유 권한 검증 강화 | ⭐ |
| 6 | `app/customers/[id]/page.tsx` | 마일스톤 동기화 로직 개선 | ⭐⭐⭐ |
| 7 | `app/customers/[id]/page.tsx` (FileLibrary) | 파일 관리 UX 개선 | ⭐⭐ |
| 8 | `components/dashboard/customer-table.tsx` | 필터 옵션 추가 | ⭐ |
| 9 | 모든 페이지 | 모바일 반응형 테스트 | ⭐⭐ |

---

## 8. 세션 1 완료 항목 체크리스트

### 보안 개선 ✅
- [x] `next.config.mjs`: TypeScript strict build 활성화
- [x] API 라우트 인증 게이트 추가 (3개):
  - `app/api/milestone-files/route.ts`
  - `app/api/notifications/customer/route.ts`
  - `app/api/auth/[...nextauth]/route.ts` 내 authOptions export

### UX 개선 ✅
- [x] 신규 고객 생성 플로우 통일
  - 기존: `customers/page.tsx` 내 인라인 다이얼로그
  - 변경: 전용 페이지 `customers/new/page.tsx`
- [x] 역할별 메뉴 동적 표시
  - `components/navigation.tsx`: `isAdmin` 조건부 렌더링
- [x] 고객 등록 후 상세 페이지 자동 이동
  - `lib/store.ts`: `addCustomer()` 반환값 추가
- [x] 빈 상태 UX 개선
  - `Empty` 컴포넌트 적용
- [x] User 대시보드 필터링
  - `components/dashboard/customer-table.tsx`: 담당자 기준 필터링

### 코드 품질 ✅
- [x] 하드코딩 데이터 제거
  - `components/entra-picker.tsx`: 임시 사용자 목록 → store 기반
- [x] 타입 에러 8개 수정 및 빌드 성공
  - `corepack pnpm build` → ✅ 통과

---

## 9. 다음 세션 시작 프롬프트

**다음 세션에서 이 프롬프트를 복사/붙여넣기 하여 사용하세요:**

```markdown
# [세션 2] 영업 로드맵 Management Portal - 권한 보호 및 통계 필터링

## 상황
이전 세션(세션 1)에서 다음을 완료했습니다:
- ✅ TypeScript 빌드 엄격화 및 타입 에러 8개 수정
- ✅ API 인증 게이트 추가 (3개 라우트)
- ✅ 신규 고객 등록 플로우 통일 및 자동 네비게이션
- ✅ 역할별 메뉴 동적 표시
- ✅ User 대시보드 고객 필터링
- ✅ Empty 상태 UX 개선

docs/ux-review.md 파일에 미완료 항목 상세 정리되어 있습니다.

## 이번 세션 목표 (우선순위순)

### 1️⃣ [CRITICAL] 미들웨어 인증 추가
**파일**: `middleware.ts` (신규 생성)
**작업**: 
- Admin 라우트(`/solutions`, `/users`) 보호
- 미인증 사용자 접근 시 `/customers`로 리다이렉트
- 세션 검증: `getServerSession(authOptions)` 활용

**참고**: docs/ux-review.md 섹션 5.1 참고

### 2️⃣ [HIGH] User 대시보드 통계 필터링
**파일**: `components/dashboard/stats-cards.tsx`
**작업**: 
- `tone="user"` 모드에서 담당 고객만 통계 계산
- 담당자 필터: `customer.ownerName === currentOwnerName`

**참고**: docs/ux-review.md 섹션 5.2 참고

### 3️⃣ [HIGH] 루트 경로 역할별 리다이렉트
**파일**: `app/page.tsx` (또는 middleware에 추가)
**작업**: 
- Admin: `/` → `/dashboard`로 리다이렉트
- User: `/` → `/customers` 또는 대시보드 유지
- 역할 확인: `currentUser?.role === 'admin'`

**참고**: docs/ux-review.md 섹션 5.3 참고

## 테스트 계정
- **User (영업담당자)**: 김영업 (ID: `u1`)
- **Admin (시스템관리자)**: ID: `admin`

## 테스트 방법
```javascript
// 브라우저 DevTools 콘솔에서
const store = JSON.parse(localStorage.getItem('sales-roadmap-storage'))

// 현재 사용자 확인
console.log(store.state.currentUserId)

// Admin으로 변경 (테스트용)
localStorage.setItem('sales-roadmap-storage', JSON.stringify({
  state: { ...store.state, currentUserId: 'admin' }
}))

// User로 변경
localStorage.setItem('sales-roadmap-storage', JSON.stringify({
  state: { ...store.state, currentUserId: 'u1' }
}))

// 페이지 새로고침
location.reload()
```

## 완료 기준
- 모든 보호된 라우트에 미들웨어 검증 작동 확인
- User/Admin 역할별 대시보드 통계 정확도 검증
- 빌드 성공: `corepack pnpm build` ✅
- 역할별 접근 제어 Playwright 테스트 추가 (선택)

## 참고 자료
- `docs/ux-review.md` - 전체 UX 리뷰 및 개선 가이드
- 세션 1 완료 사항: 위의 "세션 1 완료 항목 체크리스트" 참고
```

---

## 10. 기술 참고사항

### 10.1 현재 상태 저장/복원
```typescript
// localhost:3000 콘솔에서
const store = JSON.parse(localStorage.getItem('sales-roadmap-storage'))
console.log(store.state.currentUserId) // 현재 사용자 확인

// Admin으로 변경
localStorage.setItem('sales-roadmap-storage', JSON.stringify({
  state: { ...store.state, currentUserId: 'admin' }
}))

// User로 변경
localStorage.setItem('sales-roadmap-storage', JSON.stringify({
  state: { ...store.state, currentUserId: 'u1' }
}))

location.reload() // 페이지 새로고침
```

### 10.2 빌드 검증 명령어
```bash
# 타입 체크 포함 전체 빌드
corepack pnpm build

# 개발 서버 실행 (with hot reload)
corepack pnpm dev
```

### 10.3 API 라우트 인증 패턴
```typescript
// 기존 패턴 (세션 1에서 적용)
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  
  // 인증 확인
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' }, 
      { status: 401 }
    )
  }
  
  // 권한 확인 (필요시)
  if (session.user.role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden' }, 
      { status: 403 }
    )
  }
  
  // 로직 실행
  // ...
}
```

### 10.4 Store 접근 패턴
```typescript
// 클라이언트 컴포넌트
'use client'
import { useAppStore } from '@/lib/store'

export default function MyComponent() {
  const { currentUserId, users } = useAppStore()
  const currentUser = users.find(u => u.id === currentUserId)
  
  // 권한 확인
  const isAdmin = currentUser?.role === 'admin'
  const isUser = currentUser?.role === 'user'
  
  return (
    <>
      {isAdmin && <AdminPanel />}
      {isUser && <UserDashboard />}
    </>
  )
}
```

### 10.5 미들웨어 매처 패턴
```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // 특정 경로 체크
  if (pathname.startsWith('/admin')) {
    // 인증 확인
    // ...
  }
  
  return NextResponse.next()
}

// matcher: 미들웨어가 실행될 경로 지정
export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    '/solutions/:path*',
    '/users/:path*'
  ],
}
```

---

## 11. 알려진 문제 및 주의사항

1. **NextAuth 미완성**: 현재 session은 유효하지만 실제 OAuth 플로우 테스트 없음
2. **Cosmos DB 쿼리**: 수정된 쿼리 문법 (`{ query, parameters }`) 검증 필요
3. **SharePoint 동기화**: 실제 credentials 없이 목(mock) 동작 중
4. **환경 변수**: `.env.local` 확인 필수
   - `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
   - `ENTRA_ID_*` 설정
   - `OUTLOOK_SENDER_UPN`, `OUTLOOK_SENDER_UPN_PASSWORD`

---

## 12. 파일 체크리스트 (다음 세션용)

### 新規 작성할 파일
- [ ] `middleware.ts`

### 수정할 파일 (우선순위순)
- [ ] `components/dashboard/stats-cards.tsx`
- [ ] `app/page.tsx` (또는 middleware 추가)
- [ ] `lib/store.ts` (NextAuth 통합)
- [ ] `app/api/notifications/customer/route.ts` (권한 검증)
- [ ] `app/customers/[id]/page.tsx` (마일스톤 동기화)
- [ ] `components/dashboard/customer-table.tsx` (필터 옵션)

### 테스트 및 검증
- [ ] 미들웨어 인증 동작 확인 (직접 URL 접근 테스트)
- [ ] User vs Admin 통계 필터링 정확도 검증
- [ ] 빌드 성공: `corepack pnpm build`
- [ ] 역할별 페이지 접근 제어 Playwright 테스트

---

## 문서 이력

| 날짜 | 작업 | 상태 |
|------|------|------|
| 2026-05-03 | 초기 문서 작성 (세션 1 완료 후) | ✅ 완료 |
| - | 세션 2 작업 예정 | ⏳ 대기 |

