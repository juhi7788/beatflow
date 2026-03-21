/* ================================
   BEATFLOW — PLAYER.JS
   Audio Player Engine
================================ */

const Player = {

  audio: null,
  currentSong: null,
  isPlaying: false,
  progressInterval: null,

  // ===== INIT =====
  init() {
    this.audio = new Audio();
    this.audio.preload = 'metadata';

    // Events
    this.audio.addEventListener('timeupdate', () => this.onTimeUpdate());
    this.audio.addEventListener('ended', () => this.onEnded());
    this.audio.addEventListener('loadstart', () => this.onLoadStart());
    this.audio.addEventListener('canplay', () => this.onCanPlay());
    this.audio.addEventListener('error', (e) => this.onError(e));
    this.audio.addEventListener('waiting', () => showToast('Buffering...'));

    // Set volume
    const settings = Storage.getSettings();
    this.audio.volume = (settings.volume || 100) / 100;

    // MediaSession API (lock screen controls)
    this.setupMediaSession();

    console.log('✅ Player initialized');
  },

  // ===== PLAY SONG =====
  async playSong(song) {
    if (!song) return;

    showToast(`Loading: ${song.title}`);

    // Prepare stream URL based on source
    let readySong = song;

    if (song.source === 'Telegram' && !song.streamUrl) {
      readySong = await Telegram.prepareSong(song);
    } else if (song.source === 'Drive' && !song.streamUrl) {
      readySong = await Drive.prepareSong(song);
    }

    if (!readySong || !readySong.streamUrl) {
      showToast('❌ Cannot play this song');
      return;
    }

    // Stop current
    this.audio.pause();
    this.audio.src = readySong.streamUrl;
    this.currentSong = readySong;
    App.currentSong = readySong;

    // Load cover
    if (!readySong.thumbnail) {
      Covers.fetchCover(readySong).then(thumb => {
        if (thumb) {
          readySong.thumbnail = thumb;
          this.updateUI(readySong);
        }
      });
    }

    // Play
    try {
      await this.audio.play();
      this.isPlaying = true;
      App.isPlaying = true;
    } catch (err) {
      console.error('Play error:', err);
      showToast('❌ Playback error. Try again.');
      return;
    }

    // Save to history & storage
    Storage.addToHistory(readySong);
    Storage.saveCurrentSong(readySong);

    // Update UI
    this.updateUI(readySong);
    showMiniPlayer();

    // Fetch lyrics
    Lyrics.fetch(readySong);

    // Update queue UI
    this.highlightCurrentInQueue();

    showToast(`▶ Now Playing: ${readySong.title}`);
  },

  // ===== TOGGLE PLAY/PAUSE =====
  togglePlay() {
    if (!this.audio.src) return;
    if (this.isPlaying) {
      this.pause();
    } else {
      this.resume();
    }
  },

  pause() {
    this.audio.pause();
    this.isPlaying = false;
    App.isPlaying = false;
    this.updatePlayPauseUI(false);
  },

  resume() {
    this.audio.play();
    this.isPlaying = true;
    App.isPlaying = true;
    this.updatePlayPauseUI(true);
  },

  // ===== NEXT SONG =====
  nextSong() {
    if (App.queue.length === 0) return;

    let nextIndex;
    if (App.isShuffle) {
      nextIndex = Math.floor(Math.random() * App.queue.length);
    } else {
      nextIndex = App.queueIndex + 1;
      if (nextIndex >= App.queue.length) {
        if (App.repeatMode === 'all') {
          nextIndex = 0;
        } else {
          this.pause();
          return;
        }
      }
    }

    App.queueIndex = nextIndex;
    this.playSong(App.queue[nextIndex]);
  },

  // ===== PREV SONG =====
  prevSong() {
    // If more than 3 seconds played, restart
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      return;
    }

    if (App.queue.length === 0) return;

    let prevIndex = App.queueIndex - 1;
    if (prevIndex < 0) prevIndex = App.queue.length - 1;

    App.queueIndex = prevIndex;
    this.playSong(App.queue[prevIndex]);
  },

  // ===== SEEK =====
  seekTo(percent) {
    if (!this.audio.duration) return;
    this.audio.currentTime = (percent / 100) * this.audio.duration;
  },

  // ===== VOLUME =====
  setVolume(value) {
    this.audio.volume = value / 100;
    Storage.saveSetting('volume', value);
  },

  // ===== SHUFFLE =====
  toggleShuffle() {
    App.isShuffle = !App.isShuffle;
    Storage.saveSetting('shuffle', App.isShuffle);
    updateShuffleRepeatUI();
    showToast(App.isShuffle ? '🔀 Shuffle ON' : 'Shuffle OFF');
  },

  // ===== REPEAT =====
  toggleRepeat() {
    const modes = ['off', 'all', 'one'];
    const current = modes.indexOf(App.repeatMode);
    App.repeatMode = modes[(current + 1) % modes.length];
    Storage.saveSetting('repeat', App.repeatMode);

    if (App.repeatMode === 'one') {
      this.audio.loop = true;
    } else {
      this.audio.loop = false;
    }

    updateShuffleRepeatUI();
    showToast(
      App.repeatMode === 'off' ? 'Repeat OFF' :
      App.repeatMode === 'all' ? '🔁 Repeat ALL' : '🔂 Repeat ONE'
    );
  },

  // ===== LIKE =====
  toggleLike() {
    if (!this.currentSong) return;
    const liked = Storage.toggleLike(this.currentSong);

    // Update like button
    const likeBtn = document.getElementById('likeBtn');
    const miniLikeBtn = document.getElementById('miniLikeBtn');

    if (likeBtn) {
      likeBtn.classList.toggle('liked', liked);
      likeBtn.querySelector('.material-icons-round').textContent =
        liked ? 'favorite' : 'favorite_border';
    }

    if (miniLikeBtn) {
      miniLikeBtn.textContent = liked ? 'favorite' : 'favorite_border';
      miniLikeBtn.style.color = liked ? '#ef5350' : '';
    }

    showToast(liked ? '❤️ Added to Liked Songs' : 'Removed from Liked');
    updateLikedCount();
  },

  // ===== TIME UPDATE =====
  onTimeUpdate() {
    const current = this.audio.currentTime;
    const total = this.audio.duration;
    if (!total) return;

    const percent = (current / total) * 100;

    // Progress bar
    const progressBar = document.getElementById('progressBar');
    if (progressBar) progressBar.value = percent;

    // Mini player progress
    const miniBar = document.getElementById('miniProgressBar');
    if (miniBar) miniBar.style.width = `${percent}%`;

    // Times
    const currentEl = document.getElementById('currentTime');
    const totalEl = document.getElementById('totalTime');
    if (currentEl) currentEl.textContent = formatDuration(current);
    if (totalEl) totalEl.textContent = formatDuration(total);

    // Lyrics sync
    Lyrics.sync(current);
  },

  // ===== ENDED =====
  onEnded() {
    if (App.repeatMode === 'one') {
      this.audio.currentTime = 0;
      this.audio.play();
      return;
    }
    this.nextSong();
  },

  // ===== LOAD START =====
  onLoadStart() {
    this.updatePlayPauseUI(false);
  },

  // ===== CAN PLAY =====
  onCanPlay() {
    this.updatePlayPauseUI(true);
  },

  // ===== ERROR =====
  onError(e) {
    console.error('Audio error:', e);
    showToast('❌ Playback error. Trying next...');
    setTimeout(() => this.nextSong(), 1500);
  },

  // ===== UPDATE UI =====
  updateUI(song) {
    if (!song) return;

    // Full player
    const playerTitle = document.getElementById('playerTitle');
    const playerArtist = document.getElementById('playerArtist');
    const playerArt = document.getElementById('playerArt');
    const artPlaceholder = document.getElementById('artPlaceholder');

    if (playerTitle) playerTitle.textContent = song.title || 'Unknown';
    if (playerArtist) playerArtist.textContent = song.artist || 'Unknown';

    if (playerArt && song.thumbnail) {
      playerArt.src = song.thumbnail;
      playerArt.style.display = 'block';
      if (artPlaceholder) artPlaceholder.style.display = 'none';
    } else if (artPlaceholder) {
      artPlaceholder.style.display = 'flex';
    }

    // Mini player
    updateMiniPlayer(song);

    // Source indicator
    const sourceIcon = document.getElementById('sourceIcon');
    const sourceLabel = document.getElementById('sourceLabel');
    if (sourceIcon) sourceIcon.textContent = song.sourceIcon || 'music_note';
    if (sourceLabel) sourceLabel.textContent = song.source || 'Unknown';

    // Like state
    const isLiked = Storage.isLiked(song.id);
    const likeBtn = document.getElementById('likeBtn');
    const miniLikeBtn = document.getElementById('miniLikeBtn');
    if (likeBtn) {
      likeBtn.classList.toggle('liked', isLiked);
      likeBtn.querySelector('.material-icons-round').textContent =
        isLiked ? 'favorite' : 'favorite_border';
    }
    if (miniLikeBtn) {
      miniLikeBtn.textContent = isLiked ? 'favorite' : 'favorite_border';
      miniLikeBtn.style.color = isLiked ? '#ef5350' : '';
    }

    // Play state
    this.updatePlayPauseUI(true);

    // MediaSession
    this.updateMediaSession(song);

    // Dynamic background color from thumbnail
    if (song.thumbnail) {
      this.extractColor(song.thumbnail);
    }
  },

  // ===== PLAY/PAUSE UI =====
  updatePlayPauseUI(playing) {
    const playIcon = document.getElementById('playIcon');
    const miniPlayBtn = document.getElementById('miniPlayBtn');

    if (playIcon) playIcon.textContent = playing ? 'pause' : 'play_arrow';
    if (miniPlayBtn) miniPlayBtn.textContent = playing ? 'pause' : 'play_arrow';

    // Art animation
    const artWrapper = document.getElementById('artWrapper');
    if (artWrapper) artWrapper.classList.toggle('playing', playing);
  },

  // ===== HIGHLIGHT CURRENT IN QUEUE =====
  highlightCurrentInQueue() {
    document.querySelectorAll('.queue-item').forEach((item, i) => {
      item.classList.toggle('current', i === App.queueIndex);
    });
  },

  // ===== DOWNLOAD SONG =====
  downloadSong() {
    if (!this.currentSong?.streamUrl) {
      showToast('No song to download');
      return;
    }
    const a = document.createElement('a');
    a.href = this.currentSong.streamUrl;
    a.download = `${this.currentSong.title}.mp3`;
    a.click();
    showToast('⬇️ Downloading...');
  },

  // ===== EXTRACT COLOR =====
  extractColor(imageUrl) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      document.getElementById('fullPlayer').style
        .setProperty('--dynamic-bg', `rgb(${r},${g},${b})`);
    };
  },

  // ===== MEDIA SESSION API =====
  setupMediaSession() {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.setActionHandler('play', () => this.resume());
    navigator.mediaSession.setActionHandler('pause', () => this.pause());
    navigator.mediaSession.setActionHandler('nexttrack', () => this.nextSong());
    navigator.mediaSession.setActionHandler('previoustrack', () => this.prevSong());
    navigator.mediaSession.setActionHandler('seekto', (d) => {
      this.audio.currentTime = d.seekTime;
    });
  },

  updateMediaSession(song) {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.title || 'Unknown',
      artist: song.artist || 'Unknown',
      album: 'BeatFlow',
      artwork: song.thumbnail ? [{ src: song.thumbnail, sizes: '512x512' }] : [],
    });

    navigator.mediaSession.playbackState = 'playing';
  },
};

// ===== GLOBAL FUNCTIONS FOR HTML =====
function togglePlay() { Player.togglePlay(); }
function nextSong() { Player.nextSong(); }
function prevSong() { Player.prevSong(); }
function seekTo(val) { Player.seekTo(val); }
function setVolume(val) { Player.setVolume(val); }
function toggleShuffle() { Player.toggleShuffle(); }
function toggleRepeat() { Player.toggleRepeat(); }
function toggleLike() { Player.toggleLike(); }
function downloadSong() { Player.downloadSong(); }

// Init player when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  Player.init();
});
