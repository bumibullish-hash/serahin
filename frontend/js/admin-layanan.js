const tabelProduk = document.getElementById('tabelProduk');
const formProduk = document.getElementById('formProduk');
const kolomCari = document.getElementById('cariProduk');
const filterKategori = document.getElementById('filterKategori');
let daftarKategori = [];
let daftarProduk = [];

async function muatKategori() {
  const data = await api('/api/admin/categories');
  daftarKategori = data.categories;
  const opsi = daftarKategori.map((item) => '<option value="' + esc(item._id) + '">' + esc(item.name) + '</option>').join('');
  filterKategori.innerHTML = '<option value="">Semua kategori</option>' + opsi;
  formProduk.category.innerHTML = '<option value="">Pilih kategori</option>' + opsi;
}

async function muatProduk() {
  tabelProduk.innerHTML = '<tr><td colspan="8" class="loading"><div class="spinner"></div>Memuat layanan...</td></tr>';
  const query = new URLSearchParams();
  if (kolomCari.value.trim()) query.set('search', kolomCari.value.trim());
  if (filterKategori.value) query.set('category', filterKategori.value);
  try {
    const data = await api('/api/admin/products?' + query.toString());
    daftarProduk = data.products;
    if (daftarProduk.length === 0) {
      tabelProduk.innerHTML = '<tr><td colspan="8" class="empty-box">Belum ada layanan. Klik "Tambah layanan" untuk mulai.</td></tr>';
      return;
    }
    tabelProduk.innerHTML = daftarProduk
      .map(
        (layanan) =>
          '<tr data-id="' + esc(layanan._id) + '">' +
          '<td data-label="Foto"><div class="product-thumb mini">' + thumbProduk(layanan, true) + '</div></td>' +
          '<td data-label="Nama"><strong>' + esc(layanan.name) + '</strong></td>' +
          '<td data-label="Kategori">' + esc(layanan.category ? layanan.category.name : '-') + '</td>' +
          '<td data-label="Harga" class="text-right">' + rupiah(layanan.price) + '</td>' +
          '<td data-label="Biaya pengerjaan" class="text-right">' + rupiah(layanan.costPrice) + '</td>' +
          '<td data-label="Kuota" class="text-right">' + layanan.stock + '</td>' +
          '<td data-label="Status">' + (layanan.isActive ? '<span class="badge badge-paid">Aktif</span>' : '<span class="badge badge-expired">Nonaktif</span>') + '</td>' +
          '<td class="cell-actions"><button type="button" class="btn btn-outline btn-sm" data-aksi="ubah">Ubah</button> ' +
          '<button type="button" class="btn btn-outline btn-sm" data-aksi="toggle">' + (layanan.isActive ? 'Nonaktifkan' : 'Aktifkan') + '</button> ' +
          '<button type="button" class="btn btn-danger-outline btn-sm" data-aksi="hapus">Hapus</button></td></tr>'
      )
      .join('');
  } catch (error) {
    tabelProduk.innerHTML = '<tr><td colspan="8" class="empty-box">' + esc(error.message) + '</td></tr>';
  }
}

function bukaForm(layanan) {
  bersihkanError(formProduk);
  formProduk.reset();
  formProduk.id.value = layanan ? layanan._id : '';
  document.getElementById('judulForm').textContent = layanan ? 'Ubah layanan' : 'Tambah layanan';
  document.getElementById('fotoSaatIni').textContent = '';
  if (layanan) {
    formProduk.name.value = layanan.name;
    formProduk.category.value = layanan.category ? layanan.category._id : '';
    formProduk.price.value = layanan.price;
    formProduk.costPrice.value = layanan.costPrice;
    formProduk.stock.value = layanan.stock;
    formProduk.description.value = layanan.description || '';
    formProduk.isActive.checked = layanan.isActive;
    if (layanan.image) document.getElementById('fotoSaatIni').textContent = 'Foto saat ini akan dipertahankan jika Anda tidak memilih foto baru.';
  } else {
    formProduk.isActive.checked = true;
    formProduk.stock.value = 0;
  }
  bukaDialog('dialogProduk');
}

document.getElementById('tombolTambah').addEventListener('click', () => {
  if (daftarKategori.length === 0) {
    toast('Buat kategori terlebih dahulu di menu Kategori', 'error');
    return;
  }
  bukaForm(null);
});

formProduk.addEventListener('submit', async (event) => {
  event.preventDefault();
  bersihkanError(formProduk);
  const tombol = document.getElementById('simpanProduk');
  const data = new FormData();
  ['name', 'category', 'price', 'costPrice', 'stock', 'description'].forEach((nama) => data.append(nama, formProduk[nama].value.trim()));
  data.append('isActive', formProduk.isActive.checked ? 'true' : 'false');
  if (formProduk.image.files[0]) data.append('image', formProduk.image.files[0]);
  const id = formProduk.id.value;
  setLoading(tombol, true, 'Menyimpan...');
  try {
    await api(id ? '/api/admin/products/' + id : '/api/admin/products', { method: id ? 'PUT' : 'POST', body: data });
    tutupDialog('dialogProduk');
    toast(id ? 'Layanan berhasil diubah' : 'Layanan berhasil ditambahkan');
    muatProduk();
  } catch (error) {
    tampilkanError(formProduk, error);
  }
  setLoading(tombol, false);
});

tabelProduk.addEventListener('click', async (event) => {
  const tombol = event.target.closest('[data-aksi]');
  if (!tombol) return;
  const id = tombol.closest('tr').dataset.id;
  const layanan = daftarProduk.find((item) => item._id === id);
  if (tombol.dataset.aksi === 'ubah') bukaForm(layanan);
  if (tombol.dataset.aksi === 'toggle') {
    try {
      await api('/api/admin/products/' + id + '/toggle', { method: 'PATCH' });
      toast('Status layanan diperbarui');
      muatProduk();
    } catch (error) {
      toast(error.message, 'error');
    }
  }
  if (tombol.dataset.aksi === 'hapus') {
    if (!(await konfirmasi('Hapus layanan "' + layanan.name + '"? Riwayat transaksi lama tidak terpengaruh.', 'Hapus layanan'))) return;
    try {
      await api('/api/admin/products/' + id, { method: 'DELETE' });
      toast('Layanan berhasil dihapus');
      muatProduk();
    } catch (error) {
      toast(error.message, 'error');
    }
  }
});

kolomCari.addEventListener('input', tundaKetik(muatProduk, 350));
filterKategori.addEventListener('change', muatProduk);

muatKategori().then(muatProduk).catch((error) => toast(error.message, 'error'));
