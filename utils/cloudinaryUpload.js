// Helper upload/hapus gambar Cloudinary.
// Semua fungsi bersifat best-effort: kegagalan hapus TIDAK pernah melempar
// error ke pemanggil agar request utama (update/hapus data) tetap berhasil.
const { cloudinary, isConfigured, CLOUDINARY_FOLDER } = require('../config/cloudinary');

const FOLDER_WHITELIST = [
  'donasi',
  'peternakan',
  'tanaman',
  'galeri',
  'kegiatan',
  'layanan',
  'user',
  'lainnya',
];

const FOLDER_DEFAULT = 'lainnya';

function resolveFolder(input) {
  const folder = String(input || '').trim().toLowerCase();
  return FOLDER_WHITELIST.includes(folder) ? folder : FOLDER_DEFAULT;
}

function isCloudinaryUrl(value) {
  return /^https?:\/\/res\.cloudinary\.com\//i.test(String(value || '').trim());
}

// Segmen transformasi Cloudinary, mis. "f_auto", "q_auto,w_400", "c_fill".
function looksLikeTransform(segment) {
  if (!segment) return false;
  if (segment.includes(',')) return true;
  return /^(f_|q_|w_|h_|c_|g_|e_|dpr_|ar_|x_|y_|r_|o_|b_|bo_|co_|dn_|dl_|fl_|fn_|fps_|if_|ki_|l_|p_|pg_|so_|sp_|t_|vc_|vs_|z_)/.test(
    segment,
  );
}

/**
 * Ambil public_id Cloudinary dari sebuah secure_url.
 * Contoh:
 *   https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_400/alfilaha/galeri/abc.jpg
 *   -> alfilaha/galeri/abc
 * Nilai non-URL (nama file lokal lama) mengembalikan null.
 */
function extractPublicId(value) {
  const url = String(value || '').trim();
  if (!url || !/^https?:\/\//i.test(url)) return null;

  const token = '/upload/';
  const idx = url.indexOf(token);
  if (idx === -1) return null;

  let rest = url.slice(idx + token.length);
  rest = rest.split('?')[0].split('#')[0];

  const segments = rest.split('/').filter(Boolean);
  while (segments.length > 1 && looksLikeTransform(segments[0])) {
    segments.shift();
  }

  let publicId = segments.join('/');
  // Buang versi (v1234567890/) bila ada.
  publicId = publicId.replace(/^v\d+\//, '');
  // Buang ekstensi file di segmen terakhir.
  publicId = publicId.replace(/\.[a-z0-9]+$/i, '');

  return publicId || null;
}

/**
 * Unggah buffer gambar ke Cloudinary.
 * @returns {Promise<{secure_url:string, public_id:string, width?:number, height?:number, format?:string, bytes?:number}>}
 */
function uploadToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    if (!isConfigured()) {
      return reject(
        new Error(
          'Cloudinary belum dikonfigurasi. Isi CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, dan CLOUDINARY_API_SECRET.',
        ),
      );
    }
    if (!buffer || !buffer.length) {
      return reject(new Error('File gambar kosong.'));
    }

    const folder = resolveFolder(options.folder);
    const destination = CLOUDINARY_FOLDER
      ? `${CLOUDINARY_FOLDER}/${folder}`
      : folder;

    const params = {
      folder: destination,
      resource_type: 'image',
      use_filename: true,
      unique_filename: true,
      overwrite: false,
    };

    let stream;
    try {
      stream = cloudinary.uploader.upload_stream(params, (error, result) => {
        if (error) return reject(error);
        if (!result || !result.secure_url) {
          return reject(new Error('Cloudinary tidak mengembalikan URL gambar.'));
        }
        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
        });
      });
    } catch (error) {
      return reject(error);
    }

    stream.on('error', reject);
    stream.end(buffer);
  });
}

/**
 * Hapus gambar dari Cloudinary berdasarkan public_id ATAU secure_url.
 * Tidak melempar error (best-effort), hanya mengembalikan boolean.
 */
async function deleteFromCloudinary(value) {
  const raw = String(value || '').trim();
  if (!raw) return false;

  const publicId = isCloudinaryUrl(raw) ? extractPublicId(raw) : raw;
  if (!publicId || !isConfigured()) return false;

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'image',
      invalidate: true,
    });
    return result && (result.result === 'ok' || result.result === 'not found');
  } catch (error) {
    console.warn('[Cloudinary] Gagal menghapus gambar:', publicId, '-', error.message);
    return false;
  }
}

module.exports = {
  FOLDER_WHITELIST,
  FOLDER_DEFAULT,
  resolveFolder,
  isCloudinaryUrl,
  extractPublicId,
  uploadToCloudinary,
  deleteFromCloudinary,
};
