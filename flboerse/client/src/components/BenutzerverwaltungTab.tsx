import { useEffect, useState } from 'react'
import { fetchAdminLehrer, createLehrer, updateLehrer, deleteLehrer, fetchAdminAnmeldungen, deleteAdminAnmeldung } from '../api'
import type { AdminLehrer, AdminAnmeldung } from '../types'

export default function BenutzerverwaltungTab() {
  const [lehrer, setLehrer] = useState<AdminLehrer[]>([])
  const [anmeldungen, setAnmeldungen] = useState<AdminAnmeldung[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<number | null>(null)
  const [editData, setEditData] = useState<Partial<AdminLehrer>>({})
  const [showNew, setShowNew] = useState(false)
  const [newData, setNewData] = useState({ kuerzel: '', vorname: '', nachname: '', deputat: 25.5, password: 'stupla' })
  const [error, setError] = useState('')

  async function load() {
    const [l, a] = await Promise.all([fetchAdminLehrer(), fetchAdminAnmeldungen()])
    setLehrer(l.filter(x => x.kuerzel !== 'ADMIN'))
    setAnmeldungen(a)
  }

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [])

  async function handleSaveEdit(id: number) {
    try {
      await updateLehrer(id, editData)
      setEditId(null)
      await load()
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function handleCreate() {
    try {
      await createLehrer(newData)
      setShowNew(false)
      setNewData({ kuerzel: '', vorname: '', nachname: '', deputat: 25.5, password: 'stupla' })
      await load()
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function handleDelete(l: AdminLehrer) {
    if (!confirm(`Lehrer ${l.kuerzel} wirklich löschen?`)) return
    try {
      await deleteLehrer(l.id)
      await load()
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function handleDeleteAnmeldung(id: number) {
    if (!confirm('Anmeldung wirklich löschen?')) return
    await deleteAdminAnmeldung(id)
    await load()
  }

  const anmeldungenByLehrer = new Map<number, number>()
  for (const a of anmeldungen) {
    anmeldungenByLehrer.set(a.lehrer_id, (anmeldungenByLehrer.get(a.lehrer_id) ?? 0) + 1)
  }

  const inpEdit = 'border border-blue-300 rounded px-2 py-1 text-sm'

  if (loading) return <div className="text-gray-500 p-4">Lade…</div>

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex justify-between">
          {error}
          <button onClick={() => setError('')}>×</button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Benutzerverwaltung</h2>
          <button
            onClick={() => setShowNew(true)}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            + Neu
          </button>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Kürzel</th>
              <th className="px-4 py-3 text-left">Vorname</th>
              <th className="px-4 py-3 text-left">Nachname</th>
              <th className="px-4 py-3 text-right">Deputat</th>
              <th className="px-4 py-3 text-left">Passwort</th>
              <th className="px-4 py-3 text-center">Admin</th>
              <th className="px-4 py-3 text-right">Anmeldungen</th>
              <th className="px-4 py-3 text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {showNew && (
              <tr className="bg-blue-50">
                <td className="px-3 py-2">
                  <input className={`w-20 ${inpEdit}`} value={newData.kuerzel}
                    onChange={e => setNewData(d => ({ ...d, kuerzel: e.target.value.toUpperCase() }))}
                    placeholder="Kürzel" autoFocus />
                </td>
                <td className="px-3 py-2">
                  <input className={`w-24 ${inpEdit}`} value={newData.vorname}
                    onChange={e => setNewData(d => ({ ...d, vorname: e.target.value }))}
                    placeholder="Vorname" />
                </td>
                <td className="px-3 py-2">
                  <input className={`w-28 ${inpEdit}`} value={newData.nachname}
                    onChange={e => setNewData(d => ({ ...d, nachname: e.target.value }))}
                    placeholder="Nachname" />
                </td>
                <td className="px-3 py-2 text-right">
                  <input className={`w-16 ${inpEdit} text-right`} type="number" step="0.5"
                    value={newData.deputat}
                    onChange={e => setNewData(d => ({ ...d, deputat: parseFloat(e.target.value) }))} />
                </td>
                <td className="px-3 py-2">
                  <input className={`w-24 ${inpEdit}`} value={newData.password}
                    onChange={e => setNewData(d => ({ ...d, password: e.target.value }))}
                    placeholder="Passwort" />
                </td>
                <td className="px-3 py-2 text-center">–</td>
                <td className="px-3 py-2 text-right">–</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1 justify-end">
                    <button onClick={handleCreate} className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">Speichern</button>
                    <button onClick={() => setShowNew(false)} className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300">Abbrechen</button>
                  </div>
                </td>
              </tr>
            )}
            {lehrer.map((l) => (
              <tr key={l.id} className="hover:bg-gray-50">
                {editId === l.id ? (
                  <>
                    <td className="px-3 py-2">
                      <input className={`w-20 ${inpEdit}`} value={editData.kuerzel ?? l.kuerzel}
                        onChange={e => setEditData(d => ({ ...d, kuerzel: e.target.value.toUpperCase() }))} />
                    </td>
                    <td className="px-3 py-2">
                      <input className={`w-24 ${inpEdit}`} value={editData.vorname ?? l.vorname}
                        onChange={e => setEditData(d => ({ ...d, vorname: e.target.value }))} />
                    </td>
                    <td className="px-3 py-2">
                      <input className={`w-28 ${inpEdit}`} value={editData.nachname ?? l.nachname}
                        onChange={e => setEditData(d => ({ ...d, nachname: e.target.value }))} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input className={`w-16 ${inpEdit} text-right`} type="number" step="0.5"
                        value={editData.deputat ?? l.deputat}
                        onChange={e => setEditData(d => ({ ...d, deputat: parseFloat(e.target.value) }))} />
                    </td>
                    <td className="px-3 py-2">
                      <input className={`w-24 ${inpEdit}`} value={editData.password ?? l.password}
                        onChange={e => setEditData(d => ({ ...d, password: e.target.value }))} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" checked={!!(editData.is_admin ?? l.is_admin)}
                        onChange={e => setEditData(d => ({ ...d, is_admin: e.target.checked ? 1 : 0 }))} />
                    </td>
                    <td className="px-3 py-2 text-right text-gray-500">{anmeldungenByLehrer.get(l.id) ?? 0}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => handleSaveEdit(l.id)} className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">Speichern</button>
                        <button onClick={() => setEditId(null)} className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300">Abbrechen</button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 font-semibold text-gray-800">{l.kuerzel}</td>
                    <td className="px-4 py-3 text-gray-700">{l.vorname || <span className="text-gray-300">–</span>}</td>
                    <td className="px-4 py-3 text-gray-700">{l.nachname || <span className="text-gray-300">–</span>}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{l.deputat?.toFixed(1)}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{l.password}</td>
                    <td className="px-4 py-3 text-center">
                      {l.is_admin ? <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">Admin</span> : '–'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{anmeldungenByLehrer.get(l.id) ?? 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => { setEditId(l.id); setEditData({ kuerzel: l.kuerzel, vorname: l.vorname, nachname: l.nachname, deputat: l.deputat, password: l.password, is_admin: l.is_admin }) }}
                          className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs hover:bg-blue-100"
                        >Bearbeiten</button>
                        <button
                          onClick={() => handleDelete(l)}
                          className="px-2 py-1 bg-red-50 text-red-600 rounded text-xs hover:bg-red-100"
                        >Löschen</button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Alle Anmeldungen ({anmeldungen.length})</h2>
        </div>
        {anmeldungen.length === 0 ? (
          <div className="p-4 text-gray-400 text-sm text-center">Keine Anmeldungen vorhanden.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Lehrer</th>
                <th className="px-4 py-3 text-left">Klasse</th>
                <th className="px-4 py-3 text-left">Fach</th>
                <th className="px-4 py-3 text-right">Wert (h/J)</th>
                <th className="px-4 py-3 text-left">Angemeldet</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {anmeldungen.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-semibold text-gray-800">{a.lehrer_kuerzel}</td>
                  <td className="px-4 py-2 text-gray-700">{a.klasse}</td>
                  <td className="px-4 py-2 text-gray-700">{a.fach}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{a.jahresstunden?.toFixed(1) ?? '–'}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{a.created_at}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => handleDeleteAnmeldung(a.id)}
                      className="px-2 py-1 bg-red-50 text-red-600 rounded text-xs hover:bg-red-100"
                    >Löschen</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

