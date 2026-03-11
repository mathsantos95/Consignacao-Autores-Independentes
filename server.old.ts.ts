import express from "express";
import { createServer as createViteServer } from "vite";
import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDb() {
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
  `);

  const authorCountResult = await pool.query("SELECT COUNT(*)::int AS count FROM authors");
const authorCount = authorCountResult.rows[0]?.count ?? 0;

if (authorCount === 0) {
  // deixe vazio por enquanto ou remova esse if inteiro
}

// --- Database Schema ---


// --- Seed Data ---
  const insertAuthor = db.prepare("INSERT INTO authors (name, phone, email, pix_key) VALUES (?, ?, ?, ?)");
  const insertBook = db.prepare("INSERT INTO books (title, author_id, cover_price, repasse_type, repasse_value, category) VALUES (?, ?, ?, ?, ?, ?)");
  
  const a1 = insertAuthor.run("João da Silva", "11999999999", "joao@email.com", "joao@pix.com").lastInsertRowid;
  const a2 = insertAuthor.run("Maria Oliveira", "21888888888", "maria@email.com", "000.111.222-33").lastInsertRowid;
  
  insertBook.run("Poesias Urbanas", a1, 45.00, "percent", 60, "Poesia");
  insertBook.run("Contos de Inverno", a1, 38.00, "fixed", 20, "Ficção");
  insertBook.run("A Arte de Viver", a2, 55.00, "percent", 70, "Autoajuda");
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // --- API Routes ---

  // Authors
  app.get("/api/authors", (req, res) => {
    const authors = db.prepare("SELECT * FROM authors ORDER BY name").all();
    res.json(authors);
  });

  app.post("/api/authors", (req, res) => {
    try {
      const { name, phone, email, pix_key, notes } = req.body;
      if (!name) return res.status(400).json({ error: "Nome é obrigatório" });
      
      const result = db.prepare("INSERT INTO authors (name, phone, email, pix_key, notes) VALUES (?, ?, ?, ?, ?)").run(name, phone, email, pix_key, notes);
      res.json({ id: result.lastInsertRowid });
    } catch (error: any) {
      console.error("Error creating author:", error);
      res.status(500).json({ error: error.message || "Erro interno ao salvar autor" });
    }
  });

  app.put("/api/authors/:id", (req, res) => {
    try {
      const { id } = req.params;
      const { name, phone, email, pix_key, notes } = req.body;
      db.prepare("UPDATE authors SET name = ?, phone = ?, email = ?, pix_key = ?, notes = ? WHERE id = ?").run(name, phone, email, pix_key, notes, id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/authors/:id", (req, res) => {
    try {
      const { id } = req.params;
      // Check if author has books
      const books = db.prepare("SELECT COUNT(*) as count FROM books WHERE author_id = ?").get(id) as { count: number };
      if (books.count > 0) {
        return res.status(400).json({ error: "Não é possível excluir autor com livros cadastrados" });
      }
      db.prepare("DELETE FROM authors WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Books
  app.get("/api/books", (req, res) => {
    const books = db.prepare(`
      SELECT b.*, a.name as author_name 
      FROM books b 
      JOIN authors a ON b.author_id = a.id 
      ORDER BY b.title
    `).all();
    res.json(books);
  });

  app.post("/api/books", (req, res) => {
    const { title, isbn, author_id, cover_price, repasse_type, repasse_value, category, notes } = req.body;
    const result = db.prepare(`
      INSERT INTO books (title, isbn, author_id, cover_price, repasse_type, repasse_value, category, notes) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(title, isbn, author_id, cover_price, repasse_type, repasse_value, category, notes);
    res.json({ id: result.lastInsertRowid });
  });

  app.put("/api/books/:id", (req, res) => {
    try {
      const { id } = req.params;
      const { title, isbn, author_id, cover_price, repasse_type, repasse_value, category, notes } = req.body;
      db.prepare(`
        UPDATE books SET title = ?, isbn = ?, author_id = ?, cover_price = ?, repasse_type = ?, repasse_value = ?, category = ?, notes = ?
        WHERE id = ?
      `).run(title, isbn, author_id, cover_price, repasse_type, repasse_value, category, notes, id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/books/:id", (req, res) => {
    try {
      const { id } = req.params;
      // Check if book has sales or consignments
      const sales = db.prepare("SELECT COUNT(*) as count FROM sales WHERE book_id = ?").get(id) as { count: number };
      const consignments = db.prepare("SELECT COUNT(*) as count FROM consignments WHERE book_id = ?").get(id) as { count: number };
      if (sales.count > 0 || consignments.count > 0) {
        return res.status(400).json({ error: "Não é possível excluir livro com movimentações (vendas ou entradas)" });
      }
      db.prepare("DELETE FROM books WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Inventory & Movements
  app.get("/api/inventory", (req, res) => {
    const inventory = db.prepare(`
      SELECT 
        b.id, b.title, a.name as author_name,
        COALESCE((SELECT SUM(quantity) FROM consignments WHERE book_id = b.id), 0) as received,
        COALESCE((SELECT SUM(quantity) FROM sales WHERE book_id = b.id), 0) as sold,
        COALESCE((SELECT SUM(quantity) FROM returns WHERE book_id = b.id), 0) as returned
      FROM books b
      JOIN authors a ON b.author_id = a.id
    `).all().map((item: any) => ({
      ...item,
      stock: item.received - item.sold - item.returned
    }));
    res.json(inventory);
  });

  app.post("/api/consignments", (req, res) => {
    const { book_id, quantity, entry_date, notes, responsible } = req.body;
    const result = db.prepare(`
      INSERT INTO consignments (book_id, quantity, entry_date, notes, responsible) 
      VALUES (?, ?, ?, ?, ?)
    `).run(book_id, quantity, entry_date, notes, responsible);
    res.json({ id: result.lastInsertRowid });
  });

  app.post("/api/sales", (req, res) => {
    const { book_id, quantity, sale_price, sale_date, channel, reference, notes, responsible } = req.body;
    
    // Check stock
    const stockInfo = db.prepare(`
      SELECT 
        (COALESCE((SELECT SUM(quantity) FROM consignments WHERE book_id = ?), 0) -
         COALESCE((SELECT SUM(quantity) FROM sales WHERE book_id = ?), 0) -
         COALESCE((SELECT SUM(quantity) FROM returns WHERE book_id = ?), 0)) as stock
    `).get(book_id, book_id, book_id) as { stock: number };

    if (stockInfo.stock < quantity) {
      return res.status(400).json({ error: "Estoque insuficiente" });
    }

    const result = db.prepare(`
      INSERT INTO sales (book_id, quantity, sale_price, sale_date, channel, reference, notes, responsible) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(book_id, quantity, sale_price, sale_date, channel, reference, notes, responsible);
    res.json({ id: result.lastInsertRowid });
  });

  app.post("/api/returns", (req, res) => {
    const { book_id, quantity, return_date, reason, responsible } = req.body;
    const result = db.prepare(`
      INSERT INTO returns (book_id, quantity, return_date, reason, responsible) 
      VALUES (?, ?, ?, ?, ?)
    `).run(book_id, quantity, return_date, reason, responsible);
    res.json({ id: result.lastInsertRowid });
  });

  app.get("/api/consignments", (req, res) => {
    const consignments = db.prepare(`
      SELECT c.*, b.title, a.name as author_name, a.pix_key, a.email, a.phone
      FROM consignments c
      JOIN books b ON c.book_id = b.id
      JOIN authors a ON b.author_id = a.id
      ORDER BY c.entry_date DESC, c.created_at DESC
    `).all();
    res.json(consignments);
  });

  app.get("/api/returns", (req, res) => {
    const returns = db.prepare(`
      SELECT r.*, b.title, a.name as author_name, a.pix_key, a.email, a.phone
      FROM returns r
      JOIN books b ON r.book_id = b.id
      JOIN authors a ON b.author_id = a.id
      ORDER BY r.return_date DESC, r.created_at DESC
    `).all();
    res.json(returns);
  });

  app.get("/api/sales", (req, res) => {
    const sales = db.prepare(`
      SELECT s.*, b.title, a.name as author_name
      FROM sales s
      JOIN books b ON s.book_id = b.id
      JOIN authors a ON b.author_id = a.id
      ORDER BY s.sale_date DESC, s.created_at DESC
      LIMIT 500
    `).all();
    res.json(sales);
  });

  app.delete("/api/sales/:id", (req, res) => {
    try {
      const { id } = req.params;
      const sale = db.prepare("SELECT settlement_id FROM sales WHERE id = ?").get(id) as { settlement_id: number | null };
      if (sale && sale.settlement_id) {
        return res.status(400).json({ error: "Não é possível excluir uma venda que já foi incluída em um acerto pago ou processado." });
      }
      db.prepare("DELETE FROM sales WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/general-sales", (req, res) => {
    const sales = db.prepare("SELECT * FROM general_sales ORDER BY sale_date DESC, created_at DESC LIMIT 500").all();
    res.json(sales);
  });

  app.delete("/api/general-sales/:id", (req, res) => {
    try {
      const { id } = req.params;
      db.prepare("DELETE FROM general_sales WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/sales/clear-unsettled", (req, res) => {
    try {
      const transaction = db.transaction(() => {
        db.prepare("DELETE FROM sales WHERE settlement_id IS NULL").run();
        db.prepare("DELETE FROM general_sales").run(); // General sales aren't linked to settlements currently
      });
      transaction();
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Settlements (Acertos)
  app.get("/api/settlements/preview", (req, res) => {
    const { author_id, start_date, end_date } = req.query;
    const sales = db.prepare(`
      SELECT s.*, b.title, b.repasse_type, b.repasse_value
      FROM sales s
      JOIN books b ON s.book_id = b.id
      WHERE b.author_id = ? AND s.sale_date BETWEEN ? AND ? AND s.settlement_id IS NULL
    `).all(author_id, start_date, end_date);

    let totalGross = 0;
    let totalRepasse = 0;

    const items = sales.map((s: any) => {
      const gross = s.quantity * s.sale_price;
      let repasse = 0;
      if (s.repasse_type === 'fixed') {
        repasse = s.quantity * s.repasse_value;
      } else {
        repasse = gross * (s.repasse_value / 100);
      }
      totalGross += gross;
      totalRepasse += repasse;
      return { ...s, gross, repasse };
    });

    res.json({ items, totalGross, totalRepasse });
  });

  app.post("/api/settlements", (req, res) => {
    const { author_id, start_date, end_date, total_gross, total_repasse, notes, sale_ids } = req.body;
    
    const transaction = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO settlements (author_id, start_date, end_date, total_gross, total_repasse, notes) 
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(author_id, start_date, end_date, total_gross, total_repasse, notes);
      
      const settlementId = result.lastInsertRowid;
      
      const updateSale = db.prepare("UPDATE sales SET settlement_id = ? WHERE id = ?");
      for (const id of sale_ids) {
        updateSale.run(settlementId, id);
      }
      
      return settlementId;
    });

    const id = transaction();
    res.json({ id });
  });

  app.get("/api/settlements", (req, res) => {
    const settlements = db.prepare(`
      SELECT s.*, a.name as author_name, a.pix_key
      FROM settlements s
      JOIN authors a ON s.author_id = a.id
      ORDER BY s.created_at DESC
    `).all();
    res.json(settlements);
  });

  // General Sales
  app.get("/api/general-sales", (req, res) => {
    const { start_date, end_date } = req.query;
    const sales = db.prepare(`
      SELECT * FROM general_sales 
      WHERE sale_date BETWEEN ? AND ?
      ORDER BY sale_date ASC
    `).all(start_date, end_date);
    res.json(sales);
  });

  app.post("/api/general-sales", (req, res) => {
    const { amount, sale_date, notes } = req.body;
    const result = db.prepare(`
      INSERT INTO general_sales (amount, sale_date, notes) 
      VALUES (?, ?, ?)
    `).run(amount, sale_date, notes);
    res.json({ id: result.lastInsertRowid });
  });

  app.patch("/api/settlements/:id/pay", (req, res) => {
    const { id } = req.params;
    const { payment_date, payment_method } = req.body;
    db.prepare(`
      UPDATE settlements 
      SET status = 'paid', payment_date = ?, payment_method = ? 
      WHERE id = ?
    `).run(payment_date, payment_method, id);
    res.json({ success: true });
  });

  app.patch("/api/settlements/:id/status", (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    db.prepare("UPDATE settlements SET status = ? WHERE id = ?").run(status, id);
    res.json({ success: true });
  });

  app.put("/api/settlements/:id", (req, res) => {
    const { id } = req.params;
    const { start_date, end_date, total_gross, total_repasse, status, payment_date, payment_method, notes } = req.body;
    db.prepare(`
      UPDATE settlements 
      SET start_date = ?, end_date = ?, total_gross = ?, total_repasse = ?, status = ?, payment_date = ?, payment_method = ?, notes = ?
      WHERE id = ?
    `).run(start_date, end_date, total_gross, total_repasse, status, payment_date, payment_method, notes, id);
    res.json({ success: true });
  });

  app.delete("/api/settlements/:id", (req, res) => {
    const { id } = req.params;
    const transaction = db.transaction(() => {
      db.prepare("UPDATE sales SET settlement_id = NULL WHERE settlement_id = ?").run(id);
      db.prepare("DELETE FROM settlements WHERE id = ?").run(id);
    });
    transaction();
    res.json({ success: true });
  });

  app.put("/api/general-sales/:id", (req, res) => {
    const { id } = req.params;
    const { amount, sale_date, notes } = req.body;
    db.prepare("UPDATE general_sales SET amount = ?, sale_date = ?, notes = ? WHERE id = ?").run(amount, sale_date, notes, id);
    res.json({ success: true });
  });

  // Reports
  app.get("/api/reports/sales", (req, res) => {
    const { start_date, end_date, author_id } = req.query;
    let query = `
      SELECT s.*, b.title, a.name as author_name
      FROM sales s
      JOIN books b ON s.book_id = b.id
      JOIN authors a ON b.author_id = a.id
      WHERE s.sale_date BETWEEN ? AND ?
    `;
    const params: any[] = [start_date, end_date];
    if (author_id) {
      query += " AND a.id = ?";
      params.push(author_id);
    }
    const sales = db.prepare(query).all(...params);
    res.json(sales);
  });

  // Bulk Imports
  app.post("/api/authors/bulk", (req, res) => {
    const authors = req.body;
    const insert = db.prepare("INSERT INTO authors (name, phone, email, pix_key, notes) VALUES (?, ?, ?, ?, ?)");
    const transaction = db.transaction((data) => {
      for (const author of data) {
        insert.run(author.name, author.phone, author.email, author.pix_key, author.notes);
      }
    });
    transaction(authors);
    res.json({ success: true, count: authors.length });
  });

  app.post("/api/books/bulk", (req, res) => {
    const books = req.body;
    const findAuthor = db.prepare("SELECT id FROM authors WHERE name = ? COLLATE NOCASE");
    const insert = db.prepare(`
      INSERT INTO books (title, isbn, author_id, cover_price, repasse_type, repasse_value, category, notes) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const transaction = db.transaction((data) => {
      let count = 0;
      for (const book of data) {
        let authorId = book.author_id;
        if (!authorId && book.author_name) {
          const author = findAuthor.get(book.author_name) as { id: number };
          if (author) authorId = author.id;
        }
        
        if (authorId) {
          insert.run(book.title, book.isbn, authorId, book.cover_price, book.repasse_type || 'percent', book.repasse_value || 0, book.category, book.notes);
          count++;
        }
      }
      return count;
    });
    const importedCount = transaction(books);
    res.json({ success: true, count: importedCount });
  });

  app.post("/api/sales/bulk", (req, res) => {
    const sales = req.body;
    const findBook = db.prepare("SELECT id, cover_price FROM books WHERE title = ? COLLATE NOCASE");
    const insert = db.prepare(`
      INSERT INTO sales (book_id, quantity, sale_price, sale_date, channel, reference, notes, responsible) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const transaction = db.transaction((data) => {
      let count = 0;
      for (const sale of data) {
        let bookId = sale.book_id;
        let price = sale.sale_price;
        
        if (!bookId && sale.book_title) {
          const book = findBook.get(sale.book_title) as { id: number, cover_price: number };
          if (book) {
            bookId = book.id;
            if (!price) price = book.cover_price;
          }
        }
        
        if (bookId) {
          insert.run(bookId, sale.quantity, price || 0, sale.sale_date, sale.channel || 'loja', sale.reference, sale.notes, sale.responsible);
          count++;
        }
      }
      return count;
    });
    
    const importedCount = transaction(sales);
    res.json({ success: true, count: importedCount });
  });

  app.post("/api/general-sales/bulk", (req, res) => {
    const sales = req.body;
    const insert = db.prepare(`
      INSERT INTO general_sales (amount, sale_date, notes) 
      VALUES (?, ?, ?)
    `);
    const transaction = db.transaction((data) => {
      for (const sale of data) {
        insert.run(sale.amount, sale.sale_date, sale.notes);
      }
    });
    transaction(sales);
    res.json({ success: true, count: sales.length });
  });

  app.post("/api/sales/unified-import", (req, res) => {
    const allSales = req.body;
    const findBookByIsbn = db.prepare("SELECT id, cover_price FROM books WHERE isbn = ?");
    const insertConsignmentSale = db.prepare(`
      INSERT INTO sales (book_id, quantity, sale_price, sale_date, channel, notes) 
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const insertGeneralSale = db.prepare(`
      INSERT INTO general_sales (amount, sale_date, notes) 
      VALUES (?, ?, ?)
    `);

    const transaction = db.transaction((data) => {
      let consignmentCount = 0;
      let generalAmountByDate: Record<string, number> = {};

      for (const row of data) {
        // Try to find ISBN in various possible column names
        const isbn = String(row.isbn || row.ISBN || row.Isbn || row["Código"] || row.codigo || "").trim();
        const quantity = parseInt(row.quantity || row.quantidade || row.qtd || row.Qtd || 1);
        const price = parseFloat(row.price || row.preco || row.valor || row.amount || row.valor_unitario || 0);
        
        // Handle date
        let rawDate = row.sale_date || row.data || row.Data || row.date || new Date();
        let dateStr: string;
        
        if (rawDate instanceof Date) {
          dateStr = rawDate.toISOString().split('T')[0];
        } else if (typeof rawDate === 'number') {
          // Handle Excel serial date
          const date = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
          dateStr = date.toISOString().split('T')[0];
        } else {
          const s = String(rawDate).trim().toLowerCase();
          // Match MM/YYYY or MM-YYYY
          const myMatch = s.match(/^(\d{1,2})[\/\-](\d{4})$/);
          // Match YYYY/MM or YYYY-MM
          const ymMatch = s.match(/^(\d{4})[\/\-](\d{1,2})$/);
          
          if (myMatch) {
            dateStr = `${myMatch[2]}-${myMatch[1].padStart(2, '0')}-01`;
          } else if (ymMatch) {
            dateStr = `${ymMatch[1]}-${ymMatch[2].padStart(2, '0')}-01`;
          } else {
            // Try to handle "Month YYYY"
            const monthMap: Record<string, string> = {
              'janeiro': '01', 'fevereiro': '02', 'março': '03', 'marco': '03', 'abril': '04',
              'maio': '05', 'junho': '06', 'julho': '07', 'agosto': '08', 'setembro': '09',
              'outubro': '10', 'novembro': '11', 'dezembro': '12'
            };
            let found = false;
            for (const [name, num] of Object.entries(monthMap)) {
              if (s.includes(name)) {
                const yearMatch = s.match(/\d{4}/);
                if (yearMatch) {
                  dateStr = `${yearMatch[0]}-${num}-01`;
                  found = true;
                  break;
                }
              }
            }
            
            if (!found) {
              dateStr = s.split('t')[0].split(' ')[0];
              // Basic validation for YYYY-MM-DD
              if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                dateStr = new Date().toISOString().split('T')[0];
              }
            }
          }
        }
        
        let book = null;
        if (isbn && isbn !== "") {
          book = findBookByIsbn.get(isbn) as { id: number, cover_price: number };
        }

        if (book) {
          // It's a consignment book
          insertConsignmentSale.run(book.id, quantity, price || book.cover_price, dateStr, row.channel || row.canal || 'loja', 'Importação Unificada');
          consignmentCount++;
        } else {
          // It's a general sale
          const totalRow = quantity * price;
          if (totalRow > 0) {
            generalAmountByDate[dateStr] = (generalAmountByDate[dateStr] || 0) + totalRow;
          }
        }
      }

      // Save aggregated general sales
      for (const [date, amount] of Object.entries(generalAmountByDate)) {
        insertGeneralSale.run(amount, date, 'Agregado via Importação Unificada');
      }

      return { consignmentCount, generalDates: Object.keys(generalAmountByDate).length };
    });

    try {
      const result = transaction(allSales);
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error("Erro na transação de importação:", error);
      res.status(500).json({ error: "Erro ao processar dados no banco: " + error.message });
    }
  });
  }

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  async function startServer() {
  await initDb();

  const port = Number(process.env.PORT || 3000);

  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error("Erro ao iniciar o servidor:", err);
  process.exit(1);
});