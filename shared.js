// Global Shared Logic for ASABRI YANDU NG Multi-Page App

// Database Methods
const DATA_VERSION = "2.0"; // Increment this whenever MOCK_CLAIMS structure changes


function getCurrentUser() {
  return {
    username: "staf_kancab",
    kantorCabang: "KANCAB AMBON",
    kodeKancab: "0123"
  };
}

function getNextNomorUrut(kodeKancab, tahun) {
  const key = `seq_${kodeKancab}_${tahun}`;
  let currentSeq = parseInt(localStorage.getItem(key) || "0");
  currentSeq += 1;
  localStorage.setItem(key, currentSeq.toString());
  return currentSeq;
}

function generateNomorRegistrasi(kodeKancab) {
  const now = new Date();

  // Bulan dalam format Romawi
  const bulanRomawi = [
    'I','II','III','IV','V','VI',
    'VII','VIII','IX','X','XI','XII'
  ];
  const bulan = bulanRomawi[now.getMonth()];
  const tahun = now.getFullYear();

  // Nomor urut 6 digit, reset tiap tahun per kode cabang
  const nomorUrut = getNextNomorUrut(kodeKancab, tahun)
    .toString().padStart(6, '0');

  // Format BARU: REG/[No Urut]/[Kode Cabang]/[Bulan Romawi]/[Tahun]
  return `REG/${nomorUrut}/${kodeKancab}/${bulan}/${tahun}`;
}

function getClaims() {
  const data = localStorage.getItem("asabri_claims");
  const storedVersion = localStorage.getItem("asabri_data_version");
  
  // Re-seed if empty, stale, or data version mismatch
  if (!data || storedVersion !== DATA_VERSION) {
    const seed = typeof MOCK_CLAIMS !== "undefined" ? MOCK_CLAIMS : [];
    const enriched = enrichClaimsWithParticipant(seed);
    saveClaims(enriched);
    localStorage.setItem("asabri_data_version", DATA_VERSION);
    return enriched;
  }
  const parsed = JSON.parse(data);
  // Enrich on every read to ensure participant data is always present
  return enrichClaimsWithParticipant(parsed);
}

/**
 * Enriches each claim with a `participant` object from MOCK_PESERTA
 * using the `nik` field as the lookup key.
 * If the claim already has a `participant` block, it is kept as-is.
 */
function enrichClaimsWithParticipant(claims) {
  if (typeof MOCK_PESERTA === "undefined") return claims;
  return claims.map(c => {
    if (c.participant) return c; // already enriched
    const peserta = MOCK_PESERTA.find(p => p.nik === c.nik || p.nrp_nip === c.nik);
    if (peserta) {
      return { ...c, participant: JSON.parse(JSON.stringify(peserta)) };
    }
    // No match — create a minimal stub so UI doesn't break
    return {
      ...c,
      participant: {
        nama: c.namaPeserta || c.nama || "-",
        nik: c.nik || "-",
        nrp_nip: c.nik || "-",
        pangkat: "-",
        unitKerja: c.kantorCabang || "-",
        kesatuan: c.kantorCabang || "-",
        gaji_pokok_terakhir: 4000000,
        statusKepesertaan: "Aktif",
        status_kepesertaan: "Aktif"
      }
    };
  });
}

function saveClaims(claims) {
  if (Array.isArray(claims)) {
    claims.forEach(c => {
      if (c.status === "Selesai" && !c.tanggalSelesai) {
        c.tanggalSelesai = new Date().toLocaleDateString('id-ID');
      } else if (c.status !== "Selesai" && c.status !== "Pembayaran Selesai") {
        c.tanggalSelesai = "";
      }
    });
  }
  localStorage.setItem("asabri_claims", JSON.stringify(claims));
}

function addClaim(newClaim) {
  const claims = getClaims();
  claims.unshift(newClaim); // Add to the beginning of list
  saveClaims(claims);
}

function updateClaimStatus(noReg, status, catatan) {
  const claims = getClaims();
  const index = claims.findIndex(c => (c.noRegistrasi === noReg || c.noReg === noReg));
  if (index !== -1) {
    const oldStatus = claims[index].status;
    claims[index].status = status;
    claims[index].catatan = catatan;
    
    if (status === "Selesai") {
      claims[index].tanggalSelesai = new Date().toLocaleDateString('id-ID');
    } else {
      claims[index].tanggalSelesai = "";
    }
    
    // Ensure audit trail exists
    if (!claims[index].auditTrail) {
      claims[index].auditTrail = [];
    }
    
    // Add audit trail log entry
    const now = new Date();
    const formattedDate = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) + " " + 
                          now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
    
    claims[index].auditTrail.push({
      tanggal: formattedDate,
      user: "SK | Staf Kancab Utama",
      aksi: "Ubah Status",
      keterangan: `Status diubah dari ${oldStatus} ke ${status} oleh Staff KANCAB. Catatan: ${catatan}`
    });
    
    saveClaims(claims);
    
    // Dispatch custom storage event for multi-tab sync
    window.dispatchEvent(new Event("storage"));
    return true;
  }
  return false;
}

// Common UI Interactions
document.addEventListener("DOMContentLoaded", () => {
  // Initialize Database if needed
  getClaims();

  // Sidebar Collapse Persistence Toggle
  const sidebarToggle = document.getElementById("sidebar-toggle");
  const sidebar = document.getElementById("sidebar-nav");

  // Load previous collapsed state
  const isCollapsed = localStorage.getItem("asabri_sidebar_collapsed") === "true";
  if (isCollapsed && sidebar) {
    sidebar.classList.add("w-0", "overflow-hidden");
  }

  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener("click", () => {
      sidebar.classList.toggle("w-0");
      sidebar.classList.toggle("overflow-hidden");
      const currentCollapsed = sidebar.classList.contains("w-0");
      localStorage.setItem("asabri_sidebar_collapsed", currentCollapsed ? "true" : "false");
    });
  }

  // Initialize Sidebar Accordion states from localStorage
  initializeSidebarAccordionState();

  // Initialize unified role selector across all pages
  initializeSharedRoleSelector();

  // Initialize and render role-based notification bell
  renderHeaderNotificationBell();
  
  // Listen for local changes to keep notifications synchronized across tabs
  window.addEventListener("storage", () => {
    renderHeaderNotificationBell();
  });

  // Global click listener to close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    const bell = document.getElementById("header-notification-bell");
    if (bell) {
      const dropdown = bell.querySelector("#header-notif-dropdown-menu");
      if (dropdown && !bell.contains(e.target)) {
        dropdown.classList.add("opacity-0", "pointer-events-none", "scale-95");
        dropdown.classList.remove("opacity-100", "pointer-events-auto", "scale-100");
      }
    }
  });
});

// =============================================================================
// SISTEM NOTIFIKASI LONCENG PER ROLE (7 TRIGGER EVENTS)
// =============================================================================
const NOTIFIKASI_TRIGGER = [
  { 
    event: 'Ajukan ke Verifikator', 
    targetRole: 'Verifikator', 
    pesan: 'Ada klaim baru [noAgenda] untuk diverifikasi',
    defaultLink: 'verifikasi.html',
    icon: 'fa-file-signature',
    badgeClass: 'bg-blue-100 text-asabri-blue border-blue-200'
  },
  { 
    event: 'Verifikator Revisi', 
    targetRole: 'Staf KANCAB', 
    pesan: 'Klaim [noAgenda] perlu direvisi — [catatan]',
    defaultLink: 'riwayat.html',
    icon: 'fa-rotate-left',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300'
  },
  { 
    event: 'Verifikator Tolak', 
    targetRole: 'Staf KANCAB', 
    pesan: 'Klaim [noAgenda] ditolak — [alasan]',
    defaultLink: 'riwayat.html',
    icon: 'fa-circle-xmark',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300'
  },
  { 
    event: 'Semua Produk Terverifikasi', 
    targetRole: 'KAKANCAB', 
    pesan: 'Ada klaim baru [noAgenda] untuk di-approve',
    defaultLink: 'approval-produk.html',
    icon: 'fa-check-double',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300'
  },
  { 
    event: 'Staf Ajukan Ulang Setelah Revisi', 
    targetRole: 'Verifikator', 
    pesan: 'Klaim [noAgenda] sudah direvisi, mohon diverifikasi ulang',
    defaultLink: 'verifikasi.html',
    icon: 'fa-file-circle-check',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300'
  },
  { 
    event: 'KAKANCAB Approve (SP Terbit)', 
    targetRole: 'Staf KANCAB', 
    pesan: 'SP untuk klaim [noAgenda] sudah terbit',
    defaultLink: 'riwayat.html',
    icon: 'fa-file-invoice-dollar',
    badgeClass: 'bg-teal-100 text-teal-800 border-teal-300'
  },
  { 
    event: 'KAKANCAB Cancel/Reject (Pembatalan)', 
    targetRole: ['Verifikator', 'Staf KANCAB'], 
    pesan: 'Klaim [noAgenda] dibatalkan — [alasan]',
    defaultLink: 'pembatalan-sp.html',
    icon: 'fa-ban',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300'
  }
];

function normalizeRoleName(role) {
  if (!role) return 'Staf KANCAB';
  const r = String(role).trim().toLowerCase();
  if (r.includes('medis')) return 'Verifikator Medis';
  if (r.includes('staf') || (r.includes('kancab') && !r.includes('kakancab'))) return 'Staf KANCAB';
  if (r.includes('verif')) return 'Verifikator';
  if (r.includes('kakancab')) return 'KAKANCAB';
  if (r.includes('program1') || r.includes('program 1')) return 'Bidang Layanan Program 1';
  if (r.includes('kabid') || r.includes('kadiv')) return 'Kabid/Kadiv Layanan';
  return role;
}

function getNotifStorageKey(role) {
  const norm = normalizeRoleName(role);
  return 'notifikasi_' + norm.replace(/[^a-zA-Z0-9]/g, '_');
}

function getCurrentActiveRole() {
  const roleVal = localStorage.getItem("currentRole") || localStorage.getItem("YANDU_ROLE") || "Staf KANCAB";
  return normalizeRoleName(roleVal);
}

function getNotificationsForRole(role) {
  const key = getNotifStorageKey(role);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return getInitialSeedNotifications(normalizeRoleName(role));
    }
    return JSON.parse(raw);
  } catch(e) {
    return [];
  }
}

function getInitialSeedNotifications(role) {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const waktu = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const bulanArr = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const tgl = `${now.getDate()} ${bulanArr[now.getMonth()]} ${now.getFullYear()}`;

  let seeds = [];
  if (role === 'Verifikator') {
    seeds = [
      {
        id: `notif_seed_vr_1`,
        event: 'Ajukan ke Verifikator',
        pesan: 'Ada klaim baru REG/000082/0123/IX/2025 (Pensiun - TA + PP) untuk diverifikasi.',
        link: 'verifikasi.html',
        noAgenda: 'REG/000082/0123/IX/2025',
        waktu: waktu,
        tanggal: tgl,
        timestamp: Date.now() - 3600000,
        isRead: false
      }
    ];
  } else if (role === 'KAKANCAB') {
    seeds = [
      {
        id: `notif_seed_kc_1`,
        event: 'Semua Produk Terverifikasi',
        pesan: 'Ada klaim baru REG/000082/0123/IX/2025 untuk di-approve oleh Kakancab.',
        link: 'approval-produk.html',
        noAgenda: 'REG/000082/0123/IX/2025',
        waktu: waktu,
        tanggal: tgl,
        timestamp: Date.now() - 7200000,
        isRead: false
      }
    ];
  } else if (role === 'Staf KANCAB') {
    seeds = [
      {
        id: `notif_seed_sk_1`,
        event: 'KAKANCAB Approve (SP Terbit)',
        pesan: 'SP untuk klaim REG/000081/0123/IX/2025 sudah terbit.',
        link: 'riwayat.html',
        noAgenda: 'REG/000081/0123/IX/2025',
        waktu: waktu,
        tanggal: tgl,
        timestamp: Date.now() - 10800000,
        isRead: true
      }
    ];
  }

  saveNotificationsForRole(role, seeds);
  return seeds;
}

function saveNotificationsForRole(role, list) {
  const key = getNotifStorageKey(role);
  localStorage.setItem(key, JSON.stringify(list));
}

function sendNotificationRole(targetRoles, eventName, noAgenda, customPesan, customLink) {
  const targets = Array.isArray(targetRoles) ? targetRoles : [targetRoles];
  const triggerDef = NOTIFIKASI_TRIGGER.find(t => t.event === eventName) || {};

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const waktu = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const bulanArr = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const tanggal = `${now.getDate()} ${bulanArr[now.getMonth()]} ${now.getFullYear()}`;

  targets.forEach(tgtRole => {
    const roleKey = normalizeRoleName(tgtRole);
    const existing = getNotificationsForRole(roleKey);

    let pesan = customPesan;
    if (!pesan) {
      pesan = (triggerDef.pesan || `Pemberitahuan baru: ${eventName}`)
        .replace('[noAgenda]', noAgenda || '')
        .replace('[catatan]', '')
        .replace('[alasan]', '')
        .trim();
    }

    let link = customLink || triggerDef.defaultLink || 'index.html';
    if (noAgenda && (link === 'riwayat.html' || link === 'pembatalan-sp.html')) {
      if (!link.includes('highlight=')) {
        link += `?highlight=${encodeURIComponent(noAgenda)}`;
      }
    }

    const notifItem = {
      id: `notif_${Date.now()}_${Math.floor(Math.random()*1000)}`,
      event: eventName,
      pesan: pesan,
      link: link,
      noAgenda: noAgenda || '',
      waktu: waktu,
      tanggal: tanggal,
      timestamp: Date.now(),
      isRead: false
    };

    existing.unshift(notifItem);
    const trimmed = existing.slice(0, 50); // Keep last 50
    saveNotificationsForRole(roleKey, trimmed);
  });

  renderHeaderNotificationBell();
  window.dispatchEvent(new Event("storage"));
}

function markAllNotificationsRead(role) {
  const roleKey = normalizeRoleName(role || getCurrentActiveRole());
  const list = getNotificationsForRole(roleKey);
  list.forEach(n => { n.isRead = true; });
  saveNotificationsForRole(roleKey, list);
  renderHeaderNotificationBell();
  window.dispatchEvent(new Event("storage"));
}

function markNotificationReadAndOpen(role, notifId, link) {
  const roleKey = normalizeRoleName(role || getCurrentActiveRole());
  const list = getNotificationsForRole(roleKey);
  const item = list.find(n => n.id === notifId);
  if (item) {
    item.isRead = true;
    saveNotificationsForRole(roleKey, list);
  }
  renderHeaderNotificationBell();
  if (link) {
    window.location.href = link;
  }
}

function renderHeaderNotificationBell() {
  const activeRole = getCurrentActiveRole();
  const notifs = getNotificationsForRole(activeRole);
  const unreadCount = notifs.filter(n => !n.isRead).length;

  let bell = document.getElementById("header-notification-bell");
  const headerControls = document.querySelector("header .flex.items-center.gap-4");
  
  if (!bell && headerControls) {
    bell = document.createElement("div");
    bell.id = "header-notification-bell";
    bell.className = "relative cursor-pointer";
    
    const divider = headerControls.querySelector(".h-8.w-px");
    if (divider) {
      headerControls.insertBefore(bell, divider);
    } else {
      headerControls.appendChild(bell);
    }
  }

  if (!bell) return;

  const badgeHtml = unreadCount > 0
    ? `<span id="header-notif-badge" class="absolute -top-1.5 -right-1.5 bg-rose-500 text-white font-black text-[9px] min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center border-2 border-asabri-blue shadow-sm animate-pulse">${unreadCount > 99 ? '99+' : unreadCount}</span>`
    : `<span id="header-notif-badge" class="hidden"></span>`;

  let itemsHtml = '';
  if (notifs.length === 0) {
    itemsHtml = `
      <div class="py-8 px-4 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
        <i class="far fa-bell-slash text-2xl text-slate-300"></i>
        <p class="text-xs font-semibold text-slate-600">Belum ada notifikasi untuk <b>${activeRole}</b></p>
        <span class="text-[10px] text-slate-400">Notifikasi perubahan status klaim akan muncul di sini secara otomatis.</span>
      </div>
    `;
  } else {
    itemsHtml = notifs.slice(0, 20).map(n => {
      const isUnread = !n.isRead;
      const trig = NOTIFIKASI_TRIGGER.find(t => t.event === n.event) || {};
      const icon = trig.icon || 'fa-bell';
      const badgeCls = trig.badgeClass || 'bg-blue-100 text-asabri-blue border-blue-200';

      return `
        <div onclick="markNotificationReadAndOpen('${activeRole}', '${n.id}', '${n.link}')" class="p-3 border-b border-slate-100 hover:bg-blue-50/60 transition-colors cursor-pointer flex items-start gap-3 ${isUnread ? 'bg-amber-50/50' : 'bg-white'}">
          <div class="w-7 h-7 rounded-xl flex items-center justify-center text-xs shrink-0 border ${badgeCls}">
            <i class="fas ${icon}"></i>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-1 mb-0.5">
              <span class="text-[10px] font-extrabold text-slate-700 truncate">${n.event}</span>
              <span class="text-[9px] text-slate-400 shrink-0 font-mono">${n.waktu}</span>
            </div>
            <p class="text-xs ${isUnread ? 'font-bold text-slate-900' : 'font-normal text-slate-600'} line-clamp-2 leading-snug">${n.pesan}</p>
            <div class="flex items-center justify-between mt-1.5">
              <span class="text-[9px] text-slate-400">${n.tanggal}</span>
              <span class="text-[10px] text-asabri-blue font-bold inline-flex items-center gap-0.5 hover:underline">Buka Link <i class="fas fa-arrow-right text-[8px] ml-0.5"></i></span>
            </div>
          </div>
          ${isUnread ? '<span class="w-2 h-2 rounded-full bg-asabri-blue shrink-0 mt-1" title="Belum dibaca"></span>' : ''}
        </div>
      `;
    }).join('');
  }

  bell.innerHTML = `
    <button type="button" id="btn-bell-icon" class="p-2 rounded-xl text-white hover:bg-white/10 transition-colors relative flex items-center justify-center focus:outline-none" title="Notifikasi ${activeRole}">
      <i class="fas fa-bell text-base"></i>
      ${badgeHtml}
    </button>
    
    <div id="header-notif-dropdown-menu" class="absolute right-0 top-11 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 transform transition-all duration-150 opacity-0 pointer-events-none scale-95 origin-top-right">
      <div class="px-4 py-3 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
        <div class="flex items-center gap-2">
          <i class="fas fa-bell text-amber-400 text-xs"></i>
          <span class="text-xs font-bold tracking-wide">Notifikasi — ${activeRole}</span>
          ${unreadCount > 0 ? `<span class="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">${unreadCount}</span>` : ''}
        </div>
        ${unreadCount > 0 ? `<button onclick="event.stopPropagation(); markAllNotificationsRead('${activeRole}')" class="text-[10px] text-blue-300 hover:text-white font-semibold transition-colors">Tandai Semua Dibaca</button>` : ''}
      </div>
      <div class="max-h-[360px] overflow-y-auto divide-y divide-slate-100">
        ${itemsHtml}
      </div>
      <div class="px-4 py-2 bg-slate-50 border-t border-slate-200 text-center">
        <span class="text-[10px] text-slate-500 font-medium">Role Aktif: <b>${activeRole}</b> • ${notifs.length} total</span>
      </div>
    </div>
  `;

  const btnBell = bell.querySelector("#btn-bell-icon");
  const dropdown = bell.querySelector("#header-notif-dropdown-menu");
  if (btnBell && dropdown) {
    btnBell.onclick = (e) => {
      e.stopPropagation();
      const isHidden = dropdown.classList.contains("opacity-0");
      if (isHidden) {
        dropdown.classList.remove("opacity-0", "pointer-events-none", "scale-95");
        dropdown.classList.add("opacity-100", "pointer-events-auto", "scale-100");
      } else {
        dropdown.classList.add("opacity-0", "pointer-events-none", "scale-95");
        dropdown.classList.remove("opacity-100", "pointer-events-auto", "scale-100");
      }
    };
  }
}

function initializeSharedRoleSelector() {
  const headerContainer = document.querySelector("header .flex.items-center.gap-4");
  if (!headerContainer) return;

  const roles = [
    { value: 'staf-kancab', label: 'ROLE: Staf KANCAB' },
    { value: 'program1', label: 'ROLE: Bidang Layanan Program 1' },
    { value: 'verifikator', label: 'ROLE: Verifikator' },
    { value: 'verifikator-medis', label: 'ROLE: Verifikator Medis (khusus JKK Perawatan)' },
    { value: 'kakancab', label: 'ROLE: KAKANCAB / Kabid Layanan' },
    { value: 'kabid-kadiv', label: 'ROLE: Kabid / Kadiv Layanan (khusus Restitusi)' },
  ];

  const roleLegacyMap = {
    'staf-kancab': 'Staf KANCAB',
    'program1': 'Bidang Layanan Program 1',
    'verifikator': 'Verifikator',
    'verifikator-medis': 'Verifikator Medis',
    'kakancab': 'KAKANCAB',
    'kabid-kadiv': 'Kabid/Kadiv Layanan'
  };

  const legacyToNewMap = {
    'Staf KANCAB': 'staf-kancab',
    'staf-kancab': 'staf-kancab',
    'Bidang Layanan Program 1': 'program1',
    'program1': 'program1',
    'Verifikator': 'verifikator',
    'verifikator': 'verifikator',
    'Verifikator Medis': 'verifikator-medis',
    'verifikator-medis': 'verifikator-medis',
    'KAKANCAB': 'kakancab',
    'kakancab': 'kakancab',
    'Kabid/Kadiv Layanan': 'kabid-kadiv',
    'Kabid / Kadiv': 'kabid-kadiv',
    'kabid-kadiv': 'kabid-kadiv'
  };

  // Get current saved role
  let savedRoleRaw = localStorage.getItem("YANDU_ROLE") || localStorage.getItem("currentRole") || 'staf-kancab';
  let savedRole = legacyToNewMap[savedRoleRaw] || 'staf-kancab';

  // Apply to YANDU_ROLE and legacy currentRole
  window.YANDU_ROLE = savedRole;
  localStorage.setItem("YANDU_ROLE", savedRole);
  localStorage.setItem("currentRole", roleLegacyMap[savedRole]);

  // Create the shared select element wrapper
  const selectWrapper = document.createElement("div");
  selectWrapper.className = "relative inline-block text-left";
  
  const selectEl = document.createElement("select");
  
  // Determine correct ID to match expectations of local scripts
  const firstChild = headerContainer.firstElementChild;
  const originalSelect = firstChild ? (firstChild.querySelector("select") || (firstChild.tagName === "SELECT" ? firstChild : null)) : null;
  let targetId = "role-switcher";
  if (originalSelect && originalSelect.id) {
    targetId = originalSelect.id;
  } else if (document.getElementById("role-select")) {
    targetId = "role-select";
  } else if (document.getElementById("role-switcher")) {
    targetId = "role-switcher";
  }
  
  selectEl.id = targetId;
  selectEl.className = "bg-white/10 border border-white/15 text-xs font-semibold text-white tracking-wide px-3 py-1 rounded-full cursor-pointer focus:outline-none focus:ring-1 focus:ring-white/30 hover:bg-white/15 transition-all";
  
  roles.forEach(opt => {
    const optEl = document.createElement("option");
    optEl.value = opt.value;
    optEl.className = "text-slate-800 font-semibold";
    optEl.innerText = opt.label;
    if (opt.value === savedRole) {
      optEl.selected = true;
    }
    selectEl.appendChild(optEl);
  });

  selectWrapper.appendChild(selectEl);

  // Replace the first child of headerContainer (the old badge or selector)
  if (firstChild) {
    headerContainer.replaceChild(selectWrapper, firstChild);
  }

  // Trigger role update helper
  function updateRoleState(newVal) {
    const activeVal = legacyToNewMap[newVal] || newVal;
    window.YANDU_ROLE = activeVal;
    localStorage.setItem("YANDU_ROLE", activeVal);
    
    const legacyVal = roleLegacyMap[activeVal];
    localStorage.setItem("currentRole", legacyVal);
    
    // Call page-specific callback if exists
    if (typeof changeRole === "function") {
      changeRole(legacyVal);
    }

    // Immediately re-render notification bell for the new active role!
    renderHeaderNotificationBell();
  }

  // Change listener
  selectEl.addEventListener("change", (e) => {
    updateRoleState(e.target.value);
    window.dispatchEvent(new Event("storage"));
  });

  // Listen for storage changes from other tabs/pages
  window.addEventListener("storage", () => {
    const freshRoleRaw = localStorage.getItem("YANDU_ROLE") || localStorage.getItem("currentRole");
    const freshRole = legacyToNewMap[freshRoleRaw] || freshRoleRaw;
    if (freshRole && selectEl.value !== freshRole && roles.some(opt => opt.value === freshRole)) {
      selectEl.value = freshRole;
      updateRoleState(freshRole);
    }
  });

  // Call initial load callback
  if (typeof changeRole === "function") {
    changeRole(roleLegacyMap[savedRole]);
  }
}const getSLAFlag = (menitBerjalan) => {
  if (menitBerjalan >= 60) return '🔴 KRITIS';
  if (menitBerjalan >= 40) return '🟡 MEDIUM';
  return '🟢 AMAN';
}

// Calculate and update header SLA notifications dynamically
function updateHeaderNotifications() {
  const claims = getClaims();
  
  // Filter claims that are not yet finished (exclude completed states)
  const activeClaims = claims.filter(c => 
    !["Selesai", "SP Terbit", "SJP/SJPP Terbit", "SP Restitusi Terbit"].includes(c.status)
  ).map(c => {
    let minutes = 15; // default
    if (c.slaStartTime) {
      minutes = Math.floor((Date.now() - c.slaStartTime) / 60000);
    } else if (c.sla && c.sla.waktu) {
      const parsed = parseInt(c.sla.waktu);
      if (!isNaN(parsed)) {
        minutes = parsed;
      }
    }
    const flag = getSLAFlag(minutes);
    return { ...c, minutes, flag };
  });

  // Sort: Kritis (minutes >= 60) -> Medium (>= 40) -> Aman (< 40)
  activeClaims.sort((a, b) => b.minutes - a.minutes);

  const displayClaims = activeClaims.slice(0, 10);
  const warningCount = activeClaims.filter(c => c.minutes >= 40).length;
  
  const badge = document.getElementById("header-notif-badge");
  const countSpan = document.getElementById("header-notif-count");
  const detailList = document.getElementById("header-notif-details");
  
  if (badge) {
    if (warningCount > 0) {
      badge.innerText = warningCount;
      badge.style.display = "flex";
    } else {
      badge.style.display = "none";
    }
  }
  
  if (countSpan) {
    countSpan.innerText = `${activeClaims.length} Antrian`;
  }
  
  if (detailList) {
    if (displayClaims.length > 0) {
      detailList.innerHTML = displayClaims.map(c => {
        let style = "background-color: rgba(255, 255, 255, 0.05); color: #f1f5f9; border: 1px solid rgba(255, 255, 255, 0.1);";
        if (c.flag.includes("KRITIS")) {
          style = "background-color: #fee2e2; color: #991b1b; border: 1px solid #fca5a5;";
        } else if (c.flag.includes("MEDIUM")) {
          style = "background-color: #fef9c3; color: #854d0e; border: 1px solid #fde047;";
        }
        
        const nama = c.participant?.nama || c.peserta?.nama || c.namaPeserta || c.nama || "-";
        const manfaat = c.manfaatKlaim || c.jenisKlaim || c.jenisKejadian || "-";
        const noReg = c.noRegistrasi || c.noReg || c.registrationNo || c.noAgenda || "-";
        const statusAktif = c.status || "Registrasi";

        return `
          <div onclick="window.location.href='riwayat.html?highlight=${noReg}'" class="flex flex-col p-2 rounded-xl mb-1 text-[10px] shadow-sm font-semibold transition-all cursor-pointer hover:opacity-90" style="${style}">
            <div class="flex justify-between font-bold">
              <span>${c.flag}</span>
              <span class="font-mono">| ${noReg}</span>
            </div>
            <div class="text-[9px] opacity-90 flex flex-col mt-0.5 pl-[72px] line-clamp-1">
              <span>| ${manfaat} — ${nama}</span>
              <span class="font-bold">| ${statusAktif}</span>
            </div>
          </div>
        `;
      }).join("");
    } else {
      detailList.innerHTML = `<div class="text-[9px] text-white/40 py-2 text-center">Tidak ada antrian aktif</div>`;
    }
  }
}

// Toast Helper
function showToast(title, message, type = "success") {
  // Check if toast element exists, if not create dynamically
  let toastEl = document.getElementById("toast");
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.id = "toast";
    toastEl.className = "fixed bottom-6 right-6 bg-white rounded-xl shadow-xl px-5 py-4 flex items-center gap-4 z-50 transform translate-y-24 opacity-0 transition-all duration-300";
    toastEl.innerHTML = `
      <div id="toast-icon-bg" class="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0">
        <i id="toast-icon" class="fas"></i>
      </div>
      <div class="text-xs">
        <h5 class="font-bold text-slate-800" id="toast-title">Notifikasi</h5>
        <p class="text-slate-500 mt-0.5" id="toast-message">Pesan sukses.</p>
      </div>
      <div class="h-6 w-px bg-slate-200"></div>
      <button onclick="hideToast()" class="text-slate-400 hover:text-slate-600"><i class="fas fa-xmark"></i></button>
    `;
    document.body.appendChild(toastEl);
  }
  
  // Set content
  document.getElementById("toast-title").innerText = title;
  document.getElementById("toast-message").innerText = message;

  // Clear previous border classes
  const borderClasses = ["border-l-4", "border-emerald-500", "border-amber-500", "border-rose-500"];
  toastEl.classList.remove(...borderClasses);
  
  const iconBg = document.getElementById("toast-icon-bg");
  const icon = document.getElementById("toast-icon");
  
  // Clear previous icon background classes
  const iconBgClasses = ["bg-emerald-50", "text-emerald-600", "bg-amber-50", "text-amber-600", "bg-rose-50", "text-rose-600"];
  iconBg.classList.remove(...iconBgClasses);
  
  // Clear previous icon classes
  const iconClasses = ["fa-check", "fa-hourglass-half", "fa-circle-xmark", "fa-triangle-exclamation"];
  icon.classList.remove(...iconClasses);

  // Apply new classes based on type
  if (type === "danger" || type === "error" || type === "ditolak") {
    toastEl.classList.add("border-l-4", "border-rose-500");
    iconBg.classList.add("bg-rose-50", "text-rose-600");
    icon.classList.add("fa-circle-xmark");
  } else if (type === "warning" || type === "pending") {
    toastEl.classList.add("border-l-4", "border-amber-500");
    iconBg.classList.add("bg-amber-50", "text-amber-600");
    icon.classList.add("fa-triangle-exclamation");
  } else { // success
    toastEl.classList.add("border-l-4", "border-emerald-500");
    iconBg.classList.add("bg-emerald-50", "text-emerald-600");
    icon.classList.add("fa-check");
  }
  
  toastEl.classList.remove("translate-y-24", "opacity-0");

  if (window.toastTimer) {
    clearTimeout(window.toastTimer);
  }
  window.toastTimer = setTimeout(() => {
    hideToast();
  }, 5000);
}

function hideToast() {
  const toastEl = document.getElementById("toast");
  if (toastEl) {
    toastEl.classList.add("translate-y-24");
    toastEl.classList.add("opacity-0");
  }
}

// Initialize Accordion States from localStorage
function initializeSidebarAccordionState() {
  let states = localStorage.getItem("asabri_sidebar_menus_state");
  if (!states) {
    // Default initial state: Only Menu 1 (registrasi) is open, others collapsed
    states = JSON.stringify({
      registrasi: true,
      pensiun: false,
      klaim: false,
      komunikasi: false
    });
    localStorage.setItem("asabri_sidebar_menus_state", states);
  }
  
  const menuStates = JSON.parse(states);
  
  const mapping = [
    { key: 'registrasi', id: 'submenu-registrasi', chevron: 'chevron-registrasi' },
    { key: 'pensiun', id: 'submenu-pensiun', chevron: 'chevron-pensiun' },
    { key: 'klaim', id: 'submenu-klaim', chevron: 'chevron-klaim' },
    { key: 'komunikasi', id: 'submenu-komunikasi', chevron: 'chevron-komunikasi' }
  ];
  
  mapping.forEach(menu => {
    const el = document.getElementById(menu.id);
    const chev = document.getElementById(menu.chevron);
    if (el) {
      const isOpen = menuStates[menu.key] !== undefined ? menuStates[menu.key] : (menu.key === 'registrasi');
      if (isOpen) {
        el.classList.remove("hidden");
        if (chev) {
          chev.classList.remove("fa-chevron-right");
          chev.classList.add("fa-chevron-down");
        }
      } else {
        el.classList.add("hidden");
        if (chev) {
          chev.classList.remove("fa-chevron-down");
          chev.classList.add("fa-chevron-right");
        }
      }
    }
  });
}

// Toggle and Save Accordion State
function toggleSidebarAccordion(submenuId, chevronId) {
  const submenuEl = document.getElementById(submenuId);
  const chevronEl = document.getElementById(chevronId);
  if (!submenuEl) return;
  
  const isHidden = submenuEl.classList.contains("hidden");
  
  // Toggle visibility
  if (isHidden) {
    submenuEl.classList.remove("hidden");
    if (chevronEl) {
      chevronEl.classList.remove("fa-chevron-right");
      chevronEl.classList.add("fa-chevron-down");
    }
  } else {
    submenuEl.classList.add("hidden");
    if (chevronEl) {
      chevronEl.classList.remove("fa-chevron-down");
      chevronEl.classList.add("fa-chevron-right");
    }
  }
  
  // Save current states of all menus
  const mapping = [
    { key: 'registrasi', id: 'submenu-registrasi' },
    { key: 'pensiun', id: 'submenu-pensiun' },
    { key: 'klaim', id: 'submenu-klaim' },
    { key: 'komunikasi', id: 'submenu-komunikasi' }
  ];
  
  const states = {};
  mapping.forEach(menu => {
    const el = document.getElementById(menu.id);
    if (el) {
      states[menu.key] = !el.classList.contains("hidden");
    } else {
      // Keep whatever was in localStorage if element is not on this page
      const currentStates = JSON.parse(localStorage.getItem("asabri_sidebar_menus_state") || "{}");
      states[menu.key] = currentStates[menu.key] !== undefined ? currentStates[menu.key] : (menu.key === 'registrasi');
    }
  });
  
  localStorage.setItem("asabri_sidebar_menus_state", JSON.stringify(states));
}

// ============================================================
// UTILITY: Format Rupiah
// ============================================================
function formatRupiah(val) {
  if (!val && val !== 0) return "Rp —";
  return "Rp " + Math.round(val).toLocaleString("id-ID");
}

// ============================================================
// SECTION 3: Render Checklist Dokumen Dinamis
// ============================================================
function renderSection3(manfaat, containerId) {
  const container = document.getElementById(containerId || "section-3-checklist-container");
  if (!container) return;

  const config = typeof DOC_CONFIG !== "undefined" ? DOC_CONFIG[manfaat] : null;

  if (!config) {
    container.innerHTML = `
      <div class="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
        <i class="fas fa-triangle-exclamation mr-1"></i>
        Tidak ada konfigurasi dokumen untuk manfaat <strong>${manfaat}</strong>. Hubungi Div. Aktuaria untuk konfirmasi persyaratan.
      </div>`;
    return;
  }

  const wajibDocs = config.docs.filter(d => d.type === "W");
  const kondisionalDocs = config.docs.filter(d => d.type === "K");

  let html = `
    <div class="flex items-center justify-between mb-3">
      <div>
        <h4 class="text-xs font-bold text-asabri-blue">${config.label}</h4>
        ${config.note ? `<p class="text-[10px] text-slate-400 mt-0.5 italic"><i class="fas fa-circle-info mr-1"></i>${config.note}</p>` : ''}
      </div>
      <span id="checklist-progress" class="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200 whitespace-nowrap">Progress: 0 / ${wajibDocs.length} Wajib</span>
    </div>`;

  if (wajibDocs.length > 0) {
    html += `<div class="mb-1"><span class="text-[9px] font-bold text-rose-600 uppercase tracking-wider"><i class="fas fa-asterisk mr-1"></i>Dokumen Wajib (${wajibDocs.length} berkas)</span></div>`;
    html += `<div class="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden mb-4">`;
    wajibDocs.forEach((doc, i) => {
      html += `
        <div class="py-3 px-4 flex items-center justify-between gap-3 bg-white hover:bg-rose-50/20 transition-colors" data-doc-type="W">
          <label class="flex items-start gap-3 cursor-pointer flex-1 min-w-0">
            <input type="checkbox" class="doc-chk w-4 h-4 text-asabri-blue rounded border-slate-300 mt-0.5 flex-shrink-0 focus:ring-asabri-blue" onchange="updateChecklistProgress()" data-required="true">
            <div class="min-w-0">
              <span class="text-xs font-semibold text-slate-700 block">${i+1}. ${doc.label}</span>
              <span class="inline-block mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200">W — Wajib</span>
            </div>
          </label>
          <div class="flex items-center gap-2 flex-shrink-0">
            <span class="file-name text-[10px] text-emerald-600 hidden italic"><i class="fas fa-check mr-1"></i></span>
            <input type="file" id="file-doc-w-${i+1}" class="hidden" accept=".pdf,.jpg,.jpeg,.png" onchange="handleDocFileUpload(this, 'w', ${i+1})">
            <button id="btn-view-doc-w-${i+1}" onclick="previewRequiredFile('w', ${i+1})" type="button" class="hidden px-2 py-1 border border-asabri-blue text-asabri-blue rounded-lg hover:bg-asabri-blue/5 text-[9px] font-bold transition-colors flex items-center gap-1"><i class="fas fa-eye text-[8px]"></i> Detail</button>
            <button onclick="document.getElementById('file-doc-w-${i+1}').click()" class="px-2.5 py-1.5 border border-slate-200 rounded-lg hover:bg-asabri-blue hover:text-white hover:border-asabri-blue text-[10px] font-bold text-slate-600 transition-all flex items-center gap-1">
              <i class="fas fa-cloud-arrow-up text-[9px]"></i> Upload
            </button>
          </div>
        </div>`;
    });
    html += `</div>`;
  }

  if (kondisionalDocs.length > 0) {
    html += `<div class="mb-1"><span class="text-[9px] font-bold text-amber-600 uppercase tracking-wider"><i class="fas fa-code-branch mr-1"></i>Dokumen Kondisional (${kondisionalDocs.length} berkas — sesuai kondisi)</span></div>`;
    html += `<div class="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">`;
    kondisionalDocs.forEach((doc, i) => {
      html += `
        <div class="py-3 px-4 flex items-center justify-between gap-3 bg-amber-50/20 hover:bg-amber-50/40 transition-colors">
          <label class="flex items-start gap-3 cursor-pointer flex-1 min-w-0">
            <input type="checkbox" class="doc-chk-k w-4 h-4 text-amber-500 rounded border-amber-300 mt-0.5 flex-shrink-0 focus:ring-amber-400">
            <div class="min-w-0">
              <span class="text-xs font-medium text-slate-600 block">${i+1}. ${doc.label}</span>
              <span class="inline-block mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">K — Kondisional</span>
            </div>
          </label>
          <div class="flex items-center gap-2 flex-shrink-0">
            <input type="file" id="file-doc-k-${i+1}" class="hidden" accept=".pdf,.jpg,.jpeg,.png" onchange="handleDocFileUpload(this, 'k', ${i+1})">
            <button id="btn-view-doc-k-${i+1}" onclick="previewRequiredFile('k', ${i+1})" type="button" class="hidden px-2 py-1 border border-asabri-blue text-asabri-blue rounded-lg hover:bg-asabri-blue/5 text-[9px] font-bold transition-colors flex items-center gap-1"><i class="fas fa-eye text-[8px]"></i> Detail</button>
            <button onclick="document.getElementById('file-doc-k-${i+1}').click()" class="px-2.5 py-1.5 border border-slate-200 rounded-lg hover:bg-amber-500 hover:text-white hover:border-amber-500 text-[10px] font-bold text-slate-500 transition-all flex items-center gap-1">
              <i class="fas fa-cloud-arrow-up text-[9px]"></i> Upload
            </button>
          </div>
        </div>`;
    });
    html += `</div>`;
  }

  container.innerHTML = html;
}

// ============================================================
// SECTION 4: Render Field Pendukung Dinamis
// ============================================================
function renderSection4(manfaat, containerId) {
  const container = document.getElementById(containerId || "section-4-container");
  if (!container) return;

  const config = typeof FIELD_CONFIG !== "undefined" ? FIELD_CONFIG[manfaat] : null;

  if (!config || !config.fields || config.fields.length === 0) {
    container.innerHTML = `
      <div class="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 text-center">
        <i class="fas fa-info-circle mr-1"></i>Tidak ada field tambahan untuk manfaat <strong>${manfaat}</strong>.
      </div>`;
    return;
  }

  let html = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">`;

  config.fields.forEach(field => {
    html += renderFieldItem(field);
  });

  html += `</div>`;
  container.innerHTML = html;
}

function renderFieldItem(field) {
  const reqMark = field.required ? `<span class="text-rose-500">*</span>` : '';
  const baseInput = `border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-asabri-blue bg-white text-slate-700 w-full`;

  if (field.type === "static") {
    return `
      <div class="flex flex-col gap-1.5">
        <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">${field.label}</label>
        <div class="${baseInput} bg-slate-100 font-semibold text-slate-600">${field.value || ''}</div>
      </div>`;
  }

  if (field.type === "text" || field.type === "number" || field.type === "date") {
    const extra = field.min !== undefined ? `min="${field.min}"` : '';
    const extra2 = field.max !== undefined ? `max="${field.max}"` : '';
    return `
      <div class="flex flex-col gap-1.5">
        <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">${field.label} ${reqMark}</label>
        <input type="${field.type}" id="${field.id}" placeholder="${field.placeholder || ''}" ${extra} ${extra2}
          class="${baseInput}" ${field.required ? 'required' : ''}>
      </div>`;
  }

  if (field.type === "select") {
    const options = (field.options || []).map(o => `<option>${o}</option>`).join('');
    return `
      <div class="flex flex-col gap-1.5">
        <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">${field.label} ${reqMark}</label>
        <select id="${field.id}" class="${baseInput}" ${field.required ? 'required' : ''}>
          ${options}
        </select>
      </div>`;
  }

  if (field.type === "radio") {
    const condId = field.id + "-cond";
    let radios = (field.options || []).map((opt, i) => {
      const cond = field.conditional && field.conditional.find(c => c.condition === opt);
      return `
        <label class="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
          <input type="radio" name="${field.id}" value="${opt}" class="text-asabri-blue focus:ring-asabri-blue"
            ${cond ? `onchange="toggleConditionalFields('${condId}', '${opt}')"` : ''}
            ${field.required && i === 0 ? 'required' : ''}>
          ${opt}
        </label>`;
    }).join('');

    let condHtml = '';
    if (field.conditional && field.conditional.length > 0) {
      field.conditional.forEach(c => {
        const subFields = (c.fields || []).map(sf => renderFieldItem(sf)).join('');
        condHtml += `<div id="${condId}-${c.condition.replace(/\s+/g, '-')}" class="hidden mt-3 pl-4 border-l-2 border-asabri-blue/20 grid grid-cols-1 md:grid-cols-2 gap-4">${subFields}</div>`;
      });
    }

    return `
      <div class="flex flex-col gap-1.5">
        <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">${field.label} ${reqMark}</label>
        <div class="flex flex-wrap gap-4 items-center py-1">${radios}</div>
        ${condHtml}
      </div>`;
  }

  return '';
}

function toggleConditionalFields(baseId, selectedValue) {
  // Hide all conditional groups under this base
  document.querySelectorAll(`[id^="${baseId}-"]`).forEach(el => el.classList.add("hidden"));
  // Show the matching one
  const target = document.getElementById(`${baseId}-${selectedValue.replace(/\s+/g, '-')}`);
  if (target) target.classList.remove("hidden");
}

// ============================================================
// SECTION 5: Render Perhitungan Manfaat
// ============================================================
function renderSection5(manfaat, peserta, containerId) {
  const container = document.getElementById(containerId || "section-5-container");
  if (!container) return;

  const calcConfig = typeof BENEFIT_CALC_CONFIG !== "undefined" ? BENEFIT_CALC_CONFIG[manfaat] : null;
  const gaji = peserta ? (peserta.gaji_pokok_terakhir || 0) : 0;

  if (!calcConfig) {
    container.innerHTML = `<p class="text-xs text-slate-400 italic">Konfigurasi perhitungan belum tersedia untuk <strong>${manfaat}</strong>. Hubungi Div. Aktuaria.</p>`;
    return;
  }

  let html = '';

  if (calcConfig.type === "cacat-calculator") {
    // Show the existing cacat calculator UI
    html = `
      <div class="p-4 bg-blue-50/50 border border-blue-200 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs items-center mb-4">
        <div>
          <span class="text-slate-400 font-bold block mb-1">Gaji Pokok Terakhir Peserta</span>
          <strong id="calc-gaji" class="text-slate-800 font-mono font-bold text-base">${formatRupiah(gaji)}</strong>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-[10px] font-bold text-slate-500 uppercase">Tingkat Cacat <span class="text-rose-500">*</span></label>
          <select id="calc-tingkat" onchange="calculateCompensation()" class="border border-slate-200 rounded-xl px-3 py-1.5 bg-white font-semibold text-xs">
            <option value="I">Tingkat I (Sembuh/Bekerja Biasa)</option>
            <option value="II" selected>Tingkat II (Sebagian Cacat)</option>
            <option value="III">Tingkat III (Cacat Total)</option>
          </select>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-[10px] font-bold text-slate-500 uppercase">Golongan Cacat <span class="text-rose-500">*</span></label>
          <select id="calc-golongan" onchange="calculateCompensation()" class="border border-slate-200 rounded-xl px-3 py-1.5 bg-white font-semibold text-xs">
            <option value="A">Golongan A (Sederhana)</option>
            <option value="B" selected>Golongan B (Menengah)</option>
            <option value="C">Golongan C (Berat/Permanen)</option>
          </select>
        </div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div class="bg-slate-50 p-4 border border-slate-200 rounded-2xl text-center">
          <span class="text-[10px] font-bold text-slate-400 uppercase">Persentase Manfaat</span>
          <strong id="calc-percentage-badge" class="block text-2xl font-black text-slate-800 mt-1">50%</strong>
          <span class="text-[9px] text-slate-400 block mt-0.5">Sesuai Kepres / PP Faktor Pengali Cacat</span>
        </div>
        <div class="bg-emerald-50 p-4 border border-emerald-200 rounded-2xl text-center">
          <span class="text-[10px] font-bold text-emerald-600 uppercase">Estimasi Nominal Santunan</span>
          <strong id="calc-nominal-badge" class="block text-2xl font-black text-emerald-700 mt-1">Rp —</strong>
          <span class="text-[9px] text-emerald-500 block mt-0.5">Siap dibayarkan sekaligus</span>
        </div>
      </div>
      <div class="border border-slate-200 rounded-xl overflow-hidden">
        <table class="w-full text-left text-xs">
          <thead><tr class="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
            <th class="px-4 py-2 border-r border-slate-200">Tingkat & Golongan</th>
            <th class="px-4 py-2">Besaran Santunan (% Gaji Pokok)</th>
          </tr></thead>
          <tbody class="divide-y divide-slate-100 text-slate-700">
            <tr class="calc-row-ref" data-key="III-C"><td class="px-4 py-2 font-medium border-r border-slate-200">Tingkat III & Golongan C</td><td class="px-4 py-2 font-bold text-emerald-600">100%</td></tr>
            <tr class="calc-row-ref" data-key="II-C-III-B"><td class="px-4 py-2 font-medium border-r border-slate-200">Tingkat II & Gol C / Tingkat III & Gol B</td><td class="px-4 py-2 font-bold text-emerald-600">75%</td></tr>
            <tr class="calc-row-ref" data-key="II-B"><td class="px-4 py-2 font-medium border-r border-slate-200">Tingkat II & Golongan B</td><td class="px-4 py-2 font-bold text-emerald-600">50%</td></tr>
            <tr class="calc-row-ref" data-key="III-A"><td class="px-4 py-2 font-medium border-r border-slate-200">Tingkat III & Golongan A</td><td class="px-4 py-2 font-bold text-emerald-600">40%</td></tr>
            <tr class="calc-row-ref" data-key="II-A"><td class="px-4 py-2 font-medium border-r border-slate-200">Tingkat II & Golongan A</td><td class="px-4 py-2 font-bold text-emerald-600">25%</td></tr>
          </tbody>
        </table>
      </div>`;

    html += renderPotongansBlock() + renderTotalNettoBlock("calc-nominal-badge");

  } else if (calcConfig.type === "fixed" || calcConfig.type === "fixed-flat") {
    const comps = calcConfig.components || [];
    let totalEstimasi = 0;
    let compRows = '';

    comps.forEach(c => {
      let nilaiDisplay = '';
      let nilaiNum = 0;

      if (c.fromGaji) {
        nilaiNum = gaji * c.fromGaji;
        nilaiDisplay = `${formatRupiah(nilaiNum)} <span class="text-[9px] text-slate-400">(${c.fromGaji}× gaji pokok)</span>`;
      } else if (c.perAnak) {
        nilaiNum = c.nilai;
        nilaiDisplay = `${formatRupiah(c.nilai)} / anak <span class="text-[9px] text-amber-600 font-medium">(kondisional)</span>`;
      } else {
        nilaiNum = c.nilai;
        nilaiDisplay = formatRupiah(c.nilai);
        if (!c.kondisional && !c.perAnak) totalEstimasi += nilaiNum;
        if (c.fromGaji) totalEstimasi += nilaiNum;
      }

      if (!c.kondisional && !c.perAnak && !c.fromGaji) totalEstimasi += nilaiNum;
      if (c.fromGaji) totalEstimasi += nilaiNum;

      compRows += `
        <tr>
          <td class="px-4 py-2.5 text-slate-700 font-medium">+ ${c.label}</td>
          <td class="px-4 py-2.5 font-bold text-slate-800 text-right font-mono">${nilaiDisplay}</td>
        </tr>`;
    });

    html = `
      <div class="border border-slate-200 rounded-xl overflow-hidden mb-4">
        <table class="w-full text-xs">
          <tbody class="divide-y divide-slate-100">${compRows}</tbody>
          <tfoot>
            <tr class="bg-slate-50 border-t-2 border-slate-300">
              <td class="px-4 py-3 font-bold text-slate-700">Subtotal Manfaat (Est.)</td>
              <td class="px-4 py-3 font-black text-asabri-blue text-right font-mono text-sm">${formatRupiah(totalEstimasi)}</td>
            </tr>
          </tfoot>
        </table>
      </div>`;

    html += renderPotongansBlock();
    html += renderTotalNettoDisplay(totalEstimasi);
    if (calcConfig.note) {
      html += `<p class="text-[10px] text-slate-400 italic mt-2"><i class="fas fa-circle-info mr-1"></i>${calcConfig.note}</p>`;
    }

  } else if (calcConfig.type === "tagihan") {
    html = `
      <div class="p-4 bg-sky-50 border border-sky-200 rounded-xl">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center"><i class="fas fa-receipt text-sky-600"></i></div>
          <div>
            <span class="text-xs font-bold text-sky-800 block">${calcConfig.label}</span>
            <span class="text-[10px] text-sky-600">Nilai klaim berdasarkan tagihan RS / reimburse aktual</span>
          </div>
        </div>
        <div class="flex items-center justify-between bg-white border border-sky-200 rounded-xl px-4 py-3">
          <span class="text-xs font-semibold text-slate-700">Nilai Tagihan RS / Reimburse</span>
          <span id="s5-tagihan-display" class="text-base font-black text-sky-700 font-mono">—</span>
        </div>
        ${calcConfig.note ? `<p class="text-[10px] text-amber-700 mt-2 italic"><i class="fas fa-triangle-exclamation mr-1"></i>${calcConfig.note}</p>` : ''}
      </div>`;
    html += renderPotongansBlock();

  } else if (calcConfig.type === "jkm-perwira" || calcConfig.type === "jkm-bintara") {
    const comps = calcConfig.components || [];
    let compRows = '';
    let totalEstimasi = 0;

    comps.forEach(c => {
      let nilaiNum = 0, nilaiDisplay = '';
      if (c.fromGaji) {
        nilaiNum = gaji * c.fromGaji;
        nilaiDisplay = `${formatRupiah(nilaiNum)} <span class="text-[9px] text-slate-400">(${c.fromGaji}× gaji pokok = ${formatRupiah(gaji)})</span>`;
        totalEstimasi += nilaiNum;
      } else if (c.fromDB) {
        nilaiDisplay = `<span class="text-[10px] text-amber-600 font-medium">Dari database iuran peserta</span>`;
        nilaiNum = Math.round(gaji * 0.0325 * 20 * 12); // Estimasi 20 thn * 3.25% gaji
        nilaiDisplay = `${formatRupiah(nilaiNum)} <span class="text-[9px] text-slate-400">(estimasi 20 thn × 3.25% gaji)</span>`;
        totalEstimasi += nilaiNum;
      } else if (c.perAnak) {
        nilaiDisplay = `${formatRupiah(c.nilai)} / anak <span class="text-[9px] text-amber-500">(kondisional maks 2 anak)</span>`;
      } else {
        nilaiNum = c.nilai;
        nilaiDisplay = formatRupiah(c.nilai);
        totalEstimasi += nilaiNum;
      }

      compRows += `<tr><td class="px-4 py-2.5 text-slate-700 font-medium">+ ${c.label}</td>
        <td class="px-4 py-2.5 font-bold text-slate-800 text-right font-mono">${nilaiDisplay}</td></tr>`;
    });

    html = `
      <div class="border border-slate-200 rounded-xl overflow-hidden mb-4">
        <table class="w-full text-xs">
          <tbody class="divide-y divide-slate-100">${compRows}</tbody>
          <tfoot><tr class="bg-slate-50 border-t-2 border-slate-300">
            <td class="px-4 py-3 font-bold text-slate-700">Subtotal Manfaat (Est.)</td>
            <td class="px-4 py-3 font-black text-asabri-blue text-right font-mono text-sm">${formatRupiah(totalEstimasi)}</td>
          </tr></tfoot>
        </table>
      </div>`;
    html += renderPotongansBlock();
    html += renderTotalNettoDisplay(totalEstimasi);

  } else {
    // aktuaria, ntip, rknt — tampilkan info panel
    html = `
      <div class="p-5 bg-gradient-to-br from-slate-50 to-blue-50/30 border border-slate-200 rounded-2xl">
        <div class="flex items-start gap-4">
          <div class="w-10 h-10 rounded-xl bg-asabri-blue/10 flex items-center justify-center flex-shrink-0">
            <i class="fas fa-calculator text-asabri-blue"></i>
          </div>
          <div>
            <h5 class="text-xs font-bold text-slate-800">${calcConfig.label}</h5>
            <p class="text-[11px] text-slate-500 mt-1">${calcConfig.note || "Perhitungan dilakukan oleh Divisi Aktuaria berdasarkan formula resmi."}</p>
            <div class="mt-3 flex flex-col gap-2">
              <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estimasi Manual / Koreksi Aktuaria (Rp)</label>
              <div class="flex gap-2 items-center">
                <input type="text" id="s5-manual-nilai" placeholder="Isi nilai estimasi jika sudah ada konfirmasi Div. Aktuaria..."
                  class="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-asabri-blue bg-white font-mono">
                <button onclick="applyManualNilai()" class="px-3 py-2 bg-asabri-blue text-white rounded-xl text-[10px] font-bold hover:bg-asabri-blueDark transition-colors whitespace-nowrap">
                  <i class="fas fa-check mr-1"></i>Terapkan
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>`;
    html += renderPotongansBlock();
    html += renderTotalNettoDisplay(0);
  }

  container.innerHTML = html;
}

function renderPotongansBlock() {
  return `
    <div class="mt-4 space-y-3">
      <h5 class="text-[10px] font-bold text-slate-500 uppercase tracking-wider border-t border-slate-100 pt-3">Komponen Potongan</h5>
      <div class="border border-slate-200 rounded-xl overflow-hidden">
        <table class="w-full text-xs">
          <tbody class="divide-y divide-slate-100">
            <tr class="bg-white hover:bg-red-50/20">
              <td class="px-4 py-2.5 text-slate-700">
                <div class="font-medium">− Hutang PUM KPR</div>
                <div class="text-[10px] text-slate-400">Dipotong dari TA/NTTA terlebih dahulu. TIDAK memotong pensiun APBN.</div>
              </td>
              <td class="px-4 py-2.5 text-right"><input type="text" id="pot-pum-kpr" value="0" placeholder="0" class="w-32 border border-slate-200 rounded-lg px-2 py-1 text-xs text-right font-mono focus:border-asabri-blue outline-none" onchange="recalcTotalNetto()"></td>
            </tr>
            <tr class="bg-white hover:bg-red-50/20">
              <td class="px-4 py-2.5 text-slate-700 font-medium">− Potongan BPJS</td>
              <td class="px-4 py-2.5 text-right"><input type="text" id="pot-bpjs" value="0" placeholder="0" class="w-32 border border-slate-200 rounded-lg px-2 py-1 text-xs text-right font-mono focus:border-asabri-blue outline-none" onchange="recalcTotalNetto()"></td>
            </tr>
            <tr class="bg-white hover:bg-red-50/20">
              <td class="px-4 py-2.5 text-slate-700">
                <div class="font-medium">− Premi TPB (Taspen Proteksi Beasiswa)</div>
                <div class="text-[10px] text-amber-600">Hanya jika Beasiswa dialihkan ke TPB = Ya. Dana tidak dibayarkan tunai.</div>
              </td>
              <td class="px-4 py-2.5 text-right"><input type="text" id="pot-tpb" value="0" placeholder="0" class="w-32 border border-slate-200 rounded-lg px-2 py-1 text-xs text-right font-mono focus:border-asabri-blue outline-none" onchange="recalcTotalNetto()"></td>
            </tr>
            <tr class="bg-white hover:bg-red-50/20">
              <td class="px-4 py-2.5 text-slate-700 font-medium">− Pajak</td>
              <td class="px-4 py-2.5 text-right"><input type="text" id="pot-pajak" value="0" placeholder="0" class="w-32 border border-slate-200 rounded-lg px-2 py-1 text-xs text-right font-mono focus:border-asabri-blue outline-none" onchange="recalcTotalNetto()"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>`;
}

function renderTotalNettoDisplay(subtotal) {
  return `
    <div class="mt-4 p-4 bg-gradient-to-r from-asabri-blue to-asabri-blueDark rounded-2xl flex items-center justify-between">
      <div>
        <span class="text-white/70 text-[10px] font-bold uppercase tracking-wider block">TOTAL NETTO DIBAYARKAN</span>
        <span class="text-white/60 text-[9px]">Setelah seluruh potongan</span>
      </div>
      <div class="text-right">
        <strong id="total-netto-display" class="text-white font-black text-2xl font-mono">${formatRupiah(subtotal)}</strong>
        <input type="hidden" id="s5-subtotal" value="${subtotal}">
      </div>
    </div>`;
}

function renderTotalNettoBlock(sourceId) {
  return `
    <div class="mt-4 p-4 bg-gradient-to-r from-asabri-blue to-asabri-blueDark rounded-2xl flex items-center justify-between">
      <div>
        <span class="text-white/70 text-[10px] font-bold uppercase tracking-wider block">TOTAL NETTO DIBAYARKAN</span>
        <span class="text-white/60 text-[9px]">Setelah seluruh potongan</span>
      </div>
      <strong id="total-netto-display" class="text-white font-black text-2xl font-mono">Rp —</strong>
    </div>`;
}

function recalcTotalNetto() {
  const subtotalEl = document.getElementById("s5-subtotal");
  const subtotal = subtotalEl ? parseFloat(subtotalEl.value) || 0 : 0;

  const pumKpr = parseRupiahInput("pot-pum-kpr");
  const bpjs = parseRupiahInput("pot-bpjs");
  const tpb = parseRupiahInput("pot-tpb");
  const pajak = parseRupiahInput("pot-pajak");
  const totalPotongan = pumKpr + bpjs + tpb + pajak;

  const netto = Math.max(0, subtotal - totalPotongan);
  const el = document.getElementById("total-netto-display");
  if (el) el.innerText = formatRupiah(netto);
}

function parseRupiahInput(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  return parseFloat(el.value.replace(/[^0-9]/g, '')) || 0;
}

function applyManualNilai() {
  const el = document.getElementById("s5-manual-nilai");
  const subtotalEl = document.getElementById("s5-subtotal");
  if (!el) return;
  const val = parseFloat(el.value.replace(/[^0-9]/g, '')) || 0;
  if (subtotalEl) subtotalEl.value = val;
  recalcTotalNetto();
  showToast("Nilai Diterapkan", `Estimasi aktuaria: ${formatRupiah(val)} telah dimasukkan.`);
}

// ============================================================
// SECTION 6: Timeline Log
// ============================================================
function addTimelineEntry(aksi, oleh, keterangan, containerId) {
  const container = document.getElementById(containerId || "timeline-log-container");
  if (!container) return;

  const now = new Date();
  const dateStr = now.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) +
                  " " + now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(".", ":");

  const entry = document.createElement("div");
  entry.className = "flex gap-4 animate-fade-in";
  entry.innerHTML = `
    <div class="flex flex-col items-center">
      <div class="w-3 h-3 rounded-full bg-asabri-blue border-2 border-white shadow-sm mt-0.5 flex-shrink-0"></div>
      <div class="flex-1 w-px bg-slate-200 mt-1"></div>
    </div>
    <div class="flex-1 pb-4">
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <span class="text-xs font-bold text-slate-800">${aksi}</span>
        <span class="text-[9px] text-slate-400 font-mono whitespace-nowrap">${dateStr}</span>
      </div>
      <p class="text-[11px] text-slate-500 mt-0.5">${keterangan || ''}</p>
      <span class="text-[10px] text-asabri-blue font-semibold"><i class="fas fa-user text-[8px] mr-1"></i>${oleh || 'SK | Staf Kancab'}</span>
    </div>`;

  container.insertBefore(entry, container.firstChild);
}

function renderTimelineFromAuditTrail(auditTrail, containerId) {
  const container = document.getElementById(containerId || "timeline-log-container");
  if (!container) return;

  if (!auditTrail || auditTrail.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400 italic text-center py-4"><i class="fas fa-clock mr-1"></i>Belum ada riwayat proses.</p>`;
    return;
  }

  container.innerHTML = "";
  // Render oldest first (bottom), newest on top
  [...auditTrail].reverse().forEach(entry => {
    const div = document.createElement("div");
    div.className = "flex gap-4";
    div.innerHTML = `
      <div class="flex flex-col items-center">
        <div class="w-3 h-3 rounded-full bg-slate-300 border-2 border-white shadow-sm mt-0.5 flex-shrink-0"></div>
        <div class="flex-1 w-px bg-slate-200 mt-1"></div>
      </div>
      <div class="flex-1 pb-4">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <span class="text-xs font-bold text-slate-800">${entry.aksi}</span>
          <span class="text-[9px] text-slate-400 font-mono whitespace-nowrap">${entry.tanggal}</span>
        </div>
        <p class="text-[11px] text-slate-500 mt-0.5">${entry.keterangan || ''}</p>
        <span class="text-[10px] text-asabri-blue font-semibold"><i class="fas fa-user text-[8px] mr-1"></i>${entry.user || ''}</span>
      </div>`;
    container.appendChild(div);
  });
}

function previewRequiredFile(type, id) {
  const fileInput = document.getElementById(`file-doc-${type}-${id}`) ||
                    document.getElementById(`file-doc-${id}`) ||
                    document.getElementById(`file-p-${id}`);
  if (!fileInput || !fileInput.files || !fileInput.files[0]) {
    alert("Berkas belum diunggah.");
    return;
  }
  const file = fileInput.files[0];
  const fileURL = URL.createObjectURL(file);
  window.open(fileURL, '_blank');
}
