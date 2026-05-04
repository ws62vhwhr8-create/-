#!/usr/bin/env node

const fs = require("fs")
const path = require("path")

function loadDotEnvLocal(projectRoot) {
  const envPath = path.join(projectRoot, ".env.local")
  if (!fs.existsSync(envPath)) return

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/)
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith("#")) continue
    const eqIdx = line.indexOf("=")
    if (eqIdx <= 0) continue

    const key = line.slice(0, eqIdx).trim()
    let value = line.slice(eqIdx + 1).trim()

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    if (typeof process.env[key] === "undefined") {
      process.env[key] = value
    }
  }
}

function decodeJwtPayload(token) {
  const parts = token.split(".")
  if (parts.length < 2) return null
  const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/")
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4)
  const json = Buffer.from(padded, "base64").toString("utf8")
  return JSON.parse(json)
}

function printSection(title) {
  console.log(`\n=== ${title} ===`)
}

function ok(msg) {
  console.log(`OK   ${msg}`)
}

function warn(msg) {
  console.log(`WARN ${msg}`)
}

function fail(msg) {
  console.log(`FAIL ${msg}`)
}

async function checkGraphPermissions() {
  printSection("Entra Graph 권한 점검")

  const required = [
    "Mail.Send",
    "Sites.ReadWrite.All",
    "Files.ReadWrite.All",
    "User.Read.All",
    "Group.Read.All",
  ]

  const tenantId = process.env.ENTRA_TENANT_ID
  const clientId = process.env.ENTRA_CLIENT_ID
  const clientSecret = process.env.ENTRA_CLIENT_SECRET

  if (!tenantId || !clientId || !clientSecret) {
    warn("ENTRA_TENANT_ID / ENTRA_CLIENT_ID / ENTRA_CLIENT_SECRET 중 일부가 없어 Graph 권한 점검을 건너뜁니다.")
    return { passed: false, skipped: true }
  }

  try {
    const { ClientSecretCredential } = require("@azure/identity")
    const credential = new ClientSecretCredential(tenantId, clientId, clientSecret)
    const tokenResp = await credential.getToken("https://graph.microsoft.com/.default")
    const payload = decodeJwtPayload(tokenResp.token)
    const roles = Array.isArray(payload?.roles) ? payload.roles : []

    let allOk = true
    for (const role of required) {
      if (roles.includes(role)) {
        ok(`${role} 권한 확인됨`)
      } else {
        allOk = false
        fail(`${role} 권한 미확인 (Azure Portal에서 Application permission + 관리자 동의 필요)`)
      }
    }

    return { passed: allOk, skipped: false }
  } catch (error) {
    fail(`Graph 토큰 확인 실패: ${error.message}`)
    return { passed: false, skipped: false }
  }
}

async function checkPrisma() {
  printSection("Prisma DB 연결 점검")

  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("<")) {
    fail("DATABASE_URL 미설정 또는 placeholder 상태")
    return false
  }

  let prisma
  try {
    const { PrismaClient } = require("@prisma/client")
    prisma = new PrismaClient()
    await prisma.$queryRawUnsafe("SELECT 1")
    ok("PostgreSQL 연결 성공")
    return true
  } catch (error) {
    fail(`PostgreSQL 연결 실패: ${error.message}`)
    return false
  } finally {
    if (prisma) {
      await prisma.$disconnect().catch(() => undefined)
    }
  }
}

async function checkCosmos() {
  printSection("Cosmos DB 연결 점검")

  const endpoint = process.env.COSMOS_DB_ENDPOINT
  const key = process.env.COSMOS_DB_KEY
  const databaseId = process.env.COSMOS_DB_DATABASE

  if (!endpoint || !key || !databaseId) {
    fail("COSMOS_DB_ENDPOINT / COSMOS_DB_KEY / COSMOS_DB_DATABASE 중 일부 누락")
    return false
  }

  try {
    const { CosmosClient } = require("@azure/cosmos")
    const client = new CosmosClient({ endpoint, key })
    await client.database(databaseId).read()
    ok("Cosmos DB 연결 성공")
    return true
  } catch (error) {
    fail(`Cosmos DB 연결 실패: ${error.message}`)
    return false
  }
}

function checkSharepointEnv() {
  printSection("SharePoint/Outlook 환경변수 점검")

  let pass = true

  const sharepointSiteId = process.env.SHAREPOINT_SITE_ID
  const sharepointDriveId = process.env.SHAREPOINT_DRIVE_ID
  const outlookSender = process.env.OUTLOOK_SENDER_UPN

  if (sharepointSiteId) ok("SHAREPOINT_SITE_ID 설정됨")
  else {
    pass = false
    fail("SHAREPOINT_SITE_ID 누락")
  }

  if (sharepointDriveId) ok("SHAREPOINT_DRIVE_ID 설정됨")
  else {
    pass = false
    fail("SHAREPOINT_DRIVE_ID 누락")
  }

  if (outlookSender) ok("OUTLOOK_SENDER_UPN 설정됨")
  else {
    pass = false
    fail("OUTLOOK_SENDER_UPN 누락")
  }

  return pass
}

function checkCoreEnv() {
  printSection("핵심 환경변수 점검")

  const required = [
    "ENTRA_TENANT_ID",
    "ENTRA_CLIENT_ID",
    "ENTRA_CLIENT_SECRET",
    "NEXTAUTH_URL",
    "NEXTAUTH_SECRET",
  ]

  let pass = true
  for (const key of required) {
    const value = process.env[key]
    if (!value || value.includes("<")) {
      pass = false
      fail(`${key} 누락 또는 placeholder 상태`)
    } else {
      ok(`${key} 설정됨`)
    }
  }

  return pass
}

async function main() {
  const projectRoot = process.cwd()
  loadDotEnvLocal(projectRoot)

  console.log("Setup Workplan 자동 점검 시작")

  const coreOk = checkCoreEnv()
  const graphResult = await checkGraphPermissions()
  const prismaOk = await checkPrisma()
  const cosmosOk = await checkCosmos()
  const sharepointOk = checkSharepointEnv()

  printSection("요약")
  console.log(`- 핵심 환경변수: ${coreOk ? "OK" : "FAIL"}`)
  console.log(`- Graph 권한: ${graphResult.passed ? "OK" : graphResult.skipped ? "SKIP" : "FAIL"}`)
  console.log(`- Prisma 연결: ${prismaOk ? "OK" : "FAIL"}`)
  console.log(`- Cosmos 연결: ${cosmosOk ? "OK" : "FAIL"}`)
  console.log(`- SharePoint/Outlook 변수: ${sharepointOk ? "OK" : "FAIL"}`)

  const allOk = coreOk && graphResult.passed && prismaOk && cosmosOk && sharepointOk
  if (!allOk) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
