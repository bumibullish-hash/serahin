# Jasa Serahin

Aplikasi website pemesanan layanan jasa dengan paket harga tetap (desain, dokumen, dan video). Pelanggan memilih layanan, menulis brief pekerjaan dan tenggat, membayar dengan QRIS melalui Bayaraja, lalu menerima hasil lewat WhatsApp, email, atau Google Drive. Penyedia jasa mengelola layanan, transaksi, laporan penjualan, dan laporan keuangan.

Slogan: Serahin aja, kami yang kerjakan.

Proyek mata kuliah Digital Entrepreneurship.

## Teknologi

| Bagian | Teknologi |
|---|---|
| Backend | Node.js, Express 5 |
| Database | MongoDB Atlas, Mongoose |
| Login | JWT di cookie httpOnly, bcryptjs |
| Validasi | express-validator |
| Keamanan | helmet (CSP), express-rate-limit |
| Upload foto | multer (foto disimpan di MongoDB) |
| PDF | pdfkit |
| Grafik | Chart.js |
| Frontend | HTML, CSS, JavaScript |
| Pembayaran | Bayaraja (QRIS dinamis dan payment link) |

## Struktur Folder

```
serahin/
  backend/
    config/        koneksi database
    models/        skema MongoDB
    middleware/    login, role, validasi, upload, error
    controllers/   logika setiap fitur
    routes/        daftar endpoint dan halaman
    services/      Bayaraja, pembayaran, laporan, PDF
    utils/         format, periode tanggal, nomor invoice
    seeds/         membuat admin, kategori, layanan contoh dan dummy
    scripts/       cek koneksi Bayaraja
    app.js         pengaturan Express
    server.js      menjalankan server
  frontend/
    css/           style.css
    js/            script setiap halaman
    pages/user/    halaman user
    pages/admin/   halaman admin
    pages/         invoice
    index.html, layanan.html, login.html, register.html, ...
  tests/           pengujian otomatis
  .env.example
  package.json
```

## Cara Menjalankan

1. Pasang Node.js versi 18 atau lebih baru.
2. Pasang dependency:

   ```
   npm install
   ```

3. Salin `.env.example` menjadi `.env`:

   ```
   copy .env.example .env      (Windows)
   cp .env.example .env        (Mac/Linux)
   ```

4. Isi `.env`:

   | Variabel | Isi |
   |---|---|
   | `MONGODB_URI` | Connection string Atlas. Tambahkan nama database, contoh `...mongodb.net/serahin` |
   | `JWT_SECRET` | Teks acak minimal 16 karakter |
   | `BAYARAJA_BASE_URL` | Alamat instance Bayaraja Anda, contoh `https://bayaraja.arwebs.my.id` |
   | `BAYARAJA_API_KEY` | API Key dari Pengaturan, API Keys di dashboard Bayaraja |
   | `BAYARAJA_QRIS_ACCOUNT_ID` | ID akun QRIS di Bayaraja (wajib untuk payment link) |
   | `BAYARAJA_WEBHOOK_SECRET` | Hanya jika memakai webhook |
   | `PAYMENT_EXPIRE_MINUTES` | Batas waktu bayar, bawaan 30 menit |
   | `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Akun admin yang dibuat oleh seed |

   Membuat `JWT_SECRET` acak:

   ```
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

5. Di MongoDB Atlas, buka Network Access dan izinkan IP komputer Anda.
6. Buat akun admin, kategori, dan layanan contoh (aman dijalankan berulang kali):

   ```
   npm run seed:contoh
   ```

   Gunakan `npm run seed` jika tidak ingin layanan contoh. Jika login admin gagal, jalankan `npm run reset-admin` untuk membuat atau mengatur ulang password admin sesuai `.env`.

   Untuk data uji yang lebih lengkap (16 layanan bergambar dalam kategori Desain, Dokumen, Video, dan Paket, satu layanan berkuota tipis, satu layanan berkuota habis, dan satu akun pelanggan uji), jalankan:

   ```
   npm run seed:dummy
   ```

   Perintah ini aman diulang. Setiap dijalankan, harga dan kuota layanan dummy kembali ke nilai awal, sehingga pengujian pemesanan bisa diulang. Akun pelanggan uji: `pelanggan@serahin.local` dengan password `pelanggan123`. Hapus akun itu sebelum aplikasi dipakai sungguhan, atau jalankan dengan `npm run seed:dummy -- --tanpa-user`. Perintah ini tidak membuat transaksi palsu.

   Jika database Anda masih berisi data contoh versi lama (NgemilKampus), perintah `npm run seed`, `npm run seed:contoh`, dan `npm run seed:dummy` otomatis menghapus layanan contoh makanan lama dan memperbarui nama usaha menjadi Jasa Serahin. Data yang Anda buat sendiri tidak disentuh.

   Untuk mencoba laporan, grafik, dan dashboard dengan banyak data, buat 100 transaksi uji:

   ```
   npm run seed:transaksi
   ```

   Perintah ini membuat 100 transaksi dengan tanggal tersebar sekitar 120 hari ke belakang dan status campuran (68 Paid, 13 Expired, 11 Rejected, 8 Pending), dari 14 pelanggan uji (`dummy01@serahin.local` dan seterusnya, tidak bisa dipakai login). Semua transaksi ditandai **Data uji** di panel admin, tidak memiliki pembayaran di Bayaraja, tidak mengubah kuota layanan, dan tidak pernah diperiksa ke Bayaraja. Setiap dijalankan, data uji lama diganti, bukan ditambah. Opsi: `npm run seed:transaksi -- --jumlah=200` (maksimal 500).

   Untuk menghapus seluruh data uji tanpa menyentuh transaksi sungguhan:

   ```
   npm run hapus:transaksi-dummy
   ```

   Untuk membatasi rentang tanggal, misalnya dari 1 Oktober 2026 sampai hari ini: `npm run seed:transaksi -- --dari=2026-10-01`.

   Data uji ikut dihitung di dashboard dan laporan. Hapus sebelum aplikasi dipakai untuk demo transaksi sungguhan, supaya angka laporan tidak tercampur.

7. Periksa koneksi Bayaraja:

   ```
   npm run cek-bayaraja
   npm run cek-bayaraja -- --tes-link
   ```

   Opsi kedua membuat satu payment link uji bernilai Rp 1.000.

8. Jalankan aplikasi:

   ```
   npm start
   ```

   Mode pengembangan yang restart otomatis: `npm run dev`.

9. Buka `http://localhost:3000`. Backend dan frontend dilayani oleh satu server, tidak ada server frontend terpisah.

## Memasang Foto Layanan Asli

Foto layanan bisa diunggah lewat menu Layanan di panel admin, atau sekaligus lewat perintah berikut:

1. Lihat nama berkas yang dicari: `npm run impor:foto -- --daftar`
2. Taruh foto contoh hasil kerja Anda di folder `foto-layanan` (format JPG, PNG, atau WEBP, maksimal 2 MB), dengan nama sesuai layanan, misalnya `poster-acara.jpg` untuk layanan "Poster Acara".
3. Jalankan: `npm run impor:foto`

Perintah ini mencocokkan nama berkas dengan nama layanan, menyimpan foto di database, dan melaporkan berkas yang dilewati serta layanan yang belum punya foto. Gunakan foto hasil kerja Anda sendiri atau yang Anda punya izin pakainya.

## Foto Layanan

Foto layanan bersifat opsional. Layanan tanpa foto, atau yang fotonya gagal dimuat, menampilkan nama layanan sebagai tulisan pada latar berwarna sesuai kategori. Foto yang diunggah disimpan di MongoDB.

## Akun

- **Admin:** email dan password dari `ADMIN_EMAIL` dan `ADMIN_PASSWORD` di `.env`. Akun admin tidak bisa dibuat lewat registrasi.
- **User:** daftar sendiri di halaman Daftar.

## Alur Pembayaran Bayaraja

Bayaraja memakai konfirmasi manual oleh pemilik akun, sehingga alurnya:

1. Pelanggan checkout: menulis brief pekerjaan, nomor WhatsApp, tenggat, metode penerimaan hasil, lalu memilih QRIS atau Payment Link.
2. Aplikasi membuat payment link di Bayaraja (`POST /api/links`). Untuk metode QRIS, aplikasi juga membuat QR dinamis (`POST /api/qris/create-amount`) dan menampilkannya.
3. Pelanggan membayar, lalu membuka halaman Bayaraja dan mengunggah bukti pembayaran.
4. Pemilik akun Bayaraja mengonfirmasi atau menolak di dashboard Bayaraja.
5. Halaman pembayaran mengecek status tiap 5 detik (`GET /api/pay/{slug}/status`). Status menjadi Paid hanya setelah Bayaraja melaporkan pembayaran terkonfirmasi dan nominalnya sama dengan total pesanan.

Aturan lain:

- Pesanan yang melewati batas waktu menjadi Expired dan kuota dikembalikan, kecuali ada bukti pembayaran yang masih menunggu konfirmasi.
- Pembayaran Rejected atau Expired mengembalikan kuota satu kali saja.
- Jika pembayaran dikonfirmasi setelah pesanan Expired, tombol Sinkronkan di menu Transaksi akan mengubahnya menjadi Paid dan mengurangi kuota kembali.
- Omzet dan laporan hanya menghitung transaksi Paid.

### Webhook

Endpoint `POST /api/webhooks/bayaraja` memverifikasi signature HMAC SHA256 dengan `BAYARAJA_WEBHOOK_SECRET`. Webhook tidak bisa menjangkau localhost, jadi polling status adalah mekanisme utama. Untuk mencoba webhook, gunakan tunnel seperti ngrok atau Cloudflare Tunnel.

Catatan jujur: nama header signature tidak ada di dokumentasi Bayaraja yang tersedia. Kode memeriksa beberapa nama umum (`x-bayaraja-signature`, `x-webhook-signature`, `x-signature`). Webhook yang valid hanya memicu pengecekan ulang status ke Bayaraja, bukan langsung menandai lunas. Pengujian dengan webhook Bayaraja asli belum dilakukan.

## Pengujian

Pengujian otomatis memakai database khusus yang namanya berakhiran `_test`. Isinya dihapus setiap kali tes berjalan, jadi jangan arahkan ke database asli.

```
set TEST_MONGODB_URI=mongodb://127.0.0.1:27017/serahin_test     (Windows)
export TEST_MONGODB_URI=mongodb://127.0.0.1:27017/serahin_test  (Mac/Linux)
npm test
```

Tes meniru server Bayaraja (`tests/mockBayaraja.js`) agar alur konfirmasi, penolakan, dan kedaluwarsa bisa diuji. Server tiruan itu hanya alat uji, bukan bagian aplikasi. Pengujian ke Bayaraja asli dilakukan lewat `npm run cek-bayaraja` dan transaksi manual.

## Deploy ke Vercel

Vercel menjalankan fungsi serverless, bukan server yang menyala terus. Proyek ini sudah disesuaikan: `api/index.js` adalah pintu masuk fungsi, `vercel.json` mengarahkan semua alamat ke fungsi itu dan menyertakan file yang dibutuhkan, foto layanan disimpan di MongoDB (bukan disk), dan pengecekan pesanan kedaluwarsa berjalan lewat cron harian serta saat admin membuka Dashboard atau Transaksi.

1. Unggah semua file ke GitHub, termasuk `api/index.js` dan `vercel.json`:

   ```
   git add .
   git commit -m "Siap deploy Vercel"
   git push
   ```

2. Di Vercel, buka Project Settings, General. Pengaturan Build and Output:
   - Framework Preset: Other
   - Build Command: kosongkan
   - Output Directory: kosongkan
   - Root Directory: `./`

3. Di Settings, Environment Variables, isi (untuk Production):

   | Variabel | Isi |
   |---|---|
   | `MONGODB_URI` | Connection string Atlas, dengan nama database di ujungnya, contoh `...mongodb.net/serahin` |
   | `JWT_SECRET` | Teks acak minimal 16 karakter |
   | `BAYARAJA_BASE_URL` | `https://bayaraja.arwebs.my.id` |
   | `BAYARAJA_API_KEY` | API Key Bayaraja |
   | `BAYARAJA_QRIS_ACCOUNT_ID` | ID akun QRIS |
   | `BAYARAJA_WEBHOOK_SECRET` | Opsional, jika memakai webhook |
   | `PAYMENT_EXPIRE_MINUTES` | `30` |
   | `CRON_SECRET` | Teks acak. Vercel mengirimnya otomatis saat menjalankan cron |

   `NODE_ENV` diisi Vercel sendiri sebagai `production`.

4. Di MongoDB Atlas, buka Network Access, tambahkan `0.0.0.0/0`. Alamat IP Vercel berubah-ubah, jadi tanpa ini koneksi akan gagal.
5. Di Vercel, buka Deployments, pilih deployment terakhir, lalu Redeploy (variabel baru hanya terbaca setelah deploy ulang).
6. Buka `https://NAMA-PROYEK.vercel.app/api/health`. Hasil yang benar: `"database":"terhubung"`.
7. Isi data awal ke database yang sama dari komputer Anda (file `.env` lokal menunjuk ke Atlas yang sama):

   ```
   npm run seed:dummy
   ```

8. Opsional, webhook: di dashboard Bayaraja, Pengaturan, Webhooks, isi URL `https://NAMA-PROYEK.vercel.app/api/webhooks/bayaraja` dan samakan secret-nya dengan `BAYARAJA_WEBHOOK_SECRET`.

Jika ada error, buka Vercel, Deployments, pilih deployment, lalu tab Logs.

Catatan: cron di paket Hobby hanya boleh berjalan sekali sehari, jadi pesanan kedaluwarsa terutama dibereskan saat admin membuka Dashboard atau Transaksi, dan saat pelanggan membuka halaman pembayarannya.

## Keamanan

- `.env` masuk `.gitignore`. Jangan pernah mengunggahnya ke GitHub.
- API Key dan connection string hanya dipakai di backend.
- Password disimpan sebagai hash bcrypt.
- Token login disimpan di cookie httpOnly dan tidak bisa dibaca JavaScript.
- Halaman dan API admin dilindungi di server. User tidak bisa membuka halaman admin, dan user hanya bisa melihat transaksinya sendiri.
- Jika kredensial pernah tertulis di chat atau tempat umum, ganti password database dan buat API Key baru.

## Pemecahan Masalah

| Masalah | Penyebab dan solusi |
|---|---|
| `Gagal menjalankan aplikasi: connect ... ` | IP belum diizinkan di Network Access Atlas, atau `MONGODB_URI` salah |
| `Alamat Bayaraja tidak mengembalikan data JSON` | `BAYARAJA_BASE_URL` salah. Gunakan alamat instance Bayaraja Anda |
| `API Key Bayaraja tidak valid` | API Key salah atau dinonaktifkan di dashboard Bayaraja |
| `BAYARAJA_QRIS_ACCOUNT_ID belum diisi` | Isi ID akun QRIS dari Bayaraja, lalu restart server |
| Status pembayaran tetap Pending | Pemilik akun belum mengonfirmasi di dashboard Bayaraja, atau bukti belum diunggah di halaman Bayaraja |
| Login admin selalu "Email atau password salah" | Akun admin belum dibuat, atau dibuat dengan password lama (seed tidak menimpa akun yang sudah ada). Jalankan `npm run cek-login` untuk melihat penyebab pastinya, lalu `npm run reset-admin`, lalu login dengan `ADMIN_EMAIL` dan `ADMIN_PASSWORD` dari `.env` |
| Perubahan `.env` tidak berpengaruh | `.env` hanya dibaca saat server mulai. Hentikan server (Ctrl + C) lalu jalankan lagi. `npm run dev` tidak restart otomatis untuk perubahan `.env` |
| Font tidak muncul | Perlu internet untuk Google Fonts. Tampilan tetap berfungsi dengan font cadangan |
