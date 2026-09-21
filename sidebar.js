/* Sidebar bersama — bentuk visualnya mengikuti Sidebar.tsx di FE:
   latar putih, item datar, item aktif disorot biru muda dengan rel kiri.
   Kelas tampilannya ada di theme.css supaya sama dengan sidebar bawaan
   halaman-halaman yang belum memakai renderSidebar(). */
function renderSidebar(activePage) {
  const currentFilename = window.location.pathname.split('/').pop() || 'index.html';
  const currentFullUrl = currentFilename + window.location.search;

  const menuItems = [
    { id: 'dashboard', label: '1. Dashboard', icon: 'fas fa-chart-pie', href: 'index.html', subMenu: [] },
    {
      id: 'pelayanan-klaim',
      label: '2. Pelayanan Klaim',
      icon: 'fas fa-file-invoice-dollar',
      href: '#',
      subMenu: [
        { id: 'registrasi', label: 'Registrasi Klaim', href: 'registrasi.html' },
        { id: 'kejadian', label: 'Klaim Kejadian', href: 'kejadian.html' },
        { id: 'verifikasi', label: 'List Request Verifikasi', href: 'verifikasi.html' },
        { id: 'approval-produk', label: 'List Request Approval', href: 'approval-produk.html' },
        { id: 'riwayat', label: 'Riwayat Transaksi', href: 'riwayat.html' }
      ]
    },
    { id: 'data-peserta', label: '3. Data Peserta', icon: 'fas fa-magnifying-glass', href: 'data-peserta.html', subMenu: [] },
    { id: 'dapem-susulan', label: '4. Dapem Susulan Sementara', icon: 'fas fa-file-invoice-dollar', href: 'dapem-susulan.html', subMenu: [] },
    {
      id: 'perbandingan-dapem',
      label: '5. Perbandingan DAPEM',
      icon: 'fas fa-scale-balanced',
      href: '#',
      subMenu: [
        { label: 'Daftar AP3 Sementara', href: 'ap3-sementara.html' },
        { label: 'Daftar Pensiun', href: 'daftar-pensiun.html' }
      ]
    },
    {
      id: 'perawatan',
      label: '6. Perawatan JKK',
      icon: 'fas fa-hand-holding-medical',
      href: '#',
      subMenu: [
        {
          label: 'JAMINAN PERAWATAN',
          subMenu: [
            { label: 'Pengajuan Perawatan', href: 'perawatan-jaminan.html?sub=pengajuan' },
            { label: 'Riwayat Pengajuan', href: 'perawatan-jaminan.html?sub=riwayat' }
          ]
        },
        {
          label: 'KLAIM PERAWATAN',
          subMenu: [
            { label: 'Pengajuan Restitusi', href: 'perawatan-restitusi.html?sub=pengajuan' },
            { label: 'Riwayat Restitusi', href: 'perawatan-restitusi.html?sub=riwayat' }
          ]
        },
        {
          label: 'REIMBURSE PERAWATAN',
          subMenu: [
            { label: 'Pengajuan Reimburse', href: 'perawatan-reimburse.html?sub=pengajuan' },
            { label: 'Riwayat Reimburse', href: 'perawatan-reimburse.html?sub=riwayat' }
          ]
        }
      ]
    },
    {
      id: 'komunikasi',
      label: '7. Pelayanan Komunikasi Pelanggan',
      icon: 'fas fa-comments',
      href: '#',
      subMenu: [
        { label: 'Dashboard', href: 'komunikasi-dashboard.html' },
        { label: 'Riwayat Interaksi', href: 'komunikasi-riwayat.html' }
      ]
    },
    { id: 'request-umum', label: '8. Request Umum', icon: 'fas fa-envelope-open-text', href: 'request-umum.html', subMenu: [] },
    { id: 'sejarah-sp', label: '9. Sejarah SP', icon: 'fas fa-clock-rotate-left', href: 'sejarah-sp.html', subMenu: [] },
    { id: 'pembatalan-sp', label: '10. List Pembatalan SP', icon: 'fas fa-ban', href: 'pembatalan-sp.html', subMenu: [] },
    { id: 'rekap-waktu-layanan', label: '11. Rekap Waktu Layanan', icon: 'fas fa-chart-line', href: 'rekap-waktu-layanan.html', subMenu: [] },
    {
      id: 'monitoring-sp3r',
      label: '12. Monitoring SP3R',
      icon: 'fas fa-chart-pie',
      href: '#',
      subMenu: [
        { label: 'Monitoring SP3R', href: 'monitoring-sp3r.html' },
        { label: 'Data Nominatif Peserta', href: 'nominatif-peserta.html' }
      ]
    }
  ];

  const isSubActive = (sub) => {
    if (!sub || !sub.href || sub.href === '#') return false;
    if (sub.id && activePage === sub.id) return true;
    if (sub.href === currentFullUrl) return true;
    if (sub.href.split('?')[0] === currentFilename && !sub.href.includes('?') && !window.location.search) return true;
    if (sub.href.split('?')[0] === currentFilename && sub.href.includes('?') && window.location.search && sub.href.split('?')[1] === window.location.search.slice(1)) return true;
    return false;
  };

  const isGroupActive = (item) => {
    if (activePage === item.id) return true;
    if (item.subMenu && item.subMenu.length > 0) {
      return item.subMenu.some(sub => {
        if (sub.subMenu) {
          return sub.subMenu.some(nested => isSubActive(nested));
        }
        return isSubActive(sub);
      });
    }
    return false;
  };

  const subLink = (item) => {
    const active = isSubActive(item) ? ' active' : '';
    return `
            <a href="${item.href}" class="nav-sublink${active}">
              <span class="dot"></span>
              <span>${item.label}</span>
            </a>`;
  };

  const sidebarHTML = menuItems.map(item => {
    const isGroupOpen = isGroupActive(item);
    const isDirectActive = (activePage === item.id) || (!item.subMenu.length && item.href === currentFilename);

    if (item.subMenu.length === 0) {
      return `
          <a href="${item.href}" class="nav-link${isDirectActive ? ' active' : ''}">
            <span class="flex items-center gap-2.5 min-w-0">
              <i class="nav-ico ${item.icon}"></i>
              <span>${item.label}</span>
            </span>
          </a>`;
    }

    const chevron = isGroupOpen ? 'fa-chevron-down' : 'fa-chevron-right';
    const subItemsHTML = item.subMenu.map(sub => {
      if (sub.subMenu) {
        return `
            <span class="nav-subhead">${sub.label}</span>${sub.subMenu.map(subLink).join('')}`;
      }
      return subLink(sub);
    }).join('');

    return `
          <div class="space-y-0.5">
            <button type="button" onclick="toggleSidebarAccordion('submenu-${item.id}','chevron-${item.id}')" class="nav-link${isGroupOpen ? ' active' : ''}">
              <span class="flex items-center gap-2.5 min-w-0">
                <i class="nav-ico ${item.icon}"></i>
                <span>${item.label}</span>
              </span>
              <i id="chevron-${item.id}" class="nav-chev fas ${chevron}"></i>
            </button>
            <div id="submenu-${item.id}" class="nav-sub space-y-0.5${isGroupOpen ? '' : ' hidden'}">${subItemsHTML}
            </div>
          </div>`;
  }).join('');

  const isCollapsed = localStorage.getItem("asabri_sidebar_collapsed") === "true";
  const collapsedClass = isCollapsed ? " w-0 overflow-hidden" : "";

  const containerHTML = `
    <aside id="sidebar-nav" class="w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 transition-all duration-300 h-full overflow-hidden${collapsedClass}">
      <nav class="flex-1 p-3 space-y-0.5 overflow-y-auto min-h-0">
        <p class="nav-section px-2.5 pt-1 pb-2">Menu Layanan</p>${sidebarHTML}
      </nav>
      <div class="sidebar-foot flex-shrink-0">ASABRI YANDU NG v1.2.0</div>
    </aside>
  `;

  const sidebarContainer = document.getElementById('sidebar');
  if (sidebarContainer) {
    sidebarContainer.className = "h-full flex flex-col flex-shrink-0 overflow-hidden";
    sidebarContainer.innerHTML = containerHTML;
  }
}

// Buka/tutup grup menu; hanya kelas arah chevron yang ditukar supaya
// halaman yang memakai sidebar bawaannya sendiri tetap ikut gaya yang sama.
function toggleSidebarAccordion(menuId, chevId) {
  const menu = document.getElementById(menuId);
  if (!menu) return;
  const opening = menu.classList.contains('hidden');
  menu.classList.toggle('hidden', !opening);
  const chev = document.getElementById(chevId);
  if (chev) {
    chev.classList.toggle('fa-chevron-down', opening);
    chev.classList.toggle('fa-chevron-right', !opening);
  }
}

