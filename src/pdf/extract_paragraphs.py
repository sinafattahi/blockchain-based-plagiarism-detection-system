import os
from bs4 import BeautifulSoup

html_dir = 'articles_html'
output_dir = 'articles_paragraphs_text'
os.makedirs(output_dir, exist_ok=True)

min_length = 50

stop_sections = [
    'Author Contributions',
    'Ethics Statement',
    'Conflicts of Interest',
    'Data Availability Statement',
    'Data availability',
    'Footnotes',
    'References',
    'Human subjects',
    'Payment/services info',
    'Financial relationships',
    'Other relationships'
]

for filename in os.listdir(html_dir):
    if not filename.endswith('.html'):
        continue

    file_path = os.path.join(html_dir, filename)
    with open(file_path, 'r', encoding='utf-8') as file:
        soup = BeautifulSoup(file, 'lxml')

    abstract_tag = soup.find('h2', string=lambda s: s and 'ABSTRACT' in s.upper())
    content_tags = []

    if abstract_tag:
        # Start collecting tags after ABSTRACT
        tags = abstract_tag.find_all_next()
    else:
        # No ABSTRACT tag, use the whole document
        tags = soup.body.find_all(True) if soup.body else []

    for tag in tags:
        # اگر به یک بخش با عنوان استاپ رسیدیم، پردازش رو متوقف کنیم
        if tag.name == 'h2' and tag.string:
            heading_text = tag.string.strip().lower()
            if any(stop.lower() in heading_text for stop in stop_sections):
                break

        if tag.name == 'p':
            text = tag.get_text(strip=True)

            # اگر متن شامل هرکدوم از عبارات استاپ بود، ردش کن
            if any(stop.lower() in text.lower() for stop in stop_sections):
                continue

            # فقط پاراگراف‌های بزرگتر از حداقل طول و پایان‌یافته با نقطه رو ذخیره کن
            if len(text) >= min_length and text.endswith('.'):
                content_tags.append(text)

    if content_tags:
        out_path = os.path.join(output_dir, filename.replace('.html', '.txt'))
        with open(out_path, 'w', encoding='utf-8') as out_file:
            out_file.write('\n\n'.join(content_tags))
        print(f"✅ Saved: {filename}")
    else:
        print(f"⚠️ No valid paragraphs in {filename}")
