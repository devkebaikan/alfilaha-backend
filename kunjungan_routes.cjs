// ─────────────────────────────────────────────────────────────────────────────
// MODUL ADMIN: LAYANAN & USAHA (KUNJUNGAN)
// ─────────────────────────────────────────────────────────────────────────────

const VALID_JENIS_KUNJUNGAN = ['eduwisata', 'kamping', 'studi_banding', 'olahraga', 'resto'];
const VALID_STATUS_KUNJUNGAN = ['baru', 'dikonfirmasi', 'berlangsung', 'selesai', 'batal'];
const VALID_STATUS_BAYAR = ['belum_bayar', 'dp', 'lunas'];

// Helper sanitasi data_khusus berdasarkan jenis
function sanitizeDataKhusus(jenis, rawData) {
  if (!rawData || typeof rawData !== 'object') return null;
  const cleaned = {};
  if (jenis === 'eduwisata') {
    if (Array.isArray(rawData.paket)) {
      cleaned.paket = rawData.paket.filter(p => ['kebun_anggur', 'peternakan', 'tanam_pohon', 'paket_lengkap'].includes(p));
    } else {
      cleaned.paket = [];
    }
    cleaned.lokasi_area = typeof rawData.lokasi_area === 'string' ? rawData.lokasi_area.trim() : null;
    cleaned.pemandu = typeof rawData.pemandu === 'string' ? rawData.pemandu.trim() : null;
  } else if (jenis === 'kamping') {
    cleaned.area_kamping = typeof rawData.area_kamping === 'string' ? rawData.area_kamping.trim() : null;
    cleaned.jumlah_tenda = Number.isInteger(Number(rawData.jumlah_tenda)) ? Number(rawData.jumlah_tenda) : 0;
    cleaned.tanggal_check_out = typeof rawData.tanggal_check_out === 'string' ? rawData.tanggal_check_out.trim() : null;
    cleaned.sewa_perlengkapan = typeof rawData.sewa_perlengkapan === 'string' ? rawData.sewa_perlengkapan.trim() : null;
    cleaned.konsumsi_api_unggun = typeof rawData.konsumsi_api_unggun === 'string' ? rawData.konsumsi_api_unggun.trim() : null;
  } else if (jenis === 'studi_banding') {
    cleaned.tujuan_studi = typeof rawData.tujuan_studi === 'string' ? rawData.tujuan_studi.trim() : null;
    cleaned.narasumber = typeof rawData.narasumber === 'string' ? rawData.narasumber.trim() : null;
    cleaned.jadwal_sesi = typeof rawData.jadwal_sesi === 'string' ? rawData.jadwal_sesi.trim() : null;
    cleaned.notulen = typeof rawData.notulen === 'string' ? rawData.notulen.trim() : null;
  } else if (jenis === 'olahraga') {
    cleaned.jenis_olahraga = typeof rawData.jenis_olahraga === 'string' ? rawData.jenis_olahraga.trim() : null;
    cleaned.lapangan = typeof rawData.lapangan === 'string' ? rawData.lapangan.trim() : null;
    cleaned.tim_komunitas = typeof rawData.tim_komunitas === 'string' ? rawData.tim_komunitas.trim() : null;
  } else if (jenis === 'resto') {
    cleaned.paket_menu = typeof rawData.paket_menu === 'string' ? rawData.paket_menu.trim() : null;
    cleaned.total_tagihan = Number.isInteger(Number(rawData.total_tagihan)) ? Number(rawData.total_tagihan) : 0;
  }
  return JSON.stringify(cleaned);
}

// 1. GET /api/admin/kunjungan - Daftar Kunjungan
app.get('/api/admin/kunjungan', authenticateAdminToken, async (req, res, next) => {
  try {
    const jenis = String(req.query.jenis || '').trim();
    if (!VALID_JENIS_KUNJUNGAN.includes(jenis)) {
      return res.status(400).json({ message: 'Jenis kunjungan wajib diisi dan harus valid.' });
    }
    const status = String(req.query.status || '').trim();
    const q = String(req.query.q || '').trim();
    const bulan = String(req.query.bulan || '').trim(); // Format YYYY-MM
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 10));
    const offset = (page - 1) * limit;

    let whereClauses = ['jenis = ?'];
    let queryParams = [jenis];

    if (status && VALID_STATUS_KUNJUNGAN.includes(status)) {
      whereClauses.push('status = ?');
      queryParams.push(status);
    }
    if (q) {
      whereClauses.push('(nama_instansi LIKE ? OR nama_pic LIKE ?)');
      queryParams.push(`%${q}%`, `%${q}%`);
    }
    if (bulan && /^\d{4}-\d{2}$/.test(bulan)) {
      whereClauses.push('DATE_FORMAT(tanggal_kunjungan, "%Y-%m") = ?');
      queryParams.push(bulan);
    }

    const whereSql = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';

    // Hitung total
    const countSql = `SELECT COUNT(*) as total FROM kunjungan ${whereSql}`;
    const [countRows] = await db.promise().query(countSql, queryParams);
    const total = countRows[0].total;

    // Ambil data (urut tanggal terbaru DESC, lalu id DESC)
    const dataSql = `SELECT * FROM kunjungan ${whereSql} ORDER BY tanggal_kunjungan DESC, id DESC LIMIT ? OFFSET ?`;
    const [rows] = await db.promise().query(dataSql, [...queryParams, limit, offset]);

    const formattedData = rows.map(r => ({
      ...r,
      catat_biaya: Boolean(r.catat_biaya),
      data_khusus: r.data_khusus ? JSON.parse(r.data_khusus) : null
    }));

    return res.json({
      data: formattedData,
      total,
      page,
      limit
    });
  } catch (error) {
    return next(error);
  }
});

// 2. GET /api/admin/kunjungan/ringkasan - Ringkasan Dashboard Kunjungan
app.get('/api/admin/kunjungan/ringkasan', authenticateAdminToken, async (req, res, next) => {
  try {
    const jenis = String(req.query.jenis || '').trim();
    if (!VALID_JENIS_KUNJUNGAN.includes(jenis)) {
      return res.status(400).json({ message: 'Jenis kunjungan wajib diisi.' });
    }
    const now = new Date();
    const defaultBulan = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const bulan = String(req.query.bulan || defaultBulan).trim();
    const todayStr = now.toISOString().slice(0, 10);

    // Bulan ini (jumlah tanpa batal)
    const [bIniRows] = await db.promise().query(
      `SELECT COUNT(*) as cnt FROM kunjungan WHERE jenis = ? AND DATE_FORMAT(tanggal_kunjungan, "%Y-%m") = ? AND status != 'batal'`,
      [jenis, bulan]
    );
    const bulan_ini = bIniRows[0].cnt;

    // Akan datang (tanggal >= hari ini, status baru/dikonfirmasi)
    const [akanDatangRows] = await db.promise().query(
      `SELECT COUNT(*) as cnt FROM kunjungan WHERE jenis = ? AND tanggal_kunjungan >= ? AND status IN ('baru', 'dikonfirmasi')`,
      [jenis, todayStr]
    );
    const akan_datang = akanDatangRows[0].cnt;

    // Berlangsung
    const [berlangsungRows] = await db.promise().query(
      `SELECT COUNT(*) as cnt FROM kunjungan WHERE jenis = ? AND status = 'berlangsung'`,
      [jenis]
    );
    const berlangsung = berlangsungRows[0].cnt;

    // Selesai (bulan itu)
    const [selesaiRows] = await db.promise().query(
      `SELECT COUNT(*) as cnt FROM kunjungan WHERE jenis = ? AND DATE_FORMAT(tanggal_kunjungan, "%Y-%m") = ? AND status = 'selesai'`,
      [jenis, bulan]
    );
    const selesai = selesaiRows[0].cnt;

    // Total peserta (peserta + pendamping bulan itu, tanpa batal)
    const [pesertaRows] = await db.promise().query(
      `SELECT SUM(jumlah_peserta + jumlah_pendamping) as total FROM kunjungan WHERE jenis = ? AND DATE_FORMAT(tanggal_kunjungan, "%Y-%m") = ? AND status != 'batal'`,
      [jenis, bulan]
    );
    const total_peserta = pesertaRows[0].total || 0;

    // Per status {semua, baru, dikonfirmasi, berlangsung, selesai, batal}
    const [statusRows] = await db.promise().query(
      `SELECT status, COUNT(*) as cnt FROM kunjungan WHERE jenis = ? ${bulan ? 'AND DATE_FORMAT(tanggal_kunjungan, "%Y-%m") = ?' : ''} GROUP BY status`,
      bulan ? [jenis, bulan] : [jenis]
    );
    const per_status = { semua: 0, baru: 0, dikonfirmasi: 0, berlangsung: 0, selesai: 0, batal: 0 };
    statusRows.forEach(r => {
      if (per_status.hasOwnProperty(r.status)) {
        per_status[r.status] = r.cnt;
        per_status.semua += r.cnt;
      }
    });

    // Jika bulan tidak difilter untuk semua, 'semua' adalah total tanpa filter bulan (atau sesuai query)
    // Untuk konsistensi tab, per_status dihitung berdasarkan bulan aktif atau total. Mari hitung total semua status untuk jenis tersebut (tanpa filter bulan agar tab atas menampilkan jumlah total sesuai filter tab).
    const [statusAllRows] = await db.promise().query(
      `SELECT status, COUNT(*) as cnt FROM kunjungan WHERE jenis = ? GROUP BY status`,
      [jenis]
    );
    const per_status_all = { semua: 0, baru: 0, dikonfirmasi: 0, berlangsung: 0, selesai: 0, batal: 0 };
    statusAllRows.forEach(r => {
      if (per_status_all.hasOwnProperty(r.status)) {
        per_status_all[r.status] = r.cnt;
        per_status_all.semua += r.cnt;
      }
    });

    // Jadwal terdekat (3 kunjungan tanggal >= hari ini, status baru/dikonfirmasi, urut naik)
    const [jadwalRows] = await db.promise().query(
      `SELECT * FROM kunjungan WHERE jenis = ? AND tanggal_kunjungan >= ? AND status IN ('baru', 'dikonfirmasi') ORDER BY tanggal_kunjungan ASC, jam_mulai ASC LIMIT 3`,
      [jenis, todayStr]
    );
    const jadwal_terdekat = jadwalRows.map(r => ({
      ...r,
      catat_biaya: Boolean(r.catat_biaya),
      data_khusus: r.data_khusus ? JSON.parse(r.data_khusus) : null
    }));

    return res.json({
      bulan_ini,
      akan_datang,
      berlangsung,
      selesai,
      total_peserta,
      per_status: per_status_all,
      jadwal_terdekat
    });
  } catch (error) {
    return next(error);
  }
});

// 3. GET /api/admin/kunjungan/:id - Detail Kunjungan (serta riwayat_status dan foto)
app.get('/api/admin/kunjungan/:id', authenticateAdminToken, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'ID tidak valid.' });

    const [rows] = await db.promise().query('SELECT * FROM kunjungan WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ message: 'Kunjungan tidak ditemukan.' });

    const kunjungan = rows[0];

    const [riwayatRows] = await db.promise().query('SELECT * FROM kunjungan_riwayat_status WHERE kunjungan_id = ? ORDER BY waktu ASC, id ASC', [id]);
    const [fotoRows] = await db.promise().query('SELECT * FROM kunjungan_foto WHERE kunjungan_id = ? ORDER BY id DESC', [id]);

    return res.json({
      ...kunjungan,
      catat_biaya: Boolean(kunjungan.catat_biaya),
      data_khusus: kunjungan.data_khusus ? JSON.parse(kunjungan.data_khusus) : null,
      riwayat_status: riwayatRows,
      foto: fotoRows
    });
  } catch (error) {
    return next(error);
  }
});

// 4. POST /api/admin/kunjungan - Tambah Kunjungan
app.post('/api/admin/kunjungan', authenticateAdminToken, async (req, res, next) => {
  try {
    const {
      jenis,
      nama_instansi,
      jenis_rombongan,
      nama_pic,
      no_wa_pic,
      jumlah_peserta,
      jumlah_pendamping,
      tanggal_kunjungan,
      jam_mulai,
      jam_selesai,
      status,
      catat_biaya,
      total_biaya,
      dp,
      status_bayar,
      catatan_internal,
      data_khusus
    } = req.body;

    if (!VALID_JENIS_KUNJUNGAN.includes(jenis)) {
      return res.status(400).json({ message: 'Jenis kunjungan tidak valid.' });
    }
    if (!nama_instansi || !String(nama_instansi).trim()) {
      return res.status(400).json({ message: 'Nama instansi / rombongan wajib diisi.' });
    }
    if (!nama_pic || !String(nama_pic).trim()) {
      return res.status(400).json({ message: 'Nama PIC wajib diisi.' });
    }
    if (!no_wa_pic || !String(no_wa_pic).trim()) {
      return res.status(400).json({ message: 'No. WhatsApp PIC wajib diisi.' });
    }
    if (jumlah_peserta === undefined || jumlah_peserta === null || Number(jumlah_peserta) < 0) {
      return res.status(400).json({ message: 'Jumlah peserta wajib diisi dan minimal 0.' });
    }
    if (!tanggal_kunjungan || !String(tanggal_kunjungan).trim()) {
      return res.status(400).json({ message: 'Tanggal kunjungan wajib diisi.' });
    }

    const initialStatus = VALID_STATUS_KUNJUNGAN.includes(status) ? status : 'baru';
    const isCatatBiaya = Boolean(catat_biaya);
    const cBiaya = isCatatBiaya ? (Number(total_biaya) || 0) : 0;
    const cDp = isCatatBiaya ? (Number(dp) || 0) : 0;
    const cStatBayar = isCatatBiaya && VALID_STATUS_BAYAR.includes(status_bayar) ? status_bayar : 'belum_bayar';
    const cleanedDataKhusus = sanitizeDataKhusus(jenis, data_khusus);

    const [result] = await db.promise().query(
      `INSERT INTO kunjungan 
       (jenis, nama_instansi, jenis_rombongan, nama_pic, no_wa_pic, jumlah_peserta, jumlah_pendamping, tanggal_kunjungan, jam_mulai, jam_selesai, status, catat_biaya, total_biaya, dp, status_bayar, catatan_internal, data_khusus)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        jenis,
        String(nama_instansi).trim(),
        jenis_rombongan ? String(jenis_rombongan).trim() : null,
        String(nama_pic).trim(),
        String(no_wa_pic).trim(),
        Number(jumlah_peserta),
        Number(jumlah_pendamping) || 0,
        tanggal_kunjungan,
        jam_mulai ? String(jam_mulai).trim() : null,
        jam_selesai ? String(jam_selesai).trim() : null,
        initialStatus,
        isCatatBiaya ? 1 : 0,
        cBiaya,
        cDp,
        cStatBayar,
        catatan_internal ? String(catatan_internal).trim() : null,
        cleanedDataKhusus
      ]
    );

    const newId = result.insertId;

    // Catat riwayat status awal
    await db.promise().query(
      `INSERT INTO kunjungan_riwayat_status (kunjungan_id, status) VALUES (?, ?)`,
      [newId, initialStatus]
    );

    const [newRows] = await db.promise().query('SELECT * FROM kunjungan WHERE id = ?', [newId]);
    return res.status(201).json({
      message: 'Kunjungan berhasil ditambahkan.',
      data: {
        ...newRows[0],
        catat_biaya: Boolean(newRows[0].catat_biaya),
        data_khusus: newRows[0].data_khusus ? JSON.parse(newRows[0].data_khusus) : null
      }
    });
  } catch (error) {
    return next(error);
  }
});

// 5. PUT /api/admin/kunjungan/:id - Update Kunjungan
app.put('/api/admin/kunjungan/:id', authenticateAdminToken, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'ID tidak valid.' });

    const [existing] = await db.promise().query('SELECT * FROM kunjungan WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ message: 'Kunjungan tidak ditemukan.' });

    const {
      jenis,
      nama_instansi,
      jenis_rombongan,
      nama_pic,
      no_wa_pic,
      jumlah_peserta,
      jumlah_pendamping,
      tanggal_kunjungan,
      jam_mulai,
      jam_selesai,
      status,
      catat_biaya,
      total_biaya,
      dp,
      status_bayar,
      catatan_internal,
      data_khusus
    } = req.body;

    if (jenis && !VALID_JENIS_KUNJUNGAN.includes(jenis)) {
      return res.status(400).json({ message: 'Jenis kunjungan tidak valid.' });
    }
    if (!nama_instansi || !String(nama_instansi).trim()) {
      return res.status(400).json({ message: 'Nama instansi / rombongan wajib diisi.' });
    }
    if (!nama_pic || !String(nama_pic).trim()) {
      return res.status(400).json({ message: 'Nama PIC wajib diisi.' });
    }
    if (!no_wa_pic || !String(no_wa_pic).trim()) {
      return res.status(400).json({ message: 'No. WhatsApp PIC wajib diisi.' });
    }
    if (jumlah_peserta === undefined || jumlah_peserta === null || Number(jumlah_peserta) < 0) {
      return res.status(400).json({ message: 'Jumlah peserta wajib diisi dan minimal 0.' });
    }
    if (!tanggal_kunjungan || !String(tanggal_kunjungan).trim()) {
      return res.status(400).json({ message: 'Tanggal kunjungan wajib diisi.' });
    }

    const targetJenis = jenis || existing[0].jenis;
    const newStatus = status && VALID_STATUS_KUNJUNGAN.includes(status) ? status : existing[0].status;
    const isCatatBiaya = Boolean(catat_biaya);
    const cBiaya = isCatatBiaya ? (Number(total_biaya) || 0) : 0;
    const cDp = isCatatBiaya ? (Number(dp) || 0) : 0;
    const cStatBayar = isCatatBiaya && VALID_STATUS_BAYAR.includes(status_bayar) ? status_bayar : 'belum_bayar';
    const cleanedDataKhusus = sanitizeDataKhusus(targetJenis, data_khusus);

    await db.promise().query(
      `UPDATE kunjungan SET 
       jenis = ?, nama_instansi = ?, jenis_rombongan = ?, nama_pic = ?, no_wa_pic = ?, 
       jumlah_peserta = ?, jumlah_pendamping = ?, tanggal_kunjungan = ?, jam_mulai = ?, jam_selesai = ?, 
       status = ?, catat_biaya = ?, total_biaya = ?, dp = ?, status_bayar = ?, 
       catatan_internal = ?, data_khusus = ?
       WHERE id = ?`,
      [
        targetJenis,
        String(nama_instansi).trim(),
        jenis_rombongan ? String(jenis_rombongan).trim() : null,
        String(nama_pic).trim(),
        String(no_wa_pic).trim(),
        Number(jumlah_peserta),
        Number(jumlah_pendamping) || 0,
        tanggal_kunjungan,
        jam_mulai ? String(jam_mulai).trim() : null,
        jam_selesai ? String(jam_selesai).trim() : null,
        newStatus,
        isCatatBiaya ? 1 : 0,
        cBiaya,
        cDp,
        cStatBayar,
        catatan_internal ? String(catatan_internal).trim() : null,
        cleanedDataKhusus,
        id
      ]
    );

    // Jika status berubah, catat ke riwayat
    if (newStatus !== existing[0].status) {
      await db.promise().query(
        `INSERT INTO kunjungan_riwayat_status (kunjungan_id, status) VALUES (?, ?)`,
        [id, newStatus]
      );
    }

    const [updatedRows] = await db.promise().query('SELECT * FROM kunjungan WHERE id = ?', [id]);
    return res.json({
      message: 'Kunjungan berhasil diperbarui.',
      data: {
        ...updatedRows[0],
        catat_biaya: Boolean(updatedRows[0].catat_biaya),
        data_khusus: updatedRows[0].data_khusus ? JSON.parse(updatedRows[0].data_khusus) : null
      }
    });
  } catch (error) {
    return next(error);
  }
});

// 6. PATCH /api/admin/kunjungan/:id/status - Ubah Status Kunjungan
app.patch('/api/admin/kunjungan/:id/status', authenticateAdminToken, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'ID tidak valid.' });

    const status = String(req.body?.status || '').trim();
    if (!VALID_STATUS_KUNJUNGAN.includes(status)) {
      return res.status(400).json({ message: 'Status kunjungan tidak valid.' });
    }

    const [existing] = await db.promise().query('SELECT * FROM kunjungan WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ message: 'Kunjungan tidak ditemukan.' });

    await db.promise().query('UPDATE kunjungan SET status = ? WHERE id = ?', [status, id]);

    // Catat riwayat status
    await db.promise().query(
      `INSERT INTO kunjungan_riwayat_status (kunjungan_id, status) VALUES (?, ?)`,
      [id, status]
    );

    const [updatedRows] = await db.promise().query('SELECT * FROM kunjungan WHERE id = ?', [id]);
    return res.json({
      message: 'Status kunjungan berhasil diperbarui.',
      data: {
        ...updatedRows[0],
        catat_biaya: Boolean(updatedRows[0].catat_biaya),
        data_khusus: updatedRows[0].data_khusus ? JSON.parse(updatedRows[0].data_khusus) : null
      }
    });
  } catch (error) {
    return next(error);
  }
});

// 7. DELETE /api/admin/kunjungan/:id - Hapus Kunjungan + Riwayat + Foto File
app.delete('/api/admin/kunjungan/:id', authenticateAdminToken, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'ID tidak valid.' });

    const [existing] = await db.promise().query('SELECT * FROM kunjungan WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ message: 'Kunjungan tidak ditemukan.' });

    // Ambil daftar foto untuk dihapus dari filesystem
    const [fotos] = await db.promise().query('SELECT * FROM kunjungan_foto WHERE kunjungan_id = ?', [id]);
    for (const f of fotos) {
      if (f.path) {
        const fullPath = path.resolve(f.path);
        if (fs.existsSync(fullPath)) {
          try { fs.unlinkSync(fullPath); } catch (e) {}
        }
        // Hapus thumbnail jika ada
        const parsed = path.parse(fullPath);
        const thumbPath = path.join(parsed.dir, `${parsed.name}-thumb${parsed.ext}`);
        if (fs.existsSync(thumbPath)) {
          try { fs.unlinkSync(thumbPath); } catch (e) {}
        }
      }
    }

    // Hapus data (karena foreign key ON DELETE CASCADE pada riwayat dan foto, cukup hapus parent atau manual)
    await db.promise().query('DELETE FROM kunjungan WHERE id = ?', [id]);

    return res.json({ message: 'Kunjungan berhasil dihapus.' });
  } catch (error) {
    return next(error);
  }
});

// 8. POST /api/admin/kunjungan/:id/foto - Unggah Foto Dokumentasi Kunjungan
app.post('/api/admin/kunjungan/:id/foto', authenticateAdminToken, upload.array('foto', 10), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'ID tidak valid.' });

    const [existing] = await db.promise().query('SELECT id FROM kunjungan WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ message: 'Kunjungan tidak ditemukan.' });

    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ message: 'Tidak ada file foto yang diunggah.' });
    }

    const insertedFotos = [];
    for (const file of files) {
      // Simpan path relatif seperti uploads/xxx.jpg atau path utuh sesuai pola galeri
      const filePath = `uploads/${file.filename}`;
      const [result] = await db.promise().query(
        `INSERT INTO kunjungan_foto (kunjungan_id, path) VALUES (?, ?)`,
        [id, filePath]
      );
      insertedFotos.push({
        id: result.insertId,
        kunjungan_id: id,
        path: filePath,
        created_at: new Date()
      });
    }

    return res.status(201).json({
      message: 'Foto dokumentasi berhasil diunggah.',
      data: insertedFotos
    });
  } catch (error) {
    return next(error);
  }
});

// 9. DELETE /api/admin/kunjungan/:id/foto/:fotoId - Hapus Foto Dokumentasi Kunjungan
app.delete('/api/admin/kunjungan/:id/foto/:fotoId', authenticateAdminToken, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const fotoId = parseInt(req.params.fotoId, 10);
    if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(fotoId) || fotoId <= 0) {
      return res.status(400).json({ message: 'ID tidak valid.' });
    }

    const [fotoRows] = await db.promise().query('SELECT * FROM kunjungan_foto WHERE id = ? AND kunjungan_id = ?', [fotoId, id]);
    if (!fotoRows.length) return res.status(404).json({ message: 'Foto tidak ditemukan.' });

    const foto = fotoRows[0];
    if (foto.path) {
      const fullPath = path.resolve(foto.path);
      if (fs.existsSync(fullPath)) {
        try { fs.unlinkSync(fullPath); } catch (e) {}
      }
      const parsed = path.parse(fullPath);
      const thumbPath = path.join(parsed.dir, `${parsed.name}-thumb${parsed.ext}`);
      if (fs.existsSync(thumbPath)) {
        try { fs.unlinkSync(thumbPath); } catch (e) {}
      }
    }

    await db.promise().query('DELETE FROM kunjungan_foto WHERE id = ?', [fotoId]);

    return res.json({ message: 'Foto berhasil dihapus.' });
  } catch (error) {
    return next(error);
  }
});
// ─────────────────────────────────────────────────────────────────────────────
