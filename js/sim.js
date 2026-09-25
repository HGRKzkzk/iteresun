import { DEFAULTS, LAWS } from "./ontology.js";
const LOCI = 16, FOUNDERS = 1024;
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export class World {
  constructor() {
    this.rng = mulberry32(1024);
    this.year = 0; this.season = 0; this.people = []; this.nextId = 1;
    this.speed = 1; this.paused = false; this.selected = null; this.showKin = false;
    this.log = []; this.stats = {}; this.event = null; this.ended = null;
    this.peakAlive = 1024; this.lostAlleles = 0; this.prevAlleles = 0;
    this.birthsDecade = 0; this.deathsDecade = 0; this.nextOmenAt = 22;
    this.ageName = "De eerste adem"; this.law = { ...DEFAULTS }; this.revisions = 0;
    this.byId = new Map(); this.houseCount = {};
    this.seedFounders(); this.recompute(); this.prevAlleles = this.stats.lines;
    this.note("De schaal heeft een vorm. Jij zegt wat die vorm ís.");
  }
  rand() { return this.rng(); }
  pick(arr) { return arr[Math.floor(this.rand() * arr.length)]; }
  setLaw(key, value) {
    if (this.ended || !LAWS[key] || !LAWS[key].options[value]) return;
    if (this.law[key] === value) return;
    this.law[key] = value; this.revisions++;
    this.note(`Wet herschreven: ${LAWS[key].label} → ${LAWS[key].options[value]}`);
  }
  seedFounders() {
    this.people = [];
    for (let i = 0; i < FOUNDERS; i++) {
      const genome = [];
      for (let L = 0; L < LOCI; L++) genome.push([(i * 17 + L * 31) % 1024, (i * 13 + L * 47 + 500) % 1024]);
      const ang = (i / FOUNDERS) * Math.PI * 2, r = 0.18 + this.rand() * 0.72;
      const sex = i % 2 === 0 ? "v" : "m", stem = this.rawStem(sex);
      const p = { id: this.nextId++, founder: true, sex, age: 16 + Math.floor(this.rand() * 24), genome,
        mother: null, father: null, alive: true,
        x: 0.5 + Math.cos(ang) * r * 0.42, y: 0.5 + Math.sin(ang) * r * 0.42,
        hue: (i / FOUNDERS) * 360, kids: 0, stem, house: stem, gen: 0, name: stem + " I" };
      this.people.push(p); this.byId.set(p.id, p); this.houseCount[stem] = 1;
    }
  }
  rawStem(sex) {
    const m = ["Aion","Boras","Kael","Doros","Helios","Iason","Lykos","Nereus","Orion","Pallas","Theron","Zephyros"];
    const v = ["Aella","Briseis","Chloe","Daphne","Elara","Iris","Kallisto","Leto","Maia","Nyx","Selene","Thalia"];
    return this.pick(sex === "v" ? v : m);
  }
  roman(n) {
    const map = [[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]];
    let s = ""; for (const [v, g] of map) while (n >= v) { s += g; n -= v; } return s;
  }
  memoryDepth() {
    const w = this.law.who;
    if (w === "breath") return 1; if (w === "name") return 2; if (w === "house") return 3; return 8;
  }
  ancestors(p, depth) {
    const out = new Set();
    const walk = (id, d) => {
      if (!id || d < 0) return; out.add(id);
      const q = this.byId.get(id); if (!q || d === 0) return;
      walk(q.mother, d - 1); walk(q.father, d - 1);
    };
    walk(p.mother, depth - 1); walk(p.father, depth - 1); return out;
  }
  remembers(a, b) {
    const d = this.memoryDepth();
    if (d <= 1) {
      if (a.mother && (a.mother === b.id || b.mother === a.id)) return true;
      if (a.father && (a.father === b.id || b.father === a.id)) return true;
      if (a.mother && b.mother && a.mother === b.mother) return true;
      if (a.father && b.father && a.father === b.father) return true;
      return false;
    }
    const A = this.ancestors(a, d); A.add(a.id);
    const B = this.ancestors(b, d); B.add(b.id);
    for (const id of A) if (B.has(id)) return true; return false;
  }
  inheritIdentity(mother, father, sex) {
    const w = this.law.who;
    if (w === "breath") {
      const stem = this.rawStem(sex);
      return { stem, house: stem, name: stem, hue: (mother.hue + father.hue) / 2 };
    }
    if (w === "name") {
      const src = this.rand() < 0.5 ? mother : father;
      this.houseCount[src.stem] = (this.houseCount[src.stem] || 0) + 1;
      return { stem: src.stem, house: src.house, name: `${src.stem} ${this.roman(this.houseCount[src.stem])}`, hue: src.hue * 0.65 + ((mother.hue + father.hue) / 2) * 0.35 };
    }
    if (w === "house") {
      const src = mother.kids >= father.kids ? mother : father;
      this.houseCount[src.house] = (this.houseCount[src.house] || 0) + 1;
      return { stem: src.stem, house: src.house, name: `${this.rawStem(sex)} van ${src.house}`, hue: src.hue * 0.8 + ((mother.hue + father.hue) / 2) * 0.2 };
    }
    return { stem: mother.stem, house: mother.house, name: `${this.rawStem(sex)}, uit ${mother.house} en ${father.house}`, hue: (mother.hue + father.hue) / 2 };
  }
  heterozygosity(p) { let h = 0; for (const [a, b] of p.genome) if (a !== b) h++; return h / LOCI; }
  shared(a, b) {
    let s = 0, t = 0;
    for (let i = 0; i < LOCI; i++) {
      const A = a.genome[i], B = b.genome[i];
      for (const x of A) for (const y of B) { t++; if (x === y) s++; }
    }
    return s / t;
  }
  sameHouse(a, b) {
    const dh = Math.min(Math.abs(a.hue - b.hue), 360 - Math.abs(a.hue - b.hue));
    return dh < 28;
  }
  tooClose(a, b) {
    if (a.id === b.id) return true;
    if (this.law.kin === "open") return false;
    if (this.law.kin === "clan" && (this.sameHouse(a, b) || a.house === b.house)) return true;
    return this.remembers(a, b);
  }
  kinshipF(child) {
    if (!child.mother || !child.father) return 0;
    const m = this.byId.get(child.mother), f = this.byId.get(child.father);
    if (!m || !f) return 0;
    return Math.max(0, (this.shared(m, f) - 0.02) * 1.4);
  }
  childGenome(m, f) {
    const g = [];
    for (let i = 0; i < LOCI; i++) {
      let a = m.genome[i][this.rand() < 0.5 ? 0 : 1];
      let b = f.genome[i][this.rand() < 0.5 ? 0 : 1];
      if (this.rand() < 0.003) a = Math.floor(this.rand() * 2048);
      if (this.rand() < 0.003) b = Math.floor(this.rand() * 2048);
      g.push([a, b]);
    }
    return g;
  }
  fertileWindow(sex) {
    if (this.law.age === "early") return sex === "v" ? [15, 36] : [15, 42];
    if (this.law.age === "late") return sex === "v" ? [20, 46] : [22, 55];
    return sex === "v" ? [16, 44] : [16, 50];
  }
  birthRate() {
    if (this.law.fruit === "spare") return 0.09;
    if (this.law.fruit === "plenty") return 0.24;
    return 0.16;
  }
  alive() { return this.people.filter(p => p.alive); }
  recompute() {
    const live = this.alive(), n = live.length, alleles = new Set();
    let het = 0, F = 0, age = 0, fert = 0;
    const [vf, vt] = this.fertileWindow("v"), [mf, mt] = this.fertileWindow("m");
    for (const p of live) {
      het += this.heterozygosity(p); F += this.kinshipF(p); age += p.age;
      const [lo, hi] = p.sex === "v" ? [vf, vt] : [mf, mt];
      if (p.age >= lo && p.age <= hi) fert++;
      for (const [a, b] of p.genome) { alleles.add(a); alleles.add(b); }
    }
    this.stats = { pop: this.people.length, alive: n, fertile: fert, age: n ? age / n : 0,
      diversity: n ? alleles.size / (FOUNDERS * 2) : 0, F: n ? F / n : 0, lines: alleles.size,
      het: n ? het / n : 0, houses: new Set(live.map(p => p.house)).size, memory: this.memoryDepth() };
    if (n > this.peakAlive) this.peakAlive = n;
    this.ageName = this.year < 40 ? "De eerste adem" : this.year < 100 ? "De eeuw van belofte" : this.year < 250 ? "Het lange geduld" : "Mythe";
  }
  note(msg) { this.log.unshift({ y: this.year, msg }); if (this.log.length > 50) this.log.pop(); }
  risk() {
    const { alive, F, diversity } = this.stats;
    if (alive < 200 || F > 0.15 || diversity < 0.35) return "kritiek";
    if (F > 0.08 || diversity < 0.55 || alive < 400) return "hoog";
    if (F > 0.04) return "matig"; return "laag";
  }
  chooseFather(mother, men) {
    let pool = men.filter(c => !this.tooClose(mother, c));
    if (!pool.length) pool = men.filter(c => c.id !== mother.id);
    if (!pool.length) return null;
    let father = null, best = this.law.kin === "open" ? -1 : 99;
    for (let k = 0; k < 7; k++) {
      const cand = this.pick(pool), rel = this.shared(mother, cand);
      if (this.law.kin === "open") { if (rel > best) { best = rel; father = cand; } }
      else if (rel < best) { best = rel; father = cand; }
    }
    return father || this.pick(pool);
  }
  yearStep() {
    if (this.ended || this.event) return;
    this.season = (this.season + 1) % 4;
    if (this.season !== 0) { this.wander(); return; }
    this.year++;
    const live = this.alive();
    const [vf, vt] = this.fertileWindow("v"), [mf, mt] = this.fertileWindow("m");
    const fertF = live.filter(p => p.sex === "v" && p.age >= vf && p.age <= vt);
    const fertM = live.filter(p => p.sex === "m" && p.age >= mf && p.age <= mt);
    const cap = this.law.fruit === "plenty" ? 2000 : this.law.fruit === "spare" ? 1200 : 1600;
    let birthChance = this.birthRate() * (1 - (live.length / cap) * 0.75);
    let births = 0;
    for (const mother of fertF) {
      if (this.rand() > birthChance) continue;
      const father = this.chooseFather(mother, fertM); if (!father) continue;
      const F = Math.max(0, (this.shared(mother, father) - 0.02) * 1.4);
      if (this.tooClose(mother, father) && this.law.kin !== "open") continue;
      if (this.rand() < F * 0.4) continue;
      const sex = this.rand() < 0.5 ? "v" : "m", ident = this.inheritIdentity(mother, father, sex);
      const child = { id: this.nextId++, founder: false, sex, age: 0, genome: this.childGenome(mother, father),
        mother: mother.id, father: father.id, alive: true,
        x: mother.x + (this.rand() - 0.5) * 0.03, y: mother.y + (this.rand() - 0.5) * 0.03,
        hue: ident.hue, kids: 0, stem: ident.stem, house: ident.house,
        gen: Math.max(mother.gen, father.gen) + 1, name: ident.name };
      mother.kids++; father.kids++; this.people.push(child); this.byId.set(child.id, child); births++;
    }
    let deaths = 0;
    for (const p of live) {
      p.age++; let mort = 0.005;
      if (this.law.end === "keep") { if (p.age > 62) mort += (p.age - 62) * 0.008; if (p.age > 88) mort += 0.06; }
      else if (this.law.end === "yield") { if (p.age > 50) mort += (p.age - 50) * 0.018; mort += this.kinshipF(p) * 0.09; if (p.age < 5 && this.kinshipF(p) > 0.08) mort += 0.06; }
      else { if (p.age > 55) mort += (p.age - 55) * 0.013; if (p.age > 80) mort += 0.09; mort += this.kinshipF(p) * 0.05; }
      if (this.rand() < mort) { p.alive = false; deaths++; }
    }
    this.birthsDecade += births; this.deathsDecade += deaths; this.wander(); this.recompute();
    const lost = Math.max(0, this.prevAlleles - this.stats.lines);
    if (lost > 0) { this.lostAlleles += lost; if (lost >= 8) this.note(`${lost} unieke lijnen zijn dit jaar voorgoed uitgedoofd.`); }
    this.prevAlleles = this.stats.lines;
    if (this.year % 10 === 0) {
      this.note(`Decennium: +${this.birthsDecade} / −${this.deathsDecade}. F=${this.stats.F.toFixed(3)}`);
      this.birthsDecade = 0; this.deathsDecade = 0;
    }
    if (this.year === this.nextOmenAt) this.spawnQuestion(); this.judge();
  }
  wander() {
    const huddle = this.law.house === "hearth";
    for (const p of this.alive()) {
      if (huddle) {
        const ang = (p.hue / 360) * Math.PI * 2;
        p.x += (0.5 + Math.cos(ang) * 0.32 - p.x) * 0.02 + (this.rand() - 0.5) * 0.006;
        p.y += (0.5 + Math.sin(ang) * 0.32 - p.y) * 0.02 + (this.rand() - 0.5) * 0.006;
      } else { p.x += (this.rand() - 0.5) * 0.01; p.y += (this.rand() - 0.5) * 0.01; }
      const dx = p.x - 0.5, dy = p.y - 0.5, d = Math.hypot(dx, dy);
      if (d > 0.46) { p.x = 0.5 + dx / d * 0.46; p.y = 0.5 + dy / d * 0.46; }
    }
  }
  personAt(nx, ny) {
    let best = null, bd = 0.02;
    for (const p of this.alive()) { const d = Math.hypot(p.x - nx, p.y - ny); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  spawnQuestion() {
    this.nextOmenAt = this.year + 18 + Math.floor(this.rand() * 20);
    const q = [
      { title: "Wat telt als te na?", body: "Is alleen de moederschoot bloed, of het hele huis?",
        choices: [{ label: "Ouder, broer, zus", run: () => this.setLaw("kin", "nuclear") }, { label: "Het huis is verboden", run: () => this.setLaw("kin", "clan") }, { label: "Niets is te na", run: () => this.setLaw("kin", "open") }] },
      { title: "Wat blijft hetzelfde wezen?", body: "Wat zij niet herinneren, kunnen zij niet mijden.",
        choices: [{ label: "Alleen dit lichaam", run: () => this.setLaw("who", "breath") }, { label: "De naam", run: () => this.setLaw("who", "name") }, { label: "Het huis", run: () => this.setLaw("who", "house") }, { label: "De stichtersdraad", run: () => this.setLaw("who", "thread") }] },
      { title: "Moet bloed bijeen blijven?", body: "Eén veld, of een haard per lijn.",
        choices: [{ label: "Eén veld", run: () => this.setLaw("house", "mix") }, { label: "Huizen van kleur", run: () => this.setLaw("house", "hearth") }] },
      { title: "Hoe zwaar is een kind?", body: "Dat is wat een leven ís.",
        choices: [{ label: "Spaarzaam", run: () => this.setLaw("fruit", "spare") }, { label: "De gegeven maat", run: () => this.setLaw("fruit", "given") }, { label: "Overvloed", run: () => this.setLaw("fruit", "plenty") }] },
      { title: "Wie mag wijken?", body: "Wat is een einde?",
        choices: [{ label: "Houd de ouden", run: () => this.setLaw("end", "keep") }, { label: "Wie zwak is, wijkt", run: () => this.setLaw("end", "yield") }, { label: "Geen onderscheid", run: () => this.setLaw("end", "equal") }] }
    ];
    this.event = this.pick(q); this.paused = true;
  }
  resolve(index) {
    if (!this.event) return;
    const choice = this.event.choices[index]; if (choice) choice.run();
    this.event = null; this.paused = false;
  }
  judge() {
    if (this.ended) return;
    if (this.stats.alive < 80) this.ended = { title: "De schaal is leeg", body: this.chronicle("Te weinig stemmen om een volk te heten.") };
    else if (this.stats.F > 0.18) this.ended = { title: "Eén draad", body: this.chronicle("Wat bloed was, is herhaling geworden.") };
    else if (this.stats.diversity < 0.22 && this.year > 30) this.ended = { title: "Eén gezicht", body: this.chronicle("De poel is een spiegel.") };
    else if (this.year === 100) {
      this.event = { title: "Einde van de eerste eeuw", body: `100 jaar. ${this.stats.alive} levenden. F=${this.stats.F.toFixed(3)}. ${this.revisions} herschrijvingen.`, choices: [{ label: "De wetten blijven de wereld", run: () => this.note("De tweede eeuw neemt de vorm over.") }] };
      this.paused = true;
    } else if (this.year === 250 && this.stats.F < 0.12 && this.stats.alive > 250) {
      this.ended = { title: "Mythe", body: this.chronicle("De vorm hield. Geen ingreep was nodig."), myth: true };
    }
    if (this.ended) this.paused = true;
  }
  chronicle(reason) {
    const laws = Object.entries(this.law).map(([k, v]) => `${LAWS[k].label} ${LAWS[k].options[v]}`).join("\n");
    return `${reason}\n\nJaar ${this.year} · ${this.ageName}\nLevend: ${this.stats.alive} (piek ${this.peakAlive})\nInteelt F: ${this.stats.F.toFixed(3)}\nDiversiteit: ${(this.stats.diversity * 100).toFixed(1)}%\nUitgedoofd: ${this.lostAlleles}\nHerschrijvingen: ${this.revisions}\n\n${laws}`;
  }
}
