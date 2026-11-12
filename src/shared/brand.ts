/**
 * JEDINÉ MÍSTO, kde se nastavuje identita obchodu.
 * Hodnoty označené "DOPLŇ" vyplň před ostrým spuštěním (viz docs/NAVOD.md).
 * Tyto údaje se propisují do webu, licenčních smluv i právních stránek.
 */
export const BRAND = {
  /** Název značky / umělecké jméno producenta */
  name: 'LCSH',
  /** Povinný kredit v licencích */
  credit: 'prod. by LCSH',
  /** Kontaktní e-mail podpory */
  email: 'DOPLŇ@example.com',
  instagram: 'https://instagram.com/prodbylcsh',
  /** Právní identita poskytovatele licence (prodávajícího) */
  legal: {
    name: 'DOPLŇ Jméno Příjmení',
    /** IČO, pokud podnikáš; jinak nech prázdné */
    ico: 'DOPLŇ',
    address: 'DOPLŇ ulice č.p., PSČ město, Česká republika',
    /** Kolektivní správce a IPI/CAE číslo pro autorské podíly (nepovinné) */
    pro: 'OSA',
    ipi: '',
  },
} as const;
