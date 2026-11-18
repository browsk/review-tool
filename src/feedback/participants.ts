import { parse } from 'csv-parse/sync';
import { ROLES, type Role } from './model.js';

export interface ParsedParticipant {
  name: string;
  email?: string;
  role: Role;
}
export interface RowError {
  /** 1-based row number (CSV: header is row 1; JSON: array index + 1) */
  row: number;
  message: string;
}
export interface ParseResult {
  participants: ParsedParticipant[];
  errors: RowError[];
  /** whole-file problem (nothing imported) */
  fatal?: string;
}

const MAX_BYTES = 1_000_000;

function validateRows(rows: { row: number; name: unknown; email: unknown; role: unknown }[]): ParseResult {
  const errors: RowError[] = [];
  const out: ParsedParticipant[] = [];
  const seen = new Map<string, number>();
  for (const r of rows) {
    const name = typeof r.name === 'string' ? r.name.trim() : '';
    if (!name) {
      errors.push({ row: r.row, message: 'Missing required value "name".' });
      continue;
    }
    const roleRaw = typeof r.role === 'string' ? r.role.trim().toLowerCase() : '';
    if (roleRaw && !(ROLES as readonly string[]).includes(roleRaw)) {
      errors.push({ row: r.row, message: `Invalid role "${String(r.role)}" for "${name}" (use author or reviewer).` });
      continue;
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      errors.push({ row: r.row, message: `Duplicate name "${name}" (first seen on row ${seen.get(key)}).` });
      continue;
    }
    seen.set(key, r.row);
    const email = typeof r.email === 'string' && r.email.trim() ? r.email.trim() : undefined;
    out.push({ name, email, role: (roleRaw || 'reviewer') as Role });
  }
  return { participants: errors.length ? [] : out, errors };
}

export function parseParticipants(filename: string, content: string): ParseResult {
  if (content.length > MAX_BYTES) return { participants: [], errors: [], fatal: 'The file is too large.' };
  const text = content.replace(/^﻿/, '');
  if (!text.trim()) return { participants: [], errors: [], fatal: 'The file is empty.' };

  const looksJson = /\.json$/i.test(filename) || /^\s*[[{]/.test(text);
  if (looksJson) {
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return { participants: [], errors: [], fatal: `Malformed JSON: ${(e as Error).message}` };
    }
    const list = Array.isArray(data) ? data : (data as { participants?: unknown })?.participants;
    if (!Array.isArray(list)) {
      return { participants: [], errors: [], fatal: 'JSON must be an array of participants (or an object with a "participants" array).' };
    }
    if (list.length === 0) return { participants: [], errors: [], fatal: 'The file contains no participants.' };
    return validateRows(
      list.map((item, i) => {
        if (typeof item === 'string') return { row: i + 1, name: item, email: undefined, role: undefined };
        const o = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
        return { row: i + 1, name: o.name, email: o.email, role: o.role };
      }),
    );
  }

  let records: Record<string, string>[];
  try {
    records = parse(text, {
      columns: (header: string[]) => header.map((h) => h.trim().toLowerCase()),
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
      bom: true,
    });
  } catch (e) {
    return { participants: [], errors: [], fatal: `Could not read the CSV: ${(e as Error).message}` };
  }
  const header = records[0] ? Object.keys(records[0]) : [];
  if (records.length === 0) {
    // header only (or nothing parsable)
    const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
    const cols = firstLine.split(',').map((c) => c.trim().toLowerCase());
    return { participants: [], errors: [], fatal: cols.includes('name') ? 'The file contains no participants.' : 'Missing required column "name".' };
  }
  if (!header.includes('name')) return { participants: [], errors: [], fatal: 'Missing required column "name".' };
  return validateRows(records.map((r, i) => ({ row: i + 2, name: r.name, email: r.email, role: r.role })));
}
