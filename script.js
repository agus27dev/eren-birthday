/* ============================================================
   Eren Turning One! — interaksi undangan
   ============================================================ */

const $ = (sel, root = document) => root.querySelector(sel);

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------
   Nama tamu dari URL

   Ketiga bentuk ini menghasilkan nama "Putu":
     eren-birthday.github.io/putu     (butuh 404.html, lihat catatan)
     eren-birthday.github.io/?to=putu
     eren-birthday.github.io/#putu

   Kalau memakai repo project (bukan user site), tambahkan nama repo
   ke IGNORED_SEGMENTS supaya tidak terbaca sebagai nama tamu.
   ------------------------------------------------------------ */
const DEFAULT_GUEST = 'Tamu Istimewa';
const IGNORED_SEGMENTS = ['eren-birthday', 'index.html', '404.html'];

function cleanName(raw) {
  if (!raw) return '';

  let value;
  try {
    value = decodeURIComponent(raw);
  } catch {
    value = raw;
  }

  // Hanya huruf, spasi, tanda hubung, dan apostrof. Pemisah "-"/"_"/"+"
  // dari URL diubah jadi spasi.
  value = value
    .replace(/[-_+]+/g, ' ')
    .replace(/[^\p{L}\s']/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);

  if (!value) return '';

  return value
    .split(' ')
    .map((w) => w.charAt(0).toLocaleUpperCase('id-ID') + w.slice(1))
    .join(' ');
}

function readGuestName() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = cleanName(params.get('to') || params.get('nama'));
  if (fromQuery) return fromQuery;

  const fromHash = cleanName(window.location.hash.replace(/^#\/?/, ''));
  if (fromHash) return fromHash;

  const segment = window.location.pathname
    .split('/')
    .filter(Boolean)
    .pop();

  if (segment && !IGNORED_SEGMENTS.includes(segment.toLowerCase())) {
    const fromPath = cleanName(segment);
    if (fromPath) return fromPath;
  }

  return DEFAULT_GUEST;
}

const guestName = readGuestName();

$('#guestNameEnvelope').textContent = guestName;
$('#guestNameCard').textContent = guestName;

if (guestName !== DEFAULT_GUEST) {
  document.title = `Undangan untuk ${guestName} — Eren Turning One!`;
}

/* ------------------------------------------------------------
   Confetti (canvas, tanpa library)
   ------------------------------------------------------------ */
const canvas = $('#confetti');
const ctx = canvas.getContext('2d');
const COLORS = ['#ffffff', '#9ad4f4', '#6dbeea', '#4aa3d8', '#c3e6fa', '#ffd980', '#ff9f7f'];

let pieces = [];
let rafId = null;

function sizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function addConfetti(count, origin) {
  if (reduceMotion) return;

  const spread = origin ? 70 : window.innerWidth * 0.75;
  const ox = origin ? origin.x : window.innerWidth / 2;
  const oy = origin ? origin.y : window.innerHeight * 0.35;

  for (let i = 0; i < count; i += 1) {
    pieces.push({
      x: ox + (Math.random() - 0.5) * spread,
      y: oy + (Math.random() - 0.5) * 50,
      w: 6 + Math.random() * 7,
      h: 9 + Math.random() * 10,
      vx: (Math.random() - 0.5) * 7,
      vy: -4 - Math.random() * 8,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.32,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      life: 1,
    });
  }

  if (!rafId) rafId = requestAnimationFrame(render);
}

function render() {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  pieces = pieces.filter((p) => p.life > 0 && p.y < window.innerHeight + 80);

  pieces.forEach((p) => {
    p.vy += 0.17;
    p.vx *= 0.99;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    if (p.y > window.innerHeight * 0.7) p.life -= 0.013;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = Math.max(p.life, 0);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.restore();
  });

  if (pieces.length) {
    rafId = requestAnimationFrame(render);
  } else {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    rafId = null;
  }
}

/* ------------------------------------------------------------
   Suara ringan (WebAudio, dibuat saat ada interaksi)
   ------------------------------------------------------------ */
const sound = {
  actx: null,

  ensure() {
    if (!this.actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.actx = new AC();
    }
    if (this.actx.state === 'suspended') this.actx.resume();
    return true;
  },

  blip(freq = 660, dur = 0.14, type = 'triangle') {
    if (!this.ensure()) return;
    const t = this.actx.currentTime;
    const osc = this.actx.createOscillator();
    const gain = this.actx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.14, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.actx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  },

  fanfare() {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this.blip(f, 0.22, 'triangle'), i * 120);
    });
  },
};

/* ------------------------------------------------------------
   Buka amplop
   ------------------------------------------------------------ */
const stageEnvelope = $('#stageEnvelope');
const stageCard = $('#stageCard');
const envelope = $('#envelope');
const sealBtn = $('#sealBtn');

const flap = $('.envelope__flap');

let opened = false;
let revealed = false;

// Idempoten: dipanggil oleh timer, transitionend, atau visibilitychange —
// mana pun yang lebih dulu. Tab latar menahan timer, jadi jangan
// mengandalkan setTimeout sebagai satu-satunya pemicu.
function showCard() {
  if (revealed || !opened) return;
  revealed = true;

  stageEnvelope.hidden = true;
  stageCard.hidden = false;
  stageEnvelope.classList.remove('is-leaving');
  window.scrollTo(0, 0);
  addConfetti(150);
}

function openInvitation() {
  if (opened) return;
  opened = true;

  const r = sealBtn.getBoundingClientRect();
  addConfetti(60, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
  sound.blip(880, 0.12, 'square');
  envelope.classList.add('is-open');
  setTimeout(() => sound.fanfare(), 260);

  if (reduceMotion) {
    showCard();
    return;
  }

  setTimeout(() => {
    if (!revealed) stageEnvelope.classList.add('is-leaving');
  }, 900);

  setTimeout(showCard, 1350);
}

sealBtn.addEventListener('click', openInvitation);

// Tutup amplop selesai berputar: cadangan kalau timer tertahan.
flap.addEventListener('transitionend', (e) => {
  if (e.propertyName !== 'transform') return;
  setTimeout(showCard, 420);
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') showCard();
});

/* ------------------------------------------------------------
   Foto: fallback kalau file belum ada
   ------------------------------------------------------------ */
const photo = $('#erenPhoto');
const photoFrame = $('#photoFrame');

function markPhotoMissing() {
  photo.classList.add('is-missing');
  photoFrame.classList.add('is-empty');
}

photo.addEventListener('error', markPhotoMissing);

// Skrip dimuat di akhir body, jadi event 'error' bisa sudah terlewat.
if (photo.complete && photo.naturalWidth === 0) markPhotoMissing();

/* ------------------------------------------------------------
   Ulangi kejutan
   ------------------------------------------------------------ */
$('#replayBtn').addEventListener('click', () => {
  opened = false;
  revealed = false;
  envelope.classList.remove('is-open');
  stageEnvelope.classList.remove('is-leaving');
  stageCard.hidden = true;
  stageEnvelope.hidden = false;
  window.scrollTo(0, 0);
});

/* ------------------------------------------------------------
   Init
   ------------------------------------------------------------ */
sizeCanvas();
window.addEventListener('resize', sizeCanvas);
