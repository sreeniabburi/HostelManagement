import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import './App.css'
import { parseCsvRecords } from './csvImport'

type IconName =
  | 'dashboard'
  | 'bookings'
  | 'guests'
  | 'rooms'
  | 'payments'
  | 'reports'
  | 'settings'
  | 'plus'
  | 'search'
  | 'bell'
  | 'chevron'
  | 'arrow'
  | 'calendar'
  | 'bed'
  | 'clock'
  | 'menu'
  | 'close'
  | 'users'
  | 'import'

const iconPaths: Record<IconName, string> = {
  dashboard: 'M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z',
  bookings: 'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  guests: 'M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m16 0v-2a4 4 0 0 0-3-3.87M14 3.13a4 4 0 0 1 0 7.75M10 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  rooms: 'M3 21V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v16M3 10h18M7 7h.01M7 14h.01M12 14h.01M17 14h.01M7 18h.01M12 18h.01M17 18h.01M9 21v-3h6v3',
  payments: 'M3 6h18M5 10h3m-5-6h18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  reports: 'M4 19V5m0 14h17M8 15l3-4 3 2 5-7',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5v2m0 14v2m9-9h-2M5 12H3m15.36-6.36-1.42 1.42M7.06 16.94l-1.42 1.42m12.72 0-1.42-1.42M7.06 7.06 5.64 5.64',
  plus: 'M12 5v14m-7-7h14',
  search: 'm21 21-4.34-4.34M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0Z',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12a2 2 0 0 0 4 0',
  chevron: 'm7 10 5 5 5-5',
  arrow: 'M7 17 17 7M7 7h10v10',
  calendar: 'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  bed: 'M2 4v16m20-8V8a2 2 0 0 0-2-2h-6v6m8 0H2m20 0v8M2 12v8m0-4h20',
  clock: 'M12 8v4l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'M18 6 6 18M6 6l12 12',
  users: 'M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m16 0v-2a4 4 0 0 0-3-3.87M10 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm4-3.87a4 4 0 0 1 0 7.75',
  import: 'M12 3v12m0 0 4-4m-4 4-4-4M5 17v3h14v-3',
}

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={iconPaths[name]} />
    </svg>
  )
}

const navigation: { label: string; icon: IconName }[] = [
  { label: 'Dashboard', icon: 'dashboard' },
  { label: 'Bookings', icon: 'bookings' },
  { label: 'Guests', icon: 'guests' },
  { label: 'Rooms & beds', icon: 'rooms' },
  { label: 'Payments', icon: 'payments' },
  { label: 'Reports', icon: 'reports' },
  { label: 'Staff accounts', icon: 'users' },
  { label: 'Data import', icon: 'import' },
  { label: 'Account security', icon: 'settings' },
]

type HostelEntry = {
  id: string
  name: string
  address: string
  floors: string[]
}

type RoomRecord = {
  id?: string
  number: string
  sharing: number
  beds: RoomBed[]
}

function roomId(floor: string, room: RoomRecord) {
  return room.id ?? `${floor}:${room.number}`
}

function bedLabel(room: RoomRecord, index: number) {
  return `${room.number}-${String.fromCharCode(97 + index)}`
}

function createVacantRoom(number: string, sharing: number): RoomRecord {
  return {
    number,
    sharing,
    beds: Array.from({ length: sharing }, (_, index) => ({ label: bedLabel({ number, sharing, beds: [] }, index), status: 'Vacant' as const })),
  }
}

type AuthUser = { id: string; name: string; email: string; role: 'admin' | 'staff' }
type AuthStatus = { setupRequired: boolean; user: AuthUser | null }
type HostelInventory = { name: string; rooms: RoomRecord[] }[]

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: 'same-origin',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })
  const result: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message = result && typeof result === 'object' && 'error' in result && typeof result.error === 'string'
      ? result.error
      : `Request failed (${response.status}).`
    throw new Error(message)
  }
  return result as T
}

function FullPageMessage({ message, action, onAction }: { message: string; action?: string; onAction?: () => void }) {
  return (
    <main className="auth-screen">
      <section className="auth-card">
        <div className="auth-brand"><span className="brand-mark"><Icon name="bed" size={21} /></span><span className="brand-name">hostel<span>desk</span></span></div>
        <p role="status">{message}</p>
        {action && onAction && <button className="button button-primary" onClick={onAction}>{action}</button>}
      </section>
    </main>
  )
}

function AuthenticationScreen({ setupRequired, onAuthenticated }: { setupRequired: boolean; onAuthenticated: (user: AuthUser) => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const result = await apiRequest<{ user: AuthUser }>(setupRequired ? '/api/auth/bootstrap' : '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ ...(setupRequired ? { name } : {}), email, password }),
      })
      onAuthenticated(result.user)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to authenticate.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <div className="auth-brand"><span className="brand-mark"><Icon name="bed" size={21} /></span><span className="brand-name">hostel<span>desk</span></span></div>
        <p className="eyebrow">{setupRequired ? 'SECURE WORKSPACE SETUP' : 'PRIVATE WORKSPACE'}</p>
        <h1>{setupRequired ? 'Create the administrator account' : 'Welcome back'}</h1>
        <p className="auth-intro">{setupRequired
          ? 'This one-time setup creates the first administrator. Public account creation is then permanently disabled.'
          : 'Sign in to access your hostel management workspace.'}</p>
        <form onSubmit={(event) => { void submit(event) }}>
          {setupRequired && <label className="form-field"><span>Administrator name <b>*</b></span><input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} /></label>}
          <label className="form-field"><span>Email address <b>*</b></span><input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} /></label>
          <label className="form-field"><span>Password <b>*</b></span><input type="password" autoComplete={setupRequired ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={setupRequired ? 12 : 1} maxLength={128} /><small>{setupRequired ? 'Use at least 12 characters.' : 'Your password is never stored in the browser.'}</small></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary auth-submit" type="submit" disabled={submitting}>{submitting ? 'Please wait…' : setupRequired ? 'Create administrator' : 'Sign in'}</button>
        </form>
        <p className="auth-footnote">Accounts and sessions are verified by the server. Keep this deployment private until the initial administrator setup is complete.</p>
      </section>
    </main>
  )
}

function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null)
  const [authError, setAuthError] = useState('')
  const [checkingAuth, setCheckingAuth] = useState(true)

  const refreshAuth = () => {
    setCheckingAuth(true)
    setAuthError('')
    void apiRequest<AuthStatus>('/api/auth/status')
      .then((status) => setAuthStatus(status))
      .catch((error: unknown) => setAuthError(error instanceof Error ? error.message : 'Unable to connect to the server.'))
      .finally(() => setCheckingAuth(false))
  }

  useEffect(() => {
    let active = true
    void apiRequest<AuthStatus>('/api/auth/status')
      .then((status) => { if (active) setAuthStatus(status) })
      .catch((error: unknown) => { if (active) setAuthError(error instanceof Error ? error.message : 'Unable to connect to the server.') })
      .finally(() => { if (active) setCheckingAuth(false) })
    return () => { active = false }
  }, [])

  if (checkingAuth) return <FullPageMessage message="Connecting securely…" />
  if (authError) return <FullPageMessage message={authError} action="Retry" onAction={refreshAuth} />
  if (!authStatus?.user) {
    return <AuthenticationScreen
      setupRequired={authStatus?.setupRequired ?? true}
      onAuthenticated={(user) => setAuthStatus({ setupRequired: false, user })}
    />
  }
  return <HostelApplication key={authStatus.user.id} user={authStatus.user} onSignOut={() => setAuthStatus({ setupRequired: false, user: null })} />
}

function HostelApplication({ user, onSignOut }: { user: AuthUser; onSignOut: () => void }) {
  const [activePage, setActivePage] = useState('Dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const [bookingCreate, setBookingCreate] = useState(false)
  const [bookingPrefill, setBookingPrefill] = useState<{ hostelId: string; room: string; bed: string; sharing: number } | null>(null)
  const [hostels, setHostels] = useState<HostelEntry[]>([])
  const [inventories, setInventories] = useState<Record<string, HostelInventory>>({})
  const [selectedHostelId, setSelectedHostelId] = useState(() => window.localStorage.getItem('hosteldesk.selectedHostel') ?? '')
  const [booting, setBooting] = useState(true)
  const [workspaceError, setWorkspaceError] = useState('')

  const fetchWorkspace = async () => {
    const result = await apiRequest<{ hostels: HostelEntry[] }>('/api/hostels')
    const inventoryEntries = await Promise.all(result.hostels.map(async (hostel) => {
      const inventory = await apiRequest<{ floors: HostelInventory }>(`/api/hostels/${encodeURIComponent(hostel.id)}/rooms`)
      return [hostel.id, inventory.floors] as const
    }))
    return { hostels: result.hostels, inventories: Object.fromEntries(inventoryEntries) as Record<string, HostelInventory> }
  }

  const applyWorkspace = (workspace: Awaited<ReturnType<typeof fetchWorkspace>>) => {
    setHostels(workspace.hostels)
    setInventories(workspace.inventories)
    setWorkspaceError('')
    const storedId = window.localStorage.getItem('hosteldesk.selectedHostel') ?? ''
    const selectedId = workspace.hostels.some((hostel) => hostel.id === storedId) ? storedId : workspace.hostels[0]?.id ?? ''
    setSelectedHostelId(selectedId)
    if (selectedId) window.localStorage.setItem('hosteldesk.selectedHostel', selectedId)
  }

  const loadWorkspace = async () => {
    setBooting(true)
    try {
      applyWorkspace(await fetchWorkspace())
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : 'Unable to load the hostel workspace.')
    } finally {
      setBooting(false)
    }
  }

  useEffect(() => {
    let active = true
    void fetchWorkspace()
      .then((workspace) => { if (active) applyWorkspace(workspace) })
      .catch((error: unknown) => { if (active) setWorkspaceError(error instanceof Error ? error.message : 'Unable to load the hostel workspace.') })
      .finally(() => { if (active) setBooting(false) })
    return () => { active = false }
  }, [])

  const selectedHostel = hostels.find((hostel) => hostel.id === selectedHostelId) ?? hostels[0]
  const selectedHostelFloors = selectedHostel ? inventories[selectedHostel.id] ?? [] : []
  const userInitials = user.name.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()

  const selectHostel = (id: string) => {
    setSelectedHostelId(id)
    window.localStorage.setItem('hosteldesk.selectedHostel', id)
  }

  const saveRoom = async (floor: string, room: RoomRecord) => {
    const result = await apiRequest<{ floors: HostelInventory }>(`/api/hostels/${encodeURIComponent(selectedHostel.id)}/rooms`, {
      method: 'POST',
      body: JSON.stringify({ floor, number: room.number, sharing: room.sharing }),
    })
    setInventories((current) => ({ ...current, [selectedHostel.id]: result.floors }))
  }

  const editRoom = async (_floor: string, room: RoomRecord) => {
    if (!room.id) throw new Error('This room has no database ID and cannot be updated.')
    const result = await apiRequest<{ floors: HostelInventory }>(`/api/hostels/${encodeURIComponent(selectedHostel.id)}/rooms/${encodeURIComponent(room.id)}`, {
      method: 'PUT',
      body: JSON.stringify({ number: room.number, sharing: room.sharing }),
    })
    setInventories((current) => ({ ...current, [selectedHostel.id]: result.floors }))
  }

  const loadInventoryForDate = async (date: string) => {
    const result = await apiRequest<{ floors: HostelInventory }>(
      `/api/hostels/${encodeURIComponent(selectedHostel.id)}/rooms?date=${encodeURIComponent(date)}`,
    )
    setInventories((current) => ({ ...current, [selectedHostel.id]: result.floors }))
  }

  const createHostel = async (hostel: HostelEntry, rooms: { floor: string; room: RoomRecord }[]) => {
    const result = await apiRequest<{ hostel: HostelEntry }>('/api/hostels', {
      method: 'POST',
      body: JSON.stringify({
        name: hostel.name,
        address: hostel.address,
        floors: hostel.floors.map((name) => ({
          name,
          roomCount: rooms.filter((entry) => entry.floor === name).length,
        })),
      }),
    })
    const inventory = await apiRequest<{ floors: HostelInventory }>(`/api/hostels/${encodeURIComponent(result.hostel.id)}/rooms`)
    setHostels((current) => [...current, result.hostel])
    setInventories((current) => ({ ...current, [result.hostel.id]: inventory.floors }))
    selectHostel(result.hostel.id)
    setActivePage('Rooms & beds')
  }

  const navigate = (page: string) => {
    setActivePage(page === 'New booking' ? 'Bookings' : page)
    setBookingCreate(page === 'New booking')
    setBookingPrefill(null)
    setMenuOpen(false)
  }

  const startBookingFromBed = (room: string, bed: string, sharing: number) => {
    setActivePage('Bookings')
    setBookingCreate(true)
    setBookingPrefill({ hostelId: selectedHostel.id, room, bed, sharing })
    setMenuOpen(false)
  }

  const signOut = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST', body: '{}' })
      onSignOut()
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : 'Unable to sign out.')
    }
  }

  if (booting) return <FullPageMessage message="Loading your hostel workspace…" />
  if (workspaceError) return <FullPageMessage message={workspaceError} action="Retry" onAction={() => { setBooting(true); setWorkspaceError(''); void loadWorkspace() }} />
  if (!selectedHostel) {
    return (
      <div className="app-shell setup-shell">
        <main className="main-content"><div className="page-wrap">
          <div className="setup-header">
            <div className="sidebar-profile"><div className="profile-info"><strong>{user.name}</strong><span>{user.role === 'admin' ? 'Administrator' : 'Staff'}</span></div><button className="button button-secondary" onClick={() => { void signOut() }}>Sign out</button></div>
            {user.role === 'admin' && <div className="setup-import-actions"><button className="button button-secondary" onClick={() => setActivePage(activePage === 'Data import' ? 'Settings' : 'Data import')}>{activePage === 'Data import' ? 'Set up manually' : 'Import existing data'}</button></div>}
          </div>
          {activePage === 'Data import' && user.role === 'admin'
            ? <DataImportScreen onImported={() => { void loadWorkspace() }} />
            : <HostelSettings hostels={hostels} selectedHostelId="" canEdit={user.role === 'admin'} onSelectHostel={selectHostel} onAddHostel={createHostel} onRooms={() => setActivePage('Rooms & beds')} />}
        </div></main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <a className="brand" href="#" onClick={() => navigate('Dashboard')}>
          <span className="brand-mark"><Icon name="bed" size={21} /></span>
          <span className="brand-name">hostel<span>desk</span></span>
        </a>

        <div className="workspace-label">WORKSPACE</div>
        <label className="hostel-select-label" htmlFor="hostel-select">Current hostel</label>
        <div className="hostel-select-wrap">
          <select id="hostel-select" value={selectedHostel?.id ?? ''} onChange={(event) => selectHostel(event.target.value)}>
            {hostels.map((hostel) => <option value={hostel.id} key={hostel.id}>{hostel.name}</option>)}
          </select>
          <Icon name="chevron" size={16} />
        </div>
        {user.role === 'admin' && <button className="sidebar-add-hostel" onClick={() => navigate('Settings')}><Icon name="plus" size={14} /> Add a hostel</button>}

        <div className="workspace-label nav-label">MANAGE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navigation.filter((item) => !['Staff accounts', 'Data import'].includes(item.label) || user.role === 'admin').map((item) => (
            <button
              className={`nav-link ${activePage === item.label ? 'nav-link-active' : ''}`}
              key={item.label}
              onClick={() => navigate(item.label)}
              aria-current={activePage === item.label ? 'page' : undefined}
            >
              <Icon name={item.icon} size={19} />
              <span>{item.label}</span>
              {item.label === 'Bookings' && selectedHostel.id === 'maple' && <span className="nav-count">8</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />
        <button className={`nav-link settings-link ${activePage === 'Settings' ? 'nav-link-active' : ''}`} onClick={() => navigate('Settings')}>
          <Icon name="settings" size={19} />
          <span>Settings</span>
        </button>
        <div className="sidebar-profile">
          <div className="profile-avatar">{userInitials}</div>
          <div className="profile-info">
            <strong>{user.name}</strong>
            <span>{user.role === 'admin' ? 'Administrator' : 'Staff'}</span>
          </div>
          <button className="profile-more" aria-label="Sign out" title="Sign out" onClick={() => { void signOut() }}><span /><span /><span /></button>
        </div>
      </aside>

      {menuOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu-button icon-button" aria-label="Open navigation" onClick={() => setMenuOpen(true)}>
            <Icon name="menu" />
          </button>
          <div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-divider">/</span><strong>{activePage}</strong></div>
          <div className="topbar-actions">
            <button className="icon-button search-button" aria-label="Search"><Icon name="search" /></button>
            <button className="icon-button notification-button" aria-label="Notifications"><Icon name="bell" /><span /></button>
            <div className="topbar-divider" />
            <div className="topbar-date"><Icon name="calendar" size={17} /><span>Thursday, 2 Oct</span></div>
          </div>
        </header>

        <div className="page-wrap">
          <div className="preview-banner">
            <span className="preview-dot" />
            Dashboard metrics and hostel operations are loaded from the database; rent is entered per booking and payments are recorded manually.
          </div>

          {activePage === 'Dashboard' ? (
            <Dashboard onNavigate={navigate} hostelId={selectedHostel.id} hostelName={selectedHostel.name} userName={user.name} />
          ) : activePage === 'Bookings' ? (
            <BookingsScreen
              key={selectedHostel.id}
              creating={bookingCreate}
              hostel={selectedHostel}
              prefill={bookingPrefill?.hostelId === selectedHostel.id ? bookingPrefill : null}
              onCreate={() => setBookingCreate(true)}
              onBack={() => { setBookingCreate(false); setBookingPrefill(null) }}
              onDashboard={() => navigate('Dashboard')}
            />
          ) : activePage === 'Rooms & beds' ? (
            <RoomsScreen
              hostel={selectedHostel}
              addedRooms={selectedHostelFloors.flatMap((floor) => floor.rooms.map((room) => ({ floor: floor.name, room })))}
              roomEdits={{}}
              canEdit={user.role === 'admin'}
              onAddRoom={saveRoom}
              onEditRoom={editRoom}
              onNavigate={navigate}
              onStartBooking={startBookingFromBed}
              onAvailabilityDateChange={loadInventoryForDate}
            />
          ) : activePage === 'Settings' ? (
            <HostelSettings hostels={hostels} selectedHostelId={selectedHostel.id} canEdit={user.role === 'admin'} onSelectHostel={selectHostel} onAddHostel={createHostel} onRooms={() => navigate('Rooms & beds')} />
          ) : activePage === 'Guests' ? (
            <GuestsScreen key={selectedHostel.id} hostel={selectedHostel} />
          ) : activePage === 'Payments' ? (
            <PaymentsScreen key={selectedHostel.id} hostel={selectedHostel} />
          ) : activePage === 'Reports' ? (
            <ReportsScreen key={selectedHostel.id} hostel={selectedHostel} />
          ) : activePage === 'Staff accounts' && user.role === 'admin' ? (
            <StaffAccountsScreen hostels={hostels} />
          ) : activePage === 'Data import' && user.role === 'admin' ? (
            <DataImportScreen onImported={() => { void loadWorkspace() }} />
          ) : activePage === 'Account security' ? (
            <PasswordSettingsScreen />
          ) : (
            <section className="coming-soon-card">
              <span className="coming-icon"><Icon name={navigation.find((item) => item.label === activePage)?.icon ?? 'settings'} size={24} /></span>
              <p className="eyebrow">WORK IN PROGRESS</p>
              <h1>{activePage}</h1>
              <p>This section is part of the approved product scope and is being built next.</p>
              <button className="button button-primary" onClick={() => navigate('Dashboard')}>Back to dashboard</button>
            </section>
          )}
          <footer className="page-footer">HostelDesk <span>·</span> Hospitality, made simpler</footer>
        </div>
      </main>

      <nav className="mobile-tabbar" aria-label="Mobile navigation">
        {[
          { label: 'Home', page: 'Dashboard', icon: 'dashboard' as IconName },
          { label: 'Bookings', page: 'Bookings', icon: 'bookings' as IconName },
          { label: 'Rooms', page: 'Rooms & beds', icon: 'rooms' as IconName },
          { label: 'Guests', page: 'Guests', icon: 'guests' as IconName },
        ].map((item) => (
          <button className={activePage === item.page ? 'mobile-tab-active' : ''} key={item.page} onClick={() => navigate(item.page)}>
            <Icon name={item.icon} size={20} />
            <span>{item.label}</span>
          </button>
        ))}
        <button className="mobile-add-button" aria-label="Create booking" onClick={() => navigate('Bookings')}><Icon name="plus" size={21} /></button>
      </nav>
    </div>
  )
}

function Dashboard({ onNavigate, hostelId, hostelName, userName }: { onNavigate: (page: string) => void; hostelId: string; hostelName: string; userName: string }) {
  const [inventory, setInventory] = useState<HostelInventory>([])
  const [bookings, setBookings] = useState<BookingRecord[]>([])
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [today] = useState(() => dateValue(new Date()))

  useEffect(() => {
    let active = true
    void Promise.all([
      apiRequest<{ floors: HostelInventory }>(`/api/hostels/${encodeURIComponent(hostelId)}/rooms?date=${today}`),
      apiRequest<{ bookings: BookingRecord[] }>(`/api/hostels/${encodeURIComponent(hostelId)}/bookings`),
      apiRequest<{ payments: PaymentRecord[] }>(`/api/hostels/${encodeURIComponent(hostelId)}/payments`),
    ]).then(([roomsResult, bookingResult, paymentResult]) => {
      if (active) {
        setInventory(roomsResult.floors)
        setBookings(bookingResult.bookings)
        setPayments(paymentResult.payments)
        setError('')
      }
    }).catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load the dashboard.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [hostelId, today])

  const beds = inventory.flatMap((floor) => floor.rooms).flatMap((room) => room.beds)
  const occupiedBeds = beds.filter((bed) => bed.status === 'Occupied').length
  const reservedBeds = beds.filter((bed) => bed.status === 'Reserved').length
  const vacantBeds = beds.filter((bed) => bed.status === 'Vacant').length
  const occupancyPercent = beds.length ? Math.round(occupiedBeds / beds.length * 100) : 0
  const currentMonth = today.slice(0, 7)
  const collectedCents = payments.filter((payment) => payment.receivedOn.startsWith(currentMonth)).reduce((sum, payment) => sum + payment.amountCents, 0)
  const outstandingBookings = bookings.filter((booking) => booking.outstandingCents > 0 && booking.status !== 'Cancelled')
    .sort((left, right) => right.outstandingCents - left.outstandingCents)
  const arrivalsToday = bookings.filter((booking) => booking.status === 'Reserved' && booking.arrivalDate === today)
  const money = (cents: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(cents / 100)

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">{today}</p>
          <h1>Good morning, {userName.split(/\s+/)[0]} <span className="wave">✳</span></h1>
          <p className="heading-subtitle">Here&apos;s what&apos;s happening at {hostelName} today.</p>
        </div>
        <button className="button button-primary" onClick={() => onNavigate('New booking')}><Icon name="plus" size={18} /> New booking</button>
      </section>

      {error && <p className="form-error" role="alert">{error}</p>}
      <section className="metrics-grid" aria-label="Hostel summary">
        <MetricCard title="Bed occupancy" value={`${occupancyPercent}%`} foot={<span className="metric-note">{occupiedBeds} of {beds.length} beds occupied</span>} icon="bed" tone="mint" />
        <MetricCard title="Vacant beds" value={String(vacantBeds)} foot={<span className="metric-note">across {inventory.length} floors</span>} icon="rooms" tone="sky" />
        <MetricCard title="Rent collected" value={money(collectedCents)} foot={<span className="metric-note">this month</span>} icon="payments" tone="lilac" />
        <MetricCard title="Outstanding" value={money(outstandingBookings.reduce((sum, booking) => sum + booking.outstandingCents, 0))} foot={<span className="warning-text">{outstandingBookings.length} bookings with a balance</span>} icon="clock" tone="sand" />
      </section>

      <section className="dashboard-grid">
        <div className="panel occupancy-panel">
          <div className="panel-heading">
            <div><h2>Occupancy overview</h2><p>Bed status by floor</p></div>
            <button className="text-button" onClick={() => onNavigate('Rooms & beds')}>View rooms <Icon name="arrow" size={15} /></button>
          </div>
          <div className="occupancy-summary">
            <div className="occupancy-ring" style={{ background: `conic-gradient(#288e6d 0 ${occupancyPercent}%, #eaf0ec ${occupancyPercent}% 100%)` }}><div><strong>{occupancyPercent}%</strong><span>occupied</span></div></div>
            <div className="occupancy-legend">
              <div><span className="legend-dot occupied" /><span>Occupied</span><strong>{occupiedBeds}</strong></div>
              <div><span className="legend-dot vacant" /><span>Vacant</span><strong>{vacantBeds}</strong></div>
              <div><span className="legend-dot reserved" /><span>Reserved</span><strong>{reservedBeds}</strong></div>
            </div>
          </div>
          <div className="floor-list">
            {inventory.map((floor) => {
              const floorBeds = floor.rooms.flatMap((room) => room.beds)
              const floorOccupied = floorBeds.filter((bed) => bed.status === 'Occupied').length
              return <div className="floor-row" key={floor.name}>
                <span className="floor-name">{floor.name}</span>
                <div className="floor-progress"><span style={{ width: `${floorBeds.length ? Math.round(floorOccupied / floorBeds.length * 100) : 0}%` }} /></div>
                <span className="floor-count">{floorOccupied}<span>/{floorBeds.length}</span></span>
              </div>
            })}
            {!inventory.length && <p className="metric-note">{loading ? 'Loading occupancy…' : 'No floor inventory has been configured.'}</p>}
          </div>
        </div>

        <div className="panel arrivals-panel">
          <div className="panel-heading">
            <div><h2>Today&apos;s arrivals</h2><p>{arrivalsToday.length} guests scheduled to arrive</p></div>
            <button className="text-button" onClick={() => onNavigate('Bookings')}>View bookings</button>
          </div>
          <div className="arrival-list">
            {arrivalsToday.map((booking) => (
              <div className="arrival-row" key={booking.id}>
                <div className="guest-avatar neutral">{booking.guest.name.slice(0, 2).toUpperCase()}</div>
                <div className="guest-detail"><strong>{booking.guest.name}</strong><span>Room {booking.room} · {booking.bed}</span></div>
                <div className="arrival-time"><Icon name="calendar" size={14} />{booking.arrivalDate}</div>
              </div>
            ))}
            {!arrivalsToday.length && <p className="metric-note">{loading ? 'Loading arrivals…' : 'No arrivals scheduled today.'}</p>}
          </div>
          <button className="panel-footer-link" onClick={() => onNavigate('Bookings')}>View all bookings <Icon name="arrow" size={15} /></button>
        </div>
      </section>

      <section className="dashboard-grid lower-grid">
        <div className="panel overdue-panel">
          <div className="panel-heading">
            <div><h2>Unpaid balances</h2><p>Bookings with an outstanding rent balance</p></div>
            <span className="small-count">{outstandingBookings.length} pending</span>
          </div>
          <div className="overdue-list">
            {outstandingBookings.slice(0, 4).map((booking) => (
              <div className="overdue-row" key={booking.id}>
                <div className="guest-avatar neutral">{booking.guest.name.slice(0, 2).toUpperCase()}</div>
                <div className="guest-detail"><strong>{booking.guest.name}</strong><span>{booking.reference} · Room {booking.room}</span></div>
                <div className="overdue-amount">{money(booking.outstandingCents)}</div>
                <button className="icon-button row-action" aria-label={`Open ${booking.guest.name} balance`} onClick={() => onNavigate('Payments')}><Icon name="arrow" size={16} /></button>
              </div>
            ))}
            {!outstandingBookings.length && <p className="metric-note">{loading ? 'Loading balances…' : 'No booking balances are outstanding.'}</p>}
          </div>
          <button className="panel-footer-link" onClick={() => onNavigate('Payments')}>View outstanding balances <Icon name="arrow" size={15} /></button>
        </div>

        <div className="panel quick-panel">
          <div className="panel-heading"><div><h2>Quick actions</h2><p>Common tasks, right at hand</p></div></div>
          <div className="quick-actions">
            <button onClick={() => onNavigate('New booking')}><span className="quick-icon quick-blue"><Icon name="plus" size={19} /></span><span><strong>New booking</strong><small>Reserve a room or bed</small></span><Icon name="arrow" size={16} /></button>
            <button onClick={() => onNavigate('Payments')}><span className="quick-icon quick-green"><Icon name="payments" size={19} /></span><span><strong>Record payment</strong><small>Cash or UPI received</small></span><Icon name="arrow" size={16} /></button>
            <button onClick={() => onNavigate('Guests')}><span className="quick-icon quick-violet"><Icon name="guests" size={19} /></span><span><strong>Guest directory</strong><small>View guest records and stays</small></span><Icon name="arrow" size={16} /></button>
          </div>
        </div>
      </section>
    </>
  )
}

function MetricCard({ title, value, foot, icon, tone }: { title: string; value: string; foot: ReactNode; icon: IconName; tone: string }) {
  return (
    <article className="metric-card">
      <div className="metric-top"><span>{title}</span><span className={`metric-icon ${tone}`}><Icon name={icon} size={18} /></span></div>
      <strong className="metric-value">{value}</strong>
      <div className="metric-foot">{foot}</div>
    </article>
  )
}

type BookingStatus = 'Reserved' | 'Checked in' | 'Checked out' | 'Cancelled'
type BookingRecord = {
  id: string
  reference: string
  guest: { id: string; name: string; email: string; mobile: string }
  room: string
  bed: string
  sharing: number
  arrivalDate: string
  departureDate: string
  status: BookingStatus
  totalRentCents: number
  paidCents: number
  outstandingCents: number
}

function BookingsScreen({
  creating,
  hostel,
  prefill,
  onCreate,
  onBack,
  onDashboard,
}: {
  creating: boolean
  hostel: HostelEntry
  prefill: { hostelId: string; room: string; bed: string; sharing: number } | null
  onCreate: () => void
  onBack: () => void
  onDashboard: () => void
}) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All bookings')
  const [bookings, setBookings] = useState<BookingRecord[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [todayDate] = useState(() => dateValue(new Date()))

  const loadBookings = useCallback(async () => {
    try {
      const result = await apiRequest<{ bookings: BookingRecord[] }>(`/api/hostels/${encodeURIComponent(hostel.id)}/bookings`)
      setBookings(result.bookings)
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load bookings.')
    } finally {
      setLoading(false)
    }
  }, [hostel.id])

  useEffect(() => {
    let active = true
    void apiRequest<{ bookings: BookingRecord[] }>(`/api/hostels/${encodeURIComponent(hostel.id)}/bookings`)
      .then((result) => {
        if (active) {
          setBookings(result.bookings)
          setError('')
        }
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load bookings.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [hostel.id])

  if (creating) {
    return <NewBookingForm
      hostel={hostel}
      prefill={prefill}
      onBack={onBack}
      onDashboard={onDashboard}
      onSaved={() => { onBack(); void loadBookings() }}
    />
  }

  const filteredBookings = bookings.filter((booking) => {
    const matchesStatus = statusFilter === 'All bookings' || booking.status === statusFilter
    const searchText = `${booking.guest.name} ${booking.reference} ${booking.guest.mobile} ${booking.room}`.toLowerCase()
    return matchesStatus && searchText.includes(search.toLowerCase().trim())
  })
  const money = (cents: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(cents / 100)
  const changeStatus = async (booking: BookingRecord, status: BookingStatus) => {
    setError('')
    try {
      await apiRequest(`/api/hostels/${encodeURIComponent(hostel.id)}/bookings/${encodeURIComponent(booking.id)}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      })
      await loadBookings()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update booking.')
    }
  }

  return (
    <section className="bookings-screen">
      <div className="page-heading">
        <div>
          <p className="eyebrow">HOSTEL OPERATIONS</p>
          <h1>Bookings</h1>
          <p className="heading-subtitle">Manage reservations, check-ins, and guest stays for {hostel.name}.</p>
        </div>
        <button className="button button-primary" onClick={onCreate}><Icon name="plus" size={18} /> New booking</button>
      </div>

      <div className="booking-summary-strip">
        <div><span className="booking-summary-icon reserved-icon"><Icon name="bookings" size={17} /></span><span><strong>{bookings.filter((booking) => booking.status === 'Reserved').length}</strong><small>Upcoming</small></span></div>
        <div><span className="booking-summary-icon checked-icon"><Icon name="bed" size={17} /></span><span><strong>{bookings.filter((booking) => booking.status === 'Checked in').length}</strong><small>Checked in</small></span></div>
        <div><span className="booking-summary-icon arrival-icon"><Icon name="calendar" size={17} /></span><span><strong>{bookings.filter((booking) => booking.arrivalDate === todayDate).length}</strong><small>Arriving today</small></span></div>
      </div>

      <div className="panel booking-list-panel">
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="booking-list-heading">
          <div><h2>All bookings</h2><p>Recent and upcoming guest stays</p></div>
          <span className="booking-total">{filteredBookings.length} records</span>
        </div>
        <div className="booking-filters">
          <label className="booking-search">
            <Icon name="search" size={17} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search guest, phone, or booking ID" />
          </label>
          <label className="visually-hidden" htmlFor="booking-status">Filter by status</label>
          <select id="booking-status" className="booking-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option>All bookings</option>
            <option>Reserved</option>
            <option>Checked in</option>
            <option>Checked out</option>
            <option>Cancelled</option>
          </select>
        </div>

        <div className="booking-table-wrap">
          <table className="booking-table">
            <thead><tr><th>GUEST</th><th>ROOM / BED</th><th>STAY DATES</th><th>STATUS</th><th>BALANCE</th><th /></tr></thead>
            <tbody>
              {filteredBookings.map((booking) => (
                <tr key={booking.id}>
                  <td><div className="booking-guest-cell"><span className="guest-avatar neutral">{booking.guest.name.slice(0, 2).toUpperCase()}</span><span><strong>{booking.guest.name}</strong><small>{booking.reference}</small></span></div></td>
                  <td><strong className="booking-room">{booking.room} · {booking.bed}</strong><small className="booking-cell-sub">{booking.sharing}-sharing</small></td>
                  <td><strong className="booking-dates">{booking.arrivalDate}</strong><small className="booking-cell-sub">to {booking.departureDate}</small></td>
                  <td><span className={`status-pill ${booking.status.toLowerCase().replace(' ', '-')}`}>{booking.status}</span></td>
                  <td className={booking.outstandingCents === 0 ? 'balance-zero' : 'balance-due'}>{money(booking.outstandingCents)}</td>
                  <td>{booking.status === 'Reserved' ? <><button className="text-button" onClick={() => { void changeStatus(booking, 'Checked in') }}>Check in</button> <button className="text-button" onClick={() => { void changeStatus(booking, 'Cancelled') }}>Cancel</button></> : booking.status === 'Checked in' ? <button className="text-button" onClick={() => { void changeStatus(booking, 'Checked out') }}>Check out</button> : null}</td>
                </tr>
              ))}
              {filteredBookings.length === 0 && <tr><td colSpan={6}><div className="booking-empty">{loading ? 'Loading bookings…' : bookings.length ? 'No bookings match your search.' : `No bookings yet for ${hostel.name}.`}</div></td></tr>}
            </tbody>
          </table>
        </div>

        <div className="booking-mobile-list">
          {filteredBookings.map((booking) => (
            <article className="booking-mobile-card" key={booking.id}>
              <div className="booking-mobile-top">
                <div className="booking-guest-cell"><span className="guest-avatar neutral">{booking.guest.name.slice(0, 2).toUpperCase()}</span><span><strong>{booking.guest.name}</strong><small>{booking.reference}</small></span></div>
                <span className={`status-pill ${booking.status.toLowerCase().replace(' ', '-')}`}>{booking.status}</span>
              </div>
              <div className="booking-mobile-details"><span><Icon name="bed" size={15} /> Room {booking.room} · {booking.bed} · {booking.sharing}-sharing</span><span><Icon name="calendar" size={15} /> {booking.arrivalDate} – {booking.departureDate}</span></div>
              <div className="booking-mobile-balance"><span>Outstanding</span><strong className={booking.outstandingCents === 0 ? 'balance-zero' : 'balance-due'}>{money(booking.outstandingCents)}</strong></div>
            </article>
          ))}
          {filteredBookings.length === 0 && <div className="booking-empty">{loading ? 'Loading bookings…' : bookings.length ? 'No bookings match your search.' : `No bookings yet for ${hostel.name}.`}</div>}
        </div>
      </div>
    </section>
  )
}

type BookingDraft = {
  arrival: string
  departure: string
  sharing: string
  room: string
  bed: string
  name: string
  email: string
  mobile: string
  address: string
  emergency: string
  proof: string
}

function dateValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function NewBookingForm({ hostel, prefill, onBack, onDashboard, onSaved }: { hostel: HostelEntry; prefill: { hostelId: string; room: string; bed: string; sharing: number } | null; onBack: () => void; onDashboard: () => void; onSaved: () => void }) {
  const [step, setStep] = useState(1)
  const [complete, setComplete] = useState(false)
  const [totalRent, setTotalRent] = useState('')
  const [availability, setAvailability] = useState<{ id: string; label: string; number: string; sharing: number }[]>([])
  const [availabilityError, setAvailabilityError] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<BookingDraft>(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const nextMonth = new Date(tomorrow)
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    return {
      arrival: dateValue(tomorrow),
      departure: dateValue(nextMonth),
      sharing: prefill ? `${prefill.sharing} sharing` : '',
      room: prefill ? `Room ${prefill.room}` : '',
      bed: prefill?.bed ?? '',
      name: '',
      email: '',
      mobile: '',
      address: '',
      emergency: '',
      proof: '',
    }
  })

  const update = (field: keyof BookingDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  useEffect(() => {
    let active = true
    void apiRequest<{ beds: { id: string; label: string; number: string; sharing: number }[] }>(
      `/api/hostels/${encodeURIComponent(hostel.id)}/availability?arrival=${encodeURIComponent(draft.arrival)}&departure=${encodeURIComponent(draft.departure)}`,
    ).then((result) => {
      if (!active) return
      setAvailability(result.beds)
      setAvailabilityError('')
    }).catch((loadError: unknown) => {
      if (active) setAvailabilityError(loadError instanceof Error ? loadError.message : 'Unable to check bed availability.')
    })
    return () => { active = false }
  }, [hostel.id, draft.arrival, draft.departure])

  const availableSharings = [...new Set(availability.map((bed) => bed.sharing))].sort((left, right) => left - right)
  const roomOptions = [...new Set(availability.filter((bed) => `${bed.sharing} sharing` === draft.sharing).map((bed) => bed.number))]
  const bedOptions = availability.filter((bed) => `${bed.sharing} sharing` === draft.sharing && `Room ${bed.number}` === draft.room)
  const selectedBed = bedOptions.find((bed) => bed.label === draft.bed)
  const stepOneReady = Boolean(draft.arrival && draft.departure && draft.sharing && draft.room && selectedBed && draft.departure > draft.arrival)
  const rentValid = /^\d{1,9}(\.\d{1,2})?$/.test(totalRent)
    && Number.isFinite(Number(totalRent)) && Number(totalRent) >= 0 && Number(totalRent) <= 1_000_000_000
  const stepTwoReady = Boolean(draft.name.trim() && draft.email.trim() && draft.mobile.trim() && draft.address.trim() && draft.emergency.trim() && draft.proof)

  const saveBooking = async () => {
    if (!selectedBed || !rentValid) return
    setSaving(true)
    setError('')
    try {
      await apiRequest(`/api/hostels/${encodeURIComponent(hostel.id)}/bookings`, {
        method: 'POST',
        body: JSON.stringify({
          name: draft.name,
          email: draft.email,
          mobile: draft.mobile,
          address: draft.address,
          emergencyContact: draft.emergency,
          identityProof: draft.proof,
          arrivalDate: draft.arrival,
          departureDate: draft.departure,
          bedId: selectedBed.id,
          totalRentCents: Math.round(Number(totalRent) * 100),
        }),
      })
      setComplete(true)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save booking.')
    } finally {
      setSaving(false)
    }
  }

  if (complete) {
    return (
      <section className="booking-complete-card">
        <span className="complete-check"><Icon name="bookings" size={25} /></span>
        <p className="eyebrow">BOOKING SAVED</p>
        <h1>Looks good, {draft.name}.</h1>
        <p>The reservation and guest profile were saved for {hostel.name}.</p>
        <div className="complete-actions">
          <button className="button button-secondary" onClick={onDashboard}>Back to dashboard</button>
          <button className="button button-primary" onClick={onSaved}>View bookings</button>
        </div>
      </section>
    )
  }

  return (
    <section className="new-booking-screen">
      <button className="back-link" onClick={onBack}>← <span>Back to bookings</span></button>
      <div className="page-heading create-heading">
        <div><p className="eyebrow">RESERVATIONS</p><h1>New booking</h1><p className="heading-subtitle">Reserve a bed and add the guest details.</p></div>
      </div>

      <div className="booking-wizard-layout">
        <div className="booking-form-column">
          <div className="wizard-steps" aria-label="Booking form progress">
            <div className={`wizard-step ${step >= 1 ? 'step-active' : ''}`}><span>1</span><div><strong>Stay details</strong><small>Dates and bed</small></div></div>
            <span className={`wizard-connector ${step >= 2 ? 'connector-active' : ''}`} />
            <div className={`wizard-step ${step >= 2 ? 'step-active' : ''}`}><span>2</span><div><strong>Guest details</strong><small>Contact information</small></div></div>
            <span className={`wizard-connector ${step >= 3 ? 'connector-active' : ''}`} />
            <div className={`wizard-step ${step >= 3 ? 'step-active' : ''}`}><span>3</span><div><strong>Review</strong><small>Confirm details</small></div></div>
          </div>

          <div className="panel booking-form-panel">
            {step === 1 && (
              <>
                <div className="form-section-heading"><h2>Stay details</h2><p>Choose the guest&apos;s dates and an available bed.</p></div>
                <div className="form-grid">
                  <label className="form-field"><span>Hostel</span><select disabled value={hostel.name}><option>{hostel.name}</option></select><small>Selected in the workspace menu</small></label>
                  <span className="form-field-spacer" />
                  <label className="form-field"><span>Check-in date <b>*</b></span><input type="date" value={draft.arrival} onChange={(event) => update('arrival', event.target.value)} required /></label>
                  <label className="form-field"><span>Planned check-out <b>*</b></span><input type="date" min={draft.arrival} value={draft.departure} onChange={(event) => update('departure', event.target.value)} required /></label>
                  <label className="form-field"><span>Sharing option <b>*</b></span><select value={draft.sharing} onChange={(event) => { update('sharing', event.target.value); update('room', ''); update('bed', '') }} required disabled={!availableSharings.length}><option value="">Select sharing</option>{availableSharings.map((sharing) => <option key={sharing}>{sharing} sharing</option>)}</select></label>
                  <label className="form-field"><span>Room <b>*</b></span><select value={draft.room} onChange={(event) => { update('room', event.target.value); update('bed', '') }} required disabled={!draft.sharing}><option value="">Select room</option>{roomOptions.map((room) => <option key={room}>Room {room}</option>)}</select></label>
                  <label className="form-field"><span>Available bed <b>*</b></span><select value={draft.bed} onChange={(event) => update('bed', event.target.value)} required disabled={!draft.room}><option value="">Select bed</option>{bedOptions.map((bed) => <option key={bed.id} value={bed.label}>{bed.label}</option>)}</select></label>
                </div>
                <div className="form-info"><Icon name="bed" size={18} /><span>{availabilityError || (availability.length ? `Beds are checked for the selected dates in ${hostel.name}; overlapping reservations are excluded.` : `No beds are available for these dates in ${hostel.name}.`)}</span></div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="form-section-heading"><h2>Guest details</h2><p>Enter the guest&apos;s contact and identification type.</p></div>
                <div className="form-grid">
                  <label className="form-field form-field-wide"><span>Full name <b>*</b></span><input autoComplete="name" value={draft.name} onChange={(event) => update('name', event.target.value)} placeholder="Guest's full name" required /></label>
                  <label className="form-field"><span>Email address <b>*</b></span><input type="email" autoComplete="email" value={draft.email} onChange={(event) => update('email', event.target.value)} placeholder="guest@example.com" required /></label>
                  <label className="form-field"><span>Mobile number <b>*</b></span><input type="tel" autoComplete="tel" value={draft.mobile} onChange={(event) => update('mobile', event.target.value)} placeholder="+91 98765 43210" required /></label>
                  <label className="form-field form-field-wide"><span>Address <b>*</b></span><textarea autoComplete="street-address" value={draft.address} onChange={(event) => update('address', event.target.value)} placeholder="Street, city, state, PIN code" rows={2} required /></label>
                  <label className="form-field"><span>Emergency contact number <b>*</b></span><input type="tel" value={draft.emergency} onChange={(event) => update('emergency', event.target.value)} placeholder="+91 98765 43210" required /></label>
                  <label className="form-field"><span>Identity proof submitted <b>*</b></span><select value={draft.proof} onChange={(event) => update('proof', event.target.value)} required><option value="">Select proof type</option><option>Aadhaar card</option><option>Driving licence</option><option>Voter ID</option><option>PAN card</option></select></label>
                </div>
                <div className="form-info"><Icon name="guests" size={18} /><span>Record only the proof type. Do not upload or store an identity document in this app.</span></div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="form-section-heading"><h2>Review booking</h2><p>Set the agreed total rent and confirm the details.</p></div>
                <div className="review-sections">
                  <div className="review-block"><div className="review-block-title"><strong>Stay details</strong><button onClick={() => setStep(1)}>Edit</button></div><dl><div><dt>Hostel</dt><dd>{hostel.name}</dd></div><div><dt>Dates</dt><dd>{draft.arrival} to {draft.departure}</dd></div><div><dt>Room / bed</dt><dd>{draft.room}, {draft.bed} · {draft.sharing}</dd></div></dl><label className="form-field"><span>Total rent for this stay (₹) <b>*</b></span><input type="number" inputMode="decimal" min="0" max="1000000000" step="0.01" value={totalRent} onChange={(event) => setTotalRent(event.target.value)} required /></label></div>
                  <div className="review-block"><div className="review-block-title"><strong>Guest details</strong><button onClick={() => setStep(2)}>Edit</button></div><dl><div><dt>Name</dt><dd>{draft.name}</dd></div><div><dt>Email</dt><dd>{draft.email}</dd></div><div><dt>Mobile</dt><dd>{draft.mobile}</dd></div><div><dt>Address</dt><dd>{draft.address}</dd></div><div><dt>Emergency contact</dt><dd>{draft.emergency}</dd></div><div><dt>Identity proof</dt><dd>{draft.proof}</dd></div></dl></div>
                </div>
                <div className="form-info"><Icon name="clock" size={18} /><span>Total rent is entered by staff. Payments are recorded separately after they are received outside this app.</span></div>
              </>
            )}

            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="form-actions">
              <button className="button button-secondary" onClick={step === 1 ? onBack : () => setStep(step - 1)}>{step === 1 ? 'Cancel' : 'Back'}</button>
              {step < 3 ? (
                <button className="button button-primary" disabled={step === 1 ? !stepOneReady : !stepTwoReady} onClick={() => setStep(step + 1)}>Continue <Icon name="arrow" size={16} /></button>
              ) : (
                <button className="button button-primary" disabled={!rentValid || saving} onClick={() => { void saveBooking() }}>{saving ? 'Saving…' : 'Save booking'} <Icon name="arrow" size={16} /></button>
              )}
            </div>
          </div>
        </div>

        <aside className="booking-side-note">
          <div className="booking-side-icon"><Icon name="calendar" size={20} /></div>
          <h3>Booking details</h3>
          <p>The selected bed is reserved for the stay dates once you save. Booking and payment history stays with the selected hostel.</p>
          <div className="booking-side-rule" />
          <span>Selected hostel</span><strong>{hostel.name}</strong>
          <small>Check-in date is included; check-out date is excluded.</small>
        </aside>
      </div>
    </section>
  )
}

type BedState = 'Occupied' | 'Vacant' | 'Reserved' | 'Maintenance'

type RoomBed = {
  id?: string
  label: string
  status: BedState
  guest?: string
  stay?: string
}

const roomFloors: { name: string; rooms: RoomRecord[] }[] = [
  {
    name: 'Ground floor',
    rooms: [
      {
        number: 'G-101',
        sharing: 2,
        beds: [
          { label: 'Bed 1', status: 'Occupied', guest: 'Ishita Rao', stay: 'Checked in · 18 Sep' },
          { label: 'Bed 2', status: 'Vacant' },
        ],
      },
      {
        number: 'G-102',
        sharing: 4,
        beds: [
          { label: 'Bed 1', status: 'Occupied', guest: 'Neha Joshi', stay: 'Checked in · 21 Sep' },
          { label: 'Bed 2', status: 'Reserved', guest: 'Meera Shah', stay: 'Arriving · 04 Oct' },
          { label: 'Bed 3', status: 'Vacant' },
          { label: 'Bed 4', status: 'Occupied', guest: 'Aditi Bose', stay: 'Checked in · 26 Sep' },
        ],
      },
      {
        number: 'G-103',
        sharing: 3,
        beds: [
          { label: 'Bed 1', status: 'Maintenance', stay: 'Maintenance · until 05 Oct' },
          { label: 'Bed 2', status: 'Occupied', guest: 'Sana Khan', stay: 'Checked in · 29 Sep' },
          { label: 'Bed 3', status: 'Vacant' },
        ],
      },
    ],
  },
  {
    name: 'First floor',
    rooms: [
      {
        number: '1-201',
        sharing: 2,
        beds: [
          { label: 'Bed 1', status: 'Occupied', guest: 'Ananya Sharma', stay: 'Checked in · 12 Sep' },
          { label: 'Bed 2', status: 'Occupied', guest: 'Kavya Reddy', stay: 'Checked in · 19 Sep' },
        ],
      },
      {
        number: '1-204',
        sharing: 4,
        beds: [
          { label: 'Bed 1', status: 'Occupied', guest: 'Ritika Das', stay: 'Checked in · 02 Sep' },
          { label: 'Bed 2', status: 'Occupied', guest: 'Pooja Iyer', stay: 'Checked in · 15 Sep' },
          { label: 'Bed 3', status: 'Vacant' },
          { label: 'Bed 4', status: 'Reserved', guest: 'Simran Gill', stay: 'Arriving · 06 Oct' },
        ],
      },
      {
        number: '1-208',
        sharing: 1,
        beds: [
          { label: 'Bed 1', status: 'Vacant' },
        ],
      },
    ],
  },
  {
    name: 'Second floor',
    rooms: [
      {
        number: '2-301',
        sharing: 3,
        beds: [
          { label: 'Bed 1', status: 'Occupied', guest: 'Priya Nair', stay: 'Checked in · 02 Oct' },
          { label: 'Bed 2', status: 'Occupied', guest: 'Tara Menon', stay: 'Checked in · 22 Sep' },
          { label: 'Bed 3', status: 'Vacant' },
        ],
      },
      {
        number: '2-306',
        sharing: 4,
        beds: [
          { label: 'Bed 1', status: 'Occupied', guest: 'Anika Roy', stay: 'Checked in · 10 Sep' },
          { label: 'Bed 2', status: 'Occupied', guest: 'Rhea Kapoor', stay: 'Checked in · 17 Sep' },
          { label: 'Bed 3', status: 'Occupied', guest: 'Sara Paul', stay: 'Checked in · 23 Sep' },
          { label: 'Bed 4', status: 'Vacant' },
        ],
      },
    ],
  },
]

function buildHostelFloors(
  hostel: HostelEntry,
  addedRooms: { floor: string; room: RoomRecord }[],
  roomEdits: Record<string, { floor: string; room: RoomRecord }>,
) {
  const floors = hostel.id === 'maple'
    ? roomFloors
    : hostel.floors.map((name) => ({ name, rooms: [] as RoomRecord[] }))

  return floors.map((floor) => ({
    ...floor,
    rooms: [
      ...floor.rooms.map((sourceRoom) => {
        const source = { ...sourceRoom, id: roomId(floor.name, sourceRoom) }
        return roomEdits[source.id]?.room ?? source
      }),
      ...addedRooms.filter((entry) => entry.floor === floor.name).map((entry) => {
        const source = { ...entry.room, id: entry.room.id ?? `saved:${hostel.id}:${floor.name}:${entry.room.number}` }
        return roomEdits[source.id]?.room ?? source
      }),
    ],
  }))
}

const bedStateClass: Record<BedState, string> = {
  Occupied: 'bed-occupied',
  Vacant: 'bed-vacant',
  Reserved: 'bed-reserved',
  Maintenance: 'bed-maintenance',
}

function RoomsScreen({
  hostel,
  addedRooms,
  roomEdits,
  canEdit,
  onAddRoom,
  onEditRoom,
  onNavigate,
  onStartBooking,
  onAvailabilityDateChange,
}: {
  hostel: HostelEntry
  addedRooms: { floor: string; room: RoomRecord }[]
  roomEdits: Record<string, { floor: string; room: RoomRecord }>
  canEdit: boolean
  onAddRoom: (floor: string, room: RoomRecord) => Promise<void>
  onEditRoom: (floor: string, room: RoomRecord) => Promise<void>
  onNavigate: (page: string) => void
  onStartBooking: (room: string, bed: string, sharing: number) => void
  onAvailabilityDateChange: (date: string) => Promise<void>
}) {
  const [floorFilter, setFloorFilter] = useState('All floors')
  const [statusFilter, setStatusFilter] = useState<BedState | 'All beds'>('All beds')
  const [selected, setSelected] = useState<{ room: RoomRecord; bed: RoomBed } | null>(null)
  const [viewDate, setViewDate] = useState(() => dateValue(new Date()))
  const [dateError, setDateError] = useState('')
  const [addRoomOpen, setAddRoomOpen] = useState(false)
  const [editingRoom, setEditingRoom] = useState<{ floor: string; room: RoomRecord } | null>(null)

  const allFloors = buildHostelFloors(hostel, addedRooms, roomEdits)

  const counts = allFloors.flatMap((floor) => floor.rooms).flatMap((room) => room.beds).reduce(
    (total, bed) => ({ ...total, [bed.status]: total[bed.status] + 1 }),
    { Occupied: 0, Vacant: 0, Reserved: 0, Maintenance: 0 } as Record<BedState, number>,
  )
  const visibleFloors = allFloors
    .filter((floor) => floorFilter === 'All floors' || floor.name === floorFilter)
    .map((floor) => {
      const rooms = floor.rooms
        .map((room) => ({
          ...room,
          visibleBeds: statusFilter === 'All beds'
            ? room.beds
            : room.beds.filter((bed) => bed.status === statusFilter),
        }))
        .filter((room) => room.visibleBeds.length > 0)
      return { ...floor, rooms }
    })
    .filter((floor) => floor.rooms.length > 0)

  return (
    <section className="rooms-screen">
      <div className="page-heading rooms-page-heading">
        <div><p className="eyebrow">HOSTEL OPERATIONS</p><h1>Rooms &amp; beds</h1><p className="heading-subtitle">See room capacity and bed status at a glance.</p></div>
        <div className="rooms-heading-actions">
          {canEdit && <button className="button button-secondary" onClick={() => onNavigate('Settings')}><Icon name="settings" size={17} /> Room settings</button>}
          {canEdit && <button className="button button-primary" onClick={() => setAddRoomOpen(true)}><Icon name="plus" size={17} /> Add room</button>}
        </div>
      </div>

      <div className="rooms-summary-grid">
        <div className="rooms-summary-card"><span className="room-summary-symbol summary-all"><Icon name="bed" size={18} /></span><span><small>Total beds</small><strong>{counts.Occupied + counts.Vacant + counts.Reserved + counts.Maintenance}</strong></span></div>
        <div className="rooms-summary-card"><span className="room-summary-symbol summary-occupied"><span /></span><span><small>Occupied</small><strong>{counts.Occupied}</strong></span></div>
        <div className="rooms-summary-card"><span className="room-summary-symbol summary-vacant"><span /></span><span><small>Vacant</small><strong>{counts.Vacant}</strong></span></div>
        <div className="rooms-summary-card"><span className="room-summary-symbol summary-reserved"><span /></span><span><small>Reserved / maintenance</small><strong>{counts.Reserved + counts.Maintenance}</strong></span></div>
      </div>

      <div className="rooms-toolbar">
        <div className="rooms-toolbar-copy"><h2>Bed availability</h2><p>{hostel.name} <span>·</span> database-backed inventory</p></div>
        <div className="rooms-toolbar-controls">
          <label className="room-date-field"><span className="visually-hidden">Availability date</span><Icon name="calendar" size={15} /><input type="date" value={viewDate} onChange={(event) => {
            const date = event.target.value
            setViewDate(date)
            setSelected(null)
            setDateError('')
            void onAvailabilityDateChange(date).catch((loadError: unknown) => setDateError(loadError instanceof Error ? loadError.message : 'Unable to load bed occupancy for this date.'))
          }} /></label>
          <label className="visually-hidden" htmlFor="floor-filter">Filter by floor</label>
          <select id="floor-filter" className="booking-status-filter" value={floorFilter} onChange={(event) => setFloorFilter(event.target.value)}>
            <option>All floors</option>
            {allFloors.map((floor) => <option key={floor.name}>{floor.name}</option>)}
          </select>
        </div>
      </div>

      {dateError && <p className="form-error" role="alert">{dateError}</p>}
      <div className="bed-legend" aria-label="Bed status filters">
        {(['All beds', 'Occupied', 'Vacant', 'Reserved', 'Maintenance'] as const).map((status) => (
          <button
            key={status}
            className={`legend-filter ${statusFilter === status ? 'legend-filter-active' : ''}`}
            onClick={() => setStatusFilter(status)}
            aria-pressed={statusFilter === status}
          >
            {status !== 'All beds' && <span className={`legend-status-dot ${bedStateClass[status]}`} />}
            {status}
            {status !== 'All beds' && <strong>{counts[status]}</strong>}
          </button>
        ))}
      </div>

      {selected && (
        <div className="selected-bed-banner">
          <div className={`selected-bed-indicator ${bedStateClass[selected.bed.status]}`}><Icon name="bed" size={17} /></div>
          <div className="selected-bed-copy"><strong>Room {selected.room.number} · {selected.bed.label}</strong><span>{selected.bed.status}{selected.bed.guest ? ` · ${selected.bed.guest}` : ''}{selected.bed.stay ? ` · ${selected.bed.stay}` : ''}</span></div>
          {selected.bed.status === 'Vacant' && <button className="text-button" onClick={() => onStartBooking(selected.room.number, selected.bed.label, selected.room.sharing)}>Start booking <Icon name="arrow" size={15} /></button>}
          {selected.bed.status === 'Reserved' && <button className="text-button" onClick={() => onNavigate('Bookings')}>View booking <Icon name="arrow" size={15} /></button>}
          <button className="close-selected-bed" aria-label="Close bed details" onClick={() => setSelected(null)}>×</button>
        </div>
      )}

      <div className="floor-sections">
        {visibleFloors.map((floor) => {
          const allBeds = floor.rooms.flatMap((room) => room.visibleBeds)
          const occupied = allBeds.filter((bed) => bed.status === 'Occupied').length
          return (
            <section className="floor-section" key={floor.name}>
              <div className="floor-section-heading">
                <div><span className="floor-building-icon"><Icon name="rooms" size={17} /></span><div><h2>{floor.name}</h2><p>{floor.rooms.length} rooms <span>·</span> {allBeds.length} {statusFilter === 'All beds' ? 'beds' : statusFilter.toLowerCase()}</p></div></div>
                <span className="floor-occupancy">{statusFilter === 'All beds' ? `${occupied} occupied` : `${allBeds.length} ${statusFilter.toLowerCase()}`}</span>
              </div>
              <div className="room-card-grid">
                {floor.rooms.map((room) => {
                  const roomOccupied = room.beds.filter((bed) => bed.status === 'Occupied').length
                  return (
                    <article className="room-card" key={room.number}>
                      <div className="room-card-heading">
                        <div><h3>Room {room.number}</h3><span>{room.sharing}-sharing</span></div>
                        <div className="room-heading-actions">
                          <span className="room-capacity">{statusFilter === 'All beds' ? `${roomOccupied}/${room.beds.length} occupied` : `${room.visibleBeds.length} ${statusFilter.toLowerCase()} · ${room.beds.length} beds`}</span>
                          {canEdit && <button className="room-edit-button" onClick={() => setEditingRoom({ floor: floor.name, room })}>Edit</button>}
                        </div>
                      </div>
                      <div className="room-bed-list">
                        {room.visibleBeds.map((bed) => (
                          <button
                            className={`room-bed-row ${bedStateClass[bed.status]} ${selected?.room.number === room.number && selected.bed.label === bedLabel(room, room.beds.indexOf(bed)) ? 'room-bed-selected' : ''}`}
                            key={`${room.id}-${room.beds.indexOf(bed)}`}
                            onClick={() => setSelected({ room, bed: { ...bed, label: bedLabel(room, room.beds.indexOf(bed)) } })}
                            aria-label={`${room.number} ${bedLabel(room, room.beds.indexOf(bed))}: ${bed.status}${bed.guest ? `, ${bed.guest}` : ''}`}
                          >
                            <span className="bed-row-indicator"><Icon name="bed" size={15} /></span>
                            <span className="bed-row-name">{bedLabel(room, room.beds.indexOf(bed))}</span>
                            <span className="bed-row-detail">{bed.guest ?? bed.stay ?? 'Available'}</span>
                            <span className="bed-row-state">{bed.status}</span>
                          </button>
                        ))}
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          )
        })}
        {visibleFloors.length === 0 && (
          <div className="rooms-empty-state">
            <span className="empty-room-icon"><Icon name="rooms" size={23} /></span>
            <strong>No rooms added yet</strong>
            <span>Add a room to start configuring beds for {hostel.name}.</span>
            {canEdit && <button className="button button-primary" onClick={() => setAddRoomOpen(true)}><Icon name="plus" size={16} /> Add first room</button>}
          </div>
        )}
      </div>
      <p className="prototype-note rooms-prototype-note">Room and bed settings are stored in the workspace database.</p>
      {addRoomOpen && <AddRoomModal floors={hostel.floors} existingRooms={allFloors.flatMap((floor) => floor.rooms.map((room) => ({ floor: floor.name, room })))} onClose={() => setAddRoomOpen(false)} onSave={async (floor, room) => { await onAddRoom(floor, room); setAddRoomOpen(false) }} />}
      {editingRoom && <EditRoomModal floor={editingRoom.floor} room={editingRoom.room} existingRooms={allFloors.flatMap((floor) => floor.rooms.map((room) => ({ floor: floor.name, room })))} onClose={() => setEditingRoom(null)} onSave={async (floor, room) => { await onEditRoom(floor, room); setEditingRoom(null) }} />}
    </section>
  )
}

function HostelSettings({
  hostels,
  selectedHostelId,
  canEdit,
  onSelectHostel,
  onAddHostel,
  onRooms,
}: {
  hostels: HostelEntry[]
  selectedHostelId: string
  canEdit: boolean
  onSelectHostel: (id: string) => void
  onAddHostel: (hostel: HostelEntry, rooms: { floor: string; room: RoomRecord }[]) => Promise<void>
  onRooms: () => void
}) {
  const [addOpen, setAddOpen] = useState(false)

  const createHostel = async (name: string, address: string, roomCounts: number[]) => {
    const floorNames = Array.from({ length: roomCounts.length }, (_, index) => {
      if (index === 0) return 'Ground floor'
      const suffix = index === 1 ? 'st' : index === 2 ? 'nd' : index === 3 ? 'rd' : 'th'
      return `${index}${suffix} floor`
    })
    const hostel: HostelEntry = {
      id: crypto.randomUUID(),
      name: name.trim(),
      address: address.trim(),
      floors: floorNames,
    }
    const rooms = floorNames.flatMap((floor, floorIndex) =>
      Array.from({ length: roomCounts[floorIndex] }, (_, roomIndex) => ({
        floor,
        room: createVacantRoom(String((floorIndex + 1) * 100 + roomIndex + 1), 4),
      })),
    )
    await onAddHostel(hostel, rooms)
  }

  return (
    <section className="hostel-settings-screen">
      <div className="page-heading">
        <div><p className="eyebrow">WORKSPACE CONFIGURATION</p><h1>Hostels &amp; rooms</h1><p className="heading-subtitle">Set up each property and configure its room inventory.</p></div>
        {canEdit && <button className="button button-primary" onClick={() => setAddOpen(true)}><Icon name="plus" size={17} /> Add hostel</button>}
      </div>

      <div className="settings-notice"><span>i</span><p>Hostel and room inventory is stored in the protected workspace database.</p></div>

      <div className="hostel-settings-list">
        {hostels.map((hostel) => {
          const selected = hostel.id === selectedHostelId
          return (
            <article className={`hostel-settings-card ${selected ? 'hostel-settings-selected' : ''}`} key={hostel.id}>
              <div className="hostel-settings-icon"><Icon name="rooms" size={21} /></div>
              <div className="hostel-settings-info">
                <div className="hostel-settings-title"><h2>{hostel.name}</h2>{selected && <span>Selected</span>}</div>
                <p>{hostel.address || 'Address not added'}</p>
                <small>{hostel.floors.length} floors configured</small>
              </div>
              <div className="hostel-settings-actions">
                {!selected && <button className="button button-secondary" onClick={() => onSelectHostel(hostel.id)}>Select hostel</button>}
                <button className="button button-primary" onClick={() => { onSelectHostel(hostel.id); onRooms() }}><Icon name="rooms" size={16} /> Configure rooms</button>
              </div>
            </article>
          )
        })}
      </div>
      {canEdit && addOpen && <AddHostelModal onClose={() => setAddOpen(false)} onSave={createHostel} existingNames={hostels.map((hostel) => hostel.name)} />}
    </section>
  )
}

type StaffRecord = {
  id: string
  name: string
  email: string
  active: boolean
  hostels: { id: string; name: string }[]
}

function PasswordSettingsScreen() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (password !== confirmation) {
      setError('New passwords do not match.')
      return
    }
    setSaving(true)
    try {
      await apiRequest('/api/auth/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword: password }),
      })
      setCurrentPassword('')
      setPassword('')
      setConfirmation('')
      setSuccess('Password updated. Other active sessions have been signed out.')
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : 'Unable to change password.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="staff-screen">
      <div className="page-heading"><div><p className="eyebrow">ACCOUNT SECURITY</p><h1>Change password</h1><p className="heading-subtitle">Update your sign-in password. This signs out other active sessions.</p></div></div>
      <form className="panel staff-create-form" onSubmit={(event) => { void submit(event) }}>
        <div className="staff-form-fields">
          <label className="form-field"><span>Current password <b>*</b></span><input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required autoComplete="current-password" maxLength={128} /></label>
          <label className="form-field"><span>New password <b>*</b></span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="new-password" minLength={12} maxLength={128} /><small>Use at least 12 characters.</small></label>
          <label className="form-field"><span>Confirm new password <b>*</b></span><input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required autoComplete="new-password" minLength={12} maxLength={128} /></label>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {success && <p className="settings-notice" role="status">{success}</p>}
        <div className="staff-form-actions"><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Updating…' : 'Update password'}</button></div>
      </form>
    </section>
  )
}

function StaffAccountsScreen({ hostels }: { hostels: HostelEntry[] }) {
  const [staff, setStaff] = useState<StaffRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [hostelIds, setHostelIds] = useState<string[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [resetMember, setResetMember] = useState<string | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetSaving, setResetSaving] = useState(false)

  useEffect(() => {
    let active = true
    void apiRequest<{ staff: StaffRecord[] }>('/api/staff')
      .then((result) => { if (active) setStaff(result.staff) })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load staff accounts.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const result = await apiRequest<{ staff: StaffRecord }>('/api/staff', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, hostelIds }),
      })
      setStaff((current) => [result.staff, ...current])
      setName('')
      setEmail('')
      setPassword('')
      setHostelIds([])
      setFormOpen(false)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create this staff account.')
    } finally {
      setSaving(false)
    }
  }

  const deactivate = async (member: StaffRecord) => {
    if (!window.confirm(`Deactivate ${member.name}'s account and end their active sessions?`)) return
    try {
      await apiRequest(`/api/staff/${encodeURIComponent(member.id)}`, { method: 'DELETE' })
      setStaff((current) => current.map((entry) => entry.id === member.id ? { ...entry, active: false } : entry))
      setError('')
    } catch (deactivateError) {
      setError(deactivateError instanceof Error ? deactivateError.message : 'Unable to deactivate this account.')
    }
  }

  const resetPasswordForStaff = async (event: FormEvent<HTMLFormElement>, member: StaffRecord) => {
    event.preventDefault()
    setResetSaving(true)
    setError('')
    try {
      await apiRequest(`/api/staff/${encodeURIComponent(member.id)}/password`, {
        method: 'PUT',
        body: JSON.stringify({ password: resetPassword }),
      })
      setResetMember(null)
      setResetPassword('')
      setError('')
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Unable to reset staff password.')
    } finally {
      setResetSaving(false)
    }
  }

  return (
    <section className="staff-screen">
      <div className="page-heading">
        <div><p className="eyebrow">WORKSPACE ACCESS</p><h1>Staff accounts</h1><p className="heading-subtitle">Create staff sign-ins and limit each account to assigned hostels.</p></div>
        <button className="button button-primary" onClick={() => { setFormOpen((open) => !open); setError('') }} disabled={hostels.length === 0}>
          <Icon name="plus" size={17} /> {formOpen ? 'Close form' : 'Add staff'}
        </button>
      </div>

      <div className="settings-notice"><span>i</span><p>Set a password of at least 12 characters and share it with the staff member securely. The password cannot be viewed again after account creation.</p></div>
      {error && <p className="staff-error" role="alert">{error}</p>}

      {formOpen && (
        <form className="panel staff-create-form" onSubmit={(event) => { void submit(event) }}>
          <div className="staff-form-heading"><h2>Create staff account</h2><p>Choose the hostels this account is allowed to access.</p></div>
          <div className="staff-form-fields">
            <label className="form-field"><span>Full name <b>*</b></span><input value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} autoComplete="name" /></label>
            <label className="form-field"><span>Email address <b>*</b></span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} autoComplete="username" /></label>
            <label className="form-field"><span>Initial password <b>*</b></span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={12} maxLength={128} autoComplete="new-password" /><small>At least 12 characters.</small></label>
          </div>
          <fieldset className="staff-hostel-picker">
            <legend>Hostel access <b>*</b></legend>
            {hostels.map((hostel) => (
              <label key={hostel.id}>
                <input type="checkbox" checked={hostelIds.includes(hostel.id)} onChange={(event) => setHostelIds((current) => event.target.checked ? [...current, hostel.id] : current.filter((id) => id !== hostel.id))} />
                <span>{hostel.name}</span>
              </label>
            ))}
          </fieldset>
          <div className="staff-form-actions">
            <button type="button" className="button button-secondary" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</button>
            <button type="submit" className="button button-primary" disabled={saving || hostelIds.length === 0}>{saving ? 'Creating…' : 'Create staff account'}</button>
          </div>
        </form>
      )}

      <div className="panel staff-list-panel">
        <div className="staff-list-heading"><div><h2>Team members</h2><p>{staff.filter((member) => member.active).length} active accounts</p></div></div>
        {loading ? <p className="staff-empty">Loading staff accounts…</p> : staff.length === 0 ? (
          <p className="staff-empty">No staff accounts yet.</p>
        ) : (
          <div className="staff-list">
            {staff.map((member) => (
              <article className={`staff-row ${member.active ? '' : 'staff-row-inactive'}`} key={member.id}>
                <div className="staff-avatar">{member.name.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</div>
                <div className="staff-identity"><strong>{member.name}</strong><span>{member.email}</span></div>
                <div className="staff-access"><small>HOSTEL ACCESS</small><span>{member.hostels.map((hostel) => hostel.name).join(', ') || 'No assigned hostels'}</span></div>
                <span className={`staff-status ${member.active ? 'staff-status-active' : ''}`}>{member.active ? 'Active' : 'Inactive'}</span>
                {member.active && <div className="staff-row-actions">
                  <button className="button button-secondary" onClick={() => { setResetMember(resetMember === member.id ? null : member.id); setResetPassword('') }}>Reset password</button>
                  <button className="button button-secondary staff-deactivate" onClick={() => { void deactivate(member) }}>Deactivate</button>
                </div>}
                {resetMember === member.id && <form className="staff-reset-form" onSubmit={(event) => { void resetPasswordForStaff(event, member) }}>
                  <label className="form-field"><span>New password for {member.name}</span><input type="password" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} minLength={12} maxLength={128} autoComplete="new-password" required /></label>
                  <button className="button button-primary" type="submit" disabled={resetSaving}>{resetSaving ? 'Resetting…' : 'Set new password'}</button>
                  <small>Share it securely. The change revokes the staff member&apos;s active sessions.</small>
                </form>}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

type GuestRecord = {
  id: string
  name: string
  email: string
  mobile: string
  address: string
  emergencyContact: string
  identityProof: string
  bookingCount: number
  lastBookingAt: string | null
}

function GuestsScreen({ hostel }: { hostel: HostelEntry }) {
  const [guests, setGuests] = useState<GuestRecord[]>([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    void apiRequest<{ guests: GuestRecord[] }>(`/api/hostels/${encodeURIComponent(hostel.id)}/guests`)
      .then((result) => { if (active) setGuests(result.guests) })
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load guests.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [hostel.id])

  const filtered = guests.filter((guest) => `${guest.name} ${guest.email} ${guest.mobile}`.toLowerCase().includes(search.trim().toLowerCase()))
  return (
    <section className="bookings-screen">
      <div className="page-heading"><div><p className="eyebrow">HOSTEL OPERATIONS</p><h1>Guests</h1><p className="heading-subtitle">Guest records and booking history for {hostel.name}.</p></div></div>
      <div className="panel booking-list-panel">
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="booking-list-heading"><div><h2>Guest directory</h2><p>{guests.length} profiles</p></div></div>
        <div className="booking-filters"><label className="booking-search"><Icon name="search" size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, or phone" /></label></div>
        <div className="booking-table-wrap">
          <table className="booking-table">
            <thead><tr><th>GUEST</th><th>CONTACT</th><th>IDENTITY PROOF</th><th>BOOKING HISTORY</th></tr></thead>
            <tbody>
              {filtered.map((guest) => <tr key={guest.id}>
                <td><div className="booking-guest-cell"><span className="guest-avatar neutral">{guest.name.slice(0, 2).toUpperCase()}</span><span><strong>{guest.name}</strong><small>{guest.address}</small></span></div></td>
                <td><strong>{guest.mobile}</strong><small className="booking-cell-sub">{guest.email}</small></td>
                <td>{guest.identityProof}</td>
                <td>{guest.bookingCount} booking{guest.bookingCount === 1 ? '' : 's'}{guest.lastBookingAt && <small className="booking-cell-sub">Last stay recorded</small>}</td>
              </tr>)}
              {!filtered.length && <tr><td colSpan={4}><div className="booking-empty">{loading ? 'Loading guests…' : guests.length ? 'No guests match your search.' : `No guest records yet for ${hostel.name}. Create a booking to add a guest.`}</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

type PaymentRecord = { id: string; bookingId: string; amountCents: number; method: string; receivedOn: string; note: string; guestName: string; reference: string }

function PaymentsScreen({ hostel }: { hostel: HostelEntry }) {
  const [bookings, setBookings] = useState<BookingRecord[]>([])
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [amount, setAmount] = useState('')
  const [bookingId, setBookingId] = useState('')
  const [balanceSearch, setBalanceSearch] = useState('')
  const [balanceFilter, setBalanceFilter] = useState('All balances')
  const [method, setMethod] = useState('Cash')
  const [receivedOn, setReceivedOn] = useState(() => dateValue(new Date()))
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadPayments = useCallback(async () => {
    const [bookingResult, paymentResult] = await Promise.all([
      apiRequest<{ bookings: BookingRecord[] }>(`/api/hostels/${encodeURIComponent(hostel.id)}/bookings`),
      apiRequest<{ payments: PaymentRecord[]; outstandingCents: number }>(`/api/hostels/${encodeURIComponent(hostel.id)}/payments`),
    ])
    setBookings(bookingResult.bookings)
    setPayments(paymentResult.payments)
  }, [hostel.id])

  useEffect(() => {
    let active = true
    void Promise.all([
      apiRequest<{ bookings: BookingRecord[] }>(`/api/hostels/${encodeURIComponent(hostel.id)}/bookings`),
      apiRequest<{ payments: PaymentRecord[] }>(`/api/hostels/${encodeURIComponent(hostel.id)}/payments`),
    ]).then(([bookingResult, paymentResult]) => {
      if (active) {
        setBookings(bookingResult.bookings)
        setPayments(paymentResult.payments)
      }
    }).catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load payment records.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [hostel.id])

  const openBookings = bookings.filter((booking) => booking.outstandingCents > 0 && booking.status !== 'Cancelled')
  const financialBookings = bookings.filter((booking) => booking.status !== 'Cancelled')
  const filteredBalanceBookings = financialBookings.filter((booking) => {
    const paymentStatus = booking.outstandingCents === 0 ? 'Paid' : booking.paidCents > 0 ? 'Partially paid' : 'Unpaid'
    const matchesStatus = balanceFilter === 'All balances' || paymentStatus === balanceFilter
    const searchText = `${booking.guest.name} ${booking.reference} ${booking.guest.mobile}`.toLowerCase()
    return matchesStatus && searchText.includes(balanceSearch.trim().toLowerCase())
  })
  const paymentTotals = financialBookings.reduce((totals, booking) => ({
    rentCents: totals.rentCents + booking.totalRentCents,
    paidCents: totals.paidCents + booking.paidCents,
    outstandingCents: totals.outstandingCents + booking.outstandingCents,
    paidCount: totals.paidCount + Number(booking.outstandingCents === 0),
    partialCount: totals.partialCount + Number(booking.paidCents > 0 && booking.outstandingCents > 0),
    unpaidCount: totals.unpaidCount + Number(booking.paidCents === 0 && booking.outstandingCents > 0),
  }), { rentCents: 0, paidCents: 0, outstandingCents: 0, paidCount: 0, partialCount: 0, unpaidCount: 0 })
  const selectedBooking = openBookings.find((booking) => booking.id === bookingId)
  const money = (cents: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(cents / 100)
  const savePayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const amountCents = Math.round(Number(amount) * 100)
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || !selectedBooking) return
    setSaving(true)
    setError('')
    try {
      await apiRequest(`/api/hostels/${encodeURIComponent(hostel.id)}/payments`, {
        method: 'POST',
        body: JSON.stringify({ bookingId, amountCents, method, receivedOn, note }),
      })
      setAmount('')
      setNote('')
      await loadPayments()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to record payment.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="bookings-screen">
      <div className="page-heading"><div><p className="eyebrow">HOSTEL FINANCE</p><h1>Payments</h1><p className="heading-subtitle">Record payments received outside the app and follow outstanding rent.</p></div></div>
      <div className="panel staff-create-form">
        <div className="staff-form-heading"><h2>Record a payment</h2><p>Entries are records only; no money is transferred through this app.</p></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <form onSubmit={(event) => { void savePayment(event) }}>
          <div className="staff-form-fields">
            <label className="form-field"><span>Booking and guest <b>*</b></span><select value={bookingId} onChange={(event) => setBookingId(event.target.value)} required><option value="">Select outstanding booking</option>{openBookings.map((booking) => <option key={booking.id} value={booking.id}>{booking.guest.name} · {booking.reference} · due {money(booking.outstandingCents)}</option>)}</select></label>
            <label className="form-field"><span>Amount received (₹) <b>*</b></span><input type="number" inputMode="decimal" min="0.01" step="0.01" max={selectedBooking ? (selectedBooking.outstandingCents / 100).toFixed(2) : undefined} value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
            <label className="form-field"><span>Method <b>*</b></span><select value={method} onChange={(event) => setMethod(event.target.value)}><option>Cash</option><option>UPI</option><option>Bank transfer</option><option>Other</option></select></label>
            <label className="form-field"><span>Received date <b>*</b></span><input type="date" value={receivedOn} onChange={(event) => setReceivedOn(event.target.value)} required /></label>
            <label className="form-field"><span>Note</span><input maxLength={250} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional receipt/reference note" /></label>
          </div>
          {selectedBooking && <p className="form-info">Outstanding balance after booking: {money(selectedBooking.outstandingCents)}</p>}
          <div className="staff-form-actions"><button className="button button-primary" type="submit" disabled={saving || !selectedBooking || !amount || Number(amount) <= 0 || Number(amount) * 100 > (selectedBooking?.outstandingCents ?? 0)}>{saving ? 'Recording…' : 'Record payment'}</button></div>
        </form>
      </div>
      <div className="rooms-summary-grid payment-summary-grid">
        <div className="rooms-summary-card"><span className="room-summary-symbol summary-all"><Icon name="payments" size={18} /></span><span><small>Total rent</small><strong>{money(paymentTotals.rentCents)}</strong></span></div>
        <div className="rooms-summary-card"><span className="room-summary-symbol summary-occupied"><span /></span><span><small>Received</small><strong>{money(paymentTotals.paidCents)}</strong></span></div>
        <div className="rooms-summary-card"><span className="room-summary-symbol summary-vacant"><span /></span><span><small>Outstanding</small><strong>{money(paymentTotals.outstandingCents)}</strong></span></div>
        <div className="rooms-summary-card payment-count-summary"><span className="room-summary-symbol summary-reserved"><span /></span><span><small>Paid · partial · unpaid stays</small><strong>{paymentTotals.paidCount} · {paymentTotals.partialCount} · {paymentTotals.unpaidCount}</strong></span></div>
      </div>
      <div className="panel booking-list-panel">
        <div className="booking-list-heading"><div><h2>Guest payment status</h2><p>All non-cancelled stays, including checked-out history</p></div><span className="booking-total">{filteredBalanceBookings.length} stays</span></div>
        <div className="booking-filters">
          <label className="booking-search"><Icon name="search" size={17} /><input value={balanceSearch} onChange={(event) => setBalanceSearch(event.target.value)} placeholder="Search guest, phone, or booking ID" /></label>
          <label className="visually-hidden" htmlFor="payment-status-filter">Filter by payment status</label>
          <select id="payment-status-filter" className="booking-status-filter" value={balanceFilter} onChange={(event) => setBalanceFilter(event.target.value)}>
            <option>All balances</option><option>Paid</option><option>Partially paid</option><option>Unpaid</option>
          </select>
        </div>
        <div className="booking-table-wrap"><table className="booking-table payment-balance-table">
          <thead><tr><th>GUEST / BOOKING</th><th>STAY</th><th>RENT</th><th>RECEIVED</th><th>OUTSTANDING</th><th>PAYMENT STATUS</th></tr></thead>
          <tbody>{filteredBalanceBookings.map((booking) => {
            const status = booking.outstandingCents === 0 ? 'Paid' : booking.paidCents > 0 ? 'Partially paid' : 'Unpaid'
            return <tr key={booking.id}>
              <td><div className="booking-guest-cell"><span className="guest-avatar neutral">{booking.guest.name.slice(0, 2).toUpperCase()}</span><span><strong>{booking.guest.name}</strong><small>{booking.reference} · {booking.guest.mobile}</small></span></div></td>
              <td><strong className="booking-dates">{booking.arrivalDate}</strong><small className="booking-cell-sub">to {booking.departureDate} · {booking.status}</small></td>
              <td>{money(booking.totalRentCents)}</td>
              <td className="balance-zero">{money(booking.paidCents)}</td>
              <td className={booking.outstandingCents === 0 ? 'balance-zero' : 'balance-due'}>{money(booking.outstandingCents)}</td>
              <td><span className={`payment-status-pill ${status.toLowerCase().replace(' ', '-')}`}>{status}</span></td>
            </tr>
          })}
            {!filteredBalanceBookings.length && <tr><td colSpan={6}><div className="booking-empty">{loading ? 'Loading guest balances…' : financialBookings.length ? 'No stays match this search or payment status.' : `No booking balances recorded for ${hostel.name}.`}</div></td></tr>}
          </tbody>
        </table></div>
        <div className="booking-mobile-list payment-balance-mobile-list">
          {filteredBalanceBookings.map((booking) => {
            const status = booking.outstandingCents === 0 ? 'Paid' : booking.paidCents > 0 ? 'Partially paid' : 'Unpaid'
            return <article className="booking-mobile-card" key={booking.id}>
              <div className="booking-mobile-top">
                <div className="booking-guest-cell"><span className="guest-avatar neutral">{booking.guest.name.slice(0, 2).toUpperCase()}</span><span><strong>{booking.guest.name}</strong><small>{booking.reference}</small></span></div>
                <span className={`payment-status-pill ${status.toLowerCase().replace(' ', '-')}`}>{status}</span>
              </div>
              <div className="booking-mobile-details"><span><Icon name="calendar" size={15} /> {booking.arrivalDate} – {booking.departureDate} · {booking.status}</span><span><Icon name="payments" size={15} /> Rent {money(booking.totalRentCents)} · received {money(booking.paidCents)}</span></div>
              <div className="booking-mobile-balance"><span>Outstanding</span><strong className={booking.outstandingCents === 0 ? 'balance-zero' : 'balance-due'}>{money(booking.outstandingCents)}</strong></div>
            </article>
          })}
          {!filteredBalanceBookings.length && <div className="booking-empty">{loading ? 'Loading guest balances…' : financialBookings.length ? 'No stays match this search or payment status.' : `No booking balances recorded for ${hostel.name}.`}</div>}
        </div>
      </div>
      <div className="panel booking-list-panel">
        <div className="booking-list-heading"><div><h2>Payment history</h2><p>Guests who paid and each receipt recorded for {hostel.name}</p></div><span className="booking-total">{payments.length} receipts</span></div>
        <div className="booking-table-wrap"><table className="booking-table">
          <thead><tr><th>PAID BY / BOOKING</th><th>DATE</th><th>METHOD</th><th>NOTE</th><th>AMOUNT</th></tr></thead>
          <tbody>{payments.map((payment) => <tr key={payment.id}><td><strong>{payment.guestName}</strong><small className="booking-cell-sub">{payment.reference}</small></td><td>{payment.receivedOn}</td><td>{payment.method}</td><td>{payment.note || '—'}</td><td className="balance-zero">{money(payment.amountCents)}</td></tr>)}
            {!payments.length && <tr><td colSpan={5}><div className="booking-empty">{loading ? 'Loading payments…' : 'No payments have been recorded yet.'}</div></td></tr>}
          </tbody>
        </table></div>
        <div className="booking-mobile-list payment-history-mobile-list">
          {payments.map((payment) => <article className="booking-mobile-card" key={payment.id}>
            <div className="booking-mobile-top">
              <div className="booking-guest-cell"><span className="guest-avatar neutral">{payment.guestName.slice(0, 2).toUpperCase()}</span><span><strong>{payment.guestName}</strong><small>{payment.reference}</small></span></div>
              <strong className="balance-zero">{money(payment.amountCents)}</strong>
            </div>
            <div className="booking-mobile-details"><span><Icon name="calendar" size={15} /> Received {payment.receivedOn}</span><span><Icon name="payments" size={15} /> {payment.method}{payment.note ? ` · ${payment.note}` : ''}</span></div>
          </article>)}
          {!payments.length && <div className="booking-empty">{loading ? 'Loading payments…' : 'No payments have been recorded yet.'}</div>}
        </div>
      </div>
    </section>
  )
}

type ReportData = {
  beds: number; occupied: number; vacant: number; reserved: number; bookings: number; checkedOut: number
  rentCents: number; receivedCents: number; outstandingCents: number
  monthlyReceipts: { month: string; receivedCents: number }[]
}

function ReportsScreen({ hostel }: { hostel: HostelEntry }) {
  const [report, setReport] = useState<ReportData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    void apiRequest<{ reports: ReportData }>(`/api/hostels/${encodeURIComponent(hostel.id)}/reports`)
      .then((result) => { if (active) setReport(result.reports) })
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load reports.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [hostel.id])

  const money = (cents: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(cents / 100)
  const exportCsv = () => {
    if (!report) return
    const rows = [
      ['Hostel', hostel.name],
      ['Generated', new Date().toISOString()],
      ['Beds', String(report.beds)],
      ['Occupied', String(report.occupied)],
      ['Vacant', String(report.vacant)],
      ['Reserved', String(report.reserved)],
      ['Bookings', String(report.bookings)],
      ['Checked out', String(report.checkedOut)],
      ['Total rent', (report.rentCents / 100).toFixed(2)],
      ['Received', (report.receivedCents / 100).toFixed(2)],
      ['Outstanding', (report.outstandingCents / 100).toFixed(2)],
      ...report.monthlyReceipts.map((receipt) => [`Receipts ${receipt.month}`, (receipt.receivedCents / 100).toFixed(2)]),
    ]
    const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\r\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    link.download = `${hostel.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-report.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <section className="bookings-screen">
      <div className="page-heading"><div><p className="eyebrow">HOSTEL OPERATIONS</p><h1>Reports</h1><p className="heading-subtitle">Current inventory, booking, and recorded receipt summary for {hostel.name}.</p></div><button className="button button-primary" onClick={exportCsv} disabled={!report}>Export CSV</button></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {loading ? <div className="panel booking-empty">Loading reports…</div> : report && <>
        <div className="metrics-grid">
          <MetricCard title="Total beds" value={String(report.beds)} foot={<span className="metric-note">Current inventory</span>} icon="bed" tone="mint" />
          <MetricCard title="Occupied" value={String(report.occupied)} foot={<span className="metric-note">Checked-in stays</span>} icon="rooms" tone="sky" />
          <MetricCard title="Vacant" value={String(report.vacant)} foot={<span className="metric-note">Available inventory</span>} icon="calendar" tone="lilac" />
          <MetricCard title="Reserved" value={String(report.reserved)} foot={<span className="metric-note">Upcoming stays</span>} icon="bookings" tone="sand" />
        </div>
        <div className="metrics-grid">
          <MetricCard title="Total rent" value={money(report.rentCents)} foot={<span className="metric-note">{report.bookings} active/historical bookings</span>} icon="payments" tone="lilac" />
          <MetricCard title="Received" value={money(report.receivedCents)} foot={<span className="metric-note">Recorded payments</span>} icon="payments" tone="mint" />
          <MetricCard title="Outstanding" value={money(report.outstandingCents)} foot={<span className="metric-note">Unpaid booking balances</span>} icon="clock" tone="sand" />
          <MetricCard title="Checked out" value={String(report.checkedOut)} foot={<span className="metric-note">Booking history</span>} icon="reports" tone="sky" />
        </div>
        <div className="panel booking-list-panel"><div className="booking-list-heading"><div><h2>Monthly receipts</h2><p>Grouped by recorded payment date</p></div></div>
          <div className="booking-table-wrap"><table className="booking-table"><thead><tr><th>MONTH</th><th>RECEIVED</th></tr></thead><tbody>
            {report.monthlyReceipts.map((receipt) => <tr key={receipt.month}><td>{receipt.month}</td><td className="balance-zero">{money(receipt.receivedCents)}</td></tr>)}
            {!report.monthlyReceipts.length && <tr><td colSpan={2}><div className="booking-empty">No payments recorded yet.</div></td></tr>}
          </tbody></table></div>
        </div>
      </>}
    </section>
  )
}

const importFileSpecs = [
  { key: 'hostels', name: 'Hostels', filename: 'hostels.csv', columns: ['hostel_key', 'name', 'address'], detail: 'One row per new hostel. Keep hostel_key stable across every file.' },
  { key: 'floors', name: 'Floors', filename: 'floors.csv', columns: ['hostel_key', 'floor_key', 'name', 'position'], detail: 'Floor position starts at 1. Each hostel needs at least one floor.' },
  { key: 'rooms', name: 'Rooms', filename: 'rooms.csv', columns: ['hostel_key', 'floor_key', 'room_number', 'sharing'], detail: 'Sharing is 1–4 and must match the number of bed rows.' },
  { key: 'beds', name: 'Beds', filename: 'beds.csv', columns: ['hostel_key', 'floor_key', 'room_number', 'bed_label', 'status'], detail: 'Status must be Vacant or Maintenance. Booking occupancy is derived from bookings.' },
  { key: 'guests', name: 'Guests', filename: 'guests.csv', columns: ['hostel_key', 'guest_key', 'name', 'email', 'mobile', 'address', 'emergency_contact', 'identity_proof'], detail: 'Use one guest_key per guest within a hostel; bookings refer to it.' },
  { key: 'bookings', name: 'Bookings', filename: 'bookings.csv', columns: ['hostel_key', 'booking_reference', 'guest_key', 'floor_key', 'room_number', 'bed_label', 'arrival_date', 'departure_date', 'status', 'total_rent'], detail: 'Dates use YYYY-MM-DD. Rent is a decimal amount (e.g. 12500.00), without a currency symbol.' },
  { key: 'payments', name: 'Payment history', filename: 'payments.csv', columns: ['payment_key', 'hostel_key', 'booking_reference', 'amount', 'method', 'received_on', 'note'], detail: 'Use a unique payment_key to prevent duplicates. Methods: Cash, UPI, Bank transfer, or Other.' },
] as const

type ImportFileKey = typeof importFileSpecs[number]['key']
type ImportPayload = Record<ImportFileKey, Record<string, string>[]>
type ImportCounts = Partial<Record<ImportFileKey, number>>
type ImportReply = { valid?: boolean; imported?: boolean; unchanged?: boolean; counts?: ImportCounts; issues?: string[]; error?: string }

function DataImportScreen({ onImported }: { onImported: () => void }) {
  const [files, setFiles] = useState<Partial<Record<ImportFileKey, File>>>({})
  const [rows, setRows] = useState<ImportPayload | null>(null)
  const [counts, setCounts] = useState<ImportCounts | null>(null)
  const [issues, setIssues] = useState<string[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [complete, setComplete] = useState(false)
  const [unchanged, setUnchanged] = useState(false)

  const readFiles = async () => {
    const payload: ImportPayload = { hostels: [], floors: [], rooms: [], beds: [], guests: [], bookings: [], payments: [] }
    for (const spec of importFileSpecs) {
      const file = files[spec.key]
      if (!file) continue
      payload[spec.key] = await parseCsvRecords(await file.text(), spec.columns)
    }
    return payload
  }

  const validate = async () => {
    setBusy(true)
    setError('')
    setIssues([])
    setCounts(null)
    setRows(null)
    setComplete(false)
    setUnchanged(false)
    try {
      const payload = await readFiles()
      const response = await fetch('/api/import/validate', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await response.json() as ImportReply
      if (!response.ok) throw Object.assign(new Error(result.error ?? 'Unable to validate these CSV files.'), { issues: result.issues ?? [] })
      setRows(payload)
      setCounts(result.counts ?? {})
    } catch (validationError) {
      const detail = validationError as Error & { issues?: string[] }
      setError(detail.message || 'Unable to validate these CSV files.')
      setIssues(detail.issues ?? [])
    } finally {
      setBusy(false)
    }
  }

  const commit = async () => {
    if (!rows) return
    setBusy(true)
    setError('')
    setIssues([])
    try {
      const response = await fetch('/api/import/commit', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rows),
      })
      const result = await response.json() as ImportReply
      if (!response.ok) throw Object.assign(new Error(result.error ?? 'Unable to import these records.'), { issues: result.issues ?? [] })
      setCounts(result.counts ?? counts)
      setUnchanged(result.unchanged ?? false)
      setRows(null)
      setFiles({})
      setComplete(true)
      onImported()
    } catch (importError) {
      const detail = importError as Error & { issues?: string[] }
      setError(detail.message || 'Unable to import these records.')
      setIssues(detail.issues ?? [])
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="bookings-screen import-screen">
      <div className="page-heading"><div><p className="eyebrow">INITIAL DATA LOAD</p><h1>Import hostel data</h1><p className="heading-subtitle">Download the templates, fill them, then validate every file before importing.</p></div></div>
      <div className="settings-notice"><span>!</span><p>Import is admin-only and append-only. Conflicts reject the entire import; existing records are never replaced. Upload all linked files together. Do not upload identity documents, card numbers, or bank credentials.</p></div>
      <div className="panel import-instructions">
        <h2>Before you upload</h2>
        <ul>
          <li>Replace the sample row in each template; keep the exact column headers. Leave a file with only its header if you have no rows of that type.</li>
          <li>Keep each hostel_key, floor_key, and guest_key consistent across all files. Existing hostel/inventory/guest/booking rows can be reused only when their values match exactly; conflicting values reject the import.</li>
          <li>Import relationships together: hostels → floors → rooms → beds → guests → bookings → payments. Each room needs exactly its sharing count in bed rows.</li>
          <li>Save files as UTF-8 CSV. Dates use YYYY-MM-DD; amounts use plain decimal numbers such as 12500.00. Keep mobile numbers formatted as text in spreadsheet software.</li>
          <li>Bookings must refer to a guest_key and a bed in the same hostel. Payment totals cannot exceed the booking rent. Use a unique payment_key for each receipt, and keep your source files securely.</li>
        </ul>
      </div>
      <div className="panel import-template-panel">
        <div className="panel-heading"><div><h2>CSV templates</h2><p>Example rows are linked across the files. Replace sample data before upload.</p></div></div>
        <div className="import-template-grid">
          {importFileSpecs.map((spec) => (
            <article className="import-template-card" key={spec.key}>
              <div><strong>{spec.name}</strong><span>{spec.filename}</span></div>
              <p>{spec.detail}</p>
              <a className="button button-secondary" href={`/import-templates/${spec.filename}`} download>Download template</a>
            </article>
          ))}
        </div>
      </div>
      <div className="panel import-upload-panel">
        <div className="panel-heading"><div><h2>Select completed files</h2><p>You can upload only the categories you have data for.</p></div></div>
        <div className="import-file-grid">
          {importFileSpecs.map((spec) => (
            <label className="form-field import-file-field" key={spec.key}>
              <span>{spec.name}</span>
              <input type="file" accept=".csv,text/csv" onChange={(event) => {
                const file = event.target.files?.[0]
                setFiles((current) => {
                  const next = { ...current }
                  if (file) next[spec.key] = file
                  else delete next[spec.key]
                  return next
                })
                setRows(null)
                setCounts(null)
                setIssues([])
                setError('')
                setComplete(false)
                setUnchanged(false)
              }} />
              <small>{files[spec.key]?.name ?? 'No file selected'}</small>
            </label>
          ))}
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {issues.length > 0 && <div className="import-issues" role="alert"><strong>Fix these issues, then validate again:</strong><ul>{issues.map((issue, index) => <li key={`${index}-${issue}`}>{issue}</li>)}</ul></div>}
        {complete && <p className="settings-notice" role="status"><span>✓</span><span>{unchanged ? 'No new rows were added; matching existing records were reused.' : 'Import complete. The workspace has been refreshed.'}</span></p>}
        {counts && <div className="import-validation-result" role="status">
          <strong>{rows ? 'Validation passed — nothing has been imported yet.' : 'Rows processed'}</strong>
          <p>{importFileSpecs.map((spec) => `${spec.name}: ${counts[spec.key] ?? 0}`).join(' · ')}</p>
        </div>}
        <div className="staff-form-actions">
          <button className="button button-secondary" type="button" onClick={() => { void validate() }} disabled={busy}>{busy ? 'Validating…' : 'Validate files'}</button>
          {rows && <button className="button button-primary" type="button" onClick={() => { void commit() }} disabled={busy}>{busy ? 'Importing…' : 'Import validated data'}</button>}
        </div>
      </div>
    </section>
  )
}

function AddHostelModal({ onClose, onSave, existingNames }: { onClose: () => void; onSave: (name: string, address: string, roomCounts: number[]) => Promise<void>; existingNames: string[] }) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [floorCount, setFloorCount] = useState('1')
  const [roomCounts, setRoomCounts] = useState(['3'])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (existingNames.some((existing) => existing.toLowerCase() === name.trim().toLowerCase())) {
      setError('A hostel with this name already exists.')
      return
    }
    setSaving(true)
    try {
      await onSave(name, address, roomCounts.slice(0, Number(floorCount)).map(Number))
      onClose()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to create this hostel.')
    } finally {
      setSaving(false)
    }
  }

  const updateFloorCount = (value: string) => {
    const count = Number(value)
    setFloorCount(value)
    if (count > roomCounts.length) {
      setRoomCounts((current) => [...current, ...Array.from({ length: count - current.length }, () => '3')])
    } else if (count >= 1) {
      setRoomCounts((current) => current.slice(0, count))
    }
  }

  const floorName = (index: number) => {
    if (index === 0) return 'Ground floor'
    const suffix = index === 1 ? 'st' : index === 2 ? 'nd' : index === 3 ? 'rd' : 'th'
    return `${index}${suffix} floor`
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="entry-modal" role="dialog" aria-modal="true" aria-labelledby="add-hostel-title">
        <header className="entry-modal-header"><div><p className="eyebrow">WORKSPACE SETUP</p><h2 id="add-hostel-title">Add hostel</h2></div><button className="modal-close" aria-label="Close" onClick={onClose}><Icon name="close" size={19} /></button></header>
        <p className="entry-modal-intro">Set up floors and room counts. Each room is created with a default 4-sharing layout, which you can edit afterward.</p>
        <form onSubmit={submit}>
          <label className="form-field"><span>Hostel name <b>*</b></span><input autoFocus value={name} onChange={(event) => { setName(event.target.value); setError('') }} placeholder="e.g. Maple Residency" required maxLength={80} /></label>
          <label className="form-field"><span>Address</span><textarea value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Street, city, state" rows={2} maxLength={200} /></label>
          <label className="form-field"><span>Number of floors <b>*</b></span><input type="number" min="1" max="20" value={floorCount} onChange={(event) => updateFloorCount(event.target.value)} required /></label>
          <div className="floor-room-counts">
            {roomCounts.slice(0, Number(floorCount)).map((count, index) => (
              <label className="form-field" key={index}><span>{floorName(index)} · rooms <b>*</b></span><input type="number" min="1" max="99" value={count} onChange={(event) => setRoomCounts((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} required /></label>
            ))}
          </div>
          <div className="form-info"><Icon name="rooms" size={17} /><span>Rooms get default numbers by floor (101, 102; 201, 202) and start as 4-sharing with beds A–D. Room number and sharing can be changed later.</span></div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="entry-modal-actions"><button type="button" className="button button-secondary" onClick={onClose} disabled={saving}>Cancel</button><button className="button button-primary" type="submit" disabled={saving}><Icon name="plus" size={16} /> {saving ? 'Creating…' : 'Create hostel'}</button></div>
        </form>
      </section>
    </div>
  )
}

function AddRoomModal({
  floors,
  existingRooms,
  onClose,
  onSave,
}: {
  floors: string[]
  existingRooms: { floor: string; room: RoomRecord }[]
  onClose: () => void
  onSave: (floor: string, room: RoomRecord) => Promise<void>
}) {
  const [floor, setFloor] = useState(floors[0] ?? '')
  const [number, setNumber] = useState('')
  const [sharing, setSharing] = useState('4')
  const [error, setError] = useState('')

  const [saving, setSaving] = useState(false)
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const sharingCount = Number(sharing)
    if (!number.trim()) {
      setError('Enter a room number.')
      return
    }
    if (existingRooms.some((entry) => entry.floor === floor && entry.room.number.toLowerCase() === number.trim().toLowerCase())) {
      setError('A room with this number already exists on this floor.')
      return
    }
    setSaving(true)
    try {
      await onSave(floor, createVacantRoom(number.trim(), sharingCount))
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to create this room.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="entry-modal" role="dialog" aria-modal="true" aria-labelledby="add-room-title">
        <header className="entry-modal-header"><div><p className="eyebrow">ROOM INVENTORY</p><h2 id="add-room-title">Add room</h2></div><button className="modal-close" aria-label="Close" onClick={onClose}><Icon name="close" size={19} /></button></header>
        <p className="entry-modal-intro">Choose a floor, enter a room number, and select its sharing capacity.</p>
        <form onSubmit={submit}>
          <label className="form-field"><span>Floor <b>*</b></span><select value={floor} onChange={(event) => setFloor(event.target.value)} required>{floors.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="form-field"><span>Room number / name <b>*</b></span><input autoFocus value={number} onChange={(event) => { setNumber(event.target.value); setError('') }} placeholder="e.g. 101" required maxLength={30} /></label>
          <label className="form-field"><span>Sharing option <b>*</b></span><select value={sharing} onChange={(event) => setSharing(event.target.value)}><option value="1">1 sharing</option><option value="2">2 sharing</option><option value="3">3 sharing</option><option value="4">4 sharing</option></select></label>
          <div className="bed-label-preview"><span>Beds created for this room</span><strong>{Array.from({ length: Number(sharing) }, (_, index) => `${number.trim() || 'room'}-${String.fromCharCode(97 + index)}`).join(', ')}</strong></div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-info"><Icon name="bed" size={17} /><span>One bed is created for each sharing place. Bed labels follow room-number-a, room-number-b, and so on.</span></div>
          <div className="entry-modal-actions"><button type="button" className="button button-secondary" onClick={onClose} disabled={saving}>Cancel</button><button className="button button-primary" type="submit" disabled={saving}><Icon name="plus" size={16} /> {saving ? 'Creating…' : 'Create room'}</button></div>
        </form>
      </section>
    </div>
  )
}

function EditRoomModal({
  floor,
  room,
  existingRooms,
  onClose,
  onSave,
}: {
  floor: string
  room: RoomRecord
  existingRooms: { floor: string; room: RoomRecord }[]
  onClose: () => void
  onSave: (floor: string, room: RoomRecord) => Promise<void>
}) {
  const [number, setNumber] = useState(room.number)
  const [sharing, setSharing] = useState(String(room.sharing))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextSharing = Number(sharing)
    if (!number.trim()) {
      setError('Enter a room number.')
      return
    }
    if (existingRooms.some((entry) => entry.floor === floor && entry.room.id !== room.id && entry.room.number.toLowerCase() === number.trim().toLowerCase())) {
      setError('A room with this number already exists on this floor.')
      return
    }
    if (room.beds.slice(nextSharing).some((bed) => bed.status !== 'Vacant')) {
      setError('This room has assigned beds beyond the new sharing capacity. Clear those assignments before reducing sharing.')
      return
    }

    const beds = Array.from({ length: nextSharing }, (_, index) => room.beds[index] ?? { label: bedLabel({ number: number.trim(), sharing: nextSharing, beds: [] }, index), status: 'Vacant' as const })
    setSaving(true)
    try {
      await onSave(floor, { ...room, number: number.trim(), sharing: nextSharing, beds })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update this room.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="entry-modal" role="dialog" aria-modal="true" aria-labelledby="edit-room-title">
        <header className="entry-modal-header"><div><p className="eyebrow">ROOM INVENTORY</p><h2 id="edit-room-title">Edit room</h2></div><button className="modal-close" aria-label="Close" onClick={onClose}><Icon name="close" size={19} /></button></header>
        <p className="entry-modal-intro">Change the room number or sharing capacity. Bed labels update with the room number.</p>
        <form onSubmit={submit}>
          <label className="form-field"><span>Floor</span><input value={floor} disabled /></label>
          <label className="form-field"><span>Room number <b>*</b></span><input autoFocus value={number} onChange={(event) => { setNumber(event.target.value); setError('') }} required maxLength={30} /></label>
          <label className="form-field"><span>Sharing option <b>*</b></span><select value={sharing} onChange={(event) => { setSharing(event.target.value); setError('') }}><option value="1">1 sharing</option><option value="2">2 sharing</option><option value="3">3 sharing</option><option value="4">4 sharing</option></select></label>
          <div className="bed-label-preview"><span>Beds in this room</span><strong>{Array.from({ length: Number(sharing) }, (_, index) => `${number.trim() || 'room'}-${String.fromCharCode(97 + index)}`).join(', ')}</strong></div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="entry-modal-actions"><button type="button" className="button button-secondary" onClick={onClose} disabled={saving}>Cancel</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save room'}</button></div>
        </form>
      </section>
    </div>
  )
}

export default App
