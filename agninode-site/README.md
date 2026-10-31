# AgniNode website and dashboard
Static site (HTML, CSS, JavaScript) on Firebase Hosting, with Firebase Auth and Firestore. No build step.

public/index.html       product page (SEO, JSON-LD, Open Graph)
public/login.html       Firebase email/password login
public/dashboard.html   protected dashboard (redirects to login when signed out)
public/js/config.js     PUT YOUR FIREBASE CONFIG HERE (demo mode until you do)
firestore.rules         role-based security (viewer, operator, admin, device)

Setup: 1) edit js/config.js  2) enable Email/Password in Firebase Auth  3) create users/{uid} docs with a "role" field
4) replace YOUR-DOMAIN.com in index.html, robots.txt, sitemap.xml  5) add public/og-image.png (1200x630)
6) npm i -g firebase-tools && firebase login && firebase deploy

Firestore data: devices/{id} (name, location, status, temperature, humidity, smoke, updatedAt),
devices/{id}/telemetry/* (ts, temperature, humidity, smoke, status), config/thresholds, users/{uid}.
The ESP32 gateway signs in as a user with role "device" and writes both the device doc and a telemetry record.
