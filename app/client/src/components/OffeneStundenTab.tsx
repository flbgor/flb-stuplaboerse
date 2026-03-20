import React, { useState, useEffect } from 'react';
import { OffeneStunden } from '../types';
import { fetchOffeneStunden } from '../api';

export default function OffeneStundenTab() {
  const [data, setData] = useState<OffeneStunden[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOffeneStunden().then(d => {
      setData(d);
      setLoading(false);
    });
  }, []);

  const grouped = data.reduce((acc, row) => {
    if (!acc[row.klasse]) acc[row.klasse] = [];
    acc[row.klasse].push(row);
    return acc;
  }, {} as Record<string, OffeneStunden[]>);

  return (
    <div className="p-6">
      {loading ? (
        <div className="text-gray-500">Lade Daten...</div>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left p-3 font-semibold text-gray-700">Klasse</th>
              <th className="text-left p-3 font-semibold text-gray-700">Typ</th>
              <th className="text-left p-3 font-semibold text-gray-700">Fach</th>
              <th className="text-right p-3 font-semibold text-gray-700">Stunden</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(grouped).map(([klasse, rows]) => {
              const total = rows.reduce((s, r) => s + r.stunden, 0);
              return (
                <React.Fragment key={klasse}>
                  {rows.map((row, i) => (
                    <tr key={i} className="border-b hover:bg-gray-50">
                      <td className="p-3">{i === 0 ? row.klasse : ''}</td>
                      <td className="p-3">
                        {i === 0 ? (
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            row.typ === 'HH' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {row.typ}
                          </span>
                        ) : ''}
                      </td>
                      <td className="p-3">{row.fach}</td>
                      <td className="p-3 text-right">{row.stunden}</td>
                    </tr>
                  ))}
                  <tr className="bg-orange-50 border-b-2 border-orange-200">
                    <td className="p-3 font-semibold text-orange-800" colSpan={3}>
                      Summe {klasse}
                    </td>
                    <td className="p-3 text-right font-bold text-orange-800">{total}</td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
