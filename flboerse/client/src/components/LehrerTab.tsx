import { useEffect, useState, useRef } from 'react'
import { fetchLehrer, fetchLehrerDetail, updateDeputat } from '../api'
import type { Lehrer, LehrerDetail } from '../types'
import { isAdmin } from '../auth'

export default function LehrerTab() {
  const [lehrer, setLehrer] = useState<Lehrer[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<LehrerDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchLehrer().then(setLehrer).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (editingId !== null) inputRef.current?.focus()
  }, [editingId])

  async function handleRowClick(l: Lehrer) {
    if (editingId !== null) return
    setDetailLoading(true)
    try {
      const detail = await fetchLehrerDetail(l.id)
      setSelected(detail)
    } finally {
      setDetailLoading(false)
    }
  }

  function startEdit(e: React.MouseEvent, l: Lehrer) {
    e.stopPropagation()
    setEditingId(l.id)
    setEditValue(String(l.deputat))
  }

  async function saveEdit(l: Lehrer) {
    const val = parseFloat(editValue)
    if (!isNaN(val) && val !== l.deputat) {
      await updateDeputat(l.id, val)
      setLehrer((prev) => prev.map((x) => x.id === l.id ? { ...x, deputat: val, diff: val - x.wert } : x))
      if (selected?.id === l.id) {
        setSelected((prev) => prev ? { ...prev, deputat: val, diff: val - prev.wert } : null)
      }
    }
    setEditingId(null)
  }

  if (loading) return <div className="text-gray-500 p-4">Lade Lehrer…</div>

  const displayLehrer = lehrer.filter(l => l.kuerzel !== 'ADMIN')

  return (
    <div className="flex gap-4">
      <div className="flex-1 min-w-0">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Lehrer</th>
                <th className="px-4 py-3 text-right">Deputat</th>
                <th className="px-4 py-3 text-right">Wert</th>
                <th className="px-4 py-3 text-right">Diff</th>
                <th className="px-4 py-3 text-right">Klassen</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayLehrer.map((l) => {
                const pct = l.deputat > 0 ? Math.min((l.wert / l.deputat) * 100, 100) : 0
                const isSelected = selected?.id === l.id
                const isOver = l.diff <= 0
                return (
                  <tr
                    key={l.id}
                    onClick={() => handleRowClick(l)}
                    className={`cursor-pointer hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-4 py-3 font-semibold text-gray-800">{l.kuerzel}</td>
                    <td className="px-4 py-3 text-right">
                      {editingId === l.id ? (
                        <input
                          ref={inputRef}
                          className="w-16 text-right border border-blue-400 rounded px-1 py-0.5 text-sm"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => saveEdit(l)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(l); if (e.key === 'Escape') setEditingId(null) }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="inline-flex items-center gap-1 group">
                          <span className="text-gray-700">{l.deputat.toFixed(1)}</span>
                          {isAdmin() && (
                            <button
                              onClick={(e) => startEdit(e, l)}
                              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 transition-opacity"
                              title="Deputat bearbeiten"
                            >✎</button>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{l.wert.toFixed(1)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${isOver ? 'text-green-600' : 'text-orange-600'}`}>
                      {l.diff > 0 ? '+' : ''}{l.diff.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{l.klassen_count}</td>
                    <td className="px-4 py-3">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${isOver ? 'bg-green-500' : 'bg-orange-400'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Side panel */}
      {(selected || detailLoading) && (
        <div className="w-96 bg-white rounded-lg shadow flex-shrink-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div>
              <h2 className="font-semibold text-gray-800">{selected?.kuerzel ?? '…'}</h2>
              {selected && (
                <p className="text-xs text-gray-500">
                  Deputat: {selected.deputat.toFixed(1)} | Wert: {selected.wert.toFixed(1)} | Diff: {selected.diff > 0 ? '+' : ''}{selected.diff.toFixed(1)}
                </p>
              )}
            </div>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
          </div>
          {detailLoading ? (
            <div className="p-4 text-gray-400">Lade…</div>
          ) : selected && (
            <div className="p-4 space-y-2 overflow-y-auto max-h-[70vh]">
              {selected.unterricht.map((u, i) => (
                <div key={i} className={`flex items-start justify-between gap-2 p-2 rounded text-sm ${u.kopplung ? 'bg-violet-50' : 'bg-gray-50'}`}>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {u.kopplung ? (
                        <div className="flex flex-wrap gap-1">
                          {(u.klassen as string[]).map((k: string) => (
                            <span key={k} className="px-1.5 py-0.5 bg-violet-100 text-violet-800 rounded text-xs font-semibold">{k}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="font-medium text-gray-700">{u.klasse}</span>
                      )}
                      <span className="text-gray-500">·</span>
                      <span className="text-gray-700">{u.fach}</span>
                      {u.kopplung ? (
                        <span className="px-1.5 py-0.5 bg-violet-200 text-violet-800 rounded text-xs font-bold" title="Kopplung">K</span>
                      ) : null}
                      {u.hinweis && (
                        <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">{u.hinweis}</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {u.wochenstunden != null && <span>{u.wochenstunden}h/W </span>}
                      {u.jahresstunden != null && <span className="font-medium text-gray-700">{u.jahresstunden}h/J</span>}
                    </div>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap ${
                    u.quelle === 'anmeldung'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {u.quelle === 'anmeldung' ? 'Angemeldet' : 'Zugewiesen'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
