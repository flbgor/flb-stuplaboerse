import { useState, useEffect } from 'react'
import KlassenTab from './components/KlassenTab'
import LehrerTab from './components/LehrerTab'
import OffeneStundenTab from './components/OffeneStundenTab'
import MeineStundenTab from './components/MeineStundenTab'
import AuswertungTab from './components/AuswertungTab'
import AdminVerwaltungTab from './components/AdminVerwaltungTab'
import LoginPage from './components/LoginPage'
import { getToken, getUser, clearToken } from './auth'
import { logout } from './api'

type Tab = 'klassen' | 'lehrer' | 'offene' | 'meine' | 'auswertung' | 'verwaltung'

export default function App() {
  const [authed, setAuthed] = useState<boolean>(!!getToken())
  const [tab, setTab] = useState<Tab>('klassen')
  const [welcome, setWelcome] = useState<string | null>(null)
  const user = getUser()
  const admin = user?.is_admin === 1

  useEffect(() => {
    if (!getToken()) setAuthed(false)
  }, [])

  function handleLogin() {
    setAuthed(true)
    setTab('klassen')
    const u = getUser()
    const name = u?.vorname || u?.kuerzel || ''
    setWelcome(name)
    setTimeout(() => setWelcome(null), 6000)
  }

  function handleLogout() {
    logout()
    clearToken()
    setAuthed(false)
    setWelcome(null)
  }

  if (!authed) {
    return <LoginPage onLogin={handleLogin} />
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'klassen', label: 'Klassen' },
    ...(admin ? [{ key: 'lehrer' as Tab, label: 'Lehrer' }] : []),
    { key: 'offene', label: 'Offene Stunden' },
    ...(!admin ? [{ key: 'meine' as Tab, label: 'Meine Stunden' }] : []),
    ...(admin ? [{ key: 'auswertung' as Tab, label: 'Auswertungen' }] : []),
    ...(admin ? [{ key: 'verwaltung' as Tab, label: 'Verwaltung' }] : []),
  ]

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">FLBörse – Stundenplanbörse</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">
              {user?.vorname ? `${user.vorname} ${user.nachname}`.trim() : user?.kuerzel}
              {admin && <span className="ml-1 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">Admin</span>}
            </span>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Abmelden
            </button>
          </div>
        </div>
        <nav className="max-w-7xl mx-auto px-4 flex gap-2 pb-0">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium rounded-t-md border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        {welcome !== null && (
          <div className="mb-6 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl shadow-sm flex items-start justify-between gap-4 animate-fade-in">
            <div>
              <p className="text-blue-800 font-semibold text-lg">
                Herzlich willkommen{welcome ? `, ${welcome}` : ''}! 👋
              </p>
              <p className="text-blue-700 text-sm mt-1">
                Schön, dass du dabei bist. Vielen Dank für deine Mitarbeit bei der Stundenplanung –
                dein Engagement macht den Unterschied!
              </p>
            </div>
            <button onClick={() => setWelcome(null)} className="text-blue-400 hover:text-blue-600 text-xl leading-none mt-0.5" title="Schließen">×</button>
          </div>
        )}
        {tab === 'klassen' && <KlassenTab />}
        {tab === 'lehrer' && admin && <LehrerTab />}
        {tab === 'offene' && <OffeneStundenTab />}
        {tab === 'meine' && !admin && <MeineStundenTab />}
        {tab === 'auswertung' && admin && <AuswertungTab />}
        {tab === 'verwaltung' && admin && <AdminVerwaltungTab />}
      </main>
    </div>
  )
}

