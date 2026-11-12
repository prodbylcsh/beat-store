# Návod: co nastavit, aby obchod prodával

Kód je hotový. Tenhle dokument popisuje jen to, co musíš udělat ty (účty, klíče, texty). Postupuj shora dolů.

---

## 0. Jak to celé funguje (2 minuty čtení)

```text
Návštěvník ── web (Vue) ── Cloudflare Worker ── D1 (katalog, objednávky)
                                │                R2 (WAV, ZIP, ukázky – soukromé)
                                │
                     POST /api/checkout
                                ▼
                      Lemon Squeezy checkout  ──►  webhook (podepsaný HMAC)
                                                       ▼
                                           objednávka v D1 = licence platí
                                                       ▼
                         /order/<tajný token>: stažení souborů + vyplněná smlouva
```

Oproti původnímu plánu (`plan_digitalni_eshop_…md`) jsou tu tři vědomé změny – jinak by nešlo „nahraju jen audio“ a „lease jako předplatné“:

| Plán | Tady | Proč |
|---|---|---|
| Každý produkt ručně v Lemon Squeezy, soubory nahrané tam | V LS jsou jen **3 obecné produkty** (WAV Lease, STEMS Lease, Exclusive). Název beatu a cena se posílají při tvorbě checkoutu. | LS neumí zakládat produkty ani nahrávat soubory přes API. Takhle beat přidáš jedním formulářem. |
| Soubory doručuje LS | Soubory vydává Worker z **R2** přes tajný odkaz objednávky | Soubory jsou u každého beatu jiné. Odkaz dostane jen kupující (po platbě a v potvrzovacím e-mailu od LS); o platnosti rozhoduje výhradně stav z webhooku. |
| Bez předplatného | Lease = **roční předplatné** | Tvůj požadavek. Zpracovávají se i události `subscription_*`. |

Pravidlo z plánu platí beze změny: **zdrojem pravdy o zaplacení je jen podepsaný webhook**, nikdy URL ani frontend.

---

## 1. Vyplň identitu a zkontroluj texty

1. `src/shared/brand.ts` – název značky, e-mail, **jméno / IČO / adresa** (propíše se do licencí a podmínek). Všechno označené `DOPLŇ`.
2. `src/shared/licenses.ts` – nahoře tabulka `LICENSE_TERMS`: limity streamů, prodejů, výchozí ceny. Text smlouvy se z ní generuje sám.
3. `src/shared/services.ts` – ceník mixu/masteringu.
4. `src/web/lib/i18n.ts` – texty webu (FAQ apod.), pokud chceš něco říct jinak.

---

## 2. Cloudflare

Potřebuješ účet Cloudflare (R2 vyžaduje přidanou platební kartu, free limity stačí).

```bash
npx wrangler login
```

Vytvoř databáze a úložiště (test + produkce):

```bash
npx wrangler d1 create beat-store-test-db
```

```bash
npx wrangler d1 create beat-store-prod-db
```

```bash
npx wrangler r2 bucket create beat-store-test-private
```

```bash
npx wrangler r2 bucket create beat-store-prod-private
```

Do `wrangler.test.jsonc` a `wrangler.jsonc` doplň `database_id` (UUID z výstupu) a později `APP_ORIGIN` (adresa po prvním nasazení). Buckety **nezveřejňuj** – ukázky vydává Worker sám jen z prefixu `previews/`.

Tajné hodnoty (pro každé prostředí zvlášť; u testu přidej `--config wrangler.test.jsonc`):

```bash
npx wrangler secret put ADMIN_PASSWORD
```

```bash
npx wrangler secret put SESSION_SECRET
```

```bash
npx wrangler secret put LEMONSQUEEZY_API_KEY
```

```bash
npx wrangler secret put LEMONSQUEEZY_WEBHOOK_SECRET
```

- `ADMIN_PASSWORD` – dlouhé heslo do `/admin`. `SESSION_SECRET` – libovolných 32+ náhodných znaků.
- Volitelně `NOTIFY_WEBHOOK_URL` – Discord/Slack webhook; přijde ti zpráva o každém prodeji a poptávce.

Migrace a nasazení testu:

```bash
npm run db:test
```

```bash
npm run deploy:test
```

Wrangler vypíše adresu `https://beat-store-test.<tvoje>.workers.dev`. Zapiš ji do `APP_ORIGIN` v `wrangler.test.jsonc` a nasaď znovu. Produkce stejně: `npm run db:prod`, `npm run deploy`.

**Automatické nasazení z GitHubu (volitelné):** v repozitáři → Settings → Secrets přidej `CLOUDFLARE_API_TOKEN` (šablona „Edit Cloudflare Workers“ + D1 Edit) a `CLOUDFLARE_ACCOUNT_ID`. Push do `develop` pak nasazuje test, push do `main` produkci.

---

## 3. Lemon Squeezy

1. Založ Store, zapni **Test mode**. Měna obchodu = `CURRENCY` ve `wrangler*.jsonc` (výchozí CZK).
2. Vytvoř tři produkty (ceny v LS jsou jen výchozí – skutečnou cenu posílá web podle beatu):

   | Produkt | Typ platby | Poznámka |
   |---|---|---|
   | WAV Lease | **Subscription**, interval **1 year** | bez trialu |
   | STEMS Lease | **Subscription**, interval **1 year** | bez trialu |
   | Exclusive License | **Single payment** | |
   | Mix & Master *(volitelné)* | Single payment | viz níže |

   Soubory do produktů **nenahrávej**. U každého otevři variantu a opiš **Variant ID**.
3. Do `vars` ve `wrangler.test.jsonc` doplň `LEMON_STORE_ID`, `LEMON_VARIANT_WAV`, `LEMON_VARIANT_STEMS`, `LEMON_VARIANT_EXCLUSIVE`.
4. Settings → API → vytvoř API klíč (v Test mode) → `LEMONSQUEEZY_API_KEY`.
5. Settings → Webhooks → nový webhook:
   - URL: `https://<tvůj-test-worker>/api/webhooks/lemonsqueezy`
   - Signing secret: vymysli si 20–40 znaků → stejnou hodnotu dej do `LEMONSQUEEZY_WEBHOOK_SECRET`
   - Události: `order_created`, `order_refunded`, `subscription_created`, `subscription_updated`, `subscription_cancelled`, `subscription_resumed`, `subscription_expired`, `subscription_paused`, `subscription_unpaused`
6. Nasaď znovu (`npm run deploy:test`).

**Mix & Master a platby:** Lemon Squeezy je určený hlavně pro digitální produkty a prodej služeb si u nich musíš nechat potvrdit (napiš jim na podporu, co přesně prodáváš). Dokud necháš `LEMON_VARIANT_SERVICE` prázdné, formulář funguje jako **poptávka** – uloží se do adminu, ty se ozveš e-mailem a platbu vyřešíš po svém. Když ho vyplníš, formulář rovnou pošle klienta zaplatit.

**Po aktivaci ostrého obchodu:** produkty zkopíruj do Live (dostanou **nová** Variant ID), vytvoř Live API klíč a Live webhook a doplň vše do `wrangler.jsonc` / produkčních secrets.

---

## 4. Přidání beatu

1. Otevři `/admin`, přihlas se.
2. **Vyber WAV.** Prohlížeč z něj spočítá artwork, navrhne BPM a tóninu (jsou to odhady – zkontroluj je; u trapu často vyjde poloviční tempo, od toho jsou tlačítka ÷2 / ×2) a vyrobí ukázku MP3 128 kbps.
3. Volitelně přidej **ZIP se stopami**. Bez něj půjde koupit jen WAV Lease.
4. Vyplň název, žánr, ceny → **Nahrát do obchodu**.

Artwork se nedělá ručně nikdy: barva vinylu = tónina, drážka = waveform, mramorování a etiketa = otisk zvuku.

**Hlasová značka (tag):** v adminu vpravo můžeš nahrát krátký zvuk; přimíchá se do veřejných ukázek nahraných *poté*. Prodávané soubory zůstávají čisté.

V záložce **Beaty** jde všechno upravit, beat skrýt (koncept) nebo smazat. Beat, který už někdo koupil, se nemaže, jen skryje – kupující ho musí mít možnost stahovat.

---

## 5. Co ověřit v Test mode, než půjdeš naostro

- [ ] Nákup WAV Lease testovací kartou `4242 4242 4242 4242` → přesměrování na `/order/…` → stažení WAV a smlouvy.
- [ ] V potvrzovacím e-mailu / na účtence LS je tlačítko vedoucí na stejnou stránku objednávky. *(Dokumentace LS nebyla z vývojového prostředí dostupná; pole `receipt_link_url` a `receipt_button_text` proto ověř právě tady. Pojistkou je odkaz v děkovné poznámce účtenky a přesměrování po platbě.)*
- [ ] Na checkoutu je vidět název beatu, správná cena a „/ year“.
- [ ] Nákup Exclusive → beat zmizí z katalogu; běžící lease předplatná na něj se v LS zruší (doběhnou).
- [ ] Refund v LS → stránka objednávky ukáže „Platba byla vrácena“, stažení nejde.
- [ ] Zrušení předplatného v LS → v adminu stav `cancelled`, datum konce sedí.
- [ ] V adminu → Objednávky nejsou žluté řádky (ty znamenají „vyžaduje ruční zásah“, typicky vrátit peníze za druhý souběžný nákup exkluzivity).

---

## 6. Právo – co si nech zkontrolovat

Licence a podmínky jsem sepsal podle běžné praxe beat storů a českého práva (licenční smlouva § 2358 a násl. občanského zákoníku, autorský zákon). **Nejsem advokát a tohle není právní rada** – před ostrým prodejem je dej přečíst někomu, kdo jím je. Konkrétně:

1. **Exclusive vyžaduje písemnou formu** (§ 2358 odst. 2 OZ). Smlouva počítá s elektronickým uzavřením a zavazuje tě na požádání poslat podepsané vyhotovení. Doporučuji ke každé exkluzivitě rovnou poslat kupujícímu podepsané PDF (stačí i elektronický podpis) – je to pár minut a máš jistotu.
2. **Autorské právo se v ČR nepřevádí.** „Exclusive“ je proto výhradní licence, ne prodej práv. Tak je to i napsané.
3. **Zánik lease:** smlouva říká, že po skončení předplatného musí interpret skladbu do 30 dnů stáhnout. To je „skutečný pronájem“, jak jsi chtěl. Pokud ti to přijde přísné, změň `TAKEDOWN_DAYS` nebo čl. 4 v `licenses.ts`.
4. **Odstoupení do 14 dnů:** u beatů kupující před platbou výslovně potvrzuje okamžité dodání a ztrátu práva na odstoupení (dvě zaškrtávací pole na účtence). U služeb právo na odstoupení trvá. EU od 19. 6. 2026 požaduje u smluv uzavíraných online i **funkci pro odstoupení** přímo v rozhraní – web zatím nabízí odstoupení e-mailem. Zeptej se, zda to pro tvůj případ stačí.
5. **Daně a podnikání:** Lemon Squeezy je Merchant of Record (řeší DPH vůči zákazníkům), ale příjem od něj je tvůj příjem z podnikání – živnost, daňové přiznání, případně identifikovaná osoba k DPH. To vyřeš s účetní.
6. **Autorské podíly 50/50 a OSA:** pokud jsi zastupovaný OSA, ověř, že ti jejich smlouva dovoluje licencovat přímo tímto způsobem.

---

## 7. Provoz

| Situace | Co udělat |
|---|---|
| Zákazník ztratil odkaz | Je v potvrzovacím e-mailu od LS a v [My Orders](https://app.lemonsqueezy.com/my-orders). |
| Chce zrušit lease | Sám v My Orders, nebo ty v LS dashboardu. Licence doběhne. |
| Refund | Udělej ho v LS. Web se dozví z webhooku a licenci zruší. Po refundu exkluzivity beat ručně vrať do stavu „v obchodě“. |
| Žlutý řádek v adminu | Přečti poznámku – typicky vrátit platbu. |
| Webhook nedorazil | LS → Webhooks → znovu odeslat. Zpracování je idempotentní. |
| Chci vypnout prodej | Beaty přepni na „koncept“. |

Zálohy: originály WAV/ZIP měj i mimo R2. Databázi lze exportovat: `npx wrangler d1 export beat-store-prod-db --remote --output backup.sql`.
