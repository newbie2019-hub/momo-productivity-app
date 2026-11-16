// Firebase web config for the waitlist form (js/waitlist.js). These values are public by design:
// access is controlled by the Firestore rule on `waitlist/{email}` (create-only, exactly
// { email, createdAt, source }, email == doc id) and by App Check.
export const firebaseConfig = {
  apiKey: 'AIzaSyDKnqmbxN0suMzK3Wc171tXv9trUhEQgj0',
  authDomain: 'momo-productivty-app.firebaseapp.com',
  projectId: 'momo-productivty-app',
  storageBucket: 'momo-productivty-app.firebasestorage.app',
  messagingSenderId: '221812458555',
  appId: '1:221812458555:web:81780c15539230f086c81e',
};

// App Check is ENFORCED on Firestore, so every write needs a reCAPTCHA Enterprise token. This key
// is registered in App Check for the Momo Site web app; its allowed domains are
// momo-pomodoro.cloud, www.momo-pomodoro.cloud and localhost (so local testing uses the real
// provider, no debug token). Serving from any other host makes writes fail with permission-denied.
// If this is ever reset to a 'TODO…' placeholder, App Check init is skipped so the page still loads.
export const RECAPTCHA_SITE_KEY = '6LejQSMuAAAAABp-5gFIA65nAPJoG1lstEAJlo2d';
