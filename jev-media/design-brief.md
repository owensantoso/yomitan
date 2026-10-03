# Same popup, now sentence-aware

Purpose: persuade Japanese learners and builders through an actual browser demonstration, supported by a readable causal explanation. Primary job: show that the existing dictionary popup is useful immediately and its original senses remain in place when JEV adds a contextual highlight. Audience: X / LinkedIn viewers, usually muted on phones. Verification: 1080×1350 video and diagram PNGs, viewed at native and phone widths.

Direction supplied by Claude Opus 5.5: editorial paper and ink; real Yomitan footage as subject; indigo for sentence context, vermilion for the chosen sense. No simulated popup, tinting, invented distribution, timing claim or fake accuracy. Direct cuts between real-time clips; animated diagram and restrained title/underline reveal. The ambiguous example must display the actual returned answer.

Tokens: paper #F5F2EA, ink #1B1A17, muted #7D776C, selected #C2412D, context #2E4766. Installed font substitutes for the proposed downloadable font families: Hiragino Mincho for large Japanese, Hiragino Kaku Gothic for Japanese body, Avenir Next for Latin, Menlo for technical labels. No font download required. Footage typography is preserved.

Evidence: the original demo slice contained 3 entries / 69 source senses. The final browser capture imports full official JMdict [2026-10-02]; 掛ける supplies 25 actual source sense candidates. Live captures returned the phone sense, glasses sense and unclear in the corresponding three examples. Scores are model estimates, not measured accuracy. No performance claim until a representative measurement run exists. Full-page and paragraph context are deliberately excluded from the current implementation.

Content loci: live popup demonstrates behavior; caption supplies the change; actual score panel supplies uncertainty; architecture diagram supplies data flow; sequence diagram supplies ordering and failures. Each is a separate output to avoid repeating all content in every scene.

Diagram plan: a two-path flow with seven nodes at 1080×1350; a five-actor sequence at 1600×1200. Primary focus is the final highlight. Off-axis connectors use orthogonal routes. Detailed provider request validation belongs to the sequence, not the social overview.

## V2 feedback and decision record

User evidence (exact phrases): “nicer animation… especially explainer video”; “hate the way you write… sounds so ai”; “image carousel… each main frame one image”. Actual Claude Opus 5.5 was explicitly requested for the visual and video work.

Classification: insufficient explanatory motion is an implementation/design defect; copy rejection is a confirmed local taste signal. The previous paper/ink palette was proposed by Opus, not approved by Owen. Do not convert that proposal into a preference.

Decision: have actual Claude Opus 5.5 author and implement the next motion source. Preserve sentence/target/candidate identity through movement, keep the sense order fixed when context changes, and label simplified illustrated diagrams separately from actual browser recording. Recompose 6–8 carousel images as standalone scenes rather than exporting arbitrary video frames. Root owns social-post-drafts.md; this delegated visual work must not edit it.

Verification: native 1080×1350 MP4, authored intermediate/key frames and 360-pixel-width review copies; actual recording remains 1× from popup to highlight; score provenance remains the captured response. No benchmark or accuracy claim. Root reviews early source-rendered frames; final taste acceptance belongs to Owen.

### V2 delivered verification

- Confirmed: actual Claude Opus 5.5 authored the core scene source and illustrated carousel source (successful bounded low-effort run, 110.2 seconds). Original hashes are preserved; Codex integration and rendering corrections are separately identified in `opus-model-provenance-v2.json`. Two earlier bounded attempts yielded no source and were stopped without overlapping authors.
- Implemented: staggered sense-row unfolding, sentence/clue continuity, moving selection between fixed d4 and d3 rows, traveling target → validated ID through the local/remote path. Real dictionary recording remains unchanged, with exact crop and 1× popup-to-result intervals.
- Verified: native key/midpoint frames, 360-pixel phone contact sheets, root's independent visual review, readable safe-width copy and kana, single carousel numbering, actual phone/glasses/unclear proof cards. Normal graphic text contrast meets 4.5:1 against its background.
- Verified: 46-second MP4, 1080 × 1350, 30 fps, 1,380 frames, all-frame FFmpeg decode succeeds without errors. Seven final 1080 × 1350 carousel PNGs, combined PDF/ZIP and poster are exported. Relative manifest plus curated fixture bundle enables reproduction without private browser screenshots, credentials or provider calls.
- Still open: Owen's taste and pacing judgment. Agent/root rendered review is not human acceptance; no posts or video were published.
