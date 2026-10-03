#!/usr/bin/env python3
"""Illustrated motion scenes and carousel frames for the JEV sense demo (v2).

Every gloss, sense ID and choice comes from the evidence JSON; nothing is invented.
Import-safe: rendering only happens when functions are called.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import argparse, json, re
from compose import font

W, H = 1080, 1350
M = 64                      # safe edge
BG = (232, 237, 241)        # cool grey-blue paper
INK = (24, 32, 44)
SOFT = (96, 108, 122)
LINE = (196, 205, 214)
CARD = (247, 249, 251)
TARGET = (185, 57, 27)      # the word being looked up
CLUE = (24, 118, 120)       # the context word that decides
ROW_IDS = ['d1', 'd2', 'd3', 'd4']
ROW_Y = [452, 572, 692, 812]
ROW_H = 104
SCENES = {'stack': 6, 'context': 9, 'pipeline': 7, 'end': 3}
PHONE = [('母に', 0), ('電話', 1), ('を', 0), ('掛けた', 2), ('。', 0)]
GLASSES = [('眼鏡', 1), ('を', 0), ('掛けた', 2), ('。', 0)]
UNCLEAR = [('それ、', 0), ('掛けといて', 2), ('。', 0)]


def clamp(x): return max(0.0, min(1.0, x))
def out(t): return 1 - (1 - clamp(t)) ** 3
def inout(t): t = clamp(t); return 4 * t ** 3 if t < .5 else 1 - (-2 * t + 2) ** 3 / 2
def mix(a, b, k): return tuple(round(a[i] + (b[i] - a[i]) * clamp(k)) for i in range(3))
def lerp(a, b, k): return a + (b - a) * k


def first_gloss(text):
    """Strip the [n, pos] tag and keep the first gloss (glosses are joined by ' to ')."""
    body = re.sub(r'^\[[^\]]*\]\s*', '', text)
    parts = re.split(r'\s(?=to\s)', body)
    return parts[0].strip()


def senses(evidence):
    return {c['id']: c['text'] for c in evidence['candidates']}


def wrap(d, text, f, width):
    words, rows = text.split(' '), ['']
    for w in words:
        trial = (rows[-1] + ' ' + w).strip()
        if d.textlength(trial, font=f) <= width or not rows[-1]: rows[-1] = trial
        else: rows.append(w)
    return rows


def say(d, xy, s, size, color=INK, jp=False, k=1.0):
    if k <= 0: return
    d.text(xy, s, font=font(size, jp=jp), fill=mix(BG, color, k))


def sentence(d, x, y, parts, size, k=1.0, mark=1.0):
    """Draw coloured sentence; underline clue (thin) and target (thick). Returns target span."""
    if k <= 0: return None
    f, span = font(size, jp=True), None
    for s, role in parts:
        col = INK if role == 0 else mix(INK, CLUE if role == 1 else TARGET, mark)
        d.text((x, y), s, font=f, fill=mix(BG, col, k))
        w = d.textlength(s, font=f)
        if role and mark > 0:
            uy = y + size + 12
            d.line((x, uy, x + w * out(mark), uy), fill=mix(BG, col, k), width=3 if role == 1 else 7)
        if role == 2: span = (x, x + w)
        x += w
    return span


def rows(d, evidence, place, emph, k=1.0):
    """place(i) -> (x, y, alpha). emph: dict id -> 0..1 weight."""
    g, fid, fg = senses(evidence), font(30), font(40)
    for i, sid in enumerate(ROW_IDS):
        x, y, a = place(i)
        if a <= 0: continue
        e = emph.get(sid, 0)
        fill = mix(BG, mix(CARD, (252, 236, 228), e), a * k)
        d.rounded_rectangle((x, y, x + W - 2 * M, y + ROW_H), 14, fill=fill,
                            outline=mix(BG, mix(LINE, TARGET, e), a * k), width=2 + round(2 * e))
        d.text((x + 26, y + 34), f'#{i + 1}', font=fid, fill=mix(BG, mix(SOFT, TARGET, e), a * k))
        lines = wrap(d, first_gloss(g[sid]), fg, W - 2 * M - 150)[:2]
        ty = y + ROW_H / 2 - len(lines) * 23
        for j, ln in enumerate(lines):
            d.text((x + 110, ty + j * 46), ln, font=fg, fill=mix(BG, mix(SOFT, INK, .55 + .45 * e), a * k))


def settled(i): return (M, ROW_Y[i], 1.0)


def header(d, title, k=1.0):
    say(d, (M, 80), title, 52, INK, jp=True, k=k)


def word(d, k=1.0, y=168):
    say(d, (M, y), '掛ける', 132, TARGET, jp=True, k=k)
    say(d, (M + 420, y + 78), 'かける', 34, SOFT, jp=True, k=k)
    say(d, (M + 540, y + 78), '· JMdict entry', 34, SOFT, k=k)


def illustration_label(d, evidence, k=1.0):
    n = evidence.get('source_sense_count', len(evidence['candidates']))
    say(d, (M, 1150), f'Simplified illustration · 4 of {n} senses', 30, SOFT, k=k)


def scene_stack(d, t, ev):
    header(d, 'Which kind of 掛ける?', out(t / .5)); word(d, out((t - .2) / .6))
    def place(i):
        p = out((t - .8 - i * .28) / 1.1)          # staggered unfold from a pile
        q = inout((t - 2.4) / .9)                   # then settle into source order
        px, py = M + 30 + i * 22, 660 + (3 - i) * 16
        fx, fy = M + (i % 2) * 40, 452 + [2, 0, 3, 1][i] * 120
        return (lerp(lerp(px, fx, p), M, q), lerp(lerp(py, fy, p), ROW_Y[i], q), clamp(p * 2))
    rows(d, ev, place, {})
    k, mark = out((t - 3.6) / .7), out((t - 4.5) / .8)
    if k > 0:
        sentence(d, M, lerp(1040, 960, k), PHONE, 64, k, mark)
        say(d, (M, 1062), '掛けた is the word · 電話 is the clue', 34, SOFT, jp=True, k=mark)
    illustration_label(d, ev, out((t - 1) / .5))


def faded(d, paint, k):
    if k <= 0: return
    layer = Image.new('RGBA', (W, H)); paint(ImageDraw.Draw(layer))
    layer.putalpha(layer.getchannel('A').point(lambda a: round(a * clamp(k))))
    d._image.paste(layer, (0, 0), layer)


def scene_context(d, t, ev):
    swap = inout((t - 4.2) / 1.4)
    faded(d, lambda x: header(x, 'Here, it means making a call.'), 1 - out((t - 4) / .4))
    faded(d, lambda x: header(x, 'Different sentence, different sense.'), out((t - 4.6) / .5))
    word(d)
    hi = out((t - .6) / .8)
    rows(d, ev, settled, {'d4': hi * (1 - swap), 'd3': hi * swap})
    # one moving bar keeps the eye on a single emphasis that travels between rows
    by = lerp(ROW_Y[3], ROW_Y[2], swap)
    d.rounded_rectangle((M - 18, by + 12, M - 8, by + ROW_H - 12), 4, fill=mix(BG, TARGET, hi))
    faded(d, lambda x: sentence(x, M, 960, PHONE, 64), 1 - out(swap * 2))
    faded(d, lambda x: sentence(x, M, 960, GLASSES, 64), out(swap * 2 - 1))
    if swap > .5:
        say(d, (M, 1060), 'Full sentence used:', 30, SOFT, k=out(swap * 2 - 1))
        say(d, (M, 1098), next(c['sentence'] for c in ev['cases'] if c['kind'] == 'glasses'),
            34, INK, jp=True, k=out(swap * 2 - 1))
    illustration_label(d, ev)


def scene_pipeline(d, t, ev):
    phone = next(c for c in ev['cases'] if c['kind'] == 'phone')
    n = len(phone['request']['candidates'])
    say(d, (M, 84), 'Sentence + word + dictionary senses.', 44, k=out(t / .5))
    nodes = [('On the page', f'{phone["sentence"]} + 掛ける + {n} senses', 'not the whole page'),
             ('Local bridge', 'your API key stays here', 'LOCAL'),
             ('JEV model', f'picks one of d1–d{n}, or “unclear”', 'REMOTE'),
             ('Checked', f'valid sense ID → {phone["response"]["choice"]}', 'LOCAL'),
             ('Popup', f'sense #{phone["response"]["choice"][1:]} is highlighted, order unchanged', 'LOCAL')]
    ys = [190 + i * 196 for i in range(5)]
    for i, (name, sub, tag) in enumerate(nodes):
        k = out((t - .3 - i * .25) / .5)
        y = ys[i]
        remote = tag == 'REMOTE'
        d.rounded_rectangle((M, y, W - M, y + 140), 16, fill=mix(BG, (225, 240, 240) if remote else CARD, k),
                            outline=mix(BG, CLUE if remote else LINE, k), width=3)
        say(d, (M + 30, y + 22), name, 42, INK, k=k)
        say(d, (W - M - 30 - d.textlength(tag, font=font(26)), y + 14), tag, 26, CLUE if remote else SOFT, k=k)
        say(d, (M + 30, y + 80), sub, 32, SOFT, jp=True, k=k)
        if i < 4:
            d.line((M + 60, y + 140, M + 60, y + 196), fill=mix(BG, LINE, k), width=3)
    # token travels down: sentence+target until the model, then the validated ID continues
    p = inout((t - 1.8) / 4.2)
    seg = min(3.999, p * 4)
    ty = lerp(ys[int(seg)] + 70, ys[int(seg) + 1] + 70, inout(seg - int(seg)))
    say(d, (M, 1150), 'Simplified illustration · reading, surface and location.', 28, SOFT)
    label = '掛けた' if seg < 2 else phone['response']['choice']
    f = font(36, jp=True); w = d.textlength(label, font=f) + 36
    if 1.8 < t:
        d.rounded_rectangle((W - M - 60 - w, ty + 8, W - M - 60, ty + 60), 26, fill=TARGET)
        d.text((W - M - 42 - w, ty + 12), label, font=f, fill=CARD)


def scene_end(d, t, ev):
    k = out(t / .6)
    say(d, (M, 420), 'Some sentences need', 64, INK, k=k)
    say(d, (M, 504), 'more context.', 64, INK, k=k)
    sentence(d, M, 650, UNCLEAR, 56, out((t - .4) / .6), 1)
    say(d, (M, 740), 'JEV answered “unclear” here.', 40, SOFT, k=out((t - .6) / .6))
    say(d, (M, 800), 'No sense is highlighted.', 40, SOFT, k=out((t - .6) / .6))
    credits(d, out((t - .8) / .6))


def credits(d, k, y=1040):
    for i, s in enumerate(['Built on Yomitan · JMdict © EDRDG, CC BY-SA 4.0',
                           'Three example sentences, not an accuracy test.']):
        say(d, (M, y + i * 44), s, 30, SOFT, k=k)


DRAW = {'stack': scene_stack, 'context': scene_context, 'pipeline': scene_pipeline, 'end': scene_end}


def scene_frame(kind, t, evidence):
    """Render one 1080x1350 RGB frame of `kind` at time `t` seconds."""
    im = Image.new('RGB', (W, H), BG)
    DRAW[kind](ImageDraw.Draw(im), t, evidence)
    return im


def carousel_frames(evidence):
    """Seven standalone slides, numbered 01–07."""
    def unclear(d):
        header(d, 'This one needs more context.'); word(d)
        rows(d, evidence, settled, {})
        sentence(d, M, 960, UNCLEAR, 64)
        say(d, (M, 1060), 'JEV answered “unclear”, so no sense is highlighted.', 32, SOFT)
        illustration_label(d, evidence)

    def summary(d):
        header(d, 'What this build does')
        for i, s in enumerate(['Reads the sentence around the word.',
                               'Sends the sentence, word and senses.',
                               'Highlights one sense, or none if unclear.',
                               'Keeps dictionary order as it was.']):
            say(d, (M, 260 + i * 110), f'{i + 1}.', 44, TARGET); say(d, (M + 70, 260 + i * 110), s, 42)
        credits(d, 1, 1000)

    plan = [('stack', 3.5), ('stack', 6), ('context', 3.5), ('context', 9), ('pipeline', 7), unclear, summary]
    frames = []
    for n, item in enumerate(plan, 1):
        if callable(item):
            im = Image.new('RGB', (W, H), BG); item(ImageDraw.Draw(im))
        else:
            im = scene_frame(item[0], item[1], evidence)
        d = ImageDraw.Draw(im)
        tag = f'{n:02d} / 07'
        d.text((W - M - d.textlength(tag, font=font(28)), 32), tag, font=font(28), fill=SOFT)
        frames.append(im)
    return frames


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--evidence', required=True); ap.add_argument('--out-dir', required=True)
    a = ap.parse_args()
    ev = json.loads(Path(a.evidence).read_text())
    out_dir = Path(a.out_dir); out_dir.mkdir(parents=True, exist_ok=True)
    for kind, dur in SCENES.items():
        for name, t in [('start', 0.0), ('middle', dur / 2), ('end', dur - 1e-3)]:
            scene_frame(kind, t, ev).save(out_dir / f'scene-{kind}-{name}.png')
    for n, im in enumerate(carousel_frames(ev), 1):
        im.save(out_dir / f'carousel-{n:02d}.png')
    print(out_dir)


if __name__ == '__main__':
    main()
