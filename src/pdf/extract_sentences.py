import os
import re
import nltk
from nltk.tokenize.punkt import PunktSentenceTokenizer, PunktParameters

# Download required tokenizer model
nltk.download('punkt')

# Add custom abbreviation types (all lowercase for Punkt)
punkt_param = PunktParameters()
punkt_param.abbrev_types = set([
    'et al', 'fig', 'dr', 'vs', 'e.g', 'i.e', 'prof', 'inc', 'ref', 'no',
    'mr', 'ms', 'mrs', 'n.s', 'a.c', 'b.w', 'a.w', 'a.m', 'p', 'etc', 'ltd', 'co'
])
tokenizer = PunktSentenceTokenizer(punkt_param)

# Input/output paths
input_dir = 'articles_paragraphs_text'
output_dir = 'articles_sentences'
os.makedirs(output_dir, exist_ok=True)

# Clean line breaks and spacing
def clean_paragraph(paragraph: str) -> str:
    paragraph = re.sub(r'\n+', ' ', paragraph)
    paragraph = re.sub(r'\s+', ' ', paragraph).strip()
    return paragraph

# Protect edge cases before tokenizing
def preprocess_text(text: str) -> str:
    # Initials like A.M. or B.W.
    text = re.sub(r'\b([A-Z])\.\s([A-Z])\.', r'\1__DOT__ \2__DOT__', text)

    # Numbered list items like (1).
    text = re.sub(r'\((\d+)\)\.\s+', r'(\1)__DOT__ ', text)

    # Protect "et al."
    text = re.sub(r'\bet al\.\s*(\(|[A-Z])', r'et al__DOT__ \1', text)

    # Protect page citation like "p. 14)"
    text = re.sub(r'\bp\.\s*(\d+)\)', r'p__DOT__ \1)', text)

    # Other abbreviations including ltd
    text = re.sub(
        r'\b(et al|e\.g|i\.e|vs|Fig|Ref|No|Dr|Prof|p|etc|Ltd|Co)\.\s+',
        lambda m: m.group(1).replace('.', '__DOT__') + '__DOT__ ',
        text
    )

    return text

# Restore dot placeholders
def postprocess_sentences(sentences):
    return [s.replace('__DOT__', '.') for s in sentences]

# Process files
for filename in os.listdir(input_dir):
    if filename.endswith('.txt'):
        with open(os.path.join(input_dir, filename), 'r', encoding='utf-8') as f:
            raw_text = f.read()

        paragraphs = raw_text.split('\n\n')
        all_sentences = []

        for paragraph in paragraphs:
            cleaned = clean_paragraph(paragraph)
            if cleaned:
                preprocessed = preprocess_text(cleaned)
                sentences = tokenizer.tokenize(preprocessed)
                sentences = postprocess_sentences(sentences)

                # Skip sentences with less than 10 non-space chars
                sentences = [s for s in sentences if len(s.strip()) >= 10]
                all_sentences.extend(sentences)

        # Write without trailing newline
        with open(os.path.join(output_dir, filename), 'w', encoding='utf-8') as out:
            out.write('\n'.join(s.strip() for s in all_sentences))

        print(f"✅ Extracted sentences from {filename}")
