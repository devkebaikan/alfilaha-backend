const mysql = require('mysql2');
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'alfilaha_db'
});

db.connect((err) => {
  if (err) {
    console.error("DB connection error:", err.message);
    process.exit(1);
  }
  const addCols = `
    ALTER TABLE tanaman 
    ADD COLUMN usia VARCHAR(100),
    ADD COLUMN jadwal_siram VARCHAR(100),
    ADD COLUMN penanggung_jawab VARCHAR(100),
    ADD COLUMN kebutuhan_air VARCHAR(100),
    ADD COLUMN terakhir_dipupuk VARCHAR(100);
  `;
  db.query(addCols, (e) => {
    if (e) {
        console.log("Migration result:", e.message);
    } else {
        console.log("Migration successful.");
    }
    process.exit(0);
  });
});
