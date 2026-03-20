import { useEffect, useState } from 'react'
import { fetchKlassen, fetchKlasseDetail } from '../api'
import type { Klasse, KlasseDetail } from '../types'

function typBadgeClass(typ: string) {
  if (typ === 'HH') return 'bg-purple-100 text-purple-800'
  if (typ === 'AHR') return 'bg-green-100 text-green-800'
  return 'bg-blue-100 text-blue-800'
}

export default function KlassenTab() {
  const [klassen, setKlassen] = useState<Klasse[]>([])
  const [loading, setLoading] = useState(true)
  const [filterTyp, setFilterTyp] = useState<string>('Alle')
  const [selected, setSelected] = useState<KlasseDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    fetchKlassen().then(setKlassen).finally(() => setLoading(false))
  }, [])

  const typen = ['Alle', ...Array.from(new Set(klassen.map((k) => k.typ))).sort()]
  const filtered = filterTyp === 'Alle' ? klassen : klassen.filter((k) => k.typ === filterTyp)

  async function handleRowClick(k: Klasse) {
    setDetailLoading(true)
    try {
      const detail = await fetchKlasseDetail(k.id)
      setSelected(detail)
    } finally {
      setDetailLoading(false)
    }
  }

  if (loading) return <div className="text-gray-500 p-4">Lade Klassen…</div>

  return (
    <div className="flex gap-4">
      <div className="flex-1 min-w-0">
        {/* Filter */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {typen.map((t) => (
            <button
              key={t}
              onClick={() => setFilterTyp(t)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filterTyp === t
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Klasse</th>
                <th className="px-4 py-3 text-left">Jahrgang</th>
                <th className="px-4 py-3 text-left">Typ</th>
                <th className="px-4 py-3 text-right">Wert</th>
                <th className="px-4 py-3 text-right">Besetzt</th>
                <th className="px-4 py-3 text-right" title="Angemeldet (noch nicht offiziell besetzt)">Angemeldet</th>
                <th className="px-4 py-3 text-right">Offen</th>
                <th className="px-4 py-3">Fortschritt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((k) => {
                const pct = k.total_wert > 0 ? (k.besetzt_wert / k.total_wert) * 100 : 0
                const isSelected = selected?.id === k.id
                return (
                  <tr
                    key={k.id}
                    onClick={() => handleRowClick(k)}
                    className={`cursor-pointer hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-4 py-3 font-semibold text-gray-800">{k.name}</td>
                    <td className="px-4 py-3 text-gray-600">{k.jahrgangsstufe}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typBadgeClass(k.typ)}`}>
                        {k.typ}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{k.total_wert.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right text-green-700 font-medium">{k.besetzt_wert.toFixed(1)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${k.angemeldet_wert > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                      {k.angemeldet_wert > 0 ? k.angemeldet_wert.toFixed(1) : '–'}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${k.offen_wert > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      {k.offen_wert.toFixed(1)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${k.offen_wert > 0 ? 'bg-orange-400' : 'bg-green-500'}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
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
            <h2 className="font-semibold text-gray-800">{selected?.name ?? '…'}</h2>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
          </div>
          {detailLoading ? (
            <div className="p-4 text-gray-400">Lade…</div>
          ) : selected && (
            <div className="p-4 space-y-2 overflow-y-auto max-h-[70vh]">
              {selected.unterricht.map((u, i) => (
                <div key={i} className="flex items-start justify-between gap-2 p-2 rounded bg-gray-50 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-gray-800">{u.fach}</span>
                      {u.kopplung === 1 && (
                        <span className="px-1.5 py-0.5 bg-violet-200 text-violet-800 rounded text-xs font-bold" title="Kopplung">K</span>
                      )}
                      {u.hinweis && (
                        <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">{u.hinweis}</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {u.wochenstunden != null && <span>{u.wochenstunden}h/W </span>}
                      {u.jahresstunden != null && <span>{u.jahresstunden}h/J</span>}
                    </div>
                  </div>
                  {u.lehrer ? (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium whitespace-nowrap">{u.lehrer}</span>
                  ) : u.angemeldete && u.angemeldete.length > 0 ? (
                    <div className="flex flex-col items-end gap-0.5">
                      {u.angemeldete.map((a) => (
                        <span key={a} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium whitespace-nowrap">{a}</span>
                      ))}
                    </div>
                  ) : (
                    <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-medium whitespace-nowrap">offen</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
