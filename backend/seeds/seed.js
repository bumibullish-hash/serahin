require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Setting = require('../models/Setting');
const Media = require('../models/Media');
const { kategori, layanan, bersihkanDataLama } = require('./dataLayanan');

const pakaiContoh = process.argv.includes('--contoh');

async function jalankan() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI belum diisi di file .env');
  }
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  console.log('MongoDB terhubung: ' + mongoose.connection.name);

  const emailAdmin = (process.env.ADMIN_EMAIL || '').toLowerCase();
  const passwordAdmin = process.env.ADMIN_PASSWORD;
  if (!emailAdmin || !passwordAdmin || passwordAdmin.length < 6) {
    throw new Error('ADMIN_EMAIL dan ADMIN_PASSWORD (minimal 6 karakter) wajib diisi di file .env');
  }

  const adminAda = await User.findOne({ email: emailAdmin });
  if (adminAda) {
    console.log('Akun admin sudah ada: ' + emailAdmin);
  } else {
    await User.create({
      name: process.env.ADMIN_NAME || 'Admin Serahin',
      email: emailAdmin,
      password: await bcrypt.hash(passwordAdmin, 10),
      role: 'admin'
    });
    console.log('Akun admin dibuat: ' + emailAdmin);
  }

  const hasil = await bersihkanDataLama({ Product, Category, Setting, Media });
  if (hasil.produkLamaDihapus > 0) console.log('Data contoh makanan lama dihapus: ' + hasil.produkLamaDihapus + ' layanan lama');
  console.log('Pengaturan usaha siap' + (hasil.pengaturanDiperbarui ? ' (nama usaha diperbarui ke Jasa Serahin)' : ''));

  for (const nama of kategori) {
    await Category.updateOne({ name: nama }, { $setOnInsert: { name: nama } }, { upsert: true });
  }
  console.log('Kategori siap: ' + kategori.join(', '));

  if (pakaiContoh) {
    let dibuat = 0;
    for (const [namaKategori, nama, harga, biaya, kuota, deskripsi] of layanan) {
      if (await Product.findOne({ name: nama })) continue;
      const kat = await Category.findOne({ name: namaKategori });
      await Product.create({ name: nama, category: kat._id, price: harga, costPrice: biaya, stock: kuota, description: deskripsi });
      dibuat += 1;
    }
    console.log('Layanan contoh ditambahkan: ' + dibuat);
  }
}

jalankan()
  .then(() => mongoose.disconnect())
  .catch(async (error) => {
    console.error('Seed gagal: ' + error.message);
    await mongoose.disconnect();
    process.exit(1);
  });
