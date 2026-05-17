self.addEventListener("install", (event) => {
  console.log("Service Worker installed");
});

self.addEventListener("activate", (event) => {
  console.log("Service Worker activated");
});

self.addEventListener("fetch", (event) => {
  // Standard pass-through fetch handler to guarantee PWA compliance
  event.respondWith(fetch(event.request));
});
