# Iteresun — Petrischaal van Zeus

Browser-godgame rond een gesloten populatie van **1024 genetisch diverse stichters**.

Je duwt het lot: zegen, honger, koorts, verbanning, een enkel schikkingspaar. Geen immigratie. Diversiteit kan alleen zakken, of mondjesmaat terugkomen via mutatie.

## Spelen

Open `index.html` lokaal (via een static server, ES-modules werken niet altijd vanaf `file://`):

```bash
python3 -m http.server 8080
```

Daarna: http://localhost:8080

## Doel

- diversiteit boven ~40%
- gemiddelde inteelt F onder ~0.12
- levende bevolking niet onder 200

Honderd jaar is een eeuw. Duizend jaar is een mythe.

## Techniek

- 16 loci, mendeliaanse overerving
- stichters starten met sterk gescheiden allelen
- partnerkeuze prefereert lagere verwantschap
- inteelt verlaagt geboortekans en verhoogt sterfte
