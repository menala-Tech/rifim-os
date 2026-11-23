// Komponen kartu metrik tunggal.
// Menerima { id, label, value, variant, delta } dan fungsi format angka.

export function renderCard(cfg, formatRupiah) {
  const el = document.createElement('article');
  el.className = 'card card--' + cfg.variant;
  el.dataset.id = cfg.id;
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');

  el.innerHTML = `
    <p class="label">${cfg.label}</p>
    <p class="value">${formatRupiah(cfg.value)}</p>
    ${cfg.delta ? `<p class="delta">${cfg.delta}</p>` : ''}
  `;

  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      el.click();
    }
  });

  return el;
}

// Skeleton shimmer untuk loading state.
export function renderSkeleton() {
  const el = document.createElement('article');
  el.className = 'card card--skeleton';
  el.innerHTML = `
    <p class="skeleton-line skeleton-line--sm"></p>
    <p class="skeleton-line skeleton-line--lg"></p>
  `;
  return el;
}
