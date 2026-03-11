import express from "express";
import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Flag to ensure DB init runs once per function instance
let dbInitialized = false;

async function initDb() {
  if (dbInitialized) return;

  if (!DATABASE_URL) {
    console.error("ERRO: DATABASE_URL não configurada no ambiente.");
    return;
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS authors (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        pix_key TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS books (
        id BIGSERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        isbn TEXT,
        author_id BIGINT NOT NULL REFERENCES authors(id) ON DELETE RESTRICT,
        cover_price NUMERIC(12,2) NOT NULL,
        repasse_type TEXT NOT NULL CHECK (repasse_type IN ('fixed', 'percent')),
        repasse_value NUMERIC(12,2) NOT NULL,
        category TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS consignments (
        id BIGSERIAL PRIMARY KEY,
        book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
        quantity INT NOT NULL CHECK (quantity >= 0),
        entry_date DATE NOT NULL,
        responsible TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS settlements (
        id BIGSERIAL PRIMARY KEY,
        author_id BIGINT NOT NULL REFERENCES authors(id) ON DELETE RESTRICT,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        total_units INT NOT NULL DEFAULT 0,
        total_gross NUMERIC(12,2) NOT NULL DEFAULT 0,
        total_repasse NUMERIC(12,2) NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid')),
        payment_date DATE,
        payment_method TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sales (
        id BIGSERIAL PRIMARY KEY,
        book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
        quantity INT NOT NULL CHECK (quantity > 0),
        sale_price NUMERIC(12,2) NOT NULL CHECK (sale_price >= 0),
        sale_date DATE NOT NULL,
        channel TEXT NOT NULL DEFAULT 'loja',
        responsible TEXT,
        reference TEXT,
        notes TEXT,
        settlement_id BIGINT REFERENCES settlements(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS returns (
        id BIGSERIAL PRIMARY KEY,
        book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
        quantity INT NOT NULL CHECK (quantity > 0),
        return_date DATE NOT NULL,
        reason TEXT,
        responsible TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS general_sales (
        id BIGSERIAL PRIMARY KEY,
        amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
        sale_date DATE NOT NULL,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_books_author_id ON books(author_id);
      CREATE INDEX IF NOT EXISTS idx_sales_book_id ON sales(book_id);
      CREATE INDEX IF NOT EXISTS idx_sales_settlement_id ON sales(settlement_id);
      CREATE INDEX IF NOT EXISTS idx_consignments_book_id ON consignments(book_id);
      CREATE INDEX IF NOT EXISTS idx_returns_book_id ON returns(book_id);
    `);
    dbInitialized = true;
    console.log("Banco de dados inicializado com sucesso.");
  } catch (err) {
    console.error("Erro ao inicializar banco de dados:", err);
    throw err;
  }
}

function asDateOnly(input: any): string {
  if (!input) return new Date().toISOString().slice(0, 10);
  const s = String(input);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Initialize DB middleware
app.use(async (_req, _res, next) => {
  if (!DATABASE_URL) {
    return _res.status(500).json({ error: "DATABASE_URL não configurada no Netlify." });
  }
  try {
    await initDb();
    next();
  } catch (err: any) {
    _res.status(500).json({ error: "Erro ao conectar ao banco de dados: " + (err.message || err) });
  }
});

// ---------- AUTHORS ----------
app.get("/api/authors", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM authors ORDER BY name");
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/authors", async (req, res) => {
  try {
    const { name, phone, email, pix_key, notes } = req.body ?? {};
    if (!name) return res.status(400).json({ error: "Nome é obrigatório" });

    const { rows } = await pool.query(
      `INSERT INTO authors (name, phone, email, pix_key, notes)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [name, phone ?? null, email ?? null, pix_key ?? null, notes ?? null]
    );
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/authors/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, phone, email, pix_key, notes } = req.body ?? {};
    if (!id) return res.status(400).json({ error: "ID inválido" });

    const { rows } = await pool.query(
      `UPDATE authors
         SET name=$1, phone=$2, email=$3, pix_key=$4, notes=$5
       WHERE id=$6
       RETURNING *`,
      [name, phone ?? null, email ?? null, pix_key ?? null, notes ?? null, id]
    );
    res.json(rows[0] ?? null);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/authors/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    await pool.query("DELETE FROM authors WHERE id=$1", [id]);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/authors/bulk", async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : req.body?.items;
  if (!Array.isArray(items)) return res.status(400).json({ error: "Envie um array em body (ou {items:[]})" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const it of items) {
      if (!it?.name) continue;
      await client.query(
        `INSERT INTO authors (name, phone, email, pix_key, notes)
         VALUES ($1,$2,$3,$4,$5)`,
        [it.name, it.phone ?? null, it.email ?? null, it.pix_key ?? null, it.notes ?? null]
      );
    }
    await client.query("COMMIT");
    res.json({ success: true, inserted: items.length });
  } catch (e: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ---------- BOOKS ----------
app.get("/api/books", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT b.*, a.name AS author_name
      FROM books b
      JOIN authors a ON a.id = b.author_id
      ORDER BY b.title
    `);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/books", async (req, res) => {
  try {
    const { title, isbn, author_id, cover_price, repasse_type, repasse_value, category, notes } = req.body ?? {};
    if (!title || !author_id) return res.status(400).json({ error: "Título e autor são obrigatórios" });

    const { rows } = await pool.query(
      `INSERT INTO books (title, isbn, author_id, cover_price, repasse_type, repasse_value, category, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        title,
        isbn ?? null,
        Number(author_id),
        Number(cover_price ?? 0),
        repasse_type,
        Number(repasse_value ?? 0),
        category ?? null,
        notes ?? null,
      ]
    );
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/books/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { title, isbn, author_id, cover_price, repasse_type, repasse_value, category, notes } = req.body ?? {};
    if (!id) return res.status(400).json({ error: "ID inválido" });

    const { rows } = await pool.query(
      `UPDATE books
         SET title=$1, isbn=$2, author_id=$3, cover_price=$4, repasse_type=$5, repasse_value=$6, category=$7, notes=$8
       WHERE id=$9
       RETURNING *`,
      [
        title,
        isbn ?? null,
        Number(author_id),
        Number(cover_price ?? 0),
        repasse_type,
        Number(repasse_value ?? 0),
        category ?? null,
        notes ?? null,
        id,
      ]
    );
    res.json(rows[0] ?? null);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/books/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    await pool.query("DELETE FROM books WHERE id=$1", [id]);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/books/bulk", async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : req.body?.items;
  if (!Array.isArray(items)) return res.status(400).json({ error: "Envie um array em body (ou {items:[]})" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const it of items) {
      if (!it?.title || !it?.author_id) continue;
      await client.query(
        `INSERT INTO books (title, isbn, author_id, cover_price, repasse_type, repasse_value, category, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          it.title,
          it.isbn ?? null,
          Number(it.author_id),
          Number(it.cover_price ?? 0),
          it.repasse_type ?? "fixed",
          Number(it.repasse_value ?? 0),
          it.category ?? null,
          it.notes ?? null,
        ]
      );
    }
    await client.query("COMMIT");
    res.json({ success: true, inserted: items.length });
  } catch (e: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ---------- INVENTORY ----------
app.get("/api/inventory", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        b.id,
        b.title,
        b.isbn,
        b.cover_price,
        b.repasse_type,
        b.repasse_value,
        b.category,
        a.id AS author_id,
        a.name AS author_name,
        COALESCE((SELECT SUM(c.quantity) FROM consignments c WHERE c.book_id=b.id),0) AS received,
        COALESCE((SELECT SUM(s.quantity) FROM sales s WHERE s.book_id=b.id),0) AS sold,
        COALESCE((SELECT SUM(r.quantity) FROM returns r WHERE r.book_id=b.id),0) AS returned,
        (COALESCE((SELECT SUM(c.quantity) FROM consignments c WHERE c.book_id=b.id),0)
         - COALESCE((SELECT SUM(s.quantity) FROM sales s WHERE s.book_id=b.id),0)
         - COALESCE((SELECT SUM(r.quantity) FROM returns r WHERE r.book_id=b.id),0)
        ) AS stock
      FROM books b
      JOIN authors a ON a.id=b.author_id
      ORDER BY a.name, b.title
    `);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- CONSIGNMENTS (ENTRADAS) ----------
app.post("/api/consignments", async (req, res) => {
  try {
    const { book_id, quantity, entry_date, date, notes, responsible } = req.body ?? {};
    if (!book_id || !quantity) return res.status(400).json({ error: "book_id e quantity são obrigatórios" });

    const { rows } = await pool.query(
      `INSERT INTO consignments (book_id, quantity, entry_date, responsible, notes)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [Number(book_id), Number(quantity), asDateOnly(entry_date || date), responsible ?? null, notes ?? null]
    );
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/consignments", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*, b.title, a.name AS author_name
      FROM consignments c
      JOIN books b ON b.id=c.book_id
      JOIN authors a ON a.id=b.author_id
      ORDER BY c.entry_date DESC, c.id DESC
    `);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- SALES ----------
app.post("/api/sales", async (req, res) => {
  try {
    const { book_id, quantity, sale_price, price, sale_date, date, channel, responsible, reference, notes } = req.body ?? {};
    if (!book_id || !quantity) return res.status(400).json({ error: "book_id e quantity são obrigatórios" });

    const { rows } = await pool.query(
      `INSERT INTO sales (book_id, quantity, sale_price, sale_date, channel, responsible, reference, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        Number(book_id),
        Number(quantity),
        Number(sale_price ?? price ?? 0),
        asDateOnly(sale_date || date),
        channel ?? "loja",
        responsible ?? null,
        reference ?? null,
        notes ?? null,
      ]
    );
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/sales", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.*, b.title, a.name AS author_name
      FROM sales s
      JOIN books b ON b.id=s.book_id
      JOIN authors a ON a.id=b.author_id
      ORDER BY s.sale_date DESC, s.id DESC
    `);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/sales/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    await pool.query("DELETE FROM sales WHERE id=$1", [id]);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/sales/clear-unsettled", async (_req, res) => {
  try {
    await pool.query("DELETE FROM sales WHERE settlement_id IS NULL");
    await pool.query("DELETE FROM general_sales");
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/sales/bulk", async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : req.body?.items;
  if (!Array.isArray(items)) return res.status(400).json({ error: "Envie um array em body (ou {items:[]})" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const it of items) {
      if (!it?.book_id || !it?.quantity) continue;
      await client.query(
        `INSERT INTO sales (book_id, quantity, sale_price, sale_date, channel, responsible, reference, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          Number(it.book_id),
          Number(it.quantity),
          Number(it.sale_price ?? it.price ?? 0),
          asDateOnly(it.sale_date || it.date),
          it.channel ?? "loja",
          it.responsible ?? null,
          it.reference ?? null,
          it.notes ?? null,
        ]
      );
    }
    await client.query("COMMIT");
    res.json({ success: true, inserted: items.length });
  } catch (e: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ---------- RETURNS ----------
app.post("/api/returns", async (req, res) => {
  try {
    const { book_id, quantity, return_date, date, reason, responsible } = req.body ?? {};
    if (!book_id || !quantity) return res.status(400).json({ error: "book_id e quantity são obrigatórios" });

    const { rows } = await pool.query(
      `INSERT INTO returns (book_id, quantity, return_date, reason, responsible)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [Number(book_id), Number(quantity), asDateOnly(return_date || date), reason ?? null, responsible ?? null]
    );
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/returns", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT r.*, b.title, a.name AS author_name
      FROM returns r
      JOIN books b ON b.id=r.book_id
      JOIN authors a ON a.id=b.author_id
      ORDER BY r.return_date DESC, r.id DESC
    `);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- GENERAL SALES ----------
app.get("/api/general-sales", async (req, res) => {
  try {
    const startDate = req.query.start_date ? asDateOnly(req.query.start_date) : '2000-01-01';
    const endDate = req.query.end_date ? asDateOnly(req.query.end_date) : '2100-12-31';
    const { rows } = await pool.query(
      `SELECT * FROM general_sales 
       WHERE sale_date BETWEEN $1 AND $2
       ORDER BY sale_date DESC, id DESC`,
      [startDate, endDate]
    );
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/general-sales", async (req, res) => {
  try {
    const { amount, sale_date, date, notes } = req.body ?? {};
    if (amount === undefined) return res.status(400).json({ error: "amount é obrigatório" });

    const { rows } = await pool.query(
      `INSERT INTO general_sales (amount, sale_date, notes)
       VALUES ($1,$2,$3)
       RETURNING *`,
      [Number(amount), asDateOnly(sale_date || date), notes ?? null]
    );
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/general-sales/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { amount, sale_date, date, notes } = req.body ?? {};
    if (!id) return res.status(400).json({ error: "ID inválido" });

    const { rows } = await pool.query(
      `UPDATE general_sales SET amount=$1, sale_date=$2, notes=$3 WHERE id=$4 RETURNING *`,
      [Number(amount), asDateOnly(sale_date || date), notes ?? null, id]
    );
    res.json(rows[0] ?? null);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/general-sales/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    await pool.query("DELETE FROM general_sales WHERE id=$1", [id]);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/general-sales/bulk", async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : req.body?.items;
  if (!Array.isArray(items)) return res.status(400).json({ error: "Envie um array em body (ou {items:[]})" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const it of items) {
      if (it?.amount === undefined) continue;
      await client.query(
        `INSERT INTO general_sales (amount, sale_date, notes) VALUES ($1,$2,$3)`,
        [Number(it.amount), asDateOnly(it.sale_date || it.date), it.notes ?? null]
      );
    }
    await client.query("COMMIT");
    res.json({ success: true, inserted: items.length });
  } catch (e: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ---------- SETTLEMENTS ----------
app.get("/api/settlements/preview", async (req, res) => {
  try {
    const authorId = Number(req.query.author_id);
    const startDate = asDateOnly(req.query.start_date);
    const endDate = asDateOnly(req.query.end_date);

    if (!authorId) return res.status(400).json({ error: "author_id é obrigatório" });

    const { rows } = await pool.query(
      `
      SELECT
        s.id,
        s.book_id,
        b.title,
        s.quantity,
        s.sale_price,
        s.sale_date,
        b.repasse_type,
        b.repasse_value
      FROM sales s
      JOIN books b ON b.id=s.book_id
      WHERE b.author_id=$1
        AND s.settlement_id IS NULL
        AND s.sale_date BETWEEN $2 AND $3
      ORDER BY s.sale_date ASC, s.id ASC
      `,
      [authorId, startDate, endDate]
    );

    let totalUnits = 0;
    let totalGross = 0;
    let totalRepasse = 0;

    const itemsWithCalculations = rows.map(r => {
      const qty = Number(r.quantity);
      const price = Number(r.sale_price);
      const gross = qty * price;
      let repasse = 0;

      totalUnits += qty;
      totalGross += gross;

      if (r.repasse_type === "fixed") {
        repasse = qty * Number(r.repasse_value);
      } else {
        repasse = gross * (Number(r.repasse_value) / 100);
      }
      totalRepasse += repasse;

      return { ...r, gross, repasse };
    });

    res.json({
      author_id: authorId,
      start_date: startDate,
      end_date: endDate,
      items: itemsWithCalculations,
      totalGross: Number(totalGross.toFixed(2)),
      totalRepasse: Number(totalRepasse.toFixed(2)),
      total_units: totalUnits,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/settlements", async (req, res) => {
  const { author_id, start_date, end_date, total_gross, total_repasse, notes, sale_ids } = req.body ?? {};
  const authorId = Number(author_id);
  const startDate = asDateOnly(start_date);
  const endDate = asDateOnly(end_date);

  if (!authorId) return res.status(400).json({ error: "author_id é obrigatório" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let finalTotalUnits = 0;
    let finalTotalGross = Number(total_gross ?? 0);
    let finalTotalRepasse = Number(total_repasse ?? 0);
    let finalSaleIds = sale_ids ?? [];

    if (finalSaleIds.length === 0) {
      const { rows: items } = await client.query(
        `
        SELECT
          s.id,
          s.quantity,
          s.sale_price,
          b.repasse_type,
          b.repasse_value
        FROM sales s
        JOIN books b ON b.id=s.book_id
        WHERE b.author_id=$1
          AND s.settlement_id IS NULL
          AND s.sale_date BETWEEN $2 AND $3
        `,
        [authorId, startDate, endDate]
      );

      finalTotalGross = 0;
      finalTotalRepasse = 0;
      for (const r of items) {
        const qty = Number(r.quantity);
        const price = Number(r.sale_price);
        const gross = qty * price;
        finalTotalUnits += qty;
        finalTotalGross += gross;
        if (r.repasse_type === "fixed") {
          finalTotalRepasse += qty * Number(r.repasse_value);
        } else {
          finalTotalRepasse += gross * (Number(r.repasse_value) / 100);
        }
        finalSaleIds.push(r.id);
      }
    }

    const { rows: settlementRows } = await client.query(
      `
      INSERT INTO settlements (author_id, start_date, end_date, total_units, total_gross, total_repasse, status, notes)
      VALUES ($1,$2,$3,$4,$5,$6,'pending',$7)
      RETURNING *
      `,
      [authorId, startDate, endDate, finalTotalUnits, finalTotalGross, finalTotalRepasse, notes ?? null]
    );
    const settlement = settlementRows[0];

    for (const saleId of finalSaleIds) {
      await client.query(
        `UPDATE sales SET settlement_id=$1 WHERE id=$2`,
        [settlement.id, Number(saleId)]
      );
    }

    await client.query("COMMIT");
    res.json({ success: true, id: settlement.id, settlement });
  } catch (e: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

app.get("/api/settlements", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT st.*, a.name AS author_name, a.pix_key
      FROM settlements st
      JOIN authors a ON a.id=st.author_id
      ORDER BY st.created_at DESC, st.id DESC
    `);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.patch("/api/settlements/:id/pay", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });

    const paymentDate = asDateOnly(req.body?.payment_date || req.body?.paid_at || new Date().toISOString());
    const paymentMethod = req.body?.payment_method ?? null;

    const { rows } = await pool.query(
      `UPDATE settlements
          SET status='paid', payment_date=$1, payment_method=$2
        WHERE id=$3
        RETURNING *`,
      [paymentDate, paymentMethod, id]
    );
    res.json({ success: true, settlement: rows[0] ?? null });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.patch("/api/settlements/:id/status", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const status = String(req.body?.status ?? "").toLowerCase();
    if (!id) return res.status(400).json({ error: "ID inválido" });
    if (!["pending", "paid"].includes(status)) return res.status(400).json({ error: "status inválido" });

    const paymentDate = status === "paid" ? asDateOnly(req.body?.payment_date || new Date().toISOString()) : null;

    const { rows } = await pool.query(
      `UPDATE settlements
          SET status=$1, payment_date=$2
        WHERE id=$3
        RETURNING *`,
      [status, paymentDate, id]
    );
    res.json({ success: true, settlement: rows[0] ?? null });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/settlements/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });

    const {
      start_date,
      end_date,
      total_gross,
      total_repasse,
      status,
      payment_date,
      payment_method,
      notes,
    } = req.body ?? {};

    const newStatus = status ? String(status).toLowerCase() : null;

    const { rows } = await pool.query(
      `UPDATE settlements
          SET start_date = COALESCE($1, start_date),
              end_date = COALESCE($2, end_date),
              total_gross = COALESCE($3, total_gross),
              total_repasse = COALESCE($4, total_repasse),
              status = COALESCE($5, status),
              payment_date = $6,
              payment_method = $7,
              notes = $8
        WHERE id=$9
        RETURNING *`,
      [
        start_date ? asDateOnly(start_date) : null,
        end_date ? asDateOnly(end_date) : null,
        total_gross !== undefined ? Number(total_gross) : null,
        total_repasse !== undefined ? Number(total_repasse) : null,
        newStatus,
        payment_date ? asDateOnly(payment_date) : (newStatus === "paid" ? asDateOnly(new Date()) : null),
        payment_method ?? null,
        notes ?? null,
        id,
      ]
    );
    res.json({ success: true, settlement: rows[0] ?? null });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/settlements/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`UPDATE sales SET settlement_id=NULL WHERE settlement_id=$1`, [id]);
    await client.query(`DELETE FROM settlements WHERE id=$1`, [id]);
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (e: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ---------- REPORTS ----------
app.get("/api/reports/sales", async (req, res) => {
  try {
    const startDate = asDateOnly(req.query.start_date);
    const endDate = asDateOnly(req.query.end_date);
    const authorId = req.query.author_id ? Number(req.query.author_id) : null;

    const params: any[] = [startDate, endDate];
    let where = `s.sale_date BETWEEN $1 AND $2`;
    if (authorId) {
      params.push(authorId);
      where += ` AND b.author_id = $3`;
    }

    const { rows } = await pool.query(
      `
      SELECT
        s.*,
        b.title,
        a.name AS author_name,
        (s.quantity * s.sale_price) AS total
      FROM sales s
      JOIN books b ON b.id=s.book_id
      JOIN authors a ON a.id=b.author_id
      WHERE ${where}
      ORDER BY s.sale_date DESC, s.id DESC
      `,
      params
    );

    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- UNIFIED IMPORT ----------
app.post("/api/sales/unified-import", async (req, res) => {
  const allSales = req.body?.allSales ?? req.body;
  if (!Array.isArray(allSales)) return res.status(400).json({ error: "Envie um array em body ou {allSales:[]}" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: bookRows } = await client.query(`SELECT id, isbn, cover_price FROM books WHERE isbn IS NOT NULL AND isbn <> ''`);
    const isbnMap = new Map<string, { id: number; cover_price: number }>();
    for (const r of bookRows) {
      isbnMap.set(String(r.isbn).trim(), { id: Number(r.id), cover_price: Number(r.cover_price) });
    }

    let consignmentCount = 0;
    const generalAmountByDate: Record<string, number> = {};

    for (const row of allSales) {
      const isbn = String(row.isbn ?? row.ISBN ?? row.codigo ?? "").trim();
      const quantity = Number(row.quantity ?? row.qtd ?? row.quantidade ?? 1);
      const price = Number(row.sale_price ?? row.price ?? row.preco ?? row.valor ?? 0);
      const dateStr = asDateOnly(row.sale_date || row.date || row.data || new Date().toISOString());
      const channel = row.channel ?? row.canal ?? "loja";

      const book = isbn ? isbnMap.get(isbn) : null;
      if (book) {
        await client.query(
          `INSERT INTO sales (book_id, quantity, sale_price, sale_date, channel, notes)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [book.id, quantity, price || book.cover_price, dateStr, channel, "Importação Unificada"]
        );
        consignmentCount++;
      } else {
        const totalRow = quantity * price;
        if (totalRow > 0) generalAmountByDate[dateStr] = (generalAmountByDate[dateStr] || 0) + totalRow;
      }
    }

    for (const [date, amount] of Object.entries(generalAmountByDate)) {
      await client.query(
        `INSERT INTO general_sales (amount, sale_date, notes) VALUES ($1,$2,$3)`,
        [Number(amount.toFixed(2)), date, "Agregado via Importação Unificada"]
      );
    }

    await client.query("COMMIT");
    res.json({ success: true, consignmentCount, generalDates: Object.keys(generalAmountByDate).length });
  } catch (e: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

export { app };
