const STORE_KEY = "free_flow_music_v1";
const DB_NAME = "free_flow_music_db";
const DB_STORE = "audio_files";

const ui = {
  songForm: document.getElementById("songForm"), title: document.getElementById("title"), artist: document.getElementById("artist"), url: document.getElementById("url"),
  fileInput: document.getElementById("fileInput"), importText: document.getElementById("importText"), importJsonBtn: document.getElementById("importJsonBtn"),
  importSpotifyBtn: document.getElementById("importSpotifyBtn"), importYouTubeBtn: document.getElementById("importYouTubeBtn"), spotifyLink: document.getElementById("spotifyLink"), youtubeLink: document.getElementById("youtubeLink"),
  shuffleBtn: document.getElementById("shuffleBtn"), repeatBtn: document.getElementById("repeatBtn"), clearLibraryBtn: document.getElementById("clearLibraryBtn"),
  nowPlaying: document.getElementById("nowPlaying"), audio: document.getElementById("audio"), search: document.getElementById("search"), songList: document.getElementById("songList"), queueList: document.getElementById("queueList")
};

let db;

const themeSelect = document.getElementById("themeSelect");
const designButtons = document.querySelectorAll(".design-btn");
const themes = {
  midnight: {bg:"#0d1016", panel:"#141a24", panelBorder:"#2d3950", text:"#f8f9ff", muted:"#9cb0d8", inputBg:"#0d121b", inputBorder:"#32405a", accent:"#6f91ff"},
  sunset: {bg:"#1c1114", panel:"#2b1820", panelBorder:"#6f3347", text:"#fff3f7", muted:"#f5b7cb", inputBg:"#211017", inputBorder:"#7a3b50", accent:"#ff759f"},
  forest: {bg:"#0c1511", panel:"#122119", panelBorder:"#2e5b45", text:"#e8fff2", muted:"#9fd8bc", inputBg:"#0d1913", inputBorder:"#2f6a4d", accent:"#67df9b"},
  candy: {bg:"#1a1426", panel:"#281d3a", panelBorder:"#6d56a4", text:"#f7f1ff", muted:"#d6c5ff", inputBg:"#1d1630", inputBorder:"#6b56ad", accent:"#b591ff"}
};
const designs = {
  glass: {panelAlpha:"0.45", radius:"16px", shadow:"0 18px 40px rgb(0 0 0 / 32%)"},
  bold: {panelAlpha:"0.95", radius:"8px", shadow:"0 0 0 rgb(0 0 0 / 0%)"},
  soft: {panelAlpha:"0.72", radius:"22px", shadow:"0 8px 16px rgb(0 0 0 / 18%)"}
};

function applyTheme(name){
  const t=themes[name]||themes.midnight;
  const r=document.documentElement.style;
  r.setProperty("--bg",t.bg); r.setProperty("--panel",t.panel); r.setProperty("--panel-border",t.panelBorder);
  r.setProperty("--text",t.text); r.setProperty("--muted",t.muted); r.setProperty("--input-bg",t.inputBg);
  r.setProperty("--input-border",t.inputBorder); r.setProperty("--accent",t.accent);
  localStorage.setItem("ffm_theme",name);
}

function applyDesign(name){
  const d=designs[name]||designs.glass;
  document.querySelectorAll(".panel").forEach(el=>{
    el.style.backdropFilter="blur(8px)";
    el.style.background=`color-mix(in oklab, var(--panel) ${d.panelAlpha === "0.95" ? "100%" : "80%"}, transparent)`;
    el.style.borderRadius=d.radius;
    el.style.boxShadow=d.shadow;
  });
  localStorage.setItem("ffm_design",name);
}

let state = JSON.parse(localStorage.getItem(STORE_KEY) || '{"songs":[],"queue":[],"repeat":false,"currentSongId":null}');
const persist = () => localStorage.setItem(STORE_KEY, JSON.stringify(state));
const xid = () => crypto.randomUUID();
const esc = s => String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function putFile(id, blob) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(blob, id);
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  });
}

function getFile(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const req = tx.objectStore(DB_STORE).get(id);
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
}

async function addUploadedFile(file) {
  const id = xid();
  await putFile(id, file);
  state.songs.push({ id, title: file.name.replace(/\.mp3$/i, ""), artist: "Local File", source: "local", mime: file.type || "audio/mpeg" });
  persist(); render();
}

function addUrlSong({title, artist, url}) {
  state.songs.push({ id: xid(), title: title.trim(), artist: (artist || "Unknown").trim(), source: "url", url: url.trim() });
  persist(); render();
}

function findSong(id) { return state.songs.find(s => s.id === id); }
function queueSong(id){ state.queue.push(id); persist(); render(); }
function removeSong(id){ state.songs = state.songs.filter(s => s.id !== id); state.queue = state.queue.filter(x => x !== id); if (state.currentSongId === id) state.currentSongId = null; persist(); render(); }

async function resolvePlayableUrl(song) {
  if (song.source === "url") return song.url;
  const blob = await getFile(song.id);
  if (!blob) throw new Error("Local file not found in browser storage.");
  return URL.createObjectURL(blob);
}

async function playSong(id) {
  const song = findSong(id); if (!song) return;
  const src = await resolvePlayableUrl(song);
  state.currentSongId = id;
  ui.audio.src = src; ui.audio.play();
  ui.nowPlaying.textContent = `${song.title} — ${song.artist}`;
  persist(); render();
}

async function downloadSong(song) {
  if (song.source === "url") {
    const a = document.createElement("a"); a.href = song.url; a.download = `${song.title}.mp3`; document.body.append(a); a.click(); a.remove();
    return;
  }
  const blob = await getFile(song.id);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${song.title}.mp3`;
  document.body.append(a); a.click(); a.remove();
}

function onEnded() {
  if (state.repeat && state.currentSongId) return playSong(state.currentSongId);
  const next = state.queue.shift();
  if (next) playSong(next);
  persist(); render();
}

function shuffleQueue() {
  for (let i = state.queue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.queue[i], state.queue[j]] = [state.queue[j], state.queue[i]];
  }
  persist(); render();
}

async function importSpotify(url) {
  const r = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
  if (!r.ok) throw new Error("Spotify metadata import failed");
  const d = await r.json();
  state.songs.push({ id: xid(), title: d.title || "Spotify Item", artist: d.author_name || "Spotify", source: "url", url: "" });
  persist(); render();
}

async function importYouTube(url) {
  const r = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
  if (!r.ok) throw new Error("YouTube metadata import failed");
  const d = await r.json();
  state.songs.push({ id: xid(), title: d.title || "YouTube Item", artist: d.author_name || "YouTube", source: "url", url: "" });
  persist(); render();
}

function render() {
  const q = (ui.search.value || "").toLowerCase();
  const songs = state.songs.filter(s => `${s.title} ${s.artist}`.toLowerCase().includes(q));
  ui.songList.innerHTML = songs.map(s => `<li><div class="song-head"><strong>${esc(s.title)}</strong><span class="muted">${esc(s.artist)}</span></div><div class="inline"><button data-play="${s.id}">Play</button><button data-queue="${s.id}">Queue</button><button data-download="${s.id}">Download</button><button data-remove="${s.id}">Delete</button></div></li>`).join("");
  ui.queueList.innerHTML = state.queue.map(id => { const s = findSong(id); return s ? `<li>${esc(s.title)} <span class="muted">${esc(s.artist)}</span></li>` : ""; }).join("");
  ui.repeatBtn.textContent = `Repeat: ${state.repeat ? "On" : "Off"}`;

  ui.songList.querySelectorAll("button").forEach(btn => {
    if (btn.dataset.play) btn.onclick = () => playSong(btn.dataset.play);
    if (btn.dataset.queue) btn.onclick = () => queueSong(btn.dataset.queue);
    if (btn.dataset.download) btn.onclick = () => downloadSong(findSong(btn.dataset.download));
    if (btn.dataset.remove) btn.onclick = () => removeSong(btn.dataset.remove);
  });
}

ui.songForm.addEventListener("submit", e => { e.preventDefault(); addUrlSong({ title: ui.title.value, artist: ui.artist.value, url: ui.url.value }); ui.songForm.reset(); });
ui.fileInput.addEventListener("change", async () => { for (const f of ui.fileInput.files) await addUploadedFile(f); ui.fileInput.value = ""; });
ui.search.addEventListener("input", render);
ui.shuffleBtn.addEventListener("click", shuffleQueue);
ui.repeatBtn.addEventListener("click", () => { state.repeat = !state.repeat; persist(); render(); });
ui.clearLibraryBtn.addEventListener("click", () => { state = { songs: [], queue: [], repeat: false, currentSongId: null }; persist(); render(); });
ui.audio.addEventListener("ended", onEnded);
ui.importJsonBtn.addEventListener("click", () => { try { const arr = JSON.parse(ui.importText.value); if (!Array.isArray(arr)) throw new Error("JSON must be array"); arr.forEach(x => x?.title && addUrlSong({ title: x.title, artist: x.artist || "Unknown", url: x.url || "" })); } catch (err) { alert(err.message); } });
ui.importSpotifyBtn.addEventListener("click", async () => { try { await importSpotify(ui.spotifyLink.value.trim()); } catch (err) { alert(err.message); } });
ui.importYouTubeBtn.addEventListener("click", async () => { try { await importYouTube(ui.youtubeLink.value.trim()); } catch (err) { alert(err.message); } });

themeSelect?.addEventListener("change", () => applyTheme(themeSelect.value));
designButtons.forEach(btn => btn.addEventListener("click", () => applyDesign(btn.dataset.design)));

const savedTheme = localStorage.getItem("ffm_theme") || "midnight";
const savedDesign = localStorage.getItem("ffm_design") || "glass";
if (themeSelect) themeSelect.value = savedTheme;
applyTheme(savedTheme);
applyDesign(savedDesign);

openDb().then(result => { db = result; render(); }).catch(err => alert(`IndexedDB error: ${err.message}`));
