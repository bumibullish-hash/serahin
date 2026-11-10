require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Setting = require('../models/Setting');
const Media = require('../models/Media');

const tanpaUser = process.argv.includes('--tanpa-user');

const { kategori, layanan, bersihkanDataLama } = require('./dataLayanan');

const warnaKategori = {
  Desain: ['#fdba74', '#f97316'],
  Dokumen: ['#93c5fd', '#3b82f6'],
  Video: ['#c4b5fd', '#8b5cf6'],
  Paket: ['#86efac', '#16a34a']
};

const daftarProduk = layanan;

function escapeXml(teks) {
  return String(teks).replace(/[&<>"']/g, (huruf) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[huruf]));
}

function pecahBaris(teks, batas) {
  const kata = teks.split(' ');
  const baris = [''];
  kata.forEach((item) => {
    const terakhir = baris[baris.length - 1];
    if ((terakhir + ' ' + item).trim().length <= batas || terakhir === '') {
      baris[baris.length - 1] = (terakhir + ' ' + item).trim();
    } else {
      baris.push(item);
    }
  });
  return baris.slice(0, 3);
}

function buatGambar(nama, kategori) {
  const warna = warnaKategori[kategori];
  const namaTampil = nama.replace(/\s*\(.*\)\s*$/, '');
  const baris = pecahBaris(namaTampil, 16);
  const awalY = 225 - ((baris.length - 1) * 26) + 12;
  const teks = baris
    .map((isi, indeks) => '<text x="300" y="' + (awalY + indeks * 52) + '" text-anchor="middle" font-family="Poppins, Arial, sans-serif" font-size="42" font-weight="700" fill="#1f2937">' + escapeXml(isi) + '</text>')
    .join('');
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450" viewBox="0 0 600 450">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + warna[0] + '"/><stop offset="1" stop-color="' + warna[1] + '"/></linearGradient></defs>' +
    '<rect width="600" height="450" fill="url(#g)"/>' +
    '<circle cx="300" cy="225" r="170" fill="#ffffff" fill-opacity="0.22"/>' +
    '<circle cx="300" cy="225" r="120" fill="#ffffff" fill-opacity="0.32"/>' +
    teks +
    '<text x="300" y="410" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="22" fill="#1f2937" fill-opacity="0.7">' + escapeXml(kategori) + '</text>' +
    '</svg>'
  );
}

function kunciMedia(nama) {
  return 'dummy-' + nama.toLowerCase().replace(/\(.*\)/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function jalankan() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI belum diisi di file .env');
  }
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  console.log('MongoDB terhubung ke database: ' + mongoose.connection.name);

  const hasilBersih = await bersihkanDataLama({ Product, Category, Setting, Media });
  if (hasilBersih.produkLamaDihapus > 0) console.log('Data contoh makanan lama dihapus: ' + hasilBersih.produkLamaDihapus + ' layanan lama');
  if (hasilBersih.pengaturanDiperbarui) console.log('Pengaturan usaha diperbarui ke Jasa Serahin');

  const kategoriMap = {};
  for (const nama of kategori) {
    const kategori = await Category.findOneAndUpdate({ name: nama }, { $setOnInsert: { name: nama } }, { upsert: true, returnDocument: 'after' });
    kategoriMap[nama] = kategori._id;
  }

  let baru = 0;
  let diperbarui = 0;
  for (const [kategori, nama, harga, modal, stok, deskripsi] of daftarProduk) {
    const media = await Media.findOneAndUpdate(
      { key: kunciMedia(nama) },
      { $set: { contentType: 'image/svg+xml', data: Buffer.from(buatGambar(nama, kategori)) } },
      { upsert: true, returnDocument: 'after' }
    );
    const data = {
      category: kategoriMap[kategori],
      description: deskripsi,
      price: harga,
      costPrice: modal,
      stock: stok,
      image: '/media/' + media._id,
      isActive: true
    };
    const ada = await Product.findOne({ name: nama });
    if (ada) {
      await Product.updateOne({ _id: ada._id }, { $set: data });
      diperbarui += 1;
    } else {
      await Product.create({ name: nama, ...data });
      baru += 1;
    }
  }
  console.log('Layanan dummy: ' + baru + ' ditambahkan, ' + diperbarui + ' dikembalikan ke harga dan kuota awal');

  if (!tanpaUser) {
    const email = 'pelanggan@serahin.local';
    const ada = await User.findOne({ email });
    if (ada) {
      console.log('Akun pelanggan uji sudah ada: ' + email);
    } else {
      await User.create({
        name: 'Pelanggan Uji',
        email,
        phone: '081234567890',
        password: await bcrypt.hash('pelanggan123', 10),
        role: 'user'
      });
      console.log('Akun pelanggan uji dibuat: ' + email + ' / pelanggan123');
    }
  }

  const total = await Product.countDocuments();
  console.log('Total layanan di database: ' + total);
  console.log('Selesai. Buka http://localhost:' + (process.env.PORT || 3000) + '/layanan');
}

jalankan()
  .then(() => mongoose.disconnect())
  .catch(async (error) => {
    console.error('Gagal: ' + error.message);
    await mongoose.disconnect();
    process.exit(1);
  });
