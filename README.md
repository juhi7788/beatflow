# 🎵 BeatFlow

> Metrolist inspired music web app — Telegram + Google Drive powered!

**Based on:** [Metrolist](https://github.com/MetrolistGroup/Metrolist) by Mo Agamy  
**License:** GPL-3.0

---

## ✨ Features

- 🎵 Play songs from **Telegram** (Unlimited storage!)
- ☁️ Play songs from **Google Drive** (Your 2TB!)
- 📱 Mobile responsive — works on phone!
- 🎨 Dark / Light / Black themes
- 📝 Synced lyrics (LRCLib)
- 🔀 Shuffle & Repeat modes
- ❤️ Liked songs
- 📋 Playlists
- 🔍 Search
- 🔒 Lock screen controls (MediaSession API)
- 💤 Sleep timer

---

## 🚀 Setup

### 1. Clone karo
```bash
git clone https://github.com/TUMHARA_USERNAME/beatflow.git
cd beatflow
```

### 2. config.js banao
```javascript
const CONFIG = {
  TELEGRAM: {
    BOT_TOKEN: 'TUMHARA_BOT_TOKEN',
    CHANNEL_ID: 'TUMHARA_CHANNEL_ID',
  },
  DRIVE: {
    API_KEY: 'TUMHARA_API_KEY',
    CLIENT_ID: 'TUMHARA_CLIENT_ID',
  },
};
```

### 3. GitHub Pages pe deploy karo
```
Settings → Pages → Branch: main → Save
```

### 4. Open karo
```
https://TUMHARA_USERNAME.github.io/beatflow
```

---

## ⚙️ Telegram Setup

1. [@BotFather](https://t.me/botfather) pe jao
2. `/newbot` command do
3. Bot token copy karo
4. Ek private channel banao
5. Bot ko admin banao
6. Channel ID copy karo (Telegram Web pe)
7. Songs upload karo channel mein
8. BeatFlow Settings mein configure karo

---

## ☁️ Google Drive Setup

1. [Google Cloud Console](https://console.cloud.google.com) pe jao
2. New project banao
3. Google Drive API enable karo
4. Credentials → API Key banao
5. OAuth 2.0 Client ID banao (Web application)
6. Authorized origins mein apna domain daalo
7. BeatFlow Settings mein connect karo

---

## ⚠️ Important

- `config.js` ko `.gitignore` mein rakho — **GitHub pe mat daalo!**
- Sirf apna original content use karo
- GPL-3.0 license follow karo
- Credit: Metrolist by [Mo Agamy](https://github.com/mostafaalagamy)

---

## 📁 Structure

```
beatflow/
├── index.html
├── config.js          ← API keys (gitignore!)
├── .gitignore
├── css/
│   ├── main.css
│   ├── themes.css
│   ├── player.css
│   └── animations.css
└── js/
    ├── storage.js
    ├── app.js
    ├── telegram.js
    ├── drive.js
    ├── player.js
    └── lyrics.js
```

---

Made with ❤️ by Rohit Sharma  
Credits: [Metrolist](https://github.com/MetrolistGroup/Metrolist)
