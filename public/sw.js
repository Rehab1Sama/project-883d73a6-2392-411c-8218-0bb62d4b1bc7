// خدمة عامل بسيطة: تخزين قشرة التطبيق فقط — البيانات دائماً من الشبكة
const CACHE = "suhub-shell-v1";
const SHELL = ["/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/favicon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // الأصول الثابتة فقط تُخدم من الذاكرة عند تعذّر الشبكة
  if (!SHELL.includes(url.pathname)) return;
  event.respondWith(caches.match(req).then((hit) => hit ?? fetch(req)));
});
