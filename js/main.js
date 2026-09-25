import { World } from "./sim.js";
import { LAWS } from "./ontology.js";

const world = new World();
const canvas = document.getElementById("dish");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");

let acc = 0;
let last = performance.now();
const MS_SEASON = 700;
function el(id) { return document.getElementById(id); }

function identityLine(p) {
  const w = world.law.who;
  if (w === "breath") return "Dit lichaam. Geen morgen-ik.";
  if (w === "name") return `De naam ${p.stem} gaat door.`;
  if (w === "house") return `Het huis ${p.house} is het wezen.`;
  return `Draad uit ${p.house}, ${p.gen} geslachten van de stichters.`;
}

function renderLaws() {
  const root = el("laws");
  root.innerHTML = "";
  for (const [key, def] of Object.entries(LAWS)) {
    const wrap = document.createElement("div");
    wrap.className = "law";
    wrap.innerHTML = `<h3>${def.label}</h3>`;
    for (const [val, text] of Object.entries(def.options)) {
      const b = document.createElement("button");
      b.textContent = text;
      b.className = world.law[key] === val ? "on" : "";
      b.onclick = () => { if (world.ended) return; world.setLaw(key, val); renderLaws(); };
      wrap.appendChild(b);
    }
    root.appendChild(wrap);
  }
}

function renderInspect(p) {
  const box = el("inspect");
  if (!p) {
    box.className = "inspect empty";
    box.textContent = "Klik iemand. Je verandert geen lot. Alleen de wet.";
    return;
  }
  box.className = "inspect";
  const f = world.kinshipF(p);
  box.innerHTML = `
    <div class="name">${p.name} · ${p.sex === "v" ? "vrouw" : "man"}</div>
    <div>leeftijd ${p.age}${p.alive ? "" : " · gestorven"}</div>
    <div>${p.founder ? "stichter" : "nakomeling"} · kinderen ${p.kids}</div>
    <div>heterozygotie ${(world.heterozygosity(p) * 100).toFixed(0)}%</div>
    <div>inteelt F ${f.toFixed(3)}</div>
    <div>ouders ${p.mother ?? "—"} / ${p.father ?? "—"}</div>
    <div>huis ${p.house} · geslacht ${p.gen}</div>
    <div class="who-line">${identityLine(p)}</div>`;
}

function renderOverlay() {
  if (world.ended) {
    overlay.classList.add("show");
    overlay.innerHTML = `<div class="card ${world.ended.myth ? "myth" : "doom"}"><h3>${world.ended.title}</h3><pre>${world.ended.body}</pre><button id="again">Nieuwe schaal</button></div>`;
    el("again").onclick = () => location.reload();
    return;
  }
  if (world.event) {
    overlay.classList.add("show");
    overlay.innerHTML = `<div class="card omen"><p class="kicker">Vraag · jaar ${world.year}</p><h3>${world.event.title}</h3><p>${world.event.body}</p><div class="choices"></div></div>`;
    const wrap = overlay.querySelector(".choices");
    world.event.choices.forEach((c, i) => {
      const b = document.createElement("button");
      b.textContent = c.label;
      b.onclick = () => { world.resolve(i); renderLaws(); };
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
  const g = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, w / 2);
  g.addColorStop(0, risk === "kritiek" ? "#2a1010" : "#16101c");
  g.addColorStop(1, "#08070c");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = risk === "kritiek" ? "#c45a4a" : risk === "hoog" ? "#c48a4a" : "#3d3420";
  ctx.lineWidth = risk === "kritiek" ? 10 : 6;
  ctx.stroke();
  const live = world.alive();
  const sel = world.selected;
  for (const p of live) {
    const x = p.x * w, y = p.y * h;
    let alpha = 0.78;
    if (world.showKin && sel) alpha = 0.12 + Math.min(0.88, world.shared(p, sel) * 4);
    ctx.beginPath();
    ctx.fillStyle = `hsla(${p.hue}, 62%, ${p.sex === "v" ? 68 : 58}%, ${alpha})`;
    ctx.arc(x, y, p.age < 12 ? 2.2 : p.age > 60 ? 3.4 : 2.8, 0, Math.PI * 2);
    ctx.fill();
    if (sel && sel.id === p.id) { ctx.strokeStyle = "#f0e6c8"; ctx.lineWidth = 1.5; ctx.stroke(); }
  }
  el("year").textContent = `Jaar ${world.year}`;
  el("season").textContent = ["Lente", "Zomer", "Herfst", "Winter"][world.season];
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
  el("stat-rev").textContent = world.revisions;
  el("stat-houses").textContent = world.stats.houses ?? "—";
  el("stat-mem").textContent = (world.stats.memory ?? 2) + " gesl.";
  el("bar-div").style.width = Math.min(100, world.stats.diversity * 100) + "%";
  el("bar-f").style.width = Math.min(100, world.stats.F / 0.25 * 100) + "%";
  document.body.dataset.risk = risk;
  el("log").innerHTML = world.log.map(e => `<li><span class="y">${e.y}</span>${e.msg}</li>`).join("");
  renderOverlay();
}

canvas.addEventListener("click", (ev) => {
  if (world.event || world.ended) return;
  const rect = canvas.getBoundingClientRect();
  world.selected = world.personAt((ev.clientX - rect.left) / rect.width, (ev.clientY - rect.top) / rect.height);
  renderInspect(world.selected);
});

document.querySelectorAll("[data-power]").forEach(btn => {
  btn.addEventListener("click", () => {
    const power = btn.dataset.power;
    if (power === "pause") {
      if (world.event || world.ended) return;
      world.paused = !world.paused;
      btn.textContent = world.paused ? "▶ Hervat" : "⏸ Pauze";
    }
    if (power === "speed") {
      world.speed = world.speed === 1 ? 3 : world.speed === 3 ? 8 : 1;
      btn.textContent = `⏩ Tempo ×${world.speed}`;
    }
    if (power === "reveal") {
      world.showKin = !world.showKin;
      btn.classList.toggle("active", world.showKin);
    }
  });
});

renderLaws();
function loop(now) {
  const dt = now - last; last = now;
  if (!world.paused && !world.event && !world.ended) {
    acc += dt * world.speed;
    while (acc >= MS_SEASON) { acc -= MS_SEASON; world.yearStep(); }
  }
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
