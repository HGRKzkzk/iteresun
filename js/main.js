import { World } from "./sim.js";

const world = new World();
const canvas = document.getElementById("dish");
const ctx = canvas.getContext("2d");

function el(id) { return document.getElementById(id); }

function riskLabel(F, div) {
  if (world.stats.alive < 200 || F > 0.15 || div < 0.35) return "kritiek";
  if (F > 0.08 || div < 0.55) return "hoog";
  if (F > 0.04) return "matig";
  return "laag";
}

function renderInspect(p) {
  const box = el("inspect");
  if (!p) {
    box.className = "inspect empty";
    box.textContent = "Klik een sterveling in de schaal.";
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
  `;
}

function draw() {
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const g = ctx.createRadialGradient(w/2, h/2, 20, w/2, h/2, w/2);
  g.addColorStop(0, "#16101c");
  g.addColorStop(1, "#08070c");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(w/2, h/2, w/2 - 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#3d3420";
  ctx.lineWidth = 6;
  ctx.stroke();

  const live = world.alive();
  const sel = world.selected;

  for (const p of live) {
    const x = p.x * w, y = p.y * h;
    let alpha = 0.75;
    if (world.showKin && sel) {
      const rel = world.shared(p, sel);
      alpha = 0.15 + Math.min(0.85, rel * 4);
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
  el("stat-pop").textContent = world.stats.pop;
  el("stat-alive").textContent = world.stats.alive;
  el("stat-fertile").textContent = world.stats.fertile;
  el("stat-age").textContent = world.stats.age.toFixed(1);
  el("stat-div").textContent = (world.stats.diversity * 100).toFixed(1) + "%";
  el("stat-f").textContent = world.stats.F.toFixed(3);
  el("stat-risk").textContent = riskLabel(world.stats.F, world.stats.diversity);
  el("stat-lines").textContent = world.stats.lines;
  el("bar-div").style.width = Math.min(100, world.stats.diversity * 100) + "%";
  el("bar-f").style.width = Math.min(100, world.stats.F / 0.25 * 100) + "%";

  const log = el("log");
  log.innerHTML = world.log.map(e => `<li><span class="y">${e.y}</span>${e.msg}</li>`).join("");
}

canvas.addEventListener("click", (ev) => {
  const rect = canvas.getBoundingClientRect();
  const nx = (ev.clientX - rect.left) / rect.width;
  const ny = (ev.clientY - rect.top) / rect.height;
  const p = world.personAt(nx, ny);
  if (world.mode === "exile" && p) {
    world.exile(p);
    world.mode = null;
    world.selected = null;
    renderInspect(null);
    return;
  }
  if (world.mode === "pair") {
    if (!p) return;
    if (!world.pairA) {
      world.pairA = p;
      world.selected = p;
      renderInspect(p);
      world.note(`Eerste van het paar: ${p.name}`);
      return;
    }
    world.forcePair(world.pairA, p);
    world.pairA = null;
    world.mode = null;
    world.selected = p;
    renderInspect(p);
    return;
  }
  world.selected = p;
  renderInspect(p);
});

document.querySelectorAll("[data-power]").forEach(btn => {
  btn.addEventListener("click", () => {
    const power = btn.dataset.power;
    if (power === "pause") {
      world.paused = !world.paused;
      btn.textContent = world.paused ? "▶ Hervat" : "⏸ Pauze";
      return;
    }
    if (power === "speed") {
      world.speed = world.speed === 1 ? 4 : world.speed === 4 ? 12 : 1;
      btn.textContent = `⏩ Tempo ×${world.speed}`;
      return;
    }
    if (power === "bless") world.bless();
    if (power === "famine") world.famine();
    if (power === "plague") world.plague();
    if (power === "reveal") {
      world.showKin = !world.showKin;
      btn.classList.toggle("active", world.showKin);
    }
    if (power === "exile") {
      world.mode = world.mode === "exile" ? null : "exile";
      world.note(world.mode === "exile" ? "Kies wie verbannen wordt." : "Verbanning opgeheven.");
    }
    if (power === "pair") {
      world.mode = world.mode === "pair" ? null : "pair";
      world.pairA = null;
      world.note(world.mode === "pair" ? "Kies twee stervelingen." : "Schikking geannuleerd.");
    }
  });
});

function loop() {
  world.tickYear();
  draw();
  requestAnimationFrame(loop);
}
loop();
