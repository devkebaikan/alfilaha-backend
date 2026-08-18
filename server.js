const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Setup Multer for Image Uploads
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

const allowedOrigins = ['http://localhost:5173', 'https://alfilaha.id']; // Tambahkan domain frontend Anda di sini

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept']
}));

app.use(express.json());
app.use('/uploads', express.static('uploads')); // Serve uploaded images

// Konfigurasi Koneksi Database
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'db_alfilaha'
});

// Cek Koneksi ke MySQL
db.connect((err) => {
  if (err) {
    console.error('❌ Gagal koneksi ke database:', err);
    return;
  }
  console.log('✅ Berhasil terhubung ke MySQL (db_alfilaha)');
  
  // Auto-create tabel reservasi jika belum ada
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS reservasi (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nama VARCHAR(100) NOT NULL,
      whatsapp VARCHAR(20) NOT NULL,
      email VARCHAR(100),
      instansi VARCHAR(100),
      tanggal VARCHAR(50) NOT NULL,
      jumlah VARCHAR(100) NOT NULL,
      pesan TEXT,
      status VARCHAR(20) DEFAULT 'Pending'
    )
  `;
  db.query(createTableQuery, (err) => {
    if (err) console.error("❌ Gagal mengecek/membuat tabel reservasi:", err);
    else console.log("✅ Tabel 'reservasi' siap digunakan.");
  });

  // Auto-create tabel paket_wisata
  const createPaketQuery = `
    CREATE TABLE IF NOT EXISTS paket_wisata (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nama_paket VARCHAR(100) NOT NULL,
      harga VARCHAR(50) NOT NULL,
      deskripsi TEXT
    )
  `;
  db.query(createPaketQuery, (err) => {
    if (err) console.error("❌ Gagal membuat tabel paket_wisata:", err);
    else {
      console.log("✅ Tabel 'paket_wisata' siap digunakan.");
      // Seed data awal jika tabel masih kosong
      db.query("SELECT COUNT(*) AS count FROM paket_wisata", (err, results) => {
        if (!err && results[0].count === 0) {
          const seedQuery = "INSERT INTO paket_wisata (nama_paket, harga, deskripsi) VALUES ?";
          const seedValues = [
            ['Edukasi Basic', 'Rp 50.000 / orang', 'Fasilitas: Keliling kebun, panen sayur 1 macam, air mineral.'],
            ['Edukasi Premium', 'Rp 100.000 / orang', 'Fasilitas: Keliling kebun, panen sayur 3 macam, snack, sertifikat.'],
            ['Paket Wisata Keluarga', 'Rp 150.000 / keluarga', 'Fasilitas: Gazebo private, alat BBQ, panen buah sepuasnya.']
          ];
          db.query(seedQuery, [seedValues], (err) => {
            if(!err) console.log("✅ Data awal paket wisata berhasil dimasukkan.");
          });
        }
      });
    }
  });

  // Auto-create tabel events
  const createEventsQuery = `
    CREATE TABLE IF NOT EXISTS events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      category VARCHAR(100) NOT NULL,
      date VARCHAR(100) NOT NULL,
      description TEXT,
      image VARCHAR(255)
    )
  `;
  db.query(createEventsQuery, (err) => {
    if (err) console.error("❌ Gagal membuat tabel events:", err);
    else {
      console.log("✅ Tabel 'events' siap digunakan.");
      
      db.query("SELECT COUNT(*) AS count FROM events", (err, results) => {
        if (!err && results[0].count === 0) {
          const seedQuery = "INSERT INTO events (title, category, date, description, image) VALUES ?";
          const seedValues = [
            ['Pelatihan Pertanian Organik', 'Kegiatan', '15 Agu 2026', 'Workshop intensif tentang teknik pertanian organik dan sustainable farming untuk santri dan masyarakat umum.', null],
            ['Family Day: Berkebun Bersama', 'Event', '22 Agu 2026', 'Ajak keluarga untuk belajar berkebun dan menanam bersama di kebun Alfilaha. Aktivitas seru dan edukatif!', null],
            ['Komposting dan Pengelolaan Sampah', 'Workshop', '29 Agu 2026', 'Belajar cara mengolah sampah organik menjadi kompos berkualitas untuk kesuburan tanah.', null]
          ];
          db.query(seedQuery, [seedValues], (err) => {
            if(!err) console.log("✅ Data awal events berhasil dimasukkan.");
          });
        }
      });
    }
  });

  // Auto-create tabel blogs
  const createBlogsQuery = `
    CREATE TABLE IF NOT EXISTS blogs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      date VARCHAR(100) NOT NULL,
      excerpt TEXT,
      content LONGTEXT,
      image VARCHAR(255)
    )
  `;
  db.query(createBlogsQuery, (err) => {
    if (err) console.error("❌ Gagal membuat tabel blogs:", err);
    else {
      console.log("✅ Tabel 'blogs' siap digunakan.");
      
      db.query("SELECT COUNT(*) AS count FROM blogs", (err, results) => {
        if (!err && results[0].count === 0) {
          const seedQuery = "INSERT INTO blogs (title, date, excerpt, content, image) VALUES ?";
          const seedValues = [
            ['Menjaga Kualitas Beras Organik', '12 Okt 2023', 'Beras organik bebas dari pestisida buatan dan pupuk sintetis, sehingga lebih aman bagi...', '<p>Beras organik bebas dari pestisida buatan dan pupuk sintetis, sehingga lebih aman bagi kesehatan tubuh kita.</p>', null],
            ['Promo Spesial Ramadhan 1445H', '15 Okt 2023', 'Menyambut bulan suci Ramadhan, Alfilaha memberikan promo khusus untuk semua jenis...', '<p>Menyambut bulan suci Ramadhan, Alfilaha memberikan promo khusus untuk semua jenis produk beras.</p>', null]
          ];
          db.query(seedQuery, [seedValues], (err) => {
            if(!err) console.log("✅ Data awal blogs berhasil dimasukkan.");
          });
        }
      });
    }
  });

  // Auto-create tabel appointments
  const createAppointmentsQuery = `
    CREATE TABLE IF NOT EXISTS appointments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      number VARCHAR(20),
      email VARCHAR(100) NOT NULL,
      address TEXT,
      message TEXT,
      status VARCHAR(20) DEFAULT 'Pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  db.query(createAppointmentsQuery, (err) => {
    if (err) console.error("❌ Gagal membuat tabel appointments:", err);
    else console.log("✅ Tabel 'appointments' siap digunakan.");
  });


  // Auto-create tabel admin_users untuk Login
  const createAdminQuery = `
    CREATE TABLE IF NOT EXISTS admin_users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL
    )
  `;
  db.query(createAdminQuery, async (err) => {
    if (err) console.error("❌ Gagal membuat tabel admin_users:", err);
    else {
      console.log("✅ Tabel 'admin_users' siap digunakan.");
      // Seed default admin jika kosong (username: admin, password: admin123)
      db.query("SELECT COUNT(*) AS count FROM admin_users", async (err, results) => {
        if (!err && results[0].count === 0) {
          const hashedPassword = await bcrypt.hash("admin123", 10);
          db.query("INSERT INTO admin_users (username, password) VALUES (?, ?)", ['admin', hashedPassword], (err) => {
            if(!err) console.log("✅ Akun admin default berhasil dibuat (admin / admin123).");
          });
        }
      });
    }
  });

  // Auto-create tabel galeri
  const createGaleriQuery = `
    CREATE TABLE IF NOT EXISTS galeri (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      category VARCHAR(100) NOT NULL,
      image_url VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  db.query(createGaleriQuery, (err) => {
    if (err) console.error("❌ Gagal membuat tabel galeri:", err);
    else console.log("✅ Tabel 'galeri' siap digunakan.");
  });
});

// Contoh Jalur (Endpoint) Testing
app.get('/api/test', (req, res) => {
  res.json({ message: 'Halo! Backend Node.js berhasil berjalan dan terhubung ke DB.' });
});

// ==========================================
// API GALERI
// ==========================================

app.get('/api/galeri', (req, res) => {
  db.query("SELECT * FROM galeri ORDER BY id DESC", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.post('/api/galeri', upload.single('image'), (req, res) => {
  const { title, description, category } = req.body;
  const image_url = req.file ? req.file.filename : null;
  if (!image_url) return res.status(400).json({ error: "Image is required" });
  
  const query = "INSERT INTO galeri (title, description, category, image_url) VALUES (?, ?, ?, ?)";
  db.query(query, [title, description, category, image_url], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Foto berhasil ditambahkan", id: results.insertId });
  });
});

app.delete('/api/galeri/:id', (req, res) => {
  const query = "DELETE FROM galeri WHERE id = ?";
  db.query(query, [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Foto berhasil dihapus" });
  });
});

// ==========================================
// API RESERVASI
// ==========================================

// Ambil Semua Reservasi (Untuk Dashboard Admin)
app.get('/api/reservasi', (req, res) => {
  db.query("SELECT * FROM reservasi ORDER BY id DESC", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Buat Reservasi Baru (Dari Form Website Utama)
app.post('/api/reservasi', (req, res) => {
  const { nama, whatsapp, email, instansi, tanggal, jumlah, pesan } = req.body;
  const query = "INSERT INTO reservasi (nama, whatsapp, email, instansi, tanggal, jumlah, pesan) VALUES (?, ?, ?, ?, ?, ?, ?)";
  
  db.query(query, [nama, whatsapp, email, instansi, tanggal, jumlah, pesan], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Reservasi berhasil dikirim!", id: results.insertId });
  });
});

// Ubah Status Reservasi (Terima / Tolak dari Admin)
app.put('/api/reservasi/:id/status', (req, res) => {
  const { status } = req.body;
  const query = "UPDATE reservasi SET status = ? WHERE id = ?";
  
  db.query(query, [status, req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: `Status reservasi diperbarui menjadi ${status}` });
  });
});

// Hapus Reservasi (Dari Admin Dashboard)
app.delete('/api/reservasi/:id', (req, res) => {
  const query = "DELETE FROM reservasi WHERE id = ?";
  
  db.query(query, [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Data reservasi berhasil dihapus dari MySQL" });
  });
});

// ==========================================
// API PAKET WISATA
// ==========================================

// Ambil Semua Paket
app.get('/api/paket', (req, res) => {
  db.query("SELECT * FROM paket_wisata", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Update Paket (Harga, Nama, Deskripsi)
app.put('/api/paket/:id', (req, res) => {
  const { nama_paket, harga, deskripsi } = req.body;
  const query = "UPDATE paket_wisata SET nama_paket = ?, harga = ?, deskripsi = ? WHERE id = ?";
  
  db.query(query, [nama_paket, harga, deskripsi, req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Data paket wisata berhasil diperbarui" });
  });
});

// Tambah Paket Baru
app.post('/api/paket', (req, res) => {
  const { nama_paket, harga, deskripsi } = req.body;
  const query = "INSERT INTO paket_wisata (nama_paket, harga, deskripsi) VALUES (?, ?, ?)";
  
  db.query(query, [nama_paket, harga, deskripsi], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Paket wisata berhasil ditambahkan", id: results.insertId });
  });
});

// Hapus Paket
app.delete('/api/paket/:id', (req, res) => {
  const query = "DELETE FROM paket_wisata WHERE id = ?";
  
  db.query(query, [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Data paket wisata berhasil dihapus dari MySQL" });
  });
});

// ==========================================
// API EVENTS & KEGIATAN
// ==========================================

// Ambil Semua Event
app.get('/api/events', (req, res) => {
  db.query("SELECT * FROM events ORDER BY id DESC", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Tambah Event Baru (dengan upload gambar)
app.post('/api/events', upload.single('image'), (req, res) => {
  const { title, category, date, description } = req.body;
  const image = req.file ? req.file.filename : null;
  
  const query = "INSERT INTO events (title, category, date, description, image) VALUES (?, ?, ?, ?, ?)";
  db.query(query, [title, category, date, description, image], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Event berhasil ditambahkan", id: results.insertId });
  });
});

// Update Event (termasuk optional ganti gambar)
app.put('/api/events/:id', upload.single('image'), (req, res) => {
  const { title, category, date, description } = req.body;
  
  if (req.file) {
    const image = req.file.filename;
    const query = "UPDATE events SET title=?, category=?, date=?, description=?, image=? WHERE id=?";
    db.query(query, [title, category, date, description, image, req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Event beserta gambar berhasil diperbarui" });
    });
  } else {
    const query = "UPDATE events SET title=?, category=?, date=?, description=? WHERE id=?";
    db.query(query, [title, category, date, description, req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Event berhasil diperbarui" });
    });
  }
});

// Hapus Event
app.delete('/api/events/:id', (req, res) => {
  db.query("DELETE FROM events WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Event berhasil dihapus" });
  });
});

// ==========================================
// API BLOG GRID
// ==========================================

// Ambil Semua Blog
app.get('/api/blogs', (req, res) => {
  db.query("SELECT * FROM blogs ORDER BY id DESC", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Tambah Blog Baru
app.post('/api/blogs', upload.single('image'), (req, res) => {
  const { title, date, excerpt, content } = req.body;
  const image = req.file ? req.file.filename : null;
  
  const query = "INSERT INTO blogs (title, date, excerpt, content, image) VALUES (?, ?, ?, ?, ?)";
  db.query(query, [title, date, excerpt, content, image], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Blog berhasil ditambahkan", id: results.insertId });
  });
});

// Update Blog
app.put('/api/blogs/:id', upload.single('image'), (req, res) => {
  const { title, date, excerpt, content } = req.body;
  
  if (req.file) {
    const image = req.file.filename;
    const query = "UPDATE blogs SET title=?, date=?, excerpt=?, content=?, image=? WHERE id=?";
    db.query(query, [title, date, excerpt, content, image, req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Blog beserta gambar berhasil diperbarui" });
    });
  } else {
    const query = "UPDATE blogs SET title=?, date=?, excerpt=?, content=? WHERE id=?";
    db.query(query, [title, date, excerpt, content, req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Blog berhasil diperbarui" });
    });
  }
});

// Hapus Blog
app.delete('/api/blogs/:id', (req, res) => {
  db.query("DELETE FROM blogs WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Blog berhasil dihapus" });
  });
});

// ==========================================
// API APPOINTMENTS
// ==========================================

// Ambil Semua Appointments (Untuk Dashboard Admin)
app.get('/api/appointments', (req, res) => {
  db.query("SELECT * FROM appointments ORDER BY id DESC", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Buat Appointment Baru (Dari Form Website Utama)
app.post('/api/appointments', (req, res) => {
  const { name, number, email, address, message } = req.body;
  const query = "INSERT INTO appointments (name, number, email, address, message) VALUES (?, ?, ?, ?, ?)";
  
  db.query(query, [name, number, email, address, message], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Appointment berhasil dikirim!", id: results.insertId });
  });
});

// Ubah Status Appointment (Terima / Tolak dari Admin)
app.put('/api/appointments/:id/status', (req, res) => {
  const { status } = req.body;
  const query = "UPDATE appointments SET status = ? WHERE id = ?";
  
  db.query(query, [status, req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: `Status appointment diperbarui menjadi ${status}` });
  });
});

// Hapus Appointment (Dari Admin Dashboard)
app.delete('/api/appointments/:id', (req, res) => {
  const query = "DELETE FROM appointments WHERE id = ?";
  
  db.query(query, [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Data appointment berhasil dihapus dari MySQL" });
  });
});

// ==========================================
// API AUTENTIKASI (LOGIN ADMIN)
// ==========================================
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  db.query("SELECT * FROM admin_users WHERE username = ?", [username], async (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (results.length === 0) {
      return res.status(401).json({ error: "Username tidak ditemukan!" });
    }
    
    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(401).json({ error: "Password salah!" });
    }
    
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ message: "Login berhasil", token });
  });
});

// Endpoint untuk upload gambar sisipan dari React Quill
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Gagal mengupload gambar" });
  }
  // Kembalikan URL gambar agar bisa dirender oleh React Quill
  // Jika app berjalan di production (misal alfilaha.id), URL ini idealnya dinamis
  const protocol = req.protocol;
  const host = req.get('host');
  const imageUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
  res.json({ url: imageUrl });
});

// Menyalakan Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server Backend berjalan di http://localhost:${PORT}`);
});
