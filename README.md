# LCSH — Beat Store

Vlastní beat store: prodej a pronájem beatů (WAV Lease, STEMS Lease, Exclusive) a objednávky mixu / masteringu.

**Stack:** Vue 3 + Vite + TypeScript · Cloudflare Workers + D1 + R2 · Lemon Squeezy

- Každý beat má **artwork vygenerovaný ze zvuku** – desku, jejíž drážka je skutečný waveform a barva odpovídá tónině. Stačí nahrát WAV.
- Lease licence jsou **roční předplatné**, exclusive je jednorázová platba a beat po ní zmizí z nabídky.
- Bez registrace: kupující dostane tajný odkaz na stránku objednávky se soubory a vyplněnou licenční smlouvou.
- Administrace na `/admin` (nahrání beatu, úpravy, objednávky).

## Rychlý start (lokálně, bez jakýchkoli účtů)

```bash
npm install
```

```bash
cp .dev.vars.example .dev.vars
```

```bash
npm run db:local
```

```bash
npm run preview
```

Web běží na <http://localhost:8787>. V druhém terminálu ho naplníš ukázkovými beaty:

```bash
npm run seed:demo
```

Admin: <http://localhost:8787/admin> (heslo je `ADMIN_PASSWORD` z `.dev.vars`). Bez Lemon Squeezy klíče běží lokálně **simulovaná platba**, takže jde projít celý nákup včetně stažení.

Vývoj s hot-reloadem: `npm run dev` (web na :5173, API na :8787).

## Příkazy

| Příkaz | Co dělá |
|---|---|
| `npm run dev` | Vite + Worker s hot-reloadem |
| `npm run preview` | Build + Worker na :8787 (jako v produkci) |
| `npm run typecheck` / `npm test` | Kontrola typů / testy (webhooky, licence, ceny) |
| `npm run db:local` / `db:test` / `db:prod` | Migrace D1 |
| `npm run deploy:test` / `deploy` | Nasazení test / produkce |
| `npm run seed:demo` | Ukázkové beaty (`--url`, `--password`, `--count`) |

## Kde co je

| Cesta | Obsah |
|---|---|
| `src/shared/brand.ts` | **Název, e-mail, právní údaje** – vyplň před spuštěním |
| `src/shared/licenses.ts` | Parametry licencí (limity, ceny) a text smluv CZ/EN |
| `src/shared/services.ts` | Ceník mixu a masteringu |
| `src/web/lib/legal.ts` | Obchodní podmínky a ochrana soukromí |
| `src/web/lib/groove.ts` | Shader, který kreslí desky |
| `src/worker/` | API: katalog, checkout, webhooky, stahování, admin |
| `migrations/` | Schéma databáze |

**Kompletní návod k nasazení a nastavení: [`docs/NAVOD.md`](docs/NAVOD.md).**
