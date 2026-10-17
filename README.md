# SentiMind AI - Real-Time Sentiment & Document Intelligence

A modern Flask-based web application that performs sentiment analysis on raw text and uploaded documents (PDF, Word DOCX, TXT, Markdown, CSV) using the NLTK VADER (Valence Aware Dictionary and sEntiment Reasoner) model.

## Features

- **Document Extraction & Sentiment:** Upload and extract text directly from **PDF**, **Word (.docx)**, **TXT**, **Markdown (.md)**, and **CSV** files (up to 16 MB).
- **Direct Text Input:** Real-time character & word counters, preset samples (positive review, complaint, news).
- **Interactive Preview & Edit:** Inspect and edit extracted document content before running analysis.
- **Real-Time Sentiment Classification:** Classified as **Positive 😄**, **Negative 😔**, or **Neutral 😐**.
- **Compound Polarity Score:** Precision compound metric ranging from -1.0 to +1.0 with an interactive visual needle meter.
- **Sentiment Distribution Breakdown:** Positive, Neutral, and Negative percentages with gradient progress indicators.
- **Document Highlights & Excerpts:** Automatically detects and highlights the **Most Positive Excerpt** and **Most Critical Excerpt** in multi-section texts.
- **Sentiment Drivers:** Identifies the top positive and negative vocabulary words influencing the score.
- **Comprehensive Metrics:** Word count, character count, average word length, and page/paragraph counts.
- **Modern Glassmorphic Dark UI:** Responsive layout with animated glowing blobs, accessible controls, and seamless feedback.

## Tech Stack

- **Backend:** Python 3, Flask, NLTK (VADER), `pypdf`, `python-docx`, `werkzeug`
- **Frontend:** Vanilla HTML5, Modern CSS3 (Glassmorphism & CSS Grid), JavaScript (ES6+ Fetch API)

## Project Structure

```
sentimentalanalysis/
├── app.py                 # Flask application, file extraction & analysis API
├── templates/
│   └── index.html         # Modern web dashboard with dual input modes
└── static/
    ├── css/
    │   └── style.css      # Dark glassmorphic design & responsive styles
    └── js/
        └── main.js        # Drag-and-drop file upload, extraction, & charts logic
```

## Installation

```bash
# 1. Clone the repository or navigate to the project directory
cd sentimentalanalysis

# 2. Create and activate a virtual environment (optional)
python -m venv venv
venv\Scripts\activate        # Windows
source venv/bin/activate     # Linux / macOS

# 3. Install dependencies
pip install flask nltk pypdf python-docx
```

## Usage

```bash
python app.py
```

Open your browser and navigate to **http://127.0.0.1:5000**.

- Use **Direct Text** to quickly test reviews, tweets, or messages.
- Use **Upload Document** to drag and drop PDFs, Word documents, or text files to extract and analyze entire documents.

## API Endpoints

### 1. `POST /extract-document`

Uploads and extracts readable text from supported document formats.

- **Content-Type:** `multipart/form-data`
- **Body:** `file` (Binary file: `.pdf`, `.docx`, `.txt`, `.md`, `.csv`, `.log`)

**Response (JSON):**
```json
{
  "success": true,
  "text": "Extracted document content...",
  "metadata": {
    "filename": "annual_report.pdf",
    "extension": "PDF",
    "file_size": 154200,
    "file_size_formatted": "150.6 KB",
    "units": 4,
    "unit_label": "pages",
    "word_count": 850,
    "char_count": 5200
  }
}
```

### 2. `POST /analyze`

Analyzes sentiment of text and extracts section-by-section insights.

**Request body (JSON):**
```json
{
  "text": "The new update is wonderful and fast! However, the battery drain is disappointing.",
  "document_info": {
    "filename": "annual_report.pdf",
    "units": 4,
    "unit_label": "pages"
  }
}
```

**Response (JSON):**
```json
{
  "sentiment": "Positive 😄",
  "class_name": "positive",
  "scores": {
    "compound": 0.4939,
    "pos": 24,
    "neu": 62,
    "neg": 14
  },
  "metrics": {
    "word_count": 14,
    "char_count": 83,
    "avg_word_len": 4.9,
    "section_count": 1
  },
  "drivers": {
    "positive": [{ "word": "wonderful", "score": 0.5719 }],
    "negative": [{ "word": "disappointing", "score": -0.4939 }]
  },
  "document_insights": {
    "most_positive_section": null,
    "most_negative_section": null
  },
  "document_info": { ... }
}
```

## Supported Document Formats

| Format | Extension | Engine | Extracted Unit |
| :--- | :--- | :--- | :--- |
| **PDF** | `.pdf` | `pypdf` | Pages |
| **Word Document** | `.docx` | `python-docx` | Paragraphs |
| **Plain Text** | `.txt`, `.log` | UTF-8 / Multi-encoding | Lines |
| **Markdown** | `.md` | UTF-8 | Lines |
| **CSV** | `.csv` | UTF-8 | Lines |
