/* ================================
   BEATFLOW — APP.JS v2.0
   Main App + YouTube Support
================================ */

const App = {
  currentPage: 'home',
  currentSong: null,
  queue: [],
  queueIndex: 0,
  isPlaying: false,
  isShuffle: false,
  repeatMode: 'off',
  sleepTimer: null,
  songForOptions: null,
};

document.addEventListener('DOMContentLoaded', () => { initApp(); });

async function initApp() {
  const settings = Storage.getSettings();
  setTheme(settings.theme, false);

  const volBar = document.getElementById('volumeBar');
  if (volBar) volBar.value = settings.volume || 100;

  const norm = document.getElementById('normalization');
  const skip = document.getElementById('skipSilence');
  const hist = document.getElementById('saveHistory');
  if (norm) norm.checked = settings.normalization;
  if (skip) skip.checked = settings.skipSilence;
  if (hist) hist.checked = settings.saveHistory;

  App.isShuffle = settings.shuffle || false;
  App.repeatMode = settings.repeat || 'off';
  updateShuffleRepeatUI();

  const lastSong = Storage.getCurrentSong();
  if (lastSong) { App.currentSong = lastSong; updateMiniPlayer(lastSong); showMiniPlayer(); }

  App.queue = Storage.getQueue();

  const tgConfig = Storage.getTelegramConfig();
  if (tgConfig.botToken) {
    const el = document.getElementById('tgStatus');
    if (el) el.textContent = 'Connected ✓';
  }

  const driveConfig = Storage.getDriveConfig();
  if (driveConfig.connected) {
    const el = document.getElementById('driveStatus');
    if (el) el.textContent = 'Connected ✓';
  }

  const cacheEl = document.getElementById('cacheSize');
  if (cacheEl) cacheEl.textContent = Storage.getCacheSize();

  updateLikedCount();
  loadLibraryPlaylists();
  loadHomePage();
  console.log('✅ BeatFlow v2.0 Ready!');
}

// ===== NAVIGATION =====
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(`page-${page}`);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-item, .bottom-nav__item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  const titles = { home:'Home', search:'Search', library:'Library',
    liked:'Liked Songs', downloaded:'Downloaded', recent:'Recently Played', settings:'Settings' };
  const titleEl = document.getElementById('pageTitle');
  if (titleEl) titleEl.textContent = titles[page] || page;

  App.currentPage = page;
  if (window.innerWidth <= 768) closeSidebarMobile();

  if (page === 'liked') loadLikedSongs();
  if (page === 'recent') loadRecentSongs();
  if (page === 'downloaded') loadDownloadedSongs();
  if (page === 'library') loadLibraryPlaylists();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('hidden');
}

function closeSidebarMobile() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.add('hidden');
}

function closeOverlay() { closeSidebarMobile(); closeAllSheets(); }

// ===== THEME =====
function setTheme(theme, save = true) {
  document.documentElement.setAttribute('data-theme', theme);
  if (save) Storage.saveSetting('theme', theme);
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
  const themeBtn = document.getElementById('themeBtn');
  if (themeBtn) themeBtn.querySelector('.material-icons-round').textContent =
    theme === 'light' ? 'light_mode' : 'dark_mode';
}

function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  setTheme(cur === 'dark' ? 'light' : cur === 'light' ? 'black' : 'dark');
}

// ===== HOME =====
async function loadHomePage() {
  loadRecentlyPlayedHome();
  await loadYouTubeTrending();

  const tgConfig = Storage.getTelegramConfig();
  if (tgConfig.botToken && tgConfig.channelId) {
    loadTelegramSongs();
  } else {
    const g = document.getElementById('telegramSongsGrid');
    if (g) g.innerHTML = `<div style="grid-column:1/-1;padding:16px;color:var(--text3);font-size:0.85rem">⚙️ Settings mein Telegram configure karo</div>`;
  }

  const driveConfig = Storage.getDriveConfig();
  if (driveConfig.connected) {
    loadDriveSongs();
  } else {
    const g = document.getElementById('driveSongsGrid');
    if (g) g.innerHTML = `<div style="grid-column:1/-1;padding:16px;color:var(--text3);font-size:0.85rem">⚙️ Settings mein Drive connect karo</div>`;
  }
}

async function loadYouTubeTrending() {
  const grid = document.getElementById('quickPicksGrid');
  if (!grid) return;
  grid.innerHTML = '<div class="song-card skeleton"></div>'.repeat(4);
  try {
    const songs = await YouTube.getTrending();
    grid.innerHTML = songs.length
      ? songs.slice(0, 8).map(s => createSongCard(s)).join('')
      : `<div style="grid-column:1/-1;padding:20px;text-align:center;color:var(--text3)">
           <span class="material-icons-round" style="font-size:40px;display:block;margin-bottom:8px">search</span>
           Search karke songs dhundo!
         </div>`;
  } catch {
    grid.innerHTML = `<div style="grid-column:1/-1;padding:16px;color:var(--text3);font-size:0.85rem">YouTube load nahi hua. Search try karo!</div>`;
  }
}

function loadRecentlyPlayedHome() {
  const row = document.getElementById('recentlyPlayedRow');
  if (!row) return;
  const history = Storage.getHistory().slice(0, 6);
  row.innerHTML = history.length
    ? history.map(s => createSongCard(s)).join('')
    : `<p style="color:var(--text3);font-size:0.85rem;padding:8px 0">Koi recently played nahi</p>`;
}

// ===== SEARCH =====
let searchTimeout = null;

function onSearch(query) {
  clearTimeout(searchTimeout);
  const results = document.getElementById('searchResults');
  const browse = document.getElementById('browseCategories');
  const clearBtn = document.getElementById('searchClear');
  if (clearBtn) clearBtn.classList.toggle('hidden', !query);
  if (!query.trim()) {
    results?.classList.add('hidden');
    browse?.classList.remove('hidden');
    return;
  }
  results?.classList.remove('hidden');
  browse?.classList.add('hidden');
  searchTimeout = setTimeout(() => { performSearch(query); Storage.addSearchHistory(query); }, 500);
}

function clearSearch() {
  const input = document.getElementById('searchInput');
  if (input) { input.value = ''; onSearch(''); input.focus(); }
}

async function performSearch(query) {
  const list = document.getElementById('searchSongsList');
  if (!list) return;
  list.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text3)">
    <span class="material-icons-round spinning" style="font-size:32px;display:block;margin-bottom:8px">refresh</span>Searching...</div>`;
  try {
    const [ytSongs, tgSongs, driveSongs] = await Promise.all([
      YouTube.search(query),
      Telegram.searchSongs(query),
      Drive.searchSongs(query),
    ]);
    const all = [...ytSongs, ...tgSongs, ...driveSongs];
    list.innerHTML = all.length
      ? all.map((s, i) => createSongListItem(s, i, all)).join('')
      : `<div class="empty-state">
           <span class="material-icons-round empty-icon">search_off</span>
           <p class="empty-title">"${query}" nahi mila</p>
           <p class="empty-sub">Dusra keyword try karo</p>
         </div>`;
  } catch {
    list.innerHTML = `<div class="empty-state">
      <span class="material-icons-round empty-icon">error_outline</span>
      <p class="empty-title">Error aaya</p>
      <p class="empty-sub">Internet check karo</p>
    </div>`;
  }
}

function switchTab(tab) {
  document.querySelectorAll('.tabs .tab').forEach(t =>
    t.classList.toggle('active', t.textContent.toLowerCase() === tab.toLowerCase()));
  document.querySelectorAll('.tab-content').forEach(c =>
    c.classList.toggle('active', c.id === `tab-${tab}`));
}

function switchLibTab(tab) {
  document.querySelectorAll('.lib-tab').forEach(t =>
    t.classList.toggle('active', t.textContent.toLowerCase() === tab.toLowerCase()));
  document.querySelectorAll('.lib-content').forEach(c =>
    c.classList.toggle('active', c.id === `libTab-${tab}`));
  if (tab === 'songs') loadLibrarySongs();
}

// ===== LIBRARY =====
function loadLibraryPlaylists() {
  const grid = document.getElementById('playlistsGrid');
  if (!grid) return;
  const playlists = Storage.getPlaylists();
  const likedCard = grid.querySelector('.playlist-card.special');
  grid.innerHTML = '';
  if (likedCard) grid.appendChild(likedCard);
  playlists.forEach(pl => {
    const card = document.createElement('div');
    card.className = 'playlist-card';
    card.onclick = () => openPlaylist(pl.id);
    card.innerHTML = `
      <div class="playlist-cover"><span class="material-icons-round">queue_music</span></div>
      <div class="playlist-info">
        <p class="playlist-name">${pl.name}</p>
        <p class="playlist-count">${pl.songs.length} songs</p>
      </div>`;
    grid.appendChild(card);
  });
  updateLikedCount();
}

function loadLibrarySongs() {
  const list = document.getElementById('libSongsList');
  if (!list) return;
  const all = [...Telegram.getCachedSongs(), ...Drive.getCachedSongs()];
  list.innerHTML = all.length
    ? all.map((s, i) => createSongListItem(s, i, all)).join('')
    : `<div class="empty-state">
         <span class="material-icons-round empty-icon">library_music</span>
         <p class="empty-title">Koi songs nahi</p>
         <p class="empty-sub">Telegram ya Drive configure karo</p>
       </div>`;
}

function updateLikedCount() {
  const count = Storage.getLikedSongs().length;
  ['likedCount', 'likedHeroCount'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = `${count} songs`;
  });
}

function loadLikedSongs() {
  const list = document.getElementById('likedSongsList');
  if (!list) return;
  const songs = Storage.getLikedSongs();
  updateLikedCount();
  list.innerHTML = songs.length
    ? songs.map((s, i) => createSongListItem(s, i, songs)).join('')
    : `<div class="empty-state">
         <span class="material-icons-round empty-icon">favorite_border</span>
         <p class="empty-title">Koi liked songs nahi</p>
         <p class="empty-sub">Heart icon tap karo</p>
       </div>`;
}

function loadRecentSongs() {
  const list = document.getElementById('recentSongsList');
  if (!list) return;
  const songs = Storage.getHistory();
  list.innerHTML = songs.length
    ? songs.map((s, i) => createSongListItem(s, i, songs)).join('')
    : `<div class="empty-state">
         <span class="material-icons-round empty-icon">history</span>
         <p class="empty-title">Koi history nahi</p>
         <p class="empty-sub">Jo songs sunoge yahan dikhenge</p>
       </div>`;
}

function loadDownloadedSongs() {
  const list = document.getElementById('downloadedSongsList');
  const empty = document.getElementById('downloadedEmpty');
  const songs = Storage.get('downloaded', []);
  if (!list) return;
  if (!songs.length) { empty?.classList.remove('hidden'); list.innerHTML = ''; return; }
  empty?.classList.add('hidden');
  list.innerHTML = songs.map((s, i) => createSongListItem(s, i, songs)).join('');
}

// ===== SONG BUILDERS =====
function createSongCard(song) {
  const d = JSON.stringify(song).replace(/"/g, '&quot;');
  return `
    <div class="song-card" onclick="playSong(${d})">
      <div class="song-card__cover">
        ${song.thumbnail
          ? `<img src="${song.thumbnail}" alt="" loading="lazy" onerror="this.style.display='none'" />`
          : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--surface3)">
               <span class="material-icons-round" style="font-size:36px;color:var(--text3)">music_note</span>
             </div>`}
        <div class="song-card__play"><span class="material-icons-round">play_arrow</span></div>
        ${song.source ? `<div style="position:absolute;top:6px;left:6px;background:rgba(0,0,0,0.7);border-radius:6px;padding:2px 6px;font-size:10px;color:white;font-weight:600">
          ${song.source === 'YouTube' ? '▶ YT' : song.source === 'Telegram' ? '✈ TG' : '☁ Drive'}</div>` : ''}
        <button class="song-card__menu" onclick="event.stopPropagation();openSongOptions(${d})">
          <span class="material-icons-round">more_vert</span>
        </button>
      </div>
      <div class="song-card__info">
        <p class="song-card__title">${song.title || 'Unknown'}</p>
        <p class="song-card__artist">${song.artist || 'Unknown Artist'}</p>
      </div>
    </div>`;
}

function createSongListItem(song, index, songList) {
  const d = JSON.stringify(song).replace(/"/g, '&quot;');
  const l = JSON.stringify(songList).replace(/"/g, '&quot;');
  return `
    <div class="song-item" id="songItem_${song.id}" onclick="playSongFromList(${index}, ${l})">
      <span class="song-item__num">${index + 1}</span>
      <div class="song-item__thumb">
        ${song.thumbnail ? `<img src="${song.thumbnail}" alt="" loading="lazy" onerror="this.style.display='none'" />` : ''}
        <div class="song-item__thumb-icon"><span class="material-icons-round" style="font-size:20px">music_note</span></div>
      </div>
      <div class="song-item__info">
        <p class="song-item__title">${song.title || 'Unknown'}</p>
        <p class="song-item__artist">${song.artist || 'Unknown'}${song.source ? ` <span style="color:var(--text3)">• ${song.source}</span>` : ''}</p>
      </div>
      <span class="song-item__duration">${formatDuration(song.duration || 0)}</span>
      <button class="song-item__menu" onclick="event.stopPropagation();openSongOptions(${d})">
        <span class="material-icons-round">more_vert</span>
      </button>
    </div>`;
}

// ===== PLAYLIST =====
function createPlaylist() {
  const name = prompt('Playlist naam:');
  if (!name?.trim()) return;
  Storage.createPlaylist(name.trim());
  loadLibraryPlaylists();
  showToast(`✅ "${name}" bani!`);
}

function openPlaylist(id) {
  const pl = Storage.getPlaylists().find(p => p.id === id);
  if (pl) showToast(`Opening: ${pl.name}`);
}

function playAll(type) {
  const songs = type === 'liked' ? Storage.getLikedSongs() : [];
  if (!songs.length) return;
  App.isShuffle = false;
  playSongFromList(0, songs);
}

function shuffleAll(type) {
  const songs = type === 'liked' ? [...Storage.getLikedSongs()] : [];
  if (!songs.length) return;
  App.isShuffle = true;
  playSongFromList(0, songs.sort(() => Math.random() - 0.5));
}

// ===== SONG OPTIONS =====
function openSongOptions(song) {
  App.songForOptions = song;
  const title = document.getElementById('optionTitle');
  const artist = document.getElementById('optionArtist');
  const thumb = document.getElementById('optionThumb');
  if (title) title.textContent = song.title || 'Unknown';
  if (artist) artist.textContent = song.artist || 'Unknown';
  if (thumb) thumb.src = song.thumbnail || '';
  document.getElementById('songOptions').classList.remove('hidden');
  document.getElementById('overlay').classList.remove('hidden');
}

function closeSongOptions() {
  document.getElementById('songOptions').classList.add('hidden');
  document.getElementById('overlay').classList.add('hidden');
}

function optionLike() {
  if (!App.songForOptions) return;
  const liked = Storage.toggleLike(App.songForOptions);
  showToast(liked ? '❤️ Liked!' : 'Unliked');
  updateLikedCount();
  closeSongOptions();
}

function optionAddToPlaylist() {
  const pls = Storage.getPlaylists();
  if (!pls.length) { showToast('Pehle playlist banao!'); closeSongOptions(); return; }
  const choice = prompt(`Playlist:\n${pls.map((p, i) => `${i+1}. ${p.name}`).join('\n')}\n\nNumber:`);
  const idx = parseInt(choice) - 1;
  if (!isNaN(idx) && pls[idx]) { Storage.addToPlaylist(pls[idx].id, App.songForOptions); showToast(`✅ Added to ${pls[idx].name}`); }
  closeSongOptions();
}

function optionAddToQueue() {
  if (!App.songForOptions) return;
  App.queue.push(App.songForOptions);
  Storage.saveQueue(App.queue);
  showToast('Queue mein add hua!');
  closeSongOptions();
  renderQueue();
}

function optionDownload() {
  if (!App.songForOptions?.streamUrl) { showToast('Pehle song play karo'); closeSongOptions(); return; }
  const a = document.createElement('a');
  a.href = App.songForOptions.streamUrl;
  a.download = `${App.songForOptions.title}.mp3`;
  a.click();
  showToast('⬇️ Downloading...');
  closeSongOptions();
}

function optionShare() {
  if (!App.songForOptions) return;
  if (navigator.share) navigator.share({ title: App.songForOptions.title, text: `${App.songForOptions.title} by ${App.songForOptions.artist}` });
  else { navigator.clipboard?.writeText(window.location.href); showToast('Link copy hua!'); }
  closeSongOptions();
}

function optionGoToArtist() { showToast(`Artist: ${App.songForOptions?.artist || 'Unknown'}`); closeSongOptions(); }

// ===== DIALOGS =====
function closeAllSheets() {
  ['songOptions','sleepTimerDialog','telegramDialog'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
  document.getElementById('overlay').classList.add('hidden');
}

function closeDialog(id) {
  document.getElementById(id)?.classList.add('hidden');
  document.getElementById('overlay')?.classList.add('hidden');
}

function openSettings() { navigate('settings'); }

function openSleepTimer() {
  document.getElementById('sleepTimerDialog').classList.remove('hidden');
  document.getElementById('overlay').classList.remove('hidden');
}

function setSleepTimer(minutes) {
  if (App.sleepTimer) clearTimeout(App.sleepTimer);
  closeDialog('sleepTimerDialog');
  if (!minutes) { showToast('Sleep timer off'); return; }
  showToast(`😴 Sleep timer: ${minutes} min`);
  App.sleepTimer = setTimeout(() => { Player.pause(); showToast('😴 Music band!'); }, minutes * 60000);
}

function configureTelegram() {
  const c = Storage.getTelegramConfig();
  const t = document.getElementById('tgBotToken');
  const ch = document.getElementById('tgChannelId');
  if (t) t.value = c.botToken || '';
  if (ch) ch.value = c.channelId || '';
  document.getElementById('telegramDialog').classList.remove('hidden');
  document.getElementById('overlay').classList.remove('hidden');
}

function saveTelegramConfig() {
  const token = document.getElementById('tgBotToken')?.value.trim();
  const channelId = document.getElementById('tgChannelId')?.value.trim();
  if (!token || !channelId) { showToast('Dono fill karo!'); return; }
  Storage.saveTelegramConfig(token, channelId);
  const el = document.getElementById('tgStatus');
  if (el) el.textContent = 'Connected ✓';
  closeDialog('telegramDialog');
  showToast('✅ Telegram connected!');
  loadTelegramSongs();
}

function connectDrive() { Drive.connect(); }
function saveSetting(key, value) { Storage.saveSetting(key, value); }

function clearCache() {
  if (!confirm('Cache clear karo?')) return;
  Storage.clearCache();
  const el = document.getElementById('cacheSize');
  if (el) el.textContent = Storage.getCacheSize();
  showToast('Cache clear!');
}

function updateShuffleRepeatUI() {
  const shuffleBtn = document.getElementById('shuffleBtn');
  const repeatBtn = document.getElementById('repeatBtn');
  if (shuffleBtn) shuffleBtn.classList.toggle('active', App.isShuffle);
  if (repeatBtn) {
    const icon = repeatBtn.querySelector('.material-icons-round');
    icon.textContent = App.repeatMode === 'one' ? 'repeat_one' : 'repeat';
    repeatBtn.classList.toggle('active', App.repeatMode !== 'off');
  }
}

// ===== TOAST =====
let toastTimeout = null;
function showToast(msg, dur = 2500) {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toastMsg');
  if (!toast || !msgEl) return;
  msgEl.textContent = msg;
  toast.classList.remove('hidden', 'hiding');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, dur);
}

// ===== MINI/FULL PLAYER =====
function showMiniPlayer() { document.getElementById('miniPlayer')?.classList.remove('hidden'); }
function hideMiniPlayer() { document.getElementById('miniPlayer')?.classList.add('hidden'); }
function updateMiniPlayer(song) {
  if (!song) return;
  const title = document.getElementById('miniTitle');
  const artist = document.getElementById('miniArtist');
  const thumb = document.getElementById('miniThumb');
  if (title) title.textContent = song.title || 'Unknown';
  if (artist) artist.textContent = song.artist || 'Unknown';
  if (thumb) { thumb.src = song.thumbnail || ''; thumb.style.display = song.thumbnail ? 'block' : 'none'; }
}

function openPlayer() { document.getElementById('fullPlayer')?.classList.remove('hidden'); }
function closePlayer() { document.getElementById('fullPlayer')?.classList.add('hidden'); }

function openQueue() { renderQueue(); document.getElementById('queuePanel')?.classList.remove('hidden'); document.getElementById('overlay')?.classList.remove('hidden'); }
function closeQueue() { document.getElementById('queuePanel')?.classList.add('hidden'); document.getElementById('overlay')?.classList.add('hidden'); }

function renderQueue() {
  const list = document.getElementById('queueList');
  if (!list) return;
  list.innerHTML = App.queue.length
    ? App.queue.map((s, i) => `
        <div class="queue-item ${i === App.queueIndex ? 'current' : ''}" onclick="jumpToQueueIndex(${i})">
          <div class="queue-item__thumb"><img src="${s.thumbnail||''}" alt="" onerror="this.style.display='none'" /></div>
          <div class="queue-item__info">
            <p class="queue-item__title">${s.title||'Unknown'}</p>
            <p class="queue-item__artist">${s.artist||'Unknown'}</p>
          </div>
          <span class="queue-item__drag"><span class="material-icons-round">drag_handle</span></span>
        </div>`).join('')
    : `<div class="empty-state"><p class="empty-title">Queue empty</p></div>`;
}

function jumpToQueueIndex(i) { App.queueIndex = i; Player.playSong(App.queue[i]); closeQueue(); }

function formatDuration(s) {
  if (!s || isNaN(s)) return '—';
  return `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;
}

async function loadTelegramSongs() {
  const grid = document.getElementById('telegramSongsGrid');
  if (!grid) return;
  grid.innerHTML = '<div class="song-card skeleton"></div>'.repeat(4);
  const songs = await Telegram.fetchSongs();
  grid.innerHTML = songs.length
    ? songs.slice(0, 8).map(s => createSongCard(s)).join('')
    : `<div style="grid-column:1/-1;padding:16px;color:var(--text3);font-size:0.85rem">Koi songs nahi mila</div>`;
}

async function loadDriveSongs() {
  const grid = document.getElementById('driveSongsGrid');
  if (!grid) return;
  grid.innerHTML = '<div class="song-card skeleton"></div>'.repeat(4);
  const songs = await Drive.fetchSongs();
  grid.innerHTML = songs.length
    ? songs.slice(0, 8).map(s => createSongCard(s)).join('')
    : `<div style="grid-column:1/-1;padding:16px;color:var(--text3);font-size:0.85rem">Drive mein audio nahi mili</div>`;
}

function playSong(song) { App.queue = [song]; App.queueIndex = 0; Player.playSong(song); }
function playSongFromList(index, songList) { App.queue = songList; App.queueIndex = index; Storage.saveQueue(songList); Player.playSong(songList[index]); }
