require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Media = require('../models/Media');

const tampilkanDaftar = process.argv.includes('--daftar');
const argumenFolder = process.argv.slice(2).find((item) => !item.startsWith('--'));
const folder = path.resolve(argumenFolder || 'foto-layanan');
const batasUkuran = 2 * 1024 * 1024;

const jenisBerkas = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp'
};

function slug(teks) {
  return String(teks)
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function isiSesuaiJenis(data, jenis) {
  if (jenis === 'image/png') return data.subarray(0, 4).toString('hex') === '89504e47';
  if (jenis === 'image/jpeg') return data.subarray(0, 3).toString('hex') === 'ffd8ff';
  if (jenis === 'image/webp') return data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP';
  return false;
}

async function jalankan() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI belum diisi di file .env');
  }
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  console.log('MongoDB terhubung ke database: ' + mongoose.connection.name);

  const layanan = await Product.find().sort({ name: 1 });
  if (layanan.length === 0) throw new Error('Belum ada layanan di database');

  if (tampilkanDaftar) {
    console.log('\nNama berkas yang dicari (taruh di folder ' + folder + '):');
    layanan.forEach((item) => console.log('  ' + slug(item.name) + '.jpg   untuk layanan "' + item.name + '"'));
    console.log('\nFormat yang diterima: .jpg, .jpeg, .png, .webp (maksimal 2 MB per berkas).');
    return;
  }

  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
    console.log('Folder dibuat: ' + folder);
    console.log('Taruh foto layanan di folder itu, beri nama sesuai layanan, lalu jalankan perintah ini lagi.');
    console.log('Lihat daftar nama berkas dengan: npm run impor:foto -- --daftar');
    return;
  }

  const berkas = fs.readdirSync(folder).filter((nama) => jenisBerkas[path.extname(nama).toLowerCase()]);
  if (berkas.length === 0) {
    console.log('Tidak ada foto (.jpg, .png, .webp) di folder ' + folder);
    return;
  }

  const peta = {};
  layanan.forEach((item) => {
    peta[slug(item.name)] = item;
  });

  const terpasang = [];
  const dilewati = [];
  for (const nama of berkas) {
    const dasar = slug(path.basename(nama, path.extname(nama)));
    const item = peta[dasar];
    if (!item) {
      dilewati.push(nama + ' (tidak ada layanan bernama "' + dasar + '")');
      continue;
    }
    const lokasi = path.join(folder, nama);
    const jenis = jenisBerkas[path.extname(nama).toLowerCase()];
    const data = fs.readFileSync(lokasi);
    if (data.length > batasUkuran) {
      dilewati.push(nama + ' (lebih dari 2 MB)');
      continue;
    }
    if (!isiSesuaiJenis(data, jenis)) {
      dilewati.push(nama + ' (isi berkas bukan ' + jenis + ')');
      continue;
    }
    const lama = item.image && item.image.startsWith('/media/') ? item.image.replace('/media/', '') : '';
    const media = await Media.create({ key: 'foto-' + dasar, contentType: jenis, data });
    item.image = '/media/' + media._id;
    await item.save();
    if (lama) await Media.deleteOne({ _id: lama }).catch(() => {});
    terpasang.push(item.name + '  <-  ' + nama);
  }

  console.log('\nFoto terpasang: ' + terpasang.length);
  terpasang.forEach((baris) => console.log('  + ' + baris));
  if (dilewati.length) {
    console.log('Dilewati: ' + dilewati.length);
    dilewati.forEach((baris) => console.log('  - ' + baris));
  }
  const tanpaFoto = (await Product.find({ $or: [{ image: '' }, { image: { $exists: false } }] })).map((item) => item.name);
  if (tanpaFoto.length) console.log('\nLayanan yang belum punya foto (' + tanpaFoto.length + '): ' + tanpaFoto.join(', '));
}

jalankan()
  .then(() => mongoose.disconnect())
  .catch(async (error) => {
    console.error('Gagal: ' + error.message);
    await mongoose.disconnect();
    process.exit(1);
  });
