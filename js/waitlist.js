// The waitlist forms ([data-waitlist]): one Firestore create per email, no backend.
// Firebase is loaded on first interaction, so it costs nothing for people who only scroll.
import { firebaseConfig, RECAPTCHA_SITE_KEY } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/11.10.0/';
// Same shape the security rule checks; it also caps the length at 254.
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const TIMEOUT_MS = 12000;

let ready = null;
function firebase() {
  ready ??= (async () => {
    const [{ initializeApp }, fs] = await Promise.all([
      import(SDK + 'firebase-app.js'),
      import(SDK + 'firebase-firestore.js'),
    ]);
    const app = initializeApp(firebaseConfig);
    // App Check is enforced on Firestore: it must be up before the first write.
    if (!RECAPTCHA_SITE_KEY.startsWith('TODO')) {
      const { initializeAppCheck, ReCaptchaEnterpriseProvider } = await import(SDK + 'firebase-app-check.js');
      initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY), isTokenAutoRefreshEnabled: true });
    }
    return { fs, db: fs.getFirestore(app) };
  })();
  ready.catch(() => (ready = null)); // a failed load (offline, blocked) can be retried
  return ready;
}

async function join(email) {
  const { fs, db } = await firebase();
  // The rule allows create only, with exactly these keys, email == the doc id, createdAt == request.time.
  const write = fs.setDoc(fs.doc(db, 'waitlist', email), { email, createdAt: fs.serverTimestamp(), source: 'site' });
  let timer;
  const timeout = new Promise((_, fail) => (timer = setTimeout(() => fail(Object.assign(new Error('timeout'), { code: 'unavailable' })), TIMEOUT_MS)));
  try {
    await Promise.race([write, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

for (const form of document.querySelectorAll('[data-waitlist]')) {
  const input = form.querySelector('input[type=email]');
  const button = form.querySelector('button[type=submit]');
  const status = form.querySelector('.wl__status');
  const say = (text, kind) => {
    status.textContent = text;
    status.className = 'wl__status' + (kind ? ' is-' + kind : '');
  };
  const label = button.textContent;
  // Success: the nearest Momo celebrates (js/stage.js listens), and 5 s later the form is fresh again.
  const done = (text) => {
    form.classList.add('is-done');
    say(text, 'ok');
    button.textContent = "You're in";
    button.disabled = true;
    input.readOnly = true;
    form.dispatchEvent(new CustomEvent('waitlist:joined', { bubbles: true }));
    setTimeout(() => {
      status.classList.add('is-fading');
      setTimeout(() => {
        form.reset();
        form.classList.remove('is-done');
        say('');
        button.textContent = label;
        button.disabled = false;
        input.readOnly = false;
      }, 400);
    }, 5000);
  };

  input.addEventListener('focus', () => firebase().catch(() => {}), { once: true }); // warm up
  input.addEventListener('input', () => {
    if (status.classList.contains('is-error')) say('');
    input.removeAttribute('aria-invalid');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (form.classList.contains('is-done') || form.classList.contains('is-busy')) return;
    const email = input.value.trim().toLowerCase();
    if (!email || email.length > 254 || !EMAIL.test(email)) {
      input.setAttribute('aria-invalid', 'true');
      say('That email doesn’t look quite right. Mind checking it?', 'error');
      input.focus();
      return;
    }
    // A filled honeypot is a bot: tell it what it wants to hear, write nothing.
    if (form.querySelector('input[name=website]').value) return done("You're on the list 🎉 See you on launch day.");

    form.classList.add('is-busy');
    button.disabled = true;
    say('Adding you…');
    try {
      await join(email);
      done("You're on the list 🎉 See you on launch day.");
    } catch (err) {
      // Create-only rule: the same email a second time is refused, which means they already joined.
      if (err?.code === 'permission-denied') done("You're already on the list 🎉");
      else {
        button.disabled = false;
        say(
          navigator.onLine === false
            ? 'You look offline. Reconnect and try again.'
            : 'We couldn’t reach the waitlist just now. Please try again in a moment.',
          'error',
        );
      }
    } finally {
      form.classList.remove('is-busy');
    }
  });
}
