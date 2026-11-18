# Stele web: design DNA

A short film (one night, told twice) followed by the facts under it.
Midnight's own visual language (midnight.network, measured Nov 2026), used for
a product built on it. No Midnight logo or artwork is used.

## STORY
1. The survey closed: every answer is "I'm fine". One of them was something
   else before it was sent.
2. The night: Elif types what she thinks, stops on three fears, deletes it,
   sends "I'm fine".
3. Everyone: the wall turns over. Three sourced numbers say the fears are
   rational.
4. The morning: the asker sees a wall of "I'm fine". Months pass, people
   leave, something breaks. "She had said it. Then she deleted it."
5. Same night, on Stele: each fear is answered in place (shield, membership
   proof, sealed until the deadline and the minimum).
6. This time: the answers open without names, the asker acts, March is quiet.
7. What's real, 8. You: the reader leaves a sentence on the wall.

The hero is the reader/Elif; Stele is the guide. Fiction is labelled; every
number carries its source; the shield example is a real run.

## PALETTE (coverage)
- `#000000` field, about 85%
- `#050506` / `#0b0b0d` raised surfaces: the phone, results, terminal
- `#ffffff` text; `#9e9e9e` secondary
- `#0000fe` electric blue: Elif's card, buttons, the shield's marks, and the
  whole screen while we are inside her card. `#6f7cff` is the same blue lifted
  for small text on black (5.5:1).
- Hairlines `rgba(255,255,255,.12)` / `.28`

## TYPE
Outfit 300 for everything read; DM Mono 400 for labels, the HUD and cards.
Scale: label 12 · body 18 · caption 22-32 · title 34-56 · beat 36-72 · hero 48-108.

## LAYOUT
The stage is fixed and its zones never move:
- HUD, top left: where and when (mono). Grows while months tick by.
- TELL, bottom left: her thoughts, then the fear being answered, then the narration.
- SCREEN, right: what is on a screen in the story (phone, results).
- BEAT, centre: the few lines the film stops for, and the three numbers.
- RAIL, left edge: the eight acts.
Under the film: one ledger grid, label column 240px, content right.

## MOTION
Everything is a function of one clock (screens scrolled). No tween holds
state, so scrubbing back or jumping from the rail lands on the same picture.
Devices: typing and erasing tied to scroll · the camera diving into one card
and back · cards turning over · months ticking and rewinding · the blue
draining from Elif's card · every card trading places · a sealed wall opening.
Easing: `cubic-bezier(0.16,1,0.3,1)` to land, `cubic-bezier(0.76,0,0.24,1)` to
shift. Nothing else.

## THE MOVE
The same night is told twice. The first time ends in "She had said it. Then
she deleted it." The second time the reader loses track of which card is hers.

## REFUSALS
No gradient decoration, no emoji, no icons, no illustration, no drop shadows
except blue glow on blue things, no invented numbers, no feature grid.

## TESTS
1. Scroll to any point, reload: is the picture the same?
2. Is every number traceable to a named source, and is the fiction labelled?
3. With motion reduced, does the story still read (no zoom, no shuffle)?
4. At 390px wide, is there horizontal scroll? (must be no)
