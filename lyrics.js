/* ================================
   BEATFLOW — LYRICS.JS
================================ */

const Lyrics = {

  currentLyrics: [],
  isVisible: false,

  // Fetch lyrics from LRCLib
  async fetch(song) {
    const panel = document.getElementById('lyricsContent');
    if (panel) panel.innerHTML = '<p class="lyrics-loading">Loading lyrics...</p>';

    try {
      const query = encodeURIComponent(`${song.title} ${song.artist || ''}`);
      const res = await fetch(`https://lrclib.net/api/search?q=${query}`);
      const data = await res.json();

      if (!data || data.length === 0) {
        this.showNoLyrics();
        return;
      }

      const best = data[0];

      if (best.syncedLyrics) {
        this.currentLyrics = this.parseLRC(best.syncedLyrics);
        this.renderLyrics();
      } else if (best.plainLyrics) {
        this.renderPlainLyrics(best.plainLyrics);
      } else {
        this.showNoLyrics();
      }
    } catch (err) {
      console.error('Lyrics error:', err);
      this.showNoLyrics();
    }
  },

  parseLRC(lrc) {
    return lrc.split('\n')
      .map(line => {
        const match = line.match(/\[(\d+):(\d+\.\d+)\](.*)/);
        if (!match) return null;
        const time = parseInt(match[1]) * 60 + parseFloat(match[2]);
        return { time, text: match[3].trim() };
      })
      .filter(Boolean);
  },

  renderLyrics() {
    const panel = document.getElementById('lyricsContent');
    if (!panel) return;
    panel.innerHTML = this.currentLyrics.map((line, i) => `
      <p class="lyric-line" id="lyric_${i}"
         onclick="Player.seekTo(${(line.time / Player.audio.duration) * 100})">
        ${line.text || '♪'}
      </p>`).join('');
  },

  renderPlainLyrics(text) {
    const panel = document.getElementById('lyricsContent');
    if (!panel) return;
    this.currentLyrics = [];
    panel.innerHTML = text.split('\n').map(line =>
      `<p class="lyric-line">${line || '&nbsp;'}</p>`
    ).join('');
  },

  showNoLyrics() {
    const panel = document.getElementById('lyricsContent');
    if (panel) panel.innerHTML = `
      <div class="lyrics-not-found">
        <span class="material-icons-round">lyrics</span>
        <p>No lyrics found</p>
      </div>`;
    this.currentLyrics = [];
  },

  sync(currentTime) {
    if (!this.isVisible || this.currentLyrics.length === 0) return;

    let activeIndex = 0;
    for (let i = 0; i < this.currentLyrics.length; i++) {
      if (currentTime >= this.currentLyrics[i].time) activeIndex = i;
    }

    document.querySelectorAll('.lyric-line').forEach((el, i) => {
      el.classList.toggle('active', i === activeIndex);
    });

    // Scroll to active
    const activeEl = document.getElementById(`lyric_${activeIndex}`);
    if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  },

  toggle() {
    const panel = document.getElementById('lyricsPanel');
    const btn = document.querySelector('.extra-btn[onclick="toggleLyrics()"]');
    this.isVisible = !this.isVisible;
    panel.classList.toggle('hidden', !this.isVisible);
    if (btn) btn.classList.toggle('active', this.isVisible);
  },
};

function toggleLyrics() { Lyrics.toggle(); }


/* ================================
   BEATFLOW — COVERS.JS
================================ */

const Covers = {

  cache: {},

  async fetchCover(song) {
    const key = `${song.title}_${song.artist}`;
    if (this.cache[key]) return this.cache[key];

    try {
      // Try iTunes first
      const query = encodeURIComponent(`${song.title} ${song.artist || ''}`);
      const res = await fetch(`https://itunes.apple.com/search?term=${query}&media=music&limit=1`);
      const data = await res.json();

      if (data.results && data.results.length > 0) {
        const url = data.results[0].artworkUrl100.replace('100x100', '500x500');
        this.cache[key] = url;
        return url;
      }

      // Try MusicBrainz
      return await this.fetchFromMusicBrainz(song);
    } catch {
      return null;
    }
  },

  async fetchFromMusicBrainz(song) {
    try {
      const query = encodeURIComponent(`${song.title} ${song.artist || ''}`);
      const res = await fetch(
        `https://musicbrainz.org/ws/2/recording?query=${query}&limit=1&fmt=json`,
        { headers: { 'User-Agent': 'BeatFlow/1.0' } }
      );
      const data = await res.json();

      if (data.recordings && data.recordings[0]?.releases?.[0]) {
        const releaseId = data.recordings[0].releases[0].id;
        return `https://coverartarchive.org/release/${releaseId}/front-250`;
      }
      return null;
    } catch {
      return null;
    }
  },
};


/* ================================
   BEATFLOW — SETTINGS.JS
================================ */

// All settings functions are handled in app.js
// This file is for any extra settings logic

function initSettings() {
  const settings = Storage.getSettings();

  // Theme buttons
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === settings.theme);
  });
}


/* ================================
   BEATFLOW — QUEUE.JS
================================ */

// Queue functions are handled in app.js
// Extra queue helpers here

function clearQueue() {
  App.queue = [];
  Storage.saveQueue([]);
  renderQueue();
  showToast('Queue cleared');
}

function saveQueueAsPlaylist() {
  if (App.queue.length === 0) {
    showToast('Queue is empty!');
    return;
  }
  const name = prompt('Playlist naam do:');
  if (!name) return;

  const pl = Storage.createPlaylist(name);
  App.queue.forEach(song => Storage.addToPlaylist(pl.id, song));
  showToast(`✅ Playlist "${name}" saved!`);
  loadLibraryPlaylists();
}
