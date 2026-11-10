require('dotenv').config();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Setting = require('../models/Setting');
const { kategori, layanan } = require('./dataLayanan');
const { awalHari, SEHARI } = require('../utils/dateRange');

const hanyaHapus = process.argv.includes('--hapus');
const argJumlah = process.argv.find((item) => item.startsWith('--jumlah='));
const jumlahOrder = Math.min(Math.max(Number(argJumlah ? argJumlah.split('=')[1] : 100) || 100, 1), 500);
const argDari = process.argv.find((item) => item.startsWith('--dari='));
const tanggalDari = argDari ? argDari.split('=')[1] : '';
let rentangHari = 120;
const polaEmail = /^dummy\d+@serahin\.local$/;

const namaPelanggan = [
  'Andi Pratama', 'Siti Nurhaliza', 'Budi Santoso', 'Dewi Lestari', 'Rizky Maulana', 'Putri Ayu',
  'Fajar Ramadhan', 'Nadia Safitri', 'Hendra Wijaya', 'Maya Anggraini', 'Dimas Saputra', 'Laila Hidayati',
  'Yoga Permana', 'Citra Kirana'
];

const daftarBrief = [
  'Tolong rapikan CV saya untuk melamar posisi staf administrasi. File bahan ada di Google Drive.',
  'Butuh poster acara seminar kewirausahaan, tema biru, ukuran A3. Teks menyusul lewat WhatsApp.',
  'Mohon buatkan presentasi 10 slide tentang rencana bisnis. Isi dan data akan saya kirim.',
  'Edit video kegiatan organisasi maksimal 1 menit, tambahkan teks dan musik latar yang santai.',
  'Ketik ulang dokumen laporan praktikum dan rapikan format sesuai contoh yang saya lampirkan.',
  'Terjemahkan abstrak jurnal dari bahasa Indonesia ke bahasa Inggris, sekitar 400 kata.',
  'Buatkan feed Instagram 3 slide untuk promosi usaha kecil, warna hangat dan sederhana.',
  'Desain banner untuk pameran produk UMKM, ukuran 2 x 1 meter, siap cetak.',
  'Susun surat lamaran kerja untuk posisi desainer grafis. CV sudah saya lampirkan di Drive.',
  'Butuh logo sederhana untuk komunitas fotografi kampus, dua pilihan konsep jika bisa.'
];

function acak(maks) {
  return Math.floor(Math.random() * maks);
}

function pilih(daftar) {
  return daftar[acak(daftar.length)];
}

function kocok(daftar) {
  const salinan = daftar.slice();
  for (let i = salinan.length - 1; i > 0; i -= 1) {
    const j = acak(i + 1);
    [salinan[i], salinan[j]] = [salinan[j], salinan[i]];
  }
  return salinan;
}

function waktuDibuat(umurMaksHari) {
  const sekarang = Date.now();
  const hari = Math.min(Math.floor(rentangHari * (1 - Math.sqrt(Math.random()))), rentangHari - 1, umurMaksHari);
  const awal = awalHari(new Date(sekarang)).getTime() - hari * SEHARI;
  let waktu = awal + (8 + acak(13)) * 3600 * 1000 + acak(60) * 60 * 1000 + acak(60) * 1000;
  if (waktu > sekarang - 10 * 60 * 1000) waktu = sekarang - (10 + acak(120)) * 60 * 1000;
  return new Date(waktu);
}

async function hapusDummyLama() {
  const hasil = await Order.deleteMany({ isDummy: true });
  const pengguna = await User.deleteMany({ email: polaEmail });
  return { transaksi: hasil.deletedCount, pelanggan: pengguna.deletedCount };
}

async function pastikanLayanan() {
  if ((await Product.countDocuments()) > 0) return;
  for (const nama of kategori) {
    await Category.updateOne({ name: nama }, { $setOnInsert: { name: nama } }, { upsert: true });
  }
  for (const [namaKategori, nama, harga, biaya, kuota, deskripsi] of layanan) {
    const kat = await Category.findOne({ name: namaKategori });
    await Product.create({ name: nama, category: kat._id, price: harga, costPrice: biaya, stock: kuota, description: deskripsi });
  }
  console.log('Belum ada layanan, layanan contoh dibuat terlebih dahulu');
}

function tentukanStatus(jumlah) {
  const paid = Math.round(jumlah * 0.68);
  const expired = Math.round(jumlah * 0.13);
  const rejected = Math.round(jumlah * 0.11);
  const pending = jumlah - paid - expired - rejected;
  const daftar = [];
  for (let i = 0; i < paid; i += 1) daftar.push('paid');
  for (let i = 0; i < expired; i += 1) daftar.push('expired');
  for (let i = 0; i < rejected; i += 1) daftar.push('rejected');
  for (let i = 0; i < pending; i += 1) daftar.push('pending');
  return kocok(daftar);
}

function statusPesanan(statusBayar, umurHari) {
  if (statusBayar === 'pending') return 'menunggu_pembayaran';
  if (statusBayar !== 'paid') return 'dibatalkan';
  const acakan = Math.random();
  if (umurHari >= 3) return acakan < 0.85 ? 'selesai' : 'siap_diambil';
  if (acakan < 0.4) return 'diproses';
  return acakan < 0.75 ? 'siap_diambil' : 'selesai';
}

async function jalankan() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI belum diisi di file .env');
  }
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  console.log('MongoDB terhubung ke database: ' + mongoose.connection.name);

  if (tanggalDari) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggalDari) || Number.isNaN(Date.parse(tanggalDari + 'T00:00:00+07:00'))) {
      throw new Error('Format --dari harus YYYY-MM-DD, contoh: --dari=2026-10-01');
    }
    const awal = awalHari(new Date(tanggalDari + 'T00:00:00+07:00')).getTime();
    const hariIni = awalHari(new Date()).getTime();
    if (awal > hariIni) throw new Error('Tanggal --dari tidak boleh di masa depan');
    rentangHari = Math.floor((hariIni - awal) / SEHARI) + 1;
    if (rentangHari > 800) throw new Error('Rentang --dari maksimal sekitar 2 tahun');
  }

  const lama = await hapusDummyLama();
  if (lama.transaksi > 0) console.log('Transaksi uji lama dihapus: ' + lama.transaksi + ' transaksi, ' + lama.pelanggan + ' pelanggan uji');
  if (hanyaHapus) {
    console.log('Selesai. Hanya data uji yang dihapus, transaksi sungguhan tidak disentuh.');
    return;
  }

  await pastikanLayanan();
  const setting = await Setting.get();
  const produk = (await Product.find({ isActive: true }).lean()).filter((item) => !/\(kuota/i.test(item.name));
  if (produk.length === 0) throw new Error('Tidak ada layanan aktif untuk dipakai');

  const hashAcak = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 8);
  const pelanggan = [];
  for (let i = 0; i < namaPelanggan.length; i += 1) {
    const nomor = String(i + 1).padStart(2, '0');
    pelanggan.push(
      await User.create({
        name: namaPelanggan[i],
        email: 'dummy' + nomor + '@serahin.local',
        phone: '08' + String(1100000000 + acak(899999999)),
        password: hashAcak,
        role: 'user'
      })
    );
  }

  const nomorPerHari = {};
  const dokumen = tentukanStatus(jumlahOrder).map((statusBayar) => {
    const dibuat = statusBayar === 'pending' ? waktuDibuat(2) : waktuDibuat(rentangHari);
    const umurHari = Math.floor((Date.now() - dibuat.getTime()) / SEHARI);
    const tanggal = new Date(dibuat.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, '');
    nomorPerHari[tanggal] = (nomorPerHari[tanggal] || 0) + 1;

    const items = kocok(produk)
      .slice(0, 1 + acak(3))
      .map((item) => {
        const jumlah = Math.random() < 0.8 ? 1 : 2;
        return { product: item._id, name: item.name, price: item.price, costPrice: item.costPrice, quantity: jumlah, subtotal: item.price * jumlah };
      });
    const total = items.reduce((jumlah, item) => jumlah + item.subtotal, 0);
    const user = pilih(pelanggan);
    const dibayar = statusBayar === 'paid' ? new Date(dibuat.getTime() + (3 + acak(40)) * 60 * 1000) : null;

    const data = {
      _id: new mongoose.Types.ObjectId(),
      invoiceNumber: 'INV-' + tanggal + '-D' + String(nomorPerHari[tanggal]).padStart(3, '0'),
      user: user._id,
      customerName: user.name,
      customerEmail: user.email,
      customerPhone: user.phone,
      items,
      subtotal: total,
      total,
      paymentMethod: Math.random() < 0.7 ? 'qris' : 'link',
      paymentStatus: statusBayar,
      orderStatus: statusPesanan(statusBayar, umurHari),
      pickupPoint: pilih(setting.pickupPoints),
      pickupTime: new Date(dibuat.getTime() + (1 + acak(10)) * SEHARI),
      note: pilih(daftarBrief),
      expiresAt: new Date(dibuat.getTime() + 30 * 60 * 1000),
      stockReturned: statusBayar === 'expired' || statusBayar === 'rejected',
      adminNote: '',
      isDummy: true,
      createdAt: dibuat,
      updatedAt: dibayar || dibuat,
      __v: 0
    };
    if (dibayar) data.paidAt = dibayar;
    return data;
  });

  await Order.collection.insertMany(dokumen);

  const hitung = {};
  let omzet = 0;
  dokumen.forEach((item) => {
    hitung[item.paymentStatus] = (hitung[item.paymentStatus] || 0) + 1;
    if (item.paymentStatus === 'paid') omzet += item.total;
  });
  const waktu = dokumen.map((item) => item.createdAt.getTime());
  const format = (angka) => new Date(angka).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' });

  console.log('Transaksi uji dibuat: ' + dokumen.length + ' (ditandai "Data uji", tidak ada di Bayaraja)');
  console.log('  Paid    : ' + (hitung.paid || 0));
  console.log('  Pending : ' + (hitung.pending || 0));
  console.log('  Rejected: ' + (hitung.rejected || 0));
  console.log('  Expired : ' + (hitung.expired || 0));
  console.log('Rentang tanggal : ' + format(Math.min(...waktu)) + ' sampai ' + format(Math.max(...waktu)));
  console.log('Total omzet (hanya Paid): Rp ' + omzet.toLocaleString('id-ID'));
  console.log('Kuota layanan tidak diubah. Untuk menghapus semua data uji: npm run hapus:transaksi-dummy');
}

jalankan()
  .then(() => mongoose.disconnect())
  .catch(async (error) => {
    console.error('Gagal: ' + error.message);
    await mongoose.disconnect();
    process.exit(1);
  });
