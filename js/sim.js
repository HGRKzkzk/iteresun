const LOCI = 16;
const FOUNDERS = 1024;

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
    this.favor = 7;
    this.maxFavor = 12;
    this.event = null;
    this.ended = null;
    this.peakAlive = 1024;
    this.lostAlleles = 0;
    this.prevAlleles = 0;
    this.birthsDecade = 0;
    this.deathsDecade = 0;
    this.nextOmenAt = 18;
    this.ageName = "De eerste adem";
    this.seedFounders();
    this.recompute();
    this.prevAlleles = this.stats.lines;
    this.note("De schaal is gevuld. Jouw blik is het enige oordeel.");
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
        id: this.nextId++, founder: true,
        sex: i % 2 === 0 ? "v" : "m",
        age: 16 + Math.floor(this.rand() * 24),
        genome, mother: null, father: null, alive: true,
        x: 0.5 + Math.cos(ang) * r * 0.42,
        y: 0.5 + Math.sin(ang) * r * 0.42,
        hue: (i / FOUNDERS) * 360, kids: 0,
        name: this.makeName(i % 2 === 0 ? "v" : "m", true)
      });
    }
  }

  makeName(sex, founder) {
    const m = ["Aion","Boras","Kael","Doros","Helios","Iason","Lykos","Nereus","Orion","Pallas","Theron","Zephyros"];
    const v = ["Aella","Briseis","Chloe","Daphne","Elara","Iris","Kallisto","Leto","Maia","Nyx","Selene","Thalia"];
    const n = this.pick(sex === "v" ? v : m);
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
      for (const x of A) for (const y of B) { t++; if (x === y) s++; }
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

  spend(n) {
    if (this.favor < n) { this.note("Te weinig gunst. De bliksem zwijgt."); return false; }
    this.favor -= n; return true;
  }

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
    this.stats = {
      pop: this.people.length, alive: n, fertile: fert,
      age: n ? age / n : 0,
      diversity: n ? alleles.size / (FOUNDERS * 2) : 0,
      F: n ? F / n : 0, lines: alleles.size, het: n ? het / n : 0
    };
    if (n > this.peakAlive) this.peakAlive = n;
    if (this.year < 40) this.ageName = "De eerste adem";
    else if (this.year < 100) this.ageName = "De eeuw van belofte";
    else if (this.year < 250) this.ageName = "Het lange geduld";
    else this.ageName = "Mythe";
  }

  note(msg) {
    this.log.unshift({ y: this.year, msg });
    if (this.log.length > 50) this.log.pop();
  }

  risk() {
    const { alive, F, diversity } = this.stats;
    if (alive < 200 || F > 0.15 || diversity < 0.35) return "kritiek";
    if (F > 0.08 || diversity < 0.55 || alive < 400) return "hoog";
    if (F > 0.04 || this.famineYears || this.plagueYears) return "matig";
    return "laag";
  }

  yearStep() {
    if (this.ended || this.event) return;
    this.season = (this.season + 1) % 4;
    if (this.season !== 0) { this.wander(); return; }
    this.year++;
    if (this.blessYears > 0) this.blessYears--;
    if (this.famineYears > 0) this.famineYears--;
    if (this.plagueYears > 0) this.plagueYears--;
    const live = this.alive();
    const fertF = live.filter(p => p.sex === "v" && p.age >= 16 && p.age <= 44);
    const fertM = live.filter(p => p.sex === "m" && p.age >= 16 && p.age <= 50);
    let births = 0;
    const pressure = live.length / 1600;
    let birthChance = 0.16 * (1 - pressure * 0.75);
    if (this.blessYears) birthChance += 0.10;
    if (this.famineYears) birthChance *= 0.32;
    for (const mother of fertF) {
      if (this.rand() > birthChance) continue;
      if (!fertM.length) break;
      let father = null, best = 99;
      for (let k = 0; k < 6; k++) {
        const cand = this.pick(fertM);
        if (cand.id === mother.id) continue;
        const rel = this.shared(mother, cand);
        if (rel < best) { best = rel; father = cand; }
      }
      if (!father) continue;
      const F = Math.max(0, (best - 0.02) * 1.4);
      if (this.rand() < F * 0.4) continue;
      const sex = this.rand() < 0.5 ? "v" : "m";
      const child = {
        id: this.nextId++, founder: false, sex, age: 0,
        genome: this.childGenome(mother, father),
        mother: mother.id, father: father.id, alive: true,
        x: mother.x + (this.rand() - 0.5) * 0.03,
        y: mother.y + (this.rand() - 0.5) * 0.03,
        hue: (mother.hue + father.hue) / 2, kids: 0,
        name: this.makeName(sex, false)
      };
      mother.kids++; father.kids++;
      this.people.push(child); births++;
    }
    let deaths = 0;
    for (const p of live) {
      p.age++;
      let mort = 0.005;
      if (p.age > 55) mort += (p.age - 55) * 0.013;
      if (p.age > 80) mort += 0.09;
      mort += this.kinshipF(p) * 0.05;
      if (this.famineYears) mort += 0.045;
      if (this.plagueYears) mort += 0.08;
      if (this.rand() < mort) { p.alive = false; deaths++; }
    }
    this.birthsDecade += births; this.deathsDecade += deaths;
    this.wander(); this.recompute();
    const lost = Math.max(0, this.prevAlleles - this.stats.lines);
    if (lost > 0) {
      this.lostAlleles += lost;
      if (lost >= 8) this.note(`${lost} unieke lijnen zijn dit jaar voorgoed uitgedoofd.`);
    }
    this.prevAlleles = this.stats.lines;
    if (this.year % 10 === 0) {
      this.note(`Decennium: +${this.birthsDecade} / −${this.deathsDecade}. F=${this.stats.F.toFixed(3)}`);
      this.birthsDecade = 0; this.deathsDecade = 0;
      if (this.risk() === "laag" && this.favor < this.maxFavor) this.favor++;
    }
    if (this.year === this.nextOmenAt) this.spawnOmen();
    this.judge();
  }

  wander() {
    for (const p of this.alive()) {
      p.x += (this.rand() - 0.5) * 0.008;
      p.y += (this.rand() - 0.5) * 0.008;
      const dx = p.x - 0.5, dy = p.y - 0.5;
      const d = Math.hypot(dx, dy);
      if (d > 0.46) { p.x = 0.5 + dx / d * 0.46; p.y = 0.5 + dy / d * 0.46; }
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

  spawnOmen() {
    this.nextOmenAt = this.year + 14 + Math.floor(this.rand() * 16);
    const live = this.alive();
    const fert = live.filter(p => p.age >= 16 && p.age <= 45);
    const rare = [...live].sort((a, b) => this.heterozygosity(a) - this.heterozygosity(b))[0];
    const omens = [
      {
        title: "De oogst wankelt",
        body: "Drie magere jaren dreigen. Een zegen kost gunst. Niets doen kost lijken.",
        choices: [
          { label: "Zegen de akkers (2 ⚡)", run: () => { if (this.spend(2)) { this.blessYears = 6; this.note("De akkers worden gespaard."); } } },
          { label: "Laat hen hongeren", run: () => { this.famineYears = 3; this.note("Je wendt de blik af."); } }
        ]
      },
      {
        title: "Een lijn wordt dun",
        body: rare ? `${rare.name} draagt zeldzaam bloed. Eén kind nu, of het sterft misschien kinderloos.` : "Een dunne lijn vraagt om een schikking.",
        choices: [
          { label: "Schik een kind (1 ⚡)", run: () => {
            if (!rare || !this.spend(1)) return;
            const mate = this.pick(fert.filter(p => p.sex !== rare.sex && p.id !== rare.id));
            if (mate) this.forcePair(rare, mate, true);
          } },
          { label: "Het lot beslist", run: () => this.note("Je laat de dunne lijn aan het toeval.") }
        ]
      },
      {
        title: "Hubris",
        body: "De stervelingen zingen jouw naam te luid. Straf hen, of verdwijn even uit hun gebeden.",
        choices: [
          { label: "Zend koorts (geen gunst)", run: () => { this.plagueYears = 2; this.favor = Math.min(this.maxFavor, this.favor + 2); this.note("Angst vult de schaal. Gunst keert terug."); } },
          { label: "Verdraag de hymne", run: () => { this.favor = Math.max(0, this.favor - 1); this.note("Je slikt de hymne. Iets in jou koelt af."); } }
        ]
      },
      {
        title: "Orakel van het glas",
        body: `Als de inteelt F boven 0.12 stijgt vóór jaar ${this.year + 40}, barst de schaal. Nu F=${this.stats.F.toFixed(3)}.`,
        choices: [{ label: "Ik heb het gehoord", run: () => this.note("Het orakel is gesproken.") }]
      }
    ];
    if (this.stats.alive > 1400) {
      omens.push({
        title: "De schaal zit vol",
        body: "Te veel adem op te weinig glas. Verbannen, of een magere tijd.",
        choices: [
          { label: "Hongerjaar", run: () => { this.famineYears = 2; } },
          { label: "Ik kies later wie verdwijnt", run: () => { this.mode = "exile"; this.note("Wijs een verbanning aan."); } }
        ]
      });
    }
    this.event = this.pick(omens);
    this.paused = true;
  }

  resolve(index) {
    if (!this.event) return;
    const choice = this.event.choices[index];
    if (choice) choice.run();
    this.event = null;
    this.paused = false;
  }

  judge() {
    if (this.ended) return;
    if (this.stats.alive < 80) {
      this.ended = { title: "De schaal is leeg", body: this.chronicle("Te weinig stemmen om een volk te heten.") };
    } else if (this.stats.F > 0.18) {
      this.ended = { title: "Het glas barst", body: this.chronicle("Inteelt heeft de lijnen tot één ziekelijke draad gesponnen.") };
    } else if (this.stats.diversity < 0.22 && this.year > 30) {
      this.ended = { title: "Eén gezicht, duizend namen", body: this.chronicle("De genenpoel is verdwenen. Wat rest is echo.") };
    } else if (this.year === 100) {
      this.event = {
        title: "Einde van de eerste eeuw",
        body: `100 jaar. ${this.stats.alive} levenden. F=${this.stats.F.toFixed(3)}. ${this.lostAlleles} lijnen uitgedoofd. De tweede eeuw eist geduld.`,
        choices: [{ label: "Ga door", run: () => this.note("De tweede eeuw begint.") }]
      };
      this.paused = true;
    } else if (this.year === 250 && this.stats.F < 0.12 && this.stats.alive > 250) {
      this.ended = { title: "Mythe", body: this.chronicle("Ze houden stand. Jouw naam wordt een seizoen."), myth: true };
    }
    if (this.ended) this.paused = true;
  }

  chronicle(reason) {
    return `${reason}\n\nJaar ${this.year} · ${this.ageName}\nLevend: ${this.stats.alive} (piek ${this.peakAlive})\nInteelt F: ${this.stats.F.toFixed(3)}\nDiversiteit: ${(this.stats.diversity * 100).toFixed(1)}%\nUitgedoofde lijnen: ${this.lostAlleles}\nGunst resterend: ${this.favor}`;
  }

  bless() {
    if (this.ended || !this.spend(2)) return;
    this.blessYears = 8;
    this.note("Zegen: acht vette jaren. Dat kost bliksem.");
  }
  famine() {
    if (this.ended || !this.spend(1)) return;
    this.famineYears = 3;
    this.note("Je legt een magere tijd op.");
  }
  plague() {
    if (this.ended || !this.spend(1)) return;
    this.plagueYears = 2;
    this.note("Koorts. Goedkoop. Wreed.");
  }
  exile(p) {
    if (!p || !p.alive || this.ended) return;
    if (!this.spend(1)) return;
    p.alive = false;
    this.note(`${p.name} is uit de schaal gewist.`);
    this.recompute();
  }

  forcePair(a, b, free = false) {
    if (!a || !b || a.sex === b.sex) { this.note("Een paar vereist man en vrouw."); return; }
    if (!free && !this.spend(1)) return;
    const mother = a.sex === "v" ? a : b;
    const father = a.sex === "m" ? a : b;
    if (mother.age < 16 || father.age < 16) {
      this.note("Te jong voor een schikking.");
      if (!free) this.favor++;
      return;
    }
    const sex = this.rand() < 0.5 ? "v" : "m";
    const child = {
      id: this.nextId++, founder: false, sex, age: 0,
      genome: this.childGenome(mother, father),
      mother: mother.id, father: father.id, alive: true,
      x: (mother.x + father.x) / 2, y: (mother.y + father.y) / 2,
      hue: (mother.hue + father.hue) / 2, kids: 0,
      name: this.makeName(sex, false)
    };
    mother.kids++; father.kids++;
    this.people.push(child);
    this.recompute();
    this.note(`Schikking: ${mother.name} × ${father.name} → ${child.name}`);
  }
}
