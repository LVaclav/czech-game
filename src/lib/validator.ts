import {
  FutureMode,
  GenderBinary,
  PersonRowKey,
  SessionGenders,
  TenseKey,
  ThirdSgPronoun,
  VerbEntry,
} from '../types';

export interface ValidationResult {
  isValid: boolean;
  canonicalAnswer: string;
  acceptedVariants: string[];
  feedbackHint?: string;
}

const PRONOUN_PREFIXES: Record<PersonRowKey, string[]> = {
  ja: ['já'],
  ty: ['ty'],
  thirdSg: ['on', 'ona', 'ono'],
  my: ['my'],
  vy: ['vy'],
  oni: ['oni', 'ony', 'ona'],
};

function normalizeWhitespace(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function stripDiacritics(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Returns the list of valid canonical forms for a specific verb, tense, person row, and gender/future configuration.
 */
export function getExpectedForms(
  verb: VerbEntry,
  tense: TenseKey,
  person: PersonRowKey,
  genders: SessionGenders,
  futureMode: FutureMode
): string[] {
  if (tense === 'present') {
    return verb.forms.present[person];
  }

  if (tense === 'future') {
    if (futureMode === 'pf' && verb.forms.futurePf) {
      return verb.forms.futurePf[person];
    }
    return verb.forms.futureImpf[person];
  }

  // Past tense depends on gender for Column 1 (ja, ty, thirdSg)
  switch (person) {
    case 'ja':
      return genders.ja === 'f' ? verb.forms.past.ja_f : verb.forms.past.ja_m;
    case 'ty':
      return genders.ty === 'f' ? verb.forms.past.ty_f : verb.forms.past.ty_m;
    case 'thirdSg': {
      const p: ThirdSgPronoun = genders.thirdSg;
      return verb.forms.past[p];
    }
    case 'my':
      return verb.forms.past.my;
    case 'vy':
      return verb.forms.past.vy;
    case 'oni':
      return verb.forms.past.oni;
  }
}

/**
 * Expands canonical forms to also allow natural explicit-pronoun word orders
 * while strictly enforcing Czech 2nd-position clitic rules!
 *
 * Examples:
 * - "dělám" -> ["dělám", "já dělám"]
 * - "dělal jsem" -> ["dělal jsem", "já jsem dělal", "já dělal"]
 * - "učil jsem se" -> ["učil jsem se", "já jsem se učil"] (NEVER "učil se jsem" or "já učil jsem se")
 * - "učil ses" -> ["učil ses", "učil jsi se", "ty ses učil", "ty jsi se učil"]
 * - "budu se učit" -> ["budu se učit", "učit se budu", "já se budu učit"]
 */
export function expandAcceptedVariants(
  baseForms: string[],
  person: PersonRowKey,
  tense: TenseKey,
  genders?: SessionGenders
): string[] {
  const pronouns =
    person === 'thirdSg' && genders
      ? [genders.thirdSg]
      : PRONOUN_PREFIXES[person];

  const expanded = new Set<string>();

  for (const raw of baseForms) {
    const form = normalizeWhitespace(raw);
    expanded.add(form);

    const tokens = form.split(' ');

    // 1. Single-word form (e.g. "dělám", "byl", "učil" N/A)
    if (tokens.length === 1) {
      for (const pron of pronouns) {
        expanded.add(`${pron} ${form}`);
      }
      continue;
    }

    // 2. Two-word form
    if (tokens.length === 2) {
      const [t1, t2] = tokens;

      // Reflexive present/pf-future: "učím se" -> "já se učím"
      if (t2 === 'se' || t2 === 'si') {
        for (const pron of pronouns) {
          expanded.add(`${pron} ${t2} ${t1}`);
        }
      }

      // Past with auxiliary: "dělal jsem", "dělali jsme" -> "já jsem dělal", "my jsme dělali"
      if (['jsem', 'jsi', 'jsme', 'jste'].includes(t2)) {
        for (const pron of pronouns) {
          expanded.add(`${pron} ${t2} ${t1}`);
          // Spoken Czech also allows dropping jsem/jsi when pronoun is explicit ("já dělal"),
          // but we keep standard auxiliary forms primary and allow "já jsem dělal".
        }
      }

      // Past 2nd person reflexive contraction: "učil ses" / "učila sis" -> "ty ses učil"
      if (t2 === 'ses' || t2 === 'sis') {
        for (const pron of pronouns) {
          expanded.add(`${pron} ${t2} ${t1}`);
        }
      }

      // Imperfective future: "budu dělat" -> "já budu dělat", "dělat budu"
      if (t1.startsWith('bud')) {
        expanded.add(`${t2} ${t1}`);
        for (const pron of pronouns) {
          expanded.add(`${pron} ${t1} ${t2}`);
        }
      }
    }

    // 3. Three-word form
    if (tokens.length === 3) {
      const [t1, t2, t3] = tokens;

      // Past reflexive: "učil jsem se", "učili jsme se" -> "já jsem se učil"
      if (['jsem', 'jsi', 'jsme', 'jste'].includes(t2) && (t3 === 'se' || t3 === 'si')) {
        for (const pron of pronouns) {
          expanded.add(`${pron} ${t2} ${t3} ${t1}`);
        }
      }

      // Imperfective future reflexive: "budu se učit" -> "učit se budu", "já se budu učit"
      if (t1.startsWith('bud') && (t2 === 'se' || t2 === 'si')) {
        expanded.add(`${t3} ${t2} ${t1}`);
        for (const pron of pronouns) {
          expanded.add(`${pron} ${t2} ${t1} ${t3}`);
        }
      }
    }
  }

  return Array.from(expanded);
}

/**
 * Validates a user's typed answer for a given cell or flashcard prompt.
 */
export function validateCzechAnswer(
  userInput: string,
  verb: VerbEntry,
  tense: TenseKey,
  person: PersonRowKey,
  genders: SessionGenders,
  futureMode: FutureMode
): ValidationResult {
  const baseForms = getExpectedForms(verb, tense, person, genders, futureMode);
  const canonicalAnswer = baseForms[0];
  const acceptedVariants = expandAcceptedVariants(baseForms, person, tense, genders);

  const cleanInput = normalizeWhitespace(userInput);
  if (!cleanInput) {
    return {
      isValid: false,
      canonicalAnswer,
      acceptedVariants,
    };
  }

  if (acceptedVariants.includes(cleanInput)) {
    return {
      isValid: true,
      canonicalAnswer,
      acceptedVariants,
    };
  }

  // Check if the user made a 2nd-position clitic mistake (e.g. "učil se jsem" or "budu učit se")
  if (verb.reflexive) {
    const inputWords = cleanInput.split(' ');
    const canonicalWords = canonicalAnswer.split(' ');
    if (
      inputWords.length === canonicalWords.length &&
      [...inputWords].sort().join(' ') === [...canonicalWords].sort().join(' ')
    ) {
      return {
        isValid: false,
        canonicalAnswer,
        acceptedVariants,
        feedbackHint: `Watch 2nd-position clitic order: "${canonicalAnswer}"`,
      };
    }
  }

  // Check if the user only missed Czech diacritics (háčky a čárky)
  const strippedInput = stripDiacritics(cleanInput);
  const matchedWithoutDiacritics = acceptedVariants.find(
    (variant) => stripDiacritics(variant) === strippedInput
  );

  if (matchedWithoutDiacritics) {
    return {
      isValid: false,
      canonicalAnswer,
      acceptedVariants,
      feedbackHint: `Almost! Check Czech accents (háčky/čárky): "${canonicalAnswer}"`,
    };
  }

  return {
    isValid: false,
    canonicalAnswer,
    acceptedVariants,
  };
}

/**
 * Formats the display label for any cell in the 3x2 grid or flashcard prompt.
 */
export function formatPersonLabel(
  person: PersonRowKey,
  tense: TenseKey,
  genders: SessionGenders
): { pronoun: string; badge: string | null; subtitle: string } {
  switch (person) {
    case 'ja':
      return {
        pronoun: 'Já',
        badge: tense === 'past' ? (genders.ja === 'm' ? '♂ m.' : '♀ f.') : null,
        subtitle: '1st sg. (I)',
      };
    case 'ty':
      return {
        pronoun: 'Ty',
        badge: tense === 'past' ? (genders.ty === 'm' ? '♂ m.' : '♀ f.') : null,
        subtitle: '2nd sg. (you)',
      };
    case 'thirdSg': {
      const map: Record<ThirdSgPronoun, { label: string; badge: string }> = {
        on: { label: 'On', badge: '♂ he' },
        ona: { label: 'Ona', badge: '♀ she' },
        ono: { label: 'Ono', badge: '⚪ it' },
      };
      const picked = map[genders.thirdSg];
      return {
        pronoun: picked.label,
        badge: picked.badge,
        subtitle: '3rd sg.',
      };
    }
    case 'my':
      return {
        pronoun: 'My',
        badge: null,
        subtitle: '1st pl. (we)',
      };
    case 'vy':
      return {
        pronoun: 'Vy',
        badge: null,
        subtitle: '2nd pl. (you all)',
      };
    case 'oni':
      return {
        pronoun: 'Oni',
        badge: null,
        subtitle: '3rd pl. (they)',
      };
  }
}
