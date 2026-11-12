import { BRAND } from './brand';
import type { Lang, LicenseId } from './types';

/**
 * Parametry licencí. Z těchto čísel se generuje jak srovnávací tabulka na webu,
 * tak samotný text licenčních smluv — vždy tedy sedí.
 * null = bez omezení.
 */
export interface LicenseTerms {
  exclusive: boolean;
  /** délka licenčního období v letech; null = po celou dobu trvání práv */
  termYears: number | null;
  subscription: boolean;
  files: ('wav' | 'stems')[];
  streams: number | null;
  sales: number | null;
  videos: number | null;
  radioStations: number | null;
  contentId: boolean;
  sync: boolean;
  /** autorský podíl producenta na nové skladbě (%) */
  publishingProducer: number;
  defaultPrice: number;
}

export const LICENSE_TERMS: Record<LicenseId, LicenseTerms> = {
  wav: {
    exclusive: false, termYears: 1, subscription: true, files: ['wav'],
    streams: 250_000, sales: 5_000, videos: 1, radioStations: 2,
    contentId: false, sync: false, publishingProducer: 50, defaultPrice: 69000,
  },
  stems: {
    exclusive: false, termYears: 1, subscription: true, files: ['wav', 'stems'],
    streams: 1_000_000, sales: 20_000, videos: 3, radioStations: null,
    contentId: false, sync: false, publishingProducer: 50, defaultPrice: 149000,
  },
  exclusive: {
    exclusive: true, termYears: null, subscription: false, files: ['wav', 'stems'],
    streams: null, sales: null, videos: null, radioStations: null,
    contentId: true, sync: true, publishingProducer: 50, defaultPrice: 1200000,
  },
};

export const LICENSE_NAMES: Record<LicenseId, string> = {
  wav: 'WAV Lease',
  stems: 'STEMS Lease',
  exclusive: 'Exclusive',
};

/** Lhůta ke stažení skladby z distribuce po skončení lease (dny). */
export const TAKEDOWN_DAYS = 30;
/** Lhůta k nápravě porušení (dny). */
export const CURE_DAYS = 14;

export interface LicenseContext {
  licensee?: string;
  artist?: string;
  email?: string;
  beatTitle?: string;
  date?: string;
  orderNo?: string;
  price?: string;
  termEnds?: string;
}

export interface LicenseDoc {
  title: string;
  subtitle: string;
  parties: string[];
  sections: { h: string; p: string[] }[];
  footer: string;
}

const nf = (n: number, lang: Lang) => new Intl.NumberFormat(lang === 'cs' ? 'cs-CZ' : 'en-US').format(n);

export function buildLicense(id: LicenseId, lang: Lang, ctx: LicenseContext = {}): LicenseDoc {
  return lang === 'cs' ? buildCs(id, ctx) : buildEn(id, ctx);
}

/* ------------------------------------------------------------------ */
/* ČESKY                                                               */
/* ------------------------------------------------------------------ */

function buildCs(id: LicenseId, c: LicenseContext): LicenseDoc {
  const t = LICENSE_TERMS[id];
  const L = BRAND.legal;
  const lease = !t.exclusive;
  const blank = (v: string | undefined, ph: string) => v && v.trim() ? v : `[${ph}]`;
  const lim = (n: number | null) => (n === null ? 'bez omezení' : nf(n, 'cs'));
  const files = t.files.includes('stems')
    ? 'nekomprimovaný soubor WAV a archiv ZIP s jednotlivými stopami (stems / trackouts)'
    : 'nekomprimovaný soubor WAV (bez hlasové značky)';

  const sections: LicenseDoc['sections'] = [];

  sections.push({
    h: '1. Vymezení pojmů',
    p: [
      `„Beat“ je hudební dílo (instrumentální skladba) a jeho zvukový záznam s názvem „${blank(c.beatTitle, 'název beatu')}“, jehož autorem a výrobcem je Producent.`,
      '„Nová skladba“ je nový zvukový záznam, který Nabyvatel vytvoří spojením Beatu s vlastním uměleckým výkonem (zpěv, rap, nástrojové party) a případně vlastním textem.',
      lease
        ? '„Licenční období“ je doba jednoho (1) roku počínající Dnem účinnosti a každé další roční období, o které se Licence prodlouží podle čl. 4.'
        : '„Licenční období“ je celá doba trvání majetkových autorských práv a práv souvisejících s právem autorským k Beatu.',
      '„Licenční poplatek“ je odměna za poskytnutí Licence podle čl. 10.',
    ],
  });

  sections.push({
    h: '2. Poskytnutí licence',
    p: lease
      ? [
        'Producent poskytuje Nabyvateli nevýhradní, nepřevoditelnou a územně neomezenou licenci (oprávnění k výkonu práva Beat užít) výhradně k vytvoření jedné (1) Nové skladby a k jejímu užití způsoby, v rozsahu a po dobu stanovenou touto Smlouvou („Licence“).',
        'Licence je nevýhradní: Producent je oprávněn Beat sám užívat a poskytovat k němu licence dalším osobám, včetně licence výhradní. Nabyvatel bere na vědomí, že stejný Beat mohou na základě vlastních licencí užít i jiní interpreti.',
        'Všechna práva, která nejsou touto Smlouvou výslovně poskytnuta, zůstávají Producentovi.',
      ]
      : [
        'Producent poskytuje Nabyvateli výhradní a územně neomezenou licenci (oprávnění k výkonu práva Beat užít) k vytvoření Nové skladby a k jejímu užití všemi způsoby a v rozsahu podle této Smlouvy („Licence“).',
        'Licence je výhradní: Producent ode Dne účinnosti neposkytne k Beatu licenci žádné třetí osobě, stáhne Beat z nabídky a sám se zdrží výkonu práva Beat užít, s výjimkou vlastní prezentace své tvorby (portfolio, webové stránky, sociální sítě, ukázky), při které Beat nebude dále komerčně licencovat.',
        'Nabyvatel bere na vědomí, že před Dnem účinnosti mohly být k Beatu poskytnuty nevýhradní licence třetím osobám. Tyto licence zůstávají v souladu s § 2360 odst. 2 občanského zákoníku zachovány do konce svého aktuálně zaplaceného licenčního období; Producent se zavazuje je po Dni účinnosti dále neprodlužovat.',
        'Touto Smlouvou se nepřevádí autorské právo ani vlastnictví k Beatu; osobnostní autorská práva jsou podle českého práva nepřevoditelná a zůstávají Producentovi.',
      ],
  });

  sections.push({
    h: '3. Dodání',
    p: [
      `Producent zpřístupní Nabyvateli Beat ke stažení v tomto formátu: ${files}. Soubory jsou dostupné elektronicky bezprostředně po zaplacení Licenčního poplatku prostřednictvím odkazu uvedeného v potvrzení objednávky.`,
      lease
        ? 'Odkaz ke stažení je funkční po dobu trvání Licence. Nabyvatel odpovídá za pořízení vlastní záložní kopie.'
        : 'Nabyvatel odpovídá za pořízení vlastní záložní kopie; Producent uchová soubory nejméně 12 měsíců ode Dne účinnosti.',
    ],
  });

  sections.push({
    h: '4. Doba trvání licence',
    p: lease
      ? [
        `Licence se poskytuje na dobu jednoho (1) roku ode Dne účinnosti${c.termEnds ? `, tj. aktuálně do ${c.termEnds}` : ''}.`,
        'Licence je hrazena formou ročního předplatného. Zaplacením Licenčního poplatku za další období se Licence automaticky prodlužuje vždy o další jeden (1) rok, a to opakovaně. Výše poplatku za další období odpovídá ceně sjednané při uzavření Smlouvy, nedohodnou-li se strany jinak.',
        'Nabyvatel může předplatné kdykoli zrušit bez udání důvodu (v zákaznickém účtu platební platformy nebo zprávou Producentovi). Licence v takovém případě trvá do konce již zaplaceného Licenčního období a dále se neprodlužuje.',
        'Producent může prodloužení Licence na další období odmítnout, zejména pokud k Beatu poskytne výhradní licenci třetí osobě; učiní tak zrušením předplatného nebo oznámením na e-mail Nabyvatele. Již zaplacené Licenční období tím není dotčeno.',
        `Zanikne-li Licence uplynutím doby bez prodloužení, je Nabyvatel povinen nejpozději do ${TAKEDOWN_DAYS} dnů ukončit šíření Nové skladby (zejména ji stáhnout ze streamingových služeb, internetových obchodů a videoplatforem) a zdržet se jakéhokoli dalšího užití Beatu. Rozmnoženiny Nové skladby oprávněně prodané v době trvání Licence není nutné stahovat z oběhu.`,
        'Je-li Beat nadále v nabídce, může Nabyvatel Licenci kdykoli obnovit zakoupením nové licence.',
      ]
      : [
        'Licence se poskytuje na celou dobu trvání majetkových autorských práv a práv souvisejících s právem autorským k Beatu.',
        'Nabyvatel není povinen Licenci využít (§ 2372 odst. 2 občanského zákoníku se nepoužije).',
      ],
  });

  const scope = [
    'Nabyvatel je v Licenčním období oprávněn Novou skladbu rozmnožovat, rozšiřovat a sdělovat veřejnosti v tomto rozsahu:',
    `a) streamování (zvukové i obrazové, včetně monetizovaných přehrání): ${t.streams === null ? 'bez omezení' : `nejvýše ${lim(t.streams)} přehrání souhrnně na všech platformách za Licenční období`};`,
    `b) prodej a bezplatné stažení (digitální stažení a fyzické nosiče): ${t.sales === null ? 'bez omezení' : `nejvýše ${lim(t.sales)} kusů souhrnně za Licenční období`};`,
    `c) hudební videoklipy k Nové skladbě: ${t.videos === null ? 'bez omezení' : `nejvýše ${lim(t.videos)}`};`,
    'd) živá vystoupení včetně výdělečných: bez omezení;',
    `e) rozhlasové a televizní vysílání: ${t.radioStations === null ? 'bez omezení počtu stanic' : `nejvýše ${lim(t.radioStations)} stanice`};`,
    'f) monetizace Nové skladby na streamingových službách a videoplatformách je povolena.',
  ];
  if (lease) {
    scope.push(
      'Dosáhne-li Nabyvatel kteréhokoli limitu, je povinen bez zbytečného odkladu zakoupit licenci vyššího rozsahu; do té doby není oprávněn limit překročit.',
      'Užití Nové skladby ve filmu, televizním pořadu, reklamě, videohře nebo jiném audiovizuálním díle (synchronizace), s výjimkou vlastních videoklipů podle písm. c) a propagace Nové skladby na sociálních sítích, vyžaduje předchozí písemný souhlas Producenta.',
    );
  } else {
    scope.push('Nabyvatel je oprávněn Novou skladbu užít i ve spojení s audiovizuálními díly (synchronizace) a udělovat k takovému užití svolení třetím osobám.');
  }
  sections.push({ h: '5. Rozsah užití', p: scope });

  const restrictions = [
    'Nabyvatel není oprávněn:',
    'a) Beat ani jeho části (včetně jednotlivých stop) samostatně prodávat, pronajímat, půjčovat, sdílet nebo jinak zpřístupňovat třetím osobám, ani k nim poskytovat licence;',
    lease
      ? 'b) šířit Beat v podobě, v jaké byl dodán, nebo jako instrumentální verzi bez vlastního uměleckého výkonu;'
      : 'b) Beat dále prodávat nebo licencovat jako samostatný instrumentál („beat“) jiným interpretům;',
    lease
      ? 'c) registrovat Beat ani Novou skladbu do systémů automatické identifikace obsahu (např. YouTube Content ID, Meta Rights Manager), protože by tím omezil ostatní oprávněné uživatele Beatu;'
      : 'c) uplatňovat prostřednictvím systémů automatické identifikace obsahu nároky vůči nevýhradním nabyvatelům, jejichž licence podle čl. 2 dosud trvá;',
    'd) užít Beat k trénování nebo testování modelů umělé inteligence, k tvorbě sample packů, zvukových knihoven, smyček nebo jiných produktů určených k další hudební produkci;',
    'e) prohlašovat se za autora Beatu nebo označovat Beat za vlastní dílo;',
    'f) užít Beat ve spojení s obsahem, který je protiprávní nebo podněcuje k násilí či nenávisti vůči skupině osob.',
    lease
      ? 'Licence je nepřevoditelná. Nabyvatel smí oprávnění tvořící součást Licence poskytnout třetí osobě (podlicence) jen v rozsahu nezbytném k vydání a distribuci Nové skladby — zejména distributorovi, vydavateli, provozovatelům digitálních služeb a tvůrcům videoklipu.'
      : 'Nabyvatel je oprávněn poskytnout oprávnění tvořící součást Licence třetí osobě (podlicence) a Licenci postoupit, zejména vydavateli nebo distributorovi, a to za předpokladu, že třetí osobu zaváže k dodržování této Smlouvy; Producent s tím uděluje souhlas.',
  ];
  sections.push({ h: '6. Omezení', p: restrictions });

  sections.push({
    h: '7. Autorství, úpravy a práva k Nové skladbě',
    p: [
      'Producent zůstává autorem Beatu a nositelem veškerých práv k hudebnímu dílu i ke zvukovému záznamu Beatu.',
      t.files.includes('stems')
        ? 'Nabyvatel je oprávněn Beat pro účely Nové skladby upravit — zejména měnit aranžmá, strukturu, tempo, tóninu, mix jednotlivých stop a doplnit další nástroje.'
        : 'Nabyvatel je oprávněn Beat pro účely Nové skladby přiměřeně upravit — zejména stříhat, opakovat části, měnit strukturu, tempo a tóninu.',
      'Nabyvatel je nositelem práv k vlastnímu textu a uměleckému výkonu a výrobcem zvukového záznamu Nové skladby; jeho práva se nevztahují na Beat samotný.',
    ],
  });

  sections.push({
    h: '8. Autorské podíly a odměny',
    p: [
      `Producent je autorem hudby Nové skladby. Strany sjednávají autorské podíly na Nové skladbě takto: ${t.publishingProducer} % Producent (hudba) a ${100 - t.publishingProducer} % Nabyvatel, případně další autoři na straně Nabyvatele (text, další hudební přínos).`,
      `Nabyvatel se zavazuje při ohlášení Nové skladby kolektivnímu správci (např. ${L.pro}) a v metadatech distribuce uvést Producenta jako autora hudby se sjednaným podílem${L.ipi ? ` (IPI/CAE: ${L.ipi})` : ''}. Odměny vybírané kolektivními správci náleží každé straně podle jejího podílu.`,
      'Producentovi nenáleží podíl na výnosech ze zvukového záznamu Nové skladby (tzv. master royalties) nad rámec Licenčního poplatku.',
    ],
  });

  sections.push({
    h: '9. Uvedení autora',
    p: [
      `Nabyvatel uvede Producenta jako producenta Nové skladby ve tvaru „${BRAND.credit}“ všude, kde je to technicky možné a obvyklé — zejména v metadatech vydání, v popisu videoklipu a v tiskových materiálech.`,
    ],
  });

  sections.push({
    h: '10. Licenční poplatek a platba',
    p: [
      lease
        ? `Licenční poplatek činí ${blank(c.price, 'cena')} za každé Licenční období (roční předplatné s automatickou obnovou, které lze kdykoli zrušit).`
        : `Licenční poplatek činí ${blank(c.price, 'cena')} a je jednorázový.`,
      'Platbu zpracovává společnost Lemon Squeezy, LLC, která při prodeji vystupuje jako autorizovaný prodejce (Merchant of Record) a vystavuje Nabyvateli daňový doklad. Konečná cena včetně případných daní je zobrazena před dokončením platby.',
      'Licence nabývá účinnosti úplným zaplacením Licenčního poplatku. Bude-li platba vrácena nebo zpětně zúčtována (refund, chargeback), Licence zaniká s účinky od počátku a Nabyvatel je povinen užívání Beatu neprodleně ukončit.',
    ],
  });

  sections.push({
    h: '11. Informace pro spotřebitele',
    p: [
      'Předmětem Smlouvy je digitální obsah, který není dodán na hmotném nosiči. Nabyvatel před dokončením objednávky výslovně souhlasil s tím, aby mu byl digitální obsah zpřístupněn ihned po zaplacení, a vzal na vědomí, že tím podle § 1837 písm. l) občanského zákoníku ztrácí právo odstoupit od Smlouvy ve lhůtě 14 dnů.',
      `Práva z vadného plnění se řídí občanským zákoníkem; reklamaci lze uplatnit na e-mailu ${BRAND.email}. K mimosoudnímu řešení spotřebitelských sporů je příslušná Česká obchodní inspekce (www.coi.cz).`,
    ],
  });

  sections.push({
    h: '12. Prohlášení a odpovědnost',
    p: [
      'Producent prohlašuje, že je oprávněn Licenci poskytnout, že Beat je jeho původním dílem a že případné zvuky třetích stran použité v Beatu (např. z licencovaných zvukových knihoven) je oprávněn užít pro komerční účely.',
      'Nabyvatel odpovídá za veškerý obsah, který k Beatu přidá (text, vokály, samply, obrazový materiál), a zavazuje se nahradit Producentovi škodu vzniklou porušením této Smlouvy nebo práv třetích osob takovým obsahem.',
      'Odpovědnost Producenta za škodu se v rozsahu, v jakém to právní předpisy připouštějí, omezuje na výši Licenčních poplatků skutečně zaplacených podle této Smlouvy. Tím nejsou dotčena zákonná práva spotřebitele ani odpovědnost za škodu způsobenou úmyslně nebo z hrubé nedbalosti.',
    ],
  });

  sections.push({
    h: '13. Porušení smlouvy',
    p: [
      `Poruší-li Nabyvatel tuto Smlouvu podstatným způsobem a nezjedná nápravu ani do ${CURE_DAYS} dnů od doručení výzvy na svůj e-mail, je Producent oprávněn od Smlouvy odstoupit. Odstoupením Licence zaniká; zaplacené Licenční poplatky se nevracejí a Nabyvatel je povinen ukončit šíření Nové skladby.`,
      'Užití Beatu nad rámec Licence je neoprávněným zásahem do autorského práva.',
    ],
  });

  sections.push({
    h: '14. Závěrečná ustanovení',
    p: [
      'Smlouva se řídí právním řádem České republiky, zejména § 2358 a násl. zákona č. 89/2012 Sb., občanský zákoník, a zákonem č. 121/2000 Sb., autorský zákon. K řešení sporů jsou příslušné soudy České republiky. Je-li Nabyvatel spotřebitelem s bydlištěm v jiném členském státě EU, není tím zbaven ochrany, kterou mu poskytují kogentní ustanovení práva státu jeho bydliště.',
      t.exclusive
        ? 'Smlouva je uzavřena elektronicky dokončením objednávky a zaplacením Licenčního poplatku; strany považují písemnou formu za zachovanou ve smyslu § 562 občanského zákoníku. Producent na žádost Nabyvatele bez zbytečného odkladu vystaví a zašle vlastnoručně nebo elektronicky podepsané vyhotovení této Smlouvy.'
        : 'Smlouva je uzavřena elektronicky dokončením objednávky a zaplacením Licenčního poplatku; Nabyvatel tím potvrzuje, že se se zněním Smlouvy seznámil a souhlasí s ním.',
      'Smlouva představuje úplnou dohodu stran o svém předmětu. Změny jsou možné jen dohodou stran v textové podobě (postačí e-mail). Je-li některé ustanovení neplatné, platnost ostatních tím není dotčena.',
      'Smlouva je vyhotovena v českém a anglickém jazyce. Pro Nabyvatele s bydlištěm nebo sídlem v České republice nebo na Slovensku je rozhodující české znění, pro ostatní znění anglické.',
    ],
  });

  return {
    title: `Licenční smlouva — ${LICENSE_NAMES[id]}`,
    subtitle: t.exclusive
      ? 'Výhradní licence k užití hudebního díla a zvukového záznamu'
      : 'Nevýhradní licence (pronájem) k užití hudebního díla a zvukového záznamu na dobu 1 roku s automatickým prodlužováním',
    parties: [
      `Tato licenční smlouva („Smlouva“) je uzavřena dne ${blank(c.date, 'datum zaplacení')} („Den účinnosti“)${c.orderNo ? `, objednávka č. ${c.orderNo}` : ''} mezi těmito stranami:`,
      `Poskytovatel: ${L.name}, ${L.ico ? `IČO ${L.ico}, ` : ''}${L.address}, vystupující pod uměleckým jménem ${BRAND.name} („Producent“)`,
      `Nabyvatel: ${blank(c.licensee, 'jméno kupujícího')}${c.artist ? `, umělecké jméno ${c.artist}` : ''}${c.email ? `, ${c.email}` : ''} („Nabyvatel“)`,
    ],
    sections,
    footer: `${BRAND.name} · ${BRAND.email}`,
  };
}

/* ------------------------------------------------------------------ */
/* ENGLISH                                                             */
/* ------------------------------------------------------------------ */

function buildEn(id: LicenseId, c: LicenseContext): LicenseDoc {
  const t = LICENSE_TERMS[id];
  const L = BRAND.legal;
  const lease = !t.exclusive;
  const blank = (v: string | undefined, ph: string) => v && v.trim() ? v : `[${ph}]`;
  const lim = (n: number | null) => (n === null ? 'unlimited' : nf(n, 'en'));
  const files = t.files.includes('stems')
    ? 'an uncompressed WAV file and a ZIP archive containing the individual track stems (trackouts)'
    : 'an uncompressed, untagged WAV file';

  const sections: LicenseDoc['sections'] = [];

  sections.push({
    h: '1. Definitions',
    p: [
      `"Beat" means the musical work (instrumental composition) and its sound recording titled "${blank(c.beatTitle, 'beat title')}", written and produced by the Producer.`,
      '"New Song" means a new sound recording created by the Licensee by combining the Beat with the Licensee\'s own performance (vocals, rap, instruments) and, where applicable, the Licensee\'s own lyrics.',
      lease
        ? '"License Term" means the period of one (1) year starting on the Effective Date and each further one-year period by which the License is renewed under Section 4.'
        : '"License Term" means the full duration of the economic copyright and related rights in the Beat.',
      '"License Fee" means the consideration for the License under Section 10.',
    ],
  });

  sections.push({
    h: '2. Grant of license',
    p: lease
      ? [
        'The Producer grants the Licensee a non-exclusive, non-transferable, worldwide license to use the Beat solely to create one (1) New Song and to exploit that New Song in the manner, to the extent and for the time set out in this Agreement (the "License").',
        'The License is non-exclusive: the Producer may use the Beat and license it to others, including on an exclusive basis. The Licensee acknowledges that other artists may use the same Beat under their own licenses.',
        'All rights not expressly granted in this Agreement are reserved by the Producer.',
      ]
      : [
        'The Producer grants the Licensee an exclusive, worldwide license to use the Beat to create a New Song and to exploit that New Song in every manner and to the extent set out in this Agreement (the "License").',
        'The License is exclusive: from the Effective Date the Producer will not license the Beat to any third party, will remove the Beat from sale, and will refrain from using the Beat, except to present the Producer\'s own work (portfolio, website, social media, showreels) without further commercial licensing of the Beat.',
        'The Licensee acknowledges that non-exclusive licenses to the Beat may have been granted to third parties before the Effective Date. In accordance with Section 2360(2) of the Czech Civil Code those licenses remain in force until the end of their currently paid license term; the Producer undertakes not to renew them after the Effective Date.',
        'This Agreement does not transfer copyright in, or ownership of, the Beat; under Czech law the author\'s moral rights are non-transferable and remain with the Producer.',
      ],
  });

  sections.push({
    h: '3. Delivery',
    p: [
      `The Producer will make the Beat available for download in the following format: ${files}. The files are available electronically immediately after payment of the License Fee via the link stated in the order confirmation.`,
      lease
        ? 'The download link works for as long as the License is in force. The Licensee is responsible for keeping a backup copy.'
        : 'The Licensee is responsible for keeping a backup copy; the Producer will retain the files for at least 12 months from the Effective Date.',
    ],
  });

  sections.push({
    h: '4. Term',
    p: lease
      ? [
        `The License is granted for one (1) year from the Effective Date${c.termEnds ? `, i.e. currently until ${c.termEnds}` : ''}.`,
        'The License is paid for as an annual subscription. Upon payment of the License Fee for the next period the License automatically renews for a further one (1) year, repeatedly. The fee for each renewal period equals the price agreed when this Agreement was concluded, unless the parties agree otherwise.',
        'The Licensee may cancel the subscription at any time without giving a reason (in the payment platform\'s customer account or by notice to the Producer). In that case the License continues until the end of the License Term already paid for and is not renewed.',
        'The Producer may decline to renew the License for a further period, in particular if the Producer grants an exclusive license to the Beat to a third party; the Producer does so by cancelling the subscription or by notice to the Licensee\'s e-mail address. A License Term already paid for is not affected.',
        `If the License expires without renewal, the Licensee must, within ${TAKEDOWN_DAYS} days, cease distribution of the New Song (in particular remove it from streaming services, online stores and video platforms) and refrain from any further use of the Beat. Copies of the New Song lawfully sold during the License Term need not be recalled.`,
        'If the Beat is still on offer, the Licensee may reinstate the License at any time by purchasing a new license.',
      ]
      : [
        'The License is granted for the full duration of the economic copyright and related rights in the Beat.',
        'The Licensee is under no obligation to use the License (Section 2372(2) of the Czech Civil Code does not apply).',
      ],
  });

  const scope = [
    'During the License Term the Licensee may reproduce, distribute and communicate the New Song to the public to the following extent:',
    `a) streaming (audio and video, including monetised plays): ${t.streams === null ? 'unlimited' : `up to ${lim(t.streams)} plays in aggregate across all platforms per License Term`};`,
    `b) sales and free downloads (digital downloads and physical copies): ${t.sales === null ? 'unlimited' : `up to ${lim(t.sales)} units in aggregate per License Term`};`,
    `c) music videos for the New Song: ${t.videos === null ? 'unlimited' : `up to ${lim(t.videos)}`};`,
    'd) live performances, including for profit: unlimited;',
    `e) radio and television broadcasting: ${t.radioStations === null ? 'unlimited stations' : `up to ${lim(t.radioStations)} stations`};`,
    'f) monetisation of the New Song on streaming services and video platforms is permitted.',
  ];
  if (lease) {
    scope.push(
      'If the Licensee reaches any of these limits, the Licensee must purchase a license of a higher tier without undue delay and may not exceed the limit until then.',
      'Use of the New Song in a film, television programme, advertisement, video game or other audiovisual work (synchronisation), other than the Licensee\'s own music videos under letter c) and promotion of the New Song on social media, requires the Producer\'s prior written consent.',
    );
  } else {
    scope.push('The Licensee may also use the New Song in connection with audiovisual works (synchronisation) and authorise third parties to do so.');
  }
  sections.push({ h: '5. Scope of use', p: scope });

  sections.push({
    h: '6. Restrictions',
    p: [
      'The Licensee may not:',
      'a) sell, rent, lend, share or otherwise make available the Beat or any part of it (including individual stems) on its own to third parties, or license it;',
      lease
        ? 'b) distribute the Beat in the form in which it was delivered, or as an instrumental version without the Licensee\'s own performance;'
        : 'b) resell or license the Beat as a stand-alone instrumental ("beat") to other artists;',
      lease
        ? 'c) register the Beat or the New Song with any automated content identification system (such as YouTube Content ID or Meta Rights Manager), since doing so would restrict other authorised users of the Beat;'
        : 'c) assert claims through automated content identification systems against non-exclusive licensees whose license under Section 2 is still in force;',
      'd) use the Beat to train or test artificial intelligence models, or to create sample packs, sound libraries, loops or other products intended for further music production;',
      'e) claim authorship of the Beat or present the Beat as the Licensee\'s own work;',
      'f) use the Beat in connection with content that is unlawful or incites violence or hatred against a group of persons.',
      lease
        ? 'The License is non-transferable. The Licensee may sublicense rights forming part of the License only to the extent necessary to release and distribute the New Song — in particular to a distributor, label, digital service providers and music video creators.'
        : 'The Licensee may sublicense rights forming part of the License and may assign the License, in particular to a label or distributor, provided the third party is bound to comply with this Agreement; the Producer hereby consents.',
    ],
  });

  sections.push({
    h: '7. Authorship, modifications and rights in the New Song',
    p: [
      'The Producer remains the author of the Beat and the holder of all rights in the musical work and in the sound recording of the Beat.',
      t.files.includes('stems')
        ? 'For the purposes of the New Song the Licensee may modify the Beat — in particular change the arrangement, structure, tempo, key and the mix of individual stems, and add further instruments.'
        : 'For the purposes of the New Song the Licensee may reasonably modify the Beat — in particular cut it, loop sections, and change its structure, tempo and key.',
      'The Licensee holds the rights in the Licensee\'s own lyrics and performance and is the producer of the sound recording of the New Song; the Licensee\'s rights do not extend to the Beat itself.',
    ],
  });

  sections.push({
    h: '8. Writers\' shares and royalties',
    p: [
      `The Producer is the composer of the music of the New Song. The parties agree the following writers' shares in the New Song: ${t.publishingProducer}% Producer (music) and ${100 - t.publishingProducer}% Licensee and any further writers on the Licensee's side (lyrics, additional musical contribution).`,
      `When registering the New Song with a collecting society (e.g. ${L.pro}) and in distribution metadata, the Licensee will name the Producer as composer with the agreed share${L.ipi ? ` (IPI/CAE: ${L.ipi})` : ''}. Royalties collected by collecting societies belong to each party according to its share.`,
      'The Producer is not entitled to a share of revenue from the sound recording of the New Song (master royalties) beyond the License Fee.',
    ],
  });

  sections.push({
    h: '9. Credit',
    p: [
      `The Licensee will credit the Producer as the producer of the New Song in the form "${BRAND.credit}" wherever technically possible and customary — in particular in release metadata, music video descriptions and press materials.`,
    ],
  });

  sections.push({
    h: '10. License fee and payment',
    p: [
      lease
        ? `The License Fee is ${blank(c.price, 'price')} per License Term (an annual subscription that renews automatically and can be cancelled at any time).`
        : `The License Fee is ${blank(c.price, 'price')}, payable once.`,
      'Payment is processed by Lemon Squeezy, LLC, acting as the authorised reseller (Merchant of Record), which issues the tax document to the Licensee. The final price including any taxes is shown before payment is completed.',
      'The License takes effect upon full payment of the License Fee. If the payment is refunded or charged back, the License terminates with effect from the outset and the Licensee must stop using the Beat immediately.',
    ],
  });

  sections.push({
    h: '11. Consumer information',
    p: [
      'The subject of this Agreement is digital content not supplied on a tangible medium. Before completing the order the Licensee expressly agreed that the digital content be made available immediately after payment and acknowledged that, under Section 1837(l) of the Czech Civil Code (Article 16(m) of Directive 2011/83/EU), the right to withdraw from the Agreement within 14 days is thereby lost.',
      `Rights arising from defective performance are governed by the Czech Civil Code; complaints may be sent to ${BRAND.email}. The Czech Trade Inspection Authority (www.coi.cz) is competent for out-of-court settlement of consumer disputes.`,
    ],
  });

  sections.push({
    h: '12. Warranties and liability',
    p: [
      'The Producer warrants that the Producer is entitled to grant the License, that the Beat is the Producer\'s original work, and that any third-party sounds used in the Beat (e.g. from licensed sound libraries) may be used commercially.',
      'The Licensee is responsible for all content the Licensee adds to the Beat (lyrics, vocals, samples, visual material) and will compensate the Producer for damage caused by a breach of this Agreement or by infringement of third-party rights through such content.',
      'To the extent permitted by law, the Producer\'s liability for damage is limited to the License Fees actually paid under this Agreement. This does not affect statutory consumer rights or liability for damage caused intentionally or by gross negligence.',
    ],
  });

  sections.push({
    h: '13. Breach',
    p: [
      `If the Licensee materially breaches this Agreement and fails to remedy the breach within ${CURE_DAYS} days of a notice delivered to the Licensee's e-mail address, the Producer may withdraw from the Agreement. Upon withdrawal the License terminates; License Fees paid are not refunded and the Licensee must cease distribution of the New Song.`,
      'Any use of the Beat beyond the scope of the License constitutes copyright infringement.',
    ],
  });

  sections.push({
    h: '14. Final provisions',
    p: [
      'This Agreement is governed by the laws of the Czech Republic, in particular Sections 2358 et seq. of Act No. 89/2012 Coll., the Civil Code, and Act No. 121/2000 Coll., the Copyright Act. The courts of the Czech Republic have jurisdiction. If the Licensee is a consumer resident in another EU Member State, the Licensee is not deprived of the protection afforded by the mandatory provisions of the law of the Licensee\'s country of residence.',
      t.exclusive
        ? 'This Agreement is concluded electronically by completing the order and paying the License Fee; the parties consider the written form to be maintained within the meaning of Section 562 of the Czech Civil Code. At the Licensee\'s request the Producer will without undue delay issue and send a hand-signed or electronically signed copy of this Agreement.'
        : 'This Agreement is concluded electronically by completing the order and paying the License Fee; the Licensee thereby confirms having read and accepted its terms.',
      'This Agreement constitutes the entire agreement between the parties regarding its subject matter. Amendments require the agreement of both parties in text form (e-mail suffices). If any provision is invalid, the remaining provisions are unaffected.',
      'This Agreement is executed in Czech and English. For Licensees resident or established in the Czech Republic or Slovakia the Czech version prevails; for all others the English version prevails.',
    ],
  });

  return {
    title: `License Agreement — ${LICENSE_NAMES[id]}`,
    subtitle: t.exclusive
      ? 'Exclusive license to use a musical work and sound recording'
      : 'Non-exclusive license (lease) to use a musical work and sound recording for 1 year with automatic renewal',
    parties: [
      `This license agreement (the "Agreement") is made on ${blank(c.date, 'date of payment')} (the "Effective Date")${c.orderNo ? `, order no. ${c.orderNo}` : ''} between:`,
      `Licensor: ${L.name}, ${L.ico ? `Company ID (IČO) ${L.ico}, ` : ''}${L.address}, professionally known as ${BRAND.name} (the "Producer")`,
      `Licensee: ${blank(c.licensee, 'buyer name')}${c.artist ? `, professionally known as ${c.artist}` : ''}${c.email ? `, ${c.email}` : ''} (the "Licensee")`,
    ],
    sections,
    footer: `${BRAND.name} · ${BRAND.email}`,
  };
}
