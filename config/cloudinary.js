// Konfigurasi Cloudinary.
// Kredensial HANYA dibaca dari environment (jangan hardcode / jangan commit).
// Variabel yang dipakai:
//   CLOUDINARY_CLOUD_NAME
//   CLOUDINARY_API_KEY
//   CLOUDINARY_API_SECRET
//   CLOUDINARY_UPLOAD_FOLDER (opsional, default "alfilaha")
const { v2: cloudinary } = require('cloudinary');

// Cloud name bukan rahasia. Default ke cloud milik Al Filaha agar folder
// tujuan tetap "alfilaha/<folder>" walau variabel ini lupa diisi di .env.
const CLOUD_NAME = String(process.env.CLOUDINARY_CLOUD_NAME || 'wmywxouj').trim();
const API_KEY = String(process.env.CLOUDINARY_API_KEY || '').trim();
const API_SECRET = String(process.env.CLOUDINARY_API_SECRET || '').trim();

const CLOUDINARY_FOLDER = String(process.env.CLOUDINARY_UPLOAD_FOLDER || 'alfilaha')
  .trim()
  .replace(/^\/+|\/+$/g, '');

let configured = false;

if (CLOUD_NAME && API_KEY && API_SECRET) {
  cloudinary.config({
    cloud_name: CLOUD_NAME,
    api_key: API_KEY,
    api_secret: API_SECRET,
    secure: true,
  });
  configured = true;
  console.log(`[Cloudinary] Aktif untuk cloud "${CLOUD_NAME}"`);
} else {
  console.warn(
    '[Cloudinary] Kredensial belum lengkap. Set CLOUDINARY_CLOUD_NAME, ' +
      'CLOUDINARY_API_KEY, dan CLOUDINARY_API_SECRET di .env sebelum mengunggah gambar.',
  );
}

const isConfigured = () => configured;

module.exports = { cloudinary, isConfigured, CLOUDINARY_FOLDER };
