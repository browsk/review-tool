import { describe, expect, it } from 'vitest';
import { parseParticipants } from '../../src/feedback/participants.js';

describe('participant files', () => {
  it('parses CSV with optional columns and a default role', () => {
    const r = parseParticipants('p.csv', 'name,email,role\nAda Lovelace,ada@example.com,author\nGrace Hopper,,\nAlan,a@x.org,reviewer\n');
    expect(r.fatal).toBeUndefined();
    expect(r.errors).toEqual([]);
    expect(r.participants).toEqual([
      { name: 'Ada Lovelace', email: 'ada@example.com', role: 'author' },
      { name: 'Grace Hopper', email: undefined, role: 'reviewer' },
      { name: 'Alan', email: 'a@x.org', role: 'reviewer' },
    ]);
  });

  it('accepts a BOM, header case/whitespace, CRLF and quoted names', () => {
    const r = parseParticipants('p.csv', '﻿ Name , ROLE\r\n"Doe, Jane",Reviewer\r\n');
    expect(r.participants).toEqual([{ name: 'Doe, Jane', email: undefined, role: 'reviewer' }]);
  });

  it('parses JSON arrays, {participants: []} and plain names', () => {
    expect(parseParticipants('p.json', '[{"name":"A","role":"author"},"B"]').participants.map((p) => [p.name, p.role])).toEqual([['A', 'author'], ['B', 'reviewer']]);
    expect(parseParticipants('p.json', '{"participants":[{"name":"C"}]}').participants).toHaveLength(1);
  });

  it('rejects an empty file', () => {
    expect(parseParticipants('p.csv', '   \n').fatal).toMatch(/empty/i);
  });

  it('rejects a CSV without a name column', () => {
    expect(parseParticipants('p.csv', 'email,role\na@b.c,author\n').fatal).toMatch(/Missing required column "name"/);
    expect(parseParticipants('p.csv', 'email,role\n').fatal).toMatch(/Missing required column "name"/);
  });

  it('rejects a header-only file with a name column', () => {
    expect(parseParticipants('p.csv', 'name,role\n').fatal).toMatch(/no participants/i);
  });

  it('rejects malformed JSON and wrong shapes', () => {
    expect(parseParticipants('p.json', '[{"name":').fatal).toMatch(/Malformed JSON/);
    expect(parseParticipants('p.json', '{"a":1}').fatal).toMatch(/array/);
    expect(parseParticipants('p.json', '[]').fatal).toMatch(/no participants/i);
  });

  it('lists offending rows for missing names, bad roles and duplicates, importing nothing', () => {
    const r = parseParticipants('p.csv', 'name,role\nAda,author\n,reviewer\nBob,manager\nada,reviewer\n');
    expect(r.participants).toEqual([]);
    expect(r.errors.map((e) => e.row)).toEqual([3, 4, 5]);
    expect(r.errors[0]!.message).toMatch(/name/);
    expect(r.errors[1]!.message).toMatch(/Invalid role "manager"/);
    expect(r.errors[2]!.message).toMatch(/Duplicate name "ada"/);
  });

  it('numbers JSON rows by array position', () => {
    const r = parseParticipants('p.json', '[{"name":"A"},{"email":"x"},{"name":"a"}]');
    expect(r.errors.map((e) => e.row)).toEqual([2, 3]);
  });
});
