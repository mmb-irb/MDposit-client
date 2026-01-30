'{{imports}}';

const MINUTE = 60; // seconds
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

// https://developers.google.com/web/tools/workbox/modules/workbox-core#skip_waiting_and_clients_claim
workbox.core.skipWaiting();
workbox.core.clientsClaim();

// https://developers.google.com/web/tools/workbox/modules/workbox-precaching#reading_precached_assets_directly
workbox.precaching.cleanupOutdatedCaches();

// https://developers.google.com/web/tools/workbox/modules/workbox-precaching#serving_precached_responses
workbox.precaching.precacheAndRoute('{{precache}}', {}); // content will be injected here

// navigation route (any navigation request to any part of the scope of the service worker)
workbox.routing.registerNavigationRoute(
  workbox.precaching.getCacheKeyForURL('./index.html'),
  {
    blacklist: [
      /^\/_/,
      /\/[^\/]+\.[^\/]+$/,
      /\/api\//, // avoid responding to /api, because it should be outside of the scope of that service worker
      /\/optimade\//, // avoid responding to /optimade, because it should be outside of the scope of that service worker
      /\/vre_lite\//, /\/vre\//, // exclude the VRE from the scope of the service worker
      /\/minio\//, // exclude MinIO from the scope of the service worker
      /\/auth\//, /\/vault\//, // These two were requested by Josep Lluís Gelpi
    ],
  },
);

// routing recipes
// see: https://developers.google.com/web/tools/workbox/guides/common-recipes
// images - Cache First
workbox.routing.registerRoute(
  /\.(?:png|gif|jpg|jpeg|webp|svg|ico)$/,
  new workbox.strategies.CacheFirst({
    cacheName: 'images',
    plugins: [
      new workbox.expiration.Plugin({
        maxEntries: 100,
        maxAgeSeconds: 40 * DAY,
      }),
    ],
  }),
);

// external images - Cache First
workbox.routing.registerRoute(
  /^https?:\/\/.*?\.(?:png|gif|jpg|jpeg|webp|svg)$/,
  new workbox.strategies.CacheFirst({
    cacheName: 'external-images',
    plugins: [
      new workbox.cacheableResponse.Plugin({ statuses: [0, 200] }),
      new workbox.expiration.Plugin({
        maxEntries: 10,
        maxAgeSeconds: 20 * DAY,
        purgeOnQuotaError: true,
      }),
    ],
  }),
);

// static assets - Cache First
// (usually, just fonts then, since images are handled before)
workbox.routing.registerRoute(
  /\/static\//,
  new workbox.strategies.CacheFirst({
    cacheName: 'static',
    plugins: [
      new workbox.expiration.Plugin({
        maxEntries: 30,
        maxAgeSeconds: 10 * WEEK,
        // it's alright if it's purged, we're using display-font: swap anyway
        purgeOnQuotaError: true,
      }),
    ],
  }),
);

// api calls - Stale While Revalidate
// (except for trajectory files, because of ranged requests)
workbox.routing.registerRoute(
  // the missing "t" below is on purpose!!! Do not think you need to fix it!
  // It's to get basically, anything not finishing by "ajectory", or
  // "ajectory.bin", or "ajectory.trj", or "ajectory.traj"
  /^https?:\/\/mmb.irbbarcelona.org\/.*\/api\/rest\/(.(?!rajectory(\.(tra?j|bin))?$))+$/,
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: 'api-calls',
    plugins: [
      new workbox.expiration.Plugin({
        maxEntries: 100,
        maxAgeSeconds: 40 * DAY,
        purgeOnQuotaError: true,
      }),
    ],
  }),
);
