const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = './uploads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });
const JWT_SECRET = process.env.JWT_SECRET || 'alfilaha_super_secret_key_2026';
const app = express();
const allowedOrigins = ['http://localhost:5173', 'https://alfilaha.id']; 

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept']
}));
app.use(express.json());
app.use('/uploads', express.static('uploads'));

const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'db_alfilaha'
});

db.connect((err) => {
  if (err) { console.error('❌ Gagal koneksi ke database:', err); return; }
  console.log('✅ Berhasil terhubung ke MySQL (db_alfilaha)');
  
  const tables = [
    `CREATE TABLE IF NOT EXISTS reservasi (id INT AUTO_INCREMENT PRIMARY KEY, nama VARCHAR(100) NOT NULL, whatsapp VARCHAR(20) NOT NULL, email VARCHAR(100), instansi VARCHAR(100), tanggal VARCHAR(50) NOT NULL, jumlah VARCHAR(100) NOT NULL, pesan TEXT, status VARCHAR(20) DEFAULT 'Pending')`,
    `CREATE TABLE IF NOT EXISTS paket_wisata (id INT AUTO_INCREMENT PRIMARY KEY, nama_paket VARCHAR(100) NOT NULL, harga VARCHAR(50) NOT NULL, deskripsi TEXT, gambar VARCHAR(255))`,
    `CREATE TABLE IF NOT EXISTS events (id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(255) NOT NULL, category VARCHAR(100) NOT NULL, date VARCHAR(100) NOT NULL, description TEXT, image VARCHAR(255))`,
    `CREATE TABLE IF NOT EXISTS blogs (id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(255) NOT NULL, date VARCHAR(100) NOT NULL, excerpt TEXT, content LONGTEXT, image VARCHAR(255))`,
    `CREATE TABLE IF NOT EXISTS appointments (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, number VARCHAR(20), email VARCHAR(100) NOT NULL, address TEXT, message TEXT, status VARCHAR(20) DEFAULT 'Pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS admin_users (id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(50) NOT NULL UNIQUE, password VARCHAR(255) NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS galeri (id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(255) NOT NULL, description TEXT, category VARCHAR(100) NOT NULL, image_url VARCHAR(255) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS pendaftar_santri (id INT AUTO_INCREMENT PRIMARY KEY, nama VARCHAR(255) NOT NULL, tempat_lahir VARCHAR(100) NOT NULL, tanggal_lahir DATE NOT NULL, jenis_kelamin ENUM('L', 'P') NOT NULL, alamat TEXT NOT NULL, no_wa VARCHAR(20) NOT NULL, email VARCHAR(255), username VARCHAR(100) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL, status_pendaftaran ENUM('Menunggu Verifikasi', 'Diterima', 'Ditolak') DEFAULT 'Menunggu Verifikasi', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS programs (id INT AUTO_INCREMENT PRIMARY KEY, judul VARCHAR(255), jenis VARCHAR(100), nama VARCHAR(255), batas_akhir DATE, keterangan TEXT, poster VARCHAR(255), status VARCHAR(50) DEFAULT 'aktif', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS layanan (id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(255) NOT NULL, description TEXT, image VARCHAR(255), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`
  ];
  
  tables.forEach(q => db.query(q, (err) => { if (err) console.error(err); }));
  
  // Update paket_wisata table if needed
  db.query("ALTER TABLE paket_wisata ADD COLUMN gambar VARCHAR(255)", (err) => {
    // Ignore error if column already exists
  });
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'Halo!' });
});

// ==========================================
// API PENDAFTARAN SANTRI
// ==========================================
app.post("/api/pendaftaran", async (req, res) => {
  const { nama, tempat_lahir, tanggal_lahir, jenis_kelamin, alamat, no_wa, email, username, password } = req.body;
  try {
    db.query("SELECT * FROM pendaftar_santri WHERE username = ?", [username], async (err, results) => {
      if (err) return res.status(500).json({ message: "Terjadi kesalahan server saat cek username." });
      if (results.length > 0) return res.status(400).json({ message: "Username sudah digunakan." });

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const sql = `INSERT INTO pendaftar_santri (nama, tempat_lahir, tanggal_lahir, jenis_kelamin, alamat, no_wa, email, username, password) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      db.query(sql, [nama, tempat_lahir, tanggal_lahir, jenis_kelamin, alamat, no_wa, email, username, hashedPassword], (err, insertResult) => {
        if (err) return res.status(500).json({ message: "Gagal menyimpan data ke database.", error: err.message });
        const token = jwt.sign({ id: insertResult.insertId, username }, JWT_SECRET, { expiresIn: '30d' });
        res.status(201).json({ message: "Pendaftaran Berhasil", token });
      });
    });
  } catch (err) { res.status(500).json({ message: "Terjadi kesalahan server." }); }
});

// LOGIN SANTRI
app.post("/api/pendaftaran/login", (req, res) => {
  const { username, password } = req.body;
  db.query("SELECT * FROM pendaftar_santri WHERE username = ?", [username], async (err, results) => {
    if (err) return res.status(500).json({ message: "Terjadi kesalahan server saat login." });
    if (results.length === 0) return res.status(401).json({ message: "Username tidak ditemukan!" });
    
    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Password salah!" });
    
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ message: "Login berhasil", token });
  });
});

const authenticateSantriToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: "Akses ditolak. Belum login." });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Token tidak valid atau sudah kadaluarsa." });
    req.user = user;
    next();
  });
};

app.get("/api/pendaftaran/status", authenticateSantriToken, (req, res) => {
  const sql = "SELECT id, nama, tempat_lahir, DATE_FORMAT(tanggal_lahir, '%Y-%m-%d') as tanggal_lahir, jenis_kelamin, alamat, no_wa, email, username, status_pendaftaran FROM pendaftar_santri WHERE id = ?";
  db.query(sql, [req.user.id], (err, results) => {
    if (err) return res.status(500).json({ message: "Terjadi kesalahan." });
    if (results.length === 0) return res.status(404).json({ message: "Data tidak ditemukan." });
    res.json(results[0]);
  });
});

app.get('/api/pendaftar_santri', (req, res) => {
  db.query("SELECT * FROM pendaftar_santri ORDER BY id DESC", (err, results) => {
    res.json(results);
  });
});
app.put('/api/pendaftar_santri/:id/status', (req, res) => {
  db.query("UPDATE pendaftar_santri SET status_pendaftaran = ? WHERE id = ?", [req.body.status, req.params.id], () => {
    res.json({ message: "Berhasil" });
  });
});
app.delete('/api/pendaftar_santri/:id', (req, res) => {
  db.query("DELETE FROM pendaftar_santri WHERE id = ?", [req.params.id], () => {
    res.json({ message: "Berhasil" });
  });
});

// PROGRAMS
app.get('/api/programs', (req, res) => {
  db.query("SELECT *, DATE_FORMAT(batas_akhir, '%Y-%m-%d') as batas_akhir FROM programs ORDER BY id DESC", (err, results) => {
    res.json(results);
  });
});
app.post('/api/programs', upload.single('poster'), (req, res) => {
  const { judul, jenis, nama, batas_akhir, keterangan, status } = req.body;
  const poster = req.file ? req.file.filename : null;
  db.query("INSERT INTO programs (judul, jenis, nama, batas_akhir, keterangan, status, poster) VALUES (?, ?, ?, ?, ?, ?, ?)", [judul, jenis, nama, batas_akhir, keterangan, status, poster], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Berhasil" });
  });
});
app.put('/api/programs/:id', upload.single('poster'), (req, res) => {
  const { judul, jenis, nama, batas_akhir, keterangan, status } = req.body;
  if (req.file) {
    db.query("UPDATE programs SET judul = ?, jenis = ?, nama = ?, batas_akhir = ?, keterangan = ?, status = ?, poster = ? WHERE id = ?", [judul, jenis, nama, batas_akhir, keterangan, status, req.file.filename, req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Berhasil" });
    });
  } else {
    db.query("UPDATE programs SET judul = ?, jenis = ?, nama = ?, batas_akhir = ?, keterangan = ?, status = ? WHERE id = ?", [judul, jenis, nama, batas_akhir, keterangan, status, req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Berhasil" });
    });
  }
});
app.put('/api/programs/:id/status', (req, res) => {
  const { status } = req.body;
  db.query("UPDATE programs SET status = ? WHERE id = ?", [status, req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Berhasil" });
  });
});
app.delete('/api/programs/:id', (req, res) => {
  db.query("DELETE FROM programs WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Berhasil" });
  });
});

// GALERI
app.get('/api/galeri', (req, res) => {
  db.query("SELECT * FROM galeri ORDER BY id DESC", (err, results) => {
    res.json(results);
  });
});
app.post('/api/galeri', upload.single('image'), (req, res) => {
  const { title, description, category } = req.body;
  const image_url = req.file ? req.file.filename : null;
  db.query("INSERT INTO galeri (title, description, category, image_url) VALUES (?, ?, ?, ?)", [title, description, category, image_url], (err, results) => {
    res.json({ message: "Berhasil", id: results?.insertId });
  });
});
app.put('/api/galeri/:id', upload.single('image'), (req, res) => {
  const { title, category } = req.body;
  if (req.file) {
    db.query("UPDATE galeri SET title = ?, category = ?, image_url = ? WHERE id = ?", [title, category, req.file.filename, req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Berhasil" });
    });
  } else {
    db.query("UPDATE galeri SET title = ?, category = ? WHERE id = ?", [title, category, req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Berhasil" });
    });
  }
});
app.delete('/api/galeri/:id', (req, res) => {
  db.query("DELETE FROM galeri WHERE id = ?", [req.params.id], () => {
    res.json({ message: "Berhasil" });
  });
});

// RESERVASI
app.get('/api/reservasi', (req, res) => {
  db.query("SELECT * FROM reservasi ORDER BY id DESC", (err, results) => {
    res.json(results);
  });
});
app.post('/api/reservasi', (req, res) => {
  const { nama, whatsapp, email, instansi, tanggal, jumlah, pesan } = req.body;
  db.query("INSERT INTO reservasi (nama, whatsapp, email, instansi, tanggal, jumlah, pesan) VALUES (?, ?, ?, ?, ?, ?, ?)", [nama, whatsapp, email, instansi, tanggal, jumlah, pesan], () => {
    res.json({ message: "Berhasil" });
  });
});
app.put('/api/reservasi/:id/status', (req, res) => {
  db.query("UPDATE reservasi SET status = ? WHERE id = ?", [req.body.status, req.params.id], () => {
    res.json({ message: "Berhasil" });
  });
});
app.delete('/api/reservasi/:id', (req, res) => {
  db.query("DELETE FROM reservasi WHERE id = ?", [req.params.id], () => {
    res.json({ message: "Berhasil" });
  });
});

// PAKET WISATA
app.get('/api/paket', (req, res) => {
  db.query("SELECT * FROM paket_wisata", (err, results) => {
    res.json(results);
  });
});
app.put('/api/paket/:id', upload.single('gambar'), (req, res) => {
  const { nama_paket, harga, deskripsi } = req.body;
  if (req.file) {
    db.query("UPDATE paket_wisata SET nama_paket = ?, harga = ?, deskripsi = ?, gambar = ? WHERE id = ?", [nama_paket, harga, deskripsi, req.file.filename, req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Berhasil" });
    });
  } else {
    db.query("UPDATE paket_wisata SET nama_paket = ?, harga = ?, deskripsi = ? WHERE id = ?", [nama_paket, harga, deskripsi, req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Berhasil" });
    });
  }
});
app.post('/api/paket', upload.single('gambar'), (req, res) => {
  const { nama_paket, harga, deskripsi } = req.body;
  const gambar = req.file ? req.file.filename : null;
  db.query("INSERT INTO paket_wisata (nama_paket, harga, deskripsi, gambar) VALUES (?, ?, ?, ?)", [nama_paket, harga, deskripsi, gambar], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Berhasil" });
  });
});
app.delete('/api/paket/:id', (req, res) => {
  db.query("DELETE FROM paket_wisata WHERE id = ?", [req.params.id], () => {
    res.json({ message: "Berhasil" });
  });
});

// EVENTS
app.get('/api/events', (req, res) => {
  db.query("SELECT * FROM events ORDER BY id DESC", (err, results) => {
    res.json(results);
  });
});
app.post('/api/events', upload.single('image'), (req, res) => {
  const { title, category, date, description } = req.body;
  db.query("INSERT INTO events (title, category, date, description, image) VALUES (?, ?, ?, ?, ?)", [title, category, date, description, req.file ? req.file.filename : null], () => {
    res.json({ message: "Berhasil" });
  });
});
app.put('/api/events/:id', upload.single('image'), (req, res) => {
  const { title, category, date, description } = req.body;
  if (req.file) {
    db.query("UPDATE events SET title=?, category=?, date=?, description=?, image=? WHERE id=?", [title, category, date, description, req.file.filename, req.params.id], () => {
      res.json({ message: "Berhasil" });
    });
  } else {
    db.query("UPDATE events SET title=?, category=?, date=?, description=? WHERE id=?", [title, category, date, description, req.params.id], () => {
      res.json({ message: "Berhasil" });
    });
  }
});
app.delete('/api/events/:id', (req, res) => {
  db.query("DELETE FROM events WHERE id = ?", [req.params.id], () => {
    res.json({ message: "Berhasil" });
  });
});

// BLOGS
app.get('/api/blogs', (req, res) => {
  db.query("SELECT * FROM blogs ORDER BY id DESC", (err, results) => {
    res.json(results);
  });
});
app.post('/api/blogs', upload.single('image'), (req, res) => {
  const { title, date, excerpt, content } = req.body;
  const image = req.file ? req.file.filename : null;
  db.query("INSERT INTO blogs (title, date, excerpt, content, image) VALUES (?, ?, ?, ?, ?)", [title, date, excerpt, content, image], () => {
    res.json({ message: "Berhasil" });
  });
});
app.put('/api/blogs/:id', upload.single('image'), (req, res) => {
  const { title, date, excerpt, content } = req.body;
  if (req.file) {
    db.query("UPDATE blogs SET title=?, date=?, excerpt=?, content=?, image=? WHERE id=?", [title, date, excerpt, content, req.file.filename, req.params.id], () => {
      res.json({ message: "Berhasil" });
    });
  } else {
    db.query("UPDATE blogs SET title=?, date=?, excerpt=?, content=? WHERE id=?", [title, date, excerpt, content, req.params.id], () => {
      res.json({ message: "Berhasil" });
    });
  }
});
app.delete('/api/blogs/:id', (req, res) => {
  db.query("DELETE FROM blogs WHERE id = ?", [req.params.id], () => {
    res.json({ message: "Berhasil" });
  });
});

// APPOINTMENTS
app.get('/api/appointments', (req, res) => {
  db.query("SELECT * FROM appointments ORDER BY id DESC", (err, results) => {
    res.json(results);
  });
});
app.post('/api/appointments', (req, res) => {
  const { name, number, email, address, message } = req.body;
  db.query("INSERT INTO appointments (name, number, email, address, message) VALUES (?, ?, ?, ?, ?)", [name, number, email, address, message], () => {
    res.json({ message: "Berhasil" });
  });
});
app.put('/api/appointments/:id/status', (req, res) => {
  db.query("UPDATE appointments SET status = ? WHERE id = ?", [req.body.status, req.params.id], () => {
    res.json({ message: "Berhasil" });
  });
});
app.delete('/api/appointments/:id', (req, res) => {
  db.query("DELETE FROM appointments WHERE id = ?", [req.params.id], () => {
    res.json({ message: "Berhasil" });
  });
});

// LAYANAN
app.get('/api/layanan', (req, res) => {
  db.query("SELECT * FROM layanan ORDER BY id DESC", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.get('/api/layanan/:id', (req, res) => {
  db.query("SELECT * FROM layanan WHERE id = ?", [req.params.id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ message: "Not found" });
    res.json(results[0]);
  });
});

app.post('/api/layanan', upload.single('image'), (req, res) => {
  const { title, description } = req.body;
  const image = req.file ? req.file.filename : null;
  db.query("INSERT INTO layanan (title, description, image) VALUES (?, ?, ?)", [title, description, image], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Berhasil" });
  });
});

app.put('/api/layanan/:id', upload.single('image'), (req, res) => {
  const { title, description } = req.body;
  if (req.file) {
    db.query("UPDATE layanan SET title=?, description=?, image=? WHERE id=?", [title, description, req.file.filename, req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Berhasil" });
    });
  } else {
    db.query("UPDATE layanan SET title=?, description=? WHERE id=?", [title, description, req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Berhasil" });
    });
  }
});

app.delete('/api/layanan/:id', (req, res) => {
  db.query("DELETE FROM layanan WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Berhasil" });
  });
});

// ADMIN LOGIN
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.query("SELECT * FROM admin_users WHERE username = ?", [username], async (err, results) => {
    if (results.length === 0) return res.status(401).json({ error: "Username tidak ditemukan!" });
    const isMatch = await bcrypt.compare(password, results[0].password);
    if (!isMatch) return res.status(401).json({ error: "Password salah!" });
    res.json({ message: "Login berhasil", token: jwt.sign({ id: results[0].id, username: results[0].username }, JWT_SECRET, { expiresIn: '1d' }) });
  });
});
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Gagal" });
  res.json({ url: `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}` });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server Backend berjalan di http://localhost:${PORT}`));
