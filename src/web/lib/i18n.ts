import { computed, ref } from 'vue';
import type { Lang } from '../../shared/types';

const stored = (() => {
  try { return localStorage.getItem('lang'); } catch { return null; }
})();
const guess: Lang = /^(cs|sk)/i.test(navigator.language) ? 'cs' : 'en';
export const lang = ref<Lang>(stored === 'cs' || stored === 'en' ? stored : guess);

export function setLang(l: Lang): void {
  lang.value = l;
  document.documentElement.lang = l;
  try { localStorage.setItem('lang', l); } catch { /* soukromý režim */ }
}
document.documentElement.lang = lang.value;

const cs = {
  nav: { beats: 'Beaty', services: 'Mix & Master', licenses: 'Licence', faq: 'FAQ' },
  status: { ready: 'Připraveno', playing: 'Hraje' },
  hero: {
    eyebrow: 'Beat store · od 2026',
    l1: 'Beaty', l2: 'lisované', l3: 'ze zvuku',
    sub: 'Každý beat tady má vlastní desku. Její drážka je skutečný waveform skladby, barva je tónina. Polož jehlu.',
    cta: 'Projít katalog', cta2: 'Mix & Master',
    hintPlay: 'klik = play', hintDrag: 'táhni = scratch',
    stats: ['beatů v katalogu', 'WAV · STEMS · EXCLUSIVE', 'stažení hned po platbě'],
  },
  deck: {
    title: 'Katalog', sub: 'Najdi beat ušima, ne scrollováním.',
    tempo: 'Tempo', tap: 'TAP', tapHint: 'Vyťukej tempo, které máš v hlavě', any: 'vše',
    key: 'Tónina', keyHint: 'Klávesa = filtr i tón', minor: 'moll', major: 'dur', all: 'vše',
    genre: 'Žánr', search: 'Hledat', searchPh: 'název, žánr, BPM…',
    sort: 'Řadit', sortNew: 'nejnovější', sortBpm: 'BPM', sortPrice: 'cena', sortTitle: 'A–Z',
    reset: 'Zrušit filtry', count: (n: number) => (n === 1 ? '1 beat' : n >= 2 && n <= 4 ? `${n} beaty` : `${n} beatů`),
    empty: 'Tahle drážka je prázdná.', emptySub: 'Žádný beat neodpovídá filtrům. Zkus povolit tempo nebo tóninu.',
    none: 'Katalog se právě lisuje.', noneSub: 'První beaty tu budou co nevidět.',
    error: 'Katalog se nepodařilo načíst.', retry: 'Zkusit znovu',
  },
  row: { from: 'od', license: 'Licence', play: 'Přehrát', pause: 'Pozastavit', sold: 'Prodáno' },
  beat: {
    back: 'Katalog', choose: 'Vyber licenci', perYear: '/ rok', once: 'jednorázově',
    buy: 'Pokračovat k platbě', sold: 'Tenhle beat je exkluzivně prodaný.',
    noStems: 'Stopy (stems) u tohoto beatu nejsou k dispozici.',
    fullText: 'Plné znění licence', popular: 'Nejčastější volba', notFound: 'Beat nenalezen',
    more: 'Další beaty', share: 'Kopírovat odkaz', copied: 'Zkopírováno',
    artwork: 'Artwork vygenerovaný ze zvuku: drážka = waveform, barva = tónina.',
  },
  lic: {
    title: 'Licence', sub: 'Tři způsoby, jak beat použít. Žádné skryté podmínky – všechno je v tabulce i ve smlouvě.',
    wavTag: 'Pronájem · 1 rok', stemsTag: 'Pronájem · 1 rok', exclusiveTag: 'Navždy tvůj',
    wavDesc: 'Pro singl nebo první release. WAV bez tagu, licence běží rok a sama se obnovuje, dokud ji nezrušíš.',
    stemsDesc: 'WAV + jednotlivé stopy pro vlastní mix a aranž. Vyšší limity, stejný roční režim.',
    exclusiveDesc: 'Beat zmizí z obchodu a nikdo další ho už nekoupí. Bez limitů, bez obnovování.',
    rows: {
      files: 'Soubory', term: 'Doba', renew: 'Obnova', streams: 'Streamy', sales: 'Prodeje / stažení', videos: 'Videoklipy',
      radio: 'Rádio / TV', live: 'Živá vystoupení', contentId: 'Content ID', sync: 'Film, reklama, hry', publishing: 'Autorský podíl producenta',
      exclusivity: 'Exkluzivita', credit: 'Kredit',
    },
    v: {
      wav: 'WAV', wavStems: 'WAV + stems (ZIP)', year: '1 rok', forever: 'po dobu trvání práv', auto: 'automaticky, zrušíš kdykoli', none: 'není potřeba',
      unlimited: 'bez omezení', perTerm: 'za období', stations: (n: number) => `${n} stanice`, yes: 'ano', no: 'ne', consent: 'po dohodě',
      nonExclusive: 'nevýhradní', exclusive: 'výhradní', creditReq: 'povinný',
    },
    how: 'Jak funguje pronájem (lease)',
    howText: [
      'Lease je nevýhradní licence na jeden rok. Platíš ji jako roční předplatné – dokud běží, můžeš skladbu vydávat a vydělávat na ní v rámci limitů.',
      'Předplatné zrušíš kdykoli jedním klikem. Licence pak doběhne do konce zaplaceného roku a skladbu je potřeba do 30 dnů stáhnout z distribuce.',
      'Když někdo koupí beat exkluzivně, tvoje lease platí do konce zaplaceného období a už se neobnoví.',
    ],
    read: 'Přečíst smlouvu', texts: 'Plná znění smluv', print: 'Verze pro tisk',
    note: 'Znění níže je vzor s prázdnými poli. Po nákupu dostaneš smlouvu vyplněnou tvým jménem, datem a číslem objednávky.',
  },
  receipt: {
    title: 'Účtenka', item: 'Položka', license: 'Licence', term: 'Období', total: 'Celkem',
    artist: 'Umělecké jméno (do smlouvy)', artistPh: 'např. MC Příklad',
    agree1a: 'Souhlasím s', agree1b: 'licenční smlouvou', agree1c: 'a', agree1d: 'obchodními podmínkami',
    agree2: 'Chci soubory hned po zaplacení a beru na vědomí, že tím ztrácím právo odstoupit od smlouvy do 14 dnů.',
    renew: 'Roční předplatné: obnovuje se automaticky za stejnou cenu, zrušíš ho kdykoli. Licence platí, dokud předplatné běží.',
    onceNote: 'Jednorázová platba. Beat po zaplacení zmizí z obchodu.',
    tax: 'Konečnou cenu včetně případné daně uvidíš v platební bráně. Platbu zpracovává Lemon Squeezy.',
    pay: 'Zaplatit', close: 'Zavřít', yearly: '1 rok · auto-obnova', forever: 'bez omezení',
    err: { beat_sold: 'Beat byl právě exkluzivně prodán.', rate_limited: 'Příliš mnoho pokusů, zkus to za chvíli.', payments_not_configured: 'Platby zatím nejsou zapnuté. Ozvi se e-mailem.', generic: 'Platbu se nepodařilo připravit. Zkus to prosím znovu.' },
    thanks: 'Děkuji za podporu',
  },
  svc: {
    eyebrow: 'Služby', title1: 'Mix &', title2: 'Master',
    sub: 'Pošli stopy, vrátím ti skladbu připravenou na release. Pracuju na tom sám, bez šablon a bez AI masteringu.',
    pick: 'Co potřebuješ', songs: 'Počet skladeb', addons: 'Doplňky',
    s: {
      mix: { name: 'Mix', desc: 'Vokály + beat nebo celý projekt ve stopách. Čistota, hloubka, prostor.' },
      master: { name: 'Master', desc: 'Finální hlasitost a barva pro streaming. Ze stereo mixu.' },
      mixmaster: { name: 'Mix + Master', desc: 'Kompletní zvuk od stop po hotový master. Nejlepší poměr.' },
    },
    a: { express: 'Expres (poloviční termín)', tuning: 'Ladění vokálů', stemsOut: 'Export stems' },
    days: (n: number) => `${n} dní`, revisions: (n: number) => `${n} revize`, perSong: 'za skladbu', discount: (n: number) => `množstevní sleva −${n} %`,
    total: 'Cena', form: 'Zadání',
    name: 'Jméno / umělecké jméno', email: 'E-mail', project: 'Název projektu', files: 'Odkaz na soubory', filesPh: 'WeTransfer, Google Drive, Dropbox…',
    reference: 'Referenční skladba (odkaz)', notes: 'Co od zvuku čekáš', notesPh: 'Žánr, nálada, na co si dát pozor…',
    consent: 'Souhlasím se zpracováním údajů pro vyřízení poptávky a s obchodními podmínkami.',
    send: 'Odeslat poptávku', sendPay: 'Objednat a zaplatit', sending: 'Odesílám…',
    okTitle: 'Mám to.', okText: 'Poptávka dorazila. Do 24 hodin se ozvu na tvůj e-mail s potvrzením a dalšími kroky.',
    steps: [['Pošli stopy', 'WAV 24 bit, bez limiteru na masteru, každá stopa od nuly.'], ['Mix', 'První verze v dohodnutém termínu, poslech přes soukromý odkaz.'], ['Revize', 'Sepíšeš připomínky s časy, zapracuju je.'], ['Master', 'Finální WAV + MP3, na přání verze pro klip a instrumentál.']],
    process: 'Jak to probíhá',
    err: 'Odeslání se nepovedlo. Zkontroluj pole a zkus to znovu.',
  },
  faq: {
    title: 'Otázky',
    items: [
      ['Co přesně dostanu a kdy?', 'Hned po zaplacení tě web přesměruje na stránku objednávky se soubory ke stažení (WAV, u STEMS a Exclusive i ZIP se stopami) a s licenční smlouvou vyplněnou tvými údaji. Stejný odkaz ti přijde e-mailem v potvrzení platby.'],
      ['Jak funguje roční lease?', 'WAV a STEMS lease jsou pronájem licence. Platíš ročně, obnovuje se to samo a zrušit to můžeš kdykoli. Dokud licence běží, skladba může být venku. Po zrušení doběhne do konce zaplaceného roku.'],
      ['Co když beat někdo koupí exkluzivně?', 'Tvoje lease platí dál do konce aktuálního zaplaceného období, jen se už neobnoví. Všechno, co jsi do té doby prodal, zůstává v pořádku.'],
      ['Potřebuju účet?', 'Ne. Žádná registrace – tvůj klíč k objednávce je odkaz z potvrzovacího e-mailu. Předplatné spravuješ v zákaznickém portálu Lemon Squeezy.'],
      ['Musím uvádět kredit?', 'Ano, „prod. by LCSH“ v metadatech a popisu. Na autorských podílech se dělíme 50/50 (hudba/text).'],
      ['Můžu beat vrátit?', 'Jde o digitální obsah dodaný okamžitě, takže po stažení už odstoupit nejde – před platbou to výslovně potvrzuješ. Když je se soubory cokoli špatně, napiš a vyřešíme to.'],
    ] as [string, string][],
  },
  order: {
    processingTitle: 'Dokončujeme zpracování', processingText: 'Platební brána nám ještě nepotvrdila platbu. Obvykle to trvá pár vteřin – stránka se obnoví sama.',
    slow: 'Trvá to déle než obvykle? Zkontroluj e-mail s potvrzením platby – odkaz v něm vede sem. Kdyby nedorazil, napiš na',
    readyTitle: 'Je to tvoje.', files: 'Soubory', license: 'Licenční smlouva', open: 'Otevřít smlouvu', download: 'Stáhnout',
    keep: 'Tuhle adresu si ulož. Je to tvůj klíč k objednávce – účet ani heslo neexistuje.',
    until: 'Licence platí do', renews: 'a pak se automaticky obnoví.', cancelled: 'Předplatné je zrušené, licence už se neobnoví.',
    manage: 'Správa předplatného a faktury', endedTitle: 'Licenční období skončilo', endedText: 'Soubory už nejsou ke stažení. Licenci můžeš obnovit novým nákupem, pokud je beat stále v nabídce.',
    refundedTitle: 'Platba byla vrácena', refundedText: 'Licence tím zanikla a beat není možné dál používat.',
    serviceTitle: 'Zaplaceno, díky.', serviceText: 'Objednávku mixu / masteringu mám. Ozvu se e-mailem s dalšími kroky.',
    notFound: 'Objednávka nenalezena', notFoundText: 'Odkaz není platný. Zkontroluj, jestli je zkopírovaný celý.',
    test: 'Testovací objednávka', order: 'Objednávka',
  },
  footer: { claim: 'Beaty lisované ze zvuku.', terms: 'Obchodní podmínky', privacy: 'Soukromí', contact: 'Kontakt', top: 'Nahoru', made: 'Navrženo a postaveno pro poslech nahlas.' },
  notFound: { title: 'Tahle drážka je prázdná.', text: 'Stránka neexistuje nebo ji někdo přehrál.', back: 'Zpět do katalogu' },
  dock: { license: 'Licence' },
  crate: { drag: 'táhni', keys: 'listuj', crate: 'Bedna', list: 'Seznam', sticker: 'nové beaty každý týden' },
};

type Dict = typeof cs;

const en: Dict = {
  nav: { beats: 'Beats', services: 'Mix & Master', licenses: 'Licenses', faq: 'FAQ' },
  status: { ready: 'Ready', playing: 'Playing' },
  hero: {
    eyebrow: 'Beat store · since 2026',
    l1: 'Beats', l2: 'pressed', l3: 'from sound',
    sub: 'Every beat here gets its own record. The groove is the track\'s real waveform, the colour is its key. Drop the needle.',
    cta: 'Browse the catalog', cta2: 'Mix & Master',
    hintPlay: 'click = play', hintDrag: 'drag = scratch',
    stats: ['beats in the catalog', 'WAV · STEMS · EXCLUSIVE', 'instant download after payment'],
  },
  deck: {
    title: 'Catalog', sub: 'Find a beat with your ears, not by scrolling.',
    tempo: 'Tempo', tap: 'TAP', tapHint: 'Tap the tempo you hear in your head', any: 'any',
    key: 'Key', keyHint: 'Each key filters and plays', minor: 'minor', major: 'major', all: 'all',
    genre: 'Genre', search: 'Search', searchPh: 'title, genre, BPM…',
    sort: 'Sort', sortNew: 'newest', sortBpm: 'BPM', sortPrice: 'price', sortTitle: 'A–Z',
    reset: 'Clear filters', count: (n: number) => (n === 1 ? '1 beat' : `${n} beats`),
    empty: 'This groove is empty.', emptySub: 'No beat matches these filters. Try loosening tempo or key.',
    none: 'The catalog is being pressed.', noneSub: 'The first beats will land here soon.',
    error: 'Could not load the catalog.', retry: 'Try again',
  },
  row: { from: 'from', license: 'License', play: 'Play', pause: 'Pause', sold: 'Sold' },
  beat: {
    back: 'Catalog', choose: 'Choose a license', perYear: '/ year', once: 'one-time',
    buy: 'Continue to payment', sold: 'This beat has been sold exclusively.',
    noStems: 'Stems are not available for this beat.',
    fullText: 'Full license text', popular: 'Most popular', notFound: 'Beat not found',
    more: 'More beats', share: 'Copy link', copied: 'Copied',
    artwork: 'Artwork generated from the audio: groove = waveform, colour = key.',
  },
  lic: {
    title: 'Licenses', sub: 'Three ways to use a beat. No hidden terms – everything is in the table and in the contract.',
    wavTag: 'Lease · 1 year', stemsTag: 'Lease · 1 year', exclusiveTag: 'Yours for good',
    wavDesc: 'For a single or a first release. Untagged WAV; the license runs for a year and renews itself until you cancel.',
    stemsDesc: 'WAV plus individual stems for your own mix and arrangement. Higher limits, same yearly model.',
    exclusiveDesc: 'The beat leaves the store and nobody else can buy it. No limits, no renewals.',
    rows: {
      files: 'Files', term: 'Term', renew: 'Renewal', streams: 'Streams', sales: 'Sales / downloads', videos: 'Music videos',
      radio: 'Radio / TV', live: 'Live shows', contentId: 'Content ID', sync: 'Film, ads, games', publishing: 'Producer\'s writer share',
      exclusivity: 'Exclusivity', credit: 'Credit',
    },
    v: {
      wav: 'WAV', wavStems: 'WAV + stems (ZIP)', year: '1 year', forever: 'for the life of the rights', auto: 'automatic, cancel anytime', none: 'not needed',
      unlimited: 'unlimited', perTerm: 'per term', stations: (n: number) => `${n} stations`, yes: 'yes', no: 'no', consent: 'on request',
      nonExclusive: 'non-exclusive', exclusive: 'exclusive', creditReq: 'required',
    },
    how: 'How a lease works',
    howText: [
      'A lease is a non-exclusive license for one year. You pay it as a yearly subscription – while it runs, you can release the song and earn from it within the limits.',
      'Cancel with one click whenever you want. The license then runs to the end of the paid year and the song has to come down from distribution within 30 days.',
      'If someone buys the beat exclusively, your lease stays valid until the end of the paid term and simply does not renew.',
    ],
    read: 'Read the contract', texts: 'Full contract texts', print: 'Printable version',
    note: 'The text below is a template with blank fields. After purchase you get the contract filled in with your name, the date and the order number.',
  },
  receipt: {
    title: 'Receipt', item: 'Item', license: 'License', term: 'Term', total: 'Total',
    artist: 'Artist name (for the contract)', artistPh: 'e.g. MC Example',
    agree1a: 'I agree to the', agree1b: 'license agreement', agree1c: 'and the', agree1d: 'terms of sale',
    agree2: 'I want the files right after payment and acknowledge that I thereby lose the right to withdraw within 14 days.',
    renew: 'Yearly subscription: renews automatically at the same price, cancel anytime. The license is valid while the subscription runs.',
    onceNote: 'One-time payment. The beat leaves the store once paid.',
    tax: 'You will see the final price including any tax at checkout. Payment is processed by Lemon Squeezy.',
    pay: 'Pay', close: 'Close', yearly: '1 year · auto-renew', forever: 'unlimited',
    err: { beat_sold: 'This beat has just been sold exclusively.', rate_limited: 'Too many attempts, try again in a moment.', payments_not_configured: 'Payments are not switched on yet. Get in touch by e-mail.', generic: 'Could not prepare the payment. Please try again.' },
    thanks: 'Thank you for the support',
  },
  svc: {
    eyebrow: 'Services', title1: 'Mix &', title2: 'Master',
    sub: 'Send the stems, get back a release-ready track. I do it myself – no templates, no AI mastering.',
    pick: 'What you need', songs: 'Number of songs', addons: 'Add-ons',
    s: {
      mix: { name: 'Mix', desc: 'Vocals + beat or a full multitrack session. Clarity, depth, space.' },
      master: { name: 'Master', desc: 'Final loudness and tone for streaming. From a stereo mix.' },
      mixmaster: { name: 'Mix + Master', desc: 'The whole sound from stems to finished master. Best value.' },
    },
    a: { express: 'Express (half the turnaround)', tuning: 'Vocal tuning', stemsOut: 'Stem export' },
    days: (n: number) => `${n} days`, revisions: (n: number) => `${n} revisions`, perSong: 'per song', discount: (n: number) => `volume discount −${n}%`,
    total: 'Price', form: 'Brief',
    name: 'Name / artist name', email: 'E-mail', project: 'Project title', files: 'Link to files', filesPh: 'WeTransfer, Google Drive, Dropbox…',
    reference: 'Reference track (link)', notes: 'What you expect from the sound', notesPh: 'Genre, mood, things to watch out for…',
    consent: 'I agree to the processing of my data to handle this request and to the terms of sale.',
    send: 'Send request', sendPay: 'Order and pay', sending: 'Sending…',
    okTitle: 'Got it.', okText: 'Your request is in. I will reply to your e-mail within 24 hours with a confirmation and next steps.',
    steps: [['Send stems', '24-bit WAV, no limiter on the master, every track from zero.'], ['Mix', 'First version by the agreed date, shared via a private link.'], ['Revisions', 'You send timestamped notes, I work them in.'], ['Master', 'Final WAV + MP3; video and instrumental versions on request.']],
    process: 'How it goes',
    err: 'Sending failed. Check the fields and try again.',
  },
  faq: {
    title: 'Questions',
    items: [
      ['What exactly do I get, and when?', 'Right after payment you land on your order page with the downloads (WAV; for STEMS and Exclusive also a ZIP with the stems) and a license agreement filled in with your details. The same link arrives by e-mail in the payment confirmation.'],
      ['How does the yearly lease work?', 'WAV and STEMS leases are a rental of the license. You pay yearly, it renews by itself and you can cancel anytime. While the license runs, the song can stay out. After cancelling it runs to the end of the paid year.'],
      ['What if someone buys the beat exclusively?', 'Your lease stays valid until the end of the current paid term; it just does not renew. Everything you sold until then stays fine.'],
      ['Do I need an account?', 'No. No sign-up – the key to your order is the link in the confirmation e-mail. You manage the subscription in the Lemon Squeezy customer portal.'],
      ['Do I have to give credit?', 'Yes, "prod. by LCSH" in the metadata and description. Writers\' shares are split 50/50 (music/lyrics).'],
      ['Can I get a refund?', 'This is digital content delivered instantly, so once downloaded there is no withdrawal – you confirm that before paying. If anything is wrong with the files, write to me and we will sort it out.'],
    ],
  },
  order: {
    processingTitle: 'Finishing up', processingText: 'The payment gateway has not confirmed the payment yet. It usually takes a few seconds – this page refreshes itself.',
    slow: 'Taking longer than usual? Check the payment confirmation e-mail – the link in it leads here. If it never arrives, write to',
    readyTitle: 'It\'s yours.', files: 'Files', license: 'License agreement', open: 'Open the contract', download: 'Download',
    keep: 'Save this address. It is the key to your order – there is no account or password.',
    until: 'License valid until', renews: 'then it renews automatically.', cancelled: 'The subscription is cancelled; the license will not renew.',
    manage: 'Manage subscription & invoices', endedTitle: 'The license term has ended', endedText: 'The files can no longer be downloaded. You can reinstate the license with a new purchase if the beat is still on offer.',
    refundedTitle: 'The payment was refunded', refundedText: 'The license has terminated and the beat may no longer be used.',
    serviceTitle: 'Paid, thank you.', serviceText: 'I have your mix / mastering order. I will e-mail you with next steps.',
    notFound: 'Order not found', notFoundText: 'This link is not valid. Check that it was copied in full.',
    test: 'Test order', order: 'Order',
  },
  footer: { claim: 'Beats pressed from sound.', terms: 'Terms of sale', privacy: 'Privacy', contact: 'Contact', top: 'Top', made: 'Designed and built to be played loud.' },
  notFound: { title: 'This groove is empty.', text: 'The page does not exist, or someone played it out.', back: 'Back to the catalog' },
  dock: { license: 'License' },
  crate: { drag: 'drag', keys: 'browse', crate: 'Crate', list: 'List', sticker: 'new beats every week' },
};

const dicts = { cs, en };

/** Reaktivní slovník – v šablonách `t.hero.l1`. */
export const t = computed(() => dicts[lang.value]);
