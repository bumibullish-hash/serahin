const wadahDetail = document.getElementById('detailProduk');

async function muatDetail() {
  const id = parameter('id');
  if (!id) {
    wadahDetail.innerHTML = '<div class="empty-box"><h2>Layanan tidak ditemukan</h2><a class="btn btn-primary" href="/layanan">Lihat semua layanan</a></div>';
    return;
  }
  try {
    const data = await api('/api/products/' + encodeURIComponent(id), { tanpaRedirect: true });
    const layanan = data.product;
    document.title = layanan.name + ' - Serahin';
    const habis = layanan.stock <= 0;
    wadahDetail.innerHTML =
      '<div class="product-thumb">' + thumbProduk(layanan) + '</div>' +
      '<div>' +
      '<p class="muted mb-half">' + esc(layanan.category ? layanan.category.name : '') + '</p>' +
      '<h1>' + esc(layanan.name) + '</h1>' +
      '<p class="price">' + rupiah(layanan.price) + '</p>' +
      '<p>' + infoStok(layanan.stock) + '</p>' +
      '<p>' + esc(layanan.description || 'Belum ada deskripsi untuk layanan ini.') + '</p>' +
      '<div class="flex gap mt-2 center-y">' +
      '<div class="qty"><button type="button" id="kurang" aria-label="Kurangi jumlah">-</button>' +
      '<input id="jumlah" type="number" min="1" max="' + Math.max(layanan.stock, 1) + '" value="1" aria-label="Jumlah"' + (habis ? ' disabled' : '') + '>' +
      '<button type="button" id="tambah" aria-label="Tambah jumlah">+</button></div>' +
      '<button type="button" class="btn btn-primary" id="tombolKeranjang"' + (habis ? ' disabled' : '') + '>' + (habis ? 'Kuota habis' : 'Tambah ke keranjang') + '</button>' +
      '</div></div>';

    const kolom = document.getElementById('jumlah');
    const batas = layanan.stock;
    document.getElementById('kurang').addEventListener('click', () => {
      kolom.value = Math.max(1, Number(kolom.value) - 1);
    });
    document.getElementById('tambah').addEventListener('click', () => {
      kolom.value = Math.min(batas, Number(kolom.value) + 1);
    });
    document.getElementById('tombolKeranjang').addEventListener('click', async (event) => {
      const jumlah = Math.floor(Number(kolom.value));
      if (!jumlah || jumlah < 1 || jumlah > batas) {
        toast('Jumlah harus antara 1 dan ' + batas, 'error');
        return;
      }
      event.target.disabled = true;
      await tambahKeKeranjang(layanan._id, jumlah);
      event.target.disabled = false;
    });
  } catch (error) {
    wadahDetail.innerHTML = '<div class="empty-box" data-span="1"><h2>Layanan tidak ditemukan</h2><p>' + esc(error.message) + '</p><a class="btn btn-primary" href="/layanan">Lihat semua layanan</a></div>';
  }
}

muatDetail();
