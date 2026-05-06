const { ClientSecretCredential } = require('@azure/identity')

async function graph(method, url, token, body, extraHeaders = {}) {
  const headers = { Authorization: `Bearer ${token}`, ...extraHeaders }
  const init = { method, headers }
  if (body !== undefined) init.body = body

  const res = await fetch(url, init)
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = null
  }

  return { ok: res.ok, status: res.status, text, json }
}

function requiredEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env: ${name}`)
  return value
}

async function main() {
  const tenantId = requiredEnv('ENTRA_TENANT_ID')
  const clientId = requiredEnv('ENTRA_CLIENT_ID')
  const clientSecret = requiredEnv('ENTRA_CLIENT_SECRET')
  const driveId = requiredEnv('SHAREPOINT_DRIVE_ID')
  const sender = requiredEnv('OUTLOOK_SENDER_UPN')

  const rootFolder = process.env.SHAREPOINT_ROOT_FOLDER || 'milestone-files'

  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret)
  const tokenResp = await credential.getToken('https://graph.microsoft.com/.default')
  const token = tokenResp.token

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const fileName = `copilot-test-${stamp}.txt`
  const targetPath = `${rootFolder}/connectivity-tests/${fileName}`
  const encodedPath = targetPath.split('/').map(encodeURIComponent).join('/')
  const content = `Copilot integration test at ${new Date().toISOString()}\n`

  const createFolder = await graph(
    'POST',
    `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/root:/${encodeURIComponent(rootFolder)}:/children`,
    token,
    JSON.stringify({
      name: 'connectivity-tests',
      folder: {},
      '@microsoft.graph.conflictBehavior': 'replace',
    }),
    { 'Content-Type': 'application/json' }
  )

  const upload = await graph(
    'PUT',
    `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/root:/${encodedPath}:/content`,
    token,
    content,
    { 'Content-Type': 'text/plain; charset=utf-8' }
  )

  const readback = await graph(
    'GET',
    `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/root:/${encodedPath}?$select=id,name,size,webUrl,lastModifiedDateTime`,
    token
  )

  const remove = await graph(
    'DELETE',
    `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/root:/${encodedPath}:/`,
    token
  )

  const sendMail = await graph(
    'POST',
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,
    token,
    JSON.stringify({
      message: {
        subject: `[TEST] Copilot Outlook integration ${stamp}`,
        body: {
          contentType: 'HTML',
          content: `<p>Outlook integration test at ${new Date().toISOString()}</p>`,
        },
        toRecipients: [{ emailAddress: { address: sender } }],
      },
      saveToSentItems: true,
    }),
    { 'Content-Type': 'application/json' }
  )

  const result = {
    sharePoint: {
      folderCreate: { ok: createFolder.ok, status: createFolder.status },
      upload: {
        ok: upload.ok,
        status: upload.status,
        name: upload.json?.name,
        webUrl: upload.json?.webUrl,
      },
      readback: {
        ok: readback.ok,
        status: readback.status,
        name: readback.json?.name,
        size: readback.json?.size,
      },
      delete: { ok: remove.ok, status: remove.status },
      testedPath: targetPath,
    },
    outlook: {
      sendMail: { ok: sendMail.ok, status: sendMail.status },
      sender,
      recipient: sender,
    },
  }

  console.log(JSON.stringify(result, null, 2))

  const pass = upload.ok && readback.ok && remove.ok && (sendMail.ok || sendMail.status === 202)
  if (!pass) {
    if (!upload.ok) console.error('SharePoint upload error:', upload.text)
    if (!readback.ok) console.error('SharePoint readback error:', readback.text)
    if (!remove.ok) console.error('SharePoint delete error:', remove.text)
    if (!(sendMail.ok || sendMail.status === 202)) console.error('Outlook sendMail error:', sendMail.text)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error))
  process.exit(1)
})
