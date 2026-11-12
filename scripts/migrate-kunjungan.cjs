const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'db_alfilaha'
  });

  try {
    console.log('Membuat tabel kunjungan...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS kunjungan (
        id INT AUTO_INCREMENT PRIMARY KEY,
        jenis ENUM('eduwisata','kamping','studi_banding','olahraga','resto') NOT NULL,
        nama_instansi VARCHAR(255) NOT NULL,
        jenis_rombongan VARCHAR(100),
        nama_pic VARCHAR(150) NOT NULL,
        no_wa_pic VARCHAR(30) NOT NULL,
        jumlah_peserta INT NOT NULL DEFAULT 0,
        jumlah_pendamping INT NOT NULL DEFAULT 0,
        tanggal_kunjungan DATE NOT NULL,
        jam_mulai TIME,
        jam_selesai TIME,
        status ENUM('baru','dikonfirmasi','berlangsung','selesai','batal') NOT NULL DEFAULT 'baru',
        catat_biaya TINYINT(1) NOT NULL DEFAULT 0,
        total_biaya INT DEFAULT 0,
        dp INT DEFAULT 0,
        status_bayar ENUM('belum_bayar','dp','lunas') DEFAULT 'belum_bayar',
        catatan_internal TEXT,
        data_khusus TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('Tabel kunjungan OK.');

    console.log('Membuat tabel kunjungan_riwayat_status...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS kunjungan_riwayat_status (
        id INT AUTO_INCREMENT PRIMARY KEY,
        kunjungan_id INT NOT NULL,
        status VARCHAR(30) NOT NULL,
        waktu TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (kunjungan_id) REFERENCES kunjungan(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('Tabel kunjungan_riwayat_status OK.');

    console.log('Membuat tabel kunjungan_foto...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS kunjungan_foto (
        id INT AUTO_INCREMENT PRIMARY KEY,
        kunjungan_id INT NOT NULL,
        path VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (kunjungan_id) REFERENCES kunjungan(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('Tabel kunjungan_foto OK.');

  } catch (err) {
    console.error('Error migrasi kunjungan:', err);
  } finally {
    await connection.end();
  }
}

run();
