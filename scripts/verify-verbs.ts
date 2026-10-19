import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import verbsData from '../src/data/verbs.json';
import { VerbEntry } from '../src/types';
import { validateCzechAnswer } from '../src/lib/validator';
import {
  createInitialProgress,
} from '../src/lib/api';
import {
  recordFlashcardAttempt,
  recordTableCompletion,
  selectNextVerbForTable,
} from '../src/lib/priorityQueue';
import {
  createSessionToken,
  hashPassword,
  verifyPassword,
  verifySessionToken,
} from '../netlify/functions/_auth';

/**
 * Generates a valid, uncompressed/deflated PNG image buffer of size width x height
 * with a Czech tricolor & indigo rounded theme so iOS Safari has real PNG icons
 * (`apple-touch-icon.png`, `icon-192.png`, `icon-512.png`).
 */
function generateAppIconPng(size: number): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function crc32(buf: Buffer): number {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type: string, data: Buffer): Buffer {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rawData = Buffer.alloc(size * (size * 4 + 1));

  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    rawData[rowStart] = 0; // filter type 0
    const ny = y / size;

    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const px = rowStart + 1 + x * 4;

      // Dark slate background (#0F172A)
      let r = 15;
      let g = 23;
      let b = 42;

      // Inner Czech flag card (0.22 <= nx <= 0.78, 0.25 <= ny <= 0.75)
      if (nx >= 0.22 && nx <= 0.78 && ny >= 0.25 && ny <= 0.75) {
        const dx = nx - 0.22;
        const dy = Math.abs(ny - 0.5);
        if (dx < 0.28 - dy * 1.1) {
          // Blue triangle (#2563EB)
          r = 37;
          g = 99;
          b = 235;
        } else if (ny < 0.5) {
          // White top (#F8FAFC)
          r = 248;
          g = 250;
          b = 252;
        } else {
          // Red bottom (#E11D48)
          r = 225;
          g = 29;
          b = 72;
        }
      }

      rawData[px] = r;
      rawData[px + 1] = g;
      rawData[px + 2] = b;
      rawData[px + 3] = 255;
    }
  }

  const idat = zlib.deflateSync(rawData);
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', iend),
  ]);
}

function ensurePwaIcons() {
  const publicDir = path.resolve(process.cwd(), 'public');
  const targets = [
    { file: 'apple-touch-icon.png', size: 180 },
    { file: 'icon-192.png', size: 192 },
    { file: 'icon-512.png', size: 512 },
  ];

  for (const t of targets) {
    const outPath = path.join(publicDir, t.file);
    fs.writeFileSync(outPath, generateAppIconPng(t.size));
  }
  console.log('✅ Generated PWA PNG icons: apple-touch-icon.png (180x180), icon-192.png, icon-512.png');
}

function verifyVerbCorpus() {
  const verbs = verbsData as VerbEntry[];
  if (verbs.length < 25) {
    throw new Error(`Expected at least 25 high-frequency verbs, found ${verbs.length}`);
  }

  const seenIds = new Set<string>();
  const presentKeys = ['ja', 'ty', 'thirdSg', 'my', 'vy', 'oni'] as const;
  const pastKeys = [
    'ja_m',
    'ja_f',
    'ty_m',
    'ty_f',
    'on',
    'ona',
    'ono',
    'my',
    'vy',
    'oni',
  ] as const;

  for (const v of verbs) {
    if (seenIds.has(v.id)) {
      throw new Error(`Duplicate verb ID: ${v.id}`);
    }
    seenIds.add(v.id);

    // Check Present & Future Impf
    for (const k of presentKeys) {
      if (!v.forms.present[k]?.length) {
        throw new Error(`Verb ${v.id} missing present.${k}`);
      }
      if (!v.forms.futureImpf[k]?.length) {
        throw new Error(`Verb ${v.id} missing futureImpf.${k}`);
      }
      if (v.forms.futurePf && !v.forms.futurePf[k]?.length) {
        throw new Error(`Verb ${v.id} missing futurePf.${k}`);
      }
    }

    // Check Past
    for (const k of pastKeys) {
      if (!v.forms.past[k]?.length) {
        throw new Error(`Verb ${v.id} missing past.${k}`);
      }
    }

    // Verify 2nd-position clitic rule for reflexive verbs ("se" / "si")
    if (v.reflexive) {
      const ref = v.reflexive;
      for (const form of v.forms.past.ja_m) {
        if (!form.endsWith(`jsem ${ref}`)) {
          throw new Error(
            `Reflexive verb ${v.id} past.ja_m "${form}" violates 2nd-position clitic order (expected "... jsem ${ref}")`
          );
        }
      }
      for (const form of v.forms.futureImpf.ja) {
        if (!form.startsWith(`budu ${ref} `)) {
          throw new Error(
            `Reflexive verb ${v.id} futureImpf.ja "${form}" violates 2nd-position clitic order (expected "budu ${ref} ...")`
          );
        }
      }
    }
  }

  // Test validator on reflexive clitics & diacritics
  const ucitSe = verbs.find((v) => v.id === 'ucit-se')!;
  const validPast = validateCzechAnswer(
    'učil jsem se',
    ucitSe,
    'past',
    'ja',
    { ja: 'm', ty: 'm', thirdSg: 'on' },
    'impf'
  );
  if (!validPast.isValid) {
    throw new Error('Expected "učil jsem se" to be valid');
  }

  const validWithPronoun = validateCzechAnswer(
    'já jsem se učil',
    ucitSe,
    'past',
    'ja',
    { ja: 'm', ty: 'm', thirdSg: 'on' },
    'impf'
  );
  if (!validWithPronoun.isValid) {
    throw new Error('Expected "já jsem se učil" (2nd-position clitic with pronoun) to be valid');
  }

  const invalidCliticOrder = validateCzechAnswer(
    'učil se jsem',
    ucitSe,
    'past',
    'ja',
    { ja: 'm', ty: 'm', thirdSg: 'on' },
    'impf'
  );
  if (invalidCliticOrder.isValid || !invalidCliticOrder.feedbackHint?.includes('clitic')) {
    throw new Error('Expected "*učil se jsem" to be rejected with a 2nd-position clitic hint');
  }

  console.log(`✅ Verified ${verbs.length} Czech verbs across Present, Past (m/f/n), and Future (impf/pf) + 2nd-position clitic rules.`);
}

function verifyPriorityRelapseAndAuth() {
  // 1. Test priority queue & relapse rule
  let progress = createInitialProgress('testuser');
  const firstPick = selectNextVerbForTable(progress);
  if (firstPick.verb.id !== 'byt' || firstPick.reason !== 'new') {
    throw new Error(`Expected first verb to be "byt", got ${firstPick.verb.id}`);
  }

  // Complete 'byt' and 'mit'
  progress = recordTableCompletion(progress, 'byt');
  progress = recordTableCompletion(progress, 'mit');

  if (!progress.verbs['byt'].completed || progress.verbs['byt'].inMatrixQueue) {
    throw new Error('Expected "byt" to be marked completed and removed from matrix queue');
  }

  // Next verb for table should now be 'chtit' (#3)
  const nextPick = selectNextVerbForTable(progress);
  if (nextPick.verb.id !== 'chtit') {
    throw new Error(`Expected next unseen verb to be "chtit", got ${nextPick.verb.id}`);
  }

  // Miss 'byt' twice in a row in Flashcards -> should stay in completedVerbs AND jump to top of Table Trainer queue!
  const attempt1 = recordFlashcardAttempt(progress, 'byt', 'past:ja', false);
  progress = attempt1.updatedProgress;
  if (attempt1.triggeredRelapse) {
    throw new Error('Should not relapse after only 1 miss');
  }

  const attempt2 = recordFlashcardAttempt(progress, 'byt', 'past:ja', false);
  progress = attempt2.updatedProgress;
  if (!attempt2.triggeredRelapse) {
    throw new Error('Should trigger relapse after 2 consecutive misses');
  }

  if (!progress.verbs['byt'].completed) {
    throw new Error('Relapsed verb must remain in completedVerbs pool!');
  }
  if (!progress.verbs['byt'].inMatrixQueue || progress.verbs['byt'].priorityScore < 100) {
    throw new Error('Relapsed verb must have inMatrixQueue = true and priorityScore >= 100');
  }

  const relapsedPick = selectNextVerbForTable(progress);
  if (relapsedPick.verb.id !== 'byt' || relapsedPick.reason !== 'relapsed') {
    throw new Error(`Expected relapsed verb "byt" to be served first, got ${relapsedPick.verb.id}`);
  }

  // 2. Test multi-user password hashing & HMAC session tokens
  const { hash, salt } = hashPassword('mojeHeslo123');
  if (!verifyPassword('mojeHeslo123', hash, salt)) {
    throw new Error('Password verification failed for valid password');
  }
  if (verifyPassword('wrongPassword', hash, salt)) {
    throw new Error('Password verification succeeded for wrong password');
  }

  const token = createSessionToken('Liam');
  const verifiedUser = verifySessionToken(`Bearer ${token}`);
  if (verifiedUser !== 'liam') {
    throw new Error(`Expected verified token username "liam", got ${verifiedUser}`);
  }

  console.log('✅ Verified Flashcard relapse priority re-queueing & multi-user auth crypto.');
}

ensurePwaIcons();
verifyVerbCorpus();
verifyPriorityRelapseAndAuth();
