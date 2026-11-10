function kartuProduk(layanan) {
  const habis = layanan.stock <= 0;
  const kategori = layanan.category ? layanan.category.name : '';
  return (
    '<article class="product-card">' +
    '<a class="product-thumb" href="/layanan-detail?id=' + esc(layanan._id) + '" aria-label="' + esc(layanan.name) + '">' + thumbProduk(layanan) + '</a>' +
    '<div class="product-info">' +
    '<span class="product-cat">' + esc(kategori) + '</span>' +
    '<a class="product-name" href="/layanan-detail?id=' + esc(layanan._id) + '">' + esc(layanan.name) + '</a>' +
    '<span class="product-price">' + rupiah(layanan.price) + '</span>' +
    infoStok(layanan.stock) +
    '</div>' +
    '<div class="product-actions"><button type="button" class="btn btn-primary btn-sm btn-block" data-tambah="' + esc(layanan._id) + '"' + (habis ? ' disabled' : '') + '>' +
    (habis ? 'Kuota habis' : 'Tambah ke keranjang') + '</button></div>' +
    '</article>'
  );
}

async function tambahKeKeranjang(idProduk, jumlah) {
  const user = await ambilUser();
  if (!user) {
    location.href = '/login?next=' + encodeURIComponent(location.pathname + location.search);
    return false;
  }
  if (user.role === 'admin') {
    toast('Akun admin tidak dapat berbelanja. Gunakan akun user.', 'error');
    return false;
  }
  try {
    const data = await api('/api/cart', { method: 'POST', body: { productId: idProduk, quantity: jumlah || 1 } });
    toast(data.message);
    perbaruiJumlahKeranjang();
    return true;
  } catch (error) {
    toast(error.message, 'error');
    return false;
  }
}

function pasangTombolKeranjang(wadah) {
  wadah.addEventListener('click', async (event) => {
    const tombol = event.target.closest('[data-tambah]');
    if (!tombol) return;
    tombol.disabled = true;
    await tambahKeKeranjang(tombol.dataset.tambah, 1);
    tombol.disabled = false;
  });
}
