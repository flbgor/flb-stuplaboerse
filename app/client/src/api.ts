import { Klasse, KlasseDetail, Lehrer, OffeneStunden } from './types';

export async function fetchKlassen(): Promise<Klasse[]> {
  const res = await fetch('/api/klassen');
  return res.json();
}

export async function fetchKlasseDetail(id: number): Promise<KlasseDetail> {
  const res = await fetch(`/api/klassen/${id}`);
  return res.json();
}

export async function fetchLehrer(): Promise<Lehrer[]> {
  const res = await fetch('/api/lehrer');
  return res.json();
}

export async function fetchOffeneStunden(): Promise<OffeneStunden[]> {
  const res = await fetch('/api/offene-stunden');
  return res.json();
}
