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

const allowedOrigins = ['http://localhost:5173', 'https://alfilaha.id', 'http://192.168.1.32:5173']; // Tambahkan domain frontend Anda di sini

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

  // Auto-create tabel layanan
  const createLayananQuery = `
    CREATE TABLE IF NOT EXISTS layanan (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      image VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  db.query(createLayananQuery, (err) => {
    if (err) console.error("❌ Gagal membuat tabel layanan:", err);
    else console.log("✅ Tabel 'layanan' siap digunakan.");
  });

  // ==========================================
  // TAMBAHAN BARU: Auto-create tabel pendaftar_santri
  // ==========================================
  const createPendaftarSantriQuery = `
    CREATE TABLE IF NOT EXISTS pendaftar_santri (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nama VARCHAR(255) NOT NULL,
      tempat_lahir VARCHAR(100) NOT NULL,
      tanggal_lahir DATE NOT NULL,
      jenis_kelamin ENUM('L', 'P') NOT NULL,
      alamat TEXT NOT NULL,
      no_wa VARCHAR(20) NOT NULL,
      email VARCHAR(255),
      username VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      status_pendaftaran ENUM('Menunggu Verifikasi', 'Diterima', 'Ditolak') DEFAULT 'Menunggu Verifikasi',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  db.query(createPendaftarSantriQuery, (err) => {
    if (err) console.error("❌ Gagal membuat tabel pendaftar_santri:", err);
    else console.log("✅ Tabel 'pendaftar_santri' siap digunakan.");
  });

  // ==========================================
  // TAMBAHAN BARU: Auto-create tabel program_pendaftaran
  // ==========================================
  const createProgramPendaftaranQuery = `
    CREATE TABLE IF NOT EXISTS program_pendaftaran (
      id INT AUTO_INCREMENT PRIMARY KEY,
      judul VARCHAR(255) NOT NULL,
      jenis VARCHAR(100) NOT NULL,
      nama VARCHAR(255) NOT NULL,
      status VARCHAR(50) DEFAULT 'aktif',
      batas_akhir DATE,
      poster VARCHAR(255),
      keterangan LONGTEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  db.query(createProgramPendaftaranQuery, (err) => {
    if (err) console.error("❌ Gagal membuat tabel program_pendaftaran:", err);
    else console.log("✅ Tabel 'program_pendaftaran' siap digunakan.");
  });

  const createTanamanQuery = `
    CREATE TABLE IF NOT EXISTS tanaman (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nama VARCHAR(255) NOT NULL,
      jenis VARCHAR(100),
      lokasi VARCHAR(255),
      deskripsi TEXT,
      kondisi VARCHAR(50) DEFAULT 'Sehat',
      gambar VARCHAR(255),
      usia VARCHAR(100),
      jadwal_siram VARCHAR(100),
      penanggung_jawab VARCHAR(100),
      kebutuhan_air VARCHAR(100),
      terakhir_dipupuk VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  db.query(createTanamanQuery, (err) => {
    if (err) console.error("❌ Gagal membuat tabel tanaman:", err);
    else {
      console.log("✅ Tabel 'tanaman' siap digunakan.");
      // Migrasi kolom baru jika belum ada
      const addCols = `
        ALTER TABLE tanaman 
        ADD COLUMN IF NOT EXISTS usia VARCHAR(100),
        ADD COLUMN IF NOT EXISTS jadwal_siram VARCHAR(100),
        ADD COLUMN IF NOT EXISTS penanggung_jawab VARCHAR(100),
        ADD COLUMN IF NOT EXISTS kebutuhan_air VARCHAR(100),
        ADD COLUMN IF NOT EXISTS terakhir_dipupuk VARCHAR(100);
      `;
      db.query(addCols, (e) => {
        if(e && e.code !== 'ER_DUP_FIELDNAME') console.log("Info kolom tanaman: ", e.message);
      });
    }
  });

  const createLogPerawatanQuery = `
    CREATE TABLE IF NOT EXISTS log_perawatan (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tanaman_id INT NOT NULL,
      santri_id INT NOT NULL,
      jenis_tindakan ENUM('siram', 'pupuk') NOT NULL,
      waktu_tindakan TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tanaman_id) REFERENCES tanaman(id) ON DELETE CASCADE,
      FOREIGN KEY (santri_id) REFERENCES pendaftar_santri(id) ON DELETE CASCADE
    )
  `;
  db.query(createLogPerawatanQuery, (err) => {
    if (err) console.error("❌ Gagal membuat tabel log_perawatan:", err);
    else console.log("✅ Tabel 'log_perawatan' siap digunakan.");
  });
  const createFotoPerkembanganQuery = `
    CREATE TABLE IF NOT EXISTS foto_perkembangan (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tanaman_id INT NOT NULL,
      santri_id INT,
      petani_id INT,
      gambar VARCHAR(255) NOT NULL,
      waktu_upload TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tanaman_id) REFERENCES tanaman(id) ON DELETE CASCADE
    )
  `;
  db.query(createFotoPerkembanganQuery, (err) => {
    if (err) console.error("❌ Gagal membuat tabel foto_perkembangan:", err);
    else console.log("✅ Tabel 'foto_perkembangan' siap digunakan.");
  });
});

// Contoh Jalur (Endpoint) Testing
app.get('/api/test', (req, res) => {
  res.json({ message: 'Halo! Backend Node.js berhasil berjalan dan terhubung ke DB.' });
});

// ==========================================
// API PENDAFTARAN SANTRI (PUBLIC & AUTO-LOGIN)
// ==========================================

// 1. Submit Pendaftaran
app.post("/api/pendaftaran", async (req, res) => {
  const { nama, tempat_lahir, tanggal_lahir, jenis_kelamin, alamat, no_wa, email, username, password } = req.body;

  try {
    db.query("SELECT * FROM pendaftar_santri WHERE username = ?", [username], async (err, results) => {
      if (err) return res.status(500).json({ message: "Terjadi kesalahan server saat cek username." });
      
      if (results.length > 0) {
        return res.status(400).json({ message: "Username sudah digunakan, silakan pilih yang lain." });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const sql = `INSERT INTO pendaftar_santri (nama, tempat_lahir, tanggal_lahir, jenis_kelamin, alamat, no_wa, email, username, password) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const values = [nama, tempat_lahir, tanggal_lahir, jenis_kelamin, alamat, no_wa, email, username, hashedPassword];
      
      db.query(sql, values, (err, insertResult) => {
        if (err) return res.status(500).json({ message: "Gagal menyimpan data ke database.", error: err.message });

        const token = jwt.sign({ id: insertResult.insertId, username }, JWT_SECRET, { expiresIn: '30d' });
        res.status(201).json({ message: "Pendaftaran Berhasil", token });
      });
    });
  } catch (err) {
    res.status(500).json({ message: "Terjadi kesalahan server." });
  }
});


// Middleware untuk mengecek token santri/petani
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

// 1.5 Login Santri
app.post("/api/pendaftaran/login", (req, res) => {
  const { username, password } = req.body;
  
  db.query("SELECT * FROM pendaftar_santri WHERE username = ?", [username], async (err, results) => {
    if (err) return res.status(500).json({ message: "Terjadi kesalahan server saat login." });
    
    if (results.length === 0) {
      return res.status(401).json({ message: "Username tidak ditemukan." });
    }
    
    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(401).json({ message: "Password salah." });
    }
    
    const token = jwt.sign({ id: user.id, username: user.username, role: 'Santri' }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ message: "Login berhasil", token });
  });
});


// 2. Cek Status Pendaftaran (Auto-Login)
app.get("/api/pendaftaran/status", authenticateSantriToken, (req, res) => {
  const sql = "SELECT id, nama, tempat_lahir, DATE_FORMAT(tanggal_lahir, '%Y-%m-%d') as tanggal_lahir, jenis_kelamin, alamat, no_wa, email, username, status_pendaftaran FROM pendaftar_santri WHERE id = ?";
  
  db.query(sql, [req.user.id], (err, results) => {
    if (err) return res.status(500).json({ message: "Terjadi kesalahan saat mengambil status." });
    
    if (results.length === 0) {
      return res.status(404).json({ message: "Data tidak ditemukan." });
    }

    res.json(results[0]);
  });
});

// ==========================================
// API MANAJEMEN PENDAFTAR (ADMIN)
// ==========================================

app.get('/api/pendaftar_santri', (req, res) => {
  db.query("SELECT * FROM pendaftar_santri ORDER BY id DESC", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.put('/api/pendaftar_santri/:id/status', (req, res) => {
  const { status } = req.body;
  const query = "UPDATE pendaftar_santri SET status_pendaftaran = ? WHERE id = ?";
  
  db.query(query, [status, req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: `Status santri diperbarui menjadi ${status}` });
  });
});

app.delete('/api/pendaftar_santri/:id', (req, res) => {
  db.query("DELETE FROM pendaftar_santri WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Data santri berhasil dihapus" });
  });
});

// ==========================================
// API PROGRAMS (PROGRAM PENDAFTARAN)
// ==========================================

app.get('/api/programs', (req, res) => {
  db.query("SELECT * FROM program_pendaftaran ORDER BY id DESC", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.post('/api/programs', upload.single('poster'), (req, res) => {
  const { judul, jenis, nama, status, batas_akhir, keterangan } = req.body;
  const poster = req.file ? req.file.filename : null;
  
  const query = "INSERT INTO program_pendaftaran (judul, jenis, nama, status, batas_akhir, keterangan, poster) VALUES (?, ?, ?, ?, ?, ?, ?)";
  db.query(query, [judul, jenis, nama, status, batas_akhir, keterangan, poster], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Program berhasil ditambahkan", id: results.insertId });
  });
});

app.put('/api/programs/:id', upload.single('poster'), (req, res) => {
  const { judul, jenis, nama, status, batas_akhir, keterangan } = req.body;
  
  if (req.file) {
    const poster = req.file.filename;
    const query = "UPDATE program_pendaftaran SET judul=?, jenis=?, nama=?, status=?, batas_akhir=?, keterangan=?, poster=? WHERE id=?";
    db.query(query, [judul, jenis, nama, status, batas_akhir, keterangan, poster, req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Program beserta poster berhasil diperbarui" });
    });
  } else {
    const query = "UPDATE program_pendaftaran SET judul=?, jenis=?, nama=?, status=?, batas_akhir=?, keterangan=? WHERE id=?";
    db.query(query, [judul, jenis, nama, status, batas_akhir, keterangan, req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Program berhasil diperbarui" });
    });
  }
});

app.put('/api/programs/:id/status', (req, res) => {
  const { status } = req.body;
  const query = "UPDATE program_pendaftaran SET status = ? WHERE id = ?";
  
  db.query(query, [status, req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: `Status program diperbarui menjadi ${status}` });
  });
});

app.delete('/api/programs/:id', (req, res) => {
  db.query("DELETE FROM program_pendaftaran WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Program berhasil dihapus" });
  });
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
// API LAYANAN
// ==========================================

// Ambil Semua Layanan
app.get('/api/layanan', (req, res) => {
  db.query("SELECT * FROM layanan ORDER BY id DESC", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Ambil Satu Layanan berdasarkan ID
app.get('/api/layanan/:id', (req, res) => {
  db.query("SELECT * FROM layanan WHERE id = ?", [req.params.id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ error: "Layanan tidak ditemukan" });
    res.json(results[0]);
  });
});

// Tambah Layanan Baru
app.post('/api/layanan', upload.single('image'), (req, res) => {
  const { title, description } = req.body;
  const image = req.file ? req.file.filename : null;
  db.query("INSERT INTO layanan (title, description, image) VALUES (?, ?, ?)", [title, description, image], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Layanan berhasil ditambahkan", id: results.insertId });
  });
});

// Update Layanan
app.put('/api/layanan/:id', upload.single('image'), (req, res) => {
  const { title, description } = req.body;
  if (req.file) {
    db.query("UPDATE layanan SET title=?, description=?, image=? WHERE id=?", [title, description, req.file.filename, req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Layanan berhasil diperbarui" });
    });
  } else {
    db.query("UPDATE layanan SET title=?, description=? WHERE id=?", [title, description, req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Layanan berhasil diperbarui" });
    });
  }
});

// Hapus Layanan
app.delete('/api/layanan/:id', (req, res) => {
  db.query("DELETE FROM layanan WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Layanan berhasil dihapus" });
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

// ==========================================
// API TANAMAN
// ==========================================
app.get('/api/tanaman', (req, res) => {
  db.query("SELECT * FROM tanaman ORDER BY id DESC", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.get('/api/tanaman/:id', (req, res) => {
  db.query("SELECT * FROM tanaman WHERE id = ?", [req.params.id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ message: "Not found" });
    res.json(results[0]);
  });
});

app.post('/api/tanaman', upload.single('gambar'), (req, res) => {
  const { nama, jenis, lokasi, deskripsi, kondisi, usia, jadwal_siram, penanggung_jawab, kebutuhan_air, terakhir_dipupuk } = req.body;
  const gambar = req.file ? req.file.filename : null;
  db.query("INSERT INTO tanaman (nama, jenis, lokasi, deskripsi, kondisi, gambar, usia, jadwal_siram, penanggung_jawab, kebutuhan_air, terakhir_dipupuk) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [nama, jenis, lokasi, deskripsi, kondisi || 'Sehat', gambar, usia, jadwal_siram, penanggung_jawab, kebutuhan_air, terakhir_dipupuk], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Berhasil", id: results.insertId });
  });
});

app.put('/api/tanaman/:id', upload.single('gambar'), (req, res) => {
  const { nama, jenis, lokasi, deskripsi, kondisi, usia, jadwal_siram, penanggung_jawab, kebutuhan_air, terakhir_dipupuk } = req.body;
  if (req.file) {
    db.query("UPDATE tanaman SET nama=?, jenis=?, lokasi=?, deskripsi=?, kondisi=?, gambar=?, usia=?, jadwal_siram=?, penanggung_jawab=?, kebutuhan_air=?, terakhir_dipupuk=? WHERE id=?", [nama, jenis, lokasi, deskripsi, kondisi || 'Sehat', req.file.filename, usia, jadwal_siram, penanggung_jawab, kebutuhan_air, terakhir_dipupuk, req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Berhasil" });
    });
  } else {
    db.query("UPDATE tanaman SET nama=?, jenis=?, lokasi=?, deskripsi=?, kondisi=?, usia=?, jadwal_siram=?, penanggung_jawab=?, kebutuhan_air=?, terakhir_dipupuk=? WHERE id=?", [nama, jenis, lokasi, deskripsi, kondisi || 'Sehat', usia, jadwal_siram, penanggung_jawab, kebutuhan_air, terakhir_dipupuk, req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Berhasil" });
    });
  }
});

app.delete('/api/tanaman/:id', (req, res) => {
  db.query("DELETE FROM tanaman WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Berhasil" });
  });
});

// ==========================================
// API LOG PERAWATAN
// ==========================================
app.get('/api/log_perawatan', (req, res) => {
  const { tanaman_id } = req.query;
  let query = `
    SELECT 
      l.id, l.tanaman_id, l.jenis_tindakan, l.waktu_tindakan, l.gambar,
      t.nama AS nama_tanaman, 
      l.nama_perawat AS nama_santri, 
      l.role_perawat 
    FROM log_perawatan l 
    JOIN tanaman t ON l.tanaman_id = t.id
  `;
  const params = [];
  
  if (tanaman_id) {
    query += ` WHERE l.tanaman_id = ? `;
    params.push(tanaman_id);
  }
  
  query += ` ORDER BY l.waktu_tindakan DESC `;
  
  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.post('/api/log_perawatan', upload.single('gambar'), (req, res) => {
  const { tanaman_id, jenis_tindakan, nama_perawat, role_perawat } = req.body;
  const gambar = req.file ? req.file.filename : null;
  
  const finalNama = nama_perawat || "Pengunjung";
  const finalRole = role_perawat || "Pengunjung";

  db.query("INSERT INTO log_perawatan (tanaman_id, perawat_id, role_perawat, jenis_tindakan, gambar, nama_perawat) VALUES (?, ?, ?, ?, ?, ?)", [tanaman_id, 0, finalRole, jenis_tindakan, gambar, finalNama], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Perawatan berhasil dicatat" });
  });
});
// API FOTO PERKEMBANGAN
app.get('/api/foto_perkembangan/:tanaman_id', (req, res) => {
  const query = `
    SELECT *
    FROM foto_perkembangan
    WHERE tanaman_id = ?
    ORDER BY waktu_upload ASC
  `;
  db.query(query, [req.params.tanaman_id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.post('/api/foto_perkembangan', authenticateSantriToken, upload.single('gambar'), (req, res) => {
  const { tanaman_id } = req.body;
  const user_id = req.user.id;
  const role = req.user.role || 'Santri';
  const gambar = req.file ? req.file.filename : null;
  
  if (!gambar) return res.status(400).json({ error: "Gambar wajib diunggah" });

  let santri_id = null;
  let petani_id = null;
  if (role === 'Petani') {
    petani_id = user_id;
  } else {
    santri_id = user_id;
  }

  db.query("INSERT INTO foto_perkembangan (tanaman_id, santri_id, petani_id, gambar) VALUES (?, ?, ?, ?)", [tanaman_id, santri_id, petani_id, gambar], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Foto perkembangan berhasil diunggah", id: results.insertId, gambar });
  });
});

// Menyalakan Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server Backend berjalan di http://localhost:${PORT}`);
});
