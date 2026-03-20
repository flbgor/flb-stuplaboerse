import { useState } from 'react';
import KlassenTab from './components/KlassenTab';
import LehrerTab from './components/LehrerTab';
import OffeneStundenTab from './components/OffeneStundenTab';

type Tab = 'uebersicht' | 'lehrer' | 'offene';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('uebersicht');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'uebersicht', label: 'Übersicht' },
    { id: 'lehrer', label: 'Lehrer' },
    { id: 'offene', label: 'Offene Stunden' },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-800">Stundenplanbörse</h1>
        </div>
        <nav className="max-w-7xl mx-auto px-6">
          <div className="flex gap-0">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto">
        {activeTab === 'uebersicht' && <KlassenTab />}
        {activeTab === 'lehrer' && <LehrerTab />}
        {activeTab === 'offene' && <OffeneStundenTab />}
      </main>
    </div>
  );
}
