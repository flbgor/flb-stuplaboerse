import { useEffect, useState } from 'react'
import { fetchAuswertung } from '../api'
import type { Auswertung, AuswertungLehrer } from '../types'

function pct(val: number, total: number) {
  return total > 0 ? Math.min((val / total) * 100, 100) : 0
}

export default function AuswertungTab() {
  const [data, setData] = useState<Auswertung | null>(null)
  const [loading, setLoading] = useState(true)
  const [lehrerFilter, setLehrerFilter] = useState<'alle' | 'offen' | 'erfuellt' | 'ueberlast'>('alle')

  useEffect(() => {
    fetchAuswertung().then(setData).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-gray-500 p-4">Lade Auswertung…</div>
  if (!data) return <div className="text-red-500 p-4">Fehler beim Laden</div>

  const { gesamt, bereiche, lehrer } = data

  const filteredLehrer = lehrer.filter((l) => {
    if (lehrerFilter === 'offen') return l.diff > 0
    if (lehrerFilter === 'erfuellt') return l.diff === 0
    if (lehrerFilter === 'ueberlast') return l.diff < 0
    return true
  })

  const lehrerMitOffen = lehrer.filter(l => l.diff > 0).length
  const lehrerErfuellt = lehrer.filter(l => l.diff <= 0).length

  return (
    <div className="space-y-6">
      {/* Übersichts-Kacheln */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Gesamt', value: gesamt.total, color: 'bg-gray-50 border-gray-200 text-gray-800' },
          { label: 'Besetzt', value: gesamt.besetzt, color: 'bg-green-50 border-green-200 text-green-800' },
          { label: 'Angemeldet', value: gesamt.angemeldet, color: 'bg-blue-50 border-blue-200 text-blue-800' },
          { label: 'Offen', value: gesamt.offen, color: 'bg-orange-50 border-orange-200 text-orange-800' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`p-4 rounded-lg border ${color}`}>
            <div className="text-sm font-medium opacity-80">{label}</div>
            <div className="text-2xl font-bold mt-1">{(value as number).toFixed(1)}</div>
            <div className="text-xs opacity-60 mt-0.5">h/J · {pct(value as number, gesamt.total).toFixed(0)}%</div>
          </div>
        ))}
      </div>

      {/* Fortschrittsbalken gesamt */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="text-sm font-medium text-gray-600 mb-2">Gesamtfortschritt</div>
        <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden flex">
          <div className="h-full bg-green-500 transition-all" style={{ width: `${pct(gesamt.besetzt, gesamt.total)}%` }} title={`Besetzt: ${gesamt.besetzt.toFixed(1)}h`} />
          <div className="h-full bg-blue-400 transition-all" style={{ width: `${pct(gesamt.angemeldet, gesamt.total)}%` }} title={`Angemeldet: ${gesamt.angemeldet.toFixed(1)}h`} />
        </div>
        <div className="flex gap-4 mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" />Besetzt</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-400 inline-block" />Angemeldet</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-200 inline-block" />Offen</span>
        </div>
      </div>

      {/* Nach Bereich */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 font-semibold text-gray-700">Nach Bereich</div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2 text-left">Bereich</th>
              <th className="px-4 py-2 text-right">Klassen</th>
              <th className="px-4 py-2 text-right">Gesamt</th>
              <th className="px-4 py-2 text-right text-green-600">Besetzt</th>
              <th className="px-4 py-2 text-right text-blue-600">Angemeldet</th>
              <th className="px-4 py-2 text-right text-orange-600">Offen</th>
              <th className="px-4 py-2">Fortschritt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {bereiche.map((b) => (
              <tr key={b.typ} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-semibold text-gray-700">{b.typ}</td>
                <td className="px-4 py-2 text-right text-gray-500">{b.klassen_count}</td>
                <td className="px-4 py-2 text-right text-gray-700">{b.total.toFixed(1)}</td>
                <td className="px-4 py-2 text-right text-green-700 font-medium">{b.besetzt.toFixed(1)}</td>
                <td className="px-4 py-2 text-right text-blue-600">{b.angemeldet > 0 ? b.angemeldet.toFixed(1) : '–'}</td>
                <td className="px-4 py-2 text-right font-medium text-orange-600">{b.offen.toFixed(1)}</td>
                <td className="px-4 py-2 w-32">
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden flex">
                    <div className="h-full bg-green-500" style={{ width: `${pct(b.besetzt, b.total)}%` }} />
                    <div className="h-full bg-blue-400" style={{ width: `${pct(b.angemeldet, b.total)}%` }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Lehrer-Ranking */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="font-semibold text-gray-700">
            Lehrer-Übersicht ({lehrerMitOffen} offen, {lehrerErfuellt} erfüllt/überlastet)
          </span>
          <div className="flex gap-1">
            {[
              { key: 'alle', label: 'Alle' },
              { key: 'offen', label: `Offen (${lehrerMitOffen})` },
              { key: 'erfuellt', label: 'Erfüllt' },
              { key: 'ueberlast', label: 'Überlast' },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setLehrerFilter(key as any)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  lehrerFilter === key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>{label}</button>
            ))}
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2 text-left">Lehrer</th>
              <th className="px-4 py-2 text-right">Deputat</th>
              <th className="px-4 py-2 text-right">Wert</th>
              <th className="px-4 py-2 text-right">Differenz</th>
              <th className="px-4 py-2 w-32">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredLehrer.map((l: AuswertungLehrer) => {
              const ueberlast = l.diff < 0
              const erfuellt = l.diff === 0
              return (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-semibold text-gray-700">{l.kuerzel}</td>
                  <td className="px-4 py-2 text-right text-gray-500">{l.deputat.toFixed(1)}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{l.wert.toFixed(1)}</td>
                  <td className={`px-4 py-2 text-right font-bold ${ueberlast ? 'text-red-600' : erfuellt ? 'text-green-600' : 'text-orange-600'}`}>
                    {ueberlast ? `+${Math.abs(l.diff).toFixed(1)} Ü` : erfuellt ? '✓' : `−${l.diff.toFixed(1)}`}
                  </td>
                  <td className="px-4 py-2">
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${ueberlast ? 'bg-red-500' : erfuellt ? 'bg-green-500' : 'bg-orange-400'}`}
                        style={{ width: `${pct(l.wert, l.deputat)}%` }}
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
  )
}
