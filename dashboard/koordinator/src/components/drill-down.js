// Halaman drill-down: rincian per subdivision + tren harian + transaksi terbaru.
// Tidak memakai innerHTML dengan data user (hindari XSS dari isi sheet).

function el(tag, props, children) {
  const n = document.createElement(tag);
  if (props) for (const k in props) {
    if (k === 'class') n.className = props[k];
    else if (k === 'style') n.setAttribute('style', props[k]);
    else if (k === 'dataset') for (const d in props[k]) n.dataset[d] = props[k][d];
    else n[k] = props[k];
  }
  (children || []).forEach((c) => n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return n;
}

function section(title, body) {
  return el('div', { class: 'drill-section' }, [el('h3', {}, [title]), body]);
}

export function showDrillDown(cardCfg, data, formatRupiah) {
  const root = document.getElementById('drill-root');
  root.classList.remove('hidden');
  root.textContent = '';

  const isPemasukan = cardCfg.id === 'pemasukan' || cardCfg.id === 'est-pendapatan';
  const tipeKey = isPemasukan ? 'masuk' : 'keluar';

  // Header
  const btnClose = el('button', { id: 'drill-close', 'aria-label': 'Tutup' }, ['←']);
  root.appendChild(el('div', { class: 'drill-header' }, [btnClose, el('h2', {}, [cardCfg.label])]));

  // Per subdivision
  const perSub = (data.breakdown_cabang || [])
    .map((c) => ({ nama: c.nama, nominal: isPemasukan ? c.masuk : c.keluar }))
    .filter((c) => c.nominal > 0)
    .sort((a, b) => b.nominal - a.nominal);
  const subBody = el('div', {}, perSub.length === 0
    ? [el('p', { class: 'drill-empty' }, ['Belum ada data.'])]
    : perSub.map((c) => el('div', { class: 'branch-row' }, [
        el('span', {}, [c.nama]),
        el('strong', {}, [formatRupiah(c.nominal)])
      ])));
  root.appendChild(section('Rincian Per Subdivision', subBody));

  // Tren
  const tren = (isPemasukan ? data.tren_masuk : data.tren_keluar) || [];
  const maxTren = Math.max(1, ...tren);
  const bar = el('div', { class: 'trend-bar trend-bar--' + tipeKey },
    tren.map((v) => el('span', {
      style: 'height:' + (v / maxTren * 100) + '%',
      title: formatRupiah(v)
    })));
  root.appendChild(section('Tren 14 Hari Terakhir', bar));

  // Transaksi terbaru
  const tx = (data.transaksi_terbaru || []).filter((t) => t.tipe === tipeKey);
  const txBody = el('div', {}, tx.length === 0
    ? [el('p', { class: 'drill-empty' }, ['Belum ada transaksi.'])]
    : tx.map((t) => el('div', { class: 'tx-row' }, [
        el('span', {}, [t.tanggal + ' · ' + t.cabang]),
        el('strong', {}, [formatRupiah(t.nominal)])
      ])));
  root.appendChild(section('Transaksi Terbaru', txBody));

  btnClose.addEventListener('click', () => {
    root.classList.add('hidden');
    root.textContent = '';
  });
}
