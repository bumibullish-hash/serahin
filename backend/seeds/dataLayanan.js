const kategori = ['Desain', 'Dokumen', 'Video', 'Paket'];

const layanan = [
  ['Desain', 'Poster Acara', 40000, 15000, 15, 'Desain poster untuk acara kampus atau organisasi. 1 desain, 1 kali revisi, hasil JPG dan PDF.'],
  ['Desain', 'Feed Instagram 3 Slide', 60000, 25000, 12, 'Tiga slide feed Instagram dengan tema yang seragam. 1 kali revisi.'],
  ['Desain', 'Logo Sederhana', 75000, 30000, 8, 'Logo sederhana untuk usaha atau komunitas. Dua pilihan konsep, 1 kali revisi.'],
  ['Desain', 'Banner dan Spanduk', 50000, 20000, 10, 'Desain banner atau spanduk siap cetak sesuai ukuran yang diminta.'],
  ['Desain', 'Konsultasi Desain (kuota habis)', 25000, 10000, 0, 'Dipakai untuk menguji tampilan layanan yang kuotanya habis.'],
  ['Dokumen', 'Rapikan CV 1 Halaman', 35000, 12000, 20, 'Perapihan isi dan tata letak CV satu halaman, hasil PDF dan Word.'],
  ['Dokumen', 'Surat Lamaran Kerja', 20000, 6000, 25, 'Penyusunan surat lamaran kerja yang rapi sesuai posisi yang dilamar.'],
  ['Dokumen', 'Pengetikan dan Format Dokumen', 30000, 12000, 25, 'Pengetikan dan perapihan format dokumen, harga per 10 halaman.'],
  ['Dokumen', 'Terjemahan Indonesia-Inggris', 45000, 20000, 15, 'Terjemahan teks umum, harga per 500 kata. Tidak untuk dokumen hukum resmi.'],
  ['Dokumen', 'Presentasi PPT 10 Slide', 65000, 28000, 12, 'Pembuatan 10 slide presentasi dengan desain rapi dari bahan yang Anda kirim.'],
  ['Dokumen', 'Revisi Tambahan (kuota tipis)', 15000, 5000, 3, 'Dipakai untuk menguji peringatan kuota hampir habis.'],
  ['Video', 'Edit Video Pendek', 80000, 35000, 10, 'Pengeditan video berdurasi maksimal 1 menit lengkap dengan teks dan musik.'],
  ['Video', 'Intro Video Kegiatan', 55000, 22000, 8, 'Intro singkat maksimal 30 detik untuk video kegiatan atau channel.'],
  ['Paket', 'Paket Lamaran Kerja', 50000, 18000, 15, 'Rapikan CV 1 halaman dan satu surat lamaran kerja dalam satu paket.'],
  ['Paket', 'Paket Seminar', 95000, 43000, 8, 'Satu poster acara dan presentasi PPT 10 slide untuk seminar atau presentasi.'],
  ['Paket', 'Paket Organisasi', 130000, 60000, 6, 'Satu poster, feed Instagram 3 slide, dan satu banner untuk kegiatan organisasi.']
];

const namaLama = [
  'Keripik Pisang Coklat', 'Basreng Pedas', 'Risol Mayo', 'Cireng Isi Ayam', 'Tahu Crispy', 'Pisang Goreng Keju',
  'Siomay Mini', 'Martabak Mini Coklat Keju', 'Donat Kentang', 'Brownies Kukus (stok tipis)', 'Es Cendol (stok habis)',
  'Es Teh Manis', 'Kopi Susu Gula Aren', 'Es Jeruk Peras', 'Thai Tea', 'Matcha Latte', 'Es Coklat', 'Lemon Tea',
  'Paket Hemat Ngemil', 'Paket Belajar', 'Paket Berdua'
];
const kategoriLama = ['Camilan', 'Minuman', 'Paket Hemat'];

async function bersihkanDataLama(models) {
  const { Product, Category, Setting, Media } = models;
  const hapus = await Product.deleteMany({ name: { $in: namaLama } });
  await Media.deleteMany({ key: /^dummy-/ });
  for (const nama of kategoriLama) {
    const ada = await Category.findOne({ name: nama });
    if (ada && (await Product.countDocuments({ category: ada._id })) === 0) {
      await Category.deleteOne({ _id: ada._id });
    }
  }
  const setting = await Setting.get();
  let berubah = false;
  if (setting.businessName === 'NgemilKampus') {
    setting.businessName = 'Jasa Serahin';
    berubah = true;
  }
  if (setting.tagline === 'Pesan camilan dan minuman, ambil tanpa antre') {
    setting.tagline = 'Serahin aja, kami yang kerjakan';
    berubah = true;
  }
  if (setting.pickupHours === 'Senin - Jumat, 09.00 - 15.00 WIB') {
    setting.pickupHours = 'Senin - Sabtu, 09.00 - 20.00 WIB';
    berubah = true;
  }
  if (setting.pickupPoints.join('|') === 'Gerbang Utama Kampus|Kantin Gedung A|Perpustakaan') {
    setting.pickupPoints = ['WhatsApp', 'Email', 'Google Drive'];
    berubah = true;
  }
  if (berubah) await setting.save();
  return { produkLamaDihapus: hapus.deletedCount, pengaturanDiperbarui: berubah };
}

module.exports = { kategori, layanan, bersihkanDataLama };
