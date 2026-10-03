# Draft posts

## X

Been adding JEV to Yomitan.

掛ける has 25 meanings in my dictionary. The popup now uses the sentence to highlight the likely one.

Phone call → “make a call”
Glasses → “put on glasses”

Here’s a quick demo.

## LinkedIn

掛ける can mean making a phone call, putting on glasses, hanging something up—and quite a few other things. My dictionary has 25 senses for it.

A hover dictionary gives you that list. You still have to work out which meaning fits what you’re reading.

I started trying this in a small lab with JEV. I wanted to get it out of the lab and into something you could actually use, so I’ve put it into a fork of Yomitan.

The dictionary does the lookup as usual. JEV gets the sentence, the word you hovered over, and the dictionary’s senses as its possible answers. The popup then highlights the one it picks, keeping the rest of the entry available.

The video shows the same word in a phone-call sentence and a glasses sentence. There’s also an example with too little context, where the result comes back unclear.

This is still a prototype. I’ve checked these examples, but haven’t measured accuracy across a wider set of text yet.

Code: https://github.com/owensantoso/yomitan/tree/feat/jev-sense-highlighting

## Carousel caption

Same word, different sentence, different meaning.

I’ve been adding JEV to Yomitan so the hover popup can highlight the dictionary sense that fits the sentence. These slides walk through a couple of examples and what gets passed to JEV.

## Notes for publishing

- Attach the revised video or carousel. These are drafts; nothing has been posted.
- The comparison uses this fork with JEV switched off, then on.
- Any confidence values shown are model scores, not a measured accuracy rate.
- Dictionary: JMdict (Japanese–Multilingual Dictionary), from the Electronic Dictionary Research and Development Group. Yomitan upstream: https://github.com/yomidevs/yomitan. JEV: TypeSafe.
