import { World } from "./sim.js";

const world = new World();
const canvas = document.getElementById("dish");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");

let acc = 0;
let last = performance.now();
const MS_SEASON = 700;

function el(id) { return document.getElementById(id); }

function renderInspect(p) {
  const box = el("inspect");
  if (!p) {
    box.className = "inspect empty";
    box.textContent = "Klik een sterveling in de schaal.";
    return;
  }
  box.className = "inspect";
  const f = world.kinshipF(p);
  const lastBlood = world.heterozygosity(p) < 0.35 && !p.founder;
  box.innerHTML = `
    <div class="name">${p.name} · ${p.sex === "v" ? "vrouw" : "man"}</div>
    <div>leeftijd ${p.age}${p.alive ? "" : " · gestorven"}</div>
    <div>${p.founder ? "stichter" : "nakomeling"} · kinderen ${p.kids}</div>
    <div>heterozygotie ${(world.heterozygosity(p) * 100).toFixed(0)}%</div>
    <div>inteelt F ${f.toFixed(3)}</div>
    <div>ouders ${p.mother ?? "—"} / ${p.father ?? "—"}</div>
    ${lastBlood ? "<div class='warn-line'>Dun bloed — deze lijn is kwetsbaar.</div>" : ""}
  `;
}

function renderOverlay() {
  if (world.ended) {
    overlay.classList.add("show");
    overlay.innerHTML = `
      <div class="card ${world.ended.myth ? "myth" : "doom"}">
        <h3>${world.ended.title}</h3>
        <pre>${world.ended.body}</pre>
        <button id="again">Nieuwe schaal</button>
      </div>`;
    el("again").onclick = () => location.reload();
    return;
  }
  if (world.event) {
    overlay.classList.add("show");
    overlay.innerHTML = `
      <div class="card omen">
        <p class="kicker">Orakel · jaar ${world.year}</p>
        <h3>${world.event.title}</h3>
        <p>${world.event.body}</p>
        <div class="choices"></div>
      </div>`;
    const wrap = overlay.querySelector(".choices");
    world.event.choices.forEach((c, i) => {
      const b = document.createElement("button");
      b.textContent = c.label;
      b.onclick = () => world.resolve(i);
      wrap.appendChild(b);
    });
    return;
  }
  overlay.classList.remove("show");
  overlay.innerHTML = "";
}

function draw() {
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const risk = world.risk();
  const g = ctx.createRadialGradient(w/2, h/2, 20, w/2, h/2, w/2);
  g.addColorStop(0, risk === "kritiek" ? "#2a1010" : "#16101c");
  g.addColorStop(1, "#08070c");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(w/2, h/2, w/2 - 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = risk === "kritiek" ? "#c45a4a" : risk === "hoog" ? "#c48a4a" : "#3d3420";
  ctx.lineWidth = risk === "kritiek" ? 10 : 6;
  ctx.stroke();
  if (world.stats.F > 0.1) {
    ctx.strokeStyle = "rgba(196,90,74,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w * 0.28, h * 0.22);
    ctx.lineTo(w * 0.62, h * 0.78);
    ctx.moveTo(w * 0.7, h * 0.3);
    ctx.lineTo(w * 0.4, h * 0.7);
    ctx.stroke();
  }
  const live = world.alive();
  const sel = world.selected;
  for (const p of live) {
    const x = p.x * w, y = p.y * h;
    let alpha = 0.78;
    if (world.showKin && sel) {
      const rel = world.shared(p, sel);
      alpha = 0.12 + Math.min(0.88, rel * 4);
    }
    const size = p.age < 12 ? 2.2 : p.age > 60 ? 3.4 : 2.8;
    ctx.beginPath();
    ctx.fillStyle = `hsla(${p.hue}, 62%, ${p.sex === "v" ? 68 : 58}%, ${alpha})`;
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    if (sel && sel.id === p.id) {
      ctx.strokeStyle = "#f0e6c8";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
  el("year").textContent = `Jaar ${world.year}`;
  el("season").textContent = ["Lente","Zomer","Herfst","Winter"][world.season];
  el("age-name").textContent = world.ageName;
  el("stat-pop").textContent = world.stats.pop;
  el("stat-alive").textContent = world.stats.alive;
  el("stat-fertile").textContent = world.stats.fertile;
  el("stat-age").textContent = world.stats.age.toFixed(1);
  el("stat-div").textContent = (world.stats.diversity * 100).toFixed(1) + "%";
  el("stat-f").textContent = world.stats.F.toFixed(3);
  el("stat-risk").textContent = risk;
  el("stat-lines").textContent = world.stats.lines;
  el("stat-lost").textContent = world.lostAlleles;
  el("stat-favor").textContent = "⚡".repeat(world.favor) + "·".repeat(Math.max(0, world.maxFavor - world.favor));
  el("bar-div").style.width = Math.min(100, world.stats.diversity * 100) + "%";
  el("bar-f").style.width = Math.min(100, world.stats.F / 0.25 * 100) + "%";
  document.body.dataset.risk = risk;
  const log = el("log");
  log.innerHTML = world.log.map(e => `<li><span class="y">${e.y}</span>${e.msg}</li>`).join("");
  renderOverlay();
}

canvas.addEventListener("click", (ev) => {
  if (world.event || world.ended) return;
  const rect = canvas.getBoundingClientRect();
  const nx = (ev.clientX - rect.left) / rect.width;
  const ny = (ev.clientY - rect.top) / rect.height;
  const p = world.personAt(nx, ny);
  if (world.mode === "exile" && p) {
    world.exile(p); world.mode = null; world.selected = null; renderInspect(null); return;
  }
  if (world.mode === "pair") {
    if (!p) return;
    if (!world.pairA) {
      world.pairA = p; world.selected = p; renderInspect(p);
      world.note(`Eerste van het paar: ${p.name}`); return;
    }
    world.forcePair(world.pairA, p);
    world.pairA = null; world.mode = null; world.selected = p; renderInspect(p); return;
  }
  world.selected = p; renderInspect(p);
});

document.querySelectorAll("[data-power]").forEach(btn => {
  btn.addEventListener("click", () => {
    if (world.ended) return;
    const power = btn.dataset.power;
    if (power === "pause") {
      if (world.event) return;
      world.paused = !world.paused;
      btn.textContent = world.paused ? "▶ Hervat" : "⏸ Pauze";
      return;
    }
    if (power === "speed") {
      world.speed = world.speed === 1 ? 3 : world.speed === 3 ? 8 : 1;
      btn.textContent = `⏩ Tempo ×${world.speed}`;
      return;
    }
    if (world.event) return;
    if (power === "bless") world.bless();
    if (power === "famine") world.famine();
    if (power === "plague") world.plague();
    if (power === "reveal") {
      world.showKin = !world.showKin;
      btn.classList.toggle("active", world.showKin);
    }
    if (power === "exile") {
      world.mode = world.mode === "exile" ? null : "exile";
      world.note(world.mode === "exile" ? "Kies wie verbannen wordt. Kost 1 ⚡." : "Verbanning opgeheven.");
    }
    if (power === "pair") {
      world.mode = world.mode === "pair" ? null : "pair";
      world.pairA = null;
      world.note(world.mode === "pair" ? "Kies twee stervelingen. Kost 1 ⚡." : "Schikking geannuleerd.");
    }
  });
});

function loop(now) {
  const dt = now - last;
  last = now;
  if (!world.paused && !world.event && !world.ended) {
    acc += dt * world.speed;
    while (acc >= MS_SEASON) {
      acc -= MS_SEASON;
      world.yearStep();
    }
  }
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
