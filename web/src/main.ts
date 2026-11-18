import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import './style.css';
import { copy, REAL, type Copy, type Lang } from './copy';

gsap.registerPlugin(ScrollTrigger, SplitText);

// Motion tokens (DESIGN.md §6): land, pop, shift, leave. Nothing else.
const LAND = 'expo.out';
const POP = 'back.out(1.7)';
const SHIFT = 'power4.inOut';
const LEAVE = 'expo.in';

const app = document.querySelector<HTMLDivElement>('#app')!;
const short = (h: string) => `${h.slice(0, 8)}…${h.slice(-4)}`;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Labels are upper-cased in CSS; keep brand names out of Turkish casing (MİDNİGHT).
const eb = (s: string) => esc(s).replace(/Midnight/g, '<span lang="en">Midnight</span>');

function readLang(): Lang {
  try {
    const v = localStorage.getItem('stele.lang');
    if (v === 'en' || v === 'tr') return v;
  } catch { /* storage blocked */ }
  return navigator.language.toLowerCase().startsWith('tr') ? 'tr' : 'en';
}
let lang: Lang = readLang();

const isNarrow = () => window.innerWidth < 760;

/** Deterministic shuffle, so the same cards fall silent on every visit. */
function shuffled<T>(arr: T[], seed = 7): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

// Chapter lengths in viewport heights. The field is shared by all of them.
const LEN = [4.4, 5, 3, 7, 2, 2, 2, 2.2];

// ---------------------------------------------------------------- markup

function crowd(c: Copy) {
  const cols = isNarrow() ? 6 : 16;
  const rows = isNarrow() ? 9 : 10;
  const you = 5 * cols + (cols - (isNarrow() ? 2 : 5));
  // Every voice appears once before any repeats, in a different order each
  // round, so neighbours rarely say the same thing.
  const pool: Copy['hero']['voices'] = [];
  for (let seed = 11; pool.length < cols * rows; seed += 12) pool.push(...shuffled(c.hero.voices, seed));
  let cells = '';
  for (let i = 0; i < cols * rows; i++) {
    const isYou = i === you;
    const v = pool[i]!;
    const name = c.anon.names[((i * 2654435761) >>> 9) % c.anon.names.length]!;
    const back = isYou ? '' : `<em class="sec">${esc(v.s)}</em><span>${esc(v.t)}</span><small class="who">${esc(name)}</small>`;
    cells += `<div class="cell${isYou ? ' you' : ''}"><div class="card"><div class="face front">${esc(c.hero.said)}</div><div class="face back">${back}</div></div></div>`;
  }
  return `<div class="crowd" style="--cols:${cols}">${cells}</div>`;
}

const sceneRules = (c: Copy) => `
  <div class="code">${REAL.rules.map((l) => `<span class="ln">${esc(l)}</span>`).join('')}</div>
  <div class="hash-box"><span class="eyebrow">sha-256 · ${esc(c.how.chain)}</span><div class="hash" data-hash>${REAL.rulesHash}</div></div>`;

const TREE = { root: [50, 10], mid: [[27, 44], [73, 44]], leaf: [[13, 80], [39, 80], [61, 80], [87, 80]] };
function sceneTree(c: Copy) {
  const r = TREE.root;
  const p = (a: number[], b: number[], hot = false) => `<path pathLength="1" vector-effect="non-scaling-stroke" ${hot ? 'data-hot' : ''} d="M${a[0]} ${a[1]} L${b[0]} ${b[1]}"/>`;
  const paths = [
    p(r, TREE.mid[0]!, true), p(r, TREE.mid[1]!),
    p(TREE.mid[0]!, TREE.leaf[0]!), p(TREE.mid[0]!, TREE.leaf[1]!, true),
    p(TREE.mid[1]!, TREE.leaf[2]!), p(TREE.mid[1]!, TREE.leaf[3]!),
  ].join('');
  const node = (pos: number[], cls: string, inner: string) => `<div class="node ${cls}" style="left:${pos[0]}%;top:${pos[1]}%">${inner}</div>`;
  const leaves = TREE.leaf.map((pos, i) => node(pos, `leaf${i === 3 ? ' empty' : ''}${i === 1 ? ' me' : ''}`, i === 3 ? esc(c.how.empty) : `<b>${esc(c.how.member)} ${i + 1}</b>key`)).join('');
  return `<div class="tree"><svg viewBox="0 0 100 100" preserveAspectRatio="none">${paths}</svg>
    ${node(r, 'root', '<b>root</b>on chain')}${TREE.mid.map((m) => node(m, 'mid', 'hash')).join('')}${leaves}
    <div class="proof-badge">${esc(c.how.oneOf)}</div></div>`;
}

function sceneShield(c: Copy) {
  const segs = c.how.draft
    .map((s, i) => (s.tag ? `<span class="seg flag" data-i="${i}"><em class="tag">${esc(s.tag)}</em><span class="txt">${esc(s.t)}</span><i class="ul"></i></span>` : `<span class="seg"><span class="txt">${esc(s.t)}</span></span>`))
    .join('');
  return `<p class="draft">${segs}</p><div class="sig"><i></i>NEAR AI · TEE · ${esc(c.how.steps[2]!.note)}</div>`;
}

const sceneSeal = (c: Copy) => `
  <div class="letter"><div class="msg" data-body>${esc(c.how.answers[1]!)}</div></div>
  <div class="bucket"><span class="eyebrow" data-bucket>${esc(c.how.bucket)}</span><div class="bar"><div class="fill"></div></div><span class="eyebrow">1 KB</span></div>
  <div class="chainrow"><div class="fp"><span class="eyebrow">${esc(c.how.chain)} · sha-256</span><b data-fp>&nbsp;</b></div>
  <div class="stamp"><span><b>${esc(c.how.stamp)}</b>1 / 1</span></div></div>`;

const sceneGate = (c: Copy) => `
  <div class="gate"><div class="count"><span data-count>0</span><small> / 3</small></div><span class="phase" data-phase>${esc(c.how.phaseOpen)}</span></div>
  <div class="locked" data-locked>${esc(c.how.locked)}</div>
  <ul class="answers">${c.how.answers.map((a) => `<li><span class="t">${esc(a)}</span><span class="rm">${esc(c.how.removed)}</span><i class="strike"></i></li>`).join('')}</ul>
  <div class="eyebrow" style="margin-top:14px">${esc(c.how.realRun)}</div>`;

const SCENES = [sceneRules, sceneTree, sceneShield, sceneSeal, sceneGate];

function terminalLines(): { cls: string; text: string }[] {
  return [
    { cls: 'cmd', text: '$ npm run stele -- status' },
    { cls: '', text: `Question:   demo-leaving-3  (${short(REAL.question)})` },
    { cls: '', text: 'Phase:      closed' },
    { cls: '', text: 'Visibility: asker only' },
    { cls: '', text: 'Minimum:    3 answers before any is opened' },
    { cls: '', text: 'Members:    3' },
    { cls: '', text: 'Answered:   3 (3 submissions, revisions included)' },
    { cls: '', text: 'Removed:    1 marked now, 1 ever' },
    { cls: '', text: `  ${short(REAL.removedId)}  removed: insult` },
    { cls: 'cmd', text: '$ npm run stele -- verify --rules examples/leaving.rules.json' },
    { cls: 'ok', text: '✔ Rules document matches the hash fixed in the contract' },
    { cls: 'ok', text: '✔ Minimum 3 matches the rules' },
    { cls: 'ok', text: '✔ 3 of 3 answer blobs found at the local store, each matching its on-chain digest' },
  ];
}

const label = (c: Copy, i: number) => `<div class="eyebrow">0${i + 1}  ${eb(c.chapters[i]!)}</div>`;
const chapter = (i: number, cls: string, inner: string) =>
  `<section class="chapter ${cls}" id="ch-${i}" style="--len:${LEN[i]}"><div class="sticky">${inner}</div></section>`;

function template(c: Copy) {
  const rail = c.chapters.map((n, i) => `<li data-ch="${i}"><a href="#ch-${i}"><span>0${i + 1}</span><span class="name">${eb(n)}</span></a></li>`).join('');
  return `
<header class="top">
  <a class="brand" href="#ch-0"><b>stele</b><span>${eb(c.tag)}</span></a>
  <div class="top-actions">
    <button class="pill" id="lang" aria-label="Language">${esc(c.nav.lang)}</button>
    <a class="btn" href="${REAL.repo}" target="_blank" rel="noopener">${esc(c.nav.code)}</a>
  </div>
</header>
<div class="progress"><i></i></div>
<ol class="rail">${rail}</ol>
<div class="field" aria-hidden="true">${crowd(c)}</div>
<main>
${chapter(0, 'ch-hero', `
  <div class="text">
    ${label(c, 0)}
    <h1 class="hero-title">${c.hero.title.map((l) => `<span class="line"><span>${esc(l)}</span></span>`).join('')}</h1>
    <p class="hero-sub">${esc(c.hero.sub)}</p>
  </div>
  <div class="scroll-hint eyebrow"><span>${esc(c.hero.scroll)}</span><i></i></div>
  <div class="beat b1">${esc(c.hero.beat1)}</div>
  <div class="beat b2">${esc(c.hero.beat2)}</div>
  <div class="beat b3">${esc(c.hero.you)}</div>`)}
${chapter(1, 'ch-cost', `
  <div class="text">
    ${label(c, 1)}
    <h2 class="title split">${esc(c.cost.title)}</h2>
    <p class="body">${esc(c.cost.body)}</p>
    <ol class="fears">${c.cost.rows.map((r) => `<li><span class="k">${esc(r.k)}</span><span class="line">${esc(r.line)}</span><span class="q">${esc(r.q)}</span></li>`).join('')}</ol>
  </div>
  <div class="evidence">
    <div class="panel stat" id="stat">
      ${c.cost.rows.map((r) => `<div class="stat-card"><div class="stat-n">${esc(r.n)}</div><p class="stat-d">${esc(r.d)}</p><span class="eyebrow">${esc(r.src)}</span></div>`).join('')}
    </div>
    <p class="cost-after">${esc(c.cost.after)} <cite>${esc(c.cost.afterSrc)}</cite></p>
  </div>`)}
${chapter(2, 'ch-anon', `
  <div class="text">
    ${label(c, 2)}
    <h2 class="title split">${esc(c.anon.title)}</h2>
    <ol class="points">${c.anon.points.map((p, i) => `<li><b>0${i + 1}</b><span>${esc(p.t)}<cite>${esc(p.cite)}</cite></span></li>`).join('')}</ol>
    <p class="fix">${esc(c.anon.fix)}</p>
  </div>
  <div class="evidence"><div class="panel specimen" id="specimen">
    <div class="lab"><span class="eyebrow">${esc(c.anon.specimen.label)}</span><span class="eyebrow">GLM 5.3 Flash</span></div>
    <p class="draft" data-txt></p>
    <div class="sig"><i></i>${esc(c.anon.specimen.receipt)}</div>
  </div></div>`)}
${chapter(3, 'ch-how', `
  <div class="text">
    ${label(c, 3)}
    <div class="steps">${c.how.steps.map((s) => `<div class="t"><h2 class="title">${esc(s.title)}</h2><p class="body">${esc(s.body)}</p></div>`).join('')}</div>
    <div class="dots">${c.how.steps.map(() => '<i></i>').join('')}</div>
  </div>
  <div class="evidence"><div class="panel stage">
    ${SCENES.map((_, i) => `<div class="scene" data-scene="${i}"></div>`).join('')}
    <div class="stage-foot"><span class="eyebrow note" data-note></span><span class="eyebrow" data-idx>01 / 05</span></div>
  </div></div>`)}
${chapter(4, 'ch-sees', `
  <div class="text">
    ${label(c, 4)}
    <h2 class="title split">${esc(c.sees.title)}</h2>
    <p class="body">${esc(c.sees.body)}</p>
  </div>
  <div class="evidence"><div class="panel sees">
    <div class="sees-head"><span></span><span>${esc(c.sees.cols[0]!)}</span><span>${esc(c.sees.cols[1]!)}</span></div>
    ${c.sees.rows.map((r) => `<div class="sees-row"><span class="who">${esc(r.who)}</span><span class="s">${esc(r.sees)}</span><span class="nv">${esc(r.never)}</span></div>`).join('')}
  </div></div>`)}
${chapter(5, 'ch-verify', `
  <div class="text">
    ${label(c, 5)}
    <h2 class="title split">${esc(c.verify.title)}</h2>
    <p class="body">${esc(c.verify.body)}</p>
  </div>
  <div class="evidence"><div class="panel term"><div class="term-bar"><i></i><i></i><i></i></div><pre id="term"><span class="caret"></span></pre></div></div>`)}
${chapter(6, 'ch-limits', `
  <div class="text">
    ${label(c, 6)}
    <h2 class="title split">${esc(c.limits.title)}</h2>
    <p class="body">${esc(c.limits.body)}</p>
  </div>
  <div class="evidence"><div class="panel limits">${c.limits.rows.map((r) => `<div class="limit"><span class="no">${esc(r.no)}<i></i></span><span class="yes">${esc(r.yes)}</span></div>`).join('')}</div></div>`)}
${chapter(7, 'ch-end', `
  <div class="text">
    ${label(c, 7)}
    <h2 class="title split">${esc(c.end.title)}</h2>
    <div class="end-row">
      <a class="btn" href="${REAL.repo}" target="_blank" rel="noopener">${esc(c.end.code)} <span aria-hidden="true">→</span></a>
      <span class="status"><i></i>${eb(c.end.status)}</span>
    </div>
  </div>
  <div class="foot"><span>${esc(c.end.foot)}</span><span class="mono">stele v0.2.0</span></div>`)}
</main>`;
}

// ---------------------------------------------------------------- helpers

const HEX = '0123456789abcdef';
const rand = (n: number, set = HEX) => Array.from({ length: n }, () => set[(Math.random() * set.length) | 0]).join('');

/** Resolves `target` out of noise, left to right. */
function scramble(el: HTMLElement, target: string, duration: number, set = HEX) {
  const o = { p: 0 };
  return gsap.to(o, {
    p: 1,
    duration,
    ease: 'none',
    onUpdate: () => {
      const n = Math.floor(o.p * target.length);
      el.textContent = target.slice(0, n) + rand(target.length - n, set);
    },
    onComplete: () => { el.textContent = target; },
  });
}

async function sha256Hex(text: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------- stage scenes

type SceneBuild = (root: HTMLElement, c: Copy) => gsap.core.Timeline;

const buildRules: SceneBuild = (root) => {
  const tl = gsap.timeline();
  const hash = root.querySelector<HTMLElement>('[data-hash]')!;
  tl.from(root.querySelectorAll('.ln'), { x: -24, autoAlpha: 0, duration: 0.5, ease: LAND, stagger: 0.05 })
    .from(root.querySelector('.hash-box'), { y: 24, autoAlpha: 0, scale: 0.96, duration: 0.6, ease: POP }, '+=0.2')
    .add(scramble(hash, REAL.rulesHash, 1.1), '<')
    .to(root.querySelectorAll('.ln'), { color: '#5a5a5a', duration: 0.6, ease: SHIFT }, '-=0.3');
  return tl;
};

const buildTree: SceneBuild = (root) => {
  const tl = gsap.timeline();
  const paths = root.querySelectorAll<SVGPathElement>('path');
  gsap.set(paths, { strokeDasharray: 1, strokeDashoffset: 1 });
  tl.from(root.querySelectorAll('.leaf'), { scale: 0, autoAlpha: 0, duration: 0.5, ease: POP, stagger: 0.08 })
    .to([...paths].reverse(), { strokeDashoffset: 0, duration: 0.45, ease: LAND, stagger: 0.06 }, '-=0.1')
    .from(root.querySelectorAll('.mid'), { scale: 0, autoAlpha: 0, duration: 0.45, ease: POP, stagger: 0.08 }, '-=0.35')
    .from(root.querySelector('.root'), { scale: 0, autoAlpha: 0, duration: 0.5, ease: POP }, '-=0.15')
    .call(() => {
      root.querySelectorAll('path[data-hot]').forEach((p) => p.classList.add('hot'));
      root.querySelector('.leaf.me')?.classList.add('hot');
    }, [], '+=0.35')
    .to(root.querySelectorAll('.leaf:not(.empty)'), { filter: 'blur(5px)', duration: 0.6, ease: SHIFT }, '+=0.6')
    .from(root.querySelector('.proof-badge'), { y: 20, autoAlpha: 0, scale: 0.9, duration: 0.5, ease: POP }, '-=0.2');
  return tl;
};

const buildShield: SceneBuild = (root, c) => {
  const tl = gsap.timeline();
  const flags = [...root.querySelectorAll<HTMLElement>('.seg.flag')];
  tl.from(root.querySelector('.draft'), { y: 24, autoAlpha: 0, duration: 0.6, ease: LAND });
  flags.forEach((f, k) => {
    tl.to(f.querySelector('.ul'), { scaleX: 1, duration: 0.35, ease: LAND }, k === 0 ? '+=0.4' : '+=0.15')
      .to(f.querySelector('.txt'), { backgroundColor: 'rgba(0, 0, 254, 0.24)', color: '#ffffff', duration: 0.35, ease: LAND }, '<')
      .fromTo(f.querySelector('.tag'), { y: 8, autoAlpha: 0, scale: 0.8 }, { y: 0, autoAlpha: 1, scale: 1, duration: 0.4, ease: POP }, '<0.1');
  });
  tl.addLabel('swap', '+=0.9');
  flags.forEach((f, k) => {
    const seg = c.how.draft[Number(f.dataset['i'])]!;
    const txt = f.querySelector<HTMLElement>('.txt')!;
    const at = `swap+=${k * 0.35}`;
    tl.to([txt, f.querySelector('.tag')], { autoAlpha: 0, duration: 0.22, ease: LEAVE }, at)
      .to(f.querySelector('.ul'), { scaleX: 0, transformOrigin: 'right', duration: 0.3, ease: LEAVE }, at)
      .call(() => {
        txt.textContent = seg.to ?? '';
        f.classList.add('done');
        txt.style.backgroundColor = 'transparent';
        if (!seg.to) f.style.display = 'none';
      }, [], `${at}+=0.24`)
      .fromTo(txt, { autoAlpha: 0, color: '#5c6bff' }, { autoAlpha: 1, color: '#ffffff', duration: 0.5, ease: LAND, immediateRender: false }, `${at}+=0.26`);
  });
  tl.from(root.querySelector('.sig'), { y: 16, autoAlpha: 0, duration: 0.5, ease: POP }, '+=0.3');
  return tl;
};

const buildSeal: SceneBuild = (root, c) => {
  const tl = gsap.timeline();
  const body = root.querySelector<HTMLElement>('[data-body]')!;
  const lab = root.querySelector<HTMLElement>('[data-bucket]')!;
  const fp = root.querySelector<HTMLElement>('[data-fp]')!;
  const sealed = rand(Math.max(96, c.how.answers[1]!.length * 2));
  tl.from(root.querySelector('.letter'), { y: 24, autoAlpha: 0, duration: 0.5, ease: LAND })
    .from(root.querySelectorAll('.bucket, .chainrow'), { y: 16, autoAlpha: 0, duration: 0.5, ease: LAND, stagger: 0.1 }, '-=0.2')
    .to(root.querySelector('.fill'), { scaleX: 1, duration: 1, ease: SHIFT }, '+=0.3')
    .call(() => { lab.textContent = c.how.sealed; body.classList.add('mono'); }, [], '+=0.1')
    .add(() => { scramble(body, sealed, 0.9); }, '<')
    .to(body, { color: '#9e9e9e', duration: 0.6 }, '<')
    .call(() => { void sha256Hex(sealed).then((h) => { scramble(fp, h, 0.8); }); }, [], '+=0.9')
    .from(root.querySelector('.stamp'), { scale: 2.2, autoAlpha: 0, rotate: -40, duration: 0.55, ease: POP }, '+=0.7');
  return tl;
};

const buildGate: SceneBuild = (root, c) => {
  const tl = gsap.timeline();
  const count = root.querySelector<HTMLElement>('[data-count]')!;
  const phase = root.querySelector<HTMLElement>('[data-phase]')!;
  const items = [...root.querySelectorAll<HTMLElement>('.answers li')];
  gsap.set(items, { autoAlpha: 0, y: 16 });
  tl.from(root.querySelector('.gate'), { y: 20, autoAlpha: 0, duration: 0.5, ease: LAND });
  [1, 2, 3].forEach((n) => {
    tl.call(() => { count.textContent = String(n); }, [], '+=0.45')
      .fromTo(count, { scale: 1.25 }, { scale: 1, duration: 0.4, ease: POP, transformOrigin: 'left bottom', immediateRender: false });
  });
  tl.call(() => { phase.textContent = c.how.phaseClosed; phase.classList.add('closed'); }, [], '+=0.5')
    .fromTo(phase, { scale: 1.2 }, { scale: 1, duration: 0.4, ease: POP, immediateRender: false })
    .to(root.querySelector('[data-locked]'), { autoAlpha: 0, height: 0, marginBottom: 0, duration: 0.35, ease: LEAVE }, '<')
    .to(items, { autoAlpha: 1, y: 0, duration: 0.5, ease: LAND, stagger: 0.12 })
    .to(items[2]!.querySelector('.strike'), { scaleX: 1, duration: 0.45, ease: SHIFT }, '+=0.8')
    .call(() => { items[2]!.classList.add('removed'); }, [], '+=0.15')
    .fromTo(items[2]!.querySelector('.rm'), { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: LAND, immediateRender: false });
  return tl;
};

const BUILDERS: SceneBuild[] = [buildRules, buildTree, buildShield, buildSeal, buildGate];

// ---------------------------------------------------------------- the field
//
// One set of cards for the whole story. Every chapter's timeline moves it from
// the state the previous chapter left it in, with explicit from and to values,
// so scrolling back and forth always lands on the same picture:
//   01 everyone says "I'm fine" → the cards turn: what they really think →
//      one card is you → the camera dives into it
//   02 back out → under each fear a group turns back to "I'm fine"
//   03 everyone answers again, but a name sits under every answer
//   04-07 the names blur away; the crowd stays behind the evidence
//   08 the crowd comes back: honest answers, no names

type Field = { crowd: HTMLElement; cards: HTMLElement[]; you: HTMLElement; youCard: HTMLElement; groups: HTMLElement[][] };

function getField(): Field {
  const crowdEl = document.querySelector<HTMLElement>('.crowd')!;
  const you = crowdEl.querySelector<HTMLElement>('.cell.you')!;
  const cards = gsap.utils.toArray<HTMLElement>('.cell:not(.you) .card');
  const mixed = shuffled(cards);
  const n = Math.ceil(mixed.length / 4);
  const groups = [0, 1, 2, 3].map((g) => mixed.slice(g * n, (g + 1) * n));
  return { crowd: crowdEl, cards, you, youCard: you.querySelector<HTMLElement>('.card')!, groups };
}

// The whole story runs on ONE timeline scrubbed by the whole page, measured in
// viewport heights: time 4.4 is the moment the page has scrolled 4.4 screens.
// Separate timelines per chapter fought over the same cards whenever someone
// jumped (rail links, reload mid-page); one timeline always renders in order.
const START = LEN.map((_, i) => LEN.slice(0, i).reduce((a, b) => a + b, 0));
const SPAN = LEN.reduce((a, b) => a + b, 0) - 1;
/** Fear k turns its group of cards back at this scroll position (in screens). */
const fearAt = (k: number) => START[1]! + 0.4 + k * 0.8;

function story(f: Field) {
  const zoom = () => (window.innerWidth / f.you.offsetWidth) * 1.6;
  const origin = () => `${f.you.offsetLeft + f.you.offsetWidth / 2}px ${f.you.offsetTop + f.you.offsetHeight / 2}px`;
  const b3 = SplitText.create('.b3', { type: 'words' });
  const fx = { immediateRender: false };
  // How bright the crowd is, how visible the names are and how blurred: tweened
  // on a plain object and written to CSS variables on every frame. Tweening the
  // variables directly lost their start values when scrubbed backwards.
  const P = { fade: 1, who: 0, blur: 0 };
  const paint = () => {
    f.crowd.style.setProperty('--fade', P.fade.toFixed(3));
    f.crowd.style.setProperty('--who', P.who.toFixed(3));
    f.crowd.style.setProperty('--whoblur', `${P.blur.toFixed(2)}px`);
  };
  paint();
  const tl = gsap.timeline({
    defaults: { ease: SHIFT },
    onUpdate: paint,
    scrollTrigger: { trigger: 'main', start: 'top top', end: 'bottom bottom', scrub: 0.6, invalidateOnRefresh: true },
  });

  // 01 the question: everyone says "I'm fine"; the cards turn; one is you.
  tl.to('.ch-hero .text', { y: -140, autoAlpha: 0, duration: 0.45 }, 0.001)
    .to('.scroll-hint', { autoAlpha: 0, duration: 0.15 }, 0.001)
    .to(f.cards, { rotateX: 180, duration: 0.3, stagger: { amount: 1.05, from: 'random' } }, 0.2)
    .fromTo('.b1', { autoAlpha: 0, y: 50 }, { autoAlpha: 1, y: 0, duration: 0.25, ease: LAND, ...fx }, 0.65)
    .to('.b1', { autoAlpha: 0, y: -50, duration: 0.2, ease: LEAVE }, 1.2)
    .to(P, { fade: 0.12, duration: 0.3 }, 1.25)
    .fromTo('.b2', { autoAlpha: 0, y: 50 }, { autoAlpha: 1, y: 0, duration: 0.25, ease: LAND, ...fx }, 1.35)
    .to('.b2', { autoAlpha: 0, y: -50, duration: 0.2, ease: LEAVE }, 1.75)
    .set(f.crowd, { transformOrigin: origin }, 1.78)
    .to(f.crowd, { scale: zoom, duration: 0.75 }, 1.8)
    .to(f.youCard, { rotateX: 180, duration: 0.4 }, 1.8)
    .set('.b3', { autoAlpha: 1 }, 2.5)
    .from(b3.words, { yPercent: 60, autoAlpha: 0, duration: 0.25, ease: LAND, stagger: 0.025 }, 2.5);

  // 02 the price: back out of the blue card; under each fear a group goes quiet.
  // Plain .to tweens on one timeline: each picks up where the last one left
  // the card, in order, however far the reader jumps.
  const s1 = START[1]! - 1;
  tl.to(f.crowd, { scale: 1, duration: 0.5 }, s1)
    .to(P, { fade: 1, duration: 0.4 }, s1 + 0.1)
    .to(f.youCard, { rotateX: 0, duration: 0.25 }, s1 + 0.45);
  f.groups.forEach((g, k) => {
    tl.to(g, { rotateX: 0, duration: 0.3, stagger: { amount: 0.25, from: 'random' } }, fearAt(k));
  });
  tl.fromTo('.cost-after', { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.2, ease: LAND, ...fx }, fearAt(3) + 0.7)
    .to(P, { fade: 0.45, duration: 0.3 }, fearAt(3) + 0.8);

  // 03 anonymous forms: everyone answers again, and a name sits under each answer.
  const s2 = START[2]! - 1;
  tl.to([...f.cards, f.youCard], { rotateX: 180, duration: 0.3, stagger: { amount: 0.45, from: 'random' } }, s2)
    .to(P, { fade: 0.8, duration: 0.3 }, s2 + 0.2)
    .to(P, { who: 1, duration: 0.35, ease: LAND }, s2 + 1.1);

  // 04-07: Stele takes the names away; the crowd stays, quiet, and the camera
  // keeps pushing in so the room never freezes.
  const s3 = START[3]! - 1;
  const s7 = START[7]! - 1;
  tl.to(P, { blur: 8, duration: 0.4 }, s3)
    .to(P, { who: 0, duration: 0.4 }, s3 + 0.2)
    .to(P, { fade: 0.18, duration: 0.4 }, s3 + 0.3)
    .to(f.crowd, { scale: 1.14, duration: s7 - (s3 + 0.3), ease: 'none' }, s3 + 0.3);

  // 08 the last word: the crowd comes back, honest and nameless.
  tl.to(f.crowd, { scale: 1, duration: 1 }, s7)
    .to(P, { fade: 0.75, duration: 1 }, s7)
    .set({}, {}, SPAN);

  // Which fear is lit follows the same clock.
  // Which fear is lit, and which number stands next to it, follow the same clock.
  const rows = gsap.utils.toArray<HTMLElement>('.fears li');
  const stats = gsap.utils.toArray<HTMLElement>('.stat-card');
  const light = () => {
    const at = window.scrollY / window.innerHeight;
    let k = -1;
    for (let i = 0; i < 4; i++) if (at >= fearAt(i) - 0.15) k = i;
    rows.forEach((r, i) => r.classList.toggle('on', i === k));
    stats.forEach((s, i) => s.classList.toggle('on', i === k));
    document.getElementById('stat')?.classList.toggle('live', k >= 0);
  };
  ScrollTrigger.create({ trigger: '#ch-1', start: 'top bottom', end: 'bottom bottom', onUpdate: light, onRefresh: light });
}

// ---------------------------------------------------------------- chapter UI

function rail() {
  const items = gsap.utils.toArray<HTMLElement>('.rail li');
  LEN.forEach((_, i) => {
    ScrollTrigger.create({
      trigger: `#ch-${i}`,
      start: 'top center',
      end: 'bottom center',
      onToggle: (s) => { if (s.isActive) items.forEach((li, k) => li.classList.toggle('on', k === i)); },
    });
  });
  items[0]?.classList.add('on');
  const bar = document.querySelector('.progress i');
  ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (s) => gsap.set(bar, { scaleX: s.progress }) });
  document.getElementById('lang')!.addEventListener('click', () => {
    lang = lang === 'en' ? 'tr' : 'en';
    try { localStorage.setItem('stele.lang', lang); } catch { /* storage blocked */ }
    render(true);
  });
}

function heroIntro() {
  gsap.timeline({ defaults: { ease: LAND } })
    .from('.cell', { scale: 0.4, autoAlpha: 0, duration: 0.7, stagger: { each: 0.004, from: 'random' } })
    .from('.ch-hero .eyebrow', { y: 14, autoAlpha: 0, duration: 0.5 }, 0.25)
    .from('.hero-title .line > span', { yPercent: 110, duration: 1, stagger: 0.1 }, 0.3)
    .from('.hero-sub', { y: 20, autoAlpha: 0, duration: 0.7 }, 0.75)
    .from('.scroll-hint', { autoAlpha: 0, duration: 0.6 }, 1);
}

function headings() {
  gsap.utils.toArray<HTMLElement>('.split').forEach((el) => {
    const s = SplitText.create(el, { type: 'lines,words', mask: 'lines' });
    gsap.from(s.words, { yPercent: 110, duration: 0.9, ease: LAND, stagger: 0.025, scrollTrigger: { trigger: el.closest('.chapter')!, start: 'top 60%', toggleActions: 'play none none reverse' } });
  });
  // Every chapter's left column and evidence arrive the same way.
  gsap.utils.toArray<HTMLElement>('.chapter:not(.ch-hero)').forEach((ch) => {
    const parts = ch.querySelectorAll('.text > .eyebrow, .text > .body, .fears, .points, .fix, .dots, .evidence, .end-row');
    gsap.from(parts, { y: 36, autoAlpha: 0, duration: 0.8, ease: LAND, stagger: 0.08, scrollTrigger: { trigger: ch, start: 'top 55%', toggleActions: 'play none none reverse' } });
  });
}

/**
 * The real shield run on a nurse's answer, replayed: the enclave marks what
 * points to the writer, the writer generalizes the ward and keeps the number,
 * because the number is the complaint.
 */
function specimen(c: Copy) {
  const sp = c.anon.specimen;
  const box = document.getElementById('specimen')!;
  const txt = box.querySelector<HTMLElement>('[data-txt]')!;
  const sig = box.querySelector<HTMLElement>('.sig')!;
  let active = false;
  let tl: gsap.core.Timeline | null = null;

  const once = () => {
    txt.innerHTML = sp.segments
      .map((s, i) => (s.tag
        ? `<span class="seg flag${s.keep ? ' keep' : ''}" data-i="${i}"><em class="tag">${esc(s.tag)}</em><span class="txt">${esc(s.t)}</span><i class="ul"></i><b class="decision">${esc(s.keep ? sp.kept : sp.generalized)}</b></span>`
        : `<span class="seg"><span class="txt">${esc(s.t)}</span></span>`))
      .join('');
    const flags = [...txt.querySelectorAll<HTMLElement>('.seg.flag')];
    tl = gsap.timeline({ onComplete: () => { if (active) gsap.delayedCall(2.6, once); } });
    tl.fromTo(txt, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: LAND })
      .set(sig, { autoAlpha: 0 });
    flags.forEach((f, k) => {
      tl!.to(f.querySelector('.ul'), { scaleX: 1, duration: 0.35, ease: LAND }, k === 0 ? '+=0.6' : '+=0.2')
        .to(f.querySelector('.txt'), { backgroundColor: 'rgba(0, 0, 254, 0.24)', color: '#ffffff', duration: 0.35, ease: LAND }, '<')
        .fromTo(f.querySelector('.tag'), { y: 8, autoAlpha: 0, scale: 0.8 }, { y: 0, autoAlpha: 1, scale: 1, duration: 0.4, ease: POP }, '<0.1');
    });
    tl.addLabel('decide', '+=1');
    flags.forEach((f, k) => {
      const seg = sp.segments[Number(f.dataset['i'])]!;
      const t = f.querySelector<HTMLElement>('.txt')!;
      const at = `decide+=${k * 0.6}`;
      tl!.fromTo(f.querySelector('.decision'), { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: POP, immediateRender: false }, at);
      if (seg.keep) return;
      tl!.to([t, f.querySelector('.tag')], { autoAlpha: 0, duration: 0.22, ease: LEAVE }, `${at}+=0.5`)
        .to(f.querySelector('.ul'), { scaleX: 0, transformOrigin: 'right', duration: 0.3, ease: LEAVE }, `${at}+=0.5`)
        .call(() => { t.textContent = seg.to ?? ''; t.style.backgroundColor = 'transparent'; f.classList.add('done'); }, [], `${at}+=0.74`)
        .fromTo(t, { autoAlpha: 0, color: '#5c6bff' }, { autoAlpha: 1, color: '#ffffff', duration: 0.5, ease: LAND, immediateRender: false }, `${at}+=0.76`);
    });
    tl.fromTo(sig, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: POP, immediateRender: false }, '+=0.4')
      .to({}, { duration: 3 });
  };

  ScrollTrigger.create({
    trigger: '#ch-2',
    start: 'top center',
    end: 'bottom top',
    onToggle: (s) => {
      active = s.isActive;
      if (active && !tl?.isActive()) once();
    },
  });
}

function stepper(c: Copy, reduced: boolean) {
  const n = c.how.steps.length;
  const texts = gsap.utils.toArray<HTMLElement>('.steps .t');
  const dots = gsap.utils.toArray<HTMLElement>('.dots i');
  const scenes = gsap.utils.toArray<HTMLElement>('.scene');
  const note = document.querySelector<HTMLElement>('[data-note]')!;
  const idx = document.querySelector<HTMLElement>('[data-idx]')!;
  gsap.set(texts, { autoAlpha: 0 });
  let current = -1;
  let running: gsap.core.Timeline | null = null;

  const show = (i: number) => {
    if (i === current) return;
    const prev = current;
    current = i;
    if (prev >= 0) {
      gsap.to(texts[prev]!, { y: -24, autoAlpha: 0, duration: 0.25, ease: LEAVE, overwrite: true });
      gsap.to(scenes[prev]!, { autoAlpha: 0, duration: 0.25, ease: LEAVE, overwrite: true });
    }
    running?.kill();
    gsap.fromTo(texts[i]!, { y: 28, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, ease: LAND, delay: prev >= 0 ? 0.18 : 0, overwrite: true });
    dots.forEach((d, k) => d.classList.toggle('on', k === i));
    note.textContent = c.how.steps[i]!.note;
    idx.textContent = `0${i + 1} / 0${n}`;
    const scene = scenes[i]!;
    scene.innerHTML = SCENES[i]!(c);
    gsap.fromTo(scene, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, ease: LAND, delay: prev >= 0 ? 0.15 : 0, overwrite: true });
    running = BUILDERS[i]!(scene, c);
    if (reduced) running.progress(1);
    else running.delay(prev >= 0 ? 0.25 : 0.1);
  };

  show(0);
  ScrollTrigger.create({
    trigger: '#ch-3',
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (s) => show(Math.min(n - 1, Math.floor(s.progress * n))),
  });
}

function terminal(reduced: boolean) {
  const pre = document.getElementById('term')!;
  const lines = terminalLines();
  const caret = '<span class="caret"></span>';
  const paint = (done: { cls: string; text: string }[], partial = '') =>
    (pre.innerHTML = done.map((l) => `<span class="${l.cls}">${esc(l.text)}</span>`).join('\n') + (done.length ? '\n' : '') + (partial ? `<span class="cmd">${esc(partial)}</span>` : '') + caret);
  if (reduced) { paint(lines); return; }
  const tl = gsap.timeline({ paused: true });
  const done: { cls: string; text: string }[] = [];
  for (const l of lines) {
    if (l.cls === 'cmd') {
      const o = { n: 0 };
      tl.to(o, { n: l.text.length, duration: l.text.length * 0.022, ease: 'none', onUpdate: () => { paint(done, l.text.slice(0, Math.round(o.n))); } }, '+=0.35');
    }
    tl.call(() => { done.push(l); paint(done); }, [], l.cls === 'cmd' ? '+=0.25' : '+=0.07');
  }
  ScrollTrigger.create({ trigger: '#ch-5', start: 'top 40%', once: true, onEnter: () => { tl.play(); } });
}

function limits() {
  const strikes = gsap.utils.toArray<HTMLElement>('.limit .no i');
  gsap.to(strikes, { scaleX: 1, duration: 0.45, ease: SHIFT, stagger: 0.12, scrollTrigger: { trigger: '#ch-6', start: 'top 30%', toggleActions: 'play none none reverse' } });
}

// ---------------------------------------------------------------- boot

let mm: gsap.MatchMedia | null = null;

function render(keepPlace = false) {
  const y = keepPlace ? window.scrollY : 0;
  mm?.revert();
  ScrollTrigger.getAll().forEach((t) => t.kill());
  document.documentElement.lang = lang;
  const c = copy[lang];
  app.innerHTML = template(c);
  mm = gsap.matchMedia();
  mm.add({ reduced: '(prefers-reduced-motion: reduce)', full: '(prefers-reduced-motion: no-preference)' }, (m) => {
    const reduced = Boolean(m.conditions?.['reduced']);
    const f = getField();
    rail();
    if (reduced) {
      gsap.set(f.crowd, { '--fade': '0.25' });
    } else {
      heroIntro();
      story(f);
      headings();
      specimen(c);
      limits();
    }
    stepper(c, reduced);
    terminal(reduced);
  });
  ScrollTrigger.refresh();
  if (keepPlace) window.scrollTo(0, y);
}

let width = window.innerWidth;
window.addEventListener('resize', () => {
  // The crowd's column count depends on the width; rebuild only when it flips.
  const was = width < 760;
  width = window.innerWidth;
  if (was !== width < 760) render(true);
});

void document.fonts.ready.then(() => render());
