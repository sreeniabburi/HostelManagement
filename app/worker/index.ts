interface Env {
  DB: D1Database
}

type User = {
  id: string
  name: string
  email: string
  role: 'admin' | 'staff'
}

type FloorInput = { name: string; roomCount: number }

class HttpError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const SESSION_COOKIE = 'hosteldesk_session'
const SESSION_SECONDS = 60 * 60 * 24 * 14
const PASSWORD_ITERATIONS = 100_000

function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      ...headers,
    },
  })
}

function cookieHeader(token: string, request: Request) {
  const secure = new URL(request.url).protocol === 'https:'
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure ? '; Secure' : ''}`
}

function expiredCookie(request: Request) {
  const secure = new URL(request.url).protocol === 'https:'
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`
}

function getCookie(request: Request, name: string) {
  const value = request.headers.get('Cookie')?.split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
  return value?.slice(name.length + 1)
}

function assertSameOrigin(request: Request) {
  const origin = request.headers.get('Origin')
  if (origin && origin !== new URL(request.url).origin) {
    throw new HttpError(403, 'Request origin is not allowed.')
  }
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('Content-Type')?.toLowerCase().includes('application/json')) {
    throw new HttpError(415, 'Send request data as JSON.')
  }
  try {
    const value: unknown = await request.json()
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new HttpError(400, 'Request body must be a JSON object.')
    }
    return value as Record<string, unknown>
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(400, 'Request body contains invalid JSON.')
  }
}

function requiredText(value: unknown, label: string, maxLength: number) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw new HttpError(400, `${label} is required and must be at most ${maxLength} characters.`)
  }
  return value.trim()
}

function normalizeEmail(value: unknown) {
  const email = requiredText(value, 'Email', 254).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, 'Enter a valid email address.')
  }
  return email
}

function validSharing(value: unknown) {
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 4) {
    throw new HttpError(400, 'Sharing must be between 1 and 4.')
  }
  return Number(value)
}

function validFloors(value: unknown): FloorInput[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) {
    throw new HttpError(400, 'Configure between 1 and 20 floors.')
  }
  const floors = value.map((floor, index) => {
    if (!floor || typeof floor !== 'object' || Array.isArray(floor)) {
      throw new HttpError(400, 'Each floor needs a name and room count.')
    }
    const entry = floor as Record<string, unknown>
    const name = requiredText(entry.name, `Floor ${index + 1} name`, 80)
    const roomCount = entry.roomCount
    if (!Number.isInteger(roomCount) || Number(roomCount) < 1 || Number(roomCount) > 99) {
      throw new HttpError(400, `Floor ${index + 1} must have between 1 and 99 rooms.`)
    }
    return { name, roomCount: Number(roomCount) }
  })
  if (new Set(floors.map((floor) => floor.name.toLowerCase())).size !== floors.length) {
    throw new HttpError(400, 'Floor names must be unique within a hostel.')
  }
  if (floors.reduce((count, floor) => count + floor.roomCount, 0) > 500) {
    throw new HttpError(400, 'A hostel can have at most 500 rooms.')
  }
  return floors
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
}

async function hashPassword(password: string) {
  if (password.length < 12 || password.length > 128) {
    throw new HttpError(400, 'Password must be between 12 and 128 characters.')
  }
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PASSWORD_ITERATIONS },
    key,
    256,
  )
  return `pbkdf2-sha256$${PASSWORD_ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(new Uint8Array(derived))}`
}

async function verifyPassword(password: string, stored: string) {
  const [algorithm, iterationsValue, saltValue, expectedValue] = stored.split('$')
  const iterations = Number(iterationsValue)
  if (algorithm !== 'pbkdf2-sha256' || !Number.isInteger(iterations) || iterations < 100_000 || iterations > 1_000_000 || !saltValue || !expectedValue) {
    return false
  }
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: base64ToBytes(saltValue), iterations },
    key,
    256,
  )
  const actual = new Uint8Array(derived)
  const expected = base64ToBytes(expectedValue)
  return actual.length === expected.length && actual.every((byte, index) => byte === expected[index])
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return bytesToBase64(new Uint8Array(digest))
}

async function getUser(request: Request, db: D1Database): Promise<User | null> {
  const token = getCookie(request, SESSION_COOKIE)
  if (!token) return null
  const tokenHash = await sha256(token)
  const row = await db.prepare(
    `SELECT u.id, u.name, u.email, u.role
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1`,
  ).bind(tokenHash, Math.floor(Date.now() / 1000)).first<User>()
  return row
}

async function requireUser(request: Request, db: D1Database) {
  const user = await getUser(request, db)
  if (!user) throw new HttpError(401, 'Sign in to continue.')
  return user
}

function requireAdmin(user: User) {
  if (user.role !== 'admin') throw new HttpError(403, 'Administrator access is required for this action.')
}

async function createSession(db: D1Database, user: User, request: Request) {
  const token = bytesToBase64(crypto.getRandomValues(new Uint8Array(32))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
  const tokenHash = await sha256(token)
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS
  await db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(tokenHash, user.id, expiresAt).run()
  return json({ user }, 200, { 'Set-Cookie': cookieHeader(token, request) })
}

async function authStatus(request: Request, db: D1Database) {
  const user = await getUser(request, db)
  if (user) return json({ setupRequired: false, user })
  const count = await db.prepare('SELECT COUNT(*) AS count FROM users').first<{ count: number }>()
  return json({ setupRequired: Number(count?.count ?? 0) === 0, user: null })
}

async function bootstrapAdmin(request: Request, db: D1Database) {
  assertSameOrigin(request)
  const body = await readJson(request)
  const name = requiredText(body.name, 'Name', 100)
  const email = normalizeEmail(body.email)
  const bootstrapState = await db.prepare("SELECT value FROM app_metadata WHERE key = 'admin_bootstrap'").first<{ value: string }>()
  if (bootstrapState?.value !== 'pending') {
    throw new HttpError(409, 'Administrator setup has already been completed.')
  }
  if (typeof body.password !== 'string') throw new HttpError(400, 'Password is required.')
  const passwordHash = await hashPassword(body.password)
  const id = crypto.randomUUID()
  const claim = crypto.randomUUID()

  const results = await db.batch([
    db.prepare("UPDATE app_metadata SET value = ? WHERE key = 'admin_bootstrap' AND value = 'pending'").bind(claim),
    db.prepare(
      `INSERT INTO users (id, name, email, password_hash, role)
       SELECT ?, ?, ?, ?, 'admin'
       WHERE (SELECT value FROM app_metadata WHERE key = 'admin_bootstrap') = ?`,
    ).bind(id, name, email, passwordHash, claim),
    db.prepare("UPDATE app_metadata SET value = 'complete' WHERE key = 'admin_bootstrap' AND value = ?").bind(claim),
  ])
  if (Number(results[0].meta.changes ?? 0) !== 1 || Number(results[1].meta.changes ?? 0) !== 1) {
    throw new HttpError(409, 'Administrator setup has already been completed.')
  }
  return createSession(db, { id, name, email, role: 'admin' }, request)
}

async function login(request: Request, db: D1Database) {
  assertSameOrigin(request)
  const body = await readJson(request)
  const email = normalizeEmail(body.email)
  if (typeof body.password !== 'string' || body.password.length > 128) {
    throw new HttpError(400, 'Enter a valid email and password.')
  }
  const now = Math.floor(Date.now() / 1000)
  const identityHash = await sha256(`${email}:${request.headers.get('CF-Connecting-IP') ?? 'unknown'}`)
  const limit = await db.prepare('SELECT failed_attempts, window_started_at, locked_until FROM login_limits WHERE identity_hash = ?')
    .bind(identityHash).first<{ failed_attempts: number; window_started_at: number; locked_until: number }>()
  if (limit && Number(limit.locked_until) > now) {
    throw new HttpError(429, 'Too many sign-in attempts. Wait 15 minutes before trying again.')
  }
  const row = await db.prepare('SELECT id, name, email, role, password_hash FROM users WHERE email = ? COLLATE NOCASE')
    .bind(email).first<User & { password_hash: string }>()
  const verified = row ? await verifyPassword(body.password, row.password_hash) : false
  if (!row || !verified) {
    const withinWindow = limit && Number(limit.window_started_at) > now - 900
    const failedAttempts = withinWindow ? Number(limit.failed_attempts) + 1 : 1
    await db.prepare(
      `INSERT INTO login_limits (identity_hash, failed_attempts, window_started_at, locked_until)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(identity_hash) DO UPDATE SET
         failed_attempts = excluded.failed_attempts,
         window_started_at = excluded.window_started_at,
         locked_until = excluded.locked_until`,
    ).bind(identityHash, failedAttempts, withinWindow ? Number(limit.window_started_at) : now, failedAttempts >= 8 ? now + 900 : 0).run()
    throw new HttpError(401, 'Email or password is incorrect.')
  }
  await db.prepare('DELETE FROM login_limits WHERE identity_hash = ?').bind(identityHash).run()
  return createSession(db, { id: row.id, name: row.name, email: row.email, role: row.role }, request)
}

async function logout(request: Request, db: D1Database) {
  assertSameOrigin(request)
  const token = getCookie(request, SESSION_COOKIE)
  if (token) await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run()
  return json({ ok: true }, 200, { 'Set-Cookie': expiredCookie(request) })
}

async function changePassword(request: Request, db: D1Database, user: User) {
  assertSameOrigin(request)
  const body = await readJson(request)
  if (typeof body.currentPassword !== 'string' || body.currentPassword.length > 128) {
    throw new HttpError(400, 'Enter your current password.')
  }
  if (typeof body.newPassword !== 'string') throw new HttpError(400, 'Enter a new password.')
  const row = await db.prepare('SELECT password_hash FROM users WHERE id = ? AND active = 1')
    .bind(user.id).first<{ password_hash: string }>()
  if (!row || !await verifyPassword(body.currentPassword, row.password_hash)) {
    throw new HttpError(403, 'Current password is incorrect.')
  }
  const passwordHash = await hashPassword(body.newPassword)
  const results = await db.batch([
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ? AND active = 1 AND password_hash = ?')
      .bind(passwordHash, user.id, row.password_hash),
    db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
  ])
  if (Number(results[0].meta.changes ?? 0) !== 1) throw new HttpError(409, 'Password changed while updating. Sign in again.')
  return createSession(db, user, request)
}

type HostelRow = { id: string; name: string; address: string }
type RoomRow = { id: string; number: string; sharing: number; floor_id: string; floor_name: string }
type BedRow = {
  id: string
  room_id: string
  label: string
  status: 'Occupied' | 'Vacant' | 'Reserved' | 'Maintenance'
  guest_name?: string
  arrival_date?: string
  departure_date?: string
}

async function requireHostelAccess(user: User, hostelId: string, db: D1Database) {
  if (user.role === 'admin') return
  const membership = await db.prepare('SELECT 1 FROM user_hostels WHERE user_id = ? AND hostel_id = ?')
    .bind(user.id, hostelId).first()
  if (!membership) throw new HttpError(403, 'You do not have access to this hostel.')
}

async function listHostels(user: User, db: D1Database) {
  const hostels = user.role === 'admin'
    ? await db.prepare('SELECT id, name, address FROM hostels ORDER BY created_at, name').all<HostelRow>()
    : await db.prepare(
      `SELECT h.id, h.name, h.address FROM hostels h
       JOIN user_hostels uh ON uh.hostel_id = h.id
       WHERE uh.user_id = ? ORDER BY h.created_at, h.name`,
    ).bind(user.id).all<HostelRow>()
  const result = []
  for (const hostel of hostels.results) {
    const floors = await db.prepare('SELECT name FROM floors WHERE hostel_id = ? ORDER BY position').bind(hostel.id).all<{ name: string }>()
    result.push({ ...hostel, floors: floors.results.map((floor) => floor.name) })
  }
  return json({ hostels: result })
}

async function getHostelRooms(db: D1Database, hostelId: string, asOnDate = new Date().toISOString().slice(0, 10)) {
  const hostel = await db.prepare('SELECT id FROM hostels WHERE id = ?').bind(hostelId).first<{ id: string }>()
  if (!hostel) throw new HttpError(404, 'Hostel not found.')
  const floorRows = await db.prepare('SELECT id, name FROM floors WHERE hostel_id = ? ORDER BY position')
    .bind(hostelId).all<{ id: string; name: string }>()
  const roomRows = await db.prepare(
    `SELECT r.id, r.number, r.sharing, r.floor_id, f.name AS floor_name
     FROM rooms r JOIN floors f ON f.id = r.floor_id
     WHERE r.hostel_id = ? ORDER BY f.position, r.number`,
  ).bind(hostelId).all<RoomRow>()
  const bedRows = await db.prepare(
    `SELECT b.id, b.room_id, b.label,
       CASE WHEN current_booking.status = 'Checked in' THEN 'Occupied'
            WHEN current_booking.status = 'Reserved' THEN 'Reserved'
            ELSE b.status END AS status,
       current_booking.guest_name, current_booking.arrival_date, current_booking.departure_date
     FROM beds b JOIN rooms r ON r.id = b.room_id
     LEFT JOIN (
       SELECT bk.bed_id, bk.status, bk.arrival_date, bk.departure_date, g.name AS guest_name
       FROM bookings bk JOIN guests g ON g.id = bk.guest_id
       WHERE bk.status IN ('Reserved', 'Checked in')
         AND bk.arrival_date <= ? AND bk.departure_date > ?
     ) current_booking ON current_booking.bed_id = b.id
     WHERE r.hostel_id = ? ORDER BY b.label`,
  ).bind(asOnDate, asOnDate, hostelId).all<BedRow>()
  const bedsByRoom = new Map<string, BedRow[]>()
  for (const bed of bedRows.results) bedsByRoom.set(bed.room_id, [...(bedsByRoom.get(bed.room_id) ?? []), bed])
  return json({
    floors: floorRows.results.map((floor) => ({
      name: floor.name,
      rooms: roomRows.results.filter((room) => room.floor_id === floor.id).map((room) => ({
        id: room.id,
        number: room.number,
        sharing: room.sharing,
        beds: (bedsByRoom.get(room.id) ?? []).map(({ id, label, status, guest_name, arrival_date, departure_date }) => ({
          id,
          label,
          status,
          ...(guest_name ? { guest: guest_name } : {}),
          ...(arrival_date && departure_date ? { stay: `${arrival_date} to ${departure_date}` } : {}),
        })),
      })),
    })),
  })
}

async function listStaff(db: D1Database) {
  const staff = await db.prepare(
    `SELECT id, name, email, active FROM users WHERE role = 'staff' ORDER BY created_at DESC`,
  ).all<{ id: string; name: string; email: string; active: number }>()
  const results = await Promise.all(staff.results.map(async (user) => {
    const assignments = await db.prepare(
      `SELECT h.id, h.name FROM user_hostels uh
       JOIN hostels h ON h.id = uh.hostel_id WHERE uh.user_id = ? ORDER BY h.name`,
    ).bind(user.id).all<{ id: string; name: string }>()
    return { ...user, active: Boolean(user.active), hostels: assignments.results }
  }))
  return json({ staff: results })
}

async function createStaff(request: Request, db: D1Database) {
  assertSameOrigin(request)
  const body = await readJson(request)
  const name = requiredText(body.name, 'Name', 100)
  const email = normalizeEmail(body.email)
  if (typeof body.password !== 'string') throw new HttpError(400, 'Password is required.')
  const passwordHash = await hashPassword(body.password)
  if (!Array.isArray(body.hostelIds) || body.hostelIds.length < 1 || body.hostelIds.length > 100
    || body.hostelIds.some((id) => typeof id !== 'string' || !id.trim())
    || new Set(body.hostelIds).size !== body.hostelIds.length) {
    throw new HttpError(400, 'Assign this staff account to at least one hostel.')
  }
  const hostelIds = body.hostelIds as string[]
  const placeholders = hostelIds.map(() => '?').join(', ')
  const hostels = await db.prepare(`SELECT id, name FROM hostels WHERE id IN (${placeholders})`)
    .bind(...hostelIds).all<{ id: string; name: string }>()
  if (hostels.results.length !== hostelIds.length) throw new HttpError(400, 'One or more selected hostels do not exist.')

  const userId = crypto.randomUUID()
  const statements: D1PreparedStatement[] = [
    db.prepare("INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, 'staff')")
      .bind(userId, name, email, passwordHash),
    ...hostelIds.map((hostelId) => db.prepare('INSERT INTO user_hostels (user_id, hostel_id) VALUES (?, ?)')
      .bind(userId, hostelId)),
  ]
  await db.batch(statements)
  return json({ staff: { id: userId, name, email, active: true, hostels: hostels.results } }, 201)
}

async function deactivateStaff(db: D1Database, userId: string) {
  const result = await db.prepare("UPDATE users SET active = 0 WHERE id = ? AND role = 'staff' AND active = 1")
    .bind(userId).run()
  if (Number(result.meta.changes ?? 0) !== 1) throw new HttpError(404, 'Active staff account not found.')
  await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run()
  return json({ ok: true })
}

async function resetStaffPassword(request: Request, db: D1Database, userId: string) {
  assertSameOrigin(request)
  const body = await readJson(request)
  if (typeof body.password !== 'string') throw new HttpError(400, 'Enter a new password.')
  const passwordHash = await hashPassword(body.password)
  const target = await db.prepare("SELECT id FROM users WHERE id = ? AND role = 'staff' AND active = 1")
    .bind(userId).first<{ id: string }>()
  if (!target) throw new HttpError(404, 'Active staff account not found.')
  const results = await db.batch([
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ? AND role = 'staff' AND active = 1").bind(passwordHash, userId),
    db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId),
  ])
  if (Number(results[0].meta.changes ?? 0) !== 1) throw new HttpError(404, 'Active staff account not found.')
  return json({ ok: true })
}

async function createHostel(request: Request, db: D1Database) {
  assertSameOrigin(request)
  const body = await readJson(request)
  const name = requiredText(body.name, 'Hostel name', 80)
  const address = typeof body.address === 'string' ? body.address.trim().slice(0, 200) : ''
  const floors = validFloors(body.floors)
  const hostelId = crypto.randomUUID()
  const statements: D1PreparedStatement[] = [
    db.prepare('INSERT INTO hostels (id, name, address) VALUES (?, ?, ?)').bind(hostelId, name, address),
  ]
  floors.forEach((floor, floorIndex) => {
    const floorId = crypto.randomUUID()
    statements.push(db.prepare('INSERT INTO floors (id, hostel_id, name, position) VALUES (?, ?, ?, ?)')
      .bind(floorId, hostelId, floor.name, floorIndex))
    for (let index = 0; index < floor.roomCount; index += 1) {
      const roomId = crypto.randomUUID()
      const roomNumber = String((floorIndex + 1) * 100 + index + 1)
      statements.push(db.prepare('INSERT INTO rooms (id, hostel_id, floor_id, number, sharing) VALUES (?, ?, ?, ?, 4)')
        .bind(roomId, hostelId, floorId, roomNumber))
      for (let bedIndex = 0; bedIndex < 4; bedIndex += 1) {
        statements.push(db.prepare('INSERT INTO beds (id, room_id, label, status) VALUES (?, ?, ?, \'Vacant\')')
          .bind(crypto.randomUUID(), roomId, `${roomNumber}-${String.fromCharCode(97 + bedIndex)}`))
      }
    }
  })
  await db.batch(statements)
  return json({ hostel: { id: hostelId, name, address, floors: floors.map((floor) => floor.name) } }, 201)
}

async function createRoom(request: Request, db: D1Database, hostelId: string) {
  assertSameOrigin(request)
  const body = await readJson(request)
  const floorName = requiredText(body.floor, 'Floor', 80)
  const roomNumber = requiredText(body.number, 'Room number', 32)
  const sharing = validSharing(body.sharing)
  const floor = await db.prepare('SELECT id FROM floors WHERE hostel_id = ? AND name = ?')
    .bind(hostelId, floorName).first<{ id: string }>()
  if (!floor) throw new HttpError(404, 'Floor not found in this hostel.')
  const id = crypto.randomUUID()
  const statements: D1PreparedStatement[] = [
    db.prepare('INSERT INTO rooms (id, hostel_id, floor_id, number, sharing) VALUES (?, ?, ?, ?, ?)')
      .bind(id, hostelId, floor.id, roomNumber, sharing),
  ]
  for (let index = 0; index < sharing; index += 1) {
    statements.push(db.prepare('INSERT INTO beds (id, room_id, label, status) VALUES (?, ?, ?, \'Vacant\')')
      .bind(crypto.randomUUID(), id, `${roomNumber}-${String.fromCharCode(97 + index)}`))
  }
  await db.batch(statements)
  return getHostelRooms(db, hostelId)
}

async function updateRoom(request: Request, db: D1Database, hostelId: string, roomId: string) {
  assertSameOrigin(request)
  const body = await readJson(request)
  const roomNumber = requiredText(body.number, 'Room number', 32)
  const sharing = validSharing(body.sharing)
  const room = await db.prepare('SELECT id, number, sharing FROM rooms WHERE id = ? AND hostel_id = ?')
    .bind(roomId, hostelId).first<{ id: string; number: string; sharing: number }>()
  if (!room) throw new HttpError(404, 'Room not found in this hostel.')
  const beds = await db.prepare('SELECT id, label, status FROM beds WHERE room_id = ? ORDER BY label')
    .bind(roomId).all<BedRow>()
  if (sharing < beds.results.length && beds.results.slice(sharing).some((bed) => bed.status !== 'Vacant')) {
    throw new HttpError(409, 'Cannot reduce room capacity while a bed being removed is not vacant.')
  }
  const statements: D1PreparedStatement[] = [
    db.prepare('UPDATE rooms SET number = ?, sharing = ? WHERE id = ? AND hostel_id = ?')
      .bind(roomNumber, sharing, roomId, hostelId),
  ]
  for (let index = 0; index < Math.min(sharing, beds.results.length); index += 1) {
    statements.push(db.prepare('UPDATE beds SET label = ? WHERE id = ?')
      .bind(`${roomNumber}-${String.fromCharCode(97 + index)}`, beds.results[index].id))
  }
  for (const bed of beds.results.slice(sharing)) {
    statements.push(db.prepare('DELETE FROM beds WHERE id = ? AND status = \'Vacant\'').bind(bed.id))
  }
  for (let index = beds.results.length; index < sharing; index += 1) {
    statements.push(db.prepare('INSERT INTO beds (id, room_id, label, status) VALUES (?, ?, ?, \'Vacant\')')
      .bind(crypto.randomUUID(), roomId, `${roomNumber}-${String.fromCharCode(97 + index)}`))
  }
  await db.batch(statements)
  return getHostelRooms(db, hostelId)
}

function validDate(value: unknown, label: string) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, `${label} must be a valid date.`)
  }
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, `${label} must be a valid date.`)
  }
  return value
}

async function availableBeds(db: D1Database, hostelId: string, arrival: string, departure: string) {
  validDate(arrival, 'Check-in date')
  validDate(departure, 'Check-out date')
  if (departure <= arrival) throw new HttpError(400, 'Check-out date must be after check-in date.')
  const rows = await db.prepare(
    `SELECT b.id, b.label, r.id AS room_id, r.number, r.sharing, f.name AS floor_name
     FROM beds b JOIN rooms r ON r.id = b.room_id JOIN floors f ON f.id = r.floor_id
     WHERE r.hostel_id = ? AND b.status = 'Vacant'
       AND NOT EXISTS (
         SELECT 1 FROM bookings bk
         WHERE bk.bed_id = b.id AND bk.status IN ('Reserved', 'Checked in')
           AND bk.arrival_date < ? AND bk.departure_date > ?
       )
     ORDER BY f.position, r.number, b.label`,
  ).bind(hostelId, departure, arrival).all<{
    id: string; label: string; room_id: string; number: string; sharing: number; floor_name: string
  }>()
  return rows.results
}

async function createBooking(request: Request, db: D1Database, user: User, hostelId: string) {
  assertSameOrigin(request)
  const body = await readJson(request)
  const name = requiredText(body.name, 'Guest name', 100)
  const email = normalizeEmail(body.email)
  const mobile = requiredText(body.mobile, 'Mobile number', 32)
  const address = requiredText(body.address, 'Address', 300)
  const emergency = requiredText(body.emergencyContact, 'Emergency contact', 32)
  const proof = requiredText(body.identityProof, 'Identity proof', 40)
  if (!['Aadhaar card', 'Driving licence', 'Voter ID', 'PAN card'].includes(proof)) {
    throw new HttpError(400, 'Select a supported identity proof type.')
  }
  const arrival = validDate(body.arrivalDate, 'Check-in date')
  const departure = validDate(body.departureDate, 'Check-out date')
  if (departure <= arrival) throw new HttpError(400, 'Check-out date must be after check-in date.')
  if (!Number.isSafeInteger(body.totalRentCents) || Number(body.totalRentCents) < 0 || Number(body.totalRentCents) > 100_000_000_000) {
    throw new HttpError(400, 'Enter a valid total rent amount.')
  }
  const bedId = requiredText(body.bedId, 'Bed', 64)
  const bed = await db.prepare(
    `SELECT b.id FROM beds b JOIN rooms r ON r.id = b.room_id
     WHERE b.id = ? AND r.hostel_id = ? AND b.status = 'Vacant'`,
  ).bind(bedId, hostelId).first<{ id: string }>()
  if (!bed) throw new HttpError(409, 'That bed is no longer available.')

  const bookingId = crypto.randomUUID()
  const reference = `BK-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
  let guest = await db.prepare('SELECT id FROM guests WHERE hostel_id = ? AND email = ? COLLATE NOCASE')
    .bind(hostelId, email).first<{ id: string }>()
  let createdGuest = false
  if (!guest) {
    const guestId = crypto.randomUUID()
    const insertResult = await db.prepare(
      `INSERT INTO guests (id, hostel_id, name, email, mobile, address, emergency_contact, identity_proof)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(hostel_id, email) DO NOTHING`,
    ).bind(guestId, hostelId, name, email, mobile, address, emergency, proof).run()
    createdGuest = Number(insertResult.meta.changes ?? 0) === 1
    guest = await db.prepare('SELECT id FROM guests WHERE hostel_id = ? AND email = ? COLLATE NOCASE')
      .bind(hostelId, email).first<{ id: string }>()
  }
  if (!guest) throw new Error('Guest profile could not be saved.')
  const bookingResult = await db.prepare(
    `INSERT INTO bookings
       (id, reference, hostel_id, guest_id, bed_id, arrival_date, departure_date, status, total_rent_cents, created_by)
     SELECT ?, ?, ?, ?, b.id, ?, ?, 'Reserved', ?, ?
     FROM beds b JOIN rooms r ON r.id = b.room_id
     WHERE b.id = ? AND r.hostel_id = ? AND b.status = 'Vacant'
       AND NOT EXISTS (
         SELECT 1 FROM bookings existing
         WHERE existing.bed_id = b.id AND existing.status IN ('Reserved', 'Checked in')
           AND existing.arrival_date < ? AND existing.departure_date > ?
       )`,
  ).bind(bookingId, reference, hostelId, guest.id, arrival, departure, Number(body.totalRentCents), user.id, bedId, hostelId, departure, arrival).run()
  if (Number(bookingResult.meta.changes ?? 0) !== 1) {
    if (createdGuest) {
      await db.prepare('DELETE FROM guests WHERE id = ? AND NOT EXISTS (SELECT 1 FROM bookings WHERE guest_id = ?)').bind(guest.id, guest.id).run()
    }
    throw new HttpError(409, 'That bed was booked for overlapping dates. Choose another bed or dates.')
  }
  if (!createdGuest) {
    await db.prepare(
      `UPDATE guests SET name = ?, mobile = ?, address = ?, emergency_contact = ?, identity_proof = ?,
       updated_at = CURRENT_TIMESTAMP WHERE id = ? AND hostel_id = ?`,
    ).bind(name, mobile, address, emergency, proof, guest.id, hostelId).run()
  }
  return json({ booking: { id: bookingId, reference, status: 'Reserved' } }, 201)
}

async function listBookings(db: D1Database, hostelId: string) {
  const rows = await db.prepare(
    `SELECT bk.id, bk.reference, bk.arrival_date, bk.departure_date, bk.status,
       bk.total_rent_cents, g.id AS guest_id, g.name AS guest_name, g.email, g.mobile,
       r.number AS room_number, r.sharing, b.label AS bed_label,
       COALESCE(SUM(p.amount_cents), 0) AS paid_cents
     FROM bookings bk JOIN guests g ON g.id = bk.guest_id
     JOIN beds b ON b.id = bk.bed_id JOIN rooms r ON r.id = b.room_id
     LEFT JOIN payments p ON p.booking_id = bk.id
     WHERE bk.hostel_id = ?
     GROUP BY bk.id
     ORDER BY bk.created_at DESC`,
  ).bind(hostelId).all<{
    id: string; reference: string; arrival_date: string; departure_date: string; status: string
    total_rent_cents: number; guest_id: string; guest_name: string; email: string; mobile: string
    room_number: string; sharing: number; bed_label: string; paid_cents: number
  }>()
  return json({ bookings: rows.results.map((row) => ({
    id: row.id,
    reference: row.reference,
    arrivalDate: row.arrival_date,
    departureDate: row.departure_date,
    status: row.status,
    totalRentCents: Number(row.total_rent_cents),
    paidCents: Number(row.paid_cents),
    outstandingCents: Math.max(0, Number(row.total_rent_cents) - Number(row.paid_cents)),
    guest: { id: row.guest_id, name: row.guest_name, email: row.email, mobile: row.mobile },
    room: row.room_number,
    bed: row.bed_label,
    sharing: row.sharing,
  })) })
}

async function updateBookingStatus(request: Request, db: D1Database, hostelId: string, bookingId: string) {
  assertSameOrigin(request)
  const body = await readJson(request)
  const status = body.status
  const transitions: Record<string, string[]> = {
    Reserved: ['Checked in', 'Cancelled'],
    'Checked in': ['Checked out'],
  }
  const current = await db.prepare('SELECT status, arrival_date, departure_date FROM bookings WHERE id = ? AND hostel_id = ?')
    .bind(bookingId, hostelId).first<{ status: string; arrival_date: string; departure_date: string }>()
  if (!current) throw new HttpError(404, 'Booking not found.')
  if (typeof status !== 'string' || !transitions[current.status]?.includes(status)) {
    throw new HttpError(409, `Cannot change a ${current.status.toLowerCase()} booking to that status.`)
  }
  const today = new Date().toISOString().slice(0, 10)
  if (status === 'Checked in' && (current.arrival_date > today || current.departure_date <= today)) {
    throw new HttpError(409, 'Check-in is only available during the booked stay dates.')
  }
  if (status === 'Cancelled') {
    const priorPayment = await db.prepare('SELECT 1 FROM payments WHERE booking_id = ? LIMIT 1').bind(bookingId).first()
    if (priorPayment) throw new HttpError(409, 'A booking with recorded payments cannot be cancelled. Resolve the outside-app payment first.')
  }
  const update = await db.prepare(
    `UPDATE bookings SET status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND hostel_id = ? AND status = ?
       AND (? != 'Cancelled' OR NOT EXISTS (SELECT 1 FROM payments WHERE booking_id = ?))`,
  ).bind(status, bookingId, hostelId, current.status, status, bookingId).run()
  if (Number(update.meta.changes ?? 0) !== 1) {
    throw new HttpError(409, 'Booking changed while updating. Refresh and try again.')
  }
  return json({ ok: true, status })
}

async function listGuests(db: D1Database, hostelId: string) {
  const rows = await db.prepare(
    `SELECT g.id, g.name, g.email, g.mobile, g.address, g.emergency_contact, g.identity_proof,
       g.created_at, COUNT(bk.id) AS booking_count,
       MAX(bk.created_at) AS last_booking_at
     FROM guests g LEFT JOIN bookings bk ON bk.guest_id = g.id
     WHERE g.hostel_id = ? GROUP BY g.id ORDER BY g.created_at DESC`,
  ).bind(hostelId).all<{
    id: string; name: string; email: string; mobile: string; address: string; emergency_contact: string
    identity_proof: string; created_at: string; booking_count: number; last_booking_at: string | null
  }>()
  return json({ guests: rows.results.map((guest) => ({
    id: guest.id, name: guest.name, email: guest.email, mobile: guest.mobile, address: guest.address,
    emergencyContact: guest.emergency_contact, identityProof: guest.identity_proof,
    bookingCount: Number(guest.booking_count), lastBookingAt: guest.last_booking_at,
  })) })
}

async function listPayments(db: D1Database, hostelId: string) {
  const rows = await db.prepare(
    `SELECT p.id, p.booking_id, p.amount_cents, p.method, p.received_on, p.note, p.created_at,
       g.name AS guest_name, bk.reference
     FROM payments p JOIN bookings bk ON bk.id = p.booking_id JOIN guests g ON g.id = bk.guest_id
     WHERE p.hostel_id = ? ORDER BY p.received_on DESC, p.created_at DESC`,
  ).bind(hostelId).all<{
    id: string; booking_id: string; amount_cents: number; method: string; received_on: string
    note: string; created_at: string; guest_name: string; reference: string
  }>()
  const outstanding = await db.prepare(
    `SELECT COALESCE(SUM(MAX(bk.total_rent_cents - COALESCE(p.paid_cents, 0), 0)), 0) AS amount_cents
     FROM bookings bk LEFT JOIN (
       SELECT booking_id, SUM(amount_cents) AS paid_cents FROM payments GROUP BY booking_id
     ) p ON p.booking_id = bk.id
     WHERE bk.hostel_id = ? AND bk.status != 'Cancelled'`,
  ).bind(hostelId).first<{ amount_cents: number }>()
  return json({
    payments: rows.results.map((payment) => ({
      id: payment.id, bookingId: payment.booking_id, amountCents: Number(payment.amount_cents),
      method: payment.method, receivedOn: payment.received_on, note: payment.note,
      guestName: payment.guest_name, reference: payment.reference,
    })),
    outstandingCents: Number(outstanding?.amount_cents ?? 0),
  })
}

async function createPayment(request: Request, db: D1Database, user: User, hostelId: string) {
  assertSameOrigin(request)
  const body = await readJson(request)
  const bookingId = requiredText(body.bookingId, 'Booking', 64)
  const amountCents = body.amountCents
  if (!Number.isSafeInteger(amountCents) || Number(amountCents) <= 0 || Number(amountCents) > 100_000_000_000) {
    throw new HttpError(400, 'Payment amount must be a positive valid amount.')
  }
  const method = body.method
  if (typeof method !== 'string' || !['Cash', 'UPI', 'Bank transfer', 'Other'].includes(method)) {
    throw new HttpError(400, 'Select a supported payment method.')
  }
  const receivedOn = validDate(body.receivedOn, 'Payment date')
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 250) : ''
  const booking = await db.prepare(
    `SELECT bk.total_rent_cents, COALESCE(SUM(p.amount_cents), 0) AS paid_cents
     FROM bookings bk LEFT JOIN payments p ON p.booking_id = bk.id
     WHERE bk.id = ? AND bk.hostel_id = ? AND bk.status != 'Cancelled'
     GROUP BY bk.id`,
  ).bind(bookingId, hostelId).first<{ total_rent_cents: number; paid_cents: number }>()
  if (!booking) throw new HttpError(404, 'Active booking not found in this hostel.')
  if (Number(amountCents) > Number(booking.total_rent_cents) - Number(booking.paid_cents)) {
    throw new HttpError(409, 'Payment amount cannot exceed the outstanding balance.')
  }
  const result = await db.prepare(
    `INSERT INTO payments (id, hostel_id, booking_id, amount_cents, method, received_on, note, recorded_by)
     SELECT ?, ?, bk.id, ?, ?, ?, ?, ?
     FROM bookings bk
     WHERE bk.id = ? AND bk.hostel_id = ? AND bk.status != 'Cancelled'
       AND ? <= bk.total_rent_cents - COALESCE(
         (SELECT SUM(prior.amount_cents) FROM payments prior WHERE prior.booking_id = bk.id), 0
       )`,
  ).bind(crypto.randomUUID(), hostelId, Number(amountCents), method, receivedOn, note, user.id, bookingId, hostelId, Number(amountCents)).run()
  if (Number(result.meta.changes ?? 0) !== 1) {
    throw new HttpError(409, 'Payment amount exceeds the current outstanding balance.')
  }
  return json({ ok: true }, 201)
}

async function getReports(db: D1Database, hostelId: string) {
  const today = new Date().toISOString().slice(0, 10)
  const [inventory, summary, monthly] = await Promise.all([
    db.prepare(
      `SELECT COUNT(*) AS beds,
       SUM(CASE WHEN status = 'Maintenance' THEN 1 ELSE 0 END) AS maintenance
       FROM beds b JOIN rooms r ON r.id = b.room_id WHERE r.hostel_id = ?`,
    ).bind(hostelId).first<{ beds: number; maintenance: number }>(),
    db.prepare(
      `SELECT
         SUM(CASE WHEN bk.status = 'Reserved' AND bk.arrival_date <= ? AND bk.departure_date > ? THEN 1 ELSE 0 END) AS reserved,
         SUM(CASE WHEN bk.status = 'Checked in' AND bk.arrival_date <= ? AND bk.departure_date > ? THEN 1 ELSE 0 END) AS checked_in,
         SUM(CASE WHEN bk.status = 'Checked out' THEN 1 ELSE 0 END) AS checked_out,
         COUNT(CASE WHEN bk.status != 'Cancelled' THEN 1 END) AS booking_count,
         COALESCE(SUM(CASE WHEN bk.status != 'Cancelled' THEN bk.total_rent_cents ELSE 0 END), 0) AS rent_cents,
         COALESCE(SUM(CASE WHEN bk.status != 'Cancelled' THEN COALESCE(p.paid_cents, 0) ELSE 0 END), 0) AS paid_cents
       FROM bookings bk LEFT JOIN (
         SELECT booking_id, SUM(amount_cents) AS paid_cents FROM payments GROUP BY booking_id
       ) p ON p.booking_id = bk.id
       WHERE bk.hostel_id = ?`,
    ).bind(today, today, today, today, hostelId).first<{
      reserved: number; checked_in: number; checked_out: number; booking_count: number
      rent_cents: number; paid_cents: number
    }>(),
    db.prepare(
      `SELECT substr(received_on, 1, 7) AS month, SUM(amount_cents) AS received_cents
       FROM payments WHERE hostel_id = ? GROUP BY substr(received_on, 1, 7)
       ORDER BY month DESC LIMIT 12`,
    ).bind(hostelId).all<{ month: string; received_cents: number }>(),
  ])
  const beds = Number(inventory?.beds ?? 0)
  const occupied = Number(summary?.checked_in ?? 0)
  return json({
    reports: {
      beds,
      occupied,
      vacant: Math.max(0, beds - Number(inventory?.maintenance ?? 0) - occupied - Number(summary?.reserved ?? 0)),
      reserved: Number(summary?.reserved ?? 0),
      bookings: Number(summary?.booking_count ?? 0),
      checkedOut: Number(summary?.checked_out ?? 0),
      rentCents: Number(summary?.rent_cents ?? 0),
      receivedCents: Number(summary?.paid_cents ?? 0),
      outstandingCents: Math.max(0, Number(summary?.rent_cents ?? 0) - Number(summary?.paid_cents ?? 0)),
      monthlyReceipts: monthly.results.map((row) => ({ month: row.month, receivedCents: Number(row.received_cents) })),
    },
  })
}

type ImportCsvRow = Record<string, string>
type ImportHostel = { key: string; id: string; name: string; address: string; isNew: boolean; line: number }
type ImportFloor = { hostelKey: string; key: string; id: string; name: string; position: number; isNew: boolean; line: number }
type ImportRoom = { hostelKey: string; floorKey: string; id: string; number: string; sharing: number; isNew: boolean; line: number }
type ImportBed = { hostelKey: string; floorKey: string; roomNumber: string; id: string; label: string; status: 'Vacant' | 'Maintenance'; isNew: boolean; line: number }
type ImportGuest = {
  hostelKey: string; key: string; id: string; name: string; email: string; mobile: string
  address: string; emergencyContact: string; identityProof: string; isNew: boolean; line: number
}
type ImportBooking = {
  hostelKey: string; reference: string; guestKey: string; floorKey: string; roomNumber: string
  bedLabel: string; id: string; arrival: string; departure: string; isNew: boolean
  status: 'Reserved' | 'Checked in' | 'Checked out' | 'Cancelled'; totalRentCents: number; line: number
}
type ImportPayment = {
  key: string; hostelKey: string; bookingReference: string; bookingId: string; id: string; amountCents: number
  method: 'Cash' | 'UPI' | 'Bank transfer' | 'Other'; receivedOn: string; note: string; line: number
}

function importKey(...parts: string[]) {
  return JSON.stringify(parts.map((part) => part.trim().toLocaleLowerCase()))
}

function importText(row: ImportCsvRow, column: string, label: string, maxLength: number) {
  const value = row[column]?.trim()
  if (!value || value.length > maxLength) throw new Error(`${label} is required (maximum ${maxLength} characters).`)
  return value
}

function importOptionalText(row: ImportCsvRow, column: string, label: string, maxLength: number) {
  const value = row[column]?.trim() ?? ''
  if (value.length > maxLength) throw new Error(`${label} must be at most ${maxLength} characters.`)
  return value
}

function importMoney(value: string, label: string, allowZero: boolean) {
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(value)) {
    throw new Error(`${label} must be a non-negative amount with at most two decimal places, without a currency symbol.`)
  }
  const [whole, fraction = ''] = value.split('.')
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents) || cents > 100_000_000_000 || (!allowZero && cents === 0)) {
    throw new Error(`${label} is outside the allowed amount range.`)
  }
  return cents
}

function importPosition(value: string, label: string, minimum: number, maximum: number) {
  if (!/^\d+$/.test(value)) throw new Error(`${label} must be a whole number.`)
  const number = Number(value)
  if (number < minimum || number > maximum) throw new Error(`${label} must be between ${minimum} and ${maximum}.`)
  return number
}

function validateImportRows<T>(
  value: unknown,
  file: string,
  errors: string[],
  parse: (row: ImportCsvRow, line: number) => T,
) {
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    errors.push(`${file}: expected a list of CSV rows.`)
    return []
  }
  const rows: T[] = []
  value.forEach((raw, index) => {
    const line = index + 2
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)
      || Object.values(raw).some((cell) => typeof cell !== 'string')) {
      errors.push(`${file}, row ${line}: invalid row data.`)
      return
    }
    try {
      rows.push(parse(raw as ImportCsvRow, line))
    } catch (error) {
      errors.push(`${file}, row ${line}: ${error instanceof Error ? error.message : 'invalid data.'}`)
    }
  })
  return rows
}

async function validateImportPayload(value: Record<string, unknown>, user: User, db: D1Database) {
  const errors: string[] = []
  const hostels = validateImportRows(value.hostels, 'hostels.csv', errors, (row, line): ImportHostel => ({
    key: importText(row, 'hostel_key', 'Hostel key', 64),
    id: crypto.randomUUID(),
    name: importText(row, 'name', 'Hostel name', 80),
    address: importOptionalText(row, 'address', 'Address', 200),
    isNew: true,
    line,
  }))
  const floors = validateImportRows(value.floors, 'floors.csv', errors, (row, line): ImportFloor => ({
    hostelKey: importText(row, 'hostel_key', 'Hostel key', 64),
    key: importText(row, 'floor_key', 'Floor key', 64),
    id: crypto.randomUUID(),
    name: importText(row, 'name', 'Floor name', 80),
    position: importPosition(importText(row, 'position', 'Floor position', 4), 'Floor position', 1, 20),
    isNew: true,
    line,
  }))
  const rooms = validateImportRows(value.rooms, 'rooms.csv', errors, (row, line): ImportRoom => ({
    hostelKey: importText(row, 'hostel_key', 'Hostel key', 64),
    floorKey: importText(row, 'floor_key', 'Floor key', 64),
    id: crypto.randomUUID(),
    number: importText(row, 'room_number', 'Room number', 32),
    sharing: validSharing(importPosition(importText(row, 'sharing', 'Sharing', 1), 'Sharing', 1, 4)),
    isNew: true,
    line,
  }))
  const beds = validateImportRows(value.beds, 'beds.csv', errors, (row, line): ImportBed => {
    const status = importText(row, 'status', 'Bed status', 20)
    if (status !== 'Vacant' && status !== 'Maintenance') throw new Error('Bed status must be Vacant or Maintenance; occupancy is derived from bookings.')
    return {
      hostelKey: importText(row, 'hostel_key', 'Hostel key', 64),
      floorKey: importText(row, 'floor_key', 'Floor key', 64),
      roomNumber: importText(row, 'room_number', 'Room number', 32),
      id: crypto.randomUUID(),
      label: importText(row, 'bed_label', 'Bed label', 32),
      status,
      isNew: true,
      line,
    }
  })
  const guests = validateImportRows(value.guests, 'guests.csv', errors, (row, line): ImportGuest => {
    const proof = importText(row, 'identity_proof', 'Identity proof', 40)
    if (!['Aadhaar card', 'Driving licence', 'Voter ID', 'PAN card'].includes(proof)) {
      throw new Error('Identity proof must be Aadhaar card, Driving licence, Voter ID, or PAN card.')
    }
    return {
      hostelKey: importText(row, 'hostel_key', 'Hostel key', 64),
      key: importText(row, 'guest_key', 'Guest key', 64),
      id: crypto.randomUUID(),
      name: importText(row, 'name', 'Guest name', 100),
      email: normalizeEmail(importText(row, 'email', 'Email', 254)),
      mobile: importText(row, 'mobile', 'Mobile number', 32),
      address: importText(row, 'address', 'Address', 300),
      emergencyContact: importText(row, 'emergency_contact', 'Emergency contact', 32),
      identityProof: proof,
      isNew: true,
      line,
    }
  })
  const bookings = validateImportRows(value.bookings, 'bookings.csv', errors, (row, line): ImportBooking => {
    const status = importText(row, 'status', 'Booking status', 20)
    if (!['Reserved', 'Checked in', 'Checked out', 'Cancelled'].includes(status)) {
      throw new Error('Booking status must be Reserved, Checked in, Checked out, or Cancelled.')
    }
    const arrival = validDate(importText(row, 'arrival_date', 'Arrival date', 10), 'Arrival date')
    const departure = validDate(importText(row, 'departure_date', 'Departure date', 10), 'Departure date')
    if (departure <= arrival) throw new Error('Departure date must be after arrival date.')
    return {
      hostelKey: importText(row, 'hostel_key', 'Hostel key', 64),
      reference: importText(row, 'booking_reference', 'Booking reference', 64),
      guestKey: importText(row, 'guest_key', 'Guest key', 64),
      floorKey: importText(row, 'floor_key', 'Floor key', 64),
      roomNumber: importText(row, 'room_number', 'Room number', 32),
      bedLabel: importText(row, 'bed_label', 'Bed label', 32),
      id: crypto.randomUUID(),
      arrival,
      departure,
      isNew: true,
      status: status as ImportBooking['status'],
      totalRentCents: importMoney(importText(row, 'total_rent', 'Total rent', 16), 'Total rent', true),
      line,
    }
  })
  const payments = validateImportRows(value.payments, 'payments.csv', errors, (row, line): ImportPayment => {
    const method = importText(row, 'method', 'Payment method', 32)
    if (!['Cash', 'UPI', 'Bank transfer', 'Other'].includes(method)) {
      throw new Error('Payment method must be Cash, UPI, Bank transfer, or Other.')
    }
    const receivedOn = validDate(importText(row, 'received_on', 'Received date', 10), 'Received date')
    if (receivedOn > new Date().toISOString().slice(0, 10)) throw new Error('Received date cannot be in the future.')
    return {
      key: importText(row, 'payment_key', 'Payment key', 64),
      hostelKey: importText(row, 'hostel_key', 'Hostel key', 64),
      bookingReference: importText(row, 'booking_reference', 'Booking reference', 64),
      bookingId: '',
      id: crypto.randomUUID(),
      amountCents: importMoney(importText(row, 'amount', 'Payment amount', 16), 'Payment amount', false),
      method: method as ImportPayment['method'],
      receivedOn,
      note: importOptionalText(row, 'note', 'Payment note', 200),
      line,
    }
  })

  const totalRows = hostels.length + floors.length + rooms.length + beds.length + guests.length + bookings.length + payments.length
  if (totalRows === 0) errors.push('Choose at least one CSV file containing data rows.')
  if (totalRows > 500) errors.push('An import may contain at most 500 data rows across all CSV files.')
  if (errors.length) return { errors: errors.slice(0, 100), counts: {} }

  const hostelByKey = new Map<string, ImportHostel>()
  const floorByKey = new Map<string, ImportFloor>()
  const roomByKey = new Map<string, ImportRoom>()
  const bedByKey = new Map<string, ImportBed>()
  const guestByKey = new Map<string, ImportGuest>()
  const bookingByReference = new Map<string, ImportBooking>()
  const markDuplicate = (file: string, line: number, label: string) => errors.push(`${file}, row ${line}: duplicate ${label}.`)

  for (const hostel of hostels) {
    const key = importKey(hostel.key)
    if (hostelByKey.has(key)) markDuplicate('hostels.csv', hostel.line, 'hostel_key')
    else hostelByKey.set(key, hostel)
  }
  for (const floor of floors) {
    const key = importKey(floor.hostelKey, floor.key)
    if (floorByKey.has(key)) markDuplicate('floors.csv', floor.line, 'hostel_key/floor_key')
    else floorByKey.set(key, floor)
  }
  for (const room of rooms) {
    const key = importKey(room.hostelKey, room.number)
    if (roomByKey.has(key)) markDuplicate('rooms.csv', room.line, 'room number within its hostel')
    else roomByKey.set(key, room)
  }
  for (const bed of beds) {
    const key = importKey(bed.hostelKey, bed.roomNumber, bed.label)
    if (bedByKey.has(key)) markDuplicate('beds.csv', bed.line, 'bed label within its room')
    else bedByKey.set(key, bed)
  }
  for (const guest of guests) {
    const key = importKey(guest.hostelKey, guest.key)
    if (guestByKey.has(key)) markDuplicate('guests.csv', guest.line, 'guest_key')
    else guestByKey.set(key, guest)
  }
  for (const booking of bookings) {
    const key = importKey(booking.reference)
    if (bookingByReference.has(key)) markDuplicate('bookings.csv', booking.line, 'booking_reference')
    else bookingByReference.set(key, booking)
  }
  const paymentKeys = new Set<string>()
  for (const payment of payments) {
    const key = importKey(payment.key)
    if (paymentKeys.has(key)) markDuplicate('payments.csv', payment.line, 'payment_key')
    paymentKeys.add(key)
  }
  const hostelNameKeys = new Set<string>()
  for (const hostel of hostels) {
    const normalized = hostel.name.toLocaleLowerCase()
    if (hostelNameKeys.has(normalized)) markDuplicate('hostels.csv', hostel.line, 'hostel name')
    hostelNameKeys.add(normalized)
  }
  const floorNames = new Set<string>()
  const floorPositions = new Set<string>()
  for (const floor of floors) {
    const nameKey = importKey(floor.hostelKey, floor.name)
    const positionKey = importKey(floor.hostelKey, String(floor.position))
    if (floorNames.has(nameKey)) markDuplicate('floors.csv', floor.line, 'floor name within its hostel')
    if (floorPositions.has(positionKey)) markDuplicate('floors.csv', floor.line, 'floor position within its hostel')
    floorNames.add(nameKey)
    floorPositions.add(positionKey)
  }
  const guestEmails = new Set<string>()
  for (const guest of guests) {
    const key = importKey(guest.hostelKey, guest.email)
    if (guestEmails.has(key)) markDuplicate('guests.csv', guest.line, 'email within its hostel')
    guestEmails.add(key)
  }

  for (const floor of floors) {
    if (!hostelByKey.has(importKey(floor.hostelKey))) errors.push(`floors.csv, row ${floor.line}: hostel_key does not exist in hostels.csv.`)
  }
  for (const room of rooms) {
    if (!floorByKey.has(importKey(room.hostelKey, room.floorKey))) {
      errors.push(`rooms.csv, row ${room.line}: hostel_key/floor_key does not exist in floors.csv.`)
    }
  }
  const bedsByRoom = new Map<string, ImportBed[]>()
  for (const bed of beds) {
    const roomKey = importKey(bed.hostelKey, bed.floorKey, bed.roomNumber)
    if (!roomByKey.has(importKey(bed.hostelKey, bed.roomNumber))) {
      errors.push(`beds.csv, row ${bed.line}: hostel_key/room_number does not exist in rooms.csv.`)
    } else if (!floorByKey.has(importKey(bed.hostelKey, bed.floorKey))) {
      errors.push(`beds.csv, row ${bed.line}: hostel_key/floor_key does not exist in floors.csv.`)
    } else {
      const group = bedsByRoom.get(roomKey) ?? []
      group.push(bed)
      bedsByRoom.set(roomKey, group)
    }
  }
  for (const room of rooms) {
    const assignedFloor = floorByKey.get(importKey(room.hostelKey, room.floorKey))
    if (!assignedFloor) errors.push(`rooms.csv, row ${room.line}: floor_key does not exist for this hostel.`)
    const roomBeds = bedsByRoom.get(importKey(room.hostelKey, room.floorKey, room.number)) ?? []
    if (roomBeds.length && roomBeds.length !== room.sharing) {
      errors.push(`rooms.csv, row ${room.line}: sharing is ${room.sharing}, but beds.csv has ${roomBeds.length} bed rows for this room.`)
    }
  }
  for (const guest of guests) {
    if (!hostelByKey.has(importKey(guest.hostelKey))) errors.push(`guests.csv, row ${guest.line}: hostel_key does not exist in hostels.csv.`)
  }
  const activeIntervals = new Map<string, ImportBooking[]>()
  const paymentsByBooking = new Map<string, ImportPayment[]>()
  for (const booking of bookings) {
    const hostelKey = importKey(booking.hostelKey)
    const guest = guestByKey.get(importKey(booking.hostelKey, booking.guestKey))
    const floor = floorByKey.get(importKey(booking.hostelKey, booking.floorKey))
    const room = roomByKey.get(importKey(booking.hostelKey, booking.roomNumber))
    const bed = bedByKey.get(importKey(booking.hostelKey, booking.roomNumber, booking.bedLabel))
    if (!hostelByKey.has(hostelKey)) errors.push(`bookings.csv, row ${booking.line}: hostel_key does not exist in hostels.csv.`)
    if (!guest) errors.push(`bookings.csv, row ${booking.line}: guest_key does not exist for this hostel in guests.csv.`)
    if (!floor) errors.push(`bookings.csv, row ${booking.line}: floor_key does not exist for this hostel in floors.csv.`)
    if (!room || !rooms.some((candidate) => candidate === room && importKey(candidate.floorKey) === importKey(booking.floorKey))) {
      errors.push(`bookings.csv, row ${booking.line}: room_number does not exist on this floor in rooms.csv.`)
    }
    if (!bed || importKey(bed.floorKey) !== importKey(booking.floorKey)) {
      errors.push(`bookings.csv, row ${booking.line}: bed_label does not exist in beds.csv for this room and floor.`)
    } else if (bed.status !== 'Vacant') {
      errors.push(`bookings.csv, row ${booking.line}: cannot assign a booking to a Maintenance bed.`)
    }
    if (booking.status !== 'Cancelled') {
      const key = importKey(booking.hostelKey, booking.floorKey, booking.roomNumber, booking.bedLabel)
      const intervals = activeIntervals.get(key) ?? []
      if (intervals.some((prior) => booking.arrival < prior.departure && booking.departure > prior.arrival)) {
        errors.push(`bookings.csv, row ${booking.line}: active dates overlap another booking on this bed.`)
      }
      intervals.push(booking)
      activeIntervals.set(key, intervals)
    }
  }
  for (const payment of payments) {
    const booking = bookingByReference.get(importKey(payment.bookingReference))
    if (!booking) {
      errors.push(`payments.csv, row ${payment.line}: booking_reference does not exist in bookings.csv.`)
      continue
    }
    if (importKey(booking.hostelKey) !== importKey(payment.hostelKey)) {
      errors.push(`payments.csv, row ${payment.line}: hostel_key does not match the booking's hostel.`)
    }
    payment.bookingId = booking.id
    const group = paymentsByBooking.get(importKey(booking.reference)) ?? []
    group.push(payment)
    paymentsByBooking.set(importKey(booking.reference), group)
  }
  const addConflict = (file: string, line: number, message: string) => errors.push(`${file}, row ${line}: ${message}`)
  const hostelNames = hostels.map((hostel) => hostel.name)
  const existingHostels = hostelNames.length
    ? (await db.prepare(`SELECT id, name, address FROM hostels WHERE name COLLATE NOCASE IN (${hostelNames.map(() => '?').join(',')})`)
      .bind(...hostelNames).all<{ id: string; name: string; address: string }>()).results
    : []
  for (const hostel of hostels) {
    const existing = existingHostels.find((row) => importKey(row.name) === importKey(hostel.name))
    if (existing) {
      if (existing.address !== hostel.address) addConflict('hostels.csv', hostel.line, `hostel "${hostel.name}" exists with a different address.`)
      hostel.id = existing.id
      hostel.isNew = false
    }
  }
  const hostelIdByKey = new Map(hostels.map((hostel) => [importKey(hostel.key), hostel.id]))
  const hostelIdsForImport = [...new Set(hostels.map((hostel) => hostel.id))]
  const idPlaceholders = hostelIdsForImport.map(() => '?').join(',')
  const existingFloors = hostelIdsForImport.length
    ? (await db.prepare(`SELECT id, hostel_id, name, position FROM floors WHERE hostel_id IN (${idPlaceholders})`)
      .bind(...hostelIdsForImport).all<{ id: string; hostel_id: string; name: string; position: number }>()).results
    : []
  for (const floor of floors) {
    const hostelId = hostelIdByKey.get(importKey(floor.hostelKey))
    const matching = existingFloors.filter((row) => row.hostel_id === hostelId && (
      importKey(row.name) === importKey(floor.name) || Number(row.position) === floor.position - 1
    ))
    if (matching.length) {
      const exact = matching.find((row) => importKey(row.name) === importKey(floor.name) && Number(row.position) === floor.position - 1)
      if (!exact) addConflict('floors.csv', floor.line, 'floor name/position conflicts with existing inventory.')
      else {
        floor.id = exact.id
        floor.isNew = false
      }
    }
  }
  const existingRooms = hostelIdsForImport.length
    ? (await db.prepare(`SELECT id, hostel_id, floor_id, number, sharing FROM rooms WHERE hostel_id IN (${idPlaceholders})`)
      .bind(...hostelIdsForImport).all<{ id: string; hostel_id: string; floor_id: string; number: string; sharing: number }>()).results
    : []
  const roomIdsByReference = new Map<string, string>()
  for (const room of rooms) {
    const hostelId = hostelIdByKey.get(importKey(room.hostelKey))
    const floorId = floorByKey.get(importKey(room.hostelKey, room.floorKey))?.id
    const existing = existingRooms.find((row) => row.hostel_id === hostelId && importKey(row.number) === importKey(room.number))
    if (existing) {
      if (existing.floor_id !== floorId || Number(existing.sharing) !== room.sharing) {
        addConflict('rooms.csv', room.line, `room "${room.number}" exists with different floor or sharing capacity.`)
      } else {
        room.id = existing.id
        room.isNew = false
      }
    }
    roomIdsByReference.set(importKey(room.hostelKey, room.floorKey, room.number), room.id)
  }
  const existingBeds = roomIdsByReference.size
    ? (await db.prepare(
      `SELECT b.id, b.room_id, b.label, b.status FROM beds b
       WHERE b.room_id IN (${[...new Set(roomIdsByReference.values())].map(() => '?').join(',')})`,
    ).bind(...[...new Set(roomIdsByReference.values())]).all<{ id: string; room_id: string; label: string; status: string }>()).results
    : []
  const existingBedsByRoom = new Map<string, typeof existingBeds>()
  for (const existing of existingBeds) {
    const group = existingBedsByRoom.get(existing.room_id) ?? []
    group.push(existing)
    existingBedsByRoom.set(existing.room_id, group)
  }
  for (const room of rooms) {
    const bedRows = bedsByRoom.get(importKey(room.hostelKey, room.floorKey, room.number)) ?? []
    const existingForRoom = existingBedsByRoom.get(room.id) ?? []
    if (bedRows.length === 0 && existingForRoom.length === room.sharing) {
      for (const existing of existingForRoom) {
        const bed: ImportBed = {
          hostelKey: room.hostelKey, floorKey: room.floorKey, roomNumber: room.number,
          id: existing.id, label: existing.label, status: existing.status as ImportBed['status'], isNew: false, line: room.line,
        }
        bedByKey.set(importKey(bed.hostelKey, bed.roomNumber, bed.label), bed)
      }
    } else if (bedRows.length !== 0 && bedRows.length !== room.sharing) {
      addConflict('rooms.csv', room.line, `include either all ${room.sharing} beds for this room or none of them.`)
    } else if (room.isNew && bedRows.length !== room.sharing) {
      addConflict('rooms.csv', room.line, `new room "${room.number}" needs exactly ${room.sharing} bed rows in beds.csv.`)
    } else if (!room.isNew && existingForRoom.length !== room.sharing) {
      addConflict('rooms.csv', room.line, `existing room "${room.number}" has a different number of beds than its sharing setting.`)
    }
  }
  for (const bed of beds) {
    const roomId = roomIdsByReference.get(importKey(bed.hostelKey, bed.floorKey, bed.roomNumber))
    if (!roomId) continue
    const existing = existingBeds.find((row) => row.room_id === roomId && importKey(row.label) === importKey(bed.label))
    if (existing) {
      if (existing.status !== bed.status) addConflict('beds.csv', bed.line, `bed "${bed.label}" exists with a different status.`)
      else {
        bed.id = existing.id
        bed.isNew = false
      }
    } else if (!rooms.find((room) => room.id === roomId)?.isNew) {
      addConflict('beds.csv', bed.line, `bed "${bed.label}" does not match an existing bed in this room.`)
    }
  }
  const importedHostelIds = [...new Set(hostels.map((hostel) => hostel.id))]
  const guestExisting = importedHostelIds.length
    ? (await db.prepare(`SELECT id, hostel_id, name, email, mobile, address, emergency_contact, identity_proof FROM guests WHERE hostel_id IN (${importedHostelIds.map(() => '?').join(',')})`)
      .bind(...importedHostelIds).all<{
        id: string; hostel_id: string; name: string; email: string; mobile: string
        address: string; emergency_contact: string; identity_proof: string
      }>()).results
    : []
  for (const guest of guests) {
    const hostelId = hostelIdByKey.get(importKey(guest.hostelKey))
    const existing = guestExisting.find((row) => row.hostel_id === hostelId && importKey(row.email) === importKey(guest.email))
    if (existing) {
      const exact = existing.name === guest.name && existing.mobile === guest.mobile && existing.address === guest.address
        && existing.emergency_contact === guest.emergencyContact && existing.identity_proof === guest.identityProof
      if (!exact) addConflict('guests.csv', guest.line, `email "${guest.email}" already exists with different guest details.`)
      guest.id = existing.id
      guest.isNew = false
    }
  }
  const bookingRefs = bookings.map((booking) => booking.reference)
  const existingBookings = bookingRefs.length
    ? (await db.prepare(
      `SELECT id, reference, hostel_id, guest_id, bed_id, arrival_date, departure_date, status, total_rent_cents
       FROM bookings WHERE reference COLLATE NOCASE IN (${bookingRefs.map(() => '?').join(',')})`,
    ).bind(...bookingRefs).all<{
      id: string; reference: string; hostel_id: string; guest_id: string; bed_id: string
      arrival_date: string; departure_date: string; status: string; total_rent_cents: number
    }>()).results
    : []
  const guestIdByKey = new Map(guests.map((guest) => [importKey(guest.hostelKey, guest.key), guest.id]))
  for (const booking of bookings) {
    const existing = existingBookings.find((row) => importKey(row.reference) === importKey(booking.reference))
    if (!existing) continue
    const hostelId = hostelIdByKey.get(importKey(booking.hostelKey))
    const guestId = guestIdByKey.get(importKey(booking.hostelKey, booking.guestKey))
    const bedId = bedByKey.get(importKey(booking.hostelKey, booking.roomNumber, booking.bedLabel))?.id
    const exact = existing.hostel_id === hostelId && existing.guest_id === guestId && existing.bed_id === bedId
      && existing.arrival_date === booking.arrival && existing.departure_date === booking.departure
      && existing.status === booking.status && Number(existing.total_rent_cents) === booking.totalRentCents
    if (!exact) addConflict('bookings.csv', booking.line, `booking_reference "${booking.reference}" exists with different stay or rent details.`)
    booking.id = existing.id
    booking.isNew = false
  }
  const candidateBedIds = [...new Set([...bedByKey.values()].map((bed) => bed.id))]
  const existingActiveBookings = candidateBedIds.length
    ? (await db.prepare(
      `SELECT id, bed_id, arrival_date, departure_date FROM bookings
       WHERE bed_id IN (${candidateBedIds.map(() => '?').join(',')}) AND status != 'Cancelled'`,
    ).bind(...candidateBedIds).all<{ id: string; bed_id: string; arrival_date: string; departure_date: string }>()).results
    : []
  for (const booking of bookings) {
    if (!booking.isNew || booking.status === 'Cancelled') continue
    const bedId = bedByKey.get(importKey(booking.hostelKey, booking.roomNumber, booking.bedLabel))?.id
    if (existingActiveBookings.some((existing) => existing.bed_id === bedId
      && booking.arrival < existing.departure_date && booking.departure > existing.arrival_date)) {
      addConflict('bookings.csv', booking.line, 'stay dates overlap an existing booking on this bed.')
    }
  }
  for (const payment of payments) {
    const booking = bookingByReference.get(importKey(payment.bookingReference))
    if (booking) payment.bookingId = booking.id
  }
  if (payments.length) {
    const keys = payments.map((payment) => payment.key)
    const existing = await db.prepare(
      `SELECT import_key FROM payments WHERE import_key COLLATE NOCASE IN (${keys.map(() => '?').join(',')})`,
    ).bind(...keys).all<{ import_key: string }>()
    const existingKeys = new Set(existing.results.map((row) => importKey(row.import_key)))
    for (const payment of payments) {
      if (existingKeys.has(importKey(payment.key))) addConflict('payments.csv', payment.line, `payment_key "${payment.key}" has already been imported.`)
    }
  }
  if (bookings.length) {
    const bookingIds = [...new Set(bookings.map((booking) => booking.id))]
    const existingPayments = await db.prepare(
      `SELECT booking_id, amount_cents, method, received_on, note FROM payments
       WHERE booking_id IN (${bookingIds.map(() => '?').join(',')})`,
    ).bind(...bookingIds).all<{ booking_id: string; amount_cents: number; method: string; received_on: string; note: string }>()
    const paidByBooking = new Map<string, number>()
    for (const row of existingPayments.results) {
      paidByBooking.set(row.booking_id, (paidByBooking.get(row.booking_id) ?? 0) + Number(row.amount_cents))
    }
    for (const payment of payments) {
      const duplicate = existingPayments.results.some((row) => row.booking_id === payment.bookingId
        && Number(row.amount_cents) === payment.amountCents && row.method === payment.method
        && row.received_on === payment.receivedOn && row.note === payment.note)
      if (duplicate) addConflict('payments.csv', payment.line, 'an identical receipt is already recorded for this booking; check the source rows before importing.')
    }
    for (const booking of bookings) {
      const bookingPayments = paymentsByBooking.get(importKey(booking.reference)) ?? []
      const totalPaid = (paidByBooking.get(booking.id) ?? 0) + bookingPayments.reduce((total, payment) => total + payment.amountCents, 0)
      if (totalPaid > booking.totalRentCents) {
        addConflict('bookings.csv', booking.line, 'existing plus imported payments exceed total_rent.')
      }
      if (booking.status === 'Cancelled' && totalPaid > 0) {
        addConflict('bookings.csv', booking.line, 'cancelled bookings cannot have recorded payments.')
      }
    }
  }

  const counts = {
    hostels: hostels.length,
    floors: floors.length,
    rooms: rooms.length,
    beds: beds.length,
    guests: guests.length,
    bookings: bookings.length,
    payments: payments.length,
  }
  if (errors.length) return { errors: errors.slice(0, 100), counts }

  const hostelIds = new Map(hostels.map((hostel) => [importKey(hostel.key), hostel.id]))
  const floorIds = new Map(floors.map((floor) => [importKey(floor.hostelKey, floor.key), floor.id]))
  const roomIds = new Map(rooms.map((room) => [importKey(room.hostelKey, room.floorKey, room.number), room.id]))
  const bedIds = new Map([...bedByKey.values()].map((bed) => [
    importKey(bed.hostelKey, bed.floorKey, bed.roomNumber, bed.label),
    bed.id,
  ]))
  const guestIds = new Map(guests.map((guest) => [importKey(guest.hostelKey, guest.key), guest.id]))
  const statements: D1PreparedStatement[] = []
  for (const hostel of hostels) {
    if (!hostel.isNew) continue
    statements.push(db.prepare('INSERT INTO hostels (id, name, address) VALUES (?, ?, ?)').bind(hostel.id, hostel.name, hostel.address))
  }
  for (const floor of floors) {
    if (!floor.isNew) continue
    statements.push(db.prepare('INSERT INTO floors (id, hostel_id, name, position) VALUES (?, ?, ?, ?)')
      .bind(floor.id, hostelIds.get(importKey(floor.hostelKey)), floor.name, floor.position - 1))
  }
  for (const room of rooms) {
    if (!room.isNew) continue
    statements.push(db.prepare('INSERT INTO rooms (id, hostel_id, floor_id, number, sharing) VALUES (?, ?, ?, ?, ?)')
      .bind(room.id, hostelIds.get(importKey(room.hostelKey)), floorIds.get(importKey(room.hostelKey, room.floorKey)), room.number, room.sharing))
  }
  for (const bed of beds) {
    if (!bed.isNew) continue
    const roomId = roomIds.get(importKey(bed.hostelKey, bed.floorKey, bed.roomNumber))
    statements.push(db.prepare('INSERT INTO beds (id, room_id, label, status) VALUES (?, ?, ?, ?)')
      .bind(bed.id, roomId, bed.label, bed.status))
  }
  for (const guest of guests) {
    if (!guest.isNew) continue
    statements.push(db.prepare(
      `INSERT INTO guests (id, hostel_id, name, email, mobile, address, emergency_contact, identity_proof)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(guest.id, hostelIds.get(importKey(guest.hostelKey)), guest.name, guest.email, guest.mobile, guest.address, guest.emergencyContact, guest.identityProof))
  }
  for (const booking of bookings) {
    if (!booking.isNew) continue
    const bedId = bedIds.get(importKey(booking.hostelKey, booking.floorKey, booking.roomNumber, booking.bedLabel))
    statements.push(db.prepare(
      `INSERT INTO bookings (id, reference, hostel_id, guest_id, bed_id, arrival_date, departure_date, status, total_rent_cents, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      booking.id, booking.reference, hostelIds.get(importKey(booking.hostelKey)),
      guestIds.get(importKey(booking.hostelKey, booking.guestKey)), bedId,
      booking.arrival, booking.departure, booking.status, booking.totalRentCents, user.id,
    ))
  }
  for (const payment of payments) {
    statements.push(db.prepare(
      'INSERT INTO payments (id, hostel_id, booking_id, amount_cents, method, received_on, note, recorded_by, import_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).bind(
      payment.id, hostelIds.get(importKey(payment.hostelKey)), payment.bookingId,
      payment.amountCents, payment.method, payment.receivedOn, payment.note, user.id, payment.key,
    ))
  }
  return { errors: [], counts, statements }
}

async function importHostelData(request: Request, db: D1Database, user: User, commit: boolean) {
  assertSameOrigin(request)
  const contentLength = Number(request.headers.get('Content-Length') ?? 0)
  if (contentLength > 2_000_000) throw new HttpError(413, 'Import request is too large. Keep the complete request under 2 MB.')
  if (!request.headers.get('Content-Type')?.toLowerCase().includes('application/json')) {
    throw new HttpError(415, 'Send parsed CSV rows as JSON.')
  }
  let body: Record<string, unknown>
  try {
    const text = await request.text()
    if (text.length > 2_000_000) throw new HttpError(413, 'Import request is too large. Keep the complete request under 2 MB.')
    const value: unknown = JSON.parse(text)
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'Import request must be a JSON object.')
    body = value as Record<string, unknown>
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(400, 'Import request contains invalid JSON.')
  }
  const plan = await validateImportPayload(body, user, db)
  if (plan.errors.length) {
    return json({ error: 'No records were imported. Fix the listed issues and validate the files again.', issues: plan.errors, counts: plan.counts }, 422)
  }
  if (!commit) return json({ valid: true, counts: plan.counts })
  if (!plan.statements?.length) return json({ imported: true, unchanged: true, counts: plan.counts })
  try {
    await db.batch(plan.statements)
  } catch (error) {
    if (error instanceof Error && /UNIQUE constraint failed|FOREIGN KEY constraint failed|CHECK constraint failed/.test(error.message)) {
      throw new HttpError(409, 'No records were imported because data changed or conflicted after validation. Validate the files again.')
    }
    throw error
  }
  return json({ imported: true, counts: plan.counts }, 201)
}

async function api(request: Request, env: Env) {
  const url = new URL(request.url)
  if (url.pathname === '/api/health' && request.method === 'GET') {
    if (!env.DB) return json({ status: 'error', database: 'unavailable' }, 503)
    try {
      await env.DB.prepare('SELECT 1').first()
    } catch (error) {
      console.error('Database health check failed', error)
      return json({ status: 'error', database: 'unavailable' }, 503)
    }
    return json({ status: 'ok', database: 'ok' })
  }
  if (!env.DB) return json({ error: 'The D1 database binding is missing. Configure DB and apply the migrations.' }, 503)
  const { DB: db } = env

  if (url.pathname === '/api/auth/status' && request.method === 'GET') return authStatus(request, db)
  if (url.pathname === '/api/auth/bootstrap' && request.method === 'POST') return bootstrapAdmin(request, db)
  if (url.pathname === '/api/auth/login' && request.method === 'POST') return login(request, db)
  if (url.pathname === '/api/auth/logout' && request.method === 'POST') return logout(request, db)

  const user = await requireUser(request, db)
  if (url.pathname === '/api/auth/password' && request.method === 'POST') return changePassword(request, db, user)
  if (url.pathname === '/api/import/validate' && request.method === 'POST') {
    requireAdmin(user)
    return importHostelData(request, db, user, false)
  }
  if (url.pathname === '/api/import/commit' && request.method === 'POST') {
    requireAdmin(user)
    return importHostelData(request, db, user, true)
  }
  if (url.pathname === '/api/hostels' && request.method === 'GET') return listHostels(user, db)
  if (url.pathname === '/api/hostels' && request.method === 'POST') {
    requireAdmin(user)
    return createHostel(request, db)
  }

  if (url.pathname === '/api/staff') {
    requireAdmin(user)
    if (request.method === 'GET') return listStaff(db)
    if (request.method === 'POST') return createStaff(request, db)
  }
  const staffMatch = url.pathname.match(/^\/api\/staff\/([^/]+)$/)
  if (staffMatch && request.method === 'DELETE') {
    requireAdmin(user)
    assertSameOrigin(request)
    return deactivateStaff(db, decodeURIComponent(staffMatch[1]))
  }
  const staffPasswordMatch = url.pathname.match(/^\/api\/staff\/([^/]+)\/password$/)
  if (staffPasswordMatch && request.method === 'PUT') {
    requireAdmin(user)
    return resetStaffPassword(request, db, decodeURIComponent(staffPasswordMatch[1]))
  }

  const roomsMatch = url.pathname.match(/^\/api\/hostels\/([^/]+)\/rooms$/)
  if (roomsMatch && request.method === 'GET') {
    const hostelId = decodeURIComponent(roomsMatch[1])
    await requireHostelAccess(user, hostelId, db)
    const date = url.searchParams.get('date')
    return getHostelRooms(db, hostelId, date ? validDate(date, 'Availability date') : undefined)
  }
  if (roomsMatch && request.method === 'POST') {
    requireAdmin(user)
    return createRoom(request, db, decodeURIComponent(roomsMatch[1]))
  }
  const roomMatch = url.pathname.match(/^\/api\/hostels\/([^/]+)\/rooms\/([^/]+)$/)
  if (roomMatch && request.method === 'PUT') {
    requireAdmin(user)
    return updateRoom(request, db, decodeURIComponent(roomMatch[1]), decodeURIComponent(roomMatch[2]))
  }
  const hostelResourceMatch = url.pathname.match(/^\/api\/hostels\/([^/]+)\/(bookings|guests|payments|reports|availability)$/)
  if (hostelResourceMatch) {
    const hostelId = decodeURIComponent(hostelResourceMatch[1])
    const resource = hostelResourceMatch[2]
    await requireHostelAccess(user, hostelId, db)
    if (resource === 'bookings' && request.method === 'GET') return listBookings(db, hostelId)
    if (resource === 'bookings' && request.method === 'POST') return createBooking(request, db, user, hostelId)
    if (resource === 'guests' && request.method === 'GET') return listGuests(db, hostelId)
    if (resource === 'payments' && request.method === 'GET') return listPayments(db, hostelId)
    if (resource === 'payments' && request.method === 'POST') return createPayment(request, db, user, hostelId)
    if (resource === 'reports' && request.method === 'GET') return getReports(db, hostelId)
    if (resource === 'availability' && request.method === 'GET') {
      const beds = await availableBeds(db, hostelId, url.searchParams.get('arrival') ?? '', url.searchParams.get('departure') ?? '')
      return json({ beds })
    }
  }
  const bookingMatch = url.pathname.match(/^\/api\/hostels\/([^/]+)\/bookings\/([^/]+)$/)
  if (bookingMatch && request.method === 'PUT') {
    const hostelId = decodeURIComponent(bookingMatch[1])
    await requireHostelAccess(user, hostelId, db)
    return updateBookingStatus(request, db, hostelId, decodeURIComponent(bookingMatch[2]))
  }
  throw new HttpError(404, 'API route not found.')
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/api/')) return new Response(null, { status: 404 })
    try {
      return await api(request, env)
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status)
      if (error instanceof Error && /UNIQUE constraint failed/.test(error.message)) {
        return json({ error: 'A hostel, room, or account with that unique value already exists.' }, 409)
      }
      console.error('API request failed', error)
      return json({ error: 'The request could not be completed. Please try again.' }, 500)
    }
  },
} satisfies ExportedHandler<Env>
