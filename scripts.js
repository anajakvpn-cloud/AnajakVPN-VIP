// scripts.js - AnajakVPN Client Frontend    
// Last major update: January 2026    
// Updated: July 2026 - Data source switched to lingering-mountain JSON endpoint
const WORKER_URL = "https://anajakvpnvip.panda-hshark.workers.dev";
const DATA_JSON_URL = "https://lingering-mountain-1d24.panda-hshark.workers.dev/json";
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

// ================== LAST UPDATE DATE ==================
// GitLab commit endpoints removed — use Last-Modified header from data source, or now
async function fetchJsonLastModified() {
    try {
        const res = await fetch(DATA_JSON_URL, { method: 'HEAD', cache: 'no-cache' });
        if (!res.ok) return null;
        const lm = res.headers.get('Last-Modified') || res.headers.get('Date');
        return lm ? new Date(lm) : null;
    } catch (err) {
        console.warn("Could not fetch last modified date:", err);
        return null;
    }
}

async function updateLastUpdateDate() {
    const lastModified = await fetchJsonLastModified();
    const span = document.querySelector('#last-update span');
    if (!span) return;

    const date = lastModified || new Date();
    span.textContent = date.toLocaleDateString('km-KH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}    

// ================== HEADER VISIBILITY HELPERS ==================    
function hideMainHeaderElements() {    
    const container = document.querySelector('#app-content .container');    
    if (!container) return;    

    document.getElementById('server-stats')?.classList.add('hidden');    
    container.querySelector('.card-bg.rounded-xl.p-4.mb-6')?.classList.add('hidden');    
    container.querySelector('.text-center.mb-8')?.classList.add('hidden');    
}    

function showMainHeaderElements() {    
    const container = document.querySelector('#app-content .container');    
    if (!container) return;    

    document.getElementById('server-stats')?.classList.remove('hidden');    
    container.querySelector('.card-bg.rounded-xl.p-4.mb-6')?.classList.remove('hidden');    
    container.querySelector('.text-center.mb-8')?.classList.remove('hidden');    
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
// Build subdomain map locally (must match worker cleanCodeForSubdomain: lowercase alnum)
function cleanCodeForSubdomain(code) {
  return String(code || '').trim().replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function yyyymmddFromYmd(ymd) {
  return String(ymd || '').trim().replace(/-/g, '').slice(0, 8);
}

function buildSubdomainForCountry(country, code, expiry_date) {
  const cc = String(country || 'kh').trim().toLowerCase();
  const clean = cleanCodeForSubdomain(code);
  const yyyymmdd = yyyymmddFromYmd(expiry_date);
  if (!cc || !clean || !yyyymmdd) return '';
  return `${cc}${clean}${yyyymmdd}.${MAIN_DOMAIN}`;
}

function buildSubdomainMap(code, expiry_date) {
  if (!code || !expiry_date) return {};

  const map = {};
  const countries = [...new Set(
    (allServers || []).map(s =>
      String(s.countrycode || s.country || 'kh').trim().toLowerCase()
    ).filter(Boolean)
  )];

  // Always include default
  if (!countries.includes('kh')) countries.push('kh');

  countries.forEach(cc => {
    const domain = buildSubdomainForCountry(cc, code, expiry_date);
    if (domain) map[cc] = domain;
  });

  subdomainMap = map;
  try {
    localStorage.setItem('subdomainMap', JSON.stringify(subdomainMap));
  } catch (e) {
    console.warn('Failed to persist subdomainMap', e);
  }
  console.log('[SubdomainMap] built', Object.keys(map).length, 'entries', map);
  return map;
}

async function prewarmUserSubdomains(code, expiry_date) {
  if (!code || !expiry_date) return false;

  // Always build local map first so copy works even if DNS API fails
  buildSubdomainMap(code, expiry_date);

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
      // Local map already built — still usable for config copy
      return Object.keys(subdomainMap).length > 0;
    }

    const data = await res.json();
    console.log('Prewarm result:', data);

    if (data.success && Array.isArray(data.domains) && data.domains.length) {
      data.domains.forEach(fullDomain => {
        const part = String(fullDomain || '').split('.')[0] || '';
        const cc = part.slice(0, 2).toLowerCase();
        if (cc.length === 2) {
          subdomainMap[cc] = fullDomain;
        }
      });
      localStorage.setItem('subdomainMap', JSON.stringify(subdomainMap));
    }

    return data.success === true || Object.keys(subdomainMap).length > 0;
  } catch (err) {
    console.error('Prewarm error:', err);
    // Local map still available
    return Object.keys(subdomainMap).length > 0;
  }
}

// ================== UTILITIES ==================    
function scrollToTop() {    
    window.scrollTo({ top: 0, behavior: 'smooth' });    
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
        element.className = 'text-xs text-green-400 font-medium';    
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
    modal.classList.remove('hidden');    
    
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
    document.getElementById('ip-modal').classList.add('hidden');    
}    

// ================== CONFIG PLACEHOLDER REPLACEMENT (FIXED) ==================    
async function replacePlaceholdersInConfig(text, serverItem) {
    let config = text;

    config = config.replace(/r+andom-domain|andom-domain+|(random-domain)+/gi, 'random-domain');

    const hasRandomDomain = /random-domain/gi.test(config);
    if (!hasRandomDomain) return config;

    const country = String(serverItem.countrycode || serverItem.country || 'kh')
        .trim()
        .toLowerCase();

    let replacement = subdomainMap[country] || '';

    // Generate on the fly from current user if map missing this country
    if (!replacement && currentUser?.code && currentUser?.expiry) {
        replacement = buildSubdomainForCountry(country, currentUser.code, currentUser.expiry);
        if (replacement) {
            subdomainMap[country] = replacement;
            try { localStorage.setItem('subdomainMap', JSON.stringify(subdomainMap)); } catch {}
        }
    }

    // Last resort: IP (old behaviour)
    if (!replacement) {
        replacement = serverItem.ip || '';
        console.warn(`[No subdomain] ${country} → falling back to IP: ${replacement}`);
    } else {
        console.log(`[Subdomain used] ${country} → ${replacement}`);
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
        // Prefer direct JSON endpoint; fall back to worker /data proxy
        let res;
        try {
            res = await fetch(DATA_JSON_URL, { cache: "no-cache" });
            if (!res.ok) throw new Error(`Direct JSON HTTP ${res.status}`);
        } catch (directErr) {
            console.warn("Direct JSON fetch failed, falling back to worker /data:", directErr);
            res = await fetch(`${WORKER_URL}/data`, { cache: "no-cache" });
            if (!res.ok) throw new Error(`Worker /data HTTP ${res.status}`);
        }

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
        console.error("Failed to load data:", err);
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
        document.getElementById('expiry-display').textContent =    
            new Date(found.expiry_date).toLocaleDateString('km-KH', {     
                day: 'numeric', month: 'long', year: 'numeric'     
            });    

        localStorage.setItem('autoLoginData', JSON.stringify({    
            code: found.code,    
            savedAt: Date.now(),    
            expiry: found.expiry_date    
        }));    

        document.getElementById('login-view').classList.add('hidden');    
        document.getElementById('app-content').classList.remove('hidden');    
        document.getElementById('bottom-nav').classList.remove('hidden');    

        setRandomUserAvatar();    

        if (!hasSeenWarning) {    
            document.getElementById('warning-modal').classList.add('show');    
            hasSeenWarning = true;    
        }    

        errorEl.classList.add('hidden');    
        showMainHeaderElements();    

        // Build subdomain map immediately (prewarm also runs after warning modal)
        buildSubdomainMap(found.code, found.expiry_date);
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
            document.getElementById('expiry-display').textContent = 
                new Date(found.expiry_date).toLocaleDateString('km-KH', {     
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric'     
                });

            document.getElementById('login-view').classList.add('hidden');
            document.getElementById('app-content').classList.remove('hidden');
            document.getElementById('bottom-nav').classList.remove('hidden');

            setRandomUserAvatar();
            showMainHeaderElements();

            // Ensure subdomain map is ready for config copy
            buildSubdomainMap(found.code, found.expiry_date);

            if (!hasSeenWarning) {
                document.getElementById('warning-modal').classList.add('show');
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
    document.getElementById('warning-modal').classList.remove('show');    

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
        card.className = `card-item card-bg rounded-2xl p-5 flex items-center justify-between card-hover cursor-pointer`;
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
                    subtitle = `${servers} servers • <span class="text-green-400" id="active-${categoryKey}">0</span> active`;
                } else if (servers === 0 && apps > 0) {
                    subtitle = `${apps} apps`;
                }

                countHTML = `
                    <p class="text-sm text-gray-400 mt-1" id="count-${categoryKey}">
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
                <div class="menu-icon-wrap w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden relative">
                    <img
                        src="${iconUrl}"
                        alt="${item.title}"
                        class="w-full h-full object-cover rounded-full"
                        loading="lazy"
                        onerror="this.style.display='none'; this.parentElement.classList.add('${item.iconBg || 'bg-gray-900'}');"
                    >
                    ${badgeHTML}
                </div>
            `;
        } else {
            const faClass = iconValue || 'fas fa-circle';
            iconHTML = `
                <div class="menu-icon-wrap w-14 h-14 ${item.iconBg || 'bg-gray-900'} rounded-xl flex items-center justify-center shadow-lg relative">
                    <i class="${faClass} text-3xl ${item.iconColor || 'text-gray-400'}"></i>
                    ${badgeHTML}
                </div>
            `;
        }
        // ---------- END ICON RENDER ----------

        const serversCount = categoryKey ? (categoryServers[categoryKey] || 0) : 0;
        const showSubBtn = !!categoryKey && serversCount > 0;

        card.innerHTML = `
            <div class="flex items-center space-x-5">
                ${iconHTML}
                <div>
                    <h2 class="text-lg font-medium text-gray-100">${item.title}</h2>
                    ${countHTML}
                </div>
            </div>

            <div class="flex items-center space-x-3">
                ${showSubBtn ? `
                  <button
                    type="button"
                    class="sub-btn px-3 py-1 text-xs font-semibold rounded-lg bg-gray-900 text-green-400 border border-green-500/30 hover:bg-gray-800"
                    data-cat="${categoryKey}">
                    SUB
                  </button>
                ` : ''}

                <i class="fas fa-chevron-right text-gray-500 chevron-hover"></i>
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
                                html += ` • <span class="text-green-400">${activeCounts[categoryKey] || 0}</span> active`;
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
            ` : `<h3 class="text-base font-semibold text-gray-100">${item.title}</h3>`;    

            div.innerHTML = `    
                <div class="server-card">    
                    <div class="server-info">    
                        <div class="flex items-center space-x-4">    
                            <div class="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-gray-800 server-icon-img">    
                                ${iconHTML}    
                            </div>    
                            <div class="flex-1 min-w-0">    
                                ${scrollingTitle}    
                                <p class="text-sm text-gray-400 truncate-text" title="${configText}">${shortText}</p>    
                            </div>    
                        </div>    
                    </div>    

                    <div class="server-actions">    
                        <span class="ping-result text-sm font-medium" data-ip="${serverIP || ''}">...</span>    
                        <button onclick="copyText('${configText.replace(/'/g, "\\'")}')"    
                                class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition text-sm font-medium">    
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
    document.getElementById('logout-btn')?.addEventListener('click', () => logout(false));    
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