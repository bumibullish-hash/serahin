const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'rahasia-untuk-pengujian-saja-1234567890';
process.env.BAYARAJA_API_KEY = 'byr_kunci_uji';
process.env.BAYARAJA_QRIS_ACCOUNT_ID = '11111111-1111-1111-1111-111111111111';
process.env.BAYARAJA_WEBHOOK_SECRET = 'rahasia-webhook-uji';
process.env.PAYMENT_EXPIRE_MINUTES = '30';
process.env.MONGODB_URI = process.env.TEST_MONGODB_URI || '';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const buatMock = require('./mockBayaraja');
const { buatKlien, formProduk, waktuAmbil } = require('./helper');

let mock;
let mockPort;
let server;
let baseUrl;
let admin;
let userA;
let userB;
let kategori;
let produk;
const slugOrder = {};

async function kontrolMock(slug, aksi) {
  await fetch('http://localhost:' + mockPort + '/__kontrol/' + slug + '/' + aksi);
}

async function slugDariOrder(orderId) {
  const Payment = require('../backend/models/Payment');
  const payment = await Payment.findOne({ order: orderId });
  return payment.slug;
}

async function belanja(klien, jumlah, metode, menitAmbil) {
  await klien.post('/api/cart', { productId: produk._id, quantity: jumlah });
  return klien.post('/api/orders/checkout', {
    paymentMethod: metode,
    pickupPoint: 'WhatsApp',
    pickupTime: waktuAmbil(menitAmbil || 120),
    note: 'Tolong rapikan CV saya, bahannya ada di Google Drive', phone: '081234567890'
  });
}

async function stokProduk() {
  const Product = require('../backend/models/Product');
  return (await Product.findById(produk._id)).stock;
}

before(async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('Isi TEST_MONGODB_URI dengan database khusus pengujian, contoh: mongodb://127.0.0.1:27017/ngemilkampus_test');
  }
  const namaDb = new URL(process.env.MONGODB_URI.replace('mongodb+srv://', 'http://').replace('mongodb://', 'http://')).pathname.replace('/', '');
  if (!namaDb.endsWith('_test')) {
    throw new Error('Nama database pengujian harus diakhiri _test agar data asli tidak terhapus');
  }

  mock = buatMock('byr_kunci_uji', () => mockPort);
  await new Promise((selesai) => mock.listen(0, selesai));
  mockPort = mock.address().port;
  process.env.BAYARAJA_BASE_URL = 'http://localhost:' + mockPort;

  await mongoose.connect(process.env.MONGODB_URI);
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));

  const app = require('../backend/app');
  await new Promise((selesai) => {
    server = app.listen(0, selesai);
  });
  baseUrl = 'http://localhost:' + server.address().port;

  const User = require('../backend/models/User');
  await User.create({ name: 'Admin Uji', email: 'admin@uji.test', password: await bcrypt.hash('admin123', 10), role: 'admin' });

  admin = buatKlien(baseUrl);
  userA = buatKlien(baseUrl);
  userB = buatKlien(baseUrl);
});

after(async () => {
  if (server) server.close();
  if (mock) mock.close();
  await mongoose.disconnect();
});

test('1. Registrasi, login, logout, dan validasi input', async () => {
  const gagal = await userA.post('/api/auth/register', { name: 'A', email: 'salah', password: '123' });
  assert.equal(gagal.status, 400);

  const daftar = await userA.post('/api/auth/register', { name: 'Budi Santoso', email: 'budi@uji.test', password: 'rahasia1', phone: '081234567890' });
  assert.equal(daftar.status, 201);
  assert.equal(daftar.data.user.role, 'user');

  const kembar = await buatKlien(baseUrl).post('/api/auth/register', { name: 'Budi Lagi', email: 'BUDI@uji.test', password: 'rahasia1' });
  assert.equal(kembar.status, 409);

  await userB.post('/api/auth/register', { name: 'Siti Aminah', email: 'siti@uji.test', password: 'rahasia2' });

  const me = await userA.get('/api/auth/me');
  assert.equal(me.data.user.email, 'budi@uji.test');

  await userA.post('/api/auth/logout');
  assert.equal((await userA.get('/api/auth/me')).data.user, null);

  const salah = await userA.post('/api/auth/login', { email: 'budi@uji.test', password: 'salahsalah' });
  assert.equal(salah.status, 401);
  const benar = await userA.post('/api/auth/login', { email: 'budi@uji.test', password: 'rahasia1' });
  assert.equal(benar.status, 200);

  const loginAdmin = await admin.post('/api/auth/login', { email: 'admin@uji.test', password: 'admin123' });
  assert.equal(loginAdmin.data.user.role, 'admin');

  const registrasiAdmin = await buatKlien(baseUrl).post('/api/auth/register', { name: 'Penyusup', email: 'x@uji.test', password: 'rahasia1', role: 'admin' });
  assert.equal(registrasiAdmin.data.user.role, 'user');
});

test('2. Pembatasan akses berdasarkan role', async () => {
  const tamu = buatKlien(baseUrl);
  assert.equal((await tamu.get('/api/admin/dashboard')).status, 401);
  assert.equal((await tamu.get('/api/cart')).status, 401);
  assert.equal((await userA.get('/api/admin/dashboard')).status, 403);
  assert.equal((await userA.get('/api/admin/reports/sales')).status, 403);
  assert.equal((await admin.get('/api/admin/dashboard')).status, 200);
  assert.equal((await admin.get('/api/cart')).status, 403);

  const halamanAdminTamu = await tamu.get('/admin');
  assert.equal(halamanAdminTamu.status, 302);
  assert.match(halamanAdminTamu.headers.get('location'), /^\/login/);
  const halamanAdminUser = await userA.get('/admin');
  assert.equal(halamanAdminUser.status, 302);
  assert.equal(halamanAdminUser.headers.get('location'), '/');
  const halamanKeranjangAdmin = await admin.get('/keranjang');
  assert.equal(halamanKeranjangAdmin.headers.get('location'), '/admin');
});

test('3. Kategori dan produk: tambah, ubah, hapus, validasi', async () => {
  const k = await admin.post('/api/admin/categories', { name: 'Desain', description: 'Layanan desain' });
  assert.equal(k.status, 201);
  kategori = k.data.category;
  assert.equal((await admin.post('/api/admin/categories', { name: 'desain' })).status, 409);

  const tanpaNama = await admin.kirimForm('POST', '/api/admin/products', formProduk({ name: '', category: kategori._id, price: 5000, costPrice: 2000, stock: 10 }));
  assert.equal(tanpaNama.status, 400);
  const hargaMinus = await admin.kirimForm('POST', '/api/admin/products', formProduk({ name: 'Rusak', category: kategori._id, price: -1, costPrice: 0, stock: 10 }));
  assert.equal(hargaMinus.status, 400);

  const tambah = await admin.kirimForm('POST', '/api/admin/products', formProduk({ name: 'Poster Acara', category: kategori._id, price: 5000, costPrice: 2800, stock: 20, description: 'Enak' }, true));
  assert.equal(tambah.status, 201);
  produk = tambah.data.product;
  assert.match(produk.image, /^\/media\/[0-9a-f]{24}$/);
  const gambar = await buatKlien(baseUrl).get(produk.image, { biner: true });
  assert.equal(gambar.status, 200);
  assert.equal(gambar.headers.get('content-type'), 'image/png');
  assert.equal((await buatKlien(baseUrl).get('/media/bukan-id')).status, 404);

  const ubah = await admin.kirimForm('PUT', '/api/admin/products/' + produk._id, formProduk({ name: 'Poster Acara Spesial', category: kategori._id, price: 6000, costPrice: 3000, stock: 20, isActive: true }));
  assert.equal(ubah.status, 200);
  assert.equal(ubah.data.product.price, 6000);
  produk = ubah.data.product;

  assert.equal((await userA.kirimForm('POST', '/api/admin/products', formProduk({ name: 'Ilegal', category: kategori._id, price: 5000, costPrice: 0, stock: 1 }))).status, 403);

  const publik = await buatKlien(baseUrl).get('/api/products');
  assert.equal(publik.data.products.length, 1);

  const sementara = await admin.kirimForm('POST', '/api/admin/products', formProduk({ name: 'Layanan Hapus', category: kategori._id, price: 3000, costPrice: 1000, stock: 5 }));
  const hapus = await admin.delete('/api/admin/products/' + sementara.data.product._id);
  assert.equal(hapus.status, 200);

  assert.equal((await admin.delete('/api/admin/categories/' + kategori._id)).status, 400);
  assert.equal((await admin.get('/api/admin/products/abc')).status, 404);
});

test('4. Keranjang: tambah, batas stok, ubah jumlah, hapus', async () => {
  assert.equal((await userA.post('/api/cart', { productId: produk._id, quantity: 999 })).status, 400);
  assert.equal((await userA.post('/api/cart', { productId: 'bukan-id', quantity: 1 })).status, 400);
  assert.equal((await userA.post('/api/cart', { productId: produk._id, quantity: 2 })).status, 201);
  assert.equal((await userA.put('/api/cart/' + produk._id, { quantity: 3 })).status, 200);
  const isi = await userA.get('/api/cart');
  assert.equal(isi.data.items[0].quantity, 3);
  assert.equal(isi.data.total, 18000);
  assert.equal((await userA.get('/api/cart/count')).data.count, 3);
  await userA.delete('/api/cart/' + produk._id);
  assert.equal((await userA.get('/api/cart')).data.items.length, 0);
});

test('5. Checkout QRIS: stok berkurang, status Pending, bukan omzet', async () => {
  const kosong = await userA.post('/api/orders/checkout', { paymentMethod: 'qris', pickupPoint: 'WhatsApp', pickupTime: waktuAmbil(60), note: 'Brief pekerjaan uji yang cukup panjang', phone: '081234567890' });
  assert.equal(kosong.status, 400);

  await userA.post('/api/cart', { productId: produk._id, quantity: 2 });
  const titikSalah = await userA.post('/api/orders/checkout', { paymentMethod: 'qris', pickupPoint: 'Tempat Rahasia', pickupTime: waktuAmbil(60), note: 'Brief pekerjaan uji yang cukup panjang', phone: '081234567890' });
  assert.equal(titikSalah.status, 400);
  const lampau = await userA.post('/api/orders/checkout', { paymentMethod: 'qris', pickupPoint: 'WhatsApp', pickupTime: waktuAmbil(-60), note: 'Brief pekerjaan uji yang cukup panjang', phone: '081234567890' });
  assert.equal(lampau.status, 400);
  const metodeSalah = await userA.post('/api/orders/checkout', { paymentMethod: 'cash', pickupPoint: 'WhatsApp', pickupTime: waktuAmbil(60), note: 'Brief pekerjaan uji yang cukup panjang', phone: '081234567890' });
  const dasar = { paymentMethod: 'qris', pickupPoint: 'WhatsApp', pickupTime: waktuAmbil(60), note: 'Brief pekerjaan uji yang cukup panjang', phone: '081234567890' };
  const tanpaBrief = await userA.post('/api/orders/checkout', { ...dasar, note: '' });
  assert.equal(tanpaBrief.status, 400);
  assert.match(tanpaBrief.data.message, /Brief pekerjaan/);
  assert.equal((await userA.post('/api/orders/checkout', { ...dasar, note: 'pendek' })).status, 400);
  const tanpaWa = await userA.post('/api/orders/checkout', { ...dasar, phone: 'abc' });
  assert.equal(tanpaWa.status, 400);
  assert.match(tanpaWa.data.message, /WhatsApp/);
  const terlaluJauh = await userA.post('/api/orders/checkout', { ...dasar, pickupTime: waktuAmbil(31 * 24 * 60) });
  assert.equal(terlaluJauh.status, 400);
  assert.match(terlaluJauh.data.message, /30 hari/);
  assert.equal(metodeSalah.status, 400);
  await userA.delete('/api/cart/' + produk._id);

  const stokAwal = await stokProduk();
  const hasil = await belanja(userA, 2, 'qris');
  assert.equal(hasil.status, 201);
  assert.match(hasil.data.invoiceNumber, /^INV-\d{8}-0001$/);
  slugOrder.qris = hasil.data.orderId;
  assert.equal(await stokProduk(), stokAwal - 2);
  assert.equal((await userA.get('/api/cart')).data.items.length, 0);

  const detail = await userA.get('/api/orders/' + hasil.data.orderId);
  assert.equal(detail.data.order.total, 12000);
  assert.equal(detail.data.order.customerPhone, '081234567890');
  assert.equal(detail.data.order.note, 'Tolong rapikan CV saya, bahannya ada di Google Drive');
  assert.equal(detail.data.order.paymentStatus, 'pending');
  assert.equal(detail.data.order.orderStatus, 'menunggu_pembayaran');
  assert.match(detail.data.payment.qrImage, /^data:image\//);
  assert.match(detail.data.payment.paymentUrl, /^http/);
  assert.equal(detail.data.payment.status, 'pending');

  const laporan = await admin.get('/api/admin/reports/sales?period=bulan-ini');
  assert.equal(laporan.data.ringkasan.omzet, 0);
  assert.equal(laporan.data.ringkasan.pending, 1);
});

test('6. Status pembayaran: tidak Paid sebelum konfirmasi Bayaraja', async () => {
  const id = slugOrder.qris;
  const slug = await slugDariOrder(id);

  let cek = await userA.post('/api/orders/' + id + '/refresh');
  assert.equal(cek.data.order.paymentStatus, 'pending');

  await kontrolMock(slug, 'bukti');
  await new Promise((selesai) => setTimeout(selesai, 3100));
  cek = await userA.post('/api/orders/' + id + '/refresh');
  assert.equal(cek.data.order.paymentStatus, 'pending');

  await kontrolMock(slug, 'konfirmasi');
  await new Promise((selesai) => setTimeout(selesai, 3100));
  cek = await userA.post('/api/orders/' + id + '/refresh');
  assert.equal(cek.data.order.paymentStatus, 'paid');
  assert.equal(cek.data.order.orderStatus, 'diproses');
  assert.ok(cek.data.order.paidAt);

  const stokSetelahPaid = await stokProduk();
  await admin.post('/api/orders/' + id + '/refresh');
  assert.equal(await stokProduk(), stokSetelahPaid);
});

test('7. Akses data: user lain tidak bisa melihat transaksi', async () => {
  const id = slugOrder.qris;
  assert.equal((await userB.get('/api/orders/' + id)).status, 404);
  assert.equal((await userB.get('/api/orders/' + id + '/invoice.pdf')).status, 404);
  assert.equal((await userB.get('/api/orders/' + id, { biner: true })).status, 404);
  assert.equal((await userB.get('/api/orders')).data.orders.length, 0);
  assert.equal((await userA.get('/api/orders')).data.orders.length, 1);
  assert.equal((await admin.get('/api/orders/' + id)).status, 200);
  assert.equal((await userA.get('/api/orders/id-ngawur')).status, 400);
});

test('8. Invoice PDF dan halaman invoice', async () => {
  const id = slugOrder.qris;
  const pdf = await userA.get('/api/orders/' + id + '/invoice.pdf', { biner: true });
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get('content-type'), 'application/pdf');
  assert.equal(pdf.data.subarray(0, 4).toString(), '%PDF');
  const adminPdf = await admin.get('/api/orders/' + id + '/invoice.pdf', { biner: true });
  assert.equal(adminPdf.status, 200);
  assert.equal((await userA.get('/invoice?id=' + id)).status, 200);
});

test('9. Ditolak: stok kembali sekali saja', async () => {
  const stokAwal = await stokProduk();
  const hasil = await belanja(userB, 3, 'link');
  assert.equal(hasil.status, 201);
  assert.equal(await stokProduk(), stokAwal - 3);
  const id = hasil.data.orderId;
  const slug = await slugDariOrder(id);

  await kontrolMock(slug, 'bukti');
  await kontrolMock(slug, 'tolak');
  await new Promise((selesai) => setTimeout(selesai, 3100));
  const cek = await userB.post('/api/orders/' + id + '/refresh');
  assert.equal(cek.data.order.paymentStatus, 'rejected');
  assert.equal(cek.data.order.orderStatus, 'dibatalkan');
  assert.equal(await stokProduk(), stokAwal);

  await admin.post('/api/orders/' + id + '/refresh');
  await admin.post('/api/orders/' + id + '/refresh');
  assert.equal(await stokProduk(), stokAwal);
  assert.equal((await admin.patch('/api/admin/orders/' + id + '/status', { orderStatus: 'selesai' })).status, 400);
});

test('10. Kedaluwarsa dan pembayaran terlambat lewat sinkronisasi', async () => {
  process.env.PAYMENT_EXPIRE_MINUTES = '0.01';
  const stokAwal = await stokProduk();
  const hasil = await belanja(userB, 1, 'qris');
  process.env.PAYMENT_EXPIRE_MINUTES = '30';
  assert.equal(hasil.status, 201);
  const id = hasil.data.orderId;
  const slug = await slugDariOrder(id);
  assert.equal(await stokProduk(), stokAwal - 1);

  await new Promise((selesai) => setTimeout(selesai, 1200));
  const { expireOverdueOrders } = require('../backend/services/paymentService');
  await expireOverdueOrders();
  let detail = await userB.get('/api/orders/' + id);
  assert.equal(detail.data.order.paymentStatus, 'expired');
  assert.equal(await stokProduk(), stokAwal);

  await kontrolMock(slug, 'bukti');
  await kontrolMock(slug, 'konfirmasi');
  const sinkron = await admin.post('/api/admin/sync', {});
  assert.equal(sinkron.status, 200);
  assert.ok(sinkron.data.berubah >= 1);
  detail = await userB.get('/api/orders/' + id);
  assert.equal(detail.data.order.paymentStatus, 'paid');
  assert.equal(await stokProduk(), stokAwal - 1);
  assert.match(detail.data.order.adminNote, /kedaluwarsa/);

  const transaksi = await admin.get('/api/admin/bayaraja-transactions?status=confirmed');
  assert.ok(transaksi.data.transactions.length >= 1);
});

test('11. Admin mengubah status pesanan setelah Paid', async () => {
  const id = slugOrder.qris;
  assert.equal((await admin.patch('/api/admin/orders/' + id + '/status', { orderStatus: 'siap_diambil' })).status, 200);
  assert.equal((await admin.patch('/api/admin/orders/' + id + '/status', { orderStatus: 'selesai' })).data.order.orderStatus, 'selesai');
  assert.equal((await admin.patch('/api/admin/orders/' + id + '/status', { orderStatus: 'apa-saja' })).status, 400);
  assert.equal((await userA.patch('/api/admin/orders/' + id + '/status', { orderStatus: 'diproses' })).status, 403);
});

test('12. Laporan hanya menghitung transaksi Paid, filter periode, dan ekspor PDF', async () => {
  const Order = require('../backend/models/Order');
  const semua = await Order.find().lean();
  const paid = semua.filter((order) => order.paymentStatus === 'paid');
  const omzetSeharusnya = paid.reduce((jumlah, order) => jumlah + order.total, 0);
  const modalSeharusnya = paid.reduce((jumlah, order) => jumlah + order.items.reduce((j, item) => j + item.costPrice * item.quantity, 0), 0);
  assert.ok(semua.some((order) => order.paymentStatus === 'rejected'));
  assert.ok(paid.length >= 2);

  const penjualan = await admin.get('/api/admin/reports/sales?period=bulan-ini');
  assert.equal(penjualan.data.ringkasan.omzet, omzetSeharusnya);
  assert.equal(penjualan.data.ringkasan.paid, paid.length);
  assert.equal(penjualan.data.ringkasan.rejected, 1);
  assert.equal(penjualan.data.baris.length, semua.length);
  const hanyaRejected = await admin.get('/api/admin/reports/sales?period=bulan-ini&status=rejected');
  assert.equal(hanyaRejected.data.baris.length, 1);
  assert.equal(penjualan.data.grafik.reduce((jumlah, baris) => jumlah + baris.omzet, 0), omzetSeharusnya);

  const hariIni = await admin.get('/api/admin/reports/sales?period=hari-ini');
  assert.equal(hariIni.data.ringkasan.omzet, omzetSeharusnya);
  const bulanLalu = await admin.get('/api/admin/reports/sales?period=bulan-lalu');
  assert.equal(bulanLalu.data.ringkasan.omzet, 0);
  const tahunIni = await admin.get('/api/admin/reports/sales?period=tahun-ini');
  assert.equal(tahunIni.data.ringkasan.omzet, omzetSeharusnya);
  assert.equal(tahunIni.data.periode.unit, 'month');
  const tujuhHari = await admin.get('/api/admin/reports/sales?period=7-hari');
  assert.equal(tujuhHari.data.ringkasan.omzet, omzetSeharusnya);

  const kemarin = new Date(Date.now() + 7 * 3600 * 1000 - 86400000).toISOString().slice(0, 10);
  const sepuluhHariLalu = new Date(Date.now() + 7 * 3600 * 1000 - 11 * 86400000).toISOString().slice(0, 10);
  const sebelumHariIni = await admin.get('/api/admin/reports/sales?period=kustom&from=' + sepuluhHariLalu + '&to=' + kemarin);
  assert.equal(sebelumHariIni.data.ringkasan.omzet, 0);
  const hariIniKustom = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  const kustom = await admin.get('/api/admin/reports/sales?period=kustom&from=' + hariIniKustom + '&to=' + hariIniKustom);
  assert.equal(kustom.data.ringkasan.omzet, omzetSeharusnya);
  assert.equal((await admin.get('/api/admin/reports/sales?period=kustom&from=2026-02-01&to=2026-01-01')).status, 400);
  assert.equal((await admin.get('/api/admin/reports/sales?period=kustom&from=abc&to=xyz')).status, 400);
  assert.equal((await admin.get('/api/admin/reports/sales?period=kustom&from=2020-01-01&to=2026-01-01')).status, 400);

  const biaya = await admin.post('/api/admin/expenses', { title: 'Beli kemasan', category: 'Kemasan', amount: 7000, date: hariIniKustom });
  assert.equal(biaya.status, 201);
  assert.equal((await admin.post('/api/admin/expenses', { title: 'x', category: 'Salah', amount: -5, date: 'kemarin' })).status, 400);

  const keuangan = await admin.get('/api/admin/reports/finance?period=bulan-ini');
  const r = keuangan.data.ringkasan;
  assert.equal(r.pendapatan, omzetSeharusnya);
  assert.equal(r.hpp, modalSeharusnya);
  assert.equal(r.pengeluaran, 7000);
  assert.equal(r.labaKotor, omzetSeharusnya - modalSeharusnya);
  assert.equal(r.labaBersih, omzetSeharusnya - modalSeharusnya - 7000);
  assert.equal(r.transaksiBerhasil, paid.length);

  for (const alamat of [
    '/api/admin/reports/sales.pdf?period=bulan-ini',
    '/api/admin/reports/finance.pdf?period=tahun-ini',
    '/api/admin/reports/sales.pdf?period=kustom&from=' + hariIniKustom + '&to=' + hariIniKustom
  ]) {
    const pdf = await admin.get(alamat, { biner: true });
    assert.equal(pdf.status, 200);
    assert.equal(pdf.headers.get('content-type'), 'application/pdf');
    assert.equal(pdf.data.subarray(0, 4).toString(), '%PDF');
  }
  assert.equal((await userA.get('/api/admin/reports/sales.pdf')).status, 403);
});

test('13. Dashboard admin, pengguna, pengaturan', async () => {
  const dashboard = await admin.get('/api/admin/dashboard');
  assert.equal(dashboard.data.ringkasan.totalTransaksi, 3);
  assert.equal(dashboard.data.ringkasan.berhasil, 2);
  assert.equal(dashboard.data.ringkasan.pending, 0);
  assert.equal(dashboard.data.ringkasan.jumlahProduk, 1);
  assert.equal(dashboard.data.terlaris[0].jumlah, 3);
  assert.equal(dashboard.data.grafik.length, 7);
  assert.equal((await admin.get('/api/admin/dashboard?days=30')).data.grafik.length, 30);

  const pengguna = await admin.get('/api/admin/users');
  assert.ok(pengguna.data.users.length >= 4);
  const budi = pengguna.data.users.find((user) => user.email === 'budi@uji.test');
  assert.equal(budi.jumlahPesanan, 1);
  assert.equal(budi.password, undefined);

  const simpan = await admin.put('/api/admin/settings', { businessName: 'Jasa Serahin', tagline: 'Tes', address: 'Jl. Kampus 1', phone: '0812', email: '', pickupHours: '09.00 - 15.00', pickupPoints: ['WhatsApp', 'Email'] });
  assert.equal(simpan.status, 200);
  assert.equal((await admin.put('/api/admin/settings', { businessName: '', pickupPoints: [] })).status, 400);
  const publik = await buatKlien(baseUrl).get('/api/settings/public');
  assert.deepEqual(publik.data.setting.pickupPoints, ['WhatsApp', 'Email']);
  await admin.put('/api/admin/settings', { businessName: 'Jasa Serahin', pickupPoints: ['WhatsApp', 'Email', 'Google Drive'] });
});

test('13b. Endpoint cron hanya untuk pemanggil yang berwenang', async () => {
  const tamu = buatKlien(baseUrl);
  assert.equal((await tamu.get('/api/cron/expire')).status, 503);
  process.env.CRON_SECRET = 'rahasia-cron-uji';
  assert.equal((await tamu.get('/api/cron/expire')).status, 401);
  const salah = await fetch(baseUrl + '/api/cron/expire', { headers: { authorization: 'Bearer salah' } });
  assert.equal(salah.status, 401);
  const benar = await fetch(baseUrl + '/api/cron/expire', { headers: { authorization: 'Bearer rahasia-cron-uji' } });
  assert.equal(benar.status, 200);
  delete process.env.CRON_SECRET;
});

test('14. Webhook: verifikasi signature HMAC SHA256', async () => {
  const badan = JSON.stringify({ event: 'transaction.confirmed' });
  const tanpa = await fetch(baseUrl + '/api/webhooks/bayaraja', { method: 'POST', headers: { 'content-type': 'application/json' }, body: badan });
  assert.equal(tanpa.status, 401);
  const salah = await fetch(baseUrl + '/api/webhooks/bayaraja', { method: 'POST', headers: { 'content-type': 'application/json', 'x-bayaraja-signature': 'sha256=abc123' }, body: badan });
  assert.equal(salah.status, 401);
  const tanda = crypto.createHmac('sha256', process.env.BAYARAJA_WEBHOOK_SECRET).update(badan).digest('hex');
  const benar = await fetch(baseUrl + '/api/webhooks/bayaraja', { method: 'POST', headers: { 'content-type': 'application/json', 'x-bayaraja-signature': 'sha256=' + tanda }, body: badan });
  assert.equal(benar.status, 200);
  const diubah = await fetch(baseUrl + '/api/webhooks/bayaraja', { method: 'POST', headers: { 'content-type': 'application/json', 'x-bayaraja-signature': 'sha256=' + tanda }, body: badan.replace('confirmed', 'rejected') });
  assert.equal(diubah.status, 401);
});

test('15. Bayaraja gangguan: checkout gagal rapi, stok dan keranjang aman', async () => {
  const stokAwal = await stokProduk();
  const Order = require('../backend/models/Order');
  const jumlahOrder = await Order.countDocuments();
  await fetch('http://localhost:' + mockPort + '/__kontrol/ya/gagal');
  const hasil = await belanja(userA, 1, 'qris');
  await fetch('http://localhost:' + mockPort + '/__kontrol/tidak/gagal');
  assert.equal(hasil.status, 502);
  assert.ok(hasil.data.message.length > 5);
  assert.equal(await stokProduk(), stokAwal);
  assert.equal(await Order.countDocuments(), jumlahOrder);
  assert.equal((await userA.get('/api/cart')).data.items.length, 1);
  await userA.delete('/api/cart/' + produk._id);
});

test('16. Halaman publik, keamanan header, dan penanganan error', async () => {
  const tamu = buatKlien(baseUrl);
  for (const alamat of ['/', '/layanan', '/layanan-detail', '/login', '/register']) {
    assert.equal((await tamu.get(alamat)).status, 200, alamat);
  }
  const tidakAda = await tamu.get('/halaman-tidak-ada');
  assert.equal(tidakAda.status, 404);
  const apiTidakAda = await tamu.get('/api/tidak-ada');
  assert.equal(apiTidakAda.status, 404);
  const csp = (await tamu.get('/')).headers.get('content-security-policy');
  assert.match(csp, /script-src 'self'/);
  const rusak = await fetch(baseUrl + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{rusak' });
  assert.equal(rusak.status, 400);
  const bocor = await tamu.get('/uploads/../../.env');
  assert.notEqual(bocor.status, 200);
});

test('17. Alamat lama dialihkan, halaman layanan dan label status baru', async () => {
  const tamu = buatKlien(baseUrl);
  const lama = await tamu.get('/produk?category=abc');
  assert.equal(lama.status, 301);
  assert.equal(lama.headers.get('location'), '/layanan?category=abc');
  assert.equal((await tamu.get('/produk-detail?id=1')).headers.get('location'), '/layanan-detail?id=1');
  assert.equal((await tamu.get('/admin/produk')).headers.get('location'), '/admin/layanan');
  assert.equal((await admin.get('/admin/layanan')).status, 200);
  assert.equal((await userA.get('/admin/layanan')).status, 302);
  const { labelStatusPesanan } = require('../backend/utils/format');
  assert.equal(labelStatusPesanan.diproses, 'Dikerjakan');
  assert.equal(labelStatusPesanan.siap_diambil, 'Hasil terkirim');
  const sehat = await tamu.get('/api/health');
  assert.equal(sehat.data.app, 'Serahin');
  const pengaturan = await tamu.get('/api/settings/public');
  assert.equal(pengaturan.data.setting.businessName, 'Jasa Serahin');
});

test('18. Skrip transaksi uji: 100 transaksi bertanda data uji, aman dan bisa dihapus', async () => {
  const { execFileSync } = require('child_process');
  const Order = require('../backend/models/Order');
  const User = require('../backend/models/User');
  const jalankan = (...argumen) =>
    execFileSync('node', ['backend/seeds/dummyTransaksi.js', ...argumen], { cwd: require('path').join(__dirname, '..'), env: { ...process.env }, encoding: 'utf8' });

  const asli = await Order.countDocuments({ isDummy: { $ne: true } });
  jalankan();
  jalankan();
  assert.equal(await Order.countDocuments({ isDummy: true }), 100);
  assert.equal(await Order.countDocuments({ isDummy: { $ne: true } }), asli);
  const status = {};
  (await Order.find({ isDummy: true }).lean()).forEach((order) => {
    status[order.paymentStatus] = (status[order.paymentStatus] || 0) + 1;
  });
  assert.deepEqual(status, { paid: 68, expired: 13, rejected: 11, pending: 8 });

  const semua = await Order.find().lean();
  semua.filter((order) => order.isDummy).forEach((order) => {
    assert.equal(order.total, order.items.reduce((jumlah, item) => jumlah + item.subtotal, 0));
    assert.ok(new Date(order.createdAt) <= new Date());
    assert.ok(/^INV-\d{8}-D\d{3}$/.test(order.invoiceNumber));
    if (order.paymentStatus === 'paid') assert.ok(order.paidAt);
    else assert.ok(!order.paidAt);
  });
  const tanggal = new Set(semua.filter((order) => order.isDummy).map((order) => new Date(order.createdAt).toISOString().slice(0, 10)));
  assert.ok(tanggal.size > 30);

  const dariTanggal = new Date(Date.now() + 7 * 3600 * 1000 - 130 * 86400000).toISOString().slice(0, 10);
  const sampaiTanggal = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  const laporan = await admin.get('/api/admin/reports/sales?period=kustom&from=' + dariTanggal + '&to=' + sampaiTanggal);
  const omzetSeharusnya = semua.filter((order) => order.paymentStatus === 'paid').reduce((jumlah, order) => jumlah + order.total, 0);
  assert.equal(laporan.data.ringkasan.omzet, omzetSeharusnya);
  assert.equal(laporan.data.ringkasan.total, semua.length);
  assert.ok(laporan.data.baris.some((baris) => baris.isDummy === true));

  const keuangan = await admin.get('/api/admin/reports/finance?period=kustom&from=' + dariTanggal + '&to=' + sampaiTanggal);
  const hppSeharusnya = semua.filter((order) => order.paymentStatus === 'paid').reduce((jumlah, order) => jumlah + order.items.reduce((j, item) => j + item.costPrice * item.quantity, 0), 0);
  assert.equal(keuangan.data.ringkasan.hpp, hppSeharusnya);
  const tahunIni = await admin.get('/api/admin/reports/sales?period=bulan-lalu');
  assert.equal(tahunIni.status, 200);

  const pendingUji = await Order.findOne({ isDummy: true, paymentStatus: 'pending' });
  const cek = await admin.post('/api/orders/' + pendingUji._id + '/refresh');
  assert.equal(cek.status, 200);
  assert.match(cek.data.peringatan, /data uji/);
  const { expireOverdueOrders } = require('../backend/services/paymentService');
  await expireOverdueOrders(50);
  assert.equal(await Order.countDocuments({ isDummy: true, paymentStatus: 'pending' }), 8);

  const pdf = await admin.get('/api/orders/' + pendingUji._id + '/invoice.pdf', { biner: true });
  assert.equal(pdf.status, 200);
  assert.equal(pdf.data.subarray(0, 4).toString(), '%PDF');
  const dashboard = await admin.get('/api/admin/dashboard');
  assert.equal(dashboard.data.ringkasan.totalTransaksi, semua.length);

  jalankan('--hapus');
  assert.equal(await Order.countDocuments({ isDummy: true }), 0);
  assert.equal(await Order.countDocuments(), asli);
  assert.equal(await User.countDocuments({ email: /^dummy\d+@serahin\.local$/ }), 0);
});

test('19. Transaksi uji dengan rentang --dari dan impor foto layanan', async () => {
  const { execFileSync } = require('child_process');
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const Order = require('../backend/models/Order');
  const Product = require('../backend/models/Product');
  const akar = path.join(__dirname, '..');
  const jalankan = (berkas, ...argumen) => execFileSync('node', [berkas, ...argumen], { cwd: akar, env: { ...process.env }, encoding: 'utf8' });

  const dari = new Date(Date.now() + 7 * 3600 * 1000 - 29 * 86400000).toISOString().slice(0, 10);
  jalankan('backend/seeds/dummyTransaksi.js', '--dari=' + dari);
  const dibuat = await Order.find({ isDummy: true }).lean();
  assert.equal(dibuat.length, 100);
  const batasAwal = new Date(dari + 'T00:00:00+07:00').getTime();
  dibuat.forEach((order) => assert.ok(new Date(order.createdAt).getTime() >= batasAwal));
  assert.throws(() => jalankan('backend/seeds/dummyTransaksi.js', '--dari=bukan-tanggal'), /Command failed/);
  assert.throws(() => jalankan('backend/seeds/dummyTransaksi.js', '--dari=2099-01-01'), /Command failed/);
  jalankan('backend/seeds/dummyTransaksi.js', '--hapus');

  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'foto-'));
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  fs.writeFileSync(path.join(folder, 'poster-acara-spesial.png'), png);
  fs.writeFileSync(path.join(folder, 'tidak-ada-layanan.png'), png);
  fs.writeFileSync(path.join(folder, 'palsu.jpg'), Buffer.from('ini bukan gambar'));
  const keluaran = jalankan('backend/seeds/imporFoto.js', folder);
  assert.match(keluaran, /Foto terpasang: 1/);
  assert.match(keluaran, /Dilewati: 2/);
  const layanan = await Product.findOne({ name: 'Poster Acara Spesial' });
  assert.match(layanan.image, /^\/media\/[0-9a-f]{24}$/);
  const gambar = await buatKlien(baseUrl).get(layanan.image, { biner: true });
  assert.equal(gambar.status, 200);
  assert.equal(gambar.headers.get('content-type'), 'image/png');
  assert.match(jalankan('backend/seeds/imporFoto.js', '--daftar'), /poster-acara-spesial\.jpg/);
  fs.rmSync(folder, { recursive: true, force: true });
});
