require("dotenv").config();
const mysql = require("mysql2/promise");

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "db_alfilaha",
  });

  try {
    console.log("[Migrate] Membuat tabel layanan_usaha...");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS layanan_usaha (
        id INT AUTO_INCREMENT PRIMARY KEY,
        slug VARCHAR(60) UNIQUE NOT NULL,
        nama VARCHAR(100) NOT NULL,
        ringkasan VARCHAR(200),
        deskripsi TEXT,
        foto VARCHAR(255),
        judul_blok VARCHAR(100),
        harga_mulai INT,
        satuan_harga VARCHAR(40),
        label_tombol VARCHAR(40) NOT NULL DEFAULT 'Ajukan kunjungan',
        nomor_wa VARCHAR(20),
        url_eksternal VARCHAR(255),
        teks_tombol_eksternal VARCHAR(40),
        status ENUM('draft','dipublikasikan') NOT NULL DEFAULT 'draft',
        urutan INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("✅ Tabel layanan_usaha berhasil dibuat");

    console.log("[Migrate] Membuat tabel layanan_usaha_item...");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS layanan_usaha_item (
        id INT AUTO_INCREMENT PRIMARY KEY,
        layanan_id INT NOT NULL,
        nama VARCHAR(150) NOT NULL,
        keterangan VARCHAR(100),
        urutan INT NOT NULL DEFAULT 0,
        ekosistem_tipe VARCHAR(40),
        ekosistem_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (layanan_id) REFERENCES layanan_usaha(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("✅ Tabel layanan_usaha_item berhasil dibuat");

    console.log("[Migrate] Membuat tabel layanan_usaha_fasilitas...");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS layanan_usaha_fasilitas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        layanan_id INT NOT NULL,
        teks VARCHAR(80) NOT NULL,
        urutan INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (layanan_id) REFERENCES layanan_usaha(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("✅ Tabel layanan_usaha_fasilitas berhasil dibuat");

    // Seed data awal
    console.log("[Migrate] Memasukkan data awal 5 layanan...");
    const seedData = [
      ["kamping", "Kamping", "Tarif dan sewa", "Ajukan kunjungan", 2],
      [
        "studi-banding",
        "Studi banding",
        "Topik yang bisa dipelajari",
        "Ajukan kunjungan",
        3,
      ],
      [
        "olahraga",
        "Olahraga",
        "Sarana dan tarif per jam",
        "Ajukan pemakaian",
        4,
      ],
      ["resto", "Resto", "Paket rombongan", "Ajukan kunjungan", 5],
    ];

    for (const [slug, nama, judul_blok, label_tombol, urutan] of seedData) {
      await connection.query(
        `INSERT IGNORE INTO layanan_usaha (slug, nama, judul_blok, label_tombol, status, urutan) VALUES (?, ?, ?, ?, 'draft', ?)`,
        [slug, nama, judul_blok, label_tombol, urutan],
      );
      console.log(`  ✅ Seed layanan ${nama} OK`);
    }

    console.log("\n[Migrate] Migrasi layanan_usaha selesai!");
  } catch (err) {
    console.error("[Migrate Error]:", err.message);
    throw err;
  } finally {
    await connection.end();
  }
}

migrate().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
