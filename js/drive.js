/* ================================
   BEATFLOW — DRIVE.JS
   Google Drive API Integration
================================ */

const Drive = {

  cachedSongs: [],
  accessToken: null,
  CLIENT_ID: '',
  API_KEY: '',

  // ===== INIT =====
  init() {
    const config = Storage.getDriveConfig();
    this.CLIENT_ID = config.clientId || '';
    this.API_KEY = config.apiKey || '';
    this.accessToken = Storage.get('drive_token', null);
  },

  // ===== CONNECT (OAuth) =====
  connect() {
    const config = Storage.getDriveConfig();
    if (!config.clientId) {
      // Ask for credentials
      const clientId = prompt('Google Drive Client ID daalo:');
      const apiKey = prompt('Google Drive API Key daalo:');
      if (!clientId || !apiKey) return;

      Storage.saveDriveConfig(apiKey, clientId);
      this.CLIENT_ID = clientId;
      this.API_KEY = apiKey;
      document.getElementById('driveStatus').textContent = 'Configured ✓';
      showToast('✅ Drive configured!');
    }

    // Open OAuth
    this.openOAuth();
  },

  openOAuth() {
    const redirectUri = window.location.origin + window.location.pathname;
    const scope = 'https://www.googleapis.com/auth/drive.readonly';
    const url = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${this.CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=token` +
      `&scope=${encodeURIComponent(scope)}`;

    // Open in popup
    const popup = window.open(url, 'DriveAuth', 'width=500,height=600');

    // Listen for token
    window.addEventListener('message', (event) => {
      if (event.data?.type === 'DRIVE_TOKEN') {
        this.accessToken = event.data.token;
        Storage.set('drive_token', event.data.token);
        Storage.saveDriveConfig(this.API_KEY, this.CLIENT_ID);
        document.getElementById('driveStatus').textContent = 'Connected ✓';
        showToast('✅ Google Drive connected!');
        this.fetchSongs();
        popup?.close();
      }
    });
  },

  // ===== CHECK OAUTH CALLBACK =====
  checkOAuthCallback() {
    const hash = window.location.hash;
    if (hash.includes('access_token')) {
      const params = new URLSearchParams(hash.substring(1));
      const token = params.get('access_token');
      if (token && window.opener) {
        window.opener.postMessage({ type: 'DRIVE_TOKEN', token }, '*');
        window.close();
      }
    }
  },

  // ===== FETCH SONGS =====
  async fetchSongs() {
    if (!this.accessToken && !this.API_KEY) {
      this.init();
    }

    try {
      const query = encodeURIComponent(
        "mimeType contains 'audio/' and trashed=false"
      );

      const url = `https://www.googleapis.com/drive/v3/files?` +
        `q=${query}` +
        `&fields=files(id,name,mimeType,size,thumbnailLink,videoMediaMetadata,modifiedTime)` +
        `&pageSize=100` +
        `&key=${this.API_KEY}`;

      const headers = {};
      if (this.accessToken) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
      }

      const res = await fetch(url, { headers });
      const data = await res.json();

      if (data.error) {
        console.error('Drive API error:', data.error);
        return Storage.get('drive_songs_cache', []);
      }

      const songs = (data.files || []).map(file => this.parseFileToSong(file));
      this.cachedSongs = songs;
      Storage.set('drive_songs_cache', songs);

      return songs;
    } catch (err) {
      console.error('Drive fetch error:', err);
      return Storage.get('drive_songs_cache', []);
    }
  },

  // ===== PARSE FILE TO SONG =====
  parseFileToSong(file) {
    const name = file.name.replace(/\.(mp3|m4a|ogg|flac|wav|aac)$/i, '');
    // Try to extract artist - title from filename
    const parts = name.split(' - ');
    const title = parts.length > 1 ? parts[1].trim() : name;
    const artist = parts.length > 1 ? parts[0].trim() : 'Unknown Artist';

    return {
      id: `drive_${file.id}`,
      driveId: file.id,
      title,
      artist,
      duration: file.videoMediaMetadata?.durationMillis
        ? Math.floor(file.videoMediaMetadata.durationMillis / 1000)
        : 0,
      thumbnail: file.thumbnailLink || null,
      source: 'Drive',
      sourceIcon: 'add_to_drive',
      mimeType: file.mimeType,
      size: file.size,
      modifiedTime: file.modifiedTime,
    };
  },

  // ===== GET STREAM URL =====
  getStreamUrl(driveId) {
    if (this.accessToken) {
      return `https://www.googleapis.com/drive/v3/files/${driveId}?alt=media&access_token=${this.accessToken}`;
    }
    // Public file fallback
    return `https://drive.google.com/uc?id=${driveId}&export=download`;
  },

  // ===== PREPARE SONG =====
  async prepareSong(song) {
    if (song.streamUrl) return song;
    const streamUrl = this.getStreamUrl(song.driveId);
    return { ...song, streamUrl };
  },

  // ===== SEARCH =====
  async searchSongs(query) {
    const q = query.toLowerCase();
    let songs = this.cachedSongs;

    if (songs.length === 0) {
      songs = Storage.get('drive_songs_cache', []);
      this.cachedSongs = songs;
    }

    return songs.filter(s =>
      s.title.toLowerCase().includes(q) ||
      (s.artist && s.artist.toLowerCase().includes(q))
    );
  },

  // ===== GET CACHED =====
  getCachedSongs() {
    if (this.cachedSongs.length > 0) return this.cachedSongs;
    const cached = Storage.get('drive_songs_cache', []);
    this.cachedSongs = cached;
    return cached;
  },
};

// Check OAuth callback on page load
Drive.checkOAuthCallback();
Drive.init();
