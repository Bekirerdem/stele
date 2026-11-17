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

// ---------------------------------------------------------------- markup

const isNarrow = () => window.innerWidth < 760;

function crowd(c: Copy) {
  const cols = isNarrow() ? 6 : 16;
  const rows = isNarrow() ? 9 : 10;
  const you = 5 * cols + (cols - (isNarrow() ? 2 : 5));
  let cells = '';
  for (let i = 0; i < cols * rows; i++) {
    const back = i === you ? '' : c.hero.thoughts[(i * 7 + (i >> 3)) % c.hero.thoughts.length]!;
    cells += `<div class="cell${i === you ? ' you' : ''}"><div class="card"><div class="face front">${esc(c.hero.said)}</div><div class="face back">${esc(back)}</div></div></div>`;
  }
  return `<div class="crowd" style="--cols:${cols}">${cells}</div>`;
}

const sceneRules = (c: Copy) => `
  <div class="code">${REAL.rules.map((l) => `<span class="ln">${esc(l)}</span>`).join('')}</div>
  <div class="hash-box"><span class="eyebrow">sha-256 · ${esc(c.how.chain)}</span><div class="hash" data-hash>${REAL.rulesHash}</div></div>`;

const TREE = {
  root: [50, 10],
  mid: [[27, 44], [73, 44]],
  leaf: [[13, 80], [39, 80], [61, 80], [87, 80]],
};
function sceneTree(c: Copy) {
  const [rx, ry] = TREE.root;
  const p = (a: number[], b: number[], hot = false) => `<path pathLength="1" vector-effect="non-scaling-stroke" ${hot ? 'data-hot' : ''} d="M${a[0]} ${a[1]} L${b[0]} ${b[1]}"/>`;
  const paths = [
    p([rx!, ry!], TREE.mid[0]!, true), p([rx!, ry!], TREE.mid[1]!),
    p(TREE.mid[0]!, TREE.leaf[0]!), p(TREE.mid[0]!, TREE.leaf[1]!, true),
    p(TREE.mid[1]!, TREE.leaf[2]!), p(TREE.mid[1]!, TREE.leaf[3]!),
  ].join('');
  const node = (pos: number[], cls: string, inner: string) => `<div class="node ${cls}" style="left:${pos[0]}%;top:${pos[1]}%">${inner}</div>`;
  const leaves = TREE.leaf.map((pos, i) => node(pos, `leaf${i === 3 ? ' empty' : ''}${i === 1 ? ' me' : ''}`, i === 3 ? c.how.empty : `<b>${c.how.member} ${i + 1}</b>key`)).join('');
  return `<div class="tree"><svg viewBox="0 0 100 100" preserveAspectRatio="none">${paths}</svg>
    ${node(TREE.root, 'root', '<b>root</b>on chain')}${TREE.mid.map((m) => node(m, 'mid', 'hash')).join('')}${leaves}
    <div class="proof-badge">${esc(c.how.oneOf)}</div></div>`;
}

function sceneShield(c: Copy) {
  const segs = c.how.draft
    .map((s, i) => (s.tag ? `<span class="seg flag" data-i="${i}"><em class="tag">${esc(s.tag)}</em><span class="txt">${esc(s.t)}</span><i class="ul"></i></span>` : `<span class="seg"><span class="txt">${esc(s.t)}</span></span>`))
    .join('');
  return `<p class="draft">${segs}</p><div class="sig"><i></i>NEAR AI · TEE · ${esc(c.how.steps[2]!.note)}</div>`;
}

const sceneSeal = (c: Copy) => `
  <div class="letter"><div class="body" data-body>${esc(c.how.answers[1]!)}</div></div>
  <div class="bucket"><span class="eyebrow" data-bucket>${esc(c.how.bucket)}</span><div class="bar"><div class="fill"></div></div><span class="eyebrow">1 KB</span></div>
  <div class="chainrow"><div class="fp"><span class="eyebrow">${esc(c.how.chain)} · sha-256</span><b data-fp>&nbsp;</b></div>
  <div class="stamp"><span><b>${esc(c.how.stamp)}</b>1 / 1</span></div></div>`;

const sceneGate = (c: Copy) => `
  <div class="gate"><div class="count"><span data-count>0</span><small> / 3</small></div><span class="phase" data-phase>${esc(c.how.phaseOpen)}</span></div>
  <div class="locked" data-locked>${esc(c.how.locked)}</div>
  <ul class="answers">${c.how.answers.map((a) => `<li><span class="t">${esc(a)}</span><span class="rm">${esc(c.how.removed)}</span><i class="strike"></i></li>`).join('')}</ul>
  <div class="eyebrow" style="margin-top:14px" data-run>${esc(c.how.realRun)}</div>`;

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

function markTells(text: string, tells: string[]) {
  let out = esc(text);
  for (const t of tells) out = out.replace(esc(t), `<mark>${esc(t)}</mark>`);
  return out;
}

function template(c: Copy) {
  return `
<header class="nav" id="nav">
  <a class="brand" href="#top"><b>stele</b><span>${eb(c.tag)}</span></a>
  <nav class="nav-links">
    <a class="hide-sm" href="#how">${esc(c.nav.how)}</a>
    <a class="hide-sm" href="#who">${esc(c.nav.who)}</a>
    <a class="hide-sm" href="#verify">${esc(c.nav.verify)}</a>
    <button class="lang" id="lang" aria-label="Language">${esc(c.nav.lang)}</button>
    <a class="code" href="${REAL.repo}" target="_blank" rel="noopener">${esc(c.nav.code)}</a>
  </nav>
</header>

<section class="hero" id="top">
  ${crowd(c)}
  <div class="veil"></div>
  <div class="hero-copy">
    <div class="eyebrow">${eb(c.hero.eyebrow)}</div>
    <h1>${c.hero.title.map((l) => `<span class="line"><span>${esc(l)}</span></span>`).join('')}</h1>
    <p class="sub">${esc(c.hero.sub)}</p>
  </div>
  <div class="scroll-hint eyebrow"><span>${esc(c.hero.scroll)}</span><i></i></div>
  <div class="beat b1">${esc(c.hero.beat1)}</div>
  <div class="beat b2">${esc(c.hero.beat2)}</div>
  <div class="beat b3">${esc(c.hero.you)}</div>
</section>

<section class="block" id="cost">
  <div class="wrap">
    <div class="eyebrow">${eb(c.cost.eyebrow)}</div>
    <div class="cost-head"><h2 class="h2 split">${esc(c.cost.title)}</h2><p class="lead">${esc(c.cost.body)}</p></div>
    <div class="cost-rows">${c.cost.rows.map((r) => `<div class="cost-row"><span class="k">${esc(r.k)}</span><span class="line">${esc(r.line)}</span><span class="q">${esc(r.q)}</span></div>`).join('')}</div>
  </div>
</section>

<section class="block" id="anon">
  <div class="wrap anon-grid">
    <div>
      <div class="eyebrow">${eb(c.anon.eyebrow)}</div>
      <h2 class="h2 split" style="margin-top:28px">${esc(c.anon.title)}</h2>
      <ol class="anon-points">${c.anon.points.map((p, i) => `<li><b>0${i + 1}</b><span>${esc(p)}${i === 1 ? `<cite>${esc(c.anon.cite)}</cite>` : ''}</span></li>`).join('')}</ol>
      <p class="anon-fix">${esc(c.anon.fix)}</p>
    </div>
    <div class="specimen" id="specimen">
      <div class="lab"><span class="eyebrow" data-lab>${esc(c.anon.beforeLabel)}</span><span class="eyebrow">NEAR AI · TEE</span></div>
      <div class="txt" data-txt>${markTells(c.anon.before, c.anon.tells)}</div>
    </div>
  </div>
</section>

<section class="how" id="how">
  <div class="how-pin">
    <div class="rail">
      <div>
        <div class="eyebrow">${eb(c.how.eyebrow)}</div>
        <ol class="rail-steps"><span class="rail-bar"></span>${c.how.steps.map((s, i) => `<li data-step="${i}"><span class="n">0${i + 1}</span><span>${esc(s.title)}</span></li>`).join('')}</ol>
      </div>
      <div class="rail-text">${c.how.steps.map((s) => `<div class="t"><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p></div>`).join('')}</div>
    </div>
    <div class="stage">
      ${SCENES.map((_, i) => `<div class="scene" data-scene="${i}"></div>`).join('')}
      <div class="stage-foot"><span class="eyebrow note" data-note></span><span class="eyebrow" data-idx>01 / 05</span></div>
    </div>
  </div>
</section>

<section class="block" id="who">
  <div class="wrap sees-grid">
    <div><div class="eyebrow">${eb(c.sees.eyebrow)}</div><h2 class="h2 split" style="margin-top:28px">${esc(c.sees.title)}</h2></div>
    <div class="sees-table">
      <div class="sees-head"><span></span><span>${esc(c.sees.cols[0]!)}</span><span>${esc(c.sees.cols[1]!)}</span></div>
      ${c.sees.rows.map((r) => `<div class="sees-row"><span class="who">${esc(r.who)}</span><span class="s">${esc(r.sees)}</span><span class="nv">${esc(r.never)}</span></div>`).join('')}
    </div>
  </div>
</section>

<section class="block" id="verify">
  <div class="wrap verify-grid">
    <div><div class="eyebrow">${eb(c.verify.eyebrow)}</div><h2 class="h2 split" style="margin:28px 0 24px">${esc(c.verify.title)}</h2><p class="lead">${esc(c.verify.body)}</p></div>
    <div class="term"><div class="term-bar"><i></i><i></i><i></i></div><pre id="term"><span class="caret"></span></pre></div>
  </div>
</section>

<section class="block" id="limits">
  <div class="wrap">
    <div class="eyebrow">${eb(c.limits.eyebrow)}</div>
    <div class="limits">${c.limits.rows.map((r) => `<div class="limit"><span class="no">${esc(r.no)}<i></i></span><span class="yes">${esc(r.yes)}</span></div>`).join('')}</div>
  </div>
</section>

<section class="block end" id="end">
  <div class="wrap">
    <div class="eyebrow">${eb(c.end.eyebrow)}</div>
    <h2 class="h2 split">${esc(c.end.title)}</h2>
    <div class="end-row">
      <a class="btn" href="${REAL.repo}" target="_blank" rel="noopener">${esc(c.end.code)} <span aria-hidden="true">→</span></a>
      <span class="status"><i></i>${esc(c.end.status)}</span>
    </div>
    <div class="foot"><span>${esc(c.end.foot)}</span><span class="mono">stele v0.2.0</span></div>
  </div>
</section>`;
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

// ---------------------------------------------------------------- scenes

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
    tl.to([txt, f.querySelector('.tag')], { y: -10, autoAlpha: 0, duration: 0.22, ease: LEAVE }, at)
      .to(f.querySelector('.ul'), { scaleX: 0, transformOrigin: 'right', duration: 0.3, ease: LEAVE }, at)
      .call(() => {
        txt.textContent = seg.to ?? '';
        f.classList.add('done');
        txt.style.backgroundColor = 'transparent';
        if (!seg.to) f.style.display = 'none';
      }, [], `${at}+=0.24`)
      .fromTo(txt, { y: 10, autoAlpha: 0, color: '#5c6bff' }, { y: 0, autoAlpha: 1, color: '#ffffff', duration: 0.5, ease: LAND, immediateRender: false }, `${at}+=0.26`);
  });
  tl.from(root.querySelector('.sig'), { y: 16, autoAlpha: 0, duration: 0.5, ease: POP }, '+=0.3');
  return tl;
};

const buildSeal: SceneBuild = (root, c) => {
  const tl = gsap.timeline();
  const body = root.querySelector<HTMLElement>('[data-body]')!;
  const label = root.querySelector<HTMLElement>('[data-bucket]')!;
  const fp = root.querySelector<HTMLElement>('[data-fp]')!;
  const sealed = rand(Math.max(96, c.how.answers[1]!.length * 2));
  tl.from(root.querySelector('.letter'), { y: 24, autoAlpha: 0, duration: 0.5, ease: LAND })
    .from(root.querySelectorAll('.bucket, .chainrow'), { y: 16, autoAlpha: 0, duration: 0.5, ease: LAND, stagger: 0.1 }, '-=0.2')
    .to(root.querySelector('.fill'), { scaleX: 1, duration: 1, ease: SHIFT }, '+=0.3')
    .call(() => { label.textContent = c.how.sealed; body.classList.add('mono'); }, [], '+=0.1')
    .add(() => { scramble(body, sealed, 0.9); }, '<')
    .to(body, { color: '#9e9e9e', duration: 0.6 }, '<')
    .call(() => {
      void sha256Hex(sealed).then((h) => { scramble(fp, h, 0.8); });
    }, [], '+=0.9')
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
    tl.call(() => { count.textContent = String(n); }, [], '+=0.45').fromTo(count, { scale: 1.25 }, { scale: 1, duration: 0.4, ease: POP, transformOrigin: 'left bottom', immediateRender: false });
  });
  tl.call(() => { phase.textContent = c.how.phaseClosed; phase.classList.add('closed'); }, [], '+=0.5')
    .fromTo(phase, { scale: 1.2 }, { scale: 1, duration: 0.4, ease: POP, immediateRender: false })
    .to(root.querySelector('[data-locked]'), { autoAlpha: 0, height: 0, marginBottom: 0, duration: 0.35, ease: LEAVE }, '<')
    .to(items, { autoAlpha: 1, y: 0, duration: 0.5, ease: LAND, stagger: 0.12 })
    .to(items[2]!.querySelector('.strike'), { scaleX: 1, duration: 0.45, ease: SHIFT }, '+=0.8')
    .call(() => { items[2]!.classList.add('removed'); }, [], '+=0.15')
    .fromTo(items[2]!.querySelector('.rm'), { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: LAND });
  return tl;
};

const BUILDERS: SceneBuild[] = [buildRules, buildTree, buildShield, buildSeal, buildGate];

// ---------------------------------------------------------------- page motion

function nav() {
  const el = document.getElementById('nav')!;
  ScrollTrigger.create({ start: 40, end: 'max', onToggle: (s) => el.classList.toggle('solid', s.isActive) });
  document.getElementById('lang')!.addEventListener('click', () => {
    lang = lang === 'en' ? 'tr' : 'en';
    try { localStorage.setItem('stele.lang', lang); } catch { /* storage blocked */ }
    render(true);
  });
}

function heroIntro() {
  const tl = gsap.timeline({ defaults: { ease: LAND } });
  tl.from('.cell', { scale: 0.4, autoAlpha: 0, duration: 0.7, stagger: { each: 0.006, from: 'random' } })
    .from('.hero .eyebrow', { y: 14, autoAlpha: 0, duration: 0.5 }, 0.25)
    .from('.hero h1 .line > span', { yPercent: 110, duration: 1, stagger: 0.09 }, 0.3)
    .from('.hero .sub', { y: 20, autoAlpha: 0, duration: 0.7 }, 0.75)
    .from('.scroll-hint', { autoAlpha: 0, duration: 0.6 }, 1);
}

function heroScroll(reduced: boolean) {
  if (reduced) return;
  const crowdEl = document.querySelector<HTMLElement>('.crowd')!;
  const you = document.querySelector<HTMLElement>('.cell.you')!;
  const others = gsap.utils.toArray<HTMLElement>('.cell:not(.you) .card');
  const youCard = you.querySelector<HTMLElement>('.card')!;
  const zoom = () => (window.innerWidth / you.offsetWidth) * 1.6;
  const origin = () => `${you.offsetLeft + you.offsetWidth / 2}px ${you.offsetTop + you.offsetHeight / 2}px`;
  const b3 = SplitText.create('.beat.b3', { type: 'words' });

  const tl = gsap.timeline({
    scrollTrigger: { trigger: '.hero', start: 'top top', end: '+=320%', pin: true, scrub: 0.8, invalidateOnRefresh: true },
  });
  tl.to('.hero-copy', { y: -140, autoAlpha: 0, duration: 1, ease: SHIFT }, 0)
    .to('.scroll-hint', { autoAlpha: 0, duration: 0.3 }, 0)
    .to('.veil', { autoAlpha: 0.25, duration: 1, ease: SHIFT }, 0.2)
    .to(others, { rotateX: 180, duration: 0.6, ease: SHIFT, stagger: { each: 0.018, from: 'random' } }, 0.5)
    .fromTo('.beat.b1', { autoAlpha: 0, y: 50 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: LAND }, 1.3)
    .to('.beat.b1', { autoAlpha: 0, y: -50, duration: 0.4, ease: LEAVE }, 2.6)
    .fromTo(crowdEl, { '--fade': 1 }, { '--fade': 0.12, duration: 0.6, ease: SHIFT }, 2.7)
    .fromTo('.beat.b2', { autoAlpha: 0, y: 50 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: LAND }, 2.9)
    .to('.beat.b2', { autoAlpha: 0, y: -50, duration: 0.4, ease: LEAVE }, 3.7)
    .set(crowdEl, { transformOrigin: origin }, 3.7)
    .to(crowdEl, { scale: zoom, duration: 1.6, ease: SHIFT }, 3.8)
    .to(youCard, { rotateX: 180, duration: 0.8, ease: SHIFT }, 3.8)
    .set('.beat.b3', { autoAlpha: 1 }, 5.2)
    .from(b3.words, { yPercent: 60, autoAlpha: 0, duration: 0.5, ease: LAND, stagger: 0.05 }, 5.2)
    .to({}, { duration: 0.8 });
}

function headings() {
  gsap.utils.toArray<HTMLElement>('.split').forEach((el) => {
    const s = SplitText.create(el, { type: 'lines,words', mask: 'lines' });
    gsap.from(s.words, { yPercent: 110, duration: 0.9, ease: LAND, stagger: 0.025, scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
  });
}

function reveals() {
  ScrollTrigger.batch('.cost-row, .sees-row, .anon-points li', {
    start: 'top 88%',
    once: true,
    onEnter: (els) => gsap.from(els, { y: 40, autoAlpha: 0, duration: 0.7, ease: LAND, stagger: 0.08 }),
  });
  ScrollTrigger.batch('.limit', {
    start: 'top 85%',
    once: true,
    onEnter: (els) => {
      const tl = gsap.timeline();
      tl.from(els, { y: 30, autoAlpha: 0, duration: 0.6, ease: LAND, stagger: 0.08 })
        .to(els.map((e) => e.querySelector('.no i')), { scaleX: 1, duration: 0.45, ease: SHIFT, stagger: 0.1 }, '-=0.3');
    },
  });
}

function specimen(c: Copy) {
  const box = document.getElementById('specimen')!;
  const txt = box.querySelector<HTMLElement>('[data-txt]')!;
  const lab = box.querySelector<HTMLElement>('[data-lab]')!;
  const before = markTells(c.anon.before, c.anon.tells);
  const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 2.2 });
  tl.call(() => { txt.innerHTML = before; txt.classList.remove('after'); lab.textContent = c.anon.beforeLabel; })
    .from(txt, { autoAlpha: 0, y: 12, duration: 0.5, ease: LAND })
    .from(txt.querySelectorAll('mark'), { boxShadow: 'inset 0 0 0 transparent', duration: 0.4, stagger: 0.25 }, '+=0.6')
    .to(txt, { autoAlpha: 0, y: -12, duration: 0.3, ease: LEAVE }, '+=1.6')
    .call(() => { txt.textContent = c.anon.after; txt.classList.add('after'); lab.textContent = c.anon.afterLabel; })
    .to(txt, { autoAlpha: 1, y: 0, duration: 0.6, ease: LAND })
    .to({}, { duration: 2.4 });
  ScrollTrigger.create({ trigger: box, start: 'top 80%', end: 'bottom 10%', onToggle: (s) => (s.isActive ? tl.play() : tl.pause()) });
}

function stepper(c: Copy, reduced: boolean) {
  const n = c.how.steps.length;
  const texts = gsap.utils.toArray<HTMLElement>('.rail-text .t');
  const lis = gsap.utils.toArray<HTMLElement>('.rail-steps li');
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
      gsap.to(scenes[prev]!, { autoAlpha: 0, scale: 0.98, duration: 0.25, ease: LEAVE, overwrite: true });
    }
    running?.kill();
    gsap.fromTo(texts[i]!, { y: 28, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, ease: LAND, delay: prev >= 0 ? 0.18 : 0, overwrite: true });
    lis.forEach((li, k) => li.classList.toggle('on', k === i));
    note.textContent = c.how.steps[i]!.note;
    idx.textContent = `0${i + 1} / 0${n}`;
    const scene = scenes[i]!;
    scene.innerHTML = SCENES[i]!(c);
    gsap.fromTo(scene, { autoAlpha: 0, scale: 1.02 }, { autoAlpha: 1, scale: 1, duration: 0.45, ease: LAND, delay: prev >= 0 ? 0.15 : 0, overwrite: true });
    running = BUILDERS[i]!(scene, c);
    if (reduced) running.progress(1);
    else running.delay(prev >= 0 ? 0.25 : 0);
  };

  show(0);
  ScrollTrigger.create({
    trigger: '.how-pin',
    start: 'top top',
    end: `+=${n * 90}%`,
    pin: true,
    onUpdate: (s) => {
      show(Math.min(n - 1, Math.floor(s.progress * n)));
      gsap.set('.rail-bar', { scaleY: s.progress });
    },
  });
}

function terminal(reduced: boolean) {
  const pre = document.getElementById('term')!;
  const lines = terminalLines();
  const caret = '<span class="caret"></span>';
  const render = (done: { cls: string; text: string }[], partial = '') =>
    (pre.innerHTML = done.map((l) => `<span class="${l.cls}">${esc(l.text)}</span>`).join('\n') + (done.length ? '\n' : '') + (partial ? `<span class="cmd">${esc(partial)}</span>` : '') + caret);
  if (reduced) { render(lines); return; }
  const tl = gsap.timeline({ paused: true });
  const done: { cls: string; text: string }[] = [];
  for (const l of lines) {
    if (l.cls === 'cmd') {
      const o = { n: 0 };
      tl.to(o, { n: l.text.length, duration: l.text.length * 0.022, ease: 'none', onUpdate: () => { render(done, l.text.slice(0, Math.round(o.n))); } }, '+=0.35');
    }
    tl.call(() => { done.push(l); render(done); }, [], l.cls === 'cmd' ? '+=0.25' : '+=0.07');
  }
  ScrollTrigger.create({ trigger: pre, start: 'top 75%', once: true, onEnter: () => { tl.play(); } });
}

// ---------------------------------------------------------------- boot

let ctx: gsap.MatchMedia | null = null;

function render(keepPlace = false) {
  const y = keepPlace ? window.scrollY : 0;
  ctx?.revert();
  ScrollTrigger.getAll().forEach((t) => t.kill());
  document.documentElement.lang = lang;
  const c = copy[lang];
  app.innerHTML = template(c);
  ctx = gsap.matchMedia();
  ctx.add({ reduced: '(prefers-reduced-motion: reduce)', full: '(prefers-reduced-motion: no-preference)' }, (m) => {
    const reduced = Boolean(m.conditions?.['reduced']);
    nav();
    if (!reduced) heroIntro();
    heroScroll(reduced);
    headings();
    if (!reduced) { reveals(); specimen(c); }
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
