#!/usr/bin/env node
// Migrasi gambar lama (folder ./uploads) ke Cloudinary.
//
// Default: DRY-RUN (hanya menghitung, tidak mengunggah/mengubah database).
// Terapkan perubahan: node scripts/migrate-images.js --apply
//
// Catatan:
// - File lokal TIDAK dihapus otomatis. Setelah yakin, hapus manual bila perlu.
// - Kredensial dibaca dari .env (CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET).
// - Nilai yang sudah berupa URL Cloudinary atau URL eksternal dilewati.
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const { isConfigured } = require('../config/cloudinary');
const {
  uploadToCloudinary,
  isCloudinaryUrl,
} = require('../utils/cloudinaryUpload');

const APPLY = process.argv.includes('--apply');
const UPLOAD_DIR = path.resolve(__dirname, '..', 'uploads');
const EKSTENSI_DIIZINKAN = ['.jpg', '.jpeg', '.png', '.webp'];

// Kolom gambar tunggal per tabel. `folder` mengikuti whitelist Cloudinary.
const KOLOM_GAMBAR = [
  { table: 'galeri', column: 'image_url', id: 'id', folder: 'galeri' },
  { table: 'paket_wisata', column: 'gambar', id: 'id', folder: 'kegiatan' },
  { table: 'events', column: 'image', id: 'id', folder: 'kegiatan' },
  { table: 'blogs', column: 'image', id: 'id', folder: 'kegiatan' },
  { table: 'layanan', column: 'image', id: 'id', folder: 'layanan' },
  { table: 'layanan_usaha', column: 'foto', id: 'id', folder: 'layanan' },
  { table: 'tanaman', column: 'gambar', id: 'id', folder: 'tanaman' },
  { table: 'ternak', column: 'foto', id: 'id', folder: 'peternakan' },
  { table: 'kelas', column: 'foto', id: 'id', folder: 'kegiatan' },
  { table: 'aktivitas_kelas', column: 'foto', id: 'id', folder: 'kegiatan' },
  { table: 'program_pendaftaran', column: 'poster', id: 'id', folder: 'kegiatan' },
  { table: 'activity_tasks', column: 'foto_bukti', id: 'id', folder: 'kegiatan' },
  { table: 'kunjungan_foto', column: 'path', id: 'id', folder: 'kegiatan' },
  { table: 'log_perawatan', column: 'gambar', id: 'id', folder: 'tanaman' },
  { table: 'log_perawatan_ternak', column: 'foto', id: 'id', folder: 'peternakan' },
  { table: 'foto_perkembangan', column: 'gambar', id: 'id', folder: 'tanaman' },
  { table: 'absensi_santri', column: 'foto', id: 'id', folder: 'kegiatan' },
];

// Kolom teks/HTML yang mungkin memuat gambar inline /uploads/...
const KOLOM_HTML = [
  { table: 'blogs', column: 'content', id: 'id', folder: 'kegiatan' },
  { table: 'layanan', column: 'description', id: 'id', folder: 'layanan' },
  { table: 'layanan_usaha', column: 'deskripsi', id: 'id', folder: 'layanan' },
  { table: 'paket_wisata', column: 'deskripsi', id: 'id', folder: 'kegiatan' },
];

const ringkasan = {
  berhasil: 0,
  gagal: 0,
  dilewati: 0,
  siap: 0, // dry-run: akan dimigrasi
  fileTidakAda: 0,
};

const logGagal = [];

function catatGagal(table, id, nilai, pesan) {
  ringkasan.gagal += 1;
  const baris = `[GAGAL] ${table}#${id}: ${pesan} | nilai="${String(nilai).slice(0, 120)}"`;
  logGagal.push(baris);
  console.error(baris);
}

function ekstrakNamaFileLokal(value) {
  let s = String(value || '').trim();
  if (!s) return null;

  if (/^https?:\/\//i.test(s)) {
    const match = s.match(/\/uploads\/(.+?)(?:[?#]|$)/i);
    if (!match) return null;
    s = match[1];
  }

  s = s.replace(/^\/?uploads[\\/]/i, '');
  s = s.split('?')[0].split('#')[0];
  s = s.replace(/\\/g, '/');
  return path.basename(s);
}

async function unggahSatu(namaFile, folder) {
  const ext = path.extname(namaFile).toLowerCase();
  if (!EKSTENSI_DIIZINKAN.includes(ext)) {
    throw new Error(`ekstensi ${ext || '(tanpa ekstensi)'} bukan gambar yang didukung`);
  }
  const jalur = path.join(UPLOAD_DIR, namaFile);
  if (!fs.existsSync(jalur)) {
    const error = new Error(`file lokal tidak ditemukan: ${jalur}`);
    error.fileTidakAda = true;
    throw error;
  }
  const buffer = fs.readFileSync(jalur);
  return uploadToCloudinary(buffer, { folder, filename: namaFile });
}

async function migrasiKolomGambar(db, target) {
  let rows;
  try {
    [rows] = await db.query(
      `SELECT \`${target.id}\` AS __id, \`${target.column}\` AS __val FROM \`${target.table}\``,
    );
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_FIELD_ERROR') {
      console.log(`↷ Lewati ${target.table}.${target.column} (tabel/kolom tidak ada)`);
      return;
    }
    throw error;
  }

  for (const row of rows) {
    const nilai = row.__val;
    if (nilai === null || nilai === undefined || String(nilai).trim() === '') {
      ringkasan.dilewati += 1;
      continue;
    }
    if (isCloudinaryUrl(nilai)) {
      ringkasan.dilewati += 1;
      continue;
    }
    if (/^https?:\/\//i.test(String(nilai)) && !/\/uploads\//i.test(String(nilai))) {
      ringkasan.dilewati += 1;
      continue;
    }

    const namaFile = ekstrakNamaFileLokal(nilai);
    if (!namaFile) {
      ringkasan.dilewati += 1;
      continue;
    }

    if (!APPLY) {
      const jalur = path.join(UPLOAD_DIR, namaFile);
      if (!fs.existsSync(jalur)) {
        catatGagal(target.table, row.__id, nilai, 'file lokal tidak ditemukan');
      } else {
        ringkasan.siap += 1;
      }
      continue;
    }

    try {
      const hasil = await unggahSatu(namaFile, target.folder);
      await db.query(
        `UPDATE \`${target.table}\` SET \`${target.column}\` = ? WHERE \`${target.id}\` = ?`,
        [hasil.secure_url, row.__id],
      );
      ringkasan.berhasil += 1;
      console.log(`✅ ${target.table}.${target.column}#${row.__id} → ${namaFile}`);
    } catch (error) {
      if (error.fileTidakAda) ringkasan.fileTidakAda += 1;
      catatGagal(target.table, row.__id, nilai, error.message);
    }
  }
}

async function migrasiKolomHtml(db, target) {
  let rows;
  try {
    [rows] = await db.query(
      `SELECT \`${target.id}\` AS __id, \`${target.column}\` AS __val FROM \`${target.table}\``,
    );
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_FIELD_ERROR') {
      console.log(`↷ Lewati ${target.table}.${target.column} (tabel/kolom tidak ada)`);
      return;
    }
    throw error;
  }

  const pola = /((?:https?:\/\/[^\s"'<>]+)?\/uploads\/[^\s"'<>)]+)/gi;

  for (const row of rows) {
    const html = String(row.__val || '');
    const cocok = [...html.matchAll(pola)].map((m) => m[1]);
    if (!cocok.length) continue;

    const unik = [...new Set(cocok)];
    const pengganti = new Map();

    for (const urlLama of unik) {
      const namaFile = ekstrakNamaFileLokal(urlLama);
      if (!namaFile) {
        ringkasan.dilewati += 1;
        continue;
      }

      if (!APPLY) {
        const jalur = path.join(UPLOAD_DIR, namaFile);
        if (fs.existsSync(jalur)) ringkasan.siap += 1;
        else catatGagal(target.table, row.__id, urlLama, 'file lokal tidak ditemukan');
        continue;
      }

      try {
        const hasil = await unggahSatu(namaFile, target.folder);
        pengganti.set(urlLama, hasil.secure_url);
        ringkasan.berhasil += 1;
        console.log(`✅ ${target.table}.${target.column}#${row.__id} (inline) → ${namaFile}`);
      } catch (error) {
        if (error.fileTidakAda) ringkasan.fileTidakAda += 1;
        catatGagal(target.table, row.__id, urlLama, error.message);
      }
    }

    if (APPLY && pengganti.size) {
      let htmlBaru = html;
      for (const [lama, baru] of pengganti.entries()) {
        htmlBaru = htmlBaru.split(lama).join(baru);
      }
      if (htmlBaru !== html) {
        await db.query(
          `UPDATE \`${target.table}\` SET \`${target.column}\` = ? WHERE \`${target.id}\` = ?`,
          [htmlBaru, row.__id],
        );
      }
    }
  }
}

async function main() {
  console.log('──────────────────────────────────────────────────────────────');
  console.log(`Migrasi gambar lokal → Cloudinary (${APPLY ? 'APPLY' : 'DRY-RUN'})`);
  console.log(`Folder lokal : ${UPLOAD_DIR}`);
  console.log('──────────────────────────────────────────────────────────────');

  if (APPLY && !isConfigured()) {
    console.error('❌ Cloudinary belum dikonfigurasi. Isi kredensial di .env lalu jalankan ulang.');
    process.exitCode = 1;
    return;
  }

  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    for (const target of KOLOM_GAMBAR) {
      console.log(`\n▸ ${target.table}.${target.column}`);
      await migrasiKolomGambar(db, target);
    }
    for (const target of KOLOM_HTML) {
      console.log(`\n▸ ${target.table}.${target.column} (gambar inline)`);
      await migrasiKolomHtml(db, target);
    }
  } finally {
    await db.end();
  }

  console.log('\n──────────────────────────────────────────────────────────────');
  console.log('Ringkasan');
  if (APPLY) {
    console.log(`  Berhasil diunggah & diperbarui : ${ringkasan.berhasil}`);
    console.log(`  Gagal                          : ${ringkasan.gagal}`);
    console.log(`  Dilewati (sudah URL/kosong)    : ${ringkasan.dilewati}`);
    console.log(`  File lokal tidak ditemukan     : ${ringkasan.fileTidakAda}`);
  } else {
    console.log(`  Siap dimigrasi                 : ${ringkasan.siap}`);
    console.log(`  Gagal (file tidak ada, dll)    : ${ringkasan.gagal}`);
    console.log(`  Dilewati (sudah URL/kosong)    : ${ringkasan.dilewati}`);
    console.log('\n  Ini DRY-RUN — tidak ada file/database yang diubah.');
    console.log('  Jalankan ulang dengan --apply untuk menerapkan.');
  }
  console.log('  File lokal TIDAK dihapus otomatis.');

  if (logGagal.length) {
    console.log('\nDetail kegagalan:');
    logGagal.forEach((baris) => console.log(`  ${baris}`));
  }
  console.log('──────────────────────────────────────────────────────────────');
}

main().catch((error) => {
  console.error('❌ Migrasi gagal:', error.message);
  process.exitCode = 1;
});
