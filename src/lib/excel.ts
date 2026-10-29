import * as XLSX from 'xlsx';
import { Question } from '../types/quiz';

const LETTERS = ["A", "B", "C", "D", "E"];

export interface ExcelParseResult {
  questions: Question[];
  summary: {
    total: number;
    skipped: string[];
    sample: { q: string; a: string };
    hasCustomTimers: boolean;
  };
}

export function parseExcelWorkbook(data: ArrayBuffer): ExcelParseResult {
  const wb = XLSX.read(data, { type: 'array' });
  const sheets = wb.SheetNames.map(name => ({
    name,
    rows: XLSX.utils.sheet_to_json<any[]>(wb.Sheets[name], { header: 1, defval: '', raw: false })
  }));

  const norm = (s: any) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

  // 1. Check for separate Answer Key sheet
  const key: Record<number, { a: string; e: string; t: string }> = {};
  for (const s of sheets) {
    for (let r = 0; r < Math.min(s.rows.length, 15); r++) {
      const h = s.rows[r].map(norm);
      const qn = h.findIndex(c => /^q\.?\s*no|^q\s*#|^sr|^sl/i.test(c));
      const co = h.findIndex(c => /correct option|^answer$|correct answer/i.test(c));
      if (qn >= 0 && co >= 0 && !h.some(c => /^question/i.test(c))) {
        const ex = h.findIndex(c => /explan/i.test(c));
        const tp = h.findIndex(c => /topic|category/i.test(c));
        for (const row of s.rows.slice(r + 1)) {
          const num = parseInt(row[qn], 10);
          if (num) {
            key[num] = {
              a: String(row[co] || '').trim(),
              e: ex >= 0 ? String(row[ex] || '').trim() : '',
              t: tp >= 0 ? String(row[tp] || '').trim() : ''
            };
          }
        }
        break;
      }
    }
  }

  // 2. Find sheet containing the Questions
  let bestSheet: { name: string; rows: any[][]; headerRow: number } | null = null;
  for (const s of sheets) {
    for (let r = 0; r < Math.min(s.rows.length, 15); r++) {
      const row = s.rows[r].map(norm);
      if (row.some(c => /question/i.test(c) && !/^q\.?\s*no/i.test(c))) {
        bestSheet = { name: s.name, rows: s.rows, headerRow: r };
        break;
      }
    }
    if (bestSheet) break;
  }

  if (!bestSheet) {
    throw new Error("Could not find a valid questions sheet with a 'Question' column.");
  }

  const header = bestSheet.rows[bestSheet.headerRow].map(norm);
  const qCol = header.findIndex(c => /question/i.test(c) && !/^q\.?\s*no/i.test(c) && !/type/i.test(c));

  const optCols: number[] = [];
  for (let i = 0; i < 5; i++) {
    const l = LETTERS[i].toLowerCase();
    const c = header.findIndex(x =>
      x === l ||
      x === `option ${l}` ||
      x === `option ${i + 1}` ||
      x === `opt ${l}` ||
      x === `(${l})` ||
      x === `choice ${i + 1}`
    );
    optCols.push(c);
  }

  const ansCol = header.findIndex(c => /^(correct )?(answer|option)$|correct answer|correct option|^ans$|^key$/i.test(c));
  const expCol = header.findIndex(c => /explan/i.test(c));
  const topicCol = header.findIndex(c => /^topic|^section|^category|^module/i.test(c));
  const numCol = header.findIndex(c => /^q\.?\s*no|^sr|^sl/i.test(c));
  const timeCol = header.findIndex(c => /^time|timer|seconds|^secs?\b|duration/i.test(c));

  if (optCols.filter(c => c >= 0).length < 2) {
    throw new Error("Could not identify option columns (Option A, Option B, etc.). Please check column headings.");
  }

  const questions: Question[] = [];
  const skipped: string[] = [];

  bestSheet.rows.slice(bestSheet.headerRow + 1).forEach((row, k) => {
    const text = String(row[qCol] ?? '').trim();
    if (!text) return;

    const options: string[] = [];
    const mapOriginalToKept: number[] = [];

    optCols.forEach((colIdx, originalIdx) => {
      if (colIdx >= 0 && String(row[colIdx] ?? '').trim() !== '') {
        mapOriginalToKept[originalIdx] = options.length;
        options.push(String(row[colIdx]).trim());
      }
    });

    const qNum = numCol >= 0 ? parseInt(row[numCol], 10) : k + 1;
    let rawAns = ansCol >= 0 ? row[ansCol] : (key[qNum]?.a || '');
    rawAns = String(rawAns ?? '').trim();

    let correctIdx = -1;
    if (/^[A-Ea-e]$/.test(rawAns)) {
      const charIndex = LETTERS.indexOf(rawAns.toUpperCase());
      correctIdx = mapOriginalToKept[charIndex];
    } else if (/^\(?[A-Ea-e]\)/.test(rawAns)) {
      const char = rawAns.replace('(', '')[0].toUpperCase();
      const charIndex = LETTERS.indexOf(char);
      correctIdx = mapOriginalToKept[charIndex];
    } else if (/^[1-5]$/.test(rawAns)) {
      correctIdx = mapOriginalToKept[parseInt(rawAns, 10) - 1];
    } else if (rawAns) {
      correctIdx = options.findIndex(o => norm(o) === norm(rawAns));
    }

    if (options.length < 2 || correctIdx === undefined || correctIdx < 0) {
      skipped.push(`Row ${bestSheet!.headerRow + k + 2}: ${text.slice(0, 30)}...`);
      return;
    }

    const exp = expCol >= 0 ? row[expCol] : (key[qNum]?.e || '');
    const top = topicCol >= 0 ? row[topicCol] : (key[qNum]?.t || '');
    const secs = timeCol >= 0 ? parseInt(String(row[timeCol]).replace(/[^\d]/g, ''), 10) || null : null;

    questions.push({
      i: questions.length,
      q: text,
      o: options,
      a: correctIdx,
      e: exp ? String(exp).trim() : null,
      t: top ? String(top).trim() : null,
      s: secs && secs > 0 ? Math.min(secs, 300) : null
    });
  });

  if (!questions.length) {
    throw new Error("No valid questions found in the file. Ensure questions have text, options, and a marked correct answer.");
  }

  return {
    questions,
    summary: {
      total: questions.length,
      skipped,
      sample: {
        q: questions[0].q,
        a: `${LETTERS[questions[0].a]}: ${questions[0].o[questions[0].a]}`
      },
      hasCustomTimers: questions.some(q => q.s && q.s > 0)
    }
  };
}
