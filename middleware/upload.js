// Middleware upload gambar -> penyimpanan lokal ./uploads (tanpa Cloudinary).
//
// Semua route memakai `req.file.filename` / `req.files.*[].filename` sebagai
// nama file. Frontend menormalkannya lewat resolveImageUrl() menjadi
// `${API}/uploads/<nama-file>`. File disajikan oleh express.static('/uploads').
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const TIPE_IZIN = ['image/jpeg', 'image/png', 'image/webp'];
const DIR_UPLOAD = './uploads';
const MAX_SISI = 1600;
const KUALITAS = 80;

function fileFilter(label) {
  return function (req, file, cb) {
    if (TIPE_IZIN.includes(String(file.mimetype || '').toLowerCase())) {
      return cb(null, true);
    }
    const error = new Error(
      `Hanya file gambar JPG/PNG/WebP yang diperbolehkan${label ? ` untuk ${label}` : ''}.`,
    );
    error.code = 'INVALID_FILE_TYPE';
    return cb(error);
  };
}

function ekstensiImage(nama) {
  return /\.(jpe?g|png|webp)$/i.test(nama);
}

function encFormater(format) {
  if (format === 'png') return 'png';
  if (format === 'webp') return 'webp';
  return 'jpeg';
}

function encOptions(format) {
  if (format === 'png') return { compressionLevel: 9, palette: true };
  if (format === 'webp') return { quality: KUALITAS };
  return { quality: KUALITAS, mozjpeg: true };
}

// Simpan file ke ./uploads: auto-rotate, resize maks 1600px, re-encode agar
// ringan, dan buat thumbnail ±400px. Nama file unik (timestamp + acak) supaya
// dua file dalam satu request tidak saling menimpa.
const localSharpStorage = {
  _handleFile(req, file, cb) {
    if (!fs.existsSync(DIR_UPLOAD)) fs.mkdirSync(DIR_UPLOAD, { recursive: true });

    let ext = path.extname(file.originalname || '').toLowerCase();
    if (!/^\.[a-z0-9]+$/.test(ext)) ext = '.jpg';
    const nama = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const jalur = path.join(DIR_UPLOAD, nama);
    const chunks = [];

    file.stream.on('data', (chunk) => chunks.push(chunk));
    file.stream.on('error', (error) => cb(error));
    file.stream.on('end', async () => {
      const bufferAwal = Buffer.concat(chunks);

      if (!ekstensiImage(nama) || !/^image\//.test(file.mimetype)) {
        return fs.writeFile(jalur, bufferAwal, (error) =>
          error
            ? cb(error)
            : cb(null, {
                filename: nama,
                size: bufferAwal.length,
                path: jalur,
                mimetype: file.mimetype,
                originalname: file.originalname,
              }),
        );
      }

      try {
        const metadata = await sharp(bufferAwal, { failOn: 'none' }).metadata();
        const formatAman = ['jpeg', 'png', 'webp'].includes(metadata.format)
          ? metadata.format
          : 'jpeg';

        const bufferUkur = await sharp(bufferAwal, { failOn: 'none' })
          .rotate()
          .resize({
            width: MAX_SISI,
            height: MAX_SISI,
            fit: 'inside',
            withoutEnlargement: true,
          })
          [encFormater(formatAman)](encOptions(formatAman))
          .toBuffer();

        // Jangan perbesar ukuran file: pakai hasil optimasi hanya bila lebih kecil.
        const bufferTulis = bufferUkur.length < bufferAwal.length ? bufferUkur : bufferAwal;

        fs.writeFile(jalur, bufferTulis, async (error) => {
          if (error) return cb(error);

          // Thumbnail opsional; kalau gagal, upload utama tetap berhasil.
          const bagian = path.parse(nama);
          const jalurThumb = path.join(DIR_UPLOAD, `${bagian.name}-thumb${bagian.ext}`);
          try {
            const bufferThumb = await sharp(bufferAwal, { failOn: 'none' })
              .rotate()
              .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
              [encFormater(formatAman)](encOptions(formatAman))
              .toBuffer();
            fs.writeFile(jalurThumb, bufferThumb, () => {});
          } catch (errorThumb) {
            // Lewati thumbnail bila gambar tidak bisa diproses.
          }

          cb(null, {
            filename: nama,
            size: bufferTulis.length,
            path: jalur,
            mimetype: file.mimetype,
            originalname: file.originalname,
          });
        });
      } catch (errorGambar) {
        // Format tidak dikenal Sharp: simpan file asli supaya CRUD tidak gagal.
        fs.writeFile(jalur, bufferAwal, (error) =>
          error
            ? cb(error)
            : cb(null, {
                filename: nama,
                size: bufferAwal.length,
                path: jalur,
                mimetype: file.mimetype,
                originalname: file.originalname,
              }),
        );
      }
    });
  },

  _removeFile(req, file, cb) {
    if (!file || !file.path) return cb(null);
    fs.unlink(file.path, () => {
      const bagian = path.parse(file.path);
      fs.unlink(path.join(bagian.dir, `${bagian.name}-thumb${bagian.ext}`), () => {});
      cb(null);
    });
  },
};

const upload = multer({
  storage: localSharpStorage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: fileFilter(),
});

const uploadFoto = multer({
  storage: localSharpStorage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: fileFilter(),
});

const uploadTugas = multer({
  storage: localSharpStorage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: fileFilter('bukti tugas'),
});

// Nama lama dipertahankan agar route yang belum sempat diubah tetap jalan.
// Sekarang SEMUA memakai penyimpanan lokal, bukan memory/Cloudinary.
const uploadCloud = upload;

module.exports = {
  MAX_FILE_SIZE,
  TIPE_IZIN,
  upload,
  uploadFoto,
  uploadTugas,
  uploadCloud,
};
