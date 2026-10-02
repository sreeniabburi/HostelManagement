import { readFile } from 'node:fs/promises'

const config = await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8')
const match = config.match(/"database_id"\s*:\s*"([^"]+)"/)
const databaseId = match?.[1]

if (!databaseId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(databaseId)
  || databaseId === '00000000-0000-0000-0000-000000000001') {
  console.error('Deploy blocked: replace app/wrangler.jsonc database_id with the real D1 ID for this deployment.')
  process.exitCode = 1
} else {
  console.log('D1 deployment configuration is present.')
}
