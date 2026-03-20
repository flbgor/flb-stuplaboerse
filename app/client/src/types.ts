export interface Klasse {
  id: number;
  name: string;
  typ: string;
  jahrgangsstufe: string;
}

export interface JahresstundenEintrag {
  kuerzel: string;
  stunden: number;
  hinweis: string | null;
}

export interface WochenstundenEintrag {
  kuerzel: string;
  stunden: number;
  lehrer: string | null;
}

export interface KlasseDetail extends Klasse {
  jahresstunden: JahresstundenEintrag[];
  wochenstunden: WochenstundenEintrag[];
}

export interface Lehrer {
  id: number;
  kuerzel: string;
  gesamtstunden: number;
  klassen: string[];
}

export interface OffeneStunden {
  klasse: string;
  typ: string;
  fach: string;
  stunden: number;
}
