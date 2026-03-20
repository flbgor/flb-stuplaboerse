import { useState, useEffect } from 'react';
import { Klasse, KlasseDetail } from '../types';
import { fetchKlassen, fetchKlasseDetail } from '../api';

export default function KlassenTab() {
  const [klassen, setKlassen] = useState<Klasse[]>([]);
  const [filter, setFilter] = useState<'Alle' | 'HH' | 'AHR'>('Alle');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<KlasseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [allDetails, setAllDetails] = useState<Map<number, KlasseDetail>>(new Map());

  useEffect(() => {
    fetchKlassen().then(data => {
      setKlassen(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (selectedId !== null) {
      fetchKlasseDetail(selectedId).then(setDetail);
    } else {
      setDetail(null);
    }
  }, [selectedId]);

  useEffect(() => {
    if (klassen.length > 0) {
      Promise.all(klassen.map(k => fetchKlasseDetail(k.id))).then(details => {
        const map = new Map<number, KlasseDetail>();
        details.forEach(d => map.set(d.id, d));
        setAllDetails(map);
      });
    }
  }, [klassen]);

  const filtered = klassen.filter(k => filter === 'Alle' || k.typ === filter);

  return (
    <div className="flex h-full">
      <div className={`flex-1 overflow-auto ${selectedId ? 'mr-96' : ''}`}>
        <div className="p-6">
          <div className="flex gap-2 mb-4">
            {(['Alle', 'HH', 'AHR'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded font-medium ${
                  filter === f
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-gray-500">Lade Daten...</div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left p-3 font-semibold text-gray-700">Klasse</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Jahrgang</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Typ</th>
                  <th className="text-right p-3 font-semibold text-gray-700">Jahresstunden</th>
                  <th className="text-right p-3 font-semibold text-gray-700">Wochenstunden (besetzt)</th>
                  <th className="text-right p-3 font-semibold text-gray-700">Offen</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Besetzt</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(k => {
                  const d = allDetails.get(k.id);
                  const jahresTotal = d ? d.jahresstunden.reduce((s, e) => s + e.stunden, 0) : null;
                  const wochenBesetzt = d ? d.wochenstunden.filter(e => e.lehrer !== null).reduce((s, e) => s + e.stunden, 0) : null;
                  const wochenGesamt = d ? d.wochenstunden.reduce((s, e) => s + e.stunden, 0) : null;
                  const offen = wochenGesamt !== null && wochenBesetzt !== null ? wochenGesamt - wochenBesetzt : null;
                  const pct = wochenGesamt && wochenGesamt > 0 && wochenBesetzt !== null ? Math.round((wochenBesetzt / wochenGesamt) * 100) : 0;

                  return (
                    <tr
                      key={k.id}
                      onClick={() => setSelectedId(selectedId === k.id ? null : k.id)}
                      className={`border-b cursor-pointer hover:bg-blue-50 transition-colors ${
                        selectedId === k.id ? 'bg-blue-100' : ''
                      }`}
                    >
                      <td className="p-3 font-medium">{k.name}</td>
                      <td className="p-3 text-gray-600">{k.jahrgangsstufe}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          k.typ === 'HH' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {k.typ}
                        </span>
                      </td>
                      <td className="p-3 text-right">{jahresTotal !== null ? jahresTotal : '…'}</td>
                      <td className="p-3 text-right">{wochenBesetzt !== null ? wochenBesetzt : '…'}</td>
                      <td className={`p-3 text-right font-medium ${offen && offen > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                        {offen !== null ? offen : '…'}
                      </td>
                      <td className="p-3 w-32">
                        {wochenGesamt !== null ? (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-500 h-2 rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-600 w-8">{pct}%</span>
                          </div>
                        ) : '…'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selectedId && detail && (
        <div className="fixed top-0 right-0 w-96 h-full bg-white shadow-2xl border-l overflow-auto z-10">
          <div className="p-4 border-b flex items-center justify-between bg-gray-50">
            <h2 className="text-lg font-bold">{detail.name}</h2>
            <button
              onClick={() => setSelectedId(null)}
              className="text-gray-400 hover:text-gray-600 text-xl"
            >
              ✕
            </button>
          </div>
          <div className="p-4 grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold text-gray-700 mb-2 text-sm uppercase tracking-wide">Jahresstunden</h3>
              <div className="space-y-1">
                {detail.jahresstunden.map((s, i) => (
                  <div key={i} className="text-sm p-2 bg-gray-50 rounded">
                    <span className="font-medium">{s.kuerzel}</span>
                    <span className="text-gray-500 ml-1">{s.stunden}h/J</span>
                    {s.hinweis && <span className="text-xs text-blue-500 ml-1">({s.hinweis})</span>}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-gray-700 mb-2 text-sm uppercase tracking-wide">Wochenstunden</h3>
              <div className="space-y-1">
                {detail.wochenstunden.map((e, i) => (
                  <div
                    key={i}
                    className={`text-sm p-2 rounded ${
                      e.lehrer ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
                    }`}
                  >
                    <span className="font-medium">{e.kuerzel}</span>
                    <span className="text-gray-500 ml-1">{e.stunden}h/W</span>
                    <span className={`ml-1 text-xs font-medium ${e.lehrer ? 'text-green-700' : 'text-orange-500'}`}>
                      {e.lehrer || '–'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function KlassenTab() {
  const [klassen, setKlassen] = useState<Klasse[]>([]);
  const [filter, setFilter] = useState<'Alle' | 'HH' | 'AHR'>('Alle');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<KlasseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [allDetails, setAllDetails] = useState<Map<number, KlasseDetail>>(new Map());

  useEffect(() => {
    fetchKlassen().then(data => {
      setKlassen(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (selectedId !== null) {
      fetchKlasseDetail(selectedId).then(setDetail);
    } else {
      setDetail(null);
    }
  }, [selectedId]);

  useEffect(() => {
    if (klassen.length > 0) {
      Promise.all(klassen.map(k => fetchKlasseDetail(k.id))).then(details => {
        const map = new Map<number, KlasseDetail>();
        details.forEach(d => map.set(d.id, d));
        setAllDetails(map);
      });
    }
  }, [klassen]);

  const filtered = klassen.filter(k => filter === 'Alle' || k.typ === filter);

  return (
    <div className="flex h-full">
      <div className={`flex-1 overflow-auto ${selectedId ? 'mr-96' : ''}`}>
        <div className="p-6">
          <div className="flex gap-2 mb-4">
            {(['Alle', 'HH', 'AHR'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded font-medium ${
                  filter === f
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-gray-500">Lade Daten...</div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left p-3 font-semibold text-gray-700">Klasse</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Jahrgang</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Typ</th>
                  <th className="text-right p-3 font-semibold text-gray-700">Soll</th>
                  <th className="text-right p-3 font-semibold text-gray-700">Ist (besetzt)</th>
                  <th className="text-right p-3 font-semibold text-gray-700">Offen</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Fortschritt</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(k => {
                  const d = allDetails.get(k.id);
                  const sollTotal = d ? d.soll.reduce((s, e) => s + e.stunden, 0) : null;
                  const istBesetzt = d ? d.ist.filter(e => e.lehrer !== null).reduce((s, e) => s + e.stunden, 0) : null;
                  const offen = sollTotal !== null && istBesetzt !== null ? sollTotal - istBesetzt : null;
                  const pct = sollTotal && sollTotal > 0 && istBesetzt !== null ? Math.round((istBesetzt / sollTotal) * 100) : 0;

                  return (
                    <tr
                      key={k.id}
                      onClick={() => setSelectedId(selectedId === k.id ? null : k.id)}
                      className={`border-b cursor-pointer hover:bg-blue-50 transition-colors ${
                        selectedId === k.id ? 'bg-blue-100' : ''
                      }`}
                    >
                      <td className="p-3 font-medium">{k.name}</td>
                      <td className="p-3 text-gray-600">{k.jahrgangsstufe}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          k.typ === 'HH' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {k.typ}
                        </span>
                      </td>
                      <td className="p-3 text-right">{sollTotal !== null ? sollTotal : '…'}</td>
                      <td className="p-3 text-right">{istBesetzt !== null ? istBesetzt : '…'}</td>
                      <td className={`p-3 text-right font-medium ${offen && offen > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                        {offen !== null ? offen : '…'}
                      </td>
                      <td className="p-3 w-32">
                        {sollTotal !== null ? (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-500 h-2 rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-600 w-8">{pct}%</span>
                          </div>
                        ) : '…'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selectedId && detail && (
        <div className="fixed top-0 right-0 w-96 h-full bg-white shadow-2xl border-l overflow-auto z-10">
          <div className="p-4 border-b flex items-center justify-between bg-gray-50">
            <h2 className="text-lg font-bold">{detail.name}</h2>
            <button
              onClick={() => setSelectedId(null)}
              className="text-gray-400 hover:text-gray-600 text-xl"
            >
              ✕
            </button>
          </div>
          <div className="p-4 grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold text-gray-700 mb-2 text-sm uppercase tracking-wide">Soll</h3>
              <div className="space-y-1">
                {detail.soll.map((s, i) => (
                  <div key={i} className="text-sm p-2 bg-gray-50 rounded">
                    <span className="font-medium">{s.kuerzel}</span>
                    <span className="text-gray-500 ml-1">{s.stunden}h</span>
                    {s.hinweis && <span className="text-xs text-blue-500 ml-1">({s.hinweis})</span>}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-gray-700 mb-2 text-sm uppercase tracking-wide">Ist</h3>
              <div className="space-y-1">
                {detail.ist.map((e, i) => (
                  <div
                    key={i}
                    className={`text-sm p-2 rounded ${
                      e.lehrer ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
                    }`}
                  >
                    <span className="font-medium">{e.kuerzel}</span>
                    <span className="text-gray-500 ml-1">{e.stunden}h</span>
                    <span className={`ml-1 text-xs ${e.lehrer ? 'text-green-700' : 'text-orange-500'}`}>
                      {e.lehrer || '–'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
