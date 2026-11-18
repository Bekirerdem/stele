// The page is a short film followed by the facts under it.
//
// The film is one fixed stage driven by one clock: `t` is how many screens the
// reader has scrolled. Nothing is tweened towards a target; every frame is
// computed from `t` alone (keyframed channels for what moves, plain thresholds
// for what switches). So scrolling back, jumping from the rail or reloading
// half way always lands on the same picture.

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './style.css';
import { copy, REAL, SOURCES, type Copy, type Lang } from './copy';

gsap.registerPlugin(ScrollTrigger);

const app = document.querySelector<HTMLDivElement>('#app')!;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Labels are upper-cased in CSS; keep brand names out of Turkish casing (MİDNİGHT).
const eb = (s: string) => esc(s).replace(/(Midnight|NEAR AI|stele)/g, '<span lang="en">$1</span>');
const short = (h: string) => `${h.slice(0, 8)}…${h.slice(-4)}`;
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const narrow = () => window.innerWidth < 760;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function readLang(): Lang {
  try {
    const v = localStorage.getItem('stele.lang');
    if (v === 'en' || v === 'tr') return v;
  } catch { /* storage blocked */ }
  return navigator.language.toLowerCase().startsWith('tr') ? 'tr' : 'en';
}
let lang: Lang = readLang();

// ---------------------------------------------------------------- the clock

/** When things happen, in screens scrolled. */
const T = {
  heroOut: [0.05, 0.5],
  zoomIn1: [0.7, 1.5],
  dev1: [1.5, 4.8],
  type1: [1.7, 2.7],
  thought: [2.85, 3.15, 3.45],
  erase: [3.9, 4.3],
  fine: [4.35, 4.55],
  send1: 4.65,
  zoomOut1: [4.8, 5.4],
  flipA: [5.5, 6.2],
  beats: [[6.35, 7.0], [7.1, 7.75], [7.85, 8.5]],
  flipBack: [8.5, 9.0],
  resA: [9.1, 9.65],
  lapse1: [9.7, 10.55],
  leaveA: [9.75, 9.95],
  leaveB: [10.1, 10.4],
  beatQ: [10.9, 11.45],
  beatS: [11.5, 12.15],
  rewind: [12.25, 12.8],
  blank: [12.85, 13.25],
  zoomIn2: [13.2, 13.9],
  dev2: [13.9, 16.25],
  type2: [14.0, 14.5],
  flags: 14.8,
  decide: 15.3,
  send2: 16.05,
  zoomOut2: [16.3, 16.9],
  pulse: [17.0, 17.55],
  equal: [17.5, 17.9],
  shuffle: [17.9, 18.35],
  seal: [18.4, 19.1],
  unlock: [19.2, 19.9],
  resB: [20.1, 21.1],
  lapse2: [21.3, 22.0],
  beatE: [22.3, 23.25],
  end: 23.3,
} as const;

const ACT_AT = [0, 1.5, 5.4, 9.0, 12.2, 20.0];

type Ease = (x: number) => number;
const inOut: Ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const linear: Ease = (x) => x;

/** A keyframed channel: [[time, value], ...], eased between neighbours. */
function kf(t: number, frames: readonly (readonly [number, number])[], ease: Ease = inOut): number {
  const first = frames[0]!;
  if (t <= first[0]) return first[1];
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1]!;
    const b = frames[i]!;
    if (t <= b[0]) return a[1] + (b[1] - a[1]) * ease((t - a[0]) / (b[0] - a[0] || 1));
  }
  return frames[frames.length - 1]![1];
}
const within = (t: number, r: readonly [number, number] | readonly number[]) => t >= r[0]! && t < r[1]!;
const progress = (t: number, r: readonly number[]) => clamp((t - r[0]!) / (r[1]! - r[0]!));

/** Deterministic shuffle, so every visit tells the same story. */
function shuffled<T>(arr: readonly T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

// ---------------------------------------------------------------- the crowd

type Cell = {
  el: HTMLElement;
  you: boolean;
  /** When this card turns over, 0..1. */
  r1: number;
  /** When this card's old answer is wiped, 0..1. */
  r2: number;
  /** Order of leaving in the first timeline (Infinity: stays). */
  leave: number;
  /** Order of answering in the second timeline. */
  rank: number;
  /** Distance from Elif's card, 0..1. */
  dist: number;
};

type Crowd = { el: HTMLElement; cells: Cell[]; you: Cell; n: number; k: number; cols: number; rows: number };

function crowdMarkup(c: Copy): { html: string; n: number; k: number; cols: number; rows: number; you: number; meta: Omit<Cell, 'el'>[] } {
  const cols = narrow() ? 6 : 16;
  const rows = narrow() ? 9 : 10;
  const n = cols * rows;
  const k = Math.round(n * 0.82);
  const you = narrow() ? 3 * cols + 4 : 5 * cols + 11;
  const youCol = you % cols;
  const youRow = Math.floor(you / cols);
  // The part of the wall no text sits on: the right half on a wide screen, the
  // upper half on a phone. Whoever leaves, and the removed answer, live there.
  const visible = (i: number) => (narrow() ? Math.floor(i / cols) < rows * 0.5 : i % cols >= cols * 0.5);

  const ids = Array.from({ length: n }, (_, i) => i);
  const others = ids.filter((i) => i !== you);
  const flipOrder = shuffled(others, 3);
  const wipeOrder = shuffled(others, 5);
  const leavers = shuffled(others.filter(visible), 7).slice(0, 11);
  const answerOrder = shuffled(others, 9);
  const removedId = answerOrder.slice(0, k - 1).filter(visible)[4]!;

  // Each card trades places with one nearby: the moment an answer comes loose
  // from whoever wrote it.
  const swap = new Map<number, number>();
  for (const i of shuffled(ids, 13)) {
    if (swap.has(i)) continue;
    const near = shuffled(ids, 17 + i).find((j) => j !== i && !swap.has(j)
      && Math.abs((j % cols) - (i % cols)) <= 3 && Math.abs(Math.floor(j / cols) - Math.floor(i / cols)) <= 2);
    if (near === undefined) continue;
    swap.set(i, near);
    swap.set(near, i);
  }

  const mixed: Copy['voices'] = [];
  for (let seed = 11; mixed.length < n; seed += 12) mixed.push(...shuffled(c.voices, seed));
  const hosp: string[] = [];
  for (let seed = 21; hosp.length < n; seed += 6) hosp.push(...shuffled(c.hosp, seed));

  const maxDist = Math.hypot(Math.max(youCol, cols - youCol), Math.max(youRow, rows - youRow));
  const meta: Omit<Cell, 'el'>[] = [];
  let html = '';
  for (const i of ids) {
    const isYou = i === you;
    const rank = isYou ? 0 : answerOrder.indexOf(i) + 1;
    const leave = leavers.indexOf(i);
    meta.push({
      you: isYou,
      r1: isYou ? 0.5 : (flipOrder.indexOf(i) + 0.5) / others.length,
      r2: isYou ? 0 : (wipeOrder.indexOf(i) + 0.5) / others.length,
      leave: leave < 0 ? Infinity : leave,
      rank,
      dist: Math.hypot((i % cols) - youCol, Math.floor(i / cols) - youRow) / maxDist,
    });
    const to = swap.get(i);
    const dc = to === undefined ? 0 : (to % cols) - (i % cols);
    const dr = to === undefined ? 0 : Math.floor(to / cols) - Math.floor(i / cols);
    const v = mixed[i]!;
    const truth = i === removedId ? c.removed : hosp[i]!;
    html += `<div class="cell${isYou ? ' you' : ''}${i === removedId ? ' removed' : ''}" style="--dc:${dc};--dr:${dr};--in:${((i * 37) % 23) * 22}ms">`
      + '<div class="card">'
      + `<div class="face front"><span class="f-fine">${esc(c.said)}</span><span class="f-seal">${esc(c.sealedCard)}</span></div>`
      + `<div class="face back"><span class="b-mixed"><em class="sec">${esc(v.s)}</em>${esc(v.t)}</span><span class="b-hosp">${esc(truth)}</span><span class="b-user"></span></div>`
      + '</div></div>';
  }
  return { html: `<div class="crowd" style="--cols:${cols}">${html}</div>`, n, k, cols, rows, you, meta };
}

// ---------------------------------------------------------------- markup

const fill = (s: string, n: number, k: number) => s.replace(/\{n\}/g, String(n)).replace(/\{k\}/g, String(k));

function segmentsMarkup(c: Copy): string {
  return c.segments
    .map((s) => (s.tag
      ? `<span class="seg flag${s.keep ? ' keep' : ''}"><em class="tag">${esc(s.tag)}</em><span class="o">${esc(s.t)}</span><span class="r">${esc(s.to ?? '')}</span><b class="verdict">${esc(s.keep ? c.kept : c.generalized)}</b></span>`
      : `<span class="seg">${esc(s.t)}</span>`))
    .join('');
}

const terminalLines = (): { cls: string; text: string }[] => [
  { cls: 'cmd', text: '$ npm run stele -- status' },
  { cls: '', text: `Question:   demo-leaving-3  (${short(REAL.question)})` },
  { cls: '', text: 'Phase:      closed' },
  { cls: '', text: 'Minimum:    3 answers before any is opened' },
  { cls: '', text: 'Members:    3' },
  { cls: '', text: 'Answered:   3 (3 submissions, revisions included)' },
  { cls: '', text: 'Removed:    1 marked now, 1 ever' },
  { cls: '', text: `  ${short(REAL.removedId)}  removed: insult` },
  { cls: 'cmd', text: '$ npm run stele -- verify --rules examples/leaving.rules.json' },
  { cls: 'ok', text: '✔ Rules document matches the hash fixed in the contract' },
  { cls: 'ok', text: '✔ Minimum 3 matches the rules' },
  { cls: 'ok', text: '✔ 3 of 3 answer blobs found, each matching its on-chain digest' },
];

function template(c: Copy, crowd: string, n: number, k: number): string {
  const rail = c.acts.map((a, i) => `<li><button data-act="${i}"><span>0${i + 1}</span><span class="name">${eb(a)}</span></button></li>`).join('');
  return `
<header class="top">
  <a class="brand" href="#top"><b>stele</b><span>${eb(c.tag)}</span></a>
  <div class="top-actions">
    <button class="pill skip" id="skip">${esc(c.nav.skip)}</button>
    <button class="pill" id="lang" aria-label="Language">${esc(c.nav.lang)}</button>
    <a class="btn" href="${REAL.repo}" target="_blank" rel="noopener">${esc(c.nav.code)}</a>
  </div>
</header>
<div class="progress"><i></i></div>
<ol class="rail">${rail}</ol>

<div class="stage" aria-hidden="true">
  <div class="field">${crowd}</div>
  <div class="scrim"></div>
  <div class="inside"></div>

  <div class="ui hud"><i></i><span data-hud></span></div>

  <div class="ui hero">
    <div class="eyebrow">${eb(c.hero.eyebrow)}</div>
    <div class="hero-title">${c.hero.title.map((l) => `<span class="line"><span>${esc(fill(l, n, k))}</span></span>`).join('')}</div>
    <p class="hero-sub">${esc(c.hero.sub)}</p>
    <p class="hero-about">${eb(c.hero.about)}</p>
  </div>
  <div class="ui hint eyebrow"><span>${esc(c.hero.hint)}</span><i></i></div>

  <div class="ui tell">
    <ol class="thoughts">${c.thoughts.map((x, i) => `<li><b>${i + 1}</b><span>${esc(x)}</span></li>`).join('')}</ol>
    <div class="fear"><b data-fear-n></b><span data-fear></span></div>
    <p class="caption" data-cap></p>
  </div>

  <div class="ui device" data-device>
    <div class="dev-head"><span class="dev-title" data-dev-title></span><span class="dev-badge" data-dev-badge></span></div>
    <ul class="dev-rules">${c.formB.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
    <div class="dev-q" data-dev-q></div>
    <div class="dev-text"><span data-typed></span><span class="caret"></span><p class="draft" data-draft>${segmentsMarkup(c)}</p></div>
    <div class="dev-foot"><span class="dev-receipt">${eb(c.formB.receipt)}</span><span class="dev-send" data-send></span></div>
  </div>

  <div class="ui result" data-res-a>
    <div class="eyebrow">${esc(c.resA.label)}</div>
    <div class="res-n">${n}<small> / ${n}</small></div>
    <div class="res-w">${esc(c.resA.word)}</div>
    <div class="res-row"><i></i>${esc(c.resA.verdict)}</div>
  </div>
  <div class="ui result" data-res-b>
    <div class="eyebrow">${eb(c.resB.label)}</div>
    <div class="res-n">${k}<small> / ${n}</small></div>
    <div class="res-w">${esc(c.resB.word)}</div>
    ${c.resB.rows.map((r) => `<div class="res-row"><i></i>${esc(r)}</div>`).join('')}
  </div>

  <div class="ui chip" data-chip></div>

  <div class="ui beat" data-beat><div class="beat-n" data-beat-n></div><p class="beat-t" data-beat-t></p><span class="beat-src" data-beat-src></span></div>
</div>

<main id="top">
  <section class="film" style="height:${(T.end + 1) * 100}vh"></section>

  <section class="doc" id="real">
    <div class="doc-head">
      <div class="eyebrow">07  ${esc(c.real.eyebrow)}</div>
      <h2 class="doc-title">${esc(c.real.title)}</h2>
      <p class="doc-body">${eb(c.real.body)}</p>
    </div>

    <div class="doc-block">
      <h3 class="doc-h">${esc(c.real.todayTitle)}</h3>
      <div class="doc-two">
        <dl class="rows">${c.real.today.map((r) => `<div><dt>${esc(r.k)}</dt><dd>${eb(r.v)}</dd></div>`).join('')}</dl>
        <div class="term"><div class="term-bar"><i></i><i></i><i></i></div><pre id="term"></pre></div>
      </div>
    </div>

    <div class="doc-block">
      <h3 class="doc-h">${esc(c.real.seesTitle)}</h3>
      <div class="sees">
        <div class="sees-head"><span></span><span>${esc(c.real.seesCols[0]!)}</span><span>${esc(c.real.seesCols[1]!)}</span></div>
        ${c.real.sees.map((r) => `<div class="sees-row"><span class="who">${eb(r.who)}</span><span class="s">${esc(r.s)}</span><span class="nv">${esc(r.n)}</span></div>`).join('')}
      </div>
    </div>

    <div class="doc-block">
      <h3 class="doc-h">${eb(c.real.whyTitle)}</h3>
      <dl class="rows wide">${c.real.why.map((r) => `<div><dt>${esc(r.k)}</dt><dd>${eb(r.v)}</dd></div>`).join('')}</dl>
    </div>

    <div class="doc-block">
      <h3 class="doc-h">${esc(c.real.limitsTitle)}</h3>
      <div class="limits">${c.real.limits.map((r) => `<div class="limit"><span class="no">${esc(r.no)}<i></i></span><span class="yes">${esc(r.yes)}</span></div>`).join('')}</div>
    </div>

    <div class="doc-block sources">
      <h3 class="doc-h">${esc(c.real.sourcesTitle)}</h3>
      <ul>${SOURCES.map((s) => `<li>${s.url ? `<a href="${s.url}" target="_blank" rel="noopener">${esc(s.label)}</a>` : esc(s.label)}</li>`).join('')}</ul>
    </div>
  </section>

  <section class="finale" id="you">
    <div class="you-in">
      <div class="eyebrow">08  ${esc(c.acts[7]!)}</div>
      <h2 class="you-title">${esc(c.you.title)}</h2>
      <p class="doc-body">${esc(c.you.body)}</p>
      <form class="you-form" id="you-form">
        <label class="sr" for="you-input">${esc(c.you.title)}</label>
        <input id="you-input" type="text" maxlength="64" autocomplete="off" placeholder="${esc(c.you.placeholder)}" />
        <button class="btn" type="submit">${esc(c.you.send)}</button>
      </form>
      <p class="you-done" id="you-done">${esc(c.you.done)}</p>
      <p class="you-line">${eb(c.you.line)}</p>
      <div class="end-row">
        <a class="btn" href="${REAL.repo}" target="_blank" rel="noopener">${esc(c.you.code)} <span aria-hidden="true">→</span></a>
        <span class="status"><i></i>${eb(c.you.status)}</span>
      </div>
    </div>
    <div class="foot"><span>${esc(c.you.foot)}</span><span class="mono">stele v0.2.0</span></div>
  </section>
</main>`;
}

// ---------------------------------------------------------------- the film

/** Writes text only when it changed, and replays the element's entrance. */
function swapper(el: HTMLElement) {
  let last: string | null = null;
  return (html: string) => {
    if (html === last) return;
    last = html;
    el.innerHTML = html;
    el.classList.remove('rise');
    if (html) {
      void el.offsetWidth;
      el.classList.add('rise');
    }
  };
}

function buildFilm(c: Copy, crowd: Crowd) {
  const root = document.querySelector<HTMLElement>('.stage')!;
  const q = <E extends HTMLElement>(sel: string) => root.querySelector<E>(sel)!;
  const { n, k } = crowd;
  const draft = c.segments.map((s) => s.t).join('');

  const hero = q('.hero');
  const hint = q('.hint');
  const inside = q('.inside');
  const scrim = q('.scrim');
  const device = q('[data-device]');
  const typed = q('[data-typed]');
  const sendEl = q('[data-send]');
  const devTitle = q('[data-dev-title]');
  const devBadge = q('[data-dev-badge]');
  const devQ = q('[data-dev-q]');
  const resA = q('[data-res-a]');
  const resB = q('[data-res-b]');
  const beat = q('[data-beat]');
  const chip = q('[data-chip]');
  const thoughts = [...root.querySelectorAll<HTMLElement>('.thoughts li')];
  const fearBox = q('.fear');

  const setCap = swapper(q('[data-cap]'));
  const setHud = swapper(q('[data-hud]'));
  const setFear = swapper(q('[data-fear]'));
  const setFearN = swapper(q('[data-fear-n]'));
  const setBeatN = swapper(q('[data-beat-n]'));
  const setBeatT = swapper(q('[data-beat-t]'));
  const setBeatSrc = swapper(q('[data-beat-src]'));
  const setChip = swapper(chip);
  const setTyped = swapper(typed);
  const setSend = swapper(sendEl);

  let zoom = 20;
  const measure = () => {
    const you = crowd.you.el;
    const ox = you.offsetLeft + you.offsetWidth / 2;
    const oy = you.offsetTop + you.offsetHeight / 2;
    crowd.el.style.transformOrigin = `${ox}px ${oy}px`;
    const x = crowd.el.offsetLeft + ox;
    const y = crowd.el.offsetTop + oy;
    const reach = Math.max(x, window.innerWidth - x, y, window.innerHeight - y);
    zoom = ((2 * reach) / Math.min(you.offsetWidth, you.offsetHeight)) * 1.1;
  };

  // [from, caption]; the last one whose time has come is on screen.
  const caps: [number, string][] = [
    [0, ''],
    [0.5, c.cap.one],
    [T.dev1[0], c.cap.night],
    [T.type1[0] + 0.1, c.cap.typing],
    [T.thought[0] - 0.05, c.cap.pause],
    [T.erase[0], c.cap.erase],
    [T.fine[0], c.cap.fine],
    [T.dev1[1], ''],
    [T.zoomOut1[1], c.cap.others],
    [T.beats[0][0] - 0.1, ''],
    [T.flipBack[0], c.cap.same],
    [T.resA[0], c.cap.morning],
    [T.leaveA[0], c.cap.dec],
    [T.leaveB[0], c.cap.feb],
    [T.leaveB[1] + 0.05, c.cap.mar],
    [T.beatQ[0] - 0.1, ''],
    [T.rewind[0], c.cap.rewind],
    [T.rewind[1], c.cap.again],
    [T.dev2[0], c.cap.typing2],
    [T.flags, c.cap.shield],
    [T.decide, c.cap.decide],
    [T.send2, c.cap.noask],
    [T.pulse[0], c.cap.proof],
    [T.equal[0] + 0.1, c.cap.unlink],
    [T.seal[0], c.cap.min],
    [T.seal[0] + 0.45, c.cap.fixed],
    [T.unlock[0], c.cap.open],
    [T.resB[0], c.cap.hears],
    [T.resB[0] + 0.65, c.cap.which],
    [T.lapse2[0], c.cap.dec2],
    [T.lapse2[0] + 0.45, c.cap.mar2],
    [T.beatE[0] - 0.1, ''],
  ];
  const beats: { r: readonly number[]; n?: string; t: string; src?: string; big?: boolean }[] = [
    ...c.beats.map((b, i) => ({ r: T.beats[i]!, n: b.n, t: b.t, src: b.src })),
    { r: T.beatQ, t: c.beatQ, big: true },
    { r: T.beatS, t: c.beatS, big: true },
    { r: T.beatE, t: `${c.beatE[0]}<br>${c.beatE[1]}`, big: true },
  ];
  const lastAt = <V,>(list: [number, V][], t: number): V => {
    let v = list[0]![1];
    for (const [at, x] of list) if (at <= t) v = x; else break;
    return v;
  };

  const hudAt = (t: number): string => {
    const m = c.hud.months;
    const month = (p: number) => m[Math.min(m.length - 1, Math.floor(p * m.length))]!;
    if (t < T.zoomIn1[1] - 0.1) return c.hud.closed;
    if (t < T.zoomOut1[0]) return c.hud.night;
    if (t < T.flipBack[1]) return c.hud.others;
    if (t < T.lapse1[0]) return c.hud.morning;
    if (t < T.rewind[0]) return month(progress(t, T.lapse1));
    if (t < T.rewind[1]) return `${month(1 - progress(t, T.rewind) - 0.001)} · ${c.hud.rewinding}`;
    if (t < T.zoomOut2[1]) return c.hud.night;
    if (t < T.seal[0]) return c.hud.days[0]!;
    if (t < T.unlock[0]) return c.hud.days[Math.min(2, Math.floor(progress(t, T.seal) * 3))]!;
    if (t < T.resB[0]) return c.hud.days[3]!;
    if (t < T.lapse2[0]) return c.hud.morning2;
    return month(Math.min(0.999, progress(t, T.lapse2)));
  };

  const hud = q('.hud');
  let mode = '';
  const frame = (t: number) => {
    // ---- the camera
    const z = reducedMotion() ? 0 : kf(t, [[T.zoomIn1[0], 0], [T.zoomIn1[1], 1], [T.zoomOut1[0], 1], [T.zoomOut1[1], 0], [T.zoomIn2[0], 0], [T.zoomIn2[1], 1], [T.zoomOut2[0], 1], [T.zoomOut2[1], 0]]);
    const blue = reducedMotion()
      ? (within(t, [T.zoomIn1[1], T.zoomOut1[0]]) || within(t, [T.zoomIn2[1], T.zoomOut2[0]]) ? 1 : 0)
      : clamp((z - 0.7) / 0.22);
    const drift = kf(t, [[T.zoomOut2[1], 1], [T.lapse2[1], 1.1], [T.beatE[1], 1]], linear);
    crowd.el.style.transform = `scale(${(Math.pow(zoom, z) * drift).toFixed(4)})`;
    crowd.el.style.visibility = blue >= 1 ? 'hidden' : 'visible';
    inside.style.opacity = blue.toFixed(3);
    // The opening shows the whole wall; the scrim arrives with the first caption.
    scrim.style.opacity = ((1 - blue) * kf(t, [[0.05, 0.3], [0.5, 1]])).toFixed(3);
    root.classList.toggle('blue', blue > 0.5);
    hud.classList.toggle('lapse', within(t, [T.lapse1[0], T.rewind[1]]) || t >= T.lapse2[0]);

    // ---- the wall's own channels
    const fade = kf(t, [[0, 1], [T.flipA[1] + 0.05, 1], [T.beats[0][0] + 0.1, 0.26], [T.flipBack[0], 0.26], [T.flipBack[0] + 0.25, 1],
      [T.beatQ[0] - 0.1, 1], [T.beatQ[0] + 0.15, 0.14], [T.rewind[0], 0.14], [T.rewind[0] + 0.3, 1],
      [T.beatE[0] - 0.1, 1], [T.beatE[0] + 0.25, 0.3], [T.end, 0.3]]);
    const equal = kf(t, [[T.equal[0], 0], [T.equal[1], 1]]);
    const mixedUp = reducedMotion() ? 0 : kf(t, [[T.shuffle[0], 0], [T.shuffle[1], 1]]);
    crowd.el.style.setProperty('--fade', fade.toFixed(3));
    crowd.el.style.setProperty('--you', (1 - equal).toFixed(3));
    crowd.el.style.setProperty('--sh', mixedUp.toFixed(4));
    crowd.el.style.setProperty('--label', (1 - clamp(z * 5)).toFixed(3));
    crowd.el.classList.toggle('hosp', t >= T.rewind[0]);

    const turned = kf(t, [[T.flipA[0], 0], [T.flipA[1], 1], [T.flipBack[0], 1], [T.flipBack[1], 0], [T.unlock[0], 0], [T.unlock[1], 1]], linear);
    const second = t >= T.rewind[0];
    const gone = Math.round(kf(t, [[T.leaveA[0], 0], [T.leaveA[1], 3], [T.leaveB[0], 3], [T.leaveB[1], 11], [T.rewind[0], 11], [T.rewind[1], 0]], linear));
    const wiped = kf(t, [[T.blank[0], 0], [T.blank[1], 1]], linear);
    const sealed = t < T.equal[1] - 0.15 ? 0 : t < T.seal[0] ? 1 : Math.round(kf(t, [[T.seal[0], 1], [T.seal[1], k]], linear));
    const ring = progress(t, T.pulse);
    const proven = t >= T.pulse[1] ? 2 : ring;
    for (const cell of crowd.cells) {
      const cl = cell.el.classList;
      cl.toggle('flip', turned > cell.r1 && (!second || cell.rank < k) && (second || !cell.you));
      cl.toggle('gone', cell.leave < gone);
      cl.toggle('blank', wiped > cell.r2 || (cell.you && second && t >= T.blank[0]));
      cl.toggle('sealed', cell.rank < sealed);
      cl.toggle('member', t >= T.pulse[0] && cell.dist < proven);
      cl.toggle('ping', ring > 0 && ring < 1 && Math.abs(cell.dist - ring) < 0.07);
    }

    // ---- what is written on the stage
    const heroOut = progress(t, T.heroOut);
    hero.style.opacity = (1 - heroOut).toFixed(3);
    hero.style.transform = `translateY(${(-90 * inOut(heroOut)).toFixed(1)}px)`;
    hint.style.opacity = (1 - clamp(t * 12)).toFixed(3);

    setCap(esc(lastAt(caps, t)));
    setHud(eb(hudAt(t)));

    const inA = within(t, T.dev1);
    const inB = within(t, T.dev2);
    device.classList.toggle('on', inA || inB);
    const next = inB || (!inA && t >= T.zoomOut1[0] + 0.5) ? 'b' : 'a';
    if (next !== mode) {
      mode = next;
      device.classList.toggle('stele', mode === 'b');
      const f = mode === 'b' ? c.formB : c.formA;
      devTitle.innerHTML = eb(f.title);
      devBadge.textContent = f.badge;
      devQ.textContent = f.q;
    }
    if (mode === 'a') {
      const fine = c.said;
      let text = '';
      if (t < T.erase[0]) text = draft.slice(0, Math.round(progress(t, T.type1) * draft.length));
      else if (t < T.erase[1]) text = draft.slice(0, Math.round((1 - inOut(progress(t, T.erase))) * draft.length));
      else text = fine.slice(0, Math.round(progress(t, T.fine) * fine.length));
      setTyped(esc(text));
      device.classList.toggle('sent', t >= T.send1);
      setSend(esc(t >= T.send1 ? c.formA.sent : c.formA.send));
      device.classList.remove('whole', 'marked', 'decided');
    } else {
      const whole = t >= T.type2[1];
      device.classList.toggle('whole', whole);
      device.classList.toggle('marked', t >= T.flags);
      device.classList.toggle('decided', t >= T.decide);
      device.classList.toggle('sent', t >= T.send2);
      setTyped(whole ? '' : esc(draft.slice(0, Math.round(progress(t, T.type2) * draft.length))));
      setSend(esc(t >= T.send2 ? c.formB.sent : c.formB.send));
    }

    thoughts.forEach((li, i) => li.classList.toggle('on', inA && t >= T.thought[i]! && t < T.erase[1] + 0.2));
    const fear = t >= T.flags - 0.2 && t < T.send2 ? 0 : t >= T.send2 && t < T.seal[0] ? 1 : t >= T.seal[0] && t < T.unlock[0] ? 2 : -1;
    fearBox.classList.toggle('on', fear >= 0);
    if (fear >= 0) {
      setFearN(`${esc(c.fear)} ${fear + 1} / 3`);
      setFear(`“${esc(c.thoughts[fear]!)}”`);
    }

    resA.classList.toggle('on', within(t, T.resA));
    resB.classList.toggle('on', within(t, T.resB));

    const b = beats.find((x) => within(t, x.r));
    beat.classList.toggle('on', Boolean(b));
    if (b) {
      beat.classList.toggle('big', Boolean(b.big));
      setBeatN(b.n ?? '');
      setBeatT(b.big ? b.t : esc(b.t));
      setBeatSrc(esc(b.src ?? ''));
    }

    const proofChip = t >= T.pulse[0] + 0.15 && t < T.shuffle[1];
    const sealChip = within(t, [T.seal[0], T.unlock[0]]);
    chip.classList.toggle('on', proofChip || sealChip);
    if (proofChip) setChip(esc(fill(c.chipProof, n, k)));
    else if (sealChip) setChip(`${esc(c.chipSeal)} <b>${sealed}</b> / ${n}`);

    root.classList.toggle('over', t >= T.end - 0.02);
  };

  return { frame, measure };
}

// ---------------------------------------------------------------- the rest of the page

function terminal() {
  const pre = document.getElementById('term')!;
  const lines = terminalLines();
  const caret = '<span class="caret"></span>';
  const paint = (done: { cls: string; text: string }[], partial = '') =>
    (pre.innerHTML = done.map((l) => `<span class="${l.cls}">${esc(l.text)}</span>`).join('\n') + (done.length ? '\n' : '') + (partial ? `<span class="cmd">${esc(partial)}</span>` : '') + caret);
  if (reducedMotion()) { paint(lines); return; }
  paint([]);
  const tl = gsap.timeline({ paused: true });
  const done: { cls: string; text: string }[] = [];
  for (const l of lines) {
    if (l.cls === 'cmd') {
      const o = { n: 0 };
      tl.to(o, { n: l.text.length, duration: l.text.length * 0.02, ease: 'none', onUpdate: () => { paint(done, l.text.slice(0, Math.round(o.n))); } }, '+=0.35');
    }
    tl.call(() => { done.push(l); paint(done); }, [], l.cls === 'cmd' ? '+=0.25' : '+=0.07');
  }
  ScrollTrigger.create({ trigger: pre, start: 'top 80%', once: true, onEnter: () => { tl.play(); } });
}

function wall(crowd: Crowd) {
  const form = document.getElementById('you-form') as HTMLFormElement;
  const input = document.getElementById('you-input') as HTMLInputElement;
  const done = document.getElementById('you-done')!;
  const cell = crowd.you.el;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim().slice(0, 64);
    if (!text) { input.focus(); return; }
    // The sentence never leaves this function: it is only drawn on a card.
    cell.querySelector('.b-user')!.textContent = text;
    cell.classList.remove('settled');
    cell.classList.add('user');
    done.classList.add('on');
    window.setTimeout(() => cell.classList.add('settled'), 2600);
  });
}

// ---------------------------------------------------------------- boot

const clock = { t: 0 };

function render(keepPlace = false) {
  const y = keepPlace ? window.scrollY : 0;
  ScrollTrigger.getAll().forEach((t) => t.kill());
  gsap.killTweensOf(clock);
  clock.t = 0;
  document.documentElement.lang = lang;
  const c = copy[lang];

  const made = crowdMarkup(c);
  app.innerHTML = template(c, made.html, made.n, made.k);
  const el = document.querySelector<HTMLElement>('.crowd')!;
  const cells: Cell[] = [...el.querySelectorAll<HTMLElement>('.cell')].map((cellEl, i) => ({ el: cellEl, ...made.meta[i]! }));
  const crowd: Crowd = { el, cells, you: cells[made.you]!, n: made.n, k: made.k, cols: made.cols, rows: made.rows };

  const film = buildFilm(c, crowd);
  film.measure();

  const stage = document.querySelector<HTMLElement>('.stage')!;
  const rail = [...document.querySelectorAll<HTMLElement>('.rail li')];
  const bar = document.querySelector<HTMLElement>('.progress i')!;
  let part = 0; // 0 film, 1 what's real, 2 you
  const lightRail = (t: number) => {
    let act = 0;
    ACT_AT.forEach((at, i) => { if (t >= at - 0.05) act = i; });
    if (part > 0) act = 5 + part;
    rail.forEach((li, i) => li.classList.toggle('on', i === act));
  };

  const tick =() => { film.frame(clock.t); lightRail(clock.t); };
  gsap.to(clock, {
    t: T.end,
    ease: 'none',
    onUpdate: tick,
    scrollTrigger: {
      trigger: '.film',
      start: 'top top',
      end: () => `+=${T.end * window.innerHeight}`,
      scrub: reducedMotion() ? true : 0.5,
      invalidateOnRefresh: true,
      onRefresh: () => { film.measure(); tick(); },
    },
  });
  tick();

  ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (s) => { bar.style.transform = `scaleX(${s.progress})`; } });
  ScrollTrigger.create({
    trigger: '#real', start: 'top 70%', end: 'bottom 55%',
    onToggle: (s) => { stage.classList.toggle('doc', s.isActive); part = s.isActive ? 1 : part === 1 ? 0 : part; lightRail(clock.t); },
  });
  ScrollTrigger.create({
    trigger: '#you', start: 'top 55%', end: 'max',
    onToggle: (s) => { stage.classList.toggle('yours', s.isActive); part = s.isActive ? 2 : part === 2 ? 1 : part; lightRail(clock.t); },
  });
  ScrollTrigger.batch('.doc-head, .doc-block, .you-in', { start: 'top 82%', once: true, onEnter: (els) => els.forEach((e) => e.classList.add('in')) });
  ScrollTrigger.create({ trigger: '.limits', start: 'top 75%', once: true, onEnter: () => document.querySelector('.limits')?.classList.add('struck') });

  const go = (top: number) => window.scrollTo({ top, behavior: reducedMotion() ? 'auto' : 'smooth' });
  const topOf = (id: string) => document.getElementById(id)!.getBoundingClientRect().top + window.scrollY;
  rail.forEach((li, i) => li.querySelector('button')!.addEventListener('click', () => {
    if (i < ACT_AT.length) go((ACT_AT[i]! + (i ? 0.05 : 0)) * window.innerHeight);
    else go(topOf(i === 6 ? 'real' : 'you'));
  }));
  document.getElementById('skip')!.addEventListener('click', () => go(topOf('real')));
  document.getElementById('lang')!.addEventListener('click', () => {
    lang = lang === 'en' ? 'tr' : 'en';
    try { localStorage.setItem('stele.lang', lang); } catch { /* storage blocked */ }
    render(true);
  });

  terminal();
  wall(crowd);
  ScrollTrigger.refresh();
  if (keepPlace) window.scrollTo(0, y);
}

let wasNarrow = narrow();
window.addEventListener('resize', () => {
  // The crowd's size depends on the width; rebuild only when it flips.
  if (wasNarrow !== narrow()) { wasNarrow = narrow(); render(true); }
});

void document.fonts.ready.then(() => render());
