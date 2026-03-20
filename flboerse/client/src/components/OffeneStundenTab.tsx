import { useEffect, useState } from 'react'
import { fetchOffeneStunden, addAnmeldung, fetchMeineAnmeldungen, fetchLehrer, assignLehrerToUnterricht } from '../api'
import type { OffeneStunde, MeineAnmeldung, Lehrer } from '../types'
import { isAdmin } from '../auth'

function typBadgeClass(typ: string) {
  if (typ === 'HH') return 'bg-purple-100 text-purple-800'
  if (typ === 'AHR') return 'bg-green-100 text-green-800'
  return 'bg-blue-100 text-blue-800'
}

export default function OffeneStundenTab() {
  const [stunden, setStunden] = useState<OffeneStunde[]>([])
  const [meineAnmeldungen, setMeineAnmeldungen] = useState<MeineAnmeldung[]>([])
  const [lehrerListe, setLehrerListe] = useState<Lehrer[]>([])
  const [loading, setLoading] = useState(true)
  const [enrolling, setEnrolling] = useState<number | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [filterTyp, setFilterTyp] = useState<string>('Alle')
  const [suchFach, setSuchFach] = useState<string>('')
  const [assigningId, setAssigningId] = useState<number | null>(null)
  const [selectedLehrer, setSelectedLehrer] = useState<Record<number, string>>({})
  const admin = isAdmin()

  async function loadData() {
    const promises: Promise<any>[] = [fetchOffeneStunden(), fetchMeineAnmeldungen()]
    if (admin) promises.push(fetchLehrer())
    const results = await Promise.all(promises)
    setStunden(results[0])
    setMeineAnmeldungen(results[1])
    if (admin) setLehrerListe(results[2].filter((l: Lehrer) => l.kuerzel !== 'ADMIN'))
  }

  useEffect(() => {
    loadData().finally(() => setLoading(false))
  }, [])

  // For kopplung groups: sign up for all unterricht_ids
  async function handleEintragen(item: OffeneStunde) {
    setEnrolling(item.unterricht_id)
    setMessage(null)
    try {
      for (const uid of item.unterricht_ids) {
        await addAnmeldung(uid)
      }
      setMessage({ type: 'success', text: item.kopplung ? 'Für Kopplung eingetragen!' : 'Erfolgreich eingetragen!' })
      await loadData()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setEnrolling(null)
    }
  }

  // For kopplung groups: assign to all unterricht_ids
  async function handleAdminZuweisen(item: OffeneStunde) {
    const lehrer_id = parseInt(selectedLehrer[item.unterricht_id] || '')
    if (!lehrer_id) return
    setAssigningId(item.unterricht_id)
    setMessage(null)
    try {
      for (const uid of item.unterricht_ids) {
        await assignLehrerToUnterricht(uid, lehrer_id)
      }
      setMessage({ type: 'success', text: 'Lehrer zugewiesen!' })
      await loadData()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setAssigningId(null)
    }
  }

  if (loading) return <div className="text-gray-500 p-4">Lade offene Stunden…</div>

  const myUnterrichtIds = new Set(meineAnmeldungen.map(a => a.unterricht_id))
  const typen = ['Alle', ...Array.from(new Set(stunden.map(s => s.typ))).sort()]
  const filteredStunden = stunden
    .filter(s => filterTyp === 'Alle' || s.typ === filterTyp)
    .filter(s => !suchFach.trim() ||
      s.fach.toLowerCase().includes(suchFach.trim().toLowerCase()) ||
      s.bezeichnung.toLowerCase().includes(suchFach.trim().toLowerCase()))

  // Separate kopplungen from normal entries; group normal by class
  const kopplungen = filteredStunden.filter(s => s.kopplung === 1)
  const normale = filteredStunden.filter(s => s.kopplung !== 1)

  const grouped = new Map<string, { typ: string; items: OffeneStunde[] }>()
  for (const s of normale) {
    if (!grouped.has(s.klasse)) grouped.set(s.klasse, { typ: s.typ, items: [] })
    grouped.get(s.klasse)!.items.push(s)
  }

  const totalOffen = filteredStunden.reduce((s, x) => s + (x.jahresstunden ?? 0), 0)

  function renderItem(item: OffeneStunde) {
    const isEnrolled = item.unterricht_ids.some(id => myUnterrichtIds.has(id))
    const isEnrolling = enrolling === item.unterricht_id
    const isAssigning = assigningId === item.unterricht_id
    const isKopp = item.kopplung === 1
    return (
      <div key={item.unterricht_id} className={`text-sm p-2 rounded ${isKopp ? 'bg-violet-50 border border-violet-200' : 'bg-orange-50'}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {isKopp && (
              <span className="px-1.5 py-0.5 bg-violet-200 text-violet-800 rounded text-xs font-bold" title="Kopplung">K</span>
            )}
            <span className="font-medium text-gray-800">{item.fach}</span>
            {item.bezeichnung && (
              <span className="text-gray-500 text-xs">{item.bezeichnung}</span>
            )}
            {item.hinweis && (
              <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">{item.hinweis}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <div className="text-xs text-gray-600 whitespace-nowrap">
              {item.wochenstunden != null && <span>{item.wochenstunden}h/W </span>}
              {item.jahresstunden != null && <span className="font-medium">{item.jahresstunden}h/J</span>}
            </div>
            {!admin && (
              isEnrolled ? (
                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium whitespace-nowrap">✓ Eingetragen</span>
              ) : (
                <button
                  onClick={() => handleEintragen(item)}
                  disabled={isEnrolling}
                  className={`px-2 py-0.5 rounded text-xs font-medium disabled:opacity-50 transition-colors whitespace-nowrap ${
                    isKopp ? 'bg-violet-600 text-white hover:bg-violet-700' : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isEnrolling ? '…' : 'Eintragen'}
                </button>
              )
            )}
          </div>
        </div>
        {item.anmeldungen_count > 0 && (
          <div className="mt-1 flex items-center gap-1">
            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${isKopp ? 'bg-violet-200 text-violet-800' : 'bg-orange-200 text-orange-800'}`}
              title={`Angemeldet: ${item.angemeldete.join(', ')}`}>
              {item.anmeldungen_count} Anmeldung{item.anmeldungen_count > 1 ? 'en' : ''}
            </span>
            <span className="text-xs text-gray-600">{item.angemeldete.join(', ')}</span>
          </div>
        )}
        {admin && (
          <div className="mt-2 flex items-center gap-2">
            <select
              value={selectedLehrer[item.unterricht_id] || ''}
              onChange={e => setSelectedLehrer(prev => ({ ...prev, [item.unterricht_id]: e.target.value }))}
              className="flex-1 text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="">— Lehrer wählen —</option>
              {lehrerListe.map(l => (
                <option key={l.id} value={l.id}>{l.kuerzel} ({l.wert.toFixed(1)}/{l.deputat}h)</option>
              ))}
            </select>
            <button
              onClick={() => handleAdminZuweisen(item)}
              disabled={!selectedLehrer[item.unterricht_id] || isAssigning}
              className="px-2 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 disabled:opacity-40 transition-colors whitespace-nowrap"
            >
              {isAssigning ? '…' : 'Zuweisen'}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${
          message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-2 opacity-60 hover:opacity-100">×</button>
        </div>
      )}

      <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg inline-flex items-center gap-2">
        <span className="text-orange-700 font-medium">Gesamt offen:</span>
        <span className="text-orange-800 font-bold text-lg">{totalOffen.toFixed(1)} h/J</span>
      </div>

      {/* Filter */}
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <div className="flex gap-2 flex-wrap">
          {typen.map((t) => (
            <button key={t} onClick={() => setFilterTyp(t)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filterTyp === t ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
              }`}
            >{t}</button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Fach suchen…"
          value={suchFach}
          onChange={e => setSuchFach(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-44"
        />
        {suchFach && (
          <button onClick={() => setSuchFach('')} className="text-xs text-gray-400 hover:text-gray-600">✕ löschen</button>
        )}
      </div>

      {/* Kopplungen Section */}
      {kopplungen.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-violet-700 uppercase tracking-wide mb-2 flex items-center gap-2">
            <span className="px-1.5 py-0.5 bg-violet-200 text-violet-800 rounded text-xs font-bold">K</span>
            Kopplungen ({kopplungen.length})
          </h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {kopplungen.map(item => (
              <div key={item.unterricht_id} className="bg-white rounded-lg shadow overflow-hidden border-l-4 border-violet-400">
                <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between bg-violet-50">
                  <div className="flex flex-wrap gap-1">
                    {item.klassen.map(k => (
                      <span key={k} className="px-1.5 py-0.5 bg-violet-100 text-violet-800 rounded text-xs font-semibold">{k}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 ml-2 shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typBadgeClass(item.typ)}`}>{item.typ}</span>
                    <span className="text-violet-600 font-bold text-sm">{item.jahresstunden?.toFixed(1)} h/J</span>
                  </div>
                </div>
                <div className="p-3">
                  {renderItem(item)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Normal entries grouped by class */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from(grouped.entries()).map(([klasse, { typ, items }]) => {
          const klasseTotal = items.reduce((s, x) => s + (x.jahresstunden ?? 0), 0)
          return (
            <div key={klasse} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-800">{klasse}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typBadgeClass(typ)}`}>{typ}</span>
                </div>
                <span className="text-orange-600 font-bold text-sm">{klasseTotal.toFixed(1)} h/J</span>
              </div>
              <div className="p-3 space-y-1.5">
                {items.map(item => renderItem(item))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

