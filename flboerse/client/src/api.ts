import { getToken, setToken, clearToken } from './auth'
import type { Klasse, KlasseDetail, Lehrer, LehrerDetail, OffeneStunde, Anmeldung, MeineAnmeldung, MeineStunde, AdminLehrer, AdminAnmeldung, Auswertung, AdminKlasse, AdminFach, AdminUnterrichtRow, AdminKopplungRow } from './types'

function authHeader(): Record<string, string> {
  const token = getToken()
  return token ? { 'Authorization': `Bearer ${token}` } : {}
}

async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...authHeader(),
      ...(options.headers as Record<string, string> || {}),
    },
  })
  if (res.status === 401) {
    clearToken()
    window.location.reload()
    throw new Error('Unauthorized')
  }
  return res
}

export async function login(kuerzel: string, password: string): Promise<{ id: number; kuerzel: string; is_admin: number }> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kuerzel, password }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Login fehlgeschlagen')
  }
  const data = await res.json()
  setToken(data.token)
  const payload = data.token.split('.')[1]
  return JSON.parse(atob(payload))
}

export function logout(): void {
  clearToken()
}

export async function fetchKlassen(): Promise<Klasse[]> {
  const res = await apiFetch('/api/klassen')
  if (!res.ok) throw new Error('Failed to fetch klassen')
  return res.json()
}

export async function fetchKlasseDetail(id: number): Promise<KlasseDetail> {
  const res = await apiFetch(`/api/klassen/${id}`)
  if (!res.ok) throw new Error('Failed to fetch klasse detail')
  return res.json()
}

export async function fetchLehrer(): Promise<Lehrer[]> {
  const res = await apiFetch('/api/lehrer')
  if (!res.ok) throw new Error('Failed to fetch lehrer')
  return res.json()
}

export async function fetchLehrerDetail(id: number): Promise<LehrerDetail> {
  const res = await apiFetch(`/api/lehrer/${id}`)
  if (!res.ok) throw new Error('Failed to fetch lehrer detail')
  return res.json()
}

export async function updateDeputat(id: number, deputat: number): Promise<void> {
  const res = await apiFetch(`/api/lehrer/${id}/deputat`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deputat }),
  })
  if (!res.ok) throw new Error('Failed to update deputat')
}

export async function fetchOffeneStunden(): Promise<OffeneStunde[]> {
  const res = await apiFetch('/api/offene-stunden')
  if (!res.ok) throw new Error('Failed to fetch offene stunden')
  return res.json()
}

export async function fetchMeineAnmeldungen(): Promise<MeineAnmeldung[]> {
  const res = await apiFetch('/api/meine-anmeldungen')
  if (!res.ok) throw new Error('Failed to fetch meine anmeldungen')
  return res.json()
}

export async function fetchMeineStunden(): Promise<MeineStunde[]> {
  const res = await apiFetch('/api/meine-stunden')
  if (!res.ok) throw new Error('Failed to fetch meine stunden')
  return res.json()
}

export async function addAnmeldung(unterricht_id: number): Promise<Anmeldung> {
  const res = await apiFetch('/api/anmeldungen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ unterricht_id }),
  })
  if (res.status === 409) {
    const err = await res.json()
    throw new Error(err.message || 'Bereits angemeldet')
  }
  if (!res.ok) throw new Error('Failed to add anmeldung')
  return res.json()
}

export async function deleteAnmeldung(id: number): Promise<void> {
  const res = await apiFetch(`/api/anmeldungen/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete anmeldung')
}

export async function fetchAdminLehrer(): Promise<AdminLehrer[]> {
  const res = await apiFetch('/api/admin/lehrer')
  if (!res.ok) throw new Error('Failed to fetch admin lehrer')
  return res.json()
}

export async function createLehrer(data: { kuerzel: string; deputat?: number; password?: string }): Promise<AdminLehrer> {
  const res = await apiFetch('/api/admin/lehrer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to create lehrer')
  }
  return res.json()
}

export async function updateLehrer(id: number, data: Partial<{ kuerzel: string; deputat: number; password: string; is_admin: number }>): Promise<AdminLehrer> {
  const res = await apiFetch(`/api/admin/lehrer/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to update lehrer')
  }
  return res.json()
}

export async function deleteLehrer(id: number): Promise<void> {
  const res = await apiFetch(`/api/admin/lehrer/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to delete lehrer')
  }
}

export async function fetchAdminAnmeldungen(): Promise<AdminAnmeldung[]> {
  const res = await apiFetch('/api/admin/anmeldungen')
  if (!res.ok) throw new Error('Failed to fetch admin anmeldungen')
  return res.json()
}

export async function deleteAdminAnmeldung(id: number): Promise<void> {
  const res = await apiFetch(`/api/admin/anmeldungen/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete admin anmeldung')
}

export async function assignLehrerToUnterricht(unterricht_id: number, lehrer_id: number | null): Promise<void> {
  const res = await apiFetch(`/api/admin/unterricht/${unterricht_id}/lehrer`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lehrer_id }),
  })
  if (!res.ok) throw new Error('Failed to assign lehrer')
}

export async function fetchAuswertung(): Promise<Auswertung> {
  const res = await apiFetch('/api/admin/auswertung')
  if (!res.ok) throw new Error('Failed to fetch auswertung')
  return res.json()
}

// Admin Klassen CRUD
export async function fetchAdminKlassen(): Promise<AdminKlasse[]> {
  const res = await apiFetch('/api/admin/klassen')
  if (!res.ok) throw new Error('Failed to fetch klassen')
  return res.json()
}

export async function createKlasse(data: Omit<AdminKlasse, 'id'>): Promise<AdminKlasse> {
  const res = await apiFetch('/api/admin/klassen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Failed to create klasse') }
  return res.json()
}

export async function updateKlasse(id: number, data: Partial<Omit<AdminKlasse, 'id'>>): Promise<AdminKlasse> {
  const res = await apiFetch(`/api/admin/klassen/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Failed to update klasse') }
  return res.json()
}

export async function deleteKlasse(id: number): Promise<void> {
  const res = await apiFetch(`/api/admin/klassen/${id}`, { method: 'DELETE' })
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Failed to delete klasse') }
}

// Admin Fächer CRUD
export async function fetchAdminFaecher(): Promise<AdminFach[]> {
  const res = await apiFetch('/api/admin/faecher')
  if (!res.ok) throw new Error('Failed to fetch faecher')
  return res.json()
}

export async function createFach(data: { kuerzel: string; bezeichnung?: string }): Promise<AdminFach> {
  const res = await apiFetch('/api/admin/faecher', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Failed to create fach') }
  return res.json()
}

export async function updateFach(id: number, data: { kuerzel: string; bezeichnung?: string }): Promise<AdminFach> {
  const res = await apiFetch(`/api/admin/faecher/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Failed to update fach') }
  return res.json()
}

export async function deleteFach(id: number): Promise<void> {
  const res = await apiFetch(`/api/admin/faecher/${id}`, { method: 'DELETE' })
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Failed to delete fach') }
}

// Admin Unterricht CRUD
export async function fetchKlasseUnterricht(klasse_id: number): Promise<AdminUnterrichtRow[]> {
  const res = await apiFetch(`/api/admin/klassen/${klasse_id}/unterricht`)
  if (!res.ok) throw new Error('Failed to fetch unterricht')
  return res.json()
}

export async function createUnterricht(data: { klasse_id: number; fach_id: number; wochenstunden?: number; jahresstunden?: number; hinweis?: string; kopplung?: number; lehrer_id?: number | null }): Promise<AdminUnterrichtRow> {
  const res = await apiFetch('/api/admin/unterricht', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Failed to create unterricht') }
  return res.json()
}

export async function updateUnterricht(id: number, data: Partial<{ fach_id: number; wochenstunden: number; jahresstunden: number; hinweis: string; kopplung: number; lehrer_id: number | null }>): Promise<AdminUnterrichtRow> {
  const res = await apiFetch(`/api/admin/unterricht/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Failed to update unterricht') }
  return res.json()
}

export async function deleteUnterricht(id: number): Promise<void> {
  const res = await apiFetch(`/api/admin/unterricht/${id}`, { method: 'DELETE' })
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Failed to delete unterricht') }
}


export async function fetchAdminKopplungen(): Promise<AdminKopplungRow[]> {
  const res = await apiFetch('/api/admin/kopplungen')
  if (!res.ok) throw new Error('Failed to fetch kopplungen')
  return res.json()
}

export async function updateKopplungLehrer(
  fach_id: number, typ: string, jahrgangsstufe: string, lehrer_id: number | null
): Promise<void> {
  const res = await apiFetch('/api/admin/kopplungen/lehrer', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fach_id, typ, jahrgangsstufe, lehrer_id }),
  })
  if (!res.ok) throw new Error('Failed to update kopplung lehrer')
}

export async function createKopplung(data: {
  fach_id: number; klassen_ids: number[]; wochenstunden?: number | null; jahresstunden?: number | null; lehrer_id?: number | null
}): Promise<void> {
  const res = await apiFetch('/api/admin/kopplungen', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  })
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error((err as any).error || 'Failed') }
}

export async function deleteKopplung(fach_id: number, typ: string, jahrgangsstufe: string): Promise<void> {
  const res = await apiFetch('/api/admin/kopplungen', {
    method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fach_id, typ, jahrgangsstufe }),
  })
  if (!res.ok) throw new Error('Failed to delete kopplung')
}

export async function updateKopplungStunden(
  fach_id: number, typ: string, jahrgangsstufe: string, wochenstunden: number | null, jahresstunden: number | null
): Promise<void> {
  const res = await apiFetch('/api/admin/kopplungen/stunden', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fach_id, typ, jahrgangsstufe, wochenstunden, jahresstunden }),
  })
  if (!res.ok) throw new Error('Failed to update stunden')
}
