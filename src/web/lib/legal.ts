import { BRAND } from '../../shared/brand';
import type { Lang } from '../../shared/types';

type Doc = { title: string; updated: string; sections: { h: string; p: string[] }[] };
const L = BRAND.legal;
const who = `${L.name}${L.ico ? `, IČO ${L.ico}` : ''}, ${L.address}`;

/**
 * Obchodní podmínky a zásady ochrany osobních údajů.
 * Vzorové znění – před ostrým spuštěním nech zkontrolovat (viz docs/NAVOD.md).
 */
export const LEGAL: Record<'terms' | 'privacy', Record<Lang, Doc>> = {
  terms: {
    cs: {
      title: 'Obchodní podmínky', updated: '12. 11. 2026',
      sections: [
        { h: '1. Kdo prodává', p: [
          `Provozovatelem obchodu a poskytovatelem licencí a služeb je ${who} („Producent“). Kontakt: ${BRAND.email}.`,
          'Platby zpracovává Lemon Squeezy, LLC, která při prodeji vystupuje jako autorizovaný prodejce (Merchant of Record): přijímá platbu, vystavuje doklad a řeší daně z prodeje. Obsah a licenci poskytuje Producent.',
        ] },
        { h: '2. Co se prodává', p: [
          'a) Licence k beatům (hudebním dílům a jejich zvukovým záznamům): WAV Lease a STEMS Lease jako nevýhradní licence na 1 rok hrazená ročním předplatným, a Exclusive jako výhradní licence za jednorázovou platbu. Rozsah práv určuje příslušná licenční smlouva, která je součástí těchto podmínek.',
          'b) Služby mixu a masteringu podle zadání zákazníka.',
        ] },
        { h: '3. Objednávka a uzavření smlouvy', p: [
          'Smlouva je uzavřena zaplacením v platební bráně. Před platbou vidíš, co kupuješ, typ licence, cenu a to, zda jde o opakovanou platbu. Registrace se nevyžaduje.',
          'U služeb vzniká smlouva potvrzením poptávky Producentem (e-mailem) nebo zaplacením objednávky, je-li platba nabídnuta rovnou.',
        ] },
        { h: '4. Cena a platba', p: [
          'Ceny na webu jsou uvedeny v měně obchodu. Konečná cena včetně případné daně podle země kupujícího se zobrazí v platební bráně před zaplacením.',
          'Lease je předplatné: obnovuje se automaticky po roce za cenu sjednanou při nákupu, dokud ho nezrušíš. Zrušit ho lze kdykoli v zákaznickém portálu Lemon Squeezy (odkaz je v potvrzení objednávky) nebo zprávou na kontaktní e-mail. Licence pak trvá do konce zaplaceného období.',
        ] },
        { h: '5. Dodání', p: [
          'Soubory a vyplněná licenční smlouva jsou dostupné ihned po potvrzení platby na stránce objednávky. Odkaz na ni obdržíš po zaplacení a v potvrzovacím e-mailu; slouží jako klíč k objednávce, proto ho nesdílej.',
          'U lease jsou soubory ke stažení po dobu trvání licence.',
        ] },
        { h: '6. Odstoupení od smlouvy (spotřebitelé)', p: [
          'Digitální obsah: před platbou výslovně souhlasíš s okamžitým zpřístupněním souborů a bereš na vědomí, že tím podle § 1837 písm. l) občanského zákoníku ztrácíš právo odstoupit od smlouvy ve lhůtě 14 dnů.',
          'Služby (mix, mastering): od smlouvy můžeš odstoupit do 14 dnů od jejího uzavření. Pokud jsi požádal o zahájení práce před uplynutím této lhůty, uhradíš při odstoupení poměrnou část ceny za již provedenou práci; po úplném dokončení služby právo na odstoupení zaniká.',
          `Odstoupit můžeš jednoznačným prohlášením zaslaným na ${BRAND.email} (uveď jméno, číslo objednávky a e-mail použitý při nákupu). Přijetí ti bez zbytečného odkladu potvrdím e-mailem.`,
        ] },
        { h: '7. Reklamace', p: [
          `Pokud soubory nejdou stáhnout, jsou poškozené nebo neodpovídají popisu, napiš na ${BRAND.email}. Vadu odstraním dodáním správných souborů; není-li to možné, máš právo na přiměřenou slevu nebo vrácení ceny. Reklamaci vyřídím nejpozději do 30 dnů.`,
        ] },
        { h: '8. Mix a mastering', p: [
          'Termín dodání běží od doručení kompletních podkladů. V ceně je uvedený počet revizí; další revize a změny zadání se účtují po dohodě. Zákazník prohlašuje, že má k dodaným nahrávkám potřebná práva. Hotové soubory smí zákazník užívat bez omezení; Producent si je smí po dohodě uvést v portfoliu.',
        ] },
        { h: '9. Řešení sporů', p: [
          'Vztahy se řídí právem České republiky. Spotřebitel se může obrátit na Českou obchodní inspekci (www.coi.cz), která je subjektem mimosoudního řešení spotřebitelských sporů.',
        ] },
      ],
    },
    en: {
      title: 'Terms of sale', updated: '12 November 2026',
      sections: [
        { h: '1. Who sells', p: [
          `The store is operated, and licenses and services are provided, by ${who} (the "Producer"). Contact: ${BRAND.email}.`,
          'Payments are processed by Lemon Squeezy, LLC, acting as the authorised reseller (Merchant of Record): it takes the payment, issues the receipt and handles sales taxes. The content and the license are provided by the Producer.',
        ] },
        { h: '2. What is sold', p: [
          'a) Licenses to beats (musical works and their sound recordings): WAV Lease and STEMS Lease as non-exclusive one-year licenses paid by annual subscription, and Exclusive as an exclusive license for a one-time payment. The scope of rights is set by the applicable license agreement, which forms part of these terms.',
          'b) Mixing and mastering services according to the customer\'s brief.',
        ] },
        { h: '3. Order and conclusion of the contract', p: [
          'The contract is concluded on payment at checkout. Before paying you see what you are buying, the license type, the price and whether the payment recurs. No registration is required.',
          'For services, the contract is formed when the Producer confirms the request by e-mail, or on payment if payment is offered directly.',
        ] },
        { h: '4. Price and payment', p: [
          'Prices on the site are shown in the store currency. The final price including any tax for the buyer\'s country is shown at checkout before payment.',
          'A lease is a subscription: it renews automatically after one year at the price agreed at purchase until you cancel. You can cancel at any time in the Lemon Squeezy customer portal (linked in the order confirmation) or by writing to the contact e-mail. The license then lasts until the end of the paid term.',
        ] },
        { h: '5. Delivery', p: [
          'The files and the completed license agreement are available immediately after payment is confirmed, on your order page. You receive the link after paying and in the confirmation e-mail; it is the key to your order, so do not share it.',
          'For leases, the files remain downloadable while the license is in force.',
        ] },
        { h: '6. Withdrawal (consumers)', p: [
          'Digital content: before paying you expressly agree to immediate access to the files and acknowledge that you thereby lose the right to withdraw within 14 days (Section 1837(l) of the Czech Civil Code; Article 16(m) of Directive 2011/83/EU).',
          'Services (mixing, mastering): you may withdraw within 14 days of concluding the contract. If you asked for work to start before that period ends, on withdrawal you pay a proportionate part of the price for work already done; once the service is fully performed the right of withdrawal ends.',
          `You can withdraw by an unambiguous statement sent to ${BRAND.email} (state your name, order number and the e-mail used for the purchase). I will confirm receipt by e-mail without undue delay.`,
        ] },
        { h: '7. Complaints', p: [
          `If the files cannot be downloaded, are damaged or do not match the description, write to ${BRAND.email}. I will fix the defect by supplying correct files; if that is not possible you are entitled to a reasonable discount or a refund. Complaints are handled within 30 days.`,
        ] },
        { h: '8. Mixing and mastering', p: [
          'The delivery time runs from receipt of complete materials. The price includes the stated number of revisions; further revisions and changes to the brief are charged by agreement. The customer declares having the necessary rights in the recordings supplied. The customer may use the finished files without restriction; the Producer may list them in a portfolio by agreement.',
        ] },
        { h: '9. Disputes', p: [
          'These terms are governed by Czech law. Consumers may contact the Czech Trade Inspection Authority (www.coi.cz), the body for out-of-court settlement of consumer disputes.',
        ] },
      ],
    },
  },
  privacy: {
    cs: {
      title: 'Ochrana soukromí', updated: '12. 11. 2026',
      sections: [
        { h: 'Správce', p: [`Správcem osobních údajů je ${who}. Kontakt: ${BRAND.email}.`] },
        { h: 'Jaké údaje zpracovávám', p: [
          'Objednávky: jméno, e-mail, umělecké jméno (pokud ho uvedeš), zakoupená licence, částka a stav platby. Platební údaje (číslo karty apod.) nevidím ani neukládám – zpracovává je Lemon Squeezy.',
          'Poptávky mixu a masteringu: údaje, které vyplníš ve formuláři.',
          'Provozní údaje: IP adresa se krátkodobě používá v hašované podobě k ochraně proti zneužití (omezení počtu požadavků).',
        ] },
        { h: 'Proč a na jakém základě', p: [
          'Plnění smlouvy (dodání souborů, vystavení licence, vyřízení služby), plnění právních povinností (účetnictví, daně) a oprávněný zájem (zabezpečení webu, ochrana autorských práv).',
        ] },
        { h: 'Komu údaje předávám', p: [
          'Lemon Squeezy, LLC (platby, daňové doklady, správa předplatného) a Cloudflare, Inc. (hosting, databáze a úložiště). Oba poskytovatelé mohou údaje zpracovávat i mimo EU na základě standardních smluvních doložek.',
        ] },
        { h: 'Jak dlouho', p: [
          'Údaje o objednávkách a licencích po dobu trvání licence a následně po dobu, po kterou lze uplatnit nároky z ní (obvykle 10 let, účetní doklady podle zákona). Poptávky služeb 3 roky.',
        ] },
        { h: 'Cookies a sledování', p: [
          'Web nepoužívá analytické ani reklamní cookies. V prohlížeči se ukládá pouze zvolený jazyk. Administrace používá nezbytnou přihlašovací cookie.',
        ] },
        { h: 'Tvoje práva', p: [
          `Máš právo na přístup k údajům, opravu, výmaz, omezení zpracování, přenositelnost a právo vznést námitku. Stačí napsat na ${BRAND.email}. Stížnost můžeš podat u Úřadu pro ochranu osobních údajů (www.uoou.gov.cz).`,
        ] },
      ],
    },
    en: {
      title: 'Privacy', updated: '12 November 2026',
      sections: [
        { h: 'Controller', p: [`The controller of personal data is ${who}. Contact: ${BRAND.email}.`] },
        { h: 'What data I process', p: [
          'Orders: name, e-mail, artist name (if you provide one), the license purchased, the amount and payment status. I never see or store payment details (card numbers etc.) – Lemon Squeezy processes them.',
          'Mixing and mastering requests: the details you enter in the form.',
          'Operational data: your IP address is briefly used in hashed form to protect against abuse (rate limiting).',
        ] },
        { h: 'Why and on what basis', p: [
          'Performance of a contract (delivering files, issuing the license, providing the service), legal obligations (accounting, tax) and legitimate interest (site security, copyright protection).',
        ] },
        { h: 'Who receives the data', p: [
          'Lemon Squeezy, LLC (payments, tax documents, subscription management) and Cloudflare, Inc. (hosting, database and storage). Both may process data outside the EU under standard contractual clauses.',
        ] },
        { h: 'How long', p: [
          'Order and license data for the duration of the license and afterwards for as long as claims under it may be raised (typically 10 years; accounting documents as required by law). Service requests for 3 years.',
        ] },
        { h: 'Cookies and tracking', p: [
          'The site uses no analytics or advertising cookies. Only your chosen language is stored in the browser. The admin area uses a strictly necessary login cookie.',
        ] },
        { h: 'Your rights', p: [
          `You have the right of access, rectification, erasure, restriction, portability and objection. Just write to ${BRAND.email}. You may lodge a complaint with the Czech Office for Personal Data Protection (www.uoou.gov.cz).`,
        ] },
      ],
    },
  },
};
