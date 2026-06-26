const express = require('express');
const { Client } = require('pg');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// الاتصال بالسحابة
const db = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

db.connect().then(() => console.log("متصل بالسحابة بنجاح!"));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// إنشاء الجداول (تنفيذ مرة واحدة عند التشغيل)
db.query(`CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    invoice_code INTEGER NOT NULL,
    customer_phone TEXT NOT NULL,
    services TEXT NOT NULL,
    total_amount REAL NOT NULL,
    status TEXT DEFAULT 'Active',
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`);

db.query(`CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    role TEXT NOT NULL
)`);

// تسجيل دخول
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await db.query("SELECT username, role FROM users WHERE username = $1 AND password = $2", [username, password]);
        if (result.rows.length === 0) return res.json({ success: false, message: "خطأ" });
        res.json({ success: true, user: result.rows[0] });
    } catch (err) { res.json({ success: false }); }
});

// إنشاء فاتورة
app.post('/api/create-invoice', async (req, res) => {
    const { customer_phone, services, total_amount, created_by } = req.body;
    try {
        const resCodes = await db.query("SELECT invoice_code FROM invoices WHERE status IN ('Active', 'Ready')");
        const reservedCodes = resCodes.rows.map(r => r.invoice_code);
        let nextCode = 1;
        while (reservedCodes.includes(nextCode)) nextCode++;

        await db.query(`INSERT INTO invoices (invoice_code, customer_phone, services, total_amount, created_by) VALUES ($1, $2, $3, $4, $5)`, 
            [nextCode, customer_phone, services, total_amount, created_by]);
        
        res.json({ success: true, invoice_code: nextCode });
    } catch (err) { res.json({ success: false }); }
});

app.listen(PORT, () => console.log(`السيرفر يعمل على بورت ${PORT}`));