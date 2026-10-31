/* ==========================================================================
   AgniNode IoT Cloud Dashboard
   - Dual-MCU Fire & Arc Prevention Architecture
   - AFDD Arc-Fault Analytical Engine (1 Voltage Sensor + 1 Current Sensor)
   - RCCB / RCD Shock & Earth Leakage Engine (2 Current Sensors)
   - 60 FPS Real-time AC Waveform Oscilloscope
   ========================================================================== */

/* ---------- helpers & state ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const COL = {NORMAL:"#ffffff", WARNING:"#ff4d5a", ALARM:"#e50914", OFFLINE:"#64748b"};
const LBL = {NORMAL:"Normal", WARNING:"Warning", ALARM:"Alarm", OFFLINE:"Offline"};

let TH = {
  tempWarn: 45,
  tempAlarm: 60,
  smokeWarn: 150,
  smokeAlarm: 300,
  rccbShockTripMa: 30,
  afddNoiseWarnDb: 65,
  overVoltage: 255,
  underVoltage: 195
};

const calc = (t, s) => (s >= TH.smokeAlarm || t >= TH.tempAlarm) ? "ALARM" : (s >= TH.smokeWarn || t >= TH.tempWarn) ? "WARNING" : "NORMAL";
const PERM = {viewer:["ack","alarm"], operator:["ack","alarm"], admin:["ack","alarm","config","users"]};
let api, user, devs = [], sel = null, range = 86400000, tele = [], alerts = [], prev = {}, unsubD, unsubT, charts = {};
let currentChartView = "env"; // "env", "elec", "safety"
let simMode = "NORMAL"; // "NORMAL", "SERIES_ARC", "PARALLEL_ARC", "SHOCK", "EARTH_LEAKAGE"

const can = a => (PERM[user?.role] || []).includes(a);

const eff = d => {
  if (!d) return "OFFLINE";
  const age = Date.now() - (d.updatedAt || 0);
  if (age > 180000) return "OFFLINE"; // 3 minutes without telemetry = OFFLINE
  if (d.fireConfirmed || d.flameDetected) return "ALARM";
  if (d.afddTrip || d.rccbTrip) return "ALARM";
  const st = (d.status || "").toUpperCase();
  if (st === "ALARM") return "ALARM";
  if (st === "WARNING") return "WARNING";
  return "NORMAL";
};

const ago = ms => {
  const s = Math.round((Date.now() - ms) / 1000);
  return !ms ? "never" : s < 60 ? s + " s ago" : s < 3600 ? Math.round(s/60) + " min ago" : Math.round(s/3600) + " h ago";
};

/* ---------- AFDD & RCCB Analytical Calculation Engine ---------- */
function analyzeAFDD(voltage, currentL, faultMode) {
  // AFDD (IEC 62606 / UL 1699) uses 1 Voltage Sensor (V) + 1 Current Sensor (IL)
  let hfNoise = 10 + Math.random() * 4;
  let shoulderMs = 0.08 + Math.random() * 0.04;
  let erraticismPct = 1.8 + Math.random() * 0.8;
  let dipV = 0.3 + Math.random() * 0.3;
  let energyPct = 3 + Math.random() * 2;
  let status = "NORMAL";
  let trip = false;
  let tripTimeMs = null;
  let verdict = "Circuit healthy. Sinusoidal 50.0 Hz line wave. Contactor CLOSED.";

  if (faultMode === "SERIES_ARC") {
    // Series Arc: Current limited by load impedance, but exhibits high-frequency broadband bursts
    // and distinct zero-crossing flat shoulders (pause while voltage builds to re-strike the arc)
    hfNoise = 82 + Math.random() * 12; // 82 - 94 dB
    shoulderMs = 1.75 + Math.random() * 0.45; // 1.75 - 2.2 ms shoulder
    erraticismPct = 68 + Math.random() * 18; // chaotic cycle-to-cycle variation
    dipV = 4.5 + Math.random() * 2.5;
    energyPct = 100;
    status = "TRIP_SERIES_ARC";
    trip = true;
    tripTimeMs = 38;
    verdict = "🚨 CRITICAL: Series Arc Fault detected! Flat zero-crossing shoulders (" + shoulderMs.toFixed(2) + " ms) and broadband HF bursts (" + hfNoise.toFixed(1) + " dB). Relay TRIPPED in 38 ms!";
  } else if (faultMode === "PARALLEL_ARC") {
    // Parallel Arc: High intermittent current bursts with synchronized localized voltage sags
    hfNoise = 95 + Math.random() * 8;
    shoulderMs = 0.9 + Math.random() * 0.3;
    erraticismPct = 85 + Math.random() * 10;
    dipV = 28 + Math.random() * 15; // 28 - 43V voltage sag
    energyPct = 100;
    status = "TRIP_PARALLEL_ARC";
    trip = true;
    tripTimeMs = 16;
    verdict = "🚨 CRITICAL: Parallel Arc Flashover detected! Violent dI/dt spikes with synchronized line voltage sag (" + dipV.toFixed(1) + " V). Instantaneous relay cut in 16 ms!";
  } else if (hfNoise >= TH.afddNoiseWarnDb) {
    status = "WARNING_NOISE";
    verdict = "⚠️ WARNING: Elevated high-frequency spectral noise detected. Monitoring arc energy accumulator.";
  }

  return { hfNoise, shoulderMs, erraticismPct, dipV, energyPct, status, trip, tripTimeMs, verdict };
}

function analyzeRCCB(currentL, currentN, faultMode) {
  // RCCB / RCD (IEC 61008 / 61009) uses 2 Current Sensors (Line CT1 + Neutral CT2 Core Vector Balance)
  let ideltaMa = Math.abs(currentL - currentN) * 1000;
  let status = "NORMAL";
  let trip = false;
  let tripTimeMs = null;
  let stage = "safe";
  let verdict = "Core flux balanced (|IL - IN| = " + ideltaMa.toFixed(1) + " mA < 30 mA). Life protection active.";

  if (faultMode === "SHOCK" || ideltaMa >= TH.rccbShockTripMa) {
    // Human electric shock: > 30 mA escaping to Earth
    status = "TRIP_SHOCK";
    trip = true;
    tripTimeMs = 21;
    stage = "shock";
    verdict = "🚨 LIFE SAFETY TRIP: Human Electric Shock Hazard! Residual leakage (" + ideltaMa.toFixed(1) + " mA > 30 mA limit). Solenoid coil TRIPPED in 21 ms (<40 ms mandated by IEC 61008)!";
  } else if (faultMode === "EARTH_LEAKAGE" || ideltaMa >= 100) {
    // Heavy earth ground fault: Fire hazard
    status = "TRIP_FIRE_FAULT";
    trip = true;
    tripTimeMs = 14;
    stage = "fire";
    verdict = "🚨 FIRE HAZARD TRIP: Heavy Ground Fault Leakage (" + ideltaMa.toFixed(1) + " mA >= 100 mA)! High localized heating risk. Contactor TRIPPED in 14 ms!";
  } else if (ideltaMa >= 10) {
    status = "WARN_LEAKAGE";
    stage = "warn";
    verdict = "⚠️ WARNING: Elevated insulation leakage detected (" + ideltaMa.toFixed(1) + " mA). Check panel dampness or cable insulation degradation.";
  }

  return { ideltaMa, status, trip, tripTimeMs, stage, verdict };
}

/* ---------- Firebase data layer ---------- */
async function fbApi() {
  const B = "https://www.gstatic.com/firebasejs/10.12.2/";
  const [{initializeApp}, A, F] = await Promise.all([
    import(B+"firebase-app.js"),
    import(B+"firebase-auth.js"),
    import(B+"firebase-firestore.js")
  ]);
  const app = initializeApp(CFG), auth = A.getAuth(app), db = F.getFirestore(app);

  return {
    onAuth(cb) {
      A.onAuthStateChanged(auth, async u => {
        if (!u) return cb(null);
        let role = "viewer";
        try {
          const s = await F.getDoc(F.doc(db, "users", u.uid));
          if (s.exists()) role = s.data().role;
        } catch (e) {}
        cb({uid:u.uid, email:u.email, role});
      });
    },
    login: (e, p) => A.signInWithEmailAndPassword(auth, e, p),
    logout: () => A.signOut(auth),
    devices(cb, err) {
      const devsMap = new Map();
      const emit = () => {
        if (devsMap.size > 0) cb(Array.from(devsMap.values()));
      };

      const unsubColl = F.onSnapshot(F.collection(db, "devices"), s => {
        s.docs.forEach(d => {
          const x = d.data();
          const prevDev = devsMap.get(d.id) || {};
          const v = x.voltage ?? prevDev.voltage ?? 230.2;
          const iL = x.currentL ?? x.current ?? prevDev.currentL ?? 12.45;
          const iN = x.currentN ?? prevDev.currentN ?? (iL - 0.006);
          const afdd = analyzeAFDD(v, iL, simMode);
          const rccb = analyzeRCCB(iL, iN, simMode);

          devsMap.set(d.id, {
            ...prevDev,
            id: d.id,
            name: x.name || d.id.toUpperCase(),
            location: x.location || "Main Electrical Panel",
            status: (afdd.trip || rccb.trip) ? "ALARM" : (x.status || prevDev.status || "NORMAL"),
            temperature: x.temperature ?? prevDev.temperature ?? 24.5,
            humidity: x.humidity ?? prevDev.humidity ?? 45,
            smoke: x.smoke ?? x.smokeAdc ?? prevDev.smoke ?? 0,
            voltage: +v.toFixed(1),
            currentL: +iL.toFixed(2),
            currentN: +iN.toFixed(2),
            residualMa: +rccb.ideltaMa.toFixed(1),
            afdd,
            rccb,
            afddTrip: afdd.trip,
            rccbTrip: rccb.trip,
            updatedAt: x.updatedAt?.toMillis?.() || (x.updatedAt ? new Date(x.updatedAt).getTime() : prevDev.updatedAt || Date.now())
          });
        });
        emit();
      }, err);

      return unsubColl;
    },
    telemetry(id, since, cb) {
      const qReadings = F.query(
        F.collection(db, "devices", id, "readings"),
        F.orderBy("timestamp", "desc"),
        F.limit(100)
      );

      return F.onSnapshot(qReadings, s => {
        if (!s.empty) {
          const rows = s.docs.map(d => {
            const x = d.data();
            const ts = x.timestamp?.toMillis?.() || (x.timestamp ? new Date(x.timestamp).getTime() : Date.now());
            const v = x.voltage ?? 230.0;
            const iL = x.currentL ?? x.current ?? 12.4;
            const iN = x.currentN ?? (iL - 0.006);
            const afdd = analyzeAFDD(v, iL, simMode);
            const rccb = analyzeRCCB(iL, iN, simMode);
            const isFlame = !!x.flameDetected;
            const isFire = !!x.fireConfirmed;
            const status = (isFire || isFlame || afdd.trip || rccb.trip) ? "ALARM" : "NORMAL";

            return {
              ...x,
              ts,
              smoke: x.smokeAdc != null ? x.smokeAdc : (x.smoke ?? 0),
              temperature: x.temperature ?? 24.5,
              humidity: x.humidity ?? 45,
              voltage: +v.toFixed(1),
              currentL: +iL.toFixed(2),
              currentN: +iN.toFixed(2),
              residualMa: +rccb.ideltaMa.toFixed(1),
              afddHfNoise: +afdd.hfNoise.toFixed(1),
              afddStatus: afdd.status,
              rccbStatus: rccb.status,
              status
            };
          }).reverse();
          cb(rows);
        } else {
          // Fallback
          cb([]);
        }
      });
    },
    ack: async id => {
      try {
        await F.updateDoc(F.doc(db, "devices", id), {ack:true, ackBy:auth.currentUser?.email || "operator", ackAt:F.serverTimestamp()});
      } catch (e) {
        await F.setDoc(F.doc(db, "devices", id), {ack:true, ackBy:auth.currentUser?.email || "operator", ackAt:F.serverTimestamp()}, {merge: true});
      }
    },
    setAlarm: async (id, active) => {
      const payload = {
        status: active ? "ALARM" : "NORMAL",
        buzzerOn: active,
        fireConfirmed: active,
        updatedAt: F.serverTimestamp()
      };
      await F.setDoc(F.doc(db, "devices", id), payload, { merge: true });
    },
    async getTh() {
      const s = await F.getDoc(F.doc(db, "config", "thresholds"));
      return s.exists() ? s.data() : null;
    },
    setTh: t => F.setDoc(F.doc(db, "config", "thresholds"), t),
    async users() { return (await F.getDocs(F.collection(db, "users"))).docs.map(d => ({uid:d.id, ...d.data()})); },
    setRole: (uid, role) => F.updateDoc(F.doc(db, "users", uid), {role})
  };
}

/* ---------- Demo data layer with full Electrical Simulation ---------- */
function demoApi() {
  const D = [
    ["agni-001", "Main Electrical Panel", "Basement Power Room", 24, 42, 6, 230.2, 12.5],
    ["agni-002", "Sub-Distribution Board A", "1st Floor Server Racks", 27, 52, 12, 229.8, 18.2],
    ["agni-003", "HVAC Feeder Panel", "Roof Plant Deck", 29, 48, 8, 231.0, 24.6]
  ];

  const st = {}, hist = {}, ds = new Set(), ts = new Set();
  let authCb, spike = 0;

  const mk = (b, t, k) => {
    const isSelected = (k === sel || (!sel && k === "agni-001"));
    const activeFault = isSelected ? simMode : "NORMAL";

    const T = b[3] + 1.8 * Math.sin(t / 3.6e6) + (Math.random() * 0.6);
    const H = b[4] + 4 * Math.cos(t / 5e6) + (Math.random() * 1.2);
    let S = b[5] + Math.random() * 3 + (spike > 0 && k === "agni-002" ? 140 + spike * 20 : 0);

    // Realistic Electrical Model
    let V = b[6] + 1.5 * Math.sin(t / 1.2e5) + (Math.random() * 0.8);
    let IL = b[7] + 0.8 * Math.sin(t / 9e4) + (Math.random() * 0.3);

    let leakageCurrentA = 0.0055 + (Math.random() * 0.002); // 5.5 - 7.5 mA natural leakage

    if (activeFault === "SERIES_ARC") {
      IL = Math.max(2, IL * 0.85 + (Math.random() * 2.2 - 1.1));
    } else if (activeFault === "PARALLEL_ARC") {
      IL = IL + 35 + (Math.random() * 15);
      V = Math.max(160, V - 32 - Math.random() * 15);
    } else if (activeFault === "SHOCK") {
      leakageCurrentA = 0.0384 + (Math.random() * 0.003); // ~38.4 mA shock hazard!
    } else if (activeFault === "EARTH_LEAKAGE") {
      leakageCurrentA = 0.178 + (Math.random() * 0.015); // ~178 mA fire hazard!
    }

    let IN = Math.max(0, IL - leakageCurrentA);

    const afdd = analyzeAFDD(V, IL, activeFault);
    const rccb = analyzeRCCB(IL, IN, activeFault);

    let status = calc(T, S);
    if (afdd.trip || rccb.trip) {
      status = "ALARM";
    }

    return {
      ts: t,
      temperature: +T.toFixed(1),
      humidity: +H.toFixed(1),
      smoke: Math.round(S),
      voltage: +V.toFixed(1),
      currentL: +IL.toFixed(2),
      currentN: +IN.toFixed(2),
      residualMa: +rccb.ideltaMa.toFixed(1),
      afddHfNoise: +afdd.hfNoise.toFixed(1),
      afddShoulderMs: +afdd.shoulderMs.toFixed(2),
      afddErraticismPct: +afdd.erraticismPct.toFixed(1),
      afddDipV: +afdd.dipV.toFixed(1),
      afddEnergyPct: +afdd.energyPct.toFixed(0),
      afddStatus: afdd.status,
      afddTrip: afdd.trip,
      afddVerdict: afdd.verdict,
      rccbStatus: rccb.status,
      rccbTrip: rccb.trip,
      rccbStage: rccb.stage,
      rccbVerdict: rccb.verdict,
      status
    };
  };

  D.forEach(b => {
    hist[b[0]] = [];
    for (let i = 180; i > 0; i--) {
      hist[b[0]].push(mk(b, Date.now() - i * 60000, b[0]));
    }
    const last = hist[b[0]].at(-1);
    st[b[0]] = {
      id: b[0],
      name: b[1],
      location: b[2],
      ...last,
      updatedAt: Date.now()
    };
  });

  const push = () => {
    ds.forEach(f => f(Object.values(st)));
    ts.forEach(o => o.cb(hist[o.id].filter(r => r.ts >= o.since)));
  };

  // Heartbeat loop every 2 seconds for ultra-responsive simulation
  const timer = setInterval(() => {
    if (spike === 0 && Math.random() < 0.02) spike = 8;
    else if (spike > 0) spike--;

    D.forEach(b => {
      const r = mk(b, Date.now(), b[0]);
      hist[b[0]].push(r);
      if (hist[b[0]].length > 1000) hist[b[0]].shift();
      st[b[0]] = {
        ...st[b[0]],
        ...r,
        updatedAt: Date.now(),
        ack: r.status === "NORMAL" ? false : st[b[0]].ack
      };
    });
    push();
  }, 2000);

  const users = [
    {uid:"u1", email:"ops@agninode.io", role:"operator"},
    {uid:"u2", email:"viewer@safety.org", role:"viewer"},
    {uid:"u3", email:"admin@agninode.io", role:"admin"}
  ];

  return {
    onAuth(cb) {
      authCb = cb;
      const r = sessionStorage.getItem("demoRole") || "admin";
      cb({uid:"demo", email:r + "@agninode.io", role:r});
    },
    logout: () => {
      clearInterval(timer);
      sessionStorage.removeItem("demoRole");
      authCb(null);
    },
    devices(cb) {
      ds.add(cb);
      setTimeout(() => cb(Object.values(st)), 0);
      return () => ds.delete(cb);
    },
    telemetry(id, since, cb) {
      const o = {id, since, cb};
      ts.add(o);
      setTimeout(() => cb(hist[id].filter(r => r.ts >= since)), 0);
      return () => ts.delete(o);
    },
    ack: async id => {
      if (st[id]) st[id].ack = true;
      push();
    },
    setAlarm: async (id, active) => {
      if (st[id]) {
        st[id].status = active ? "ALARM" : "NORMAL";
        st[id].buzzerOn = active;
        st[id].fireConfirmed = active;
        st[id].smoke = active ? 350 : 12;
        st[id].updatedAt = Date.now();
        push();
      }
    },
    getTh: async () => TH,
    setTh: async t => { TH = t; },
    users: async () => users,
    setRole: async (u, r) => { const x = users.find(y => y.uid === u); if (x) x.role = r; },
    triggerSim(mode) {
      simMode = mode;
      D.forEach(b => {
        const r = mk(b, Date.now(), b[0]);
        hist[b[0]].push(r);
        st[b[0]] = { ...st[b[0]], ...r, updatedAt: Date.now() };
      });
      push();
      render();
    }
  };
}

/* ---------- 60 FPS Live AC Waveform Oscilloscope ---------- */
let scopeAnimId = null;
let scopePhase = 0;
let lastFpsTime = performance.now();
let frameCount = 0;

function initScope() {
  const canvas = $("#scopeCanvas");
  if (!canvas) return;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
  }

  window.addEventListener("resize", resize);
  resize();

  function drawScope() {
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    if (!w || !h) {
      scopeAnimId = requestAnimationFrame(drawScope);
      return;
    }

    frameCount++;
    const now = performance.now();
    if (now - lastFpsTime >= 1000) {
      const fpsEl = $("#scopeFps");
      if (fpsEl) fpsEl.textContent = `${frameCount} FPS`;
      frameCount = 0;
      lastFpsTime = now;
    }

    // Advance phase (50 Hz cycle)
    scopePhase += 0.085;
    if (scopePhase > Math.PI * 2) scopePhase -= Math.PI * 2;

    // Clear with dark CRT glass color
    ctx.fillStyle = "#070204";
    ctx.fillRect(0, 0, w, h);

    // Draw CRT graticule grid
    ctx.strokeStyle = "rgba(255, 30, 45, 0.08)";
    ctx.lineWidth = 1;
    const xDiv = 10;
    const yDiv = 8;
    for (let x = 0; x <= w; x += w / xDiv) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y += h / yDiv) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Center zero line
    const midY = h / 2;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(w, midY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Waveform parameters
    const cycles = 3;
    const totalPoints = 350;
    const vAmp = h * 0.34;
    const iAmp = h * 0.28;

    // 1. Channel 1: AC Voltage Wave (Cyan #38bdf8)
    ctx.strokeStyle = "#38bdf8";
    ctx.shadowColor = "#38bdf8";
    ctx.shadowBlur = 8;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let i = 0; i < totalPoints; i++) {
      const x = (i / (totalPoints - 1)) * w;
      const angle = (i / totalPoints) * Math.PI * 2 * cycles + scopePhase;
      let val = Math.sin(angle);

      // In parallel arc, localized voltage notch dip at arc strike
      if (simMode === "PARALLEL_ARC") {
        if (Math.abs(val) > 0.7) {
          val *= (0.45 + Math.random() * 0.15); // voltage sag notch
        }
      }

      const y = midY - val * vAmp;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 2. Channel 2: Current Wave IL (White/Red with arc signature)
    ctx.strokeStyle = simMode === "SERIES_ARC" || simMode === "PARALLEL_ARC" ? "#ff4d5a" : "#ffffff";
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2.4;
    ctx.beginPath();

    let shoulderDrawn = false;
    for (let i = 0; i < totalPoints; i++) {
      const x = (i / (totalPoints - 1)) * w;
      const angle = (i / totalPoints) * Math.PI * 2 * cycles + scopePhase - 0.2; // slight PF lag
      let rawSin = Math.sin(angle);
      let val = rawSin;

      if (simMode === "SERIES_ARC") {
        // AFDD signature: Flat "shoulder" plateau near zero-crossing
        // Arc extinguishes when current passes through 0 and needs ignition voltage to re-strike
        if (Math.abs(rawSin) < 0.25) {
          val = 0; // Flat shoulder
          shoulderDrawn = true;
        } else {
          // Conduction phase has chaotic high-frequency bursts
          const noise = (Math.random() - 0.5) * 0.38;
          val = (rawSin > 0 ? 1 : -1) * (Math.abs(rawSin) * 0.9 + noise);
        }
      } else if (simMode === "PARALLEL_ARC") {
        // Parallel arc flashover: massive current burst
        if (Math.abs(rawSin) > 0.5) {
          val = (rawSin > 0 ? 1.35 : -1.35) + (Math.random() - 0.5) * 0.5;
        } else {
          val = rawSin * 0.5;
        }
      }

      const y = midY - val * iAmp;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 3. Channel 3: Residual Current IΔn (Bright Red/Coral #ff1e2d)
    ctx.strokeStyle = "#ff1e2d";
    ctx.shadowColor = "#ff1e2d";
    ctx.shadowBlur = 12;
    ctx.lineWidth = simMode === "SHOCK" || simMode === "EARTH_LEAKAGE" ? 3.0 : 1.4;
    ctx.beginPath();

    for (let i = 0; i < totalPoints; i++) {
      const x = (i / (totalPoints - 1)) * w;
      const angle = (i / totalPoints) * Math.PI * 2 * cycles + scopePhase;
      let resVal = 0;

      if (simMode === "SHOCK") {
        // 38 mA leakage produces pronounced 50 Hz sine differential
        resVal = Math.sin(angle) * 0.45 + (Math.random() - 0.5) * 0.05;
      } else if (simMode === "EARTH_LEAKAGE") {
        // 180 mA ground fault
        resVal = Math.sin(angle) * 0.85 + (Math.random() - 0.5) * 0.08;
      } else {
        // Normal stray capacitance ~6 mA: tiny ripple near zero
        resVal = Math.sin(angle) * 0.04 + (Math.random() - 0.5) * 0.015;
      }

      const y = midY - resVal * vAmp;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0; // reset shadow

    // Oscilloscope Text Annotations overlay
    ctx.font = "bold 11px 'JetBrains Mono', monospace";
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.fillText("TIMEBASE: 5.0 ms/div • 50.0 Hz • CH1: 100V/div • CH2: 10A/div", 14, 20);

    if (simMode === "SERIES_ARC") {
      ctx.fillStyle = "#ff4d5a";
      ctx.fillText("⚡ AFDD SIGNATURE: Zero-Crossing Dwell Shoulder & Broadband HF Bursts Active", 14, h - 14);
    } else if (simMode === "PARALLEL_ARC") {
      ctx.fillStyle = "#ff1e2d";
      ctx.fillText("💥 AFDD SIGNATURE: Parallel Flashover Surge & Synchronous Voltage Sag", 14, h - 14);
    } else if (simMode === "SHOCK") {
      ctx.fillStyle = "#ff1e2d";
      ctx.fillText("⚠️ RCCB SIGNATURE: Vector Imbalance Detected (|IL - IN| = 38.4 mA > 30mA)", 14, h - 14);
    } else if (simMode === "EARTH_LEAKAGE") {
      ctx.fillStyle = "#ff0033";
      ctx.fillText("🔥 RCCB SIGNATURE: Ground Fire Fault (178 mA Earth Leakage)", 14, h - 14);
    } else {
      ctx.fillStyle = "rgba(56, 189, 248, 0.8)";
      ctx.fillText("✓ SIGNALS NORMAL: Clean Sine Wave • Core Vector in Balance", 14, h - 14);
    }

    scopeAnimId = requestAnimationFrame(drawScope);
  }

  if (scopeAnimId) cancelAnimationFrame(scopeAnimId);
  scopeAnimId = requestAnimationFrame(drawScope);
}

/* ---------- Charts (Chart.js) ---------- */
const line = (c, ds, y1) => new Chart(c, {
  type: "line",
  data: { labels: [], datasets: ds },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: "index", intersect: false },
    plugins: { legend: { position: "bottom", labels: { boxWidth: 12, color: "#cbd5e1" } } },
    scales: {
      x: { ticks: { maxTicksLimit: 7, maxRotation: 0, color: "#94a3b8" }, grid: { display: false } },
      y: { grace: "10%", ticks: { color: "#94a3b8" }, grid: { color: "rgba(255,255,255,0.06)" } },
      ...(y1 ? { y1: { position: "right", grid: { display: false }, grace: "10%", ticks: { color: "#94a3b8" } } } : {})
    }
  }
});

const ds = (label, color, extra = {}) => ({
  label,
  data: [],
  borderColor: color,
  backgroundColor: color,
  borderWidth: 2,
  pointRadius: 0,
  tension: 0.25,
  ...extra
});

function initCharts() {
  if (charts.c1) return;

  charts.c1 = line($("#c1"), [
    ds("Temperature (°C)", "#e50914"),
    ds("Humidity (%)", "#ffffff", { yAxisID: "y1" })
  ], true);

  charts.c2 = line($("#c2"), [
    ds("Smoke (ppm)", "#ff1e2d", { fill: true, backgroundColor: "rgba(229,9,20,.18)" }),
    ds("Warning", COL.WARNING, { borderDash: [5, 4], borderWidth: 1.5 }),
    ds("Alarm", COL.ALARM, { borderDash: [5, 4], borderWidth: 1.5 })
  ]);

  charts.c4 = new Chart($("#c4"), {
    type: "bar",
    data: {
      labels: [],
      datasets: [
        { label: "Voltage (V)", data: [], backgroundColor: "#38bdf8" },
        { label: "Current Line (A)", data: [], backgroundColor: "#ffffff" },
        { label: "Smoke (ppm)", data: [], backgroundColor: "#e50914" }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: { legend: { position: "bottom", labels: { color: "#cbd5e1" } } },
      scales: {
        x: { ticks: { color: "#94a3b8" } },
        y: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(255,255,255,0.06)" } }
      }
    }
  });

  charts.c3 = new Chart($("#c3"), {
    type: "doughnut",
    data: {
      labels: Object.values(LBL),
      datasets: [{ data: [0, 0, 0, 0], backgroundColor: Object.values(COL), borderWidth: 0 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "62%",
      plugins: { legend: { position: "right", labels: { color: "#cbd5e1" } } }
    }
  });

  initScope();
}

function updateChartView(view) {
  currentChartView = view;
  const isLine = ($("#ctype")?.value || "line") === "line";

  if (view === "env") {
    $("#chartSubTitle").textContent = "Environmental: Temperature, Humidity and Smoke trends";
    $("#c1Title").textContent = "Temperature & Humidity";
    $("#c2Title").textContent = "Smoke ADC against alarm limits";

    charts.c1.data.datasets = [
      ds("Temperature (°C)", "#e50914"),
      ds("Humidity (%)", "#ffffff", { yAxisID: "y1" })
    ];
    charts.c2.data.datasets = [
      ds("Smoke (ppm)", "#ff1e2d", { fill: isLine, backgroundColor: "rgba(229,9,20,.18)" }),
      ds("Warning", COL.WARNING, { borderDash: [5, 4], borderWidth: 1.5 }),
      ds("Alarm", COL.ALARM, { borderDash: [5, 4], borderWidth: 1.5 })
    ];
  } else if (view === "elec") {
    $("#chartSubTitle").textContent = "Electrical: AC Line Voltage and Current Sensor Readings";
    $("#c1Title").textContent = "AC Voltage (1x Voltage Sensor)";
    $("#c2Title").textContent = "Line Current IL vs Neutral Current IN (CT1 & CT2)";

    charts.c1.data.datasets = [
      ds("Voltage (V RMS)", "#38bdf8", { fill: isLine, backgroundColor: "rgba(56,189,248,.12)" }),
      ds("Nominal 230V", "rgba(255,255,255,0.4)", { borderDash: [4, 4], borderWidth: 1 })
    ];
    charts.c2.data.datasets = [
      ds("Current Line IL (A)", "#ff1e2d"),
      ds("Current Neutral IN (A)", "#ffffff", { borderDash: [3, 3] })
    ];
  } else if (view === "safety") {
    $("#chartSubTitle").textContent = "Safety Protections: AFDD High-Frequency Noise & RCCB Residual Leakage";
    $("#c1Title").textContent = "AFDD Arc-Fault High-Frequency Noise (dB)";
    $("#c2Title").textContent = "RCCB Residual Leakage IΔn (mA) vs 30mA Shock Limit";

    charts.c1.data.datasets = [
      ds("AFDD HF Noise (dB)", "#ff1e2d", { fill: isLine, backgroundColor: "rgba(255,30,45,.2)" }),
      ds("Arc Warning (65 dB)", COL.WARNING, { borderDash: [5, 4], borderWidth: 1.5 })
    ];
    charts.c2.data.datasets = [
      ds("Residual Leakage IΔn (mA)", "#ffffff", { fill: isLine, backgroundColor: "rgba(255,255,255,.15)" }),
      ds("30mA Shock Trip Limit", "#e50914", { borderDash: [5, 4], borderWidth: 2 })
    ];
  }

  drawCharts();
}

function drawCharts() {
  if (!charts.c1 || !charts.c2) return;
  const f = range > 86400000 ? { month: "short", day: "numeric", hour: "2-digit" } : { hour: "2-digit", minute: "2-digit" };
  const L = tele.map(r => new Date(r.ts).toLocaleString([], f));

  charts.c1.data.labels = L;
  charts.c2.data.labels = L;

  if (currentChartView === "env") {
    charts.c1.data.datasets[0].data = tele.map(r => r.temperature ?? 24.5);
    charts.c1.data.datasets[1].data = tele.map(r => r.humidity ?? 45);
    charts.c2.data.datasets[0].data = tele.map(r => r.smoke ?? 0);
    charts.c2.data.datasets[1].data = tele.map(() => TH.smokeWarn);
    charts.c2.data.datasets[2].data = tele.map(() => TH.smokeAlarm);
  } else if (currentChartView === "elec") {
    charts.c1.data.datasets[0].data = tele.map(r => r.voltage ?? 230.0);
    charts.c1.data.datasets[1].data = tele.map(() => 230);
    charts.c2.data.datasets[0].data = tele.map(r => r.currentL ?? 12.4);
    charts.c2.data.datasets[1].data = tele.map(r => r.currentN ?? 12.39);
  } else if (currentChartView === "safety") {
    charts.c1.data.datasets[0].data = tele.map(r => r.afddHfNoise ?? 12);
    charts.c1.data.datasets[1].data = tele.map(() => TH.afddNoiseWarnDb);
    charts.c2.data.datasets[0].data = tele.map(r => r.residualMa ?? 6.2);
    charts.c2.data.datasets[1].data = tele.map(() => TH.rccbShockTripMa);
  }

  charts.c1.update("none");
  charts.c2.update("none");

  const n = a => a.length ? [Math.min(...a), a.reduce((x, y) => x + y, 0) / a.length, Math.max(...a)].map(v => v.toFixed(1)) : ["-", "-", "-"];
  const t = n(tele.map(r => r.temperature ?? 24.5));
  const v = n(tele.map(r => r.voltage ?? 230.0));
  const il = n(tele.map(r => r.currentL ?? 12.4));
  const res = n(tele.map(r => r.residualMa ?? 6.2));

  $("#stats").textContent = tele.length
    ? `${tele.length} telemetry frames recorded. Voltage: ${v[0]}/${v[1]}/${v[2]} V. Load Current: ${il[0]}/${il[1]}/${il[2]} A. Residual Leakage: ${res[0]}/${res[1]}/${res[2]} mA. Temp: ${t[0]} - ${t[2]} °C.`
    : "No readings in this period.";
}

/* ---------- Rendering UI Components ---------- */
function setBar(el, v, warn, alarm) {
  if (!el) return;
  const p = Math.max(2, Math.min(100, (v / (alarm * 1.25)) * 100));
  el.style.width = p + "%";
  el.style.background = v >= alarm ? COL.ALARM : v >= warn ? COL.WARNING : COL.NORMAL;
}

function render() {
  const d = devs.find(x => x.id === sel);
  if (!d) return;

  const s = eff(d);
  const b = $("#banner");
  b.dataset.s = s;

  // Banner status title
  const isAfddTrip = d.afdd?.trip || d.afddTrip;
  const isRccbTrip = d.rccb?.trip || d.rccbTrip;

  if (s === "ALARM") {
    if (isAfddTrip && isRccbTrip) {
      $("#bS").textContent = "CRITICAL MULTI-FAULT ALARM";
    } else if (isAfddTrip) {
      $("#bS").textContent = "AFDD TRIP: ARC FAULT DETECTED";
    } else if (isRccbTrip) {
      $("#bS").textContent = "RCCB TRIP: ELECTRIC SHOCK HAZARD";
    } else if (d.fireConfirmed) {
      $("#bS").textContent = "FIRE CONFIRMED: EXTENSION ACTIVE";
    } else {
      $("#bS").textContent = "ALARM ACTIVE";
    }
  } else if (s === "WARNING") {
    $("#bS").textContent = "SAFETY WARNING";
  } else if (s === "OFFLINE") {
    $("#bS").textContent = "DEVICE OFFLINE";
  } else {
    $("#bS").textContent = "Normal • Protected";
  }

  // Connection pill
  const connPill = $("#conn");
  if (connPill) {
    if (s === "OFFLINE") {
      connPill.textContent = "Hardware Offline";
      connPill.className = "pill";
      connPill.style.background = "#475569";
    } else {
      connPill.textContent = DEMO ? "Demo Mode (Active)" : "Live Telemetry";
      connPill.className = "pill live";
      connPill.style.background = "";
    }
  }

  // Banner subtext
  let sub = `${d.name} (${d.location || "Main Panel"}), updated ${ago(d.updatedAt)}`;
  if (isAfddTrip) sub += " • ⚡ AFDD Contactor Cut";
  if (isRccbTrip) sub += " • ⚠️ RCCB Leakage Trip";
  if (d.flameDetected) sub += " • 🔥 Flame Sensor Triggered";
  if (d.fireConfirmed) sub += " • 🚨 Fire Confirmed";
  if (d.ack && s !== "NORMAL") sub += `. Acknowledged${d.ackBy ? " by " + d.ackBy : ""}`;
  $("#bSub").textContent = sub;

  // Alarm buttons
  const isAlarmActive = s === "ALARM" || !!d.buzzerOn || !!d.fireConfirmed;
  const ab = $("#ack");
  if (ab) {
    ab.classList.toggle("hide", !isAlarmActive && s !== "WARNING");
    ab.disabled = !can("ack") || !!d.ack;
    ab.textContent = d.ack ? "Acknowledged" : can("ack") ? "Acknowledge alarm" : "View only";
  }
  const alarmBtn = $("#alarmToggle");
  if (alarmBtn) {
    alarmBtn.disabled = !can("alarm");
    if (isAlarmActive) {
      alarmBtn.textContent = "🔕 Silence Alarm & Buzzer";
      alarmBtn.style.background = "#ffffff";
      alarmBtn.style.color = "#e50914";
      alarmBtn.style.boxShadow = "0 0 20px rgba(255,255,255,0.7)";
    } else {
      alarmBtn.textContent = "🚨 Turn on Alarm";
      alarmBtn.style.background = "#e50914";
      alarmBtn.style.color = "#ffffff";
      alarmBtn.style.boxShadow = "0 0 16px rgba(229,9,20,0.6)";
    }
  }

  const off = s === "OFFLINE";
  const u = (v, x) => off || v == null ? "--" : `${v}<small>${x}</small>`;

  // 1. Environmental Sensor KPIs
  $("#kT").innerHTML = u(d.temperature, "°C");
  $("#kH").innerHTML = u(d.humidity, "%");
  $("#kS").innerHTML = u(d.smoke, "ADC");
  setBar($("#bT"), d.temperature || 0, TH.tempWarn, TH.tempAlarm);
  setBar($("#bS2"), d.smoke || 0, TH.smokeWarn, TH.smokeAlarm);
  if ($("#bH")) $("#bH").style.width = (d.humidity || 0) + "%";
  $("#cT").textContent = `Warning at ${TH.tempWarn} °C, alarm at ${TH.tempAlarm} °C`;
  $("#cS").textContent = `Warning at ${TH.smokeWarn} ADC, alarm at ${TH.smokeAlarm} ADC`;

  // 2. Electrical Sensor KPIs
  const volt = d.voltage ?? 230.0;
  const currL = d.currentL ?? 12.5;
  const currN = d.currentN ?? 12.49;
  const resMa = d.residualMa ?? (Math.abs(currL - currN) * 1000);

  $("#kV").innerHTML = u(volt, "V");
  $("#kIL").innerHTML = u(currL, "A");
  $("#kIN").innerHTML = u(currN, "A");
  $("#kIdelta").innerHTML = u(resMa, "mA");

  // Voltage bar: 230V centered (180V - 260V scale)
  const vPct = Math.max(5, Math.min(100, ((volt - 180) / (270 - 180)) * 100));
  if ($("#bV")) {
    $("#bV").style.width = vPct + "%";
    $("#bV").style.background = (volt > TH.overVoltage || volt < TH.underVoltage) ? COL.ALARM : "#38bdf8";
  }
  // Current bars (0 - 32A rated scale)
  if ($("#bIL")) {
    $("#bIL").style.width = Math.min(100, (currL / 32) * 100) + "%";
    $("#bIL").style.background = currL > 28 ? COL.ALARM : "#ffffff";
  }
  if ($("#bIN")) {
    $("#bIN").style.width = Math.min(100, (currN / 32) * 100) + "%";
    $("#bIN").style.background = "#ffffff";
  }
  // Residual leakage bar (0 - 50mA scale)
  if ($("#bIdelta")) {
    const rPct = Math.min(100, (resMa / 50) * 100);
    $("#bIdelta").style.width = rPct + "%";
    $("#bIdelta").style.background = resMa >= TH.rccbShockTripMa ? COL.ALARM : resMa >= 10 ? COL.WARNING : "#ffffff";
  }

  // 3. AFDD Arc Fault Analytical Engine Display
  const afdd = d.afdd || analyzeAFDD(volt, currL, simMode);
  $("#afddHfVal").textContent = afdd.hfNoise.toFixed(1) + " dB";
  $("#afddShoulderVal").textContent = afdd.shoulderMs.toFixed(2) + " ms";
  $("#afddErrVal").textContent = afdd.erraticismPct.toFixed(1) + "%";
  $("#afddDipVal").textContent = afdd.dipV.toFixed(1) + " V";
  $("#afddEnergyVal").textContent = afdd.energyPct.toFixed(0) + "%";

  if ($("#bAfddHf")) {
    $("#bAfddHf").style.width = Math.min(100, (afdd.hfNoise / 100) * 100) + "%";
    $("#bAfddHf").style.background = afdd.hfNoise >= 65 ? COL.ALARM : "#ffffff";
  }
  if ($("#bAfddShoulder")) {
    $("#bAfddShoulder").style.width = Math.min(100, (afdd.shoulderMs / 2.5) * 100) + "%";
    $("#bAfddShoulder").style.background = afdd.shoulderMs >= 1.0 ? COL.ALARM : "#ffffff";
  }
  if ($("#bAfddErr")) {
    $("#bAfddErr").style.width = Math.min(100, afdd.erraticismPct) + "%";
    $("#bAfddErr").style.background = afdd.erraticismPct >= 40 ? COL.ALARM : "#ffffff";
  }
  if ($("#bAfddDip")) {
    $("#bAfddDip").style.width = Math.min(100, (afdd.dipV / 40) * 100) + "%";
    $("#bAfddDip").style.background = afdd.dipV >= 15 ? COL.ALARM : "#ffffff";
  }
  if ($("#bAfddEnergy")) {
    $("#bAfddEnergy").style.width = Math.min(100, afdd.energyPct) + "%";
    $("#bAfddEnergy").style.background = afdd.energyPct >= 80 ? COL.ALARM : "#ffffff";
  }

  const afddBadge = $("#afddBadge");
  const afddBox = $("#afddVerdictBox");
  const afddText = $("#afddVerdictText");
  if (afdd.trip) {
    afddBadge.textContent = afdd.status === "TRIP_SERIES_ARC" ? "SERIES ARC TRIP" : "PARALLEL ARC TRIP";
    afddBadge.className = "status-pill status-alarm";
    afddBox.classList.add("is-trip");
    afddText.textContent = afdd.verdict;
  } else if (afdd.status === "WARNING_NOISE") {
    afddBadge.textContent = "PRE-ARC WARNING";
    afddBadge.className = "status-pill status-warning";
    afddBox.classList.remove("is-trip");
    afddText.textContent = afdd.verdict;
  } else {
    afddBadge.textContent = "NORMAL • ARMED";
    afddBadge.className = "status-pill status-normal";
    afddBox.classList.remove("is-trip");
    afddText.textContent = afdd.verdict;
  }

  // 4. RCCB / RCD Shock & Leakage Engine Display
  const rccb = d.rccb || analyzeRCCB(currL, currN, simMode);
  $("#rccbIL").textContent = currL.toFixed(2) + " A";
  $("#rccbIN").textContent = currN.toFixed(2) + " A";
  $("#rccbIdeltaVal").textContent = rccb.ideltaMa.toFixed(1) + " mA";

  if ($("#rccbBarFill")) {
    const resPercent = Math.min(100, (rccb.ideltaMa / 50) * 100);
    $("#rccbBarFill").style.width = resPercent + "%";
    $("#rccbBarFill").style.background = rccb.ideltaMa >= TH.rccbShockTripMa ? COL.ALARM : rccb.ideltaMa >= 10 ? COL.WARNING : "#ffffff";
  }

  // Highlight active stage
  ["stgSafe", "stgWarn", "stgShock", "stgFire"].forEach(id => {
    const el = $("#" + id);
    if (el) el.classList.remove("active");
  });
  if (rccb.stage === "safe") $("#stgSafe")?.classList.add("active");
  else if (rccb.stage === "warn") $("#stgWarn")?.classList.add("active");
  else if (rccb.stage === "shock") $("#stgShock")?.classList.add("active");
  else if (rccb.stage === "fire") $("#stgFire")?.classList.add("active");

  const rccbBadge = $("#rccbBadge");
  const rccbBox = $("#rccbVerdictBox");
  const rccbText = $("#rccbVerdictText");
  if (rccb.trip) {
    rccbBadge.textContent = rccb.stage === "shock" ? "SHOCK TRIP (<40ms)" : "FIRE FAULT TRIP";
    rccbBadge.className = "status-pill status-alarm";
    rccbBox.classList.add("is-trip");
    rccbText.textContent = rccb.verdict;
  } else if (rccb.stage === "warn") {
    rccbBadge.textContent = "LEAKAGE WARNING";
    rccbBadge.className = "status-pill status-warning";
    rccbBox.classList.remove("is-trip");
    rccbText.textContent = rccb.verdict;
  } else {
    rccbBadge.textContent = "BALANCED • SAFE";
    rccbBadge.className = "status-pill status-normal";
    rccbBox.classList.remove("is-trip");
    rccbText.textContent = rccb.verdict;
  }

  // Devices table
  $("#devT").innerHTML = devs.map(x => {
    const e = eff(x);
    return `<tr class="dev ${x.id === sel ? "on" : ""}" data-id="${esc(x.id)}">
      <td>${esc(x.name || x.id)}</td>
      <td>${esc(x.location)}</td>
      <td><span class="dot" style="background:${COL[e]}"></span>${LBL[e]}</td>
      <td>${ago(x.updatedAt)}</td>
    </tr>`;
  }).join("");

  // Fleet donut
  const cnt = [0, 0, 0, 0];
  devs.forEach(x => cnt[Object.keys(LBL).indexOf(eff(x))]++);
  charts.c3.data.datasets[0].data = cnt;
  charts.c3.update("none");

  // Comparison bar
  charts.c4.data.labels = devs.map(x => x.name || x.id);
  charts.c4.data.datasets[0].data = devs.map(x => x.voltage ?? 230);
  charts.c4.data.datasets[1].data = devs.map(x => x.currentL ?? 12.4);
  charts.c4.data.datasets[2].data = devs.map(x => x.smoke ?? 0);
  charts.c4.update("none");
}

function track(list) {
  list.forEach(d => {
    const s = eff(d);
    const p = prev[d.id];
    if (p && p !== s && s !== "NORMAL") {
      let cause = `${d.temperature} °C, smoke ${d.smoke} ADC`;
      if (d.afddTrip) cause = `⚡ AFDD Arc Fault Tripped (${d.afdd?.hfNoise?.toFixed(1) || 85} dB)`;
      else if (d.rccbTrip) cause = `⚠️ RCCB Electric Shock Tripped (${d.residualMa || 38} mA leakage)`;
      alerts.unshift({ t: Date.now(), name: d.name || d.id, s, v: cause });
    }
    prev[d.id] = s;
  });
  alerts = alerts.slice(0, 30);
  $("#alerts").innerHTML = alerts.length
    ? alerts.map(a => `<li><span class="dot" style="background:${COL[a.s]}"></span><b>${LBL[a.s]}</b> at ${esc(a.name)}<div class="cap">${new Date(a.t).toLocaleTimeString()} - ${esc(a.v)}</div></li>`).join("")
    : '<li class="cap">No safety alerts since you opened the dashboard.</li>';
}

function subTele() {
  unsubT && unsubT();
  if (sel) {
    unsubT = api.telemetry(sel, Date.now() - range, r => {
      tele = r;
      drawCharts();
    });
  }
}

/* ---------- Session & Startup ---------- */
async function start() {
  initCharts();
  try {
    const t = await api.getTh();
    if (t) TH = { ...TH, ...t };
  } catch (e) {}

  unsubD = api.devices(list => {
    devs = list.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
    track(devs);
    const o = $("#devSel");
    if (o.options.length !== devs.length) {
      o.innerHTML = devs.map(d => `<option value="${esc(d.id)}">${esc(d.name || d.id)}</option>`).join("");
    }
    if (!sel && devs.length) {
      sel = devs[0].id;
      subTele();
    }
    o.value = sel;
    render();
    $("#conn").textContent = DEMO ? "Demo data" : "Live";
    $("#conn").className = "pill live";
  }, e => {
    $("#conn").textContent = "Error: " + e.code;
    $("#conn").className = "pill";
  });

  if (can("config")) {
    ["tw:tempWarn", "ta:tempAlarm", "sw:smokeWarn", "sa:smokeAlarm", "rccbTh:rccbShockTripMa", "afddTh:afddNoiseWarnDb", "ovTh:overVoltage", "uvTh:underVoltage"].forEach(p => {
      const [i, k] = p.split(":");
      const el = $("#" + i);
      if (el && TH[k] != null) el.value = TH[k];
    });
    loadUsers();
  }
}

async function loadUsers() {
  const us = await api.users();
  $("#usr").innerHTML = us.map(u => `<tr><td>${esc(u.email || u.uid)}</td><td><select data-uid="${esc(u.uid)}">${["viewer", "operator", "admin", "device"].map(r => `<option ${r === u.role ? "selected" : ""}>${r}</option>`).join("")}</select></td></tr>`).join("");
  document.querySelectorAll("#usr select").forEach(setupCustomDropdown);
}

function onUser(u) {
  if (!u) {
    if (!sessionStorage.getItem("demoRole")) {
      sessionStorage.setItem("demoRole", "admin");
      api = demoApi();
      api.onAuth(onUser);
      return;
    }
    location.replace("login.html");
    return;
  }
  user = u;
  $("#app").classList.remove("hide");
  ["#devSel", "#who", "#out"].forEach(s => $(s).classList.remove("hide"));
  $("#who").innerHTML = `${esc(u.email)} <b>${u.role}</b>`;
  $("#adm").classList.toggle("hide", !can("config"));
  start();
}

/* ---------- Custom Theme Dropdowns ---------- */
function setupCustomDropdown(selectEl) {
  if (!selectEl || selectEl.dataset.customized === "true") return;
  selectEl.dataset.customized = "true";
  selectEl.classList.add("has-custom-select");

  const wrapper = document.createElement("div");
  wrapper.className = "custom-select-wrapper" + (selectEl.classList.contains("hide") ? " hide" : "");
  if (selectEl.id) wrapper.id = "custom-" + selectEl.id;

  const trigger = document.createElement("div");
  trigger.className = "custom-select-trigger";
  trigger.setAttribute("tabindex", "0");
  trigger.setAttribute("role", "combobox");

  const label = document.createElement("span");
  label.className = "custom-select-label";

  const chevron = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  chevron.setAttribute("class", "custom-select-chevron");
  chevron.setAttribute("viewBox", "0 0 24 24");
  chevron.innerHTML = '<polyline points="6 9 12 15 18 9"></polyline>';

  trigger.appendChild(label);
  trigger.appendChild(chevron);

  const dropdown = document.createElement("div");
  dropdown.className = "custom-select-dropdown";
  dropdown.setAttribute("role", "listbox");

  wrapper.appendChild(trigger);
  wrapper.appendChild(dropdown);
  selectEl.parentNode.insertBefore(wrapper, selectEl.nextSibling);

  function syncOptions() {
    dropdown.innerHTML = "";
    const options = Array.from(selectEl.options);
    if (!options.length) {
      label.textContent = "Select...";
      return;
    }
    const selectedOption = selectEl.options[selectEl.selectedIndex] || options[0];
    label.textContent = selectedOption ? selectedOption.textContent : "";

    options.forEach(opt => {
      const item = document.createElement("div");
      const isSel = opt.value === selectEl.value;
      item.className = "custom-select-option" + (isSel ? " is-selected" : "");
      item.setAttribute("data-value", opt.value);

      const text = document.createElement("span");
      text.textContent = opt.textContent;
      item.appendChild(text);

      if (isSel) {
        const check = document.createElement("span");
        check.className = "custom-select-check";
        check.textContent = "✓";
        item.appendChild(check);
      }

      item.onclick = e => {
        e.stopPropagation();
        if (selectEl.value !== opt.value) {
          selectEl.value = opt.value;
          syncSelected();
          closeDropdown();
          selectEl.dispatchEvent(new Event("change", { bubbles: true }));
        } else {
          closeDropdown();
        }
      };
      dropdown.appendChild(item);
    });
  }

  function syncSelected() {
    const selectedOption = selectEl.options[selectEl.selectedIndex];
    if (selectedOption) label.textContent = selectedOption.textContent;
    dropdown.querySelectorAll(".custom-select-option").forEach(item => {
      const isSel = item.getAttribute("data-value") === selectEl.value;
      item.classList.toggle("is-selected", isSel);
    });
  }

  function openDropdown() {
    document.querySelectorAll(".custom-select-wrapper.is-open").forEach(w => {
      if (w !== wrapper) w.classList.remove("is-open");
    });
    wrapper.classList.add("is-open");
  }

  function closeDropdown() {
    wrapper.classList.remove("is-open");
  }

  trigger.onclick = e => {
    e.stopPropagation();
    wrapper.classList.contains("is-open") ? closeDropdown() : openDropdown();
  };

  selectEl.addEventListener("change", syncSelected);
  syncOptions();
}

document.addEventListener("click", e => {
  if (!e.target.closest(".custom-select-wrapper")) {
    document.querySelectorAll(".custom-select-wrapper.is-open").forEach(w => w.classList.remove("is-open"));
  }
});

/* ---------- Event Listeners & Fault Simulation Handlers ---------- */
$("#devSel").onchange = e => { sel = e.target.value; subTele(); render(); };
$("#devT").onclick = e => {
  const r = e.target.closest("tr");
  if (r) {
    sel = r.dataset.id;
    $("#devSel").value = sel;
    subTele();
    render();
  }
};

$("#rng").onclick = e => {
  const b = e.target.closest("button");
  if (!b) return;
  range = +b.dataset.r;
  document.querySelectorAll("#rng button").forEach(x => x.classList.toggle("on", x === b));
  subTele();
};

$("#chartViewSeg").onclick = e => {
  const b = e.target.closest("button");
  if (!b) return;
  document.querySelectorAll("#chartViewSeg button").forEach(x => x.classList.toggle("on", x === b));
  updateChartView(b.dataset.view);
};

// Simulation Buttons Toolbar
$("#simActions").onclick = e => {
  const b = e.target.closest(".sim-btn");
  if (!b) return;

  document.querySelectorAll(".sim-actions .sim-btn").forEach(x => x.classList.remove("active"));
  b.classList.add("active");

  const mode = b.dataset.mode || "NORMAL";
  simMode = mode;

  if (api?.triggerSim) {
    api.triggerSim(mode);
  } else {
    render();
  }
};

$("#btnSimReset").onclick = () => {
  simMode = "NORMAL";
  document.querySelectorAll(".sim-actions .sim-btn").forEach(x => x.classList.remove("active"));
  $("#btnSimNormal").classList.add("active");
  if (api?.triggerSim) api.triggerSim("NORMAL");
  else render();
};

$("#ack").onclick = () => api.ack(sel).catch(e => alert("Could not acknowledge: " + e.message));

const toggleBtn = $("#alarmToggle");
if (toggleBtn) {
  toggleBtn.onclick = async () => {
    if (!sel) return;
    const d = devs.find(x => x.id === sel);
    const isAlarmActive = eff(d) === "ALARM" || !!d?.buzzerOn || !!d?.fireConfirmed;
    const nextState = !isAlarmActive;
    toggleBtn.disabled = true;
    try {
      await api.setAlarm(sel, nextState);
      if (d) {
        d.status = nextState ? "ALARM" : "NORMAL";
        d.buzzerOn = nextState;
        d.fireConfirmed = nextState;
        d.updatedAt = Date.now();
        render();
      }
    } catch (err) {
      alert("Could not update alarm status: " + err.message);
    } finally {
      toggleBtn.disabled = false;
      render();
    }
  };
}

$("#out").onclick = () => {
  sessionStorage.removeItem("demoRole");
  api.logout();
  location.replace("login.html");
};

$("#saveTh").onclick = async () => {
  const t = {
    tempWarn: +$("#tw").value,
    tempAlarm: +$("#ta").value,
    smokeWarn: +$("#sw").value,
    smokeAlarm: +$("#sa").value,
    rccbShockTripMa: +$("#rccbTh").value || 30,
    afddNoiseWarnDb: +$("#afddTh").value || 65,
    overVoltage: +$("#ovTh").value || 255,
    underVoltage: +$("#uvTh").value || 195
  };
  try {
    await api.setTh(t);
    TH = { ...TH, ...t };
    $("#thMsg").textContent = "Thresholds saved successfully.";
    render();
    drawCharts();
  } catch (e) {
    $("#thMsg").textContent = "Could not save: " + e.message;
  }
};

$("#usr").onchange = async e => {
  const s = e.target;
  if (s.dataset.uid) {
    try {
      await api.setRole(s.dataset.uid, s.value);
    } catch (x) {
      alert("Could not change role: " + x.message);
      loadUsers();
    }
  }
};

$("#csv").onclick = () => {
  const headers = [
    "time",
    "voltage_v",
    "current_line_a",
    "current_neutral_a",
    "residual_current_ma",
    "afdd_hf_noise_db",
    "afdd_status",
    "rccb_status",
    "temperature_c",
    "humidity_pct",
    "smoke_ppm",
    "status"
  ];
  const rows = [
    headers.join(","),
    ...tele.map(r => [
      new Date(r.ts).toISOString(),
      r.voltage ?? 230,
      r.currentL ?? 12.4,
      r.currentN ?? 12.39,
      r.residualMa ?? 6.2,
      r.afddHfNoise ?? 12,
      r.afddStatus ?? "NORMAL",
      r.rccbStatus ?? "NORMAL",
      r.temperature ?? 24.5,
      r.humidity ?? 45,
      r.smoke ?? 0,
      r.status ?? "NORMAL"
    ].join(","))
  ];
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv" }));
  a.download = `${sel}-safety-telemetry.csv`;
  a.click();
};

$("#ctype").onchange = e => {
  const v = e.target.value;
  charts.c1.data.datasets.forEach(d => (d.type = v));
  charts.c2.data.datasets.forEach(d => (d.type = v));
  drawCharts();
};

setInterval(() => user && devs.length && render(), 8000);

// Initialize custom dropdowns
if ($("#ctype")) setupCustomDropdown($("#ctype"));
if ($("#devSel")) setupCustomDropdown($("#devSel"));

/* ---------- Bootstrapping ---------- */
(async () => {
  try {
    const isDemo = DEMO || !!sessionStorage.getItem("demoRole") || !window.navigator.onLine;
    api = isDemo ? demoApi() : await fbApi();
    api.onAuth(onUser);
  } catch (e) {
    sessionStorage.setItem("demoRole", "admin");
    api = demoApi();
    api.onAuth(onUser);
  }
})();
