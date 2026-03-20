import { useEffect, useState } from 'react'
import { fetchMeineStunden, deleteAnmeldung, fetchLehrerDetail } from '../api'
import type { MeineStunde, LehrerDetail } from '../types'
import { getUser } from '../auth'

function typBadgeClass(typ: string) {
  if (typ === 'HH') return 'bg-purple-100 text-purple-800'
  if (typ === 'AHR') return 'bg-green-100 text-green-800'
  return 'bg-blue-100 text-blue-800'
}

export default function MeineStundenTab() {
  const [stunden, setStunden] = useState<MeineStunde[]>([])
  const [lehrerInfo, setLehrerInfo] = useState<LehrerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterTyp, setFilterTyp] = useState<string>('Alle')

  async function load() {
    setLoading(true)
    try {
      const user = getUser()
      const [data, lInfo] = await Promise.all([
        fetchMeineStunden(),
        user ? fetchLehrerDetail(user.id) : Promise.resolve(null),
      ])
      setStunden(data)
      setLehrerInfo(lInfo)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleAbmelden(s: MeineStunde) {
    if (!s.anmeldung_id) return
    if (!confirm(`Anmeldung für ${s.fach} (${s.klasse}) wirklich abmelden?`)) return
    await deleteAnmeldung(s.anmeldung_id)
    await load()
  }

  if (loading) return <div className="text-gray-500 p-4">Lade…</div>

  const typen = ['Alle', ...Array.from(new Set(stunden.map(s => s.typ))).sort()]
  const filtered = filterTyp === 'Alle' ? stunden : stunden.filter(s => s.typ === filterTyp)

  const totalWert = filtered.reduce((s, x) => s + (x.jahresstunden ?? 0), 0)
  const zuweisungWert = filtered.filter(x => x.quelle === 'zuweisung').reduce((s, x) => s + (x.jahresstunden ?? 0), 0)
  const anmeldungWert = filtered.filter(x => x.quelle === 'anmeldung').reduce((s, x) => s + (x.jahresstunden ?? 0), 0)
  const hasMehrfach = filtered.some(x => x.mehrfach)

  const deputat = lehrerInfo?.deputat ?? 25.5
  const gesamtWert = stunden.reduce((s, x) => s + (x.jahresstunden ?? 0), 0)
  const diff = deputat - gesamtWert
  const ueberlast = diff < 0

  return (
    <div>
      {/* Filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {typen.map((t) => (
          <button key={t} onClick={() => setFilterTyp(t)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              filterTyp === t ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
            }`}
          >{t}</button>
        ))}
      </div>

      {/* Deputat-Summary */}
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-center gap-2">
          <span className="text-gray-600 font-medium">Deputat:</span>
          <span className="text-gray-800 font-bold text-lg">{deputat.toFixed(1)} h/J</span>
        </div>
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
          <span className="text-blue-700 font-medium">Aktuell:</span>
          <span className="text-blue-800 font-bold text-lg">{gesamtWert.toFixed(1)} h/J</span>
        </div>
        <div className={`p-3 border rounded-lg flex items-center gap-2 ${
          ueberlast ? 'bg-red-50 border-red-200' : diff === 0 ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'
        }`}>
          <span className={`font-medium ${ueberlast ? 'text-red-700' : diff === 0 ? 'text-green-700' : 'text-orange-700'}`}>
            {ueberlast ? '⚠ Überlast:' : diff === 0 ? '✓ Erfüllt:' : 'Noch zu belegen:'}
          </span>
          <span className={`font-bold text-lg ${ueberlast ? 'text-red-800' : diff === 0 ? 'text-green-800' : 'text-orange-800'}`}>
            {Math.abs(diff).toFixed(1)} h/J
          </span>
        </div>
        {filterTyp !== 'Alle' && (
          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center gap-2 text-sm">
            <span className="text-indigo-700">Gefiltert ({filterTyp}):</span>
            <span className="text-indigo-800 font-bold">{totalWert.toFixed(1)} h/J</span>
            <span className="text-indigo-600 text-xs">({zuweisungWert.toFixed(1)} zugew. + {anmeldungWert.toFixed(1)} angem.)</span>
          </div>
        )}
        {hasMehrfach && (
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-center">
            <span className="text-orange-700 text-sm font-medium">⚠ Mehrfachbelegungen vorhanden</span>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-gray-500 bg-white rounded-lg shadow p-8 text-center">
          Keine Stunden vorhanden.
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Klasse</th>
                <th className="px-4 py-3 text-left">Bereich</th>
                <th className="px-4 py-3 text-left">Fach</th>
                <th className="px-4 py-3 text-right">Wo-Std</th>
                <th className="px-4 py-3 text-right">Wert (h/J)</th>
                <th className="px-4 py-3 text-left">Hinweis</th>
                <th className="px-4 py-3 text-left">Quelle</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((s, i) => (
                <tr key={i} className={`hover:bg-gray-50 ${s.mehrfach ? 'bg-orange-50' : s.kopplung ? 'bg-violet-50' : ''}`}>
                  <td className="px-4 py-3 font-semibold text-gray-800">
                    {s.kopplung ? (
                      <div className="flex flex-wrap gap-1">
                        {s.klassen.map(k => (
                          <span key={k} className="px-1.5 py-0.5 bg-violet-100 text-violet-800 rounded text-xs font-semibold">{k}</span>
                        ))}
                      </div>
                    ) : s.klasse}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typBadgeClass(s.typ)}`}>{s.typ}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <span>{s.fach}</span>
                    {s.kopplung ? (
                      <span className="ml-2 px-1.5 py-0.5 bg-violet-200 text-violet-800 rounded text-xs font-bold" title="Kopplung">K</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{s.wochenstunden ?? '–'}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-700">{s.jahresstunden?.toFixed(1) ?? '–'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{s.hinweis ?? '–'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      s.quelle === 'anmeldung' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {s.quelle === 'anmeldung' ? 'Angemeldet' : 'Zugewiesen'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {s.mehrfach ? (
                      <div>
                        <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium cursor-help"
                          title={`Mitbewerber: ${s.mitbewerber.join(', ')}`}>⚠ Mehrfach</span>
                        <div className="text-xs text-orange-600 mt-0.5">mit: {s.mitbewerber.join(', ')}</div>
                      </div>
                    ) : s.quelle === 'anmeldung' ? (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">✓ Nur du</span>
                    ) : (
                      <span className="text-xs text-gray-400">–</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {s.quelle === 'anmeldung' && (
                      <button onClick={() => handleAbmelden(s)}
                        className="px-2 py-1 bg-red-50 text-red-600 rounded text-xs font-medium hover:bg-red-100 transition-colors">
                        Abmelden
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
