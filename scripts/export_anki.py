#!/usr/bin/env python3
"""
Usage: python3 scripts/export_anki.py <input.json> <output.apkg>
Input JSON schema: { "deck_name": str, "cards": [...] }
"""
import json, sys, genanki, random

def slug(s):
    return s.lower().replace(' ', '-').replace('/', '-')

model_id = random.randrange(1 << 30, 1 << 31)
cloze_model_id = random.randrange(1 << 30, 1 << 31)

qa_model = genanki.Model(
    model_id,
    'AI Flashcard',
    fields=[
        {'name': 'Front'}, {'name': 'Back'}, {'name': 'Explanation'},
        {'name': 'Source'}, {'name': 'Tags'}, {'name': 'JudgeRationale'},
    ],
    templates=[{
        'name': 'Card 1',
        'qfmt': '{{Front}}',
        'afmt': '{{FrontSide}}<hr id="answer">{{Back}}<br><small>{{Source}}</small>',
    }],
)

cloze_model = genanki.Model(
    cloze_model_id,
    'AI Flashcard Cloze',
    model_type=genanki.Model.CLOZE,
    fields=[
        {'name': 'Text'}, {'name': 'Extra'}, {'name': 'Source'},
    ],
    templates=[{
        'name': 'Cloze Card',
        'qfmt': '{{cloze:Text}}',
        'afmt': '{{cloze:Text}}<br><small>{{Source}}</small>',
    }],
)

data = json.load(open(sys.argv[1]))
deck_name = data['deck_name']
anki_deck = genanki.Deck(random.randrange(1 << 30, 1 << 31), deck_name)

for c in data['cards']:
    source = f"Page {c.get('source_page', '?')} — \"{c.get('source_quote', '')}\""
    tags = ['ai-generated']
    if c.get('exam_name'):
        tags.append(f"exam:{slug(c['exam_name'])}")
    tags.extend(c.get('tags', []) or [])

    if c['card_type'] == 'cloze':
        note = genanki.Note(
            model=cloze_model,
            fields=[c['front'], c.get('explanation', '') or '', source],
            tags=tags,
        )
    else:
        note = genanki.Note(
            model=qa_model,
            fields=[
                c['front'],
                c['back'],
                c.get('explanation', '') or '',
                source,
                ' '.join(tags),
                c.get('judge_rationale', '') or '',
            ],
            tags=tags,
        )
    anki_deck.add_note(note)

genanki.Package(anki_deck).write_to_file(sys.argv[2])
print(f"Wrote {len(data['cards'])} cards to {sys.argv[2]}")
