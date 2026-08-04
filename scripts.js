// scripts.js - AnajakVPN Client Frontend    
// Last major update: January 2026    
// Updated: January 15, 2026 - Fixed subdomain replacement instead of IP when copying config  
const WORKER_URL = "https://anajakvpnvip.panda-hshark.workers.dev";    
const MAIN_DOMAIN = "anajakvpnvip.filegear-sg.me";  // Used to reconstruct expected subdomains

let validCodes = [];    
let allServers = [];    
let categoryTitles = {};    
let notifications = [];    
let mainMenuItems = [];    

let currentUser = null;    
let hasSeenWarning = false;    
let readNotifications = JSON.parse(localStorage.getItem("readNotifications") || "[]");    

// Subdomain cache: countryCode (lowercase) → full subdomain
let subdomainMap = {};    
try {
    const saved = localStorage.getItem('subdomainMap');
    if (saved) {
        subdomainMap = JSON.parse(saved);
    }
} catch (e) {
    console.warn("Failed to parse subdomainMap from localStorage", e);
}

const REMEMBER_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days    

// ================== RANDOM USER AVATAR ==================    
const userIcons = [    
    '👽', '🤠', '🦁', '🐯', '🐸', '🦊', '🐺', '🐻', '🐼', '🦝',    
    '🐨', '🐮', '🐷', '🐭', '🐹', '🦄', '🐙', '🦉', '🐳', '🦋',    
    '🌟', '🔥', '💀', '🤖', '🎃', '👻', '🧙', '🦸', '🦹', '🎅',    
    '🧑‍🚀', '👾', '🤡', '👑', '🦖', '🦕', '🐉', '🌈', '⚡', '💎'    
];    

const userColors = [    
    'from-purple-600 to-pink-600',    
    'from-blue-600 to-cyan-600',    
    'from-green-600 to-teal-600',    
    'from-yellow-500 to-orange-600',    
    'from-red-600 to-pink-700',    
    'from-indigo-600 to-purple-700',    
    'from-teal-600 to-green-600',    
    'from-orange-600 to-red-600',    
    'from-pink-600 to-rose-700',    
    'from-cyan-500 to-blue-600'    
];    

function setRandomUserAvatar() {    
    const avatarEl = document.getElementById('random-user-avatar');    
    if (!avatarEl) return;    

    let savedIcon = localStorage.getItem('userAvatarIcon');    
    let savedColor = localStorage.getItem('userAvatarColor');    

    if (!savedIcon || !savedColor) {    
        savedIcon = userIcons[Math.floor(Math.random() * userIcons.length)];    
        savedColor = userColors[Math.floor(Math.random() * userColors.length)];    
            
        localStorage.setItem('userAvatarIcon', savedIcon);    
        localStorage.setItem('userAvatarColor', savedColor);    
    }    

    avatarEl.textContent = savedIcon;    
    avatarEl.className = `w-12 h-12 bg-gradient-to-br ${savedColor} rounded-full flex items-center justify-center shadow-lg text-2xl`;    
}    

// ================== DEVTOOLS DETECTION (2026 hardened version) ==================    
const DevToolsDetector = (function() {    
    let isOpen = false;    
    let detectionScore = 0;    
    const DETECTION_THRESHOLD = 2;    
    let warningShown = false;    

    let lastWidth = window.innerWidth;    
    let lastHeight = window.innerHeight;    

    function checkSizeDifference() {    
        const wDiff = Math.abs(window.innerWidth - lastWidth);    
        const hDiff = Math.abs(window.innerHeight - lastHeight);    

        if ((wDiff > 280 && wDiff < 580) || (hDiff > 280 && hDiff < 580)) {    
            detectionScore++;    
        }    

        lastWidth = window.innerWidth;    
        lastHeight = window.innerHeight;    
    }    

    function timingAttack() {    
        const start = performance.now();    
        // eslint-disable-next-line no-debugger    
        debugger;    
        const duration = performance.now() - start;    

        if (duration > 80) {    
            detectionScore += 2;    
        }    
    }    

    function consoleTrap() {    
        const test = /./;    
        let triggered = false;    

        test.toString = function() {    
            triggered = true;    
            detectionScore++;    
            return "[devtools-detected]";    
        };    

        console.log("%c", test);    
        return triggered;    
    }    

    function updateDetection() {    
        detectionScore = 0;    
        checkSizeDifference();    
        timingAttack();    
        consoleTrap();    

        const previouslyOpen = isOpen;    
        isOpen = detectionScore >= DETECTION_THRESHOLD;    

        if (isOpen && !previouslyOpen && !warningShown) {    
            warningShown = true;    
            // Silent protection - no UI warning    
        }    
    }    

    setInterval(updateDetection, 700);    
    window.addEventListener('resize', updateDetection);    
    window.addEventListener('focus', updateDetection);    

    return {    
        isOpen: () => isOpen    
    };    
})();    

// ================== FETCH LAST COMMIT DATE ==================    
async function fetchJsonLastModified() {    
    try {    
        const fileInfoRes = await fetch(`${WORKER_URL}/file-info`);    
        if (!fileInfoRes.ok) return null;    

        const fileData = await fileInfoRes.json();    
        const lastCommitId = fileData.last_commit_id;    

        const commitRes = await fetch(`${WORKER_URL}/commit/${lastCommitId}`);    
        if (!commitRes.ok) return null;    

        const commitData = await commitRes.json();    
        return new Date(commitData.committed_date);    
    } catch (err) {    
        console.warn("Could not fetch last modified date:", err);    
        return null;    
    }    
}    

async function updateLastUpdateDate() {    
    const lastModified = await fetchJsonLastModified();    
    const span = document.querySelector('#last-update span');    
    if (!span) return;    

    if (lastModified) {    
        span.textContent = lastModified.toLocaleDateString('km-KH', {    
            year: 'numeric',    
            month: 'long',    
            day: 'numeric',    
            hour: '2-digit',    
            minute: '2-digit'    
        });    
    } else {    
        const now = new Date();    
        span.textContent = now.toLocaleDateString('km-KH', {    
            year: 'numeric',    
            month: 'long',    
            day: 'numeric',    
            hour: '2-digit',    
            minute: '2-digit'    
        });    
    }    
}    

// ================== HEADER VISIBILITY HELPERS ==================    
function hideMainHeaderElements() {    
    const container = document.querySelector('#app-content .container');    
    if (!container) return;    
    container.querySelector('.premium-card')?.classList.add('hidden');    
    container.querySelector('.expiry-card')?.classList.add('hidden');    
    document.getElementById('search-input')?.closest('.relative')?.classList.add('hidden');    
}    

function showMainHeaderElements() {    
    const container = document.querySelector('#app-content .container');    
    if (!container) return;    
    container.querySelector('.premium-card')?.classList.remove('hidden');    
    container.querySelector('.expiry-card')?.classList.remove('hidden');    
    document.getElementById('search-input')?.closest('.relative')?.classList.remove('hidden');    
}    

// ================== GLOBAL LOADING OVERLAY ==================
function showGlobalLoading(title = 'កំពុងផ្ទុក...', subtitle = 'សូមរង់ចាំបន្តិច') {
  const overlay = document.getElementById('global-loading-overlay');
  if (!overlay) return;

  const titleEl = document.getElementById('global-loading-title');
  const subtitleEl = document.getElementById('global-loading-subtitle');
  if (titleEl) titleEl.textContent = title;
  if (subtitleEl) subtitleEl.textContent = subtitle;

  overlay.classList.remove('hidden');
}

function hideGlobalLoading() {
  const overlay = document.getElementById('global-loading-overlay');
  if (overlay) overlay.classList.add('hidden');
}

// ================== PREWARM ALL SUBDOMAINS ==================
async function prewarmUserSubdomains(code, expiry_date) {
  if (!code || !expiry_date) return false;

  try {
    const res = await fetch(`${WORKER_URL}/prewarm-subdomains`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: code.trim().toUpperCase(),
        expiry_date: expiry_date.trim()
      })
    });

    if (!res.ok) {
      console.warn('Prewarm request failed:', res.status);
      return false;
    }

    const data = await res.json();
    console.log('Prewarm result:', data);

    // If worker returns list of domains (recommended future improvement)
    if (data.success && Array.isArray(data.domains)) {
      data.domains.forEach(fullDomain => {
        const cc = fullDomain.split('.')[0].slice(0, 2).toLowerCase();
        if (cc.length === 2) {
          subdomainMap[cc] = fullDomain;
        }
      });
    } 
    // Fallback: reconstruct domains ourselves from known countries
    else if (data.success) {
      const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      const yyyymmdd = expiry_date.replace(/-/g, '').slice(0, 8);

      const countries = [...new Set(
        allServers.map(s => 
          String(s.countrycode || s.country || 'kh')
            .trim()
            .toLowerCase()
        ).filter(Boolean)
      )];

      countries.forEach(cc => {
        const domain = `${cc}${cleanCode}${yyyymmdd}.${MAIN_DOMAIN}`;
        subdomainMap[cc] = domain;
      });
    }

    // Persist to localStorage
    localStorage.setItem('subdomainMap', JSON.stringify(subdomainMap));

    return data.success === true;
  } catch (err) {
    console.error('Prewarm error:', err);
    return false;
  }
}

// ================== UTILITIES ==================    
function scrollToTop() {    
    window.scrollTo({ top: 0, behavior: 'smooth' });    
}    

/**
 * Parse expiry date string safely (ISO, YYYY-MM-DD, DD/MM/YYYY, timestamp).
 */
function parseExpiryDate(str) {
    if (!str) return null;
    if (str instanceof Date) return isNaN(str.getTime()) ? null : str;

    const s = String(str).trim();
    // Unix ms / s
    if (/^\d{10,13}$/.test(s)) {
        const n = Number(s);
        const d = new Date(n < 1e12 ? n * 1000 : n);
        return isNaN(d.getTime()) ? null : d;
    }
    // YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        const d = new Date(s);
        return isNaN(d.getTime()) ? null : d;
    }
    // DD/MM/YYYY or DD-MM-YYYY
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (m) {
        const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
        return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
}

/**
 * Update circular expiry progress.
 * - Center = days left
 * - Ring % = daysLeft / 90 (capped)
 * - green >15d / >50%, yellow 8–15d, red ≤7d
 */
function updateExpiryProgress(expiryDateStr) {
    const R = 28;
    const CIRCUMFERENCE = 2 * Math.PI * R; // ≈ 175.93
    const ring = document.getElementById('expiry-ring-fill');
    const percentEl = document.getElementById('expiry-percent');
    const displayEl = document.getElementById('expiry-display');
    const daysLeftEl = document.getElementById('expiry-days-left');
    const shieldEl = document.getElementById('expiry-shield');

    if (!ring || !percentEl || !displayEl) {
        console.warn('[expiry] DOM elements missing');
        return;
    }

    const expiry = parseExpiryDate(expiryDateStr);
    if (!expiry) {
        console.warn('[expiry] invalid date:', expiryDateStr);
        percentEl.textContent = '—';
        displayEl.textContent = '—';
        if (daysLeftEl) daysLeftEl.textContent = '—';
        ring.style.strokeDasharray = String(CIRCUMFERENCE);
        ring.style.strokeDashoffset = String(CIRCUMFERENCE);
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDay = new Date(expiry);
    expDay.setHours(23, 59, 59, 999);

    const msLeft = expDay.getTime() - today.getTime();
    const daysLeft = Math.max(0, Math.ceil(msLeft / 86400000));

    // Ring fill relative to 90-day window
    const percent = Math.max(0, Math.min(100, Math.round((daysLeft / 90) * 100)));

    let colorClass = 'green';
    if (daysLeft <= 7 || percent <= 20) colorClass = 'red';
    else if (daysLeft <= 15 || percent <= 50) colorClass = 'yellow';

    const strokeColor = colorClass === 'green' ? '#34d399'
                      : colorClass === 'yellow' ? '#fbbf24'
                      : '#f87171';

    // Update ring (attributes + style for max browser support)
    ring.classList.remove('green', 'yellow', 'red');
    ring.classList.add(colorClass);
    ring.setAttribute('stroke', strokeColor);
    ring.style.stroke = strokeColor;
    ring.setAttribute('stroke-dasharray', String(CIRCUMFERENCE));
    ring.style.strokeDasharray = String(CIRCUMFERENCE);

    // Animate from full empty → filled
    const offset = CIRCUMFERENCE * (1 - percent / 100);
    // force start state then animate
    ring.style.transition = 'none';
    ring.setAttribute('stroke-dashoffset', String(CIRCUMFERENCE));
    ring.style.strokeDashoffset = String(CIRCUMFERENCE);
    // next frame → target
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            ring.style.transition = 'stroke-dashoffset 0.85s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.4s ease';
            ring.setAttribute('stroke-dashoffset', String(offset));
            ring.style.strokeDashoffset = String(offset);
        });
    });

    // Center days number
    percentEl.classList.remove('green', 'yellow', 'red');
    percentEl.classList.add(colorClass);
    percentEl.style.color = strokeColor;
    percentEl.textContent = String(daysLeft);

    // Full date
    try {
        displayEl.textContent = expiry.toLocaleDateString('km-KH', {
            day: 'numeric', month: 'long', year: 'numeric'
        });
    } catch {
        displayEl.textContent = expiry.toISOString().slice(0, 10);
    }

    // "នៅសល់ X ថ្ងៃ"
    if (daysLeftEl) {
        daysLeftEl.classList.remove('green', 'yellow', 'red');
        daysLeftEl.classList.add(colorClass);
        daysLeftEl.style.color = strokeColor;
        if (daysLeft <= 0) {
            daysLeftEl.textContent = 'ផុតកំណត់ហើយ';
        } else if (daysLeft === 1) {
            daysLeftEl.textContent = 'នៅសល់ ១ ថ្ងៃ';
        } else {
            daysLeftEl.textContent = 'នៅសល់ ' + daysLeft + ' ថ្ងៃ';
        }
    }

    if (shieldEl) {
        shieldEl.classList.remove('green', 'yellow', 'red');
        shieldEl.classList.add(colorClass);
        shieldEl.style.color = strokeColor;
        shieldEl.style.opacity = '1';
    }
}

async function measurePingWebRTC(ip, timeoutMs = 3000) {
    return new Promise(resolve => {
        let resolved = false;
        const start = performance.now();

        const pc = new RTCPeerConnection({
            iceServers: [{
                urls: `stun:${ip}:3478`
            }]
        });

        pc.createDataChannel('ping');

        pc.onicecandidate = event => {
            if (event.candidate && !resolved) {
                resolved = true;
                const rtt = Math.round(performance.now() - start);
                cleanup();
                resolve(rtt);
            }
        };

        pc.createOffer()
          .then(offer => pc.setLocalDescription(offer))
          .catch(() => {});

        const timer = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                cleanup();
                resolve(null);
            }
        }, timeoutMs);

        function cleanup() {
            clearTimeout(timer);
            pc.close();
        }
    });
}
    
function showPingResult(element, ms) {    
    if (ms === null) {    
        element.textContent = 'N/A';    
        element.className = 'text-xs text-red-400';    
    } else if (ms < 200) {    
        element.textContent = ms + 'ms';    
        element.className = 'text-xs text-emerald-400 font-medium';    
    } else if (ms < 300) {    
        element.textContent = ms + 'ms';    
        element.className = 'text-xs text-yellow-400 font-medium';    
    } else {    
        element.textContent = ms + 'ms';    
        element.className = 'text-xs text-red-400 font-medium';    
    }    
}    
    
async function autoPingServer(ip, resultElement) {
    if (!ip) {
        showPingResult(resultElement, null);
        return;
    }

    resultElement.textContent = '...';
    resultElement.className = 'text-xs text-gray-400 animate-pulse';

    const ms = await measurePingWebRTC(ip);
    showPingResult(resultElement, ms);
}

// ================== IMPROVED IP CHECKER ==================    
function showMyIP() {    
    const modal = document.getElementById('ip-modal');    
    const loading = document.getElementById('ip-loading');    
    const content = document.getElementById('ip-content');    
    
    if (!modal || !loading || !content) return;    
    
    loading.classList.remove('hidden');    
    content.classList.add('hidden');    
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';    
    
    const timeoutId = setTimeout(() => {    
        loading.classList.add('hidden');    
        content.classList.remove('hidden');    
        document.getElementById('ip-address').textContent = 'Timeout';    
        document.getElementById('country-name').textContent = 'សំណើយឺតពេក';    
        document.getElementById('country-flag').textContent = '⏳';    
        document.getElementById('isp-info').textContent = 'សូមព្យាយាមម្តងទៀត ឬបិទ Adblock';    
    }, 18000);    
    
    const ipServices = [    
        'https://ipwho.is',    
        'https://api.ipify.org?format=json',    
        'https://cloudflare.com/cdn-cgi/trace',    
        'https://api.myip.com',    
        'https://freeipapi.com/api/json'    
    ];    
    
    fetch(ipServices[0])    
        .then(r => {    
            if (!r.ok) throw new Error('First service failed');    
            return r.json();    
        })    
        .then(data => processIPData(data))    
        .catch(() => {    
            fetch(ipServices[1])    
                .then(r => r.json())    
                .then(ipData => fetch(`https://ipwho.is/${ipData.ip}`))    
                .then(r => r.json())    
                .then(data => processIPData(data))    
                .catch(() => tryNextFallback());    
        });    
    
    function tryNextFallback() {    
        fetch(ipServices[2])    
            .then(r => r.text())    
            .then(text => {    
                const data = {};    
                text.split('\n').forEach(line => {    
                    const [key, value] = line.split('=');    
                    if (key && value) data[key.trim()] = value.trim();    
                });    
                if (data.ip && data.loc) {    
                    return {    
                        ip: data.ip,    
                        country_name: data.loc ? 'Need geo lookup' : data.country,    
                        country_code: data.loc ? null : data.loc,    
                        org: data.uag || data.fl    
                    };    
                }    
                throw new Error('Cloudflare parse failed');    
            })    
            .then(data => processIPData(data))    
            .catch(() => {    
                fetch(ipServices[4])    
                    .then(r => r.json())    
                    .then(data => processIPData(data))    
                    .catch(finalError);    
            });    
    }    
    
    function processIPData(data) {    
        clearTimeout(timeoutId);    
        loading.classList.add('hidden');    
        content.classList.remove('hidden');    

        const ip = data.ip || data.IPv4 || data.query || '—';    
        const country = data.country_name || data.country || data.countryName || '—';    
        const code = data.country_code || data.countryCode || data.country_code2 || data.country?.code;    
        const flag = code ? getCountryFlagEmoji(code) : '🌐';    
        const isp = data.org || data.isp || data.connection?.isp || data.asn?.name || data.organic || '—';    

        document.getElementById('ip-address').textContent = ip;    
        document.getElementById('country-name').textContent = country;    
        document.getElementById('country-flag').textContent = flag;    
        document.getElementById('isp-info').textContent = isp;    
    }    

    function finalError() {    
        clearTimeout(timeoutId);    
        loading.classList.add('hidden');    
        content.classList.remove('hidden');    
        document.getElementById('ip-address').textContent = 'កំហុស';    
        document.getElementById('country-name').textContent = 'មិនអាចទាញយកបាន';    
        document.getElementById('country-flag').textContent = '⚠️';    
        document.getElementById('isp-info').textContent = 'សូមពិនិត្ដអ៊ីនធឺណិត បិទ Adblock ឬ VPN បណ្តោះអាសន្ន';    
    }    
}    
    
function getCountryFlagEmoji(code) {    
    if (!code) return '🌍';    
    return code.toUpperCase().split('').map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join('');    
}    
    
function closeIPModal() {    
    const modal = document.getElementById('ip-modal');
    if (!modal) return;
    modal.classList.remove('show');
    document.body.style.overflow = '';
}    

// ================== CONFIG PLACEHOLDER REPLACEMENT (FIXED) ==================    
async function replacePlaceholdersInConfig(text, serverItem) {    
    let config = text;    

    config = config.replace(/r+andom-domain|andom-domain+|(random-domain)+/gi, 'random-domain');    

    const hasRandomDomain = /random-domain/gi.test(config);    
    if (!hasRandomDomain) return config;    

    let replacement = serverItem.ip || '';

    const country = String(serverItem.countrycode || serverItem.country || 'kh')
        .trim()
        .toLowerCase();

    if (subdomainMap[country]) {
        replacement = subdomainMap[country];
        console.log(`[Subdomain used] ${country} → ${replacement}`);
    } else {
        console.warn(`[No subdomain] ${country} → falling back to IP: ${replacement}`);
    }

    return config.replace(/random-domain/gi, replacement);    
}    

// ================== MAIN DATA LOADER ==================    
async function loadData() {
    // Show loading overlay first (covers login UI until data is ready)
    showGlobalLoading('កំពុងផ្ទុកទិន្នន័យ...', 'សូមរង់ចាំបន្តិច');

    // Keep login view hidden until data is ready
    const loginView = document.getElementById('login-view');
    if (loginView) loginView.classList.add('hidden');

    await new Promise(resolve => setTimeout(resolve, 800));

    if (DevToolsDetector.isOpen()) {
        console.warn("[Protection] DevTools detected → Blocking data load");
        hideGlobalLoading();
        if (loginView) loginView.classList.remove('hidden');
        // ... (devtools block UI)
        return;
    }

    try {
        const rawUrl = `${WORKER_URL}/data`;
        const res = await fetch(rawUrl, { cache: "no-cache" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const text = await res.text();
        const data = JSON.parse(text);

        try {
            const saved = localStorage.getItem('subdomainMap');
            if (saved) subdomainMap = JSON.parse(saved);
        } catch {}

        validCodes = data.validCodes || [];
        allServers = data.allServers || [];
        categoryTitles = data.categoryTitles || {};
        notifications = data.notifications || [];
        mainMenuItems = data.mainMenuItems || [];

        initApp();
        updateNotificationBadge();
        renderMainMenu();
        await updateLastUpdateDate();

        // Data ready → hide overlay, then show login or auto-login
        hideGlobalLoading();
        attemptAutoLogin();

        // If auto-login did not succeed, show login UI
        if (!currentUser && loginView) {
            loginView.classList.remove('hidden');
        }

    } catch (err) {
        console.error("Failed to load data from worker:", err);
        hideGlobalLoading();
        if (loginView) loginView.classList.remove('hidden');
        showToast('មានបញ្ហាផ្ទុកទិន្នន័យ – សូម refresh ទំព័រ');
    }
}

// ================== CLEAR CACHE HELPER ==================
function clearAppCache() {
    // Clear all app-related localStorage
    const keysToClear = [
        'autoLoginData',
        'subdomainMap',
        'readNotifications',
        'userAvatarIcon',
        'userAvatarColor'
    ];

    keysToClear.forEach(key => {
        localStorage.removeItem(key);
    });

    // Reset in-memory variables
    subdomainMap = {};
    readNotifications = [];
    currentUser = null;
    hasSeenWarning = false;

    console.log('🧹 App cache cleared successfully');
}

// ================== LOGOUT FUNCTION (UPDATED) ==================
function logout(silent = false) {
    if (!silent && !confirm('តើអ្នកចង់ចាកចេញមែនទេ?')) return;

    // Clear cache before UI changes
    clearAppCache();

    document.getElementById('app-content').classList.add('hidden');
    document.getElementById('login-view').classList.remove('hidden');
    document.getElementById('bottom-nav').classList.add('hidden');
    document.getElementById('server-stats')?.classList.add('hidden');

    document.getElementById('login-code').value = '';
    document.getElementById('login-error').classList.add('hidden');

    showToast('បានចាកចេញ និងសម្អាត cache រួចរាល់');

    setTimeout(() => {
        location.reload(); // Force fresh reload
    }, 400);
}

// ================== LOGIN SYSTEM ==================    
function checkLoginCode() {    
    const input = document.getElementById('login-code').value.trim();    
    const code = input.toUpperCase();    
    const errorEl = document.getElementById('login-error');    

    if (!code) {    
        errorEl.textContent = 'សូមវាយកូដ!';    
        errorEl.classList.remove('hidden');    
        return;    
    }    

    const today = new Date();    
    today.setHours(23, 59, 59, 999);    

    const found = validCodes.find(c => {    
        if (c.code.toUpperCase() !== code) return false;    
        const expiry = new Date(c.expiry_date);    
        return !isNaN(expiry.getTime()) && expiry >= today;    
    });    

    if (found) {    
        currentUser = { code: found.code, expiry: found.expiry_date };    

        document.getElementById('user-code-display').textContent = found.code;    
        updateExpiryProgress(found.expiry_date);    

        localStorage.setItem('autoLoginData', JSON.stringify({    
            code: found.code,    
            savedAt: Date.now(),    
            expiry: found.expiry_date    
        }));    

        document.getElementById('login-view').classList.add('hidden');    
        document.getElementById('app-content').classList.remove('hidden');    
        document.getElementById('bottom-nav').classList.remove('hidden');    


        if (!hasSeenWarning) {    
            document.getElementById('warning-modal').classList.add('show'); document.body.style.overflow = 'hidden';    
            hasSeenWarning = true;    
        }    

        errorEl.classList.add('hidden');    
        showMainHeaderElements();    

        subdomainMap = {};    
    } else {    
        errorEl.textContent = 'កូដមិនត្រឹមត្រូវ ឬផុតកំណត់ហើយ!';    
        errorEl.classList.remove('hidden');    
    }    
}    

// ================== ATTEMPT AUTO LOGIN (UPDATED) ==================
function attemptAutoLogin() {
    const saved = localStorage.getItem('autoLoginData');
    if (!saved) return;

    try {
        const data = JSON.parse(saved);
        const now = Date.now();

        // Check if remember duration has expired
        if (now - data.savedAt > REMEMBER_DURATION_MS) {
            console.log('Auto-login expired (remember duration)');
            clearAppCache();                    // ← Clear all cache
            return;
        }

        const today = new Date();
        today.setHours(23, 59, 59, 999);

        const found = validCodes.find(c => 
            c.code.toUpperCase() === data.code.toUpperCase() &&    
            new Date(c.expiry_date) >= today
        );

        if (found) {
            // Successful auto-login
            currentUser = { 
                code: found.code, 
                expiry: found.expiry_date 
            };

            document.getElementById('user-code-display').textContent = found.code;
            updateExpiryProgress(found.expiry_date);

            document.getElementById('login-view').classList.add('hidden');
            document.getElementById('app-content').classList.remove('hidden');
            document.getElementById('bottom-nav').classList.remove('hidden');

            showMainHeaderElements();

            if (!hasSeenWarning) {
                document.getElementById('warning-modal').classList.add('show'); document.body.style.overflow = 'hidden';
                hasSeenWarning = true;
            }

            console.log('✅ Auto-login successful');
        } 
        else {
            // Code exists but expired or invalid
            console.log('Auto-login failed: Code expired or not found');
            clearAppCache();                    // ← Clear all cache
            localStorage.removeItem('autoLoginData');
        }
    } 
    catch (e) {
        console.warn("Auto-login failed (parse error):", e);
        clearAppCache();                        // ← Clear all cache
        localStorage.removeItem('autoLoginData');
    }
}
// ================== WARNING MODAL ==================    
async function closeWarningModal() {    
    document.getElementById('warning-modal')?.classList.remove('show');
    document.body.style.overflow = '';    

    if (!currentUser || !currentUser.code || !currentUser.expiry) {
        showToast('មិនមានព័ត៌មានអ្នកប្រើប្រាស់');
        return;
    }

    showGlobalLoading('កំពុងរៀបចំ server សម្រាប់អ្នក...', 'សូមរង់ចាំបន្តិច (10-30 វិនាទី)');

    try {
        const success = await prewarmUserSubdomains(currentUser.code, currentUser.expiry);

        hideGlobalLoading();

        if (success) {
            showToast('បានរៀបចំ server រួចរាល់ ✓');
        } else {
            showToast('មានបញ្ហាបន្តិចក្នុងការរៀបចំ Server');
        }
    } catch (err) {
        hideGlobalLoading();
        console.error('Prewarm failed:', err);
        showToast('ការរៀបចំ Server បរាជ័យ – សូម refresh ទំព័រ');
    }
}    

// ================== NAVIGATION ==================    
function backToMain() {    
    document.getElementById('server-list-view').classList.add('hidden');    
    document.getElementById('apps-view').classList.add('hidden');    
    document.getElementById('howto-view').classList.add('hidden');    
    document.getElementById('notifications-view').classList.add('hidden');    
    document.getElementById('main-menu').classList.remove('hidden');    
    showMainHeaderElements();    
    scrollToTop();    
}    

function showServers(category) {    
    const list = allServers.filter(s => s.category === category);    
    document.getElementById('main-menu').classList.add('hidden');    
    document.getElementById('server-list-view').classList.remove('hidden');    
    document.getElementById('server-category-title').textContent = categoryTitles[category] || category;    
    renderServerList(list);    
    hideMainHeaderElements();    
    scrollToTop();    
}    

function showApps() {    
    document.getElementById('main-menu').classList.add('hidden');    
    document.getElementById('apps-view').classList.remove('hidden');    
    hideMainHeaderElements();    
    scrollToTop();    
}    

function showHowToUse() {    
    document.getElementById('main-menu').classList.add('hidden');    
    document.getElementById('howto-view').classList.remove('hidden');    
    hideMainHeaderElements();    
    scrollToTop();    
}    

function showNotifications() {    
    document.getElementById('main-menu').classList.add('hidden');    
    document.getElementById('notifications-view').classList.remove('hidden');    

    notifications.forEach((n, i) => {    
        const id = n.id || `${n.title}-${n.date}-${i}`;    
        if (!readNotifications.includes(id)) readNotifications.push(id);    
    });    

    localStorage.setItem("readNotifications", JSON.stringify(readNotifications));    
    renderNotifications();    
    updateNotificationBadge();    
    hideMainHeaderElements();    
    scrollToTop();    
}    

// ================== NOTIFICATION BADGE ==================    
function updateNotificationBadge() {    
    const unreadCount = notifications.filter((n, i) => {    
        const id = n.id || `${n.title}-${n.date}-${i}`;    
        return !readNotifications.includes(id);    
    }).length;    

    const badge = document.getElementById('notification-badge');    
    if (badge) {    
        if (unreadCount > 0) {    
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount;    
            badge.classList.remove('hidden');    
        } else {    
            badge.classList.add('hidden');    
        }    
    }    
}    

// ================== SUBSCRIPTION URL GENERATION ==================
function normalizeUserCode(x) {
  let s = String(x || '').trim();
  if (s.startsWith('@')) s = s.slice(1);
  s = s.toUpperCase();
  s = s.replace(/\s+/g, '');
  return s;
}

function getActiveUserInfo() {
  let code = currentUser?.code || '';
  let expiry_date = currentUser?.expiry || currentUser?.expiry_date || '';

  if (!code) {
    try {
      const auto = JSON.parse(localStorage.getItem('autoLoginData') || 'null');
      if (auto?.code) {
        code = auto.code;
        expiry_date = auto.expiry || auto.expiry_date || expiry_date;
      }
    } catch {}
  }

  code = normalizeUserCode(code);

  if (code && Array.isArray(validCodes)) {
    const found = validCodes.find(v => normalizeUserCode(v.code) === code);
    if (found?.expiry_date) expiry_date = found.expiry_date;
  }

  return { code, expiry_date };
}

function buildSubscriptionUrl(categoryKey) {
  const { code, expiry_date } = getActiveUserInfo();
  if (!code || !categoryKey) return '';

  const u = new URL(`${WORKER_URL}/subscription/${encodeURIComponent(categoryKey)}`);
  u.searchParams.set('code', code);
  if (expiry_date) u.searchParams.set('expiry', expiry_date);
  return u.toString();
}

async function copySubscriptionUrl(categoryKey) {
  const url = buildSubscriptionUrl(categoryKey);
  if (!url) {
    showToast('មិនមាន Subscription URL');
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    showToast('បានចម្លង Subscription URL');
  } catch (e) {
    console.error(e);
    showToast('ចម្លងមិនបាន');
  }
}

// ================== RENDER MAIN MENU ==================
function renderMainMenu() {
    const container = document.getElementById('main-menu');
    if (!container) return;

    container.innerHTML = '';

    const categoryTotals = {};
    const categoryServers = {};
    const categoryApps = {};
    const activeCounts = {};

    allServers.forEach(item => {
        const cat = item.category;
        if (!cat) return;

        categoryTotals[cat] = (categoryTotals[cat] || 0) + 1;

        if (item.type === "server") {
            categoryServers[cat] = (categoryServers[cat] || 0) + 1;
        } else if (item.type === "app") {
            categoryApps[cat] = (categoryApps[cat] || 0) + 1;
        }
    });

    // ---------------------------
    // ICON SUPPORT:
    // - mainMenuItems.icon can be URL (image) OR FontAwesome class
    // - legacy mainMenuItems.iconUrl is still supported
    // ---------------------------
    function isLikelyUrl(s) {
        s = String(s || '').trim();
        return /^https?:\/\//i.test(s) || /^data:image\//i.test(s);
    }

    mainMenuItems.forEach((item, index) => {
        const delay = (index * 0.05) + 0.05;

        const card = document.createElement('div');
        card.className = `card-item card-bg rounded-2xl px-4 py-3.5 flex items-center justify-between card-hover cursor-pointer`;
        card.style.animationDelay = `${delay}s`;

        let countHTML = '';
        let categoryKey = null;

        if (item.onclick && item.onclick.startsWith("showServers(")) {
            const match = item.onclick.match(/showServers\(['"]([^'"]+)['"]\)/);
            if (match) {
                categoryKey = match[1];

                const total = categoryTotals[categoryKey] || 0;
                const servers = categoryServers[categoryKey] || 0;
                const apps = categoryApps[categoryKey] || 0;

                let subtitle = `${total} items`;

                if (servers > 0 && apps > 0) {
                    subtitle = `${servers} servers • ${apps} apps`;
                } else if (servers > 0 && apps === 0) {
                    subtitle = `${servers} servers • <span class="text-emerald-400" id="active-${categoryKey}">0</span> active`;
                } else if (servers === 0 && apps > 0) {
                    subtitle = `${apps} apps`;
                }

                countHTML = `
                    <p class="text-xs text-gray-500 mt-0.5" id="count-${categoryKey}">
                        ${subtitle}
                    </p>
                `;
            }
        }

        card.addEventListener('click', (e) => {
            if (e.target.closest('.sub-btn')) return;

            const action = item.onclick;
            if (!action) return;

            try {
                if (action.startsWith("showServers(")) {
                    const match = action.match(/showServers\(['"]([^'"]+)['"]\)/);
                    if (match && match[1]) {
                        showServers(match[1]);
                        return;
                    }
                }

                const funcName = action.replace("()", "").trim();
                if (typeof window[funcName] === 'function') {
                    window[funcName]();
                    return;
                }

                console.warn('Unknown menu action:', action);
            } catch (err) {
                console.error('Error executing menu action:', action, err);
            }
        });

        const isNotif = item.id === 'notifications';
        const badgeHTML = isNotif
            ? `
                <span id="notification-badge"
                      class="notification-badge hidden">
                    0
                </span>
              `
            : '';

        // ---------- ICON RENDER (UPDATED) ----------
        // Priority:
        // 1) item.icon is URL => image
        // 2) item.iconUrl (legacy) => image
        // 3) item.icon is FontAwesome class => <i>
        const iconValue = (item.icon ?? '').toString().trim();
        const iconUrl = isLikelyUrl(iconValue)
            ? iconValue
            : (item.iconUrl ? String(item.iconUrl).trim() : '');

        let iconHTML = '';
        if (iconUrl) {
            iconHTML = `
                <div class="menu-icon-wrap overflow-hidden relative" style="background:linear-gradient(135deg,#2a2150,#1a1630);">
                    <img
                        src="${iconUrl}"
                        alt="${item.title}"
                        class="w-full h-full object-cover"
                        style="border-radius:14px;"
                        loading="lazy"
                        onerror="this.style.display='none';"
                    >
                    ${badgeHTML}
                </div>
            `;
        } else {
            const faClass = iconValue || 'fas fa-circle';
            const bg = item.iconBg || 'bg-purple-600/20';
            const col = item.iconColor || 'text-purple-400';
            iconHTML = `
                <div class="menu-icon-wrap ${bg} relative shadow-lg" style="box-shadow:0 4px 14px rgba(109,40,217,0.25);">
                    <i class="${faClass} text-2xl ${col}"></i>
                    ${badgeHTML}
                </div>
            `;
        }
        // ---------- END ICON RENDER ----------

        const serversCount = categoryKey ? (categoryServers[categoryKey] || 0) : 0;
        const showSubBtn = !!categoryKey && serversCount > 0;

        card.innerHTML = `
            <div class="flex items-center space-x-3.5">
                ${iconHTML}
                <div class="min-w-0">
                    <h2 class="text-[15px] font-semibold text-white leading-tight">${item.title}</h2>
                    ${countHTML}
                </div>
            </div>

            <div class="flex items-center space-x-2.5">
                ${showSubBtn ? `
                  <button
                    type="button"
                    class="sub-btn"
                    data-cat="${categoryKey}">
                    SUB
                  </button>
                ` : ''}
                <i class="fas fa-chevron-right text-sm chevron-hover"></i>
            </div>
        `;

        if (showSubBtn) {
            const btn = card.querySelector('.sub-btn');
            btn?.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await copySubscriptionUrl(categoryKey);
            });
        }

        container.appendChild(card);

        if (categoryKey && categoryServers[categoryKey] > 0) {
            const serversInCat = allServers.filter(s =>
                s.category === categoryKey &&
                s.type === "server" &&
                s.ip &&
                s.ip.trim() !== ''
            );

            if (serversInCat.length > 0) {
                let completed = 0;
                const totalToPing = serversInCat.length;

                serversInCat.forEach(server => {
                    measurePingWebRTC(server.ip).then(ms => {
                        if (ms !== null) {
                            activeCounts[categoryKey] = (activeCounts[categoryKey] || 0) + 1;
                        }
                        completed++;
                        if (completed === totalToPing) {
                            const countEl = document.getElementById(`count-${categoryKey}`);
                            if (countEl) {
                                const apps = categoryApps[categoryKey] || 0;
                                let html = `${categoryServers[categoryKey]} servers`;
                                if (apps > 0) html += ` • ${apps} apps`;
                                html += ` • <span class="text-emerald-400">${activeCounts[categoryKey] || 0}</span> active`;
                                countEl.innerHTML = html;
                            }
                        }
                    });
                });
            }
        }
    });

    updateNotificationBadge();
}
    
// ================== RENDER NOTIFICATIONS ==================    
function renderNotifications() {    
    const container = document.getElementById("notifications-container");    
    const empty = document.getElementById("no-notifications");    

    if (!container || !empty) return;    

    container.innerHTML = "";    

    if (!notifications.length) {    
        empty.classList.remove("hidden");    
        return;    
    }    

    empty.classList.add("hidden");    

    notifications.forEach((n, i) => {    
        const id = n.id || `${n.title}-${n.date}-${i}`;    
        const unread = !readNotifications.includes(id);    

        const card = document.createElement("div");    
        card.className = "card-bg rounded-2xl p-5";    

        card.innerHTML = `    
            <div class="flex justify-between items-start">    
                <div>    
                    <p class="text-gray-400 text-sm mb-1">${n.date} • ${n.time || ''}</p>    
                    <h3 class="font-semibold text-purple-300 mb-2">${n.title}</h3>    
                    <p class="text-gray-300">${n.message}</p>    
                </div>    
                ${unread ? `<span class="bg-red-600 text-white text-xs px-2 py-1 rounded-full">NEW</span>` : ""}    
            </div>    
        `;    
        container.appendChild(card);    
    });    
}    

// ================== RENDER SERVER / APP LIST ==================    
async function renderServerList(list) {    
    const container = document.getElementById('servers-container');    
    if (!container) return;    

    container.innerHTML = '';    

    if (list.length === 0) {    
        container.innerHTML = '<p class="text-center text-gray-500 py-8">មិនមាន server ឬកម្មវិធី</p>';    
        return;    
    }    

    const modal = document.getElementById('image-modal');    
    const modalImg = document.getElementById('modal-img');    
    const modalClose = document.getElementById('modal-close');    

    if (modalClose) {    
        modalClose.onclick = () => modal.classList.add('hidden');    
    }    

    function showModal(src) {    
        if (modalImg) {    
            modalImg.src = src;    
            modal.classList.remove('hidden');    
        }    
    }    

    for (const item of list) {    
        const isApp = item.type === "app";    
        const div = document.createElement('div');    
        div.className = 'card-bg rounded-2xl p-5 mb-5 overflow-hidden shadow-md';    

        let iconHTML = item.icon?.startsWith('http')    
            ? `<img src="${item.icon}" alt="${item.title}" class="w-full h-full object-cover rounded-xl">`    
            : `<i class="fas ${item.icon || 'fa-mobile-alt'} text-3xl text-gray-400"></i>`;    

        if (isApp) {    
            let screenshotsHTML = '';    
            if (item.screenshots && item.screenshots.length > 0) {    
                screenshotsHTML = `    
                    <div class="mt-4 overflow-x-auto pb-3">    
                        <div class="flex gap-1 snap-x snap-mandatory">    
                            ${item.screenshots.map(src => `    
                                <div class="flex-shrink-0 snap-center cursor-pointer">    
                                    <img src="${src}"    
                                         onerror="this.src='https://via.placeholder.com/200x400?text=Image+Not+Found';"    
                                         class="w-28 h-52 object-contain rounded-xl shadow-sm border border-gray-700"    
                                         alt="${item.title} screenshot"    
                                         loading="lazy"    
                                         onclick="showModal('${src}')">    
                                </div>    
                            `).join('')}    
                        </div>    
                    </div>    
                `;    
            }    

            div.innerHTML = `    
                <div class="flex items-center space-x-4 mb-3">    
                    <div class="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-gray-800 shadow">    
                        ${iconHTML}    
                    </div>    
                    <div class="flex-1">    
                        <h3 class="text-base font-semibold text-purple-300 leading-tight">    
                            ${item.title}    
                        </h3>    
                    </div>    
                </div>    

                ${screenshotsHTML}    

                <a href="${item.url}" target="_blank" rel="noopener noreferrer"    
                   class="mt-4 inline-flex w-full items-center justify-center gap-2    
                          bg-purple-600 hover:bg-purple-700    
                          text-white py-2.5 rounded-lg text-sm font-medium transition shadow">    
                    <i class="fas fa-download text-sm"></i>    
                    <span>${item.buttonText || 'ទាញយក'}</span>    
                </a>    
            `;    
        } else {    
            let configText = await replacePlaceholdersInConfig(item.text || '', item);    

            const shortText = configText.length > 50     
                ? configText.substring(0, 50) + '...'     
                : configText;    

            const serverIP = item.ip || null;    

            const scrollingTitle = item.title.length > 20 ? `    
                <div class="scroll-container">    
                    <div class="server-title-scroll" title="${item.title}">    
                        <span class="scroll-content">    
                            ${item.title}&nbsp;&nbsp;&nbsp;•&nbsp;&nbsp;&nbsp;${item.title}    
                        </span>    
                    </div>    
                </div>    
            ` : `<h3 class="text-sm font-semibold text-white">${item.title}</h3>`;    

            div.innerHTML = `    
                <div class="server-card">    
                    <div class="server-info">    
                        <div class="flex items-center space-x-4">    
                            <div class="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 server-icon-img" style="background:#1a1630;">    
                                ${iconHTML}    
                            </div>    
                            <div class="flex-1 min-w-0">    
                                <div class="flex items-center gap-1.5 mb-0.5">
                                  <span style="width:6px;height:6px;border-radius:50%;background:#a78bfa;display:inline-block;flex-shrink:0;"></span>
                                  ${scrollingTitle}
                                </div>
                                <p class="text-xs text-gray-500 truncate-text" title="${configText}">${shortText}</p>    
                            </div>    
                        </div>    
                    </div>    

                    <div class="server-actions">    
                        <span class="ping-result text-xs font-semibold text-emerald-400" data-ip="${serverIP || ''}">...</span>    
                        <button onclick="copyText('${configText.replace(/'/g, "\\'")}')"    
                                class="text-white flex items-center gap-1.5 transition font-medium text-xs">    
                            <i class="fas fa-copy"></i>    
                            <span>ចម្លង</span>    
                        </button>    
                    </div>    
                </div>    
            `;    

            if (serverIP) {    
                const pingElement = div.querySelector('.ping-result');    
                if (pingElement) autoPingServer(serverIP, pingElement);    
            } else {    
                const pingElement = div.querySelector('.ping-result');    
                if (pingElement) {    
                    pingElement.textContent = 'N/A';    
                    pingElement.className = 'text-sm text-red-400 font-medium';    
                }    
            }    
        }    

        container.appendChild(div);    
    }    
}    

// ================== SEARCH FUNCTIONALITY ==================    
document.getElementById('search-input')?.addEventListener('input', e => {    
    const query = e.target.value.trim().toLowerCase();    

    if (!query) {    
        backToMain();    
        return;    
    }    

    document.getElementById('main-menu').classList.add('hidden');    
    document.getElementById('server-list-view').classList.remove('hidden');    
    document.getElementById('server-category-title').textContent = 'លទ្ធផលស្វែងរក';    

    const results = allServers.filter(s =>    
        s.title.toLowerCase().includes(query) ||     
        (s.text && s.text.toLowerCase().includes(query))    
    );    

    renderServerList(results);    
    hideMainHeaderElements();    
    scrollToTop();    
});    

function showToast(message = 'បានចម្លង') {
    const toast = document.createElement('div');
    toast.textContent = message;

    toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        background-color: #16a34a;
        color: #ffffff;
        padding: 10px 20px;
        border-radius: 999px;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 6px 20px rgba(0,0,0,.25);
        z-index: 9999;
        opacity: 0;
        transition: opacity .25s ease, transform .25s ease;
    `;

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(-6px)';
    });

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%)';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}
    
// ================== COPY UTILITY ==================    
function copyText(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('បានចម្លង config រួចរាល់');
    }).catch(err => {
        console.error('Failed to copy:', err);
        showToast('ចម្លងមិនបាន');
    });
}

// ================== APP INITIALIZATION ==================    
document.addEventListener('DOMContentLoaded', () => {    
    // logout via avatar onclick in HTML    
    loadData();    

    document.addEventListener('visibilitychange', () => {    
        if (document.visibilityState === 'visible') {    
            attemptAutoLogin();    
        }    
    });    
});    

function initApp() {    
    console.log("AnajakVPN client initialized - with fixed subdomain support");    
}
// ================== SPEED TEST ==================
(function initSpeedTest() {
  const ARC_LEN = 251.3;
  const MAX_SPEED = 100;
  const PING_URL = "https://www.cloudflare.com/cdn-cgi/trace";
  const DL_URLS = [
    "https://speed.cloudflare.com/__down?bytes=25000000",
    "https://speed.cloudflare.com/__down?bytes=10000000",
    "https://speed.cloudflare.com/__down?bytes=5000000"
  ];
  const UL_URL = "https://speed.cloudflare.com/__up";

  let stGeoInfo = null;
  let stAbort = null;
  let stTesting = false;
  let liveChart = null;
  let dlChart = null;
  let ulChart = null;
  let chartsReady = false;

  function $(id) { return document.getElementById(id); }

  function createChart(canvas, color) {
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    const data = [];
    const maxPoints = 40;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      if (rect.width < 1) return;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    return {
      push: function (v) {
        data.push(v);
        if (data.length > maxPoints) data.shift();
        this.draw();
      },
      clear: function () {
        data.length = 0;
        this.draw();
      },
      draw: function () {
        const parent = canvas.parentElement;
        if (!parent) return;
        const w = parent.clientWidth;
        const h = parent.clientHeight;
        if (w < 1 || h < 1) return;
        resize();
        ctx.clearRect(0, 0, w, h);
        if (data.length < 2) return;
        const max = Math.max.apply(null, data.concat([1]));
        const range = max || 1;

        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        data.forEach(function (v, i) {
          const x = (i / (maxPoints - 1)) * w;
          const y = h - (v / range) * (h - 4) - 2;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();

        const lastX = ((data.length - 1) / (maxPoints - 1)) * w;
        ctx.lineTo(lastX, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, color + "40");
        grad.addColorStop(1, color + "00");
        ctx.fillStyle = grad;
        ctx.fill();
      },
      resize: resize
    };
  }

  function ensureCharts() {
    if (chartsReady) return;
    liveChart = createChart($("st-liveChart"), "#a855f7");
    dlChart = createChart($("st-dlChart"), "#c084fc");
    ulChart = createChart($("st-ulChart"), "#a78bfa");
    chartsReady = true;
  }

  function setGauge(speedMbps, isDownload) {
    if (isDownload === undefined) isDownload = true;
    const progress = $("st-gaugeProgress");
    const needle = $("st-needleGroup");
    const valueEl = $("st-gaugeValue");
    const unitEl = $("st-gaugeUnit");
    if (!progress || !needle || !valueEl || !unitEl) return;

    const t = Math.min(Math.max(speedMbps / MAX_SPEED, 0), 1);
    progress.style.strokeDashoffset = String(ARC_LEN * (1 - t));
    const angle = -90 + t * 180;
    needle.style.transform = "rotate(" + angle + "deg)";
    needle.style.transformOrigin = "100px 110px";
    valueEl.textContent = speedMbps.toFixed(2);
    unitEl.innerHTML = isDownload
      ? '<i class="fas fa-arrow-down" aria-hidden="true"></i> Mbps'
      : '<i class="fas fa-arrow-up" aria-hidden="true"></i> Mbps';
  }

  function setPhase(text, icon) {
    const el = $("st-phaseText");
    if (!el) return;
    if (text) {
      el.innerHTML = (icon ? '<i class="fas ' + icon + '" aria-hidden="true"></i> ' : "") + text;
      el.classList.add("visible");
    } else {
      el.classList.remove("visible");
      el.innerHTML = "";
    }
  }

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  function guessNetworkType() {
    const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!c) return "Wi-Fi";
    const t = (c.type || "").toLowerCase();
    const e = (c.effectiveType || "").toLowerCase();
    if (t === "cellular" || e === "2g" || e === "3g" || e === "4g") return "Mobile Data";
    if (t === "wifi") return "Wi-Fi";
    if (t === "ethernet") return "Ethernet";
    if (e === "4g") return "Mobile Data";
    return "Wi-Fi";
  }

  async function fetchGeoInfo() {
    const apis = [
      {
        url: "https://ipapi.co/json/",
        parse: function (d) {
          return {
            ip: d.ip,
            city: d.city,
            region: d.region,
            country: d.country_name,
            countryCode: d.country_code,
            isp: (d.org || d.asn || "").replace(/^AS\d+\s*/i, ""),
            networkType: guessNetworkType()
          };
        }
      },
      {
        url: "https://ip-api.com/json/?fields=status,country,countryCode,regionName,city,isp,org,query,as",
        parse: function (d) {
          return {
            ip: d.query,
            city: d.city,
            region: d.regionName,
            country: d.country,
            countryCode: d.countryCode,
            isp: (d.isp || d.org || "").replace(/^AS\d+\s*/i, ""),
            networkType: guessNetworkType()
          };
        }
      },
      {
        url: "https://ipinfo.io/json",
        parse: function (d) {
          return {
            ip: d.ip,
            city: d.city,
            region: d.region,
            country: d.country,
            countryCode: d.country,
            isp: (d.org || "").replace(/^AS\d+\s*/i, ""),
            networkType: guessNetworkType()
          };
        }
      }
    ];

    for (let i = 0; i < apis.length; i++) {
      try {
        const res = await fetch(apis[i].url, { cache: "no-store" });
        if (!res.ok) continue;
        const data = await res.json();
        const info = apis[i].parse(data);
        if (info.ip) return info;
      } catch (_) {}
    }

    try {
      const res = await fetch(PING_URL + "?_=" + Date.now(), { cache: "no-store" });
      const text = await res.text();
      const ip = (text.match(/ip=([^\n]+)/) || [])[1];
      const loc = (text.match(/loc=([^\n]+)/) || [])[1];
      const colo = (text.match(/colo=([^\n]+)/) || [])[1];
      return {
        ip: ip || "—",
        city: colo || "",
        region: "",
        country: loc || "—",
        countryCode: loc || "",
        isp: "Cloudflare",
        networkType: guessNetworkType()
      };
    } catch (_) {
      return null;
    }
  }

  function applyGeoInfo(info) {
    const ispVal = $("st-ispVal");
    const networkVal = $("st-networkVal");
    const ipVal = $("st-ipVal");
    const countryVal = $("st-countryVal");
    const serverVal = $("st-serverVal");

    if (!info) {
      if (ispVal) ispVal.textContent = "Unknown";
      if (networkVal) networkVal.textContent = guessNetworkType();
      if (ipVal) ipVal.textContent = "—";
      if (countryVal) countryVal.textContent = "—";
      if (serverVal) serverVal.textContent = "Auto";
      return;
    }
    stGeoInfo = info;
    if (ispVal) ispVal.textContent = info.isp ? info.isp.slice(0, 28) : "Unknown";
    if (networkVal) networkVal.textContent = info.networkType || "Wi-Fi";
    if (ipVal) ipVal.textContent = info.ip || "—";
    if (countryVal) countryVal.textContent = info.country || "—";
    if (serverVal) {
      serverVal.textContent = info.city || info.countryCode || "Auto";
      serverVal.title = [info.city, info.region, info.country].filter(Boolean).join(", ");
    }

    ["st-netIsp", "st-netNetwork", "st-netIp", "st-netCountry"].forEach(function (id, i) {
      setTimeout(function () {
        const el = $(id);
        if (el) el.classList.add("visible");
      }, 80 + i * 60);
    });
  }

  async function loadNetworkInfo() {
    const ispVal = $("st-ispVal");
    const networkVal = $("st-networkVal");
    const ipVal = $("st-ipVal");
    const countryVal = $("st-countryVal");
    const serverVal = $("st-serverVal");
    if (ispVal) ispVal.textContent = "…";
    if (networkVal) networkVal.textContent = "…";
    if (ipVal) ipVal.textContent = "…";
    if (countryVal) countryVal.textContent = "…";
    if (serverVal) serverVal.textContent = "…";

    const info = await fetchGeoInfo();
    applyGeoInfo(info);
  }

  async function measurePing(samples) {
    samples = samples || 6;
    const times = [];
    for (let i = 0; i < samples; i++) {
      if (stAbort && stAbort.signal.aborted) throw new Error("aborted");
      const t0 = performance.now();
      try {
        await fetch(PING_URL + "?_=" + Date.now(), {
          cache: "no-store",
          mode: "cors",
          signal: stAbort.signal
        });
        times.push(performance.now() - t0);
      } catch (e) {
        if (e.name === "AbortError") throw e;
        times.push(performance.now() - t0);
      }
      await sleep(70);
    }
    const avg = times.reduce(function (a, b) { return a + b; }, 0) / times.length;
    let jitterSum = 0;
    for (let i = 1; i < times.length; i++) {
      jitterSum += Math.abs(times[i] - times[i - 1]);
    }
    const jitter = times.length > 1 ? jitterSum / (times.length - 1) : 0;
    return { ping: Math.round(avg), jitter: Math.round(jitter) };
  }

  async function measureDownload(durationMs) {
    durationMs = durationMs || 8500;
    const start = performance.now();
    let totalBytes = 0;
    let lastReport = start;
    const streams = 3;
    const workers = [];

    for (let s = 0; s < streams; s++) {
      workers.push((async function () {
        while (performance.now() - start < durationMs) {
          if (stAbort && stAbort.signal.aborted) return;
          const url = DL_URLS[s % DL_URLS.length] + "&r=" + Math.random();
          try {
            const res = await fetch(url, {
              cache: "no-store",
              signal: stAbort.signal
            });
            if (!res.ok || !res.body) continue;
            const reader = res.body.getReader();
            while (true) {
              if (performance.now() - start >= durationMs) {
                reader.cancel().catch(function () {});
                return;
              }
              const result = await reader.read();
              if (result.done) break;
              totalBytes += result.value.length;
              const now = performance.now();
              if (now - lastReport > 100) {
                const elapsed = (now - start) / 1000;
                const mbps = (totalBytes * 8) / (elapsed * 1e6);
                setGauge(mbps, true);
                const dlVal = $("st-dlValue");
                if (dlVal) dlVal.textContent = mbps.toFixed(2);
                if (liveChart) liveChart.push(mbps);
                if (dlChart) dlChart.push(mbps);
                lastReport = now;
              }
            }
          } catch (e) {
            if (e.name === "AbortError") return;
          }
        }
      })());
    }

    await Promise.all(workers);
    const elapsed = Math.max((performance.now() - start) / 1000, 0.001);
    return { avg: (totalBytes * 8) / (elapsed * 1e6) };
  }

  async function measureUpload(durationMs) {
    durationMs = durationMs || 6500;
    const start = performance.now();
    let totalBytes = 0;
    let lastReport = start;
    const chunkSize = 256 * 1024;
    const blob = new Blob([new Uint8Array(chunkSize)]);

    while (performance.now() - start < durationMs) {
      if (stAbort && stAbort.signal.aborted) break;
      try {
        await fetch(UL_URL, {
          method: "POST",
          body: blob,
          cache: "no-store",
          mode: "cors",
          signal: stAbort.signal
        });
        totalBytes += chunkSize;
        const now = performance.now();
        if (now - lastReport > 130) {
          const elapsed = (now - start) / 1000;
          const mbps = (totalBytes * 8) / (elapsed * 1e6);
          setGauge(mbps, false);
          const ulVal = $("st-ulValue");
          if (ulVal) ulVal.textContent = mbps.toFixed(2);
          if (liveChart) liveChart.push(mbps);
          if (ulChart) ulChart.push(mbps);
          lastReport = now;
        }
      } catch (e) {
        if (e.name === "AbortError") break;
        break;
      }
    }

    const elapsed = Math.max((performance.now() - start) / 1000, 0.001);
    return { avg: (totalBytes * 8) / (elapsed * 1e6) };
  }

  async function runSpeedTest() {
    if (stTesting) return;
    stTesting = true;
    stAbort = new AbortController();

    const startBtn = $("st-startBtn");
    const gaugeProgress = $("st-gaugeProgress");
    if (!startBtn) { stTesting = false; return; }

    startBtn.classList.add("testing");
    startBtn.classList.remove("done");
    const btnText = startBtn.querySelector(".st-btn-text");
    if (btnText) btnText.textContent = "Testing...";
    startBtn.disabled = true;
    if (gaugeProgress) gaugeProgress.classList.add("testing");

    setGauge(0, true);
    const dlValue = $("st-dlValue");
    const ulValue = $("st-ulValue");
    const pingVal = $("st-pingVal");
    const jitterVal = $("st-jitterVal");
    if (dlValue) dlValue.textContent = "0.00";
    if (ulValue) ulValue.textContent = "0.00";
    if (pingVal) pingVal.textContent = "—";
    if (jitterVal) jitterVal.textContent = "—";
    if (liveChart) liveChart.clear();
    if (dlChart) dlChart.clear();
    if (ulChart) ulChart.clear();

    if (!stGeoInfo) {
      setPhase("Finding server…", "fa-server");
      await loadNetworkInfo();
    }

    try {
      setPhase("Measuring latency…", "fa-satellite-dish");
      const latency = await measurePing();
      if (pingVal) pingVal.textContent = latency.ping + " ms";
      if (jitterVal) jitterVal.textContent = latency.jitter + " ms";

      setPhase("Testing download…", "fa-download");
      const dl = await measureDownload(9000);
      if (dlValue) dlValue.textContent = dl.avg.toFixed(2);
      setGauge(dl.avg, true);

      await sleep(300);

      setPhase("Testing upload…", "fa-upload");
      if (liveChart) liveChart.clear();
      const ul = await measureUpload(7000);
      if (ulValue) ulValue.textContent = ul.avg.toFixed(2);
      setGauge(ul.avg, false);

      setPhase("Test complete", "fa-circle-check");
      if (btnText) btnText.textContent = "Test Again";
      startBtn.classList.add("done");
    } catch (e) {
      if (e.name !== "AbortError" && e.message !== "aborted") {
        setPhase("Test failed – check connection", "fa-triangle-exclamation");
        console.error(e);
      }
      if (btnText) btnText.textContent = "Start Speed Test";
    } finally {
      stTesting = false;
      startBtn.classList.remove("testing");
      startBtn.disabled = false;
      if (gaugeProgress) gaugeProgress.classList.remove("testing");
      setTimeout(function () { setPhase(""); }, 2800);
    }
  }

  window.openSpeedTest = function openSpeedTest() {
    const overlay = $("speed-test-overlay");
    if (!overlay) return;
    overlay.classList.add("show");
    document.body.style.overflow = "hidden";
    ensureCharts();
    setGauge(0, true);
    const dlCard = $("st-dlCard");
    const ulCard = $("st-ulCard");
    if (dlCard) dlCard.classList.add("visible");
    if (ulCard) ulCard.classList.add("visible");
    if (!stGeoInfo) loadNetworkInfo();
  };

  window.closeSpeedTest = function closeSpeedTest() {
    const overlay = $("speed-test-overlay");
    if (!overlay) return;
    overlay.classList.remove("show");
    document.body.style.overflow = "";
    if (stAbort) stAbort.abort();
  };

  document.addEventListener("DOMContentLoaded", function () {
    const startBtn = $("st-startBtn");
    if (startBtn) startBtn.addEventListener("click", runSpeedTest);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        const overlay = $("speed-test-overlay");
        if (overlay && overlay.classList.contains("show")) closeSpeedTest();
      }
    });
  });
})();
