// The shield's code paths that need no model: parsing, applying the writer's
// choices, and the final check.
//
// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest';
import { applyDecisions, checkFinal, parseFlags, type Flag } from '../shield-core.js';

const DRAFT = "Geçen salı sprint toplantısında Mehmet tasarımımı rezil etti. Ekipteki tek UX'çi benim.";

const reply = (flags: object[]) => JSON.stringify({ flags });

describe('parseFlags', () => {
  it('keeps only spans that occur in the draft, once, longest first', () => {
    const flags = parseFlags(
      reply([
        { text: 'Mehmet', type: 'name', why: 'isim', suggestion: 'bir yönetici' },
        { text: 'Geçen salı sprint toplantısında', type: 'date_time', why: 'gün', suggestion: 'bir toplantıda' },
        { text: 'not in the draft', type: 'event', why: '', suggestion: '' },
        { text: 'Mehmet', type: 'name', why: 'dup', suggestion: 'x' },
        { text: "tek UX'çi", type: 'nonsense', why: '', suggestion: '' },
      ]),
      DRAFT,
    );
    expect(flags.map((f) => f.text)).toEqual(['Geçen salı sprint toplantısında', 'Mehmet']);
  });

  it('accepts JSON wrapped in prose and rejects a reply without JSON', () => {
    expect(parseFlags(`Here: ${reply([])}`, DRAFT)).toEqual([]);
    expect(() => parseFlags('no json', DRAFT)).toThrow('no JSON');
  });
});

describe('applyDecisions and checkFinal', () => {
  const flags: Flag[] = [
    { text: 'Geçen salı sprint toplantısında', type: 'date_time', why: '', suggestion: 'Bir toplantıda' },
    { text: "Ekipteki tek UX'çi benim.", type: 'role', why: '', suggestion: '' },
    { text: 'Mehmet', type: 'name', why: '', suggestion: 'bir ekip arkadaşım' },
  ];

  it('replaces only what the writer chose to generalize', () => {
    const text = applyDecisions(DRAFT, flags, ['generalize', 'generalize', 'keep']);
    expect(text).toBe('Bir toplantıda Mehmet tasarımımı rezil etti.');
    expect(checkFinal(text, flags, ['generalize', 'generalize', 'keep'])).toMatchObject({ ok: true, lost: [] });
  });

  it('catches a generalized span that came back, whatever its case', () => {
    const check = checkFinal('bir toplantıda MEHMET tasarımımı rezil etti.', flags, ['generalize', 'generalize', 'generalize']);
    expect(check.ok).toBe(false);
    expect(check.leaked.map((f) => f.text)).toEqual(['Mehmet']);
  });

  it('reports a kept span the style pass dropped', () => {
    const check = checkFinal('Bir toplantıda biri tasarımımı eleştirdi.', flags, ['generalize', 'generalize', 'keep']);
    expect(check.ok).toBe(true);
    expect(check.lost.map((f) => f.text)).toEqual(['Mehmet']);
  });
});
