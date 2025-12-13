# Open Access Article Processing Pipeline

This project automates the workflow of downloading open-access scientific articles from Europe PMC, processing them into text, and preparing them for analysis.

## 📋 Requirements

Install the necessary Python libraries:

```bash
pip install requests beautifulsoup4 lxml nltk
```

## 🚀 Workflow Steps

Run the scripts in the following order:

### 1. Download Articles

Fetches HTML articles based on the query (`OPEN_ACCESS:Y`) and saves them to the `articles_html/` directory.

```bash
python download_articles.py
```

### 2. Extract Paragraphs

Converts HTML files to clean text, removing irrelevant sections (references, authors, etc.), and saves them to `articles_paragraphs_text/`.

```bash
python extract_paragraphs.py
```

### 3. Manual Review (Important)

Check the `articles_paragraphs_text/` folder manually. Delete any files that are empty or contain invalid data to ensure the dataset is clean.

### 4. Extract Sentences

Converts the paragraph text into a line-by-line sentence format using NLTK (handling abbreviations correctly) and saves them to `articles_sentences/`.

```bash
python extract_sentences.py
```

### 5. Generate File List

Creates a `list.json` file containing the filenames. This list is used by the frontend or analysis scripts to iterate through the articles.

```bash
python generateList.py
```

---

## 📂 Directory Structure

- **articles_html/**: Raw HTML files downloaded from the API.
- **articles_paragraphs_text/**: Cleaned text files (organized by paragraphs).
- **articles_sentences/**: Processed text files (one sentence per line).
- **list.json**: JSON index of the available text files.

```

```
