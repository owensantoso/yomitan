# Yomitan + JEV video and carousel

The final cut is 46 seconds, silent, 1080 × 1350 at 30 fps. It combines authored illustrations with unchanged recordings of the working fork. Seven standalone carousel images include actual phone, glasses and unclear popup proof.

## Reproduce from this repository

Requirements: Python 3 with Pillow 12.3.0, FFmpeg on PATH, and macOS system Avenir Next/Hiragino fonts. There are no network calls or model calls in the renderer. The only inputs are the bundled isolated fixture recordings and reviewed dictionary evidence.

From the repository root:

```sh
python3 jev-media/render_v2.py --manifest jev-media/capture-manifest-v2.json --evidence jev-media/evidence-senses.json --out-dir media-out --samples
python3 jev-media/render_v2.py --manifest jev-media/capture-manifest-v2.json --evidence jev-media/evidence-senses.json --out-dir media-out --render
```

If Pillow is missing, prepare an environment:

```sh
python3 -m venv .media-venv
.media-venv/bin/python -m pip install -r jev-media/requirements-media.txt
```

Then run the commands with `.media-venv/bin/python`. FFmpeg must already be installed. The relative manifest paths resolve against the manifest location, independently of the working directory. This renderer uses macOS fonts; cross-platform font substitution has not been verified.

Outputs: `yomitan-jev-demo-v2.mp4`, poster, `carousel-01.png` through `carousel-07.png`, combined PDF, carousel ZIP and an edit receipt. `--samples` exports representative motion frames into `review/`. The source bundle includes the small synthetic fixture recordings, so reproducing it needs no private screenshots, API key or provider account.

## What moves

`motion_graphics_v2.py` is the actual Claude Opus 5.5 authored core, with separately recorded Codex corrections. It exposes `scene_frame(kind, t, evidence)` and `carousel_frames(evidence)`; imports do not start rendering.

The intro unfolds four example senses from the target word, then settles them into source order. During the phone-to-glasses context change the rows stay fixed. A single emphasis bar travels from sense 4 to sense 3 while the clue and sentence change. The target stays recognizably linked to 掛ける / 掛けた. The pipeline carries the target through the local bridge and remote model, then carries the validated source ID back to the popup. These are illustrations, explicitly labelled, rather than recreated Yomitan screenshots.

`render_v2.py` is Codex assembly: it places the unchanged real popup crop, reads portable inputs, exports the proof carousel frames, and streams video frames to FFmpeg. It does not synthesize dictionary UI or score labels.

## Evidence and limits

The real footage uses the same fork with JEV switched off/on. It is not footage of an untouched upstream build. Source crop, start, end, hash and 1× playback are recorded in the edit receipt. The popup-to-result intervals play at their original speed; no waiting interval is cut away. No aggregate latency or accuracy claim is made. Three sentences demonstrate behavior rather than evaluate accuracy.

The installed full JMdict entry for 掛ける has 25 source candidates. The illustrations show four first glosses, clearly labelled as a subset. Phone selects d4; glasses selects d3; the ambiguous sentence selects `unclear`, so no sense is highlighted. Outside the real UI, the artwork adds no numerical probabilities. Model scores are estimates, not measured accuracy.

The implementation sends the extracted sentence, target, reading, inflected surface, UTF-16 offset and all dictionary sense text. It does not send the whole page. The local bridge retains the key; inference runs remotely. The response ID is checked against the actual candidate list before highlighting in original dictionary order.

The fixture recordings contain only isolated authored demo pages. They exclude ordinary personal Chrome windows/tabs. `fixtures/provenance.json` identifies the original recording basenames and SHA256 hashes without private paths.

Built on Yomitan. JMdict © EDRDG, CC BY-SA 4.0. Agent review verified readability, encoded transitions, original source sense identities, 1× footage, all-frame decode and package contents. Owen's taste/animation acceptance remains open.
