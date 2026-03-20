import { useEffect, useState } from 'react'
import {
  fetchAdminKlassen, createKlasse, updateKlasse, deleteKlasse,
  fetchAdminFaecher, createFach, updateFach, deleteFach,
  fetchKlasseUnterricht, createUnterricht, updateUnterricht, deleteUnterricht,
  fetchAdminLehrer, fetchAdminKopplungen, updateKopplungLehrer,
  createKopplung, deleteKopplung, updateKopplungStunden,
} from '../api'
import type { AdminKlasse, AdminFach, AdminUnterrichtRow, AdminLehrer, AdminKopplung, AdminKopplungRow } from '../types'
import BenutzerverwaltungTab from './BenutzerverwaltungTab'

type SubTab = 'klassen' | 'kopplungen' | 'faecher' | 'benutzer'
const TYP_OPTIONS = ['AHR', 'HH', 'BS', 'BFS', 'BFW', 'FOS', 'sonstige']

// UnterrichtPanel
function UnterrichtPanel({ klasse, faecher, lehrer, onError }: {
  klasse: AdminKlasse; faecher: AdminFach[]; lehrer: AdminLehrer[]; onError: (m: string) => void
}) {
  const [rows, setRows] = useState<AdminUnterrichtRow[]>([])
  const [edits, setEdits] = useState<Record<number, Partial<AdminUnterrichtRow>>>({})
  const [loading, setLoading] = useState(true)
  const [newRow, setNewRow] = useState({ fach_id: '', wochenstunden: '', jahresstunden: '', hinweis: '', lehrer_id: '', kopplung: false })

  useEffect(() => {
    setLoading(true)
    fetchKlasseUnterricht(klasse.id)
      .then(d => { setRows(d); setEdits({}) })
      .catch((e: any) => onError(e.message))
      .finally(() => setLoading(false))
  }, [klasse.id])

  function setEdit(id: number, field: string, value: string | number | null | boolean) {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }

  function getVal<K extends keyof AdminUnterrichtRow>(row: AdminUnterrichtRow, field: K): AdminUnterrichtRow[K] {
    const e = edits[row.id]
    return e && field in e ? (e as any)[field] : row[field]
  }

  async function handleSave(row: AdminUnterrichtRow) {
    const e = edits[row.id]
    if (!e || Object.keys(e).length === 0) return
    try {
      const updated = await updateUnterricht(row.id, e as any)
      setRows(prev => prev.map(r => r.id === row.id ? updated : r))
      setEdits(prev => { const n = { ...prev }; delete n[row.id]; return n })
    } catch (err: any) { onError(err.message) }
  }

  async function handleDelete(id: number) {
    if (!confirm('Unterricht wirklich loeschen?')) return
    try {
      await deleteUnterricht(id)
      setRows(prev => prev.filter(r => r.id !== id))
    } catch (err: any) { onError(err.message) }
  }

  async function handleAdd() {
    if (!newRow.fach_id) { onError('Bitte Fach auswaehlen'); return }
    try {
      const created = await createUnterricht({
        klasse_id: klasse.id,
        fach_id: parseInt(newRow.fach_id),
        wochenstunden: newRow.wochenstunden ? parseFloat(newRow.wochenstunden) : undefined,
        jahresstunden: newRow.jahresstunden ? parseFloat(newRow.jahresstunden) : undefined,
        hinweis: newRow.hinweis || undefined,
        lehrer_id: newRow.lehrer_id ? parseInt(newRow.lehrer_id) : null,
        kopplung: newRow.kopplung ? 1 : 0,
      })
      setRows(prev => [...prev, created])
      setNewRow({ fach_id: '', wochenstunden: '', jahresstunden: '', hinweis: '', lehrer_id: '', kopplung: false })
    } catch (err: any) { onError(err.message) }
  }

  if (loading) return <div className="p-4 text-sm text-gray-500">Laedt...</div>

  const sel = 'border border-gray-300 rounded px-1.5 py-0.5 text-xs w-full focus:outline-none focus:border-blue-400'
  const inp = 'border border-gray-300 rounded px-1.5 py-0.5 text-xs w-full focus:outline-none focus:border-blue-400'

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
        <span className="font-semibold text-sm text-gray-700">{klasse.name}</span>
        <span className="ml-2 text-xs text-gray-500">{klasse.typ} · Jg. {klasse.jahrgangsstufe}</span>
        <span className="ml-2 text-xs text-gray-400">{rows.length} Eintraege</span>
      </div>
      <div className="overflow-auto flex-1">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-2 py-1.5 font-medium text-gray-600">Fach</th>
              <th className="text-left px-2 py-1.5 font-medium text-gray-600 w-20">Wo-Std</th>
              <th className="text-left px-2 py-1.5 font-medium text-gray-600 w-20">Jahr-Std</th>
              <th className="text-left px-2 py-1.5 font-medium text-gray-600">Hinweis</th>
              <th className="text-left px-2 py-1.5 font-medium text-gray-600">Lehrer</th>
              <th className="text-center px-2 py-1.5 font-medium text-gray-600 w-10">Kopp</th>
              <th className="px-2 py-1.5 w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(row => {
              const isDirty = edits[row.id] && Object.keys(edits[row.id]).length > 0
              const isKopp = (getVal(row, 'kopplung') as number) === 1
              return (
                <tr key={row.id} className={`hover:bg-gray-50 ${isDirty ? 'bg-blue-50' : ''}`}>
                  <td className="px-2 py-1">
                    <select className={sel} value={getVal(row, 'fach_id') as number}
                      onChange={e => setEdit(row.id, 'fach_id', parseInt(e.target.value))}>
                      {faecher.map(f => (
                        <option key={f.id} value={f.id}>{f.kuerzel}{f.bezeichnung ? ` \u2013 ${f.bezeichnung}` : ''}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" step="0.5" className={inp}
                      value={getVal(row, 'wochenstunden') ?? ''}
                      onChange={e => setEdit(row.id, 'wochenstunden', e.target.value !== '' ? parseFloat(e.target.value) : null)} />
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" step="0.5" className={inp}
                      value={getVal(row, 'jahresstunden') ?? ''}
                      onChange={e => setEdit(row.id, 'jahresstunden', e.target.value !== '' ? parseFloat(e.target.value) : null)} />
                  </td>
                  <td className="px-2 py-1">
                    <input type="text" className={inp} value={getVal(row, 'hinweis') ?? ''}
                      onChange={e => setEdit(row.id, 'hinweis', e.target.value || null)} />
                  </td>
                  <td className="px-2 py-1">
                    <select className={sel} value={getVal(row, 'lehrer_id') ?? ''}
                      onChange={e => setEdit(row.id, 'lehrer_id', e.target.value ? parseInt(e.target.value) : null)}>
                      <option value="">–</option>
                      {lehrer.map(l => <option key={l.id} value={l.id}>{l.kuerzel}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1 text-center">
                    <input type="checkbox" checked={isKopp}
                      onChange={e => setEdit(row.id, 'kopplung', e.target.checked ? 1 : 0)}
                      className="cursor-pointer" title="Kopplung" />
                  </td>
                  <td className="px-2 py-1">
                    <div className="flex gap-1 justify-end">
                      {isDirty && (
                        <button onClick={() => handleSave(row)}
                          className="px-2 py-0.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">✓</button>
                      )}
                      <button onClick={() => handleDelete(row.id)}
                        className="px-2 py-0.5 bg-red-500 text-white rounded text-xs hover:bg-red-600">×</button>
                    </div>
                  </td>
                </tr>
              )
            })}
            <tr className="bg-green-50 border-t-2 border-green-200">
              <td className="px-2 py-1">
                <select className={sel} value={newRow.fach_id}
                  onChange={e => setNewRow(p => ({ ...p, fach_id: e.target.value }))}>
                  <option value="">Fach waehlen...</option>
                  {faecher.map(f => (
                    <option key={f.id} value={f.id}>{f.kuerzel}{f.bezeichnung ? ` \u2013 ${f.bezeichnung}` : ''}</option>
                  ))}
                </select>
              </td>
              <td className="px-2 py-1">
                <input type="number" step="0.5" placeholder="Wo" className={inp} value={newRow.wochenstunden}
                  onChange={e => setNewRow(p => ({ ...p, wochenstunden: e.target.value }))} />
              </td>
              <td className="px-2 py-1">
                <input type="number" step="0.5" placeholder="Jahr" className={inp} value={newRow.jahresstunden}
                  onChange={e => setNewRow(p => ({ ...p, jahresstunden: e.target.value }))} />
              </td>
              <td className="px-2 py-1">
                <input type="text" placeholder="Hinweis" className={inp} value={newRow.hinweis}
                  onChange={e => setNewRow(p => ({ ...p, hinweis: e.target.value }))} />
              </td>
              <td className="px-2 py-1">
                <select className={sel} value={newRow.lehrer_id}
                  onChange={e => setNewRow(p => ({ ...p, lehrer_id: e.target.value }))}>
                  <option value="">–</option>
                  {lehrer.map(l => <option key={l.id} value={l.id}>{l.kuerzel}</option>)}
                </select>
              </td>
              <td className="px-2 py-1 text-center">
                <input type="checkbox" checked={newRow.kopplung}
                  onChange={e => setNewRow(p => ({ ...p, kopplung: e.target.checked }))}
                  className="cursor-pointer" title="Kopplung" />
              </td>
              <td className="px-2 py-1">
                <button onClick={handleAdd}
                  className="px-2 py-0.5 bg-green-600 text-white rounded text-xs hover:bg-green-700 whitespace-nowrap">+ Add</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// KlassenSubTab
function KlassenSubTab({ faecher, lehrer }: { faecher: AdminFach[]; lehrer: AdminLehrer[] }) {
  const [klassen, setKlassen] = useState<AdminKlasse[]>([])
  const [selected, setSelected] = useState<AdminKlasse | null>(null)
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [newData, setNewData] = useState({ name: '', typ: 'AHR', jahrgangsstufe: '' })
  const [editId, setEditId] = useState<number | null>(null)
  const [editData, setEditData] = useState<Partial<AdminKlasse>>({})
  const [error, setError] = useState('')

  useEffect(() => {
    fetchAdminKlassen()
      .then(d => setKlassen(d))
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate() {
    if (!newData.name) { setError('Name erforderlich'); return }
    try {
      const k = await createKlasse(newData)
      setKlassen(prev => [...prev, k].sort((a, b) => a.typ.localeCompare(b.typ) || a.name.localeCompare(b.name)))
      setShowNew(false); setNewData({ name: '', typ: 'AHR', jahrgangsstufe: '' })
    } catch (e: any) { setError(e.message) }
  }

  async function handleSaveEdit(k: AdminKlasse) {
    try {
      const updated = await updateKlasse(k.id, editData)
      setKlassen(prev => prev.map(x => x.id === k.id ? updated : x).sort((a, b) => a.typ.localeCompare(b.typ) || a.name.localeCompare(b.name)))
      if (selected?.id === k.id) setSelected(updated)
      setEditId(null)
    } catch (e: any) { setError(e.message) }
  }

  async function handleDelete(k: AdminKlasse) {
    if (!confirm(`Klasse "${k.name}" und all ihren Unterricht wirklich loeschen?`)) return
    try {
      await deleteKlasse(k.id)
      setKlassen(prev => prev.filter(x => x.id !== k.id))
      if (selected?.id === k.id) setSelected(null)
    } catch (e: any) { setError(e.message) }
  }

  const grouped = klassen.reduce<Record<string, AdminKlasse[]>>((acc, k) => {
    ;(acc[k.typ] = acc[k.typ] || []).push(k); return acc
  }, {})

  const ic = 'border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400'
  if (loading) return <div className="p-4 text-sm text-gray-500">Laedt...</div>

  return (
    <div className="flex gap-4 h-full">
      <div className="w-2/5 bg-white rounded-lg shadow border border-gray-200 flex flex-col overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <span className="font-semibold text-sm text-gray-700">Klassen</span>
          <button onClick={() => setShowNew(p => !p)}
            className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">+ Neue Klasse</button>
        </div>
        {error && (
          <div className="mx-3 mt-2 p-2 bg-red-50 border border-red-200 text-red-700 rounded text-xs flex justify-between">
            {error}<button onClick={() => setError('')} className="ml-2 font-bold">×</button>
          </div>
        )}
        {showNew && (
          <div className="px-3 py-2 border-b border-blue-100 bg-blue-50 flex flex-col gap-1.5">
            <input className={ic + ' w-full'} placeholder="Name" value={newData.name}
              onChange={e => setNewData(p => ({ ...p, name: e.target.value }))} />
            <div className="flex gap-2">
              <select className={ic + ' flex-1'} value={newData.typ}
                onChange={e => setNewData(p => ({ ...p, typ: e.target.value }))}>
                {TYP_OPTIONS.map(t => <option key={t}>{t}</option>)}
              </select>
              <input className={ic + ' w-20'} placeholder="Jg." value={newData.jahrgangsstufe}
                onChange={e => setNewData(p => ({ ...p, jahrgangsstufe: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreate} className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 flex-1">Erstellen</button>
              <button onClick={() => setShowNew(false)} className="px-3 py-1 border border-gray-300 rounded text-xs hover:bg-gray-50 flex-1">Abbrechen</button>
            </div>
          </div>
        )}
        <div className="overflow-auto flex-1">
          {Object.keys(grouped).sort().map(typ => (
            <div key={typ}>
              <div className="px-3 py-1 bg-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide sticky top-0">{typ}</div>
              {grouped[typ].map(k => (
                <div key={k.id}>
                  {editId === k.id ? (
                    <div className="px-3 py-1.5 border-b border-gray-100 bg-yellow-50 flex flex-col gap-1">
                      <input className={ic + ' w-full'} value={editData.name ?? k.name}
                        onChange={e => setEditData(p => ({ ...p, name: e.target.value }))} />
                      <div className="flex gap-2">
                        <select className={ic + ' flex-1'} value={editData.typ ?? k.typ}
                          onChange={e => setEditData(p => ({ ...p, typ: e.target.value }))}>
                          {TYP_OPTIONS.map(t => <option key={t}>{t}</option>)}
                        </select>
                        <input className={ic + ' w-20'} placeholder="Jg." value={editData.jahrgangsstufe ?? k.jahrgangsstufe}
                          onChange={e => setEditData(p => ({ ...p, jahrgangsstufe: e.target.value }))} />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleSaveEdit(k)} className="px-2 py-0.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 flex-1">Speichern</button>
                        <button onClick={() => setEditId(null)} className="px-2 py-0.5 border border-gray-300 rounded text-xs hover:bg-gray-50 flex-1">Abbrechen</button>
                      </div>
                    </div>
                  ) : (
                    <div onClick={() => setSelected(k)}
                      className={`px-3 py-1.5 border-b border-gray-100 flex items-center justify-between cursor-pointer hover:bg-gray-50 ${selected?.id === k.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''}`}>
                      <div>
                        <span className="text-sm font-medium text-gray-800">{k.name}</span>
                        {k.jahrgangsstufe && <span className="ml-1 text-xs text-gray-500">Jg. {k.jahrgangsstufe}</span>}
                      </div>
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={e => { e.stopPropagation(); setEditId(k.id); setEditData({}) }}
                          className="px-2 py-0.5 text-xs border border-gray-300 rounded hover:bg-gray-100">✎</button>
                        <button onClick={e => { e.stopPropagation(); handleDelete(k) }}
                          className="px-2 py-0.5 text-xs border border-red-300 text-red-600 rounded hover:bg-red-50">×</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
          {klassen.length === 0 && <div className="p-4 text-sm text-gray-400 text-center">Keine Klassen vorhanden</div>}
        </div>
      </div>
      <div className="flex-1 bg-white rounded-lg shadow border border-gray-200 flex flex-col overflow-hidden">
        {selected
          ? <UnterrichtPanel klasse={selected} faecher={faecher} lehrer={lehrer} onError={setError} />
          : <div className="flex-1 flex items-center justify-center text-sm text-gray-400">Klasse auswaehlen, um Unterricht zu bearbeiten</div>
        }
      </div>
    </div>
  )
}

// KopplungenSubTab
function groupKopplungen(rows: AdminKopplungRow[]): AdminKopplung[] {
  const map = new Map<string, AdminKopplung>()
  for (const r of rows) {
    const key = `${r.fach_id}-${r.typ}-${r.jahrgangsstufe}`
    if (!map.has(key)) {
      map.set(key, {
        key, fach_id: r.fach_id, fach: r.fach, bezeichnung: r.bezeichnung,
        typ: r.typ, jahrgangsstufe: r.jahrgangsstufe,
        klassen: [], wochenstunden: r.wochenstunden, jahresstunden: r.jahresstunden,
        lehrer_id: r.lehrer_id, lehrer_kuerzel: r.lehrer_kuerzel, unterricht_ids: [],
      })
    }
    const g = map.get(key)!
    g.klassen.push(r.klasse)
    g.unterricht_ids.push(r.id)
  }
  return [...map.values()]
}

function KopplungenSubTab({ lehrer, faecher, klassen }: { lehrer: AdminLehrer[]; faecher: AdminFach[]; klassen: AdminKlasse[] }) {
  const [rows, setRows] = useState<AdminKopplungRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editKey, setEditKey] = useState<string | null>(null)
  const [editState, setEditState] = useState<{ wo: string; jahr: string; lehrer_id: string; klassen_ids: Set<number> }>({ wo: '', jahr: '', lehrer_id: '', klassen_ids: new Set() })
  const [showNew, setShowNew] = useState(false)
  const [newState, setNewState] = useState<{ fach_id: string; typ: string; jahrgangsstufe: string; wo: string; jahr: string; lehrer_id: string; klassen_ids: Set<number> }>({ fach_id: '', typ: 'AHR', jahrgangsstufe: '', wo: '', jahr: '', lehrer_id: '', klassen_ids: new Set() })

  function reload() {
    return fetchAdminKopplungen().then(setRows).catch((e: any) => setError(e.message))
  }

  useEffect(() => { reload().finally(() => setLoading(false)) }, [])

  const groups = groupKopplungen(rows)
  const byTyp = groups.reduce<Record<string, AdminKopplung[]>>((acc, g) => {
    const k = `${g.typ} · Jg. ${g.jahrgangsstufe}`
    ;(acc[k] = acc[k] || []).push(g); return acc
  }, {})

  function startEdit(g: AdminKopplung) {
    const klassenInGroup = rows
      .filter(r => r.fach_id === g.fach_id && r.typ === g.typ && r.jahrgangsstufe === g.jahrgangsstufe)
      .map(r => r.klasse_id)
    setEditKey(g.key)
    setEditState({ wo: g.wochenstunden?.toString() ?? '', jahr: g.jahresstunden?.toString() ?? '', lehrer_id: g.lehrer_id?.toString() ?? '', klassen_ids: new Set(klassenInGroup) })
  }

  async function handleSaveEdit(g: AdminKopplung) {
    try {
      const wo = editState.wo ? parseFloat(editState.wo) : null
      const jahr = editState.jahr ? parseFloat(editState.jahr) : null
      const lehrer_id = editState.lehrer_id ? parseInt(editState.lehrer_id) : null
      const klassenInGroup = rows
        .filter(r => r.fach_id === g.fach_id && r.typ === g.typ && r.jahrgangsstufe === g.jahrgangsstufe)
        .map(r => r.klasse_id)
      // klassen to add
      const toAdd = [...editState.klassen_ids].filter(id => !klassenInGroup.includes(id))
      // klassen to remove
      const toRemove = rows.filter(r => r.fach_id === g.fach_id && r.typ === g.typ && r.jahrgangsstufe === g.jahrgangsstufe && !editState.klassen_ids.has(r.klasse_id)).map(r => r.id)
      if (toAdd.length > 0) await createKopplung({ fach_id: g.fach_id, klassen_ids: toAdd, wochenstunden: wo, jahresstunden: jahr, lehrer_id })
      for (const uid of toRemove) await deleteUnterricht(uid)
      await updateKopplungStunden(g.fach_id, g.typ, g.jahrgangsstufe, wo, jahr)
      await updateKopplungLehrer(g.fach_id, g.typ, g.jahrgangsstufe, lehrer_id)
      await reload()
      setEditKey(null)
    } catch (e: any) { setError(e.message) }
  }

  async function handleDelete(g: AdminKopplung) {
    if (!confirm(`Kopplung ${g.fach} (${g.typ} Jg.${g.jahrgangsstufe}) wirklich löschen?`)) return
    try {
      await deleteKopplung(g.fach_id, g.typ, g.jahrgangsstufe)
      await reload()
    } catch (e: any) { setError(e.message) }
  }

  // Klassen available for new kopplung (filter by selected typ+jahrgangsstufe)
  const availableKlassenForNew = klassen.filter(k => k.typ === newState.typ && k.jahrgangsstufe === newState.jahrgangsstufe)
  const uniqueJahrgaenge = [...new Set(klassen.filter(k => k.typ === newState.typ).map(k => k.jahrgangsstufe))].sort()

  async function handleCreate() {
    if (!newState.fach_id || newState.klassen_ids.size === 0) { setError('Fach und mindestens eine Klasse erforderlich'); return }
    try {
      await createKopplung({
        fach_id: parseInt(newState.fach_id),
        klassen_ids: [...newState.klassen_ids],
        wochenstunden: newState.wo ? parseFloat(newState.wo) : null,
        jahresstunden: newState.jahr ? parseFloat(newState.jahr) : null,
        lehrer_id: newState.lehrer_id ? parseInt(newState.lehrer_id) : null,
      })
      await reload()
      setShowNew(false)
      setNewState({ fach_id: '', typ: 'AHR', jahrgangsstufe: '', wo: '', jahr: '', lehrer_id: '', klassen_ids: new Set() })
    } catch (e: any) { setError(e.message) }
  }

  if (loading) return <div className="p-4 text-sm text-gray-500">Lädt…</div>

  const sel = 'border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400'
  const inp = 'border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400'

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm flex justify-between">
          {error}<button onClick={() => setError('')} className="ml-2 font-bold">×</button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          Kopplungen gelten für mehrere Klassen desselben Bereichs/Jahrgangs mit einem gemeinsamen Lehrer.
        </div>
        <button onClick={() => setShowNew(p => !p)}
          className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 whitespace-nowrap">
          + Neue Kopplung
        </button>
      </div>

      {showNew && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <div className="font-semibold text-sm text-blue-800">Neue Kopplung anlegen</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600 block mb-1">Fach</label>
              <select className={sel + ' w-full'} value={newState.fach_id}
                onChange={e => setNewState(p => ({ ...p, fach_id: e.target.value }))}>
                <option value="">Fach wählen…</option>
                {faecher.map(f => <option key={f.id} value={f.id}>{f.kuerzel}{f.bezeichnung ? ` – ${f.bezeichnung}` : ''}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-gray-600 block mb-1">Bereich</label>
                <select className={sel + ' w-full'} value={newState.typ}
                  onChange={e => setNewState(p => ({ ...p, typ: e.target.value, jahrgangsstufe: '', klassen_ids: new Set() }))}>
                  {TYP_OPTIONS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="w-24">
                <label className="text-xs text-gray-600 block mb-1">Jahrgang</label>
                <select className={sel + ' w-full'} value={newState.jahrgangsstufe}
                  onChange={e => setNewState(p => ({ ...p, jahrgangsstufe: e.target.value, klassen_ids: new Set() }))}>
                  <option value="">–</option>
                  {uniqueJahrgaenge.map(j => <option key={j}>{j}</option>)}
                </select>
              </div>
            </div>
          </div>
          {newState.jahrgangsstufe && availableKlassenForNew.length > 0 && (
            <div>
              <label className="text-xs text-gray-600 block mb-1">Klassen auswählen</label>
              <div className="flex flex-wrap gap-2">
                {availableKlassenForNew.map(k => (
                  <label key={k.id} className={`flex items-center gap-1.5 px-2 py-1 rounded border cursor-pointer text-xs transition-colors ${newState.klassen_ids.has(k.id) ? 'bg-purple-100 border-purple-400 text-purple-800' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                    <input type="checkbox" className="hidden" checked={newState.klassen_ids.has(k.id)}
                      onChange={e => setNewState(p => {
                        const s = new Set(p.klassen_ids)
                        e.target.checked ? s.add(k.id) : s.delete(k.id)
                        return { ...p, klassen_ids: s }
                      })} />
                    {k.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-600 block mb-1">Wo-Std</label>
              <input type="number" step="0.5" className={inp + ' w-full'} value={newState.wo}
                onChange={e => setNewState(p => ({ ...p, wo: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">Jahr-Std</label>
              <input type="number" step="0.5" className={inp + ' w-full'} value={newState.jahr}
                onChange={e => setNewState(p => ({ ...p, jahr: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">Lehrer</label>
              <select className={sel + ' w-full'} value={newState.lehrer_id}
                onChange={e => setNewState(p => ({ ...p, lehrer_id: e.target.value }))}>
                <option value="">– offen –</option>
                {lehrer.map(l => <option key={l.id} value={l.id}>{l.kuerzel}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Erstellen</button>
            <button onClick={() => setShowNew(false)} className="px-4 py-1.5 border border-gray-300 rounded text-sm hover:bg-gray-50">Abbrechen</button>
          </div>
        </div>
      )}

      {Object.keys(byTyp).sort().map(typLabel => (
        <div key={typLabel} className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 font-semibold text-sm text-gray-700">{typLabel}</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-4 py-2 font-medium">Fach</th>
                <th className="text-left px-4 py-2 font-medium">Klassen</th>
                <th className="text-right px-4 py-2 font-medium w-16">Wo</th>
                <th className="text-right px-4 py-2 font-medium w-16">Jahr</th>
                <th className="text-left px-4 py-2 font-medium w-36">Lehrer</th>
                <th className="px-4 py-2 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {byTyp[typLabel].map(g => {
                const isEditing = editKey === g.key
                const availKlassen = klassen.filter(k => k.typ === g.typ && k.jahrgangsstufe === g.jahrgangsstufe)
                return (
                  <tr key={g.key} className={isEditing ? 'bg-yellow-50' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-2 font-semibold text-gray-700 align-top">
                      {g.fach}
                      {g.bezeichnung && <div className="text-xs font-normal text-gray-400">{g.bezeichnung}</div>}
                    </td>
                    <td className="px-4 py-2 align-top">
                      {isEditing ? (
                        <div className="flex flex-wrap gap-1.5">
                          {availKlassen.map(k => (
                            <label key={k.id} className={`flex items-center gap-1 px-2 py-0.5 rounded border cursor-pointer text-xs transition-colors ${editState.klassen_ids.has(k.id) ? 'bg-purple-100 border-purple-400 text-purple-800' : 'bg-white border-gray-300 text-gray-500'}`}>
                              <input type="checkbox" className="hidden" checked={editState.klassen_ids.has(k.id)}
                                onChange={e => setEditState(p => {
                                  const s = new Set(p.klassen_ids)
                                  e.target.checked ? s.add(k.id) : s.delete(k.id)
                                  return { ...p, klassen_ids: s }
                                })} />
                              {k.name}
                            </label>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {g.klassen.map(kl => (
                            <span key={kl} className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">{kl}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right align-top">
                      {isEditing
                        ? <input type="number" step="0.5" className={inp + ' w-16 text-right'} value={editState.wo}
                            onChange={e => setEditState(p => ({ ...p, wo: e.target.value }))} />
                        : g.wochenstunden ?? '–'}
                    </td>
                    <td className="px-4 py-2 text-right align-top">
                      {isEditing
                        ? <input type="number" step="0.5" className={inp + ' w-16 text-right'} value={editState.jahr}
                            onChange={e => setEditState(p => ({ ...p, jahr: e.target.value }))} />
                        : g.jahresstunden ?? '–'}
                    </td>
                    <td className="px-4 py-2 align-top">
                      {isEditing
                        ? <select className={sel + ' w-full'} value={editState.lehrer_id}
                            onChange={e => setEditState(p => ({ ...p, lehrer_id: e.target.value }))}>
                            <option value="">– offen –</option>
                            {lehrer.map(l => <option key={l.id} value={l.id}>{l.kuerzel}</option>)}
                          </select>
                        : (g.lehrer_kuerzel
                            ? <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs">{g.lehrer_kuerzel}</span>
                            : <span className="text-gray-400 text-xs italic">offen</span>)}
                    </td>
                    <td className="px-4 py-2 align-top">
                      <div className="flex gap-1 justify-end">
                        {isEditing ? (
                          <>
                            <button onClick={() => handleSaveEdit(g)}
                              className="px-2 py-0.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">Speichern</button>
                            <button onClick={() => setEditKey(null)}
                              className="px-2 py-0.5 border border-gray-300 rounded text-xs hover:bg-gray-50">Abbr.</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(g)}
                              className="px-2 py-0.5 border border-gray-300 rounded text-xs hover:bg-gray-100">✎</button>
                            <button onClick={() => handleDelete(g)}
                              className="px-2 py-0.5 border border-red-300 text-red-600 rounded text-xs hover:bg-red-50">×</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

// FaecherSubTab
function FaecherSubTab({ faecher, onFaecherChange }: {
  faecher: AdminFach[]; onFaecherChange: (list: AdminFach[]) => void
}) {
  const [editId, setEditId] = useState<number | null>(null)
  const [editKuerzel, setEditKuerzel] = useState('')
  const [editBezeichnung, setEditBezeichnung] = useState('')
  const [newKuerzel, setNewKuerzel] = useState('')
  const [newBezeichnung, setNewBezeichnung] = useState('')
  const [error, setError] = useState('')

  async function handleSaveEdit(f: AdminFach) {
    if (!editKuerzel) { setError('Kuerzel erforderlich'); return }
    try {
      const updated = await updateFach(f.id, { kuerzel: editKuerzel, bezeichnung: editBezeichnung })
      onFaecherChange(faecher.map(x => x.id === f.id ? updated : x).sort((a, b) => a.kuerzel.localeCompare(b.kuerzel)))
      setEditId(null)
    } catch (e: any) { setError(e.message) }
  }

  async function handleDelete(f: AdminFach) {
    if (!confirm(`Fach "${f.kuerzel}" loeschen?`)) return
    try {
      await deleteFach(f.id)
      onFaecherChange(faecher.filter(x => x.id !== f.id))
    } catch (e: any) { setError(e.message) }
  }

  async function handleCreate() {
    if (!newKuerzel) { setError('Kuerzel erforderlich'); return }
    try {
      const created = await createFach({ kuerzel: newKuerzel, bezeichnung: newBezeichnung })
      onFaecherChange([...faecher, created].sort((a, b) => a.kuerzel.localeCompare(b.kuerzel)))
      setNewKuerzel(''); setNewBezeichnung('')
    } catch (e: any) { setError(e.message) }
  }

  const ic = 'border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-400'

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <span className="font-semibold text-sm text-gray-700">Faecher</span>
        <span className="ml-2 text-xs text-gray-400">{faecher.length} Eintraege</span>
      </div>
      {error && (
        <div className="mx-4 mt-2 p-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm flex justify-between">
          {error}<button onClick={() => setError('')} className="ml-2 font-bold">×</button>
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-left px-4 py-2 font-medium text-gray-600 w-28">Kuerzel</th>
            <th className="text-left px-4 py-2 font-medium text-gray-600">Bezeichnung</th>
            <th className="px-4 py-2 w-36"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {faecher.map(f => (
            <tr key={f.id} className="hover:bg-gray-50">
              <td className="px-4 py-1.5 font-medium">
                {editId === f.id
                  ? <input autoFocus className={ic + ' w-24'} value={editKuerzel}
                      onChange={e => setEditKuerzel(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(f); if (e.key === 'Escape') setEditId(null) }} />
                  : f.kuerzel}
              </td>
              <td className="px-4 py-1.5 text-gray-500">
                {editId === f.id
                  ? <input className={ic + ' w-full'} value={editBezeichnung}
                      onChange={e => setEditBezeichnung(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(f); if (e.key === 'Escape') setEditId(null) }} />
                  : (f.bezeichnung || <span className="text-gray-300 italic">\u2013</span>)}
              </td>
              <td className="px-4 py-1.5">
                <div className="flex gap-2 justify-end">
                  {editId === f.id ? (
                    <>
                      <button onClick={() => handleSaveEdit(f)}
                        className="px-2 py-0.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">Speichern</button>
                      <button onClick={() => setEditId(null)}
                        className="px-2 py-0.5 border border-gray-300 rounded text-xs hover:bg-gray-50">Abbrechen</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setEditId(f.id); setEditKuerzel(f.kuerzel); setEditBezeichnung(f.bezeichnung || '') }}
                        className="px-2 py-0.5 border border-gray-300 rounded text-xs hover:bg-gray-100">Bearbeiten</button>
                      <button onClick={() => handleDelete(f)}
                        className="px-2 py-0.5 border border-red-300 text-red-600 rounded text-xs hover:bg-red-50">Loeschen</button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
          <tr className="bg-green-50 border-t-2 border-green-200">
            <td className="px-4 py-1.5">
              <input className={ic + ' w-24'} placeholder="Kuerzel" value={newKuerzel}
                onChange={e => setNewKuerzel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreate() }} />
            </td>
            <td className="px-4 py-1.5">
              <input className={ic + ' w-full'} placeholder="Bezeichnung (optional)" value={newBezeichnung}
                onChange={e => setNewBezeichnung(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreate() }} />
            </td>
            <td className="px-4 py-1.5 text-right">
              <button onClick={handleCreate}
                className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">+ Hinzufuegen</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// Main
export default function AdminVerwaltungTab() {
  const [subTab, setSubTab] = useState<SubTab>('klassen')
  const [faecher, setFaecher] = useState<AdminFach[]>([])
  const [lehrer, setLehrer] = useState<AdminLehrer[]>([])
  const [klassen, setKlassen] = useState<AdminKlasse[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchAdminFaecher(), fetchAdminLehrer(), fetchAdminKlassen()])
      .then(([f, l, k]) => {
        setFaecher(f)
        setLehrer(l.filter(x => x.is_admin === 0))
        setKlassen(k)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-6 text-sm text-gray-500">Lädt…</div>

  return (
    <div className="flex flex-col gap-4" style={{ height: 'calc(100vh - 160px)' }}>
      <div className="flex gap-2 border-b border-gray-200 pb-0">
        {([['klassen', 'Klassen & Unterricht'], ['kopplungen', 'Kopplungen'], ['faecher', 'Fächer'], ['benutzer', 'Benutzer']] as [SubTab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setSubTab(key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-md border-b-2 transition-colors ${
              subTab === key ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}>{label}</button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden">
        {subTab === 'klassen' && <KlassenSubTab faecher={faecher} lehrer={lehrer} />}
        {subTab === 'kopplungen' && <div className="overflow-auto h-full pb-4"><KopplungenSubTab lehrer={lehrer} faecher={faecher} klassen={klassen} /></div>}
        {subTab === 'faecher' && <div className="overflow-auto h-full pb-4"><FaecherSubTab faecher={faecher} onFaecherChange={setFaecher} /></div>}
        {subTab === 'benutzer' && <div className="overflow-auto h-full pb-4"><BenutzerverwaltungTab /></div>}
      </div>
    </div>
  )
}
