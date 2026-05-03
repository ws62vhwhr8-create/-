# Setup Workplan

> 작성일: 2026-05-03  
> 목적: 새 Copilot Chat 세션에서 이 문서를 읽고 설정 작업을 이어가기 위한 참조 문서  
> 주의: 이 문서에는 실제 Secret, Key, Token, Password 값을 포함하지 않습니다.

---

## 1. 시스템 구조 요약

```
[사용자 브라우저]
      │
      ▼
[Next.js 앱 - /Users/hyunah/Downloads/b_4VeHTWrRLlS]
      │
      ├── 인증          : NextAuth.js + Azure Entra ID (AzureAD Provider)
      ├── 앱 데이터     : PostgreSQL (Prisma ORM) ← DATABASE_URL 미설정
      ├── 파일 메타데이터: Azure Cosmos DB ← 설정 완료 ✅
      ├── 파일 본체      : SharePoint (Microsoft Graph API) ← 환경변수 누락
      └── 알림 이메일   : Outlook (Microsoft Graph API / sendMail) ← 환경변수 누락
```

---

## 2. 현재 코드베이스에서 확인한 주요 파일

| 파일 경로 | 역할 |
|-----------|------|
| `lib/cosmos.ts` | Cosmos DB 클라이언트 초기화 및 컨테이너 접근 |
| `lib/microsoft-graph.ts` | Microsoft Graph 클라이언트 (SharePoint 파일 동기화) |
| `lib/notifications/providers.ts` | Outlook 이메일 알림 발송 (`OUTLOOK_SENDER_UPN` 필요) |
| `lib/notifications/service.ts` | Prisma 기반 마일스톤 알림 조회 및 발송 서비스 |
| `lib/prisma.ts` | Prisma 클라이언트 싱글턴 |
| `prisma/schema.prisma` | DB 스키마 (User, Group, Solution, Customer, Milestone 등) |
| `app/api/auth/[...nextauth]/route.ts` | NextAuth AzureAD 인증 라우트 |
| `app/api/milestone-files/route.ts` | 파일 CRUD API (Cosmos DB + SharePoint 연동) |
| `.env.local` | 환경변수 파일 (루트에 위치, git 제외됨) |

---

## 3. 현재 환경변수 상태

> `.env.local` 기준. 실제 값은 이 문서에 포함하지 않습니다.

| 환경변수 | 상태 | 비고 |
|----------|------|------|
| `ENTRA_TENANT_ID` | ✅ 설정 완료 | Azure Directory ID |
| `ENTRA_CLIENT_ID` | ✅ 설정 완료 | Azure Application ID |
| `ENTRA_CLIENT_SECRET` | ✅ 설정 완료 | Azure Client Secret ID |
| `AZURE_SUBSCRIPTION_ID` | ✅ 설정 완료 | Azure 구독 ID |
| `COSMOS_DB_ENDPOINT` | ✅ 설정 완료 | `https://dex-hr-text2sql-cosmos.documents.azure.com:443/` |
| `COSMOS_DB_KEY` | ✅ 설정 완료 | Primary Key 설정됨 |
| `COSMOS_DB_DATABASE` | ✅ 설정 완료 | `dex-hr-text2sql-cosmos` |
| `COSMOS_DB_CONTAINER` | ✅ 설정 완료 | `files` (기본값 유지) |
| `NEXTAUTH_URL` | ✅ 설정 완료 | `http://localhost:3000` (로컬 개발용) |
| `MICROSOFT_GRAPH_ENDPOINT` | ✅ 설정 완료 | `https://graph.microsoft.com/v1.0` |
| `NEXTAUTH_SECRET` | ✅ 설정 완료 | `openssl rand -base64 32`로 생성 완료 |
| `DATABASE_URL` | ❌ 미설정 | placeholder 상태 |
| `SHAREPOINT_SITE_ID` | ❌ 누락 | `.env.local`에 항목 없음 |
| `SHAREPOINT_DRIVE_ID` | ❌ 누락 | `.env.local`에 항목 없음 |
| `SHAREPOINT_ROOT_FOLDER` | ⚠️ 선택사항 | 기본값 `milestone-files` 사용 가능 |
| `OUTLOOK_SENDER_UPN` | ❌ 누락 | `.env.local`에 항목 없음 |

---

## 4. 미설정 또는 확인 필요한 환경변수

`.env.local`에 추가해야 할 항목 목록:

```env
# NextAuth 서명 키 (openssl rand -base64 32 로 생성)
NEXTAUTH_SECRET=<생성 필요>

# PostgreSQL 연결 문자열
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<dbname>?sslmode=require

# SharePoint (Microsoft Graph)
SHAREPOINT_SITE_ID=<Azure Portal 또는 Graph API에서 확인>
SHAREPOINT_DRIVE_ID=<Azure Portal 또는 Graph API에서 확인>
SHAREPOINT_ROOT_FOLDER=milestone-files

# Outlook 발신 계정
OUTLOOK_SENDER_UPN=<발신용 M365 계정 이메일>
```

---

## 5. 외부 서비스 연동 상태

| 서비스 | 연동 상태 | 비고 |
|--------|-----------|------|
| Azure Entra ID (인증) | ✅ 환경변수 완료 / ⚠️ API 권한 미확인 | 앱 권한 추가 필요 (아래 참조) |
| Azure Cosmos DB | ✅ 환경변수 완료 | 컨테이너 자동 생성 코드 포함 (`createIfNotExists`) |
| PostgreSQL (Prisma) | ❌ DB 미생성 / 연결 미설정 | Azure PostgreSQL Flexible Server 권장 |
| SharePoint | ❌ 환경변수 누락 | `SHAREPOINT_SITE_ID`, `SHAREPOINT_DRIVE_ID` 필요 |
| Outlook (알림) | ❌ 환경변수 누락 | `OUTLOOK_SENDER_UPN` 필요 |
| Microsoft Graph API | ⚠️ 클라이언트 코드 완성 / 권한 미확인 | 앱 등록 권한 추가 필요 |

---

## 6. 단계별 워크플랜

### ~~STEP 1 — NEXTAUTH_SECRET 생성~~ ✅ 완료

`openssl rand -base64 32`로 생성하여 `.env.local`에 설정 완료.

---

### STEP 2 — Entra ID 앱 권한 추가

**담당: Azure Portal 작업**

경로: `Azure Portal → Entra ID → 앱 등록 → 해당 앱 → API 권한 → 권한 추가 → Microsoft Graph`

추가할 권한 (애플리케이션 권한):

| API | 권한 이름 | 용도 |
|-----|-----------|------|
| Microsoft Graph | `Mail.Send` | Outlook 알림 이메일 발송 |
| Microsoft Graph | `Sites.ReadWrite.All` | SharePoint 파일 저장/읽기 |
| Microsoft Graph | `Files.ReadWrite.All` | SharePoint 드라이브 파일 접근 |
| Microsoft Graph | `User.Read.All` | 사용자 목록 조회 (Entra Picker) |
| Microsoft Graph | `Group.Read.All` | 그룹 목록 조회 |

> **중요**: 권한 추가 후 반드시 **"관리자 동의 부여"** 클릭

---

### STEP 3 — PostgreSQL 데이터베이스 생성

**담당: Azure Portal 작업**

경로: `Azure Portal → Azure Database for PostgreSQL Flexible Server → 리소스 만들기`

설정 권장사항:
- 인증: 암호 인증 또는 Microsoft Entra 인증
- SSL 강제 적용: 활성화
- 방화벽: 개발 환경 IP 허용, 또는 Azure 서비스 허용

생성 후 `.env.local`의 `DATABASE_URL` 에 연결 문자열 입력:
```
postgresql://<user>:<password>@<server>.postgres.database.azure.com:5432/<dbname>?sslmode=require
```

---

### STEP 4 — Prisma DB 마이그레이션 실행

**담당: 개발자 로컬 터미널 (STEP 3 완료 후)**

```bash
# 개발 환경
pnpm prisma migrate dev

# 프로덕션 환경
pnpm prisma migrate deploy

# 마이그레이션 상태 확인
pnpm prisma migrate status

# Prisma Studio (DB 데이터 확인용)
pnpm prisma studio
```

---

### STEP 5 — SharePoint Site ID / Drive ID 확인

**담당: Microsoft Graph Explorer 또는 API 호출**

Graph Explorer URL: https://developer.microsoft.com/en-us/graph/graph-explorer

1. 사이트 ID 확인:
```
GET https://graph.microsoft.com/v1.0/sites?search=*
```
응답의 `id` 값 → `SHAREPOINT_SITE_ID`

2. 드라이브 ID 확인 (사이트 ID 확인 후):
```
GET https://graph.microsoft.com/v1.0/sites/{siteId}/drives
```
응답의 `id` 값 → `SHAREPOINT_DRIVE_ID`

`.env.local`에 추가:
```env
SHAREPOINT_SITE_ID=<확인한 값>
SHAREPOINT_DRIVE_ID=<확인한 값>
```

---

### STEP 6 — Outlook 발신 계정 설정

**담당: M365 관리자 확인**

알림 이메일을 발송할 M365 계정의 UPN(User Principal Name, 이메일 주소) 확인.
- 전용 시스템 계정(예: `noreply@회사도메인.com`) 사용 권장
- 해당 계정에 `Mail.Send` 권한이 Entra 앱에 부여되어 있어야 함

`.env.local`에 추가:
```env
OUTLOOK_SENDER_UPN=<발신용 이메일>
```

---

### STEP 7 — 프로덕션 배포 시 NEXTAUTH_URL 변경

**담당: 배포 환경 설정**

로컬 개발 완료 후 프로덕션 배포 시:
```env
NEXTAUTH_URL=https://<실제 도메인>
```

---

## 7. 우선순위

| 순서 | 작업 | 이유 | 상태 |
|------|------|------|------|
| ~~1~~ | ~~`NEXTAUTH_SECRET` 생성~~ | ~~인증 자체가 동작하지 않음~~ | ✅ 완료 |
| 1 | Entra ID 앱 권한 추가 (관리자 동의) | Graph API 호출 전제조건 | ⏳ 미완료 |
| 2 | PostgreSQL 생성 + `DATABASE_URL` 설정 | 알림 서비스가 Prisma에 의존 | ⏳ 미완료 |
| 3 | `pnpm prisma migrate dev` 실행 | DB 스키마 생성 | ⏳ 미완료 |
| 4 | SharePoint ID 확인 + 환경변수 추가 | 파일 업로드 기능 동작 | ⏳ 미완료 |
| 5 | `OUTLOOK_SENDER_UPN` 설정 | 알림 이메일 발송 | ⏳ 미완료 |

---

## 8. 실행 명령어 모음

```bash
# 개발 서버 실행
pnpm dev

# NEXTAUTH_SECRET 생성
openssl rand -base64 32

# Prisma 마이그레이션 (개발)
pnpm prisma migrate dev

# Prisma 마이그레이션 (프로덕션)
pnpm prisma migrate deploy

# Prisma 마이그레이션 상태 확인
pnpm prisma migrate status

# Prisma 클라이언트 재생성
pnpm prisma generate

# Prisma Studio (DB GUI)
pnpm prisma studio

# 빌드
pnpm build

# 린트 검사
pnpm lint
```

---

## 9. 체크리스트

### 환경변수
- [x] `NEXTAUTH_SECRET` — 설정 완료
- [ ] `DATABASE_URL` — PostgreSQL 생성 후 연결 문자열 입력
- [ ] `SHAREPOINT_SITE_ID` — Graph Explorer에서 확인
- [ ] `SHAREPOINT_DRIVE_ID` — Graph Explorer에서 확인
- [ ] `OUTLOOK_SENDER_UPN` — M365 관리자에게 확인

### Azure Portal 작업
- [ ] Entra ID 앱에 `Mail.Send` 권한 추가 + 관리자 동의
- [ ] Entra ID 앱에 `Sites.ReadWrite.All` 권한 추가 + 관리자 동의
- [ ] Entra ID 앱에 `Files.ReadWrite.All` 권한 추가 + 관리자 동의
- [ ] Entra ID 앱에 `User.Read.All` 권한 추가 + 관리자 동의
- [ ] Entra ID 앱에 `Group.Read.All` 권한 추가 + 관리자 동의
- [ ] PostgreSQL Flexible Server 생성
- [ ] 방화벽 규칙 설정 (개발 IP 허용)

### 코드/DB 작업
- [ ] `pnpm prisma migrate dev` 실행 (DB 스키마 생성)
- [ ] 앱 정상 구동 확인 (`pnpm dev`)
- [ ] Cosmos DB 연결 확인 (파일 업로드 테스트)
- [ ] SharePoint 파일 동기화 확인
- [ ] Outlook 알림 이메일 발송 테스트

---

## 10. 리스크 및 주의사항

| 항목 | 내용 |
|------|------|
| **Cosmos DB 컨테이너명** | 현재 코드는 `files`로 고정. 기존 데이터가 있다면 컨테이너명 불일치 가능성 확인 필요 |
| **SharePoint 파일 동기화** | `base64Content`가 없는 5MB 초과 파일은 Cosmos DB에만 메타 저장되고 SharePoint 동기화 미수행 (`lib/microsoft-graph.ts` 확인 필요) |
| **PostgreSQL SSL** | Azure PostgreSQL은 기본적으로 SSL 강제. `?sslmode=require` 연결 문자열에 포함 필수 |
| **Prisma 마이그레이션** | `prisma migrate dev`는 개발 전용. 프로덕션은 반드시 `migrate deploy` 사용 |
| **NEXTAUTH_URL** | 로컬 개발 시 `http://localhost:3000`, 배포 시 실제 도메인으로 변경 필요 |
| **앱 권한 vs 위임 권한** | `lib/microsoft-graph.ts`는 `ClientSecretCredential` 사용 → 애플리케이션 권한(Application permission) 으로 추가해야 함 (위임 권한 아님) |
| **Client Secret 만료** | Entra ID Client Secret은 만료일이 있음. Azure Portal에서 만료일 확인 및 갱신 관리 필요 |

---

## 11. 다음 세션에서 사용할 프롬프트

```
docs/setup-workplan.md 파일을 먼저 읽어줘.

이 프로젝트는 Next.js 기반 B2B 영업 로드맵 앱이고,
현재 아래 작업이 완료되어 있어:
- Azure Entra ID 앱 등록 및 환경변수 설정 완료
- Cosmos DB 연결 환경변수 설정 완료

다음으로 해야 할 작업을 setup-workplan.md의 우선순위 순서대로 진행해줘.
현재 진행하려는 단계는 [STEP X — 작업명] 이야.
```

> 위 프롬프트에서 `[STEP X — 작업명]` 부분을 현재 진행할 단계로 교체해서 사용하세요.
