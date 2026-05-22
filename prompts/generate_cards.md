<!-- DRAFT v1 -->
Generate {{card_count}} flashcards for the following section of a PDF document.

Section: {{section_name}} (pages {{page_start}}-{{page_end}})
Exam context: {{exam_name}}
Enrichment context: {{enrich_context}}

Rules:
- Prefer qa and cloze types; use multiple_choice only when exam context suggests it
- Every card must include source_page, source_quote (verbatim ≤200 chars), difficulty (1-5), and 1-3 tags
- Cloze format: use {{c1::hidden}} syntax in front field; back = full unhidden version
- Multiple choice: front = question + options A-D; back = correct letter + brief justification

Call the generate_cards tool with all cards.
