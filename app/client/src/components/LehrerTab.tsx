import { useState, useEffect } from 'react';
import { Lehrer } from '../types';
import { fetchLehrer } from '../api';

export default function LehrerTab() {
  const [lehrer, setLehrer] = useState<Lehrer[]>([]);
  const [sortAsc, setSortAsc] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLehrer().then(data => {
      setLehrer(data);
      setLoading(false);
    });
  }, []);

  const sorted = [...lehrer].sort((a, b) =>
    sortAsc ? a.gesamtstunden - b.gesamtstunden : b.gesamtstunden - a.gesamtstunden
  );

  return (
    <div className="p-6">
      {loading ? (
        <div className="text-gray-500">Lade Daten...</div>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left p-3 font-semibold text-gray-700">Lehrer</th>
              <th
                className="text-right p-3 font-semibold text-gray-700 cursor-pointer hover:text-blue-600 select-none"
                onClick={() => setSortAsc(!sortAsc)}
              >
                Wochenstunden {sortAsc ? '↑' : '↓'}
              </th>
              <th className="text-left p-3 font-semibold text-gray-700">Klassen</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(l => (
              <tr key={l.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-medium">{l.kuerzel}</td>
                <td className="p-3 text-right font-mono">{l.gesamtstunden}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {l.klassen.map(k => (
                      <span key={k} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                        {k}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
