/* Cherche le Barbichon — stockage partagé (JSONBin) + repli localStorage.
   Garde : le journal des tirages de la roue, le compteur par nom, et le
   Top 10 des meilleurs temps (avec pseudo). Aucune base de données à gérer.

   ┌──────────────────────────────────────────────────────────────────┐
   │  POUR PARTAGER ENTRE TOUS LES POTES (sinon, reste 100% local) :    │
   │  1. Compte gratuit sur https://jsonbin.io                          │
   │  2. « Create Bin » et colle dedans :  {"draws":[],"tally":{},      │
   │     "bestTimes":[]}  puis enregistre.                              │
   │  3. Copie l'ID du bin (dans l'URL après /b/) → BIN_ID ci-dessous.  │
   │  4. Onglet « Access Keys » → crée une clé avec les permissions     │
   │     Read + Update → colle-la dans ACCESS_KEY ci-dessous.           │
   │  (Alternative sans compte : https://npoint.io — voir plus bas.)    │
   └──────────────────────────────────────────────────────────────────┘ */
"use strict";

const CONFIG = {
  BIN_ID: "6a416abfda38895dfe0c9ec9",
  ACCESS_KEY: "$2a$10$odcqr42bu4TBTH3ZQMrqqug7PoT.OY4vg/IdVspKfn9BB4SKajYFi",
};

(function () {
  const LS_KEY = "barbichon-state-v1";
  const OLD_PAPE_KEY = "barbichon-pape-accusations"; // ancien compteur, on le récupère
  const MAX_DRAWS = 200;   // on borne le journal pour garder le bin léger
  const MAX_TIMES = 10;    // Top 10
  const REMOTE = !!(CONFIG.BIN_ID && CONFIG.ACCESS_KEY);
  const BASE = `https://api.jsonbin.io/v3/b/${CONFIG.BIN_ID}`;

  /* ---------- Anti-rejeu / intégrité ----------
     Chaque enregistrement reçoit un id unique (anti-rejeu : un même save
     n'est compté qu'une fois) et une empreinte signée. À la lecture, on
     rejette les temps invraisemblables et les entrées dont l'empreinte ne
     colle pas (rejeu modifié). À garder en tête : la clé JSONBin et le sel
     vivent côté client, donc ceci stoppe le rejeu du XHR et le bidouillage
     naïf, mais une vraie garantie demanderait un petit backend. */
  const MIN_MS = 1000;     // sous 1 s, c'est humainement impossible → forgé
  const SALT = "barbichon-anti-replay-2026";

  function sig(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = (((h << 5) + h) + str.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }
  function newId() {
    return Date.now().toString(36) + "-" + Math.floor(Math.random() * 1e9).toString(36);
  }
  const timeKey = (e) => `T|${e.p}|${e.ms}|${e.t}|${e.id}|${SALT}`;
  const drawKey = (e) => `D|${e.n}|${e.t}|${e.id}|${SALT}`;
  const signTime = (e) => { e.c = sig(timeKey(e)); return e; };
  const signDraw = (e) => { e.c = sig(drawKey(e)); return e; };

  function timeOk(e) {
    if (!e || typeof e.ms !== "number" || !isFinite(e.ms) || e.ms < MIN_MS) return false;
    if (e.id == null && e.c == null) return true;       // entrée historique tolérée
    return e.id != null && e.c === sig(timeKey(e));      // empreinte vérifiée
  }
  function drawOk(e) {
    if (!e || !e.n) return false;
    if (e.id == null && e.c == null) return true;
    return e.id != null && e.c === sig(drawKey(e));
  }
  function dedupById(arr) {
    const seen = new Set(), out = [];
    for (const e of arr) {
      const k = e && e.id != null ? e.id : JSON.stringify(e);
      if (seen.has(k)) continue;                          // rejeu / doublon ignoré
      seen.add(k); out.push(e);
    }
    return out;
  }

  const now = () => Date.now();

  function emptyState() {
    return { draws: [], tally: {}, bestTimes: [] };
  }

  // normalise + filtre les entrées invalides/rejouées, déduplique par id
  function clean(s) {
    const st = s && typeof s === "object" ? s : {};
    const draws = dedupById((Array.isArray(st.draws) ? st.draws : []).filter(drawOk));
    const bestTimes = dedupById((Array.isArray(st.bestTimes) ? st.bestTimes : []).filter(timeOk))
      .sort((a, b) => a.ms - b.ms)
      .slice(0, MAX_TIMES);
    return {
      draws,
      tally: st.tally && typeof st.tally === "object" ? st.tally : {},
      bestTimes,
    };
  }

  /* ---------- repli localStorage (toujours présent, sert aussi de cache) ---------- */

  function readLocal() {
    let st;
    try { st = clean(JSON.parse(localStorage.getItem(LS_KEY))); }
    catch (_) { st = emptyState(); }
    // migration de l'ancien compteur de Pape
    try {
      const old = parseInt(localStorage.getItem(OLD_PAPE_KEY) || "0", 10);
      if (old > 0 && !st.tally.Pape) { st.tally.Pape = old; localStorage.removeItem(OLD_PAPE_KEY); writeLocal(st); }
    } catch (_) {}
    return st;
  }

  function writeLocal(st) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(st)); } catch (_) {}
  }

  /* ---------- accès distant JSONBin (avec timeout + repli) ---------- */

  async function fetchJSON(url, opts) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 7000);
    try {
      const res = await fetch(url, { ...opts, signal: ctrl.signal });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function remoteGet() {
    const json = await fetchJSON(`${BASE}/latest`, {
      headers: { "X-Access-Key": CONFIG.ACCESS_KEY },
    });
    return clean(json.record);
  }

  async function remotePut(st) {
    await fetchJSON(BASE, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Access-Key": CONFIG.ACCESS_KEY,
        "X-Bin-Versioning": "false",
      },
      body: JSON.stringify(st),
    });
  }

  /* ---------- lecture / écriture unifiées ---------- */

  // récupère l'état : distant si configuré (avec repli local en cas de pépin)
  async function getState() {
    const local = readLocal();
    if (!REMOTE) return local;
    try {
      const remote = await remoteGet();
      writeLocal(remote); // on met le cache à jour
      return remote;
    } catch (_) {
      return local; // hors-ligne / erreur réseau : on sert le cache
    }
  }

  // applique une mutation (fn) sur l'état frais puis le sauvegarde partout
  async function mutate(fn) {
    let st;
    if (REMOTE) {
      try { st = await remoteGet(); }
      catch (_) { st = readLocal(); } // si la lecture échoue on part du cache
    } else {
      st = readLocal();
    }
    fn(st);
    writeLocal(st);
    if (REMOTE) { try { await remotePut(st); } catch (_) {} } // best-effort
    return st;
  }

  /* ---------- API publique ---------- */

  // enregistre un tirage de roue : ajoute au journal (id + signature) + compteur
  function recordDraw(name) {
    return mutate((st) => {
      const id = newId();
      if (st.draws.some((e) => e.id === id)) return;     // garde-fou anti-doublon
      st.draws.push(signDraw({ n: name, t: now(), id }));
      if (st.draws.length > MAX_DRAWS) st.draws = st.draws.slice(-MAX_DRAWS);
      st.tally[name] = (st.tally[name] || 0) + 1;
    });
  }

  // un temps qualifie-t-il pour le Top 10 ? (plus c'est petit, mieux c'est)
  function qualifies(state, ms) {
    if (typeof ms !== "number" || !isFinite(ms) || ms < MIN_MS) return false;
    const bt = state.bestTimes;
    return bt.length < MAX_TIMES || ms < bt[bt.length - 1].ms;
  }

  // enregistre un temps ; `winId` rend l'opération idempotente (anti-rejeu :
  // un même save ne compte qu'une fois). Renvoie {rank, state}.
  async function recordTime(pseudo, ms, winId) {
    let rank = null;
    if (typeof ms !== "number" || !isFinite(ms) || ms < MIN_MS) {
      return { rank: null, state: await getState() }; // temps invraisemblable : refusé
    }
    const id = winId || newId();
    const state = await mutate((st) => {
      if (st.bestTimes.some((e) => e.id === id)) {        // déjà enregistré → on ignore
        const j = st.bestTimes.findIndex((e) => e.id === id);
        rank = j >= 0 ? j + 1 : null;
        return;
      }
      const entry = signTime({ p: String(pseudo || "?").slice(0, 14), ms, t: now(), id });
      st.bestTimes.push(entry);
      st.bestTimes.sort((a, b) => a.ms - b.ms);
      st.bestTimes = st.bestTimes.slice(0, MAX_TIMES);
      const i = st.bestTimes.findIndex((e) => e.id === id);
      rank = i >= 0 ? i + 1 : null;
    });
    return { rank, state };
  }

  window.BarbichonStore = {
    isRemote: () => REMOTE,
    getState,
    recordDraw,
    recordTime,
    qualifies,
  };
})();
