# Stele web: design DNA

Midnight's own visual language (midnight.network, measured Nov 2026), used for
a product built on it. No Midnight logo or artwork is used.

## PALETTE (coverage)
- `#000000` field, 82%: page background, stage interiors
- `#0b0b0c` / `#111` raised surfaces, 8%: cards, terminal, letter
- `#ffffff` text, 6%: headings and active content
- `#9e9e9e` secondary text, 3%: leads, captions
- `#0000fe` electric blue, ≤1% per screen except one moment: buttons, the "you" card, underlines, the stamp. `#5c6bff` is the same blue lifted for text on black (4.6:1).
- Hairlines `rgba(255,255,255,.12)` / `.28`.

## TYPE
- Display: Outfit 300, clamp(48px, 8.2vw, 128px), tracking -0.035em, leading 0.95
- Headline: Outfit 300, clamp(36px, 5.2vw, 80px), tracking -0.03em
- Body: Outfit 300, 17–21px, `#9e9e9e`
- Eyebrow / label: DM Mono 400, 12–13px, uppercase, +0.08em, numbered `01`–`08`
- Ratio display:body ≥ 5×

## SPACING
- Section rhythm `clamp(96px, 16vh, 180px)`; gutter `clamp(16px, 4vw, 64px)`; max width 1360px
- Asymmetric grids only: 5/4, 6/5, 4/7. No equal three-up cards.

## LAYOUTS
- HERO: full-bleed crowd of answer cards, copy bottom-left over a radial veil (≥ 100vh, pinned)
- LEDGER ROWS: label · statement · quote, hairline separated (cost, limits)
- STEPPER: pinned rail (5/12) + stage (7/12), one scene at a time, swap in place
- TABLE: party · sees · never sees
- TERMINAL: real CLI output, typed once

## MOTION
- Tokens: LAND `expo.out`, POP `back.out(1.7)`, SHIFT `power4.inOut`, LEAVE `expo.in`. No others.
- Things arrive, swap in place or stamp; nothing cross-fades on its own.
- Scroll scrubs the hero; scenes in the stepper play on entry and restart on re-entry.

## THE MOVE
The hero's single blue card is "you". After the crowd flips to show what people
actually think, the camera dives into your card until the whole screen is blue
and asks what you would say.

## REFUSALS
No gradient backgrounds as decoration, no emoji as ornament, no icons, no stock
illustration, no drop shadows except blue glow on blue things, no centered
section layouts (the two hero beats are the only centered text), no invented
numbers: every hash, count and answer comes from a real run.

## TESTS
1. Screenshot any section: is there at most one blue element competing for the eye?
2. Is every number on the page traceable to the CLI output or a cited paper?
3. Does the page read correctly with motion turned off (prefers-reduced-motion)?
4. At 390px wide, is there horizontal scroll? (must be no)
