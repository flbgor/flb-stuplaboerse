import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import initSqlJs from 'sql.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Load DB once at startup
let db: any;
(async () => {
  const SQL = await initSqlJs();
  const dbPath = path.resolve(__dirname, '../../stundenplan.db');
  const fileBuffer = fs.readFileSync(dbPath);
  db = new SQL.Database(fileBuffer);

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
})();

function query(sql: string, params: any[] = []): any[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: any[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function queryOne(sql: string, params: any[] = []): any | null {
  const rows = query(sql, params);
  return rows[0] ?? null;
}

// GET /api/klassen
app.get('/api/klassen', (_req, res) => {
  const rows = query(`
    SELECT id, name, typ, jahrgangsstufe
    FROM klassen ORDER BY typ, name
  `);
  res.json(rows);
});

// GET /api/klassen/:id
app.get('/api/klassen/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const klasse = queryOne(
    'SELECT id, name, typ, jahrgangsstufe FROM klassen WHERE id = ?', [id]
  );
  if (!klasse) return res.status(404).json({ error: 'Not found' });

  const soll = query(`
    SELECT f.kuerzel, s.stunden, s.hinweis
    FROM soll s JOIN faecher f ON s.fach_id = f.id
    WHERE s.klasse_id = ? ORDER BY f.kuerzel
  `, [id]);

  const ist = query(`
    SELECT f.kuerzel, i.stunden, l.kuerzel as lehrer
    FROM ist i
    JOIN faecher f ON i.fach_id = f.id
    LEFT JOIN lehrer l ON i.lehrer_id = l.id
    WHERE i.klasse_id = ? ORDER BY f.kuerzel
  `, [id]);

  res.json({ ...klasse, soll, ist });
});

// GET /api/lehrer
app.get('/api/lehrer', (_req, res) => {
  const lehrer = query(`
    SELECT l.id, l.kuerzel, COALESCE(SUM(i.stunden), 0) as gesamtstunden
    FROM lehrer l LEFT JOIN ist i ON l.id = i.lehrer_id
    GROUP BY l.id, l.kuerzel ORDER BY gesamtstunden DESC
  `);

  const result = lehrer.map(l => {
    const klassen = query(`
      SELECT DISTINCT k.name FROM ist i
      JOIN klassen k ON i.klasse_id = k.id
      WHERE i.lehrer_id = ? ORDER BY k.name
    `, [l.id]).map((k: any) => k.name);
    return { ...l, klassen };
  });

  res.json(result);
});

// GET /api/offene-stunden
app.get('/api/offene-stunden', (_req, res) => {
  const rows = query(`
    SELECT k.name as klasse, k.typ, f.kuerzel as fach, i.stunden
    FROM ist i
    JOIN klassen k ON i.klasse_id = k.id
    JOIN faecher f ON i.fach_id = f.id
    WHERE i.lehrer_id IS NULL
    ORDER BY k.name, f.kuerzel
  `);
  res.json(rows);
});

// Serve Vite build
const clientDist = path.resolve(__dirname, '../client/dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});
