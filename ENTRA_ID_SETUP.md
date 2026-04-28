# Entra ID 통합 설정 가이드

## 📋 필수 설정 단계

### 1️⃣ Entra ID 애플리케이션 등록 (Azure Portal)

**Azure Portal에서:**
- Azure Active Directory → 앱 등록 → 새 등록
- 앱 이름: `B2B Sales Roadmap`
- 지원되는 계정 유형: "이 조직의 디렉터리에만"
- 리디렉션 URI: `http://localhost:3000/api/auth/callback/azure-ad`

**등록 후 필요한 정보:**
1. 개요 탭에서 **클라이언트 ID** (Client ID) 복사
2. 개요 탭에서 **테넌트 ID** (Tenant ID) 복사
3. 인증서 및 비밀 → 새 클라이언트 비밀 추가
4. 비밀 값 복사 (한 번만 표시됨)
5. API 권한 추가: User.Read.All, Group.Read.All (Microsoft Graph)

### 2️⃣ 환경 변수 설정

`.env.local` 파일을 다음과 같이 업데이트:

```
# Entra ID Configuration
ENTRA_TENANT_ID=<Azure Portal에서 복사한 Tenant ID>
ENTRA_CLIENT_ID=<Azure Portal에서 복사한 Client ID>
ENTRA_CLIENT_SECRET=<Azure Portal에서 복사한 Client Secret>

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<아래 명령으로 생성>

# Database Configuration (PostgreSQL)
DATABASE_URL=postgresql://username:password@localhost:5432/b2b_sales_roadmap

# Sync Token (API 보안)
SYNC_SECRET_TOKEN=your-secure-sync-token
```

**NEXTAUTH_SECRET 생성:**
```bash
openssl rand -base64 32
```

### 3️⃣ PostgreSQL 설정

**로컬 PostgreSQL 시작:**
```bash
# macOS (Homebrew)
brew services start postgresql

# 데이터베이스 생성
createdb b2b_sales_roadmap

# 데이터베이스 사용자 생성 (선택사항)
createuser b2b_user
psql -U postgres -c "ALTER USER b2b_user WITH PASSWORD 'password';"
```

### 4️⃣ Prisma 마이그레이션

```bash
# 초기 마이그레이션 생성
npx prisma migrate dev --name init

# 또는 스키마 푸시 (개발 환경)
npx prisma db push

# Prisma Studio 열기 (데이터 확인)
npx prisma studio
```

### 5️⃣ 초기 데이터 동기화

Entra ID에서 사용자 및 그룹을 데이터베이스로 동기화:

```bash
# 개발 서버 시작
npm run dev

# 새 터미널에서 동기화 API 호출
curl -X POST http://localhost:3000/api/entra/sync \
  -H "Authorization: Bearer your-secure-sync-token" \
  -H "Content-Type: application/json"
```

## 🔑 주요 API 엔드포인트

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/api/auth/signin` | GET | 로그인 페이지 |
| `/api/auth/callback/azure-ad` | GET | 인증 콜백 |
| `/api/auth/session` | GET | 현재 세션 정보 |
| `/api/entra/sync` | POST | Entra ID와 DB 동기화 |
| `/api/entra/users` | GET | 모든 사용자 조회 |
| `/api/entra/groups` | GET | 모든 그룹 조회 |
| `/api/solutions/[id]/access` | GET/POST/DELETE | 솔루션 접근 권한 관리 |

## 📝 다음 단계

1. ✅ Entra ID 앱 등록 완료
2. ✅ 환경 변수 설정
3. ✅ PostgreSQL 설정
4. ✅ Prisma 마이그레이션 실행
5. ⏳ UI 컴포넌트 업데이트 (EntraPicker, Solutions access control)
6. ⏳ 사용자 관리 페이지 업데이트
7. ⏳ 솔루션 관리 페이지 업데이트

## 🐛 문제 해결

**Prisma 마이그레이션 에러:**
```bash
# 마이그레이션 리셋 (개발 환경에서만)
npx prisma migrate reset
```

**Microsoft Graph API 권한 에러:**
- Azure Portal에서 API 권한 다시 확인
- 관리자 동의 부여 필요 (앱이 테스트 상태인 경우)

**Entra ID 연결 실패:**
- ENTRA_TENANT_ID, ENTRA_CLIENT_ID, ENTRA_CLIENT_SECRET 확인
- Tenant ID와 Client ID 형식 확인 (UUID 형식)

---

**궁금한 점이 있으면 말씀해주세요!**
