const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database('./laundry.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_code INTEGER NOT NULL,
        customer_phone TEXT NOT NULL,
        services TEXT NOT NULL,
        total_amount REAL NOT NULL,
        status TEXT DEFAULT 'Active',
        created_by TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        role TEXT NOT NULL
    )`);

    db.run(`INSERT OR IGNORE INTO users (username, password, role) VALUES ('admin', 'admin14212', 'admin')`);
    db.run(`INSERT OR IGNORE INTO users (username, password, role) VALUES ('emp1', 'emp12313321', 'employee')`);
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT username, role FROM users WHERE username = ? AND password = ?", [username, password], (err, row) => {
        if (err || !row) return res.json({ success: false, message: "بيانات الدخول خاطئة" });
        res.json({ success: true, user: row });
    });
});

app.post('/api/create-invoice', (req, res) => {
    const { customer_phone, services, total_amount, created_by } = req.body;

    db.all("SELECT invoice_code FROM invoices WHERE status IN ('Active', 'Ready')", [], (err, rows) => {
        const reservedCodes = rows.map(row => row.invoice_code);
        let nextAvailableCode = 1;
        while (reservedCodes.includes(nextAvailableCode)) { nextAvailableCode++; }

        const query = `INSERT INTO invoices (invoice_code, customer_phone, services, total_amount, created_by) VALUES (?, ?, ?, ?, ?)`;
        db.run(query, [nextAvailableCode, customer_phone, services, total_amount, created_by], function(err) {
            const host = req.get('host');
            const invoiceUrl = `http://${host}/customer-invoice.html?code=${nextAvailableCode}`;
            const whatsappMessage = `مرحباً بك في مغسلتنا الرسمية 🧺\n\nتم استلام ملابسكم بنجاح.\n🏷️ رقم الفاتورة: ${nextAvailableCode}\n💰 الإجمالي: ${total_amount} ريال.\n\n🌐 لمتابعة حالة ملابسك مباشرة:\n${invoiceUrl}`;
            
            let cleanPhone = customer_phone.trim().replace(/[^0-9]/g, '');
            if (cleanPhone.startsWith('05')) cleanPhone = '966' + cleanPhone.substring(1);
            const whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(whatsappMessage)}`;

            res.json({ success: true, invoice_code: nextAvailableCode, whatsapp_url: whatsappUrl });
        });
    });
});

// البحث المزدوج (برقم الفاتورة أو الجوال)
app.get('/api/search-invoice/:query', (req, res) => {
    const searchQuery = req.params.query;
    const sql = `SELECT * FROM invoices WHERE (invoice_code = ? OR customer_phone = ?) AND status IN ('Active', 'Ready') ORDER BY id DESC LIMIT 1`;

    db.get(sql, [searchQuery, searchQuery], (err, row) => {
        if (err || !row) return res.json({ success: false, message: "لا توجد ملابس معلقة بهذا الرقم أو الجوال." });
        
        const host = req.get('host');
        const invoiceUrl = `http://${host}/customer-invoice.html?code=${row.invoice_code}`;
        const readyMessage = `عميلنا العزيز 🌟\n\nملابسك في الفاتورة رقم (${row.invoice_code}) جاهزة للاستلام ✨.\n💰 المتبقي: ${row.total_amount} ريال.\n\nرابط الفاتورة:\n${invoiceUrl}`;
        
        let cleanPhone = row.customer_phone.trim().replace(/[^0-9]/g, '');
        if (cleanPhone.startsWith('05')) cleanPhone = '966' + cleanPhone.substring(1);
        const whatsappReadyUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(readyMessage)}`;

        res.json({ success: true, invoice: row, whatsapp_ready_url: whatsappReadyUrl });
    });
});

app.put('/api/deliver-invoice', (req, res) => {
    const { invoice_code } = req.body;
    db.run(`UPDATE invoices SET status = 'Delivered' WHERE invoice_code = ? AND status IN ('Active', 'Ready')`, [invoice_code], function(err) {
        res.json({ success: true, message: "تم التسليم وتحرير الرقم بنجاح." });
    });
});

app.get('/api/customer-view/:code', (req, res) => {
    db.get("SELECT invoice_code, services, total_amount, status, created_at FROM invoices WHERE invoice_code = ? ORDER BY id DESC LIMIT 1", [req.params.code], (err, row) => {
        if (!row) return res.json({ success: false });
        res.json({ success: true, invoice: row });
    });
});

app.get('/api/admin/stats', (req, res) => {
    const stats = {};
    db.get(`SELECT COUNT(id) as customers, COALESCE(SUM(total_amount), 0) as profit FROM invoices WHERE date(created_at) = date('now', 'localtime')`, (err, row1) => {
        stats.today = row1;
        db.get(`SELECT COUNT(id) as customers, COALESCE(SUM(total_amount), 0) as profit FROM invoices WHERE created_at >= date('now', '-7 days', 'localtime')`, (err, row2) => {
            stats.week = row2;
            db.get(`SELECT COUNT(id) as customers, COALESCE(SUM(total_amount), 0) as profit FROM invoices WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', 'localtime')`, (err, row3) => {
                stats.month = row3;
                db.get(`SELECT COUNT(id) as customers, COALESCE(SUM(total_amount), 0) as profit FROM invoices WHERE strftime('%Y', created_at) = strftime('%Y', 'now', 'localtime')`, (err, row4) => {
                    stats.year = row4;
                    res.json({ success: true, stats });
                });
            });
        });
    });
});

app.listen(PORT, () => console.log(`السيرفر يعمل بنجاح على: http://localhost:${PORT}`));