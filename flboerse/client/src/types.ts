export interface Klasse {
  id: number;
  name: string;
  typ: string;
  jahrgangsstufe: string;
  total_wert: number;
  besetzt_wert: number;
  offen_wert: number;
  angemeldet_wert: number;
}

export interface Unterricht {
  unterricht_id: number;
  fach: string;
  wochenstunden: number | null;
  jahresstunden: number | null;
  hinweis: string | null;
  kopplung: number;
  lehrer: string | null;
  angemeldete: string[];
}

export interface KlasseDetail extends Klasse {
  unterricht: Unterricht[];
}

export interface Lehrer {
  id: number;
  kuerzel: string;
  deputat: number;
  wert: number;
  diff: number;
  klassen_count: number;
}

export interface LehrerUnterricht {
  klasse: string;
  klassen: string[];
  typ: string;
  fach: string;
  wochenstunden: number | null;
  jahresstunden: number | null;
  hinweis: string | null;
  quelle: 'zuweisung' | 'anmeldung';
  kopplung: number;
}

export interface LehrerDetail extends Lehrer {
  unterricht: LehrerUnterricht[];
}

export interface MeineStunde {
  unterricht_id: number;
  klasse: string;
  klassen: string[];
  typ: string;
  fach: string;
  wochenstunden: number | null;
  jahresstunden: number | null;
  hinweis: string | null;
  quelle: 'zuweisung' | 'anmeldung';
  anmeldung_id: number | null;
  mitbewerber: string[];
  mehrfach: boolean;
  kopplung: number;
}

export interface OffeneStunde {
  unterricht_id: number;
  klasse: string;
  klassen: string[];
  unterricht_ids: number[];
  typ: string;
  fach: string;
  bezeichnung: string;
  wochenstunden: number | null;
  jahresstunden: number | null;
  hinweis: string | null;
  anmeldungen_count: number;
  angemeldete: string[];
  kopplung: number;
}

export interface Anmeldung {
  id: number;
  unterricht_id: number;
  lehrer_id: number;
  created_at: string;
}

export interface MeineAnmeldung {
  anmeldung_id: number;
  unterricht_id: number;
  klasse: string;
  fach: string;
  wochenstunden: number | null;
  jahresstunden: number | null;
  hinweis: string | null;
  mehrfach: boolean;
  mitbewerber: string[];
}

export interface AdminLehrer {
  id: number;
  kuerzel: string;
  vorname: string;
  nachname: string;
  deputat: number;
  password: string;
  is_admin: number;
  anmeldungen_count?: number;
}

export interface AdminAnmeldung {
  id: number;
  unterricht_id: number;
  lehrer_id: number;
  lehrer_kuerzel: string;
  klasse: string;
  fach: string;
  wochenstunden: number | null;
  jahresstunden: number | null;
  created_at: string;
}

export interface AuswertungGesamt {
  total: number;
  besetzt: number;
  angemeldet: number;
  offen: number;
}

export interface AuswertungBereich {
  typ: string;
  total: number;
  besetzt: number;
  angemeldet: number;
  offen: number;
  klassen_count: number;
}

export interface AuswertungLehrer {
  id: number;
  kuerzel: string;
  wert: number;
  deputat: number;
  diff: number;
}

export interface Auswertung {
  gesamt: AuswertungGesamt;
  bereiche: AuswertungBereich[];
  lehrer: AuswertungLehrer[];
}

export interface AdminKlasse {
  id: number;
  name: string;
  typ: string;
  jahrgangsstufe: string;
}

export interface AdminFach {
  id: number;
  kuerzel: string;
  bezeichnung: string;
}

export interface AdminUnterrichtRow {
  id: number;
  klasse_id: number;
  fach_id: number;
  fach: string;
  wochenstunden: number | null;
  jahresstunden: number | null;
  hinweis: string | null;
  kopplung: number;
  lehrer_id: number | null;
  lehrer_kuerzel: string | null;
}

export interface AdminKopplungRow {
  id: number;
  fach_id: number;
  fach: string;
  bezeichnung: string;
  klasse_id: number;
  klasse: string;
  typ: string;
  jahrgangsstufe: string;
  wochenstunden: number | null;
  jahresstunden: number | null;
  lehrer_id: number | null;
  lehrer_kuerzel: string | null;
}

export interface AdminKopplung {
  key: string;
  fach_id: number;
  fach: string;
  bezeichnung: string;
  typ: string;
  jahrgangsstufe: string;
  klassen: string[];
  wochenstunden: number | null;
  jahresstunden: number | null;
  lehrer_id: number | null;
  lehrer_kuerzel: string | null;
  unterricht_ids: number[];
}
