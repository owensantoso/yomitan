#!/usr/bin/env python3
"""Export three audited JMdict entries, without modifying the Aiko seed.

The seed omits original sense-level reading/kanji restrictions. This is a demo
slice, deliberately not a replacement for a maintained full JMdict dictionary.
"""

import argparse
import hashlib
import json
import sqlite3
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ENTRIES = (1207610, 1326980, 1384830)
EXPECTED_COUNTS = {1207610: 25, 1326980: 18, 1384830: 26}
ATTRIBUTION = (
    'JMdict Japanese/English data: copyright James William Breen and the '
    'Electronic Dictionary Research and Development Group (EDRDG). '
    'Creative Commons Attribution-ShareAlike 4.0. '
    'https://www.edrdg.org/edrdg/licence.html ; '
    'https://creativecommons.org/licenses/by-sa/4.0/ . '
    'Converted from the existing Aiko read-only seed into a three-entry Yomitan '
    'demo slice. No translations were authored or changed.'
)
LIMITATION = (
    'Only JMdict entries 1207610 (掛ける/懸ける), 1326980 (取る), and '
    '1384830 (切る). English glosses and source sense boundaries retained. '
    'Original sense-level form restrictions are absent from the source seed; '
    'do not treat this slice as a full-fidelity or current JMdict release. '
    'Source JMdict release date is unknown. Import a maintained full JMdict '
    'Yomitan dictionary for general use.'
)
POS_NOTES = {'v1': 'Ichidan verb', 'v5r': 'Godan verb with ru ending', 'vt': 'Transitive verb', 'suf': 'Suffix'}


def values(raw):
    return json.loads(raw or '[]')


def tags(raw):
    return [value.removeprefix('&').removesuffix(';') for value in values(raw)]


def write_json(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n'


def export(seed, output):
    source_stat = seed.stat()
    conn = sqlite3.connect(f'{seed.resolve().as_uri()}?mode=ro', uri=True)
    conn.execute('PRAGMA query_only=ON')
    terms, source_entries, tag_bank = [], [], {}
    for sequence in ENTRIES:
        row = conn.execute('SELECT id FROM JmdictEntry WHERE entSeq=?', (sequence,)).fetchone()
        if row is None:
            raise ValueError(f'Missing source JMdict entry {sequence}')
        entry_id = row[0]
        written = [row[0] for row in conn.execute(
            'SELECT text FROM JmdictKanjiForm WHERE entryId=? ORDER BY position', (entry_id,)
        )]
        readings = conn.execute(
            'SELECT text,noKanji,restrictionsJson FROM JmdictReadingForm WHERE entryId=? ORDER BY position',
            (entry_id,),
        ).fetchall()
        pairs = []
        for reading, no_kanji, restriction in readings:
            allowed = values(restriction)
            for spelling in (written if written and not no_kanji else [reading]):
                if allowed and spelling not in allowed:
                    continue
                pairs.append((spelling, reading if spelling != reading else ''))
        senses = []
        for sense_id, position, pos_raw, field, misc, dialect, info in conn.execute(
            'SELECT id,position,partOfSpeechJson,fieldJson,miscJson,dialectJson,infoJson '
            'FROM JmdictSense WHERE entryId=? ORDER BY position', (entry_id,),
        ):
            glosses = [row[0] for row in conn.execute(
                'SELECT text FROM JmdictGloss WHERE senseId=? AND lang=? ORDER BY position',
                (sense_id, 'eng'),
            )]
            if not glosses:
                raise ValueError(f'No English glosses for {sense_id}')
            pos = tags(pos_raw)
            unknown = set(pos) - POS_NOTES.keys()
            if unknown:
                raise ValueError(f'Unreviewed POS in demo slice: {unknown}')
            rules = 'v1' if 'v1' in pos else 'v5' if 'v5r' in pos else ''
            sense_tag = f's{position + 1}'
            tag_bank[sense_tag] = [sense_tag, 'sense', position, f'JMdict source sense {position + 1}', 0]
            for tag in pos:
                tag_bank[tag] = [tag, 'partOfSpeech', 0, POS_NOTES[tag], 0]
            definition_tags = ' '.join([sense_tag, *pos])
            for spelling, reading in pairs:
                terms.append([spelling, reading, definition_tags, rules, 0, glosses, sequence, ''])
            senses.append({
                'id': sense_id,
                'position': position,
                'glosses': glosses,
                'partOfSpeech': pos,
                'field': values(field),
                'misc': values(misc),
                'dialect': values(dialect),
                'info': values(info),
            })
        if len(senses) != EXPECTED_COUNTS[sequence]:
            raise ValueError(f'Source sense count changed for {sequence}; review before export')
        source_entries.append({'entSeq': sequence, 'forms': pairs, 'senses': senses})
    conn.close()
    if seed.stat().st_mtime_ns != source_stat.st_mtime_ns or seed.stat().st_size != source_stat.st_size:
        raise RuntimeError('Source changed during export')
    content_hash = hashlib.sha256(write_json(source_entries).encode()).hexdigest()
    index = {
        'title': 'JMdict JEV demo slice (3 entries)',
        'revision': f'local-slice-{content_hash[:12]}',
        'format': 3,
        'sequenced': True,
        'author': 'EDRDG; local demo conversion by Owen',
        'sourceLanguage': 'ja',
        'targetLanguage': 'en',
        'url': 'https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project',
        'attribution': ATTRIBUTION,
        'description': LIMITATION,
    }
    provenance = {
        'exportedAt': datetime.now(timezone.utc).isoformat(),
        'sourcePath': str(seed.resolve()),
        'sourceBytes': source_stat.st_size,
        'sourceMtimeNs': source_stat.st_mtime_ns,
        'sourceReadOnly': True,
        'sourceReleaseDate': None,
        'extractedEntriesSha256': content_hash,
        'entryCount': len(source_entries),
        'sourceSenseCount': sum(len(entry['senses']) for entry in source_entries),
        'termRowCount': len(terms),
        'limitations': LIMITATION,
        'entries': source_entries,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr('index.json', write_json(index))
        archive.writestr('term_bank_1.json', write_json(terms))
        archive.writestr('tag_bank_1.json', write_json(list(tag_bank.values())))
        archive.writestr('NOTICE.txt', ATTRIBUTION + '\n\n' + LIMITATION + '\n')
        archive.writestr('source-senses.json', write_json(provenance))
    provenance['archiveSha256'] = hashlib.sha256(output.read_bytes()).hexdigest()
    receipt = output.with_suffix('.receipt.json')
    receipt.write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'archive': str(output), 'receipt': str(receipt), 'entryCount': 3,
                      'sourceSenseCount': provenance['sourceSenseCount'], 'termRowCount': len(terms),
                      'bytes': output.stat().st_size}, ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--seed', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    export(args.seed, args.output)
