const LOCI = 16;
const FOUNDERS = 1024;
const SEASONS = ["Lente", "Zomer", "Herfst", "Winter"];

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
    this.year = 0;
    this.season = 0;
    this.people = [];
    this.nextId = 1;
    this.speed = 1;
    this.paused = false;
    this.mode = null;
    this.selected = null;
    this.pairA = null;
    this.blessYears = 0;
    this.famineYears = 0;
    this.plagueYears = 0;
    this.showKin = false;
    this.log = [];
    this.stats = {};
    this.seedFounders();
    this.recompute();
    this.note("De schaal is gevuld met 1024 onverwante stichters.");
  }

  rand() { return this.rng(); }
  pick(arr) { return arr[Math.floor(this.rand() * arr.length)]; }

  seedFounders() {
    this.people = [];
    for (let i = 0; i < FOUNDERS; i++) {
      const genome = [];
      for (let L = 0; L < LOCI; L++) {
        genome.push([(i * 17 + L * 31) % 1024, (i * 13 + L * 47 + 500) % 1024]);
      }
      const ang = (i / FOUNDERS) * Math.PI * 2;
      const r = 0.18 + this.rand() * 0.72;
      this.people.push({
        id: this.nextId++,
        founder: true,
        sex: i % 2 === 0 ? "v" : "m",
        age: 16 + Math.floor(this.rand() * 24),
        genome,
        mother: null,
        father: null,
        alive: true,
        x: 0.5 + Math.cos(ang) * r * 0.42,
        y: 0.5 + Math.sin(ang) * r * 0.42,
        hue: (i / FOUNDERS) * 360,
        kids: 0,
        name: this.makeName(i % 2 === 0 ? "v" : "m", true)
      });
    }
  }

  makeName(sex, founder) {
    const m = ["Aion","Boras","Kael","Doros","Helios","Iason","Lykos","Nereus","Orion","Pallas","Theron","Zephyros"];
    const v = ["Aella","Briseis","Chloe","Daphne","Elara","Iris","Kallisto","Leto","Maia","Nyx","Selene","Thalia"];
    const pool = sex === "v" ? v : m;
    const n = this.pick(pool);
    return founder ? n + " I" : n;
  }

  heterozygosity(p) {
    let h = 0;
    for (const [a, b] of p.genome) if (a !== b) h++;
    return h / LOCI;
  }

  shared(a, b) {
    let s = 0, t = 0;
    for (let i = 0; i < LOCI; i++) {
      const A = a.genome[i], B = b.genome[i];
      for (const x of A) for (const y of B) {
        t++;
        if (x === y) s++;
      }
    }
    return s / t;
  }

  kinshipF(child) {
    if (!child.mother || !child.father) return 0;
    const m = this.people.find(p => p.id === child.mother);
    const f = this.people.find(p => p.id === child.father);
    if (!m || !f) return 0;
    return Math.max(0, (this.shared(m, f) - 0.02) * 1.4);
  }

  childGenome(m, f) {
    const g = [];
    for (let i = 0; i < LOCI; i++) {
      let a = m.genome[i][this.rand() < 0.5 ? 0 : 1];
      let b = f.genome[i][this.rand() < 0.5 ? 0 : 1];
      if (this.rand() < 0.004) a = Math.floor(this.rand() * 2048);
      if (this.rand() < 0.004) b = Math.floor(this.rand() * 2048);
      g.push([a, b]);
    }
    return g;
  }

  alive() { return this.people.filter(p => p.alive); }

  recompute() {
    const live = this.alive();
    const n = live.length;
    const alleles = new Set();
    let het = 0, F = 0, age = 0, fert = 0;
    for (const p of live) {
      het += this.heterozygosity(p);
      F += this.kinshipF(p);
      age += p.age;
      if (p.age >= 16 && p.age <= 45) fert++;
      for (const [a, b] of p.genome) { alleles.add(a); alleles.add(b); }
    }
    const diversity = n ? alleles.size / (FOUNDERS * 2) : 0;
    const avgF = n ? F / n : 0;
    this.stats = {
      pop: this.people.length,
      alive: n,
      fertile: fert,
      age: n ? age / n : 0,
      diversity,
      F: avgF,
      lines: alleles.size,
      het: n ? het / n : 0
    };
  }

  note(msg) {
    this.log.unshift({ y: this.year, msg });
    if (this.log.length > 40) this.log.pop();
  }

  tickYear() {
    if (this.paused) return;
    for (let s = 0; s < this.speed; s++) this.yearStep();
  }

  yearStep() {
    this.season = (this.season + 1) % 4;
    if (this.season === 0) this.year++;
    if (this.season !== 0) {
      this.wander();
      return;
    }

    if (this.blessYears > 0) this.blessYears--;
    if (this.famineYears > 0) this.famineYears--;
    if (this.plagueYears > 0) this.plagueYears--;

    const live = this.alive();
    const fertF = live.filter(p => p.sex === "v" && p.age >= 16 && p.age <= 44);
    const fertM = live.filter(p => p.sex === "m" && p.age >= 16 && p.age <= 50);

    let births = 0;
    const cap = 1800;
    const pressure = live.length / cap;
    let birthChance = 0.18 * (1 - pressure * 0.7);
    if (this.blessYears) birthChance += 0.12;
    if (this.famineYears) birthChance *= 0.35;

    for (const mother of fertF) {
      if (this.rand() > birthChance) continue;
      if (!fertM.length) break;
      let father = null;
      let best = 99;
      for (let k = 0; k < 6; k++) {
        const cand = this.pick(fertM);
        if (cand.id === mother.id) continue;
        const rel = this.shared(mother, cand);
        if (rel < best) { best = rel; father = cand; }
      }
      if (!father) continue;
      const F = Math.max(0, (best - 0.02) * 1.4);
      if (this.rand() < F * 0.35) continue;
      const sex = this.rand() < 0.5 ? "v" : "m";
      const child = {
        id: this.nextId++,
        founder: false,
        sex,
        age: 0,
        genome: this.childGenome(mother, father),
        mother: mother.id,
        father: father.id,
        alive: true,
        x: mother.x + (this.rand() - 0.5) * 0.03,
        y: mother.y + (this.rand() - 0.5) * 0.03,
        hue: (mother.hue + father.hue) / 2,
        kids: 0,
        name: this.makeName(sex, false)
      };
      mother.kids++; father.kids++;
      this.people.push(child);
      births++;
    }

    let deaths = 0;
    for (const p of live) {
      p.age++;
      let mort = 0.004;
      if (p.age > 55) mort += (p.age - 55) * 0.012;
      if (p.age > 80) mort += 0.08;
      mort += this.kinshipF(p) * 0.04;
      if (this.famineYears) mort += 0.04;
      if (this.plagueYears) mort += 0.07;
      if (this.rand() < mort) {
        p.alive = false;
        deaths++;
      }
    }

    this.wander();
    this.recompute();
    if (this.year % 10 === 0) {
      this.note(`${births} geboorten, ${deaths} doden. F=${this.stats.F.toFixed(3)}`);
    }
    if (this.stats.alive < 200) this.note("De schaal slinkt onder de 200.");
    if (this.stats.F > 0.12) this.note("Inteeltdruk wordt gevaarlijk.");
  }

  wander() {
    for (const p of this.alive()) {
      p.x += (this.rand() - 0.5) * 0.01;
      p.y += (this.rand() - 0.5) * 0.01;
      const dx = p.x - 0.5, dy = p.y - 0.5;
      const d = Math.hypot(dx, dy);
      if (d > 0.46) {
        p.x = 0.5 + dx / d * 0.46;
        p.y = 0.5 + dy / d * 0.46;
      }
    }
  }

  personAt(nx, ny) {
    let best = null, bd = 0.02;
    for (const p of this.alive()) {
      const d = Math.hypot(p.x - nx, p.y - ny);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  bless() {
    this.blessYears = 8;
    this.note("Zeus zegent de schaal: meer kinderen, acht jaar.");
  }
  famine() {
    this.famineYears = 3;
    this.note("Een hongerjaar valt over de stervelingen.");
  }
  plague() {
    this.plagueYears = 2;
    this.note("Koorts kruipt door de schaal.");
  }
  exile(p) {
    if (!p || !p.alive) return;
    p.alive = false;
    this.note(`${p.name} is verbannen uit de schaal.`);
    this.recompute();
  }

  forcePair(a, b) {
    if (!a || !b || a.sex === b.sex) {
      this.note("Een paar vereist man en vrouw.");
      return;
    }
    const mother = a.sex === "v" ? a : b;
    const father = a.sex === "m" ? a : b;
    if (mother.age < 16 || father.age < 16) {
      this.note("Te jong voor een schikking.");
      return;
    }
    const sex = this.rand() < 0.5 ? "v" : "m";
    const child = {
      id: this.nextId++,
      founder: false,
      sex,
      age: 0,
      genome: this.childGenome(mother, father),
      mother: mother.id,
      father: father.id,
      alive: true,
      x: (mother.x + father.x) / 2,
      y: (mother.y + father.y) / 2,
      hue: (mother.hue + father.hue) / 2,
      kids: 0,
      name: this.makeName(sex, false)
    };
    mother.kids++; father.kids++;
    this.people.push(child);
    this.recompute();
    this.note(`Schikking: ${mother.name} × ${father.name} → ${child.name}`);
  }
}
