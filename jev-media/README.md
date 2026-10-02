# Social media composition

The video uses real browser footage at its recorded speed. No synthetic popup, invented score or performance claim is allowed. Opus 5.5's visual direction is preserved in `design-brief.md`; installed fonts substitute for unavailable proposed fonts.

Remotion was not installed in the examined projects. Existing FFmpeg + the bundled Pillow runtime do the deterministic composition without dependency downloads. This is a video compositor, not a browser application.

## Input

Copy `footage-contract.json` into task `work/media/capture-manifest.json`, replace every path with a real captured clip, supply actual sentence text and an optional crop `[x,y,width,height]`. Supply the _actual_ source sense count from the installed dictionary. Source footage must retain the popup-to-highlight delay. No speeding up. If clips are shorter than their scene, the last actual frame is held; the real-time portion is not cut or stretched. An ambiguity caption must be chosen from the actual result and say so if the model still commits.

Render from this repository:

```sh
python3 jev-media/compose.py /absolute/path/to/capture-manifest.json /absolute/path/to/outputs/yomitan-jev-demo.mp4
```

49 seconds, 1080×1350, 30 frames per second, silent. Hook → original popup → contextual highlight → second sentence → ambiguous sentence → animated flow → end. Audio is deliberately absent: the story must work muted. The output includes native review frames and an edit receipt identifying source paths and actual speed.

The video keeps the extension's own actual model display in the footage, preserving the relationship between the selected sense and its model estimate.

## Diagrams

```sh
python3 jev-media/diagrams.py /absolute/path/to/outputs
```

Shared geometry renders accessible SVG and PNG; `.mmd` files are editable semantic versions. Share images directly rather than deploying a second website.
