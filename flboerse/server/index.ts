import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';
import jwt from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      user?: { id: number; kuerzel: string; is_admin: number };
    }
  }
}

const app = express();
app.use(cors());
app.use(express.json());

const DB_PATH = path.resolve('/Users/ralfgorny/Documents/github/flb/flb-stuplaboerse/flb-stuplaboerse/stundenplan.db');
const JWT_SECRET = 'flboerse-secret-2026';

let db: any;
const deputatOverrides = new Map<number, number>();

async function loadDb() {
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(DB_PATH);
  db = new SQL.Database(fileBuffer);
  // Initialize deputat overrides from DB
  const stmt = db.prepare('SELECT id, deputat FROM lehrer');
  while (stmt.step()) {
    const row = stmt.getAsObject();
    deputatOverrides.set(row.id as number, row.deputat as number);
  }
  stmt.free();
}

function persistDb() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function getDeputat(id: number): number {
  return deputatOverrides.get(id) ?? 25.5;
}

function authRequired(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    req.user = { id: payload.id, kuerzel: payload.kuerzel, is_admin: payload.is_admin };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function adminRequired(req: Request, res: Response, next: NextFunction) {
  authRequired(req, res, () => {
    if (req.user?.is_admin !== 1) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  });
}

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  try {
    const { kuerzel, password } = req.body;
    if (!kuerzel || !password) return res.status(400).json({ error: 'kuerzel and password required' });
    const stmt = db.prepare('SELECT id, kuerzel, vorname, nachname, password, is_admin FROM lehrer WHERE kuerzel = ?');
    stmt.bind([kuerzel]);
    if (!stmt.step()) {
      stmt.free();
      return res.status(401).json({ error: 'Ungültige Zugangsdaten' });
    }
    const row = stmt.getAsObject() as any;
    stmt.free();
    if (row.password !== password) {
      return res.status(401).json({ error: 'Ungültige Zugangsdaten' });
    }
    const token = jwt.sign(
      { id: row.id, kuerzel: row.kuerzel, vorname: row.vorname || '', nachname: row.nachname || '', is_admin: row.is_admin },
      JWT_SECRET,
      { expiresIn: '8h' }
    );
    res.json({ token });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', authRequired, (req, res) => {
  res.json(req.user);
});

// GET /api/klassen
app.get('/api/klassen', authRequired, (_req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT 
        k.id, k.name, k.typ, k.jahrgangsstufe,
        COALESCE(SUM(u.jahresstunden), 0) as total_wert,
        COALESCE(SUM(CASE WHEN u.lehrer_id IS NOT NULL THEN u.jahresstunden ELSE 0 END), 0) as besetzt_wert,
        COALESCE(SUM(CASE WHEN u.lehrer_id IS NULL AND u.jahresstunden IS NOT NULL
          AND (SELECT COUNT(*) FROM anmeldungen a WHERE a.unterricht_id = u.id) = 0
          THEN u.jahresstunden ELSE 0 END), 0) as offen_wert,
        COALESCE(SUM(CASE WHEN u.lehrer_id IS NULL AND u.jahresstunden IS NOT NULL
          AND (SELECT COUNT(*) FROM anmeldungen a WHERE a.unterricht_id = u.id) > 0
          THEN u.jahresstunden ELSE 0 END), 0) as angemeldet_wert
      FROM klassen k
      LEFT JOIN unterricht u ON u.klasse_id = k.id
      GROUP BY k.id
      ORDER BY k.name
    `);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    res.json(results);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/klassen/:id
app.get('/api/klassen/:id', authRequired, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const kStmt = db.prepare('SELECT * FROM klassen WHERE id = ?');
    kStmt.bind([id]);
    if (!kStmt.step()) {
      kStmt.free();
      return res.status(404).json({ error: 'Not found' });
    }
    const klasse = kStmt.getAsObject();
    kStmt.free();

    const uStmt = db.prepare(`
      SELECT u.id as unterricht_id, f.kuerzel as fach, u.wochenstunden, u.jahresstunden, u.hinweis, u.kopplung,
             l.kuerzel as lehrer
      FROM unterricht u
      JOIN faecher f ON f.id = u.fach_id
      LEFT JOIN lehrer l ON l.id = u.lehrer_id
      WHERE u.klasse_id = ?
      ORDER BY f.kuerzel
    `);
    uStmt.bind([id]);
    const unterricht: any[] = [];
    while (uStmt.step()) {
      unterricht.push(uStmt.getAsObject());
    }
    uStmt.free();

    // For open slots, fetch angemeldete teachers
    for (const u of unterricht) {
      if (!u.lehrer) {
        const aStmt = db.prepare(`
          SELECT l.kuerzel FROM anmeldungen a
          JOIN lehrer l ON l.id = a.lehrer_id
          WHERE a.unterricht_id = ?
        `);
        aStmt.bind([u.unterricht_id]);
        const angemeldete: string[] = [];
        while (aStmt.step()) {
          angemeldete.push((aStmt.getAsObject() as any).kuerzel);
        }
        aStmt.free();
        u.angemeldete = angemeldete;
      } else {
        u.angemeldete = [];
      }
    }

    // Compute stats
    const total_wert = unterricht.reduce((s: number, u: any) => s + (u.jahresstunden || 0), 0);
    const besetzt_wert = unterricht.reduce((s: number, u: any) => s + (u.lehrer ? (u.jahresstunden || 0) : 0), 0);
    const angemeldet_wert = unterricht.reduce((s: number, u: any) => s + (!u.lehrer && u.angemeldete?.length > 0 && u.jahresstunden ? u.jahresstunden : 0), 0);
    const offen_wert = unterricht.reduce((s: number, u: any) => s + (!u.lehrer && (!u.angemeldete || u.angemeldete.length === 0) && u.jahresstunden ? u.jahresstunden : 0), 0);

    res.json({ ...klasse, total_wert, besetzt_wert, angemeldet_wert, offen_wert, unterricht });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/lehrer
app.get('/api/lehrer', authRequired, (_req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT 
        l.id, l.kuerzel,
        COALESCE((SELECT SUM(u.jahresstunden) FROM unterricht u WHERE u.lehrer_id = l.id), 0) +
        COALESCE((SELECT SUM(u.jahresstunden) FROM anmeldungen a JOIN unterricht u ON u.id = a.unterricht_id WHERE a.lehrer_id = l.id), 0) as wert,
        (SELECT COUNT(DISTINCT u.klasse_id) FROM unterricht u WHERE u.lehrer_id = l.id) +
        (SELECT COUNT(DISTINCT u.klasse_id) FROM anmeldungen a JOIN unterricht u ON u.id = a.unterricht_id WHERE a.lehrer_id = l.id) as klassen_count
      FROM lehrer l
      WHERE l.is_admin = 0
      ORDER BY l.kuerzel
    `);
    const results = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as any;
      const deputat = getDeputat(row.id as number);
      results.push({
        ...row,
        deputat,
        diff: deputat - (row.wert as number),
      });
    }
    stmt.free();
    res.json(results);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/lehrer/:id
app.get('/api/lehrer/:id', authRequired, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const lStmt = db.prepare('SELECT id, kuerzel FROM lehrer WHERE id = ?');
    lStmt.bind([id]);
    if (!lStmt.step()) {
      lStmt.free();
      return res.status(404).json({ error: 'Not found' });
    }
    const lehrer = lStmt.getAsObject() as any;
    lStmt.free();

    const uStmt = db.prepare(`
      SELECT k.name as klasse, k.typ, k.jahrgangsstufe, f.id as fach_id, f.kuerzel as fach,
             u.wochenstunden, u.jahresstunden, u.hinweis, u.kopplung, 'zuweisung' as quelle
      FROM unterricht u
      JOIN klassen k ON k.id = u.klasse_id
      JOIN faecher f ON f.id = u.fach_id
      WHERE u.lehrer_id = ?
      UNION ALL
      SELECT k.name as klasse, k.typ, k.jahrgangsstufe, f.id as fach_id, f.kuerzel as fach,
             u.wochenstunden, u.jahresstunden, u.hinweis, u.kopplung, 'anmeldung' as quelle
      FROM anmeldungen a
      JOIN unterricht u ON u.id = a.unterricht_id
      JOIN klassen k ON k.id = u.klasse_id
      JOIN faecher f ON f.id = u.fach_id
      WHERE a.lehrer_id = ?
      ORDER BY klasse, fach
    `);
    uStmt.bind([id, id]);
    const raw: any[] = [];
    while (uStmt.step()) {
      raw.push(uStmt.getAsObject());
    }
    uStmt.free();

    // Group kopplung=1 entries per fach+typ+jahrgangsstufe+quelle → one row with klassen[]
    const unterricht: any[] = [];
    const koppSeen = new Set<string>();
    for (const row of raw) {
      if (row.kopplung === 1) {
        const key = `${row.fach_id}|${row.typ}|${row.jahrgangsstufe}|${row.quelle}`;
        if (koppSeen.has(key)) continue;
        koppSeen.add(key);
        const gruppe = raw.filter(r =>
          r.kopplung === 1 && r.fach_id === row.fach_id &&
          r.typ === row.typ && r.jahrgangsstufe === row.jahrgangsstufe && r.quelle === row.quelle
        );
        unterricht.push({
          ...row,
          klasse: gruppe.map((r: any) => r.klasse).join(', '),
          klassen: gruppe.map((r: any) => r.klasse),
          kopplung: 1,
        });
      } else {
        unterricht.push({ ...row, klassen: [row.klasse] });
      }
    }

    const deputat = getDeputat(id);
    const wert = unterricht.reduce((s: number, u: any) => s + (u.jahresstunden || 0), 0);

    res.json({
      ...lehrer,
      deputat,
      wert,
      diff: deputat - wert,
      unterricht,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/lehrer/:id/deputat
app.put('/api/lehrer/:id/deputat', adminRequired, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { deputat } = req.body;
    if (typeof deputat !== 'number') {
      return res.status(400).json({ error: 'deputat must be a number' });
    }
    // Update in-memory map
    deputatOverrides.set(id, deputat);
    // Update sql.js DB and persist to disk
    db.run('UPDATE lehrer SET deputat = ? WHERE id = ?', [deputat, id]);
    persistDb();
    res.json({ id, deputat });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/offene-stunden
app.get('/api/offene-stunden', authRequired, (_req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT u.id as unterricht_id, k.name as klasse, k.typ, k.jahrgangsstufe,
             f.id as fach_id, f.kuerzel as fach, COALESCE(f.bezeichnung,'') as bezeichnung,
             u.wochenstunden, u.jahresstunden, u.hinweis, u.kopplung,
             COUNT(a.id) as anmeldungen_count
      FROM unterricht u
      JOIN klassen k ON k.id = u.klasse_id
      JOIN faecher f ON f.id = u.fach_id
      LEFT JOIN anmeldungen a ON a.unterricht_id = u.id
      WHERE u.lehrer_id IS NULL AND u.jahresstunden IS NOT NULL
      GROUP BY u.id
      ORDER BY k.name, f.kuerzel
    `);
    const raw: any[] = [];
    while (stmt.step()) {
      raw.push(stmt.getAsObject());
    }
    stmt.free();

    // Fetch angemeldete per row
    for (const row of raw) {
      const aStmt = db.prepare(`
        SELECT l.kuerzel FROM anmeldungen a
        JOIN lehrer l ON l.id = a.lehrer_id
        WHERE a.unterricht_id = ?
      `);
      aStmt.bind([row.unterricht_id]);
      const angemeldete: string[] = [];
      while (aStmt.step()) angemeldete.push((aStmt.getAsObject() as any).kuerzel);
      aStmt.free();
      row.angemeldete = angemeldete;
    }

    // Group kopplung=1 entries: same fach_id + typ + jahrgangsstufe → one row with klassen[]
    const results: any[] = [];
    const koppSeen = new Set<string>();
    for (const row of raw) {
      if (row.kopplung === 1) {
        const key = `${row.fach_id}|${row.typ}|${row.jahrgangsstufe}`;
        if (koppSeen.has(key)) continue;
        koppSeen.add(key);
        const gruppe = raw.filter(r =>
          r.kopplung === 1 && r.fach_id === row.fach_id &&
          r.typ === row.typ && r.jahrgangsstufe === row.jahrgangsstufe
        );
        // Merge anmeldungen_count and angemeldete across the group (deduplicate)
        const allAngemeldete = [...new Set(gruppe.flatMap((r: any) => r.angemeldete as string[]))];
        results.push({
          ...row,
          klasse: gruppe.map((r: any) => r.klasse).join(', '),
          klassen: gruppe.map((r: any) => r.klasse),
          unterricht_ids: gruppe.map((r: any) => r.unterricht_id),
          anmeldungen_count: gruppe.reduce((s: number, r: any) => s + (r.anmeldungen_count as number), 0),
          angemeldete: allAngemeldete,
          kopplung: 1,
        });
      } else {
        results.push({ ...row, klassen: [row.klasse], unterricht_ids: [row.unterricht_id] });
      }
    }

    res.json(results);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/anmeldungen
app.post('/api/anmeldungen', authRequired, (req, res) => {
  try {
    const { unterricht_id, lehrer_id: bodyLehrerId } = req.body;
    if (!unterricht_id) return res.status(400).json({ error: 'unterricht_id required' });

    // Check unterricht is open
    const checkStmt = db.prepare('SELECT id FROM unterricht WHERE id = ? AND lehrer_id IS NULL');
    checkStmt.bind([unterricht_id]);
    if (!checkStmt.step()) {
      checkStmt.free();
      return res.status(400).json({ error: 'Unterricht nicht offen oder nicht gefunden' });
    }
    checkStmt.free();

    const lehrer_id = (req.user!.is_admin === 1 && bodyLehrerId) ? bodyLehrerId : req.user!.id;

    try {
      db.run('INSERT INTO anmeldungen (unterricht_id, lehrer_id) VALUES (?, ?)', [unterricht_id, lehrer_id]);
    } catch (e: any) {
      if (e.message && e.message.includes('UNIQUE')) {
        return res.status(409).json({ message: 'Bereits angemeldet' });
      }
      throw e;
    }

    persistDb();
    const idStmt = db.prepare('SELECT last_insert_rowid() as id');
    idStmt.step();
    const { id } = idStmt.getAsObject() as any;
    idStmt.free();

    res.status(201).json({ id, unterricht_id, lehrer_id, created_at: new Date().toISOString() });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/anmeldungen/:id
app.delete('/api/anmeldungen/:id', authRequired, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const aStmt = db.prepare('SELECT id, lehrer_id FROM anmeldungen WHERE id = ?');
    aStmt.bind([id]);
    if (!aStmt.step()) {
      aStmt.free();
      return res.status(404).json({ error: 'Not found' });
    }
    const row = aStmt.getAsObject() as any;
    aStmt.free();

    if (req.user!.is_admin !== 1 && row.lehrer_id !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    db.run('DELETE FROM anmeldungen WHERE id = ?', [id]);
    persistDb();
    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/meine-stunden - both original assignments and voluntary sign-ups
app.get('/api/meine-stunden', authRequired, (req, res) => {
  try {
    const lehrer_id = req.user!.id;

    const stmt = db.prepare(`
      SELECT u.id as unterricht_id, k.name as klasse, k.typ, k.jahrgangsstufe,
             f.id as fach_id, f.kuerzel as fach,
             u.wochenstunden, u.jahresstunden, u.hinweis, u.kopplung,
             'zuweisung' as quelle, NULL as anmeldung_id
      FROM unterricht u
      JOIN klassen k ON k.id = u.klasse_id
      JOIN faecher f ON f.id = u.fach_id
      WHERE u.lehrer_id = ?
      UNION ALL
      SELECT u.id as unterricht_id, k.name as klasse, k.typ, k.jahrgangsstufe,
             f.id as fach_id, f.kuerzel as fach,
             u.wochenstunden, u.jahresstunden, u.hinweis, u.kopplung,
             'anmeldung' as quelle, a.id as anmeldung_id
      FROM anmeldungen a
      JOIN unterricht u ON u.id = a.unterricht_id
      JOIN klassen k ON k.id = u.klasse_id
      JOIN faecher f ON f.id = u.fach_id
      WHERE a.lehrer_id = ?
      ORDER BY klasse, fach
    `);
    stmt.bind([lehrer_id, lehrer_id]);
    const raw: any[] = [];
    while (stmt.step()) {
      raw.push(stmt.getAsObject());
    }
    stmt.free();

    // For anmeldungen entries, fetch mitbewerber
    for (const row of raw) {
      if (row.quelle === 'anmeldung') {
        const mStmt = db.prepare(`
          SELECT l.kuerzel FROM anmeldungen a
          JOIN lehrer l ON l.id = a.lehrer_id
          WHERE a.unterricht_id = ? AND a.lehrer_id != ?
        `);
        mStmt.bind([row.unterricht_id, lehrer_id]);
        const mitbewerber: string[] = [];
        while (mStmt.step()) {
          mitbewerber.push((mStmt.getAsObject() as any).kuerzel);
        }
        mStmt.free();
        row.mitbewerber = mitbewerber;
        row.mehrfach = mitbewerber.length > 0;
      } else {
        row.mitbewerber = [];
        row.mehrfach = false;
      }
    }

    // Group kopplung=1 entries: same fach_id + typ + jahrgangsstufe → one row with klassen[]
    const results: any[] = [];
    const koppSeenKey = new Set<string>();
    for (const row of raw) {
      if (row.kopplung === 1) {
        const key = `${row.fach_id}|${row.typ}|${row.jahrgangsstufe}|${row.quelle}`;
        if (koppSeenKey.has(key)) continue;
        koppSeenKey.add(key);
        // collect all klassen for this kopplung group
        const gruppe = raw.filter(r =>
          r.kopplung === 1 &&
          r.fach_id === row.fach_id &&
          r.typ === row.typ &&
          r.jahrgangsstufe === row.jahrgangsstufe &&
          r.quelle === row.quelle
        );
        results.push({
          ...row,
          klasse: gruppe.map((r: any) => r.klasse).join(', '),
          klassen: gruppe.map((r: any) => r.klasse),
          unterricht_ids: gruppe.map((r: any) => r.unterricht_id),
          kopplung: 1,
        });
      } else {
        results.push({ ...row, klassen: [row.klasse] });
      }
    }

    res.json(results);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/meine-anmeldungen
app.get('/api/meine-anmeldungen', authRequired, (req, res) => {
  try {
    const lehrer_id = req.user!.id;
    const stmt = db.prepare(`
      SELECT a.id as anmeldung_id, a.unterricht_id,
             k.name as klasse, f.kuerzel as fach,
             u.wochenstunden, u.jahresstunden, u.hinweis
      FROM anmeldungen a
      JOIN unterricht u ON u.id = a.unterricht_id
      JOIN klassen k ON k.id = u.klasse_id
      JOIN faecher f ON f.id = u.fach_id
      WHERE a.lehrer_id = ?
      ORDER BY k.name, f.kuerzel
    `);
    stmt.bind([lehrer_id]);
    const results: any[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();

    // For each, check mitbewerber
    for (const row of results) {
      const mStmt = db.prepare(`
        SELECT l.kuerzel FROM anmeldungen a
        JOIN lehrer l ON l.id = a.lehrer_id
        WHERE a.unterricht_id = ? AND a.lehrer_id != ?
      `);
      mStmt.bind([row.unterricht_id, lehrer_id]);
      const mitbewerber: string[] = [];
      while (mStmt.step()) {
        const r = mStmt.getAsObject() as any;
        mitbewerber.push(r.kuerzel);
      }
      mStmt.free();
      row.mitbewerber = mitbewerber;
      row.mehrfach = mitbewerber.length > 0;
    }

    res.json(results);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/admin/lehrer
app.get('/api/admin/lehrer', adminRequired, (_req, res) => {
  try {
    const stmt = db.prepare('SELECT id, kuerzel, vorname, nachname, deputat, password, is_admin FROM lehrer ORDER BY kuerzel');
    const results: any[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    res.json(results);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/lehrer
app.post('/api/admin/lehrer', adminRequired, (req, res) => {
  try {
    const { kuerzel, vorname = '', nachname = '', deputat = 25.5, password = 'stupla' } = req.body;
    if (!kuerzel) return res.status(400).json({ error: 'kuerzel required' });
    db.run('INSERT INTO lehrer (kuerzel, vorname, nachname, deputat, password) VALUES (?, ?, ?, ?, ?)', [kuerzel, vorname, nachname, deputat, password]);
    deputatOverrides.set(0, deputat); // will be overwritten below
    persistDb();
    const idStmt = db.prepare('SELECT last_insert_rowid() as id');
    idStmt.step();
    const { id } = idStmt.getAsObject() as any;
    idStmt.free();
    deputatOverrides.set(id as number, deputat);
    res.status(201).json({ id, kuerzel, vorname, nachname, deputat, password, is_admin: 0 });
  } catch (e: any) {
    if (e.message && e.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Kürzel bereits vergeben' });
    }
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/admin/lehrer/:id
app.put('/api/admin/lehrer/:id', adminRequired, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { kuerzel, vorname, nachname, deputat, password, is_admin } = req.body;
    const fields: string[] = [];
    const values: any[] = [];
    if (kuerzel !== undefined)   { fields.push('kuerzel = ?');   values.push(kuerzel); }
    if (vorname !== undefined)   { fields.push('vorname = ?');   values.push(vorname); }
    if (nachname !== undefined)  { fields.push('nachname = ?');  values.push(nachname); }
    if (deputat !== undefined)   { fields.push('deputat = ?');   values.push(deputat); }
    if (password !== undefined)  { fields.push('password = ?');  values.push(password); }
    if (is_admin !== undefined)  { fields.push('is_admin = ?');  values.push(is_admin); }
    if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    values.push(id);
    db.run(`UPDATE lehrer SET ${fields.join(', ')} WHERE id = ?`, values);
    if (deputat !== undefined) deputatOverrides.set(id, deputat);
    persistDb();
    const lStmt = db.prepare('SELECT id, kuerzel, vorname, nachname, deputat, password, is_admin FROM lehrer WHERE id = ?');
    lStmt.bind([id]);
    lStmt.step();
    const updated = lStmt.getAsObject();
    lStmt.free();
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/admin/lehrer/:id
app.delete('/api/admin/lehrer/:id', adminRequired, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const lStmt = db.prepare('SELECT kuerzel, is_admin FROM lehrer WHERE id = ?');
    lStmt.bind([id]);
    if (!lStmt.step()) {
      lStmt.free();
      return res.status(404).json({ error: 'Not found' });
    }
    const row = lStmt.getAsObject() as any;
    lStmt.free();

    if (row.kuerzel === 'ADMIN' || row.is_admin === 1) {
      return res.status(400).json({ error: 'Admin-Benutzer können nicht gelöscht werden' });
    }

    // Check for unterricht assignments
    const uStmt = db.prepare('SELECT COUNT(*) as cnt FROM unterricht WHERE lehrer_id = ?');
    uStmt.bind([id]);
    uStmt.step();
    const { cnt } = uStmt.getAsObject() as any;
    uStmt.free();
    if (cnt > 0) {
      return res.status(400).json({ error: 'Lehrer hat Unterrichtseinheiten und kann nicht gelöscht werden' });
    }

    db.run('DELETE FROM anmeldungen WHERE lehrer_id = ?', [id]);
    db.run('DELETE FROM lehrer WHERE id = ?', [id]);
    deputatOverrides.delete(id);
    persistDb();
    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/admin/anmeldungen
app.get('/api/admin/anmeldungen', adminRequired, (_req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT a.id, a.unterricht_id, a.lehrer_id, a.created_at,
             l.kuerzel as lehrer_kuerzel,
             k.name as klasse, f.kuerzel as fach,
             u.wochenstunden, u.jahresstunden
      FROM anmeldungen a
      JOIN lehrer l ON l.id = a.lehrer_id
      JOIN unterricht u ON u.id = a.unterricht_id
      JOIN klassen k ON k.id = u.klasse_id
      JOIN faecher f ON f.id = u.fach_id
      ORDER BY a.created_at DESC
    `);
    const results: any[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    res.json(results);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/admin/anmeldungen/:id
app.delete('/api/admin/anmeldungen/:id', adminRequired, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    db.run('DELETE FROM anmeldungen WHERE id = ?', [id]);
    persistDb();
    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/admin/unterricht/:id/lehrer — direkte Zuweisung / Entfernung
app.put('/api/admin/unterricht/:id/lehrer', adminRequired, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { lehrer_id } = req.body; // null = entfernen

    // Verify unterricht exists
    const uStmt = db.prepare('SELECT id FROM unterricht WHERE id = ?');
    uStmt.bind([id]);
    if (!uStmt.step()) { uStmt.free(); return res.status(404).json({ error: 'Nicht gefunden' }); }
    uStmt.free();

    if (lehrer_id !== null && lehrer_id !== undefined) {
      // Verify lehrer exists
      const lStmt = db.prepare('SELECT id FROM lehrer WHERE id = ? AND is_admin = 0');
      lStmt.bind([lehrer_id]);
      if (!lStmt.step()) { lStmt.free(); return res.status(400).json({ error: 'Lehrer nicht gefunden' }); }
      lStmt.free();
      db.run('UPDATE unterricht SET lehrer_id = ? WHERE id = ?', [lehrer_id, id]);
      // Remove anmeldungen for this slot (definitive assignment supersedes sign-ups)
      db.run('DELETE FROM anmeldungen WHERE unterricht_id = ?', [id]);
    } else {
      db.run('UPDATE unterricht SET lehrer_id = NULL WHERE id = ?', [id]);
    }
    persistDb();
    res.json({ unterricht_id: id, lehrer_id: lehrer_id ?? null });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/admin/auswertung — Statistiken für Admin
app.get('/api/admin/auswertung', adminRequired, (_req, res) => {
  try {
    // Overall stats
    const totalStmt = db.prepare(`
      SELECT
        COALESCE(SUM(jahresstunden), 0) as total,
        COALESCE(SUM(CASE WHEN lehrer_id IS NOT NULL THEN jahresstunden ELSE 0 END), 0) as besetzt,
        COALESCE(SUM(CASE WHEN lehrer_id IS NULL AND jahresstunden IS NOT NULL
          AND (SELECT COUNT(*) FROM anmeldungen a WHERE a.unterricht_id = unterricht.id) > 0
          THEN jahresstunden ELSE 0 END), 0) as angemeldet,
        COALESCE(SUM(CASE WHEN lehrer_id IS NULL AND jahresstunden IS NOT NULL
          AND (SELECT COUNT(*) FROM anmeldungen a WHERE a.unterricht_id = unterricht.id) = 0
          THEN jahresstunden ELSE 0 END), 0) as offen
      FROM unterricht
    `);
    totalStmt.step();
    const gesamt = totalStmt.getAsObject() as any;
    totalStmt.free();

    // Per Bereich
    const bereichStmt = db.prepare(`
      SELECT k.typ,
        COALESCE(SUM(u.jahresstunden), 0) as total,
        COALESCE(SUM(CASE WHEN u.lehrer_id IS NOT NULL THEN u.jahresstunden ELSE 0 END), 0) as besetzt,
        COALESCE(SUM(CASE WHEN u.lehrer_id IS NULL AND u.jahresstunden IS NOT NULL
          AND (SELECT COUNT(*) FROM anmeldungen a WHERE a.unterricht_id = u.id) > 0
          THEN u.jahresstunden ELSE 0 END), 0) as angemeldet,
        COALESCE(SUM(CASE WHEN u.lehrer_id IS NULL AND u.jahresstunden IS NOT NULL
          AND (SELECT COUNT(*) FROM anmeldungen a WHERE a.unterricht_id = u.id) = 0
          THEN u.jahresstunden ELSE 0 END), 0) as offen,
        COUNT(DISTINCT u.klasse_id) as klassen_count
      FROM unterricht u
      JOIN klassen k ON k.id = u.klasse_id
      GROUP BY k.typ
      ORDER BY k.typ
    `);
    const bereiche: any[] = [];
    while (bereichStmt.step()) bereiche.push(bereichStmt.getAsObject());
    bereichStmt.free();

    // Lehrer ranking (wert incl. anmeldungen, vs. deputat)
    const lehrerStmt = db.prepare(`
      SELECT l.id, l.kuerzel,
        COALESCE((SELECT SUM(u.jahresstunden) FROM unterricht u WHERE u.lehrer_id = l.id), 0) +
        COALESCE((SELECT SUM(u.jahresstunden) FROM anmeldungen a JOIN unterricht u ON u.id = a.unterricht_id WHERE a.lehrer_id = l.id), 0) as wert
      FROM lehrer l
      WHERE l.is_admin = 0
      ORDER BY wert ASC
    `);
    const lehrerList: any[] = [];
    while (lehrerStmt.step()) {
      const row = lehrerStmt.getAsObject() as any;
      const deputat = getDeputat(row.id as number);
      lehrerList.push({ ...row, deputat, diff: deputat - (row.wert as number) });
    }
    lehrerStmt.free();

    res.json({ gesamt, bereiche, lehrer: lehrerList });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin Klassen CRUD ──────────────────────────────────────────────────────

app.get('/api/admin/klassen', adminRequired, (_req, res) => {
  try {
    const stmt = db.prepare('SELECT id, name, typ, jahrgangsstufe FROM klassen ORDER BY typ, name');
    const rows: any[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/klassen', adminRequired, (req, res) => {
  try {
    const { name, typ, jahrgangsstufe } = req.body;
    if (!name || !typ) return res.status(400).json({ error: 'name und typ erforderlich' });
    db.run('INSERT INTO klassen (name, typ, jahrgangsstufe) VALUES (?, ?, ?)', [name, typ, jahrgangsstufe ?? '']);
    const idStmt = db.prepare('SELECT last_insert_rowid() as id');
    idStmt.step();
    const { id } = idStmt.getAsObject() as any;
    idStmt.free();
    persistDb();
    res.status(201).json({ id, name, typ, jahrgangsstufe: jahrgangsstufe ?? '' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/admin/klassen/:id', adminRequired, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, typ, jahrgangsstufe } = req.body;
    const chk = db.prepare('SELECT id, name, typ, jahrgangsstufe FROM klassen WHERE id = ?');
    chk.bind([id]);
    if (!chk.step()) { chk.free(); return res.status(404).json({ error: 'Nicht gefunden' }); }
    const existing = chk.getAsObject() as any;
    chk.free();
    const newName = name ?? existing.name;
    const newTyp = typ ?? existing.typ;
    const newJg = jahrgangsstufe !== undefined ? jahrgangsstufe : existing.jahrgangsstufe;
    db.run('UPDATE klassen SET name = ?, typ = ?, jahrgangsstufe = ? WHERE id = ?', [newName, newTyp, newJg, id]);
    persistDb();
    res.json({ id, name: newName, typ: newTyp, jahrgangsstufe: newJg });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/admin/klassen/:id', adminRequired, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const chk = db.prepare('SELECT id FROM klassen WHERE id = ?');
    chk.bind([id]);
    if (!chk.step()) { chk.free(); return res.status(404).json({ error: 'Nicht gefunden' }); }
    chk.free();
    // Delete anmeldungen for unterricht of this class
    db.run('DELETE FROM anmeldungen WHERE unterricht_id IN (SELECT id FROM unterricht WHERE klasse_id = ?)', [id]);
    db.run('DELETE FROM unterricht WHERE klasse_id = ?', [id]);
    db.run('DELETE FROM klassen WHERE id = ?', [id]);
    persistDb();
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin Fächer CRUD ────────────────────────────────────────────────────────

app.get('/api/admin/faecher', adminRequired, (_req, res) => {
  try {
    const stmt = db.prepare('SELECT id, kuerzel, COALESCE(bezeichnung, \'\') as bezeichnung FROM faecher ORDER BY kuerzel');
    const rows: any[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/faecher', adminRequired, (req, res) => {
  try {
    const { kuerzel, bezeichnung } = req.body;
    if (!kuerzel) return res.status(400).json({ error: 'kuerzel erforderlich' });
    db.run('INSERT INTO faecher (kuerzel, bezeichnung) VALUES (?, ?)', [kuerzel, bezeichnung ?? '']);
    const idStmt = db.prepare('SELECT last_insert_rowid() as id');
    idStmt.step();
    const { id } = idStmt.getAsObject() as any;
    idStmt.free();
    persistDb();
    res.status(201).json({ id, kuerzel, bezeichnung: bezeichnung ?? '' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/admin/faecher/:id', adminRequired, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { kuerzel, bezeichnung } = req.body;
    if (!kuerzel) return res.status(400).json({ error: 'kuerzel erforderlich' });
    const chk = db.prepare('SELECT id FROM faecher WHERE id = ?');
    chk.bind([id]);
    if (!chk.step()) { chk.free(); return res.status(404).json({ error: 'Nicht gefunden' }); }
    chk.free();
    db.run('UPDATE faecher SET kuerzel = ?, bezeichnung = ? WHERE id = ?', [kuerzel, bezeichnung ?? '', id]);
    persistDb();
    res.json({ id, kuerzel, bezeichnung: bezeichnung ?? '' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/admin/faecher/:id', adminRequired, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const chk = db.prepare('SELECT id FROM faecher WHERE id = ?');
    chk.bind([id]);
    if (!chk.step()) { chk.free(); return res.status(404).json({ error: 'Nicht gefunden' }); }
    chk.free();
    const inUse = db.prepare('SELECT COUNT(*) as cnt FROM unterricht WHERE fach_id = ?');
    inUse.bind([id]);
    inUse.step();
    const { cnt } = inUse.getAsObject() as any;
    inUse.free();
    if ((cnt as number) > 0) return res.status(409).json({ error: 'Fach wird noch in Unterricht verwendet' });
    db.run('DELETE FROM faecher WHERE id = ?', [id]);
    persistDb();
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin Unterricht CRUD ────────────────────────────────────────────────────

app.get('/api/admin/klassen/:id/unterricht', adminRequired, (req, res) => {
  try {
    const klasse_id = parseInt(req.params.id);
    const stmt = db.prepare(`
      SELECT u.id, u.klasse_id, u.fach_id, f.kuerzel as fach,
             u.wochenstunden, u.jahresstunden, u.hinweis, u.kopplung,
             u.lehrer_id, l.kuerzel as lehrer_kuerzel
      FROM unterricht u
      JOIN faecher f ON f.id = u.fach_id
      LEFT JOIN lehrer l ON l.id = u.lehrer_id
      WHERE u.klasse_id = ?
      ORDER BY f.kuerzel
    `);
    stmt.bind([klasse_id]);
    const rows: any[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/unterricht', adminRequired, (req, res) => {
  try {
    const { klasse_id, fach_id, wochenstunden, jahresstunden, hinweis, kopplung, lehrer_id } = req.body;
    if (!klasse_id || !fach_id) return res.status(400).json({ error: 'klasse_id und fach_id erforderlich' });
    db.run(
      'INSERT INTO unterricht (klasse_id, fach_id, wochenstunden, jahresstunden, hinweis, kopplung, lehrer_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [klasse_id, fach_id, wochenstunden ?? null, jahresstunden ?? null, hinweis ?? null, kopplung ?? 0, lehrer_id ?? null]
    );
    const idStmt = db.prepare('SELECT last_insert_rowid() as id');
    idStmt.step();
    const { id } = idStmt.getAsObject() as any;
    idStmt.free();
    persistDb();
    // Return with joined data
    const rowStmt = db.prepare(`
      SELECT u.id, u.klasse_id, u.fach_id, f.kuerzel as fach,
             u.wochenstunden, u.jahresstunden, u.hinweis, u.kopplung,
             u.lehrer_id, l.kuerzel as lehrer_kuerzel
      FROM unterricht u
      JOIN faecher f ON f.id = u.fach_id
      LEFT JOIN lehrer l ON l.id = u.lehrer_id
      WHERE u.id = ?
    `);
    rowStmt.bind([id]);
    rowStmt.step();
    const row = rowStmt.getAsObject();
    rowStmt.free();
    res.status(201).json(row);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/admin/unterricht/:id', adminRequired, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const rowChk = db.prepare('SELECT id, klasse_id, fach_id, kopplung FROM unterricht WHERE id = ?');
    rowChk.bind([id]);
    if (!rowChk.step()) { rowChk.free(); return res.status(404).json({ error: 'Nicht gefunden' }); }
    const existing = rowChk.getAsObject() as any;
    rowChk.free();
    const body = req.body;
    const fields: string[] = [];
    const params: any[] = [];
    if ('fach_id' in body)       { fields.push('fach_id = ?');       params.push(body.fach_id); }
    if ('wochenstunden' in body)  { fields.push('wochenstunden = ?'); params.push(body.wochenstunden ?? null); }
    if ('jahresstunden' in body)  { fields.push('jahresstunden = ?'); params.push(body.jahresstunden ?? null); }
    if ('hinweis' in body)        { fields.push('hinweis = ?');       params.push(body.hinweis ?? null); }
    if ('kopplung' in body)       { fields.push('kopplung = ?');      params.push(body.kopplung ?? 0); }
    if ('lehrer_id' in body)      { fields.push('lehrer_id = ?');     params.push(body.lehrer_id ?? null); }
    if (fields.length > 0) {
      params.push(id);
      db.run(`UPDATE unterricht SET ${fields.join(', ')} WHERE id = ?`, params);
    }
    // If this entry is now kopplung=1, remove any non-kopplung duplicate for same klasse+fach
    const newKopplung = 'kopplung' in body ? (body.kopplung ?? 0) : existing.kopplung;
    const newFachId   = 'fach_id' in body ? body.fach_id : existing.fach_id;
    if (newKopplung === 1) {
      const dupStmt = db.prepare(
        'SELECT id FROM unterricht WHERE id != ? AND klasse_id = ? AND fach_id = ? AND kopplung = 0'
      );
      dupStmt.bind([id, existing.klasse_id, newFachId]);
      const dupIds: number[] = [];
      while (dupStmt.step()) dupIds.push((dupStmt.getAsObject() as any).id as number);
      dupStmt.free();
      for (const dupId of dupIds) {
        db.run('DELETE FROM anmeldungen WHERE unterricht_id = ?', [dupId]);
        db.run('DELETE FROM unterricht WHERE id = ?', [dupId]);
      }
    }
    persistDb();
    const rowStmt = db.prepare(`
      SELECT u.id, u.klasse_id, u.fach_id, f.kuerzel as fach,
             u.wochenstunden, u.jahresstunden, u.hinweis, u.kopplung,
             u.lehrer_id, l.kuerzel as lehrer_kuerzel
      FROM unterricht u
      JOIN faecher f ON f.id = u.fach_id
      LEFT JOIN lehrer l ON l.id = u.lehrer_id
      WHERE u.id = ?
    `);
    rowStmt.bind([id]);
    rowStmt.step();
    const row = rowStmt.getAsObject();
    rowStmt.free();
    res.json(row);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/admin/unterricht/:id', adminRequired, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const chk = db.prepare('SELECT id FROM unterricht WHERE id = ?');
    chk.bind([id]);
    if (!chk.step()) { chk.free(); return res.status(404).json({ error: 'Nicht gefunden' }); }
    chk.free();
    db.run('DELETE FROM anmeldungen WHERE unterricht_id = ?', [id]);
    db.run('DELETE FROM unterricht WHERE id = ?', [id]);
    persistDb();
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin Kopplungen ─────────────────────────────────────────────────────────

app.get('/api/admin/kopplungen', adminRequired, (_req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT u.id, u.fach_id, f.kuerzel as fach, COALESCE(f.bezeichnung,'') as bezeichnung,
             k.id as klasse_id, k.name as klasse, k.typ, k.jahrgangsstufe,
             u.wochenstunden, u.jahresstunden, u.lehrer_id, l.kuerzel as lehrer_kuerzel
      FROM unterricht u
      JOIN klassen k ON k.id = u.klasse_id
      JOIN faecher f ON f.id = u.fach_id
      LEFT JOIN lehrer l ON l.id = u.lehrer_id
      WHERE u.kopplung = 1
      ORDER BY k.typ, k.jahrgangsstufe, f.kuerzel, k.name
    `);
    const rows: any[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/admin/kopplungen/lehrer', adminRequired, (req, res) => {
  try {
    const { fach_id, typ, jahrgangsstufe, lehrer_id } = req.body;
    db.run(
      `UPDATE unterricht SET lehrer_id = ?
       WHERE kopplung = 1 AND fach_id = ?
       AND klasse_id IN (SELECT id FROM klassen WHERE typ = ? AND jahrgangsstufe = ?)`,
      [lehrer_id ?? null, fach_id, typ, jahrgangsstufe]
    );
    persistDb();
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/admin/kopplungen/stunden', adminRequired, (req, res) => {
  try {
    const { fach_id, typ, jahrgangsstufe, wochenstunden, jahresstunden } = req.body;
    db.run(
      `UPDATE unterricht SET wochenstunden = ?, jahresstunden = ?
       WHERE kopplung = 1 AND fach_id = ?
       AND klasse_id IN (SELECT id FROM klassen WHERE typ = ? AND jahrgangsstufe = ?)`,
      [wochenstunden ?? null, jahresstunden ?? null, fach_id, typ, jahrgangsstufe]
    );
    persistDb();
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Create new kopplung group: inserts or converts one unterricht per klasse_id
app.post('/api/admin/kopplungen', adminRequired, (req, res) => {
  try {
    const { fach_id, klassen_ids, wochenstunden, jahresstunden, lehrer_id } = req.body;
    if (!fach_id || !Array.isArray(klassen_ids) || klassen_ids.length === 0)
      return res.status(400).json({ error: 'fach_id und klassen_ids erforderlich' });
    for (const klasse_id of klassen_ids) {
      // Check if kopplung entry already exists → skip
      const kopp = db.prepare('SELECT id FROM unterricht WHERE kopplung=1 AND fach_id=? AND klasse_id=?');
      kopp.bind([fach_id, klasse_id]);
      const koppExists = kopp.step();
      kopp.free();
      if (koppExists) continue;

      // Check if normal (non-kopplung) entry exists → convert it
      const norm = db.prepare('SELECT id FROM unterricht WHERE kopplung=0 AND fach_id=? AND klasse_id=?');
      norm.bind([fach_id, klasse_id]);
      const normExists = norm.step();
      const normRow = normExists ? (norm.getAsObject() as any) : null;
      norm.free();

      if (normRow) {
        // Convert existing entry to kopplung=1, update hours/lehrer
        db.run(
          'UPDATE unterricht SET kopplung=1, wochenstunden=?, jahresstunden=?, lehrer_id=? WHERE id=?',
          [wochenstunden ?? null, jahresstunden ?? null, lehrer_id ?? null, normRow.id]
        );
      } else {
        db.run(
          'INSERT INTO unterricht (klasse_id, fach_id, wochenstunden, jahresstunden, hinweis, kopplung, lehrer_id) VALUES (?,?,?,?,NULL,1,?)',
          [klasse_id, fach_id, wochenstunden ?? null, jahresstunden ?? null, lehrer_id ?? null]
        );
      }
    }
    persistDb();
    res.status(201).json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Delete entire kopplung group
app.delete('/api/admin/kopplungen', adminRequired, (req, res) => {
  try {
    const { fach_id, typ, jahrgangsstufe } = req.body;
    const idsStmt = db.prepare(
      'SELECT id FROM unterricht WHERE kopplung=1 AND fach_id=? AND klasse_id IN (SELECT id FROM klassen WHERE typ=? AND jahrgangsstufe=?)'
    );
    idsStmt.bind([fach_id, typ, jahrgangsstufe]);
    const ids: number[] = [];
    while (idsStmt.step()) ids.push((idsStmt.getAsObject() as any).id as number);
    idsStmt.free();
    for (const id of ids) {
      db.run('DELETE FROM anmeldungen WHERE unterricht_id = ?', [id]);
      db.run('DELETE FROM unterricht WHERE id = ?', [id]);
    }
    persistDb();
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

loadDb().then(() => {
  app.listen(3002, () => {
    console.log('Server running on port 3002');
  });
}).catch(console.error);
