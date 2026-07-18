(() => {
  "use strict";

  const STORAGE_KEY = "putt-pad-state-v1";
  const DOT_COLORS = ["#F4B740", "#F6F1E4", "#BFE3CC", "#E88C7D", "#D8C08A", "#9CC6A6"];
  const MAX_PLAYERS = 6;
  const MIN_PAR = 2;
  const MAX_PAR = 6;
  const MAX_STROKES = 15;

  /** ---------------- State ---------------- */

  function defaultState() {
    return {
      active: false,
      courseName: "",
      holes: 9,
      pars: Array(9).fill(3),
      players: [],
      currentHole: 0,
      scores: {}, // playerId -> array of (number|null)
    };
  }

  let state = loadState();

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return { ...defaultState(), ...parsed };
    } catch {
      return defaultState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable — round still works, just won't persist */
    }
  }

  function uid() {
    return Math.random().toString(36).slice(2, 9);
  }

  /** ---------------- DOM refs ---------------- */

  const el = {
    setupScreen: document.getElementById("screen-setup"),
    playScreen: document.getElementById("screen-play"),
    courseNameInput: document.getElementById("course-name"),
    holesToggle: document.getElementById("holes-toggle"),
    parGrid: document.getElementById("par-grid"),
    playerList: document.getElementById("player-list"),
    newPlayerName: document.getElementById("new-player-name"),
    addPlayerBtn: document.getElementById("add-player-btn"),
    startRoundBtn: document.getElementById("start-round-btn"),

    playCourseName: document.getElementById("play-course-name"),
    menuBtn: document.getElementById("menu-btn"),
    tabButtons: document.querySelectorAll(".tab-btn"),
    tabHole: document.getElementById("tab-hole"),
    tabCard: document.getElementById("tab-card"),

    currentHoleNumber: document.getElementById("current-hole-number"),
    currentHolePar: document.getElementById("current-hole-par"),
    holeDots: document.getElementById("hole-dots"),
    prevHoleBtn: document.getElementById("prev-hole-btn"),
    nextHoleBtn: document.getElementById("next-hole-btn"),
    scoreList: document.getElementById("score-list"),
    scorecardTable: document.getElementById("scorecard-table"),

    confirmRoot: document.getElementById("confirm-root"),
    installBanner: document.getElementById("install-banner"),
    installBtn: document.getElementById("install-btn"),
  };

  /** ---------------- Setup screen ---------------- */

  function renderSetup() {
    el.courseNameInput.value = state.courseName;

    el.holesToggle.querySelectorAll(".toggle-btn").forEach((btn) => {
      btn.classList.toggle("active", Number(btn.dataset.holes) === state.holes);
    });

    renderParGrid();
    renderPlayerList();
    updateStartButton();
  }

  function renderParGrid() {
    el.parGrid.innerHTML = "";
    for (let i = 0; i < state.holes; i++) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "par-chip";
      chip.innerHTML = `<span class="hole-no">${i + 1}</span><span class="par-val">${state.pars[i] ?? 3}</span>`;
      chip.addEventListener("click", () => {
        const current = state.pars[i] ?? 3;
        state.pars[i] = current >= MAX_PAR ? MIN_PAR : current + 1;
        saveState();
        renderParGrid();
      });
      el.parGrid.appendChild(chip);
    }
  }

  function renderPlayerList() {
    el.playerList.innerHTML = "";
    if (state.players.length === 0) {
      const note = document.createElement("div");
      note.className = "empty-note";
      note.style.padding = "8px 0";
      note.textContent = "Add at least one player to start.";
      el.playerList.appendChild(note);
      return;
    }
    state.players.forEach((p, idx) => {
      const row = document.createElement("div");
      row.className = "player-row";
      row.innerHTML = `
        <div class="player-dot" style="background:${DOT_COLORS[idx % DOT_COLORS.length]}">${initials(p.name)}</div>
        <span class="name">${escapeHtml(p.name)}</span>
        <button class="icon-btn" aria-label="Remove ${escapeHtml(p.name)}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 6L18 18M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>`;
      row.querySelector(".icon-btn").addEventListener("click", () => {
        state.players = state.players.filter((pl) => pl.id !== p.id);
        saveState();
        renderPlayerList();
        updateStartButton();
      });
      el.playerList.appendChild(row);
    });
  }

  function initials(name) {
    return name.trim().slice(0, 2).toUpperCase();
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function updateStartButton() {
    el.startRoundBtn.disabled = state.players.length === 0;
  }

  function addPlayer() {
    const name = el.newPlayerName.value.trim();
    if (!name) return;
    if (state.players.length >= MAX_PLAYERS) return;
    state.players.push({ id: uid(), name });
    el.newPlayerName.value = "";
    saveState();
    renderPlayerList();
    updateStartButton();
    el.newPlayerName.focus();
  }

  el.addPlayerBtn.addEventListener("click", addPlayer);
  el.newPlayerName.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addPlayer();
    }
  });

  el.courseNameInput.addEventListener("input", () => {
    state.courseName = el.courseNameInput.value;
    saveState();
  });

  el.holesToggle.addEventListener("click", (e) => {
    const btn = e.target.closest(".toggle-btn");
    if (!btn) return;
    const holes = Number(btn.dataset.holes);
    if (holes === state.holes) return;
    state.holes = holes;
    const nextPars = Array(holes).fill(3);
    for (let i = 0; i < Math.min(state.pars.length, holes); i++) nextPars[i] = state.pars[i];
    state.pars = nextPars;
    saveState();
    renderSetup();
  });

  el.startRoundBtn.addEventListener("click", () => {
    if (state.players.length === 0) return;
    state.active = true;
    state.currentHole = 0;
    state.scores = {};
    state.players.forEach((p) => {
      state.scores[p.id] = Array(state.holes).fill(null);
    });
    if (!state.courseName.trim()) state.courseName = "Mini Golf Round";
    saveState();
    render();
  });

  /** ---------------- Play screen: hole-by-hole ---------------- */

  function renderPlay() {
    el.playCourseName.textContent = state.courseName || "Mini Golf Round";
    renderHoleNav();
    renderCurrentHole();
    renderScorecardTable();
  }

  function renderHoleNav() {
    const hole = state.currentHole;
    el.currentHoleNumber.textContent = hole + 1;
    el.currentHolePar.textContent = `Par ${state.pars[hole] ?? 3}`;
    el.prevHoleBtn.disabled = hole === 0;
    el.nextHoleBtn.disabled = hole === state.holes - 1;

    el.holeDots.innerHTML = "";
    for (let i = 0; i < state.holes; i++) {
      const dot = document.createElement("div");
      const played = state.players.some((p) => state.scores[p.id]?.[i] != null);
      dot.className = "hole-dot" + (i === hole ? " current" : played ? " done" : "");
      dot.title = `Hole ${i + 1}`;
      dot.addEventListener("click", () => {
        state.currentHole = i;
        saveState();
        renderPlay();
      });
      el.holeDots.appendChild(dot);
    }
  }

  function renderCurrentHole() {
    const hole = state.currentHole;
    const par = state.pars[hole] ?? 3;
    el.scoreList.innerHTML = "";

    state.players.forEach((p, idx) => {
      const value = state.scores[p.id]?.[hole] ?? null;
      const row = document.createElement("div");
      row.className = "score-row";

      const rel = value == null ? null : value - par;
      let relText = "—";
      let relClass = "";
      if (rel != null) {
        if (rel === 0) relText = "E";
        else if (rel < 0) {
          relText = String(rel);
          relClass = "under";
        } else {
          relText = "+" + rel;
          relClass = "over";
        }
      }

      row.innerHTML = `
        <div class="player-dot" style="background:${DOT_COLORS[idx % DOT_COLORS.length]}">${initials(p.name)}</div>
        <span class="name">${escapeHtml(p.name)}</span>
        <span class="relative ${relClass}">${relText}</span>
        <div class="stepper">
          <button class="step-btn" data-action="minus" aria-label="Decrease stroke count">−</button>
          <span class="score-value ${value == null ? "empty" : ""}">${value == null ? "–" : value}</span>
          <button class="step-btn" data-action="plus" aria-label="Increase stroke count">+</button>
        </div>`;

      row.querySelector('[data-action="minus"]').addEventListener("click", () => {
        adjustScore(p.id, hole, -1, par);
      });
      row.querySelector('[data-action="plus"]').addEventListener("click", () => {
        adjustScore(p.id, hole, 1, par);
      });

      el.scoreList.appendChild(row);
    });
  }

  function adjustScore(playerId, hole, delta, par) {
    const arr = state.scores[playerId];
    const current = arr[hole];
    let next;
    if (current == null) {
      // First tap: plus starts at par, minus starts at par - 1.
      next = delta > 0 ? par : Math.max(1, par - 1);
    } else {
      next = current + delta;
    }
    next = Math.max(1, Math.min(MAX_STROKES, next));
    arr[hole] = next;
    saveState();
    renderCurrentHole();
    renderHoleNav();
    renderScorecardTable();
  }

  el.prevHoleBtn.addEventListener("click", () => {
    if (state.currentHole > 0) {
      state.currentHole -= 1;
      saveState();
      renderPlay();
    }
  });

  el.nextHoleBtn.addEventListener("click", () => {
    if (state.currentHole < state.holes - 1) {
      state.currentHole += 1;
      saveState();
      renderPlay();
    }
  });

  /** ---------------- Full scorecard table ---------------- */

  function totalsFor(playerId, fromHole, toHoleExclusive) {
    const arr = state.scores[playerId] || [];
    let sum = 0;
    let played = 0;
    for (let i = fromHole; i < toHoleExclusive; i++) {
      if (arr[i] != null) {
        sum += arr[i];
        played++;
      }
    }
    return { sum, played };
  }

  function renderScorecardTable() {
    const holes = state.holes;
    const showSplit = holes === 18;
    const out = 9;

    let theadCols = `<th class="row-label">Hole</th>`;
    for (let i = 0; i < holes; i++) theadCols += `<th>${i + 1}</th>`;
    if (showSplit) theadCols += `<th>Out</th><th>In</th>`;
    theadCols += `<th>Tot</th>`;

    let parRow = `<td class="row-label">Par</td>`;
    for (let i = 0; i < holes; i++) parRow += `<td>${state.pars[i] ?? 3}</td>`;
    const parOut = state.pars.slice(0, out).reduce((a, b) => a + (b ?? 3), 0);
    const parIn = state.pars.slice(out, holes).reduce((a, b) => a + (b ?? 3), 0);
    if (showSplit) parRow += `<td>${parOut}</td><td>${parIn}</td>`;
    parRow += `<td>${state.pars.slice(0, holes).reduce((a, b) => a + (b ?? 3), 0)}</td>`;

    // Determine current leader: lowest total among players with >=1 stroke entered.
    let leaderId = null;
    let leaderTotal = Infinity;
    state.players.forEach((p) => {
      const { sum, played } = totalsFor(p.id, 0, holes);
      if (played > 0 && sum < leaderTotal) {
        leaderTotal = sum;
        leaderId = p.id;
      }
    });
    const multiplePlayers = state.players.length > 1;

    let bodyRows = "";
    state.players.forEach((p, idx) => {
      const arr = state.scores[p.id] || [];
      let row = `<td class="row-label"><span class="player-dot" style="width:18px;height:18px;font-size:9px;background:${DOT_COLORS[idx % DOT_COLORS.length]};display:inline-grid;place-items:center;border-radius:50%;vertical-align:middle;margin-right:6px;">${initials(p.name)}</span>${escapeHtml(p.name)}${multiplePlayers && p.id === leaderId ? '<span class="leader-badge">🏆</span>' : ""}</td>`;
      for (let i = 0; i < holes; i++) {
        row += `<td>${arr[i] ?? "–"}</td>`;
      }
      const { sum: outSum, played: outPlayed } = totalsFor(p.id, 0, out);
      const { sum: inSum, played: inPlayed } = totalsFor(p.id, out, holes);
      if (showSplit) {
        row += `<td>${outPlayed ? outSum : "–"}</td><td>${inPlayed ? inSum : "–"}</td>`;
      }
      const { sum: totalSum, played: totalPlayed } = totalsFor(p.id, 0, holes);
      row += `<td>${totalPlayed ? totalSum : "–"}</td>`;
      bodyRows += `<tr>${row}</tr>`;
    });

    el.scorecardTable.innerHTML = `
      <thead><tr>${theadCols}</tr></thead>
      <tbody>
        <tr class="subtotal-row">${parRow}</tr>
        ${bodyRows}
      </tbody>`;
  }

  /** ---------------- Tabs ---------------- */

  el.tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      el.tabButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.tab;
      el.tabHole.classList.toggle("hidden", tab !== "hole");
      el.tabCard.classList.toggle("hidden", tab !== "card");
      if (tab === "card") renderScorecardTable();
    });
  });

  /** ---------------- Menu / new round confirm ---------------- */

  el.menuBtn.addEventListener("click", () => {
    showConfirm({
      title: "Round menu",
      message: "Starting a new round will clear the current scorecard. This can't be undone.",
      confirmLabel: "Start new round",
      onConfirm: () => {
        state = defaultState();
        saveState();
        render();
      },
    });
  });

  function showConfirm({ title, message, confirmLabel, onConfirm }) {
    el.confirmRoot.innerHTML = `
      <div class="confirm-sheet">
        <div class="card">
          <div class="hole-label">${escapeHtml(title)}</div>
          <p>${escapeHtml(message)}</p>
          <div class="confirm-actions">
            <button class="btn btn-outline" id="confirm-cancel">Cancel</button>
            <button class="btn btn-gold" id="confirm-ok">${escapeHtml(confirmLabel)}</button>
          </div>
        </div>
      </div>`;
    document.getElementById("confirm-cancel").addEventListener("click", closeConfirm);
    document.getElementById("confirm-ok").addEventListener("click", () => {
      closeConfirm();
      onConfirm();
    });
  }

  function closeConfirm() {
    el.confirmRoot.innerHTML = "";
  }

  /** ---------------- Top-level render ---------------- */

  function render() {
    el.setupScreen.classList.toggle("hidden", state.active);
    el.playScreen.classList.toggle("hidden", !state.active);
    if (state.active) {
      renderPlay();
    } else {
      renderSetup();
    }
  }

  render();

  /** ---------------- Install prompt ---------------- */

  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    el.installBanner.classList.remove("hidden");
  });

  el.installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    el.installBanner.classList.add("hidden");
  });

  window.addEventListener("appinstalled", () => {
    el.installBanner.classList.add("hidden");
  });

  /** ---------------- Service worker ---------------- */

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {
        /* offline caching just won't be available — app still works */
      });
    });
  }
})();
