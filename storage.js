/* ================================
   BEATFLOW — STORAGE.JS
   IndexedDB + LocalStorage Manager
================================ */

const Storage = {

  // ===== LOCAL STORAGE =====
  set(key, value) {
    try {
      localStorage.setItem(`beatflow_${key}`, JSON.stringify(value));
    } catch (e) { console.error('Storage set error:', e); }
  },

  get(key, fallback = null) {
    try {
      const val = localStorage.getItem(`beatflow_${key}`);
      return val ? JSON.parse(val) : fallback;
    } catch (e) { return fallback; }
  },

  remove(key) {
    localStorage.removeItem(`beatflow_${key}`);
  },

  // ===== SETTINGS =====
  getSettings() {
    return this.get('settings', {
      theme: 'dark',
      normalization: false,
      skipSilence: false,
      saveHistory: true,
      volume: 100,
      shuffle: false,
      repeat: 'off',
      sleepTimer: 0,
    });
  },

  saveSetting(key, value) {
    const settings = this.getSettings();
    settings[key] = value;
    this.set('settings', settings);
  },

  // ===== TELEGRAM CONFIG =====
  getTelegramConfig() {
    return this.get('telegram', { botToken: '', channelId: '' });
  },

  saveTelegramConfig(botToken, channelId) {
    this.set('telegram', { botToken, channelId });
  },

  // ===== DRIVE CONFIG =====
  getDriveConfig() {
    return this.get('drive', { apiKey: '', clientId: '', connected: false });
  },

  saveDriveConfig(apiKey, clientId) {
    this.set('drive', { apiKey, clientId, connected: true });
  },

  // ===== LIKED SONGS =====
  getLikedSongs() {
    return this.get('liked', []);
  },

  isLiked(songId) {
    return this.getLikedSongs().some(s => s.id === songId);
  },

  toggleLike(song) {
    let liked = this.getLikedSongs();
    const idx = liked.findIndex(s => s.id === song.id);
    if (idx === -1) {
      liked.unshift({ ...song, likedAt: Date.now() });
    } else {
      liked.splice(idx, 1);
    }
    this.set('liked', liked);
    return idx === -1;
  },

  // ===== PLAYLISTS =====
  getPlaylists() {
    return this.get('playlists', []);
  },

  createPlaylist(name) {
    const playlists = this.getPlaylists();
    const pl = {
      id: `pl_${Date.now()}`,
      name,
      songs: [],
      createdAt: Date.now(),
    };
    playlists.push(pl);
    this.set('playlists', playlists);
    return pl;
  },

  addToPlaylist(playlistId, song) {
    const playlists = this.getPlaylists();
    const pl = playlists.find(p => p.id === playlistId);
    if (pl && !pl.songs.find(s => s.id === song.id)) {
      pl.songs.unshift(song);
      this.set('playlists', playlists);
      return true;
    }
    return false;
  },

  deletePlaylist(playlistId) {
    this.set('playlists', this.getPlaylists().filter(p => p.id !== playlistId));
  },

  // ===== HISTORY =====
  getHistory() {
    return this.get('history', []);
  },

  addToHistory(song) {
    if (!this.getSettings().saveHistory) return;
    let history = this.getHistory().filter(s => s.id !== song.id);
    history.unshift({ ...song, playedAt: Date.now() });
    if (history.length > 100) history = history.slice(0, 100);
    this.set('history', history);
  },

  clearHistory() { this.set('history', []); },

  // ===== QUEUE =====
  getQueue() { return this.get('queue', []); },
  saveQueue(queue) { this.set('queue', queue); },

  // ===== CURRENT SONG =====
  getCurrentSong() { return this.get('currentSong', null); },
  saveCurrentSong(song) { this.set('currentSong', song); },

  // ===== SEARCH HISTORY =====
  getSearchHistory() { return this.get('searchHistory', []); },

  addSearchHistory(query) {
    if (!query.trim()) return;
    let h = this.getSearchHistory().filter(q => q !== query);
    h.unshift(query);
    this.set('searchHistory', h.slice(0, 20));
  },

  // ===== CACHE =====
  getCacheSize() {
    let total = 0;
    for (let key in localStorage) {
      if (key.startsWith('beatflow_')) total += localStorage[key].length * 2;
    }
    if (total < 1024) return `${total} B`;
    if (total < 1048576) return `${(total / 1024).toFixed(1)} KB`;
    return `${(total / 1048576).toFixed(1)} MB`;
  },

  clearCache() {
    const keep = ['beatflow_settings', 'beatflow_telegram', 'beatflow_drive'];
    Object.keys(localStorage)
      .filter(k => k.startsWith('beatflow_') && !keep.includes(k))
      .forEach(k => localStorage.removeItem(k));
  },
};
