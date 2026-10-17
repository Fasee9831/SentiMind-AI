import os
import io
import re
import csv
import string
from flask import Flask, render_template, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
import nltk
import pypdf
import docx
import pandas as pd

# Configure NLTK data directory (supports read-only serverless platforms like Vercel)
nltk_data_dir = os.path.join('/tmp', 'nltk_data') if os.path.exists('/tmp') else os.path.join(os.path.expanduser('~'), 'nltk_data')
try:
    os.makedirs(nltk_data_dir, exist_ok=True)
except Exception:
    pass
if nltk_data_dir not in nltk.data.path:
    nltk.data.path.append(nltk_data_dir)

try:
    nltk.data.find('sentiment/vader_lexicon.zip')
except LookupError:
    try:
        nltk.download('vader_lexicon', download_dir=nltk_data_dir, quiet=True)
    except Exception as e:
        print(f"Notice: NLTK lexicon download deferred: {e}")

from nltk.sentiment.vader import SentimentIntensityAnalyzer

# Fallback structures
ENGLISH_STOPWORDS = {"i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you", "your", "yours", "yourself", "yourselves", "he", "him", "his", "himself", "she", "her", "hers", "herself", "it", "its", "itself", "they", "them", "their", "theirs", "themselves", "what", "which", "who", "whom", "this", "that", "these", "those", "am", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "having", "do", "does", "did", "doing", "a", "an", "the", "and", "but", "if", "or", "because", "as", "until", "while", "of", "at", "by", "for", "with", "about", "against", "between", "into", "through", "during", "before", "after", "above", "below", "to", "from", "up", "down", "in", "out", "on", "off", "over", "under", "again", "further", "then", "once", "here", "there", "when", "where", "why", "how", "all", "any", "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "s", "t", "can", "will", "just", "don", "should", "now"}

ALLOWED_EXTENSIONS = {'xlsx', 'xls', 'csv', 'pdf', 'docx', 'txt', 'md', 'log'}
MAX_TEXT_LENGTH = 1000000  # Cap analysis input at 1M characters

app = Flask(__name__)
# 32 MB max upload limit
app.config['MAX_CONTENT_LENGTH'] = 32 * 1024 * 1024

# Custom lexicon enhancements for modern product, service, and customer feedback
CUSTOM_FEEDBACK_LEXICON = {
    # Modern Positive
    'flawless': 3.0,
    'phenomenal': 3.2,
    'intuitive': 2.4,
    'seamless': 2.5,
    'top-notch': 3.0,
    'game-changer': 2.9,
    'gamechanger': 2.9,
    'superb': 2.8,
    'delightful': 2.7,
    'exceeded': 2.4,
    'responsive': 2.2,
    'streamlined': 2.1,
    'recommended': 2.5,
    'worthwhile': 2.2,
    'affordable': 2.3,
    'budget-friendly': 2.1,
    'lifesaver': 2.8,
    'love': 3.2,
    
    # Modern Negative
    'unusable': -3.2,
    'unresponsive': -2.7,
    'buggy': -2.5,
    'glitchy': -2.4,
    'frustrating': -2.7,
    'overpriced': -2.6,
    'expensive': -2.4,
    'costly': -2.0,
    'crashes': -2.8,
    'crashed': -2.8,
    'crashing': -2.8,
    'laggy': -2.4,
    'clunky': -2.4,
    'subpar': -2.6,
    'disappointing': -2.6,
    'rip-off': -3.2,
    'scam': -3.5,
    'deceptive': -3.0,
    'unhelpful': -2.5,
    'broken': -2.7,
    'flawed': -2.3,
    'headache': -2.4,
    'downtime': -2.4,
    'terrible': -3.1,
    'awful': -3.0,
    'horrible': -3.0
}

# Initialize VADER Sentiment Intensity Analyzer with enhanced vocabulary
try:
    sid = SentimentIntensityAnalyzer()
    if sid:
        sid.lexicon.update(CUSTOM_FEEDBACK_LEXICON)
except Exception as e:
    print(f"Error initializing SentimentIntensityAnalyzer: {e}")
    sid = None

def get_word_tokens(text):
    try:
        from nltk.tokenize import word_tokenize
        return word_tokenize(text.lower())
    except Exception:
        return re.findall(r'\b\w+\b', text.lower())

def get_stopwords_set():
    try:
        from nltk.corpus import stopwords
        return set(stopwords.words('english'))
    except Exception:
        return ENGLISH_STOPWORDS

def format_file_size(size_bytes):
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    else:
        return f"{size_bytes / (1024 * 1024):.2f} MB"

def categorize_column(col_name, series):
    """
    Rigorously categorizes a column to ensure ID/numeric/metadata columns
    are NEVER mistaken for review text.
    Returns: category, score, label, avg_words, avg_chars
    """
    col_str = str(col_name).strip()
    col_lower = col_str.lower()
    non_empty = [str(s).strip() for s in series.dropna() if str(s).strip() and str(s).lower() != 'nan']

    if not non_empty:
        return 'EMPTY', -2000, 'Empty Column', 0, 0

    total_rows = len(non_empty)
    avg_words = sum(len(s.split()) for s in non_empty) / total_rows
    avg_chars = sum(len(s) for s in non_empty) / total_rows

    numeric_count = sum(1 for s in non_empty if re.match(r'^-?\d+(\.\d+)?$', s))
    numeric_ratio = numeric_count / total_rows

    # Check for ID patterns (including review_id, reviewer_id, order_id, etc.)
    is_id_header = bool(
        re.search(r'(^|[\b_\-\s])(id|uuid|guid|code|sku|asin|key|num|number|no|index)([\b_\-\s]|$)', col_lower)
        or col_lower.endswith(('_id', ' id', 'id', '_no', '_num', '_code', '_key'))
        or col_lower in {'id', 'uuid', 'guid', 'sku', 'asin', 'key', 'no', 'num', 'number'}
    )

    # Check for Rating / Numeric Score patterns
    is_rating_header = bool(
        re.search(r'(^|[\b_\-\s])(rating|score|star|stars|rank|grade|votes?|helpful)([\b_\-\s]|$)', col_lower)
    )

    # Check for Date / Time patterns
    is_date_header = bool(
        re.search(r'(^|[\b_\-\s])(date|time|timestamp|created|updated|year|month|day)([\b_\-\s]|$)', col_lower)
    )

    # Check for User / Author / Link / Price patterns
    is_meta_header = bool(
        re.search(r'(^|[\b_\-\s])(user|author|reviewer|customer|name|email|url|link|href|price|cost|status|verified|location|city|country|state)([\b_\-\s]|$)', col_lower)
    )

    # Explicit Review / Feedback header (ONLY valid if NOT an ID column)
    is_review_header = bool(
        re.search(r'(^|[\b_\-\s])(review|reviews|comment|comments|feedback|text|content|description|body|message|opinion|critique|testimonial|summary)([\b_\-\s]|$)', col_lower)
        and not is_id_header
    )

    # 1. Rating / Score Column
    if is_rating_header:
        category = 'RATING'
        label = 'Rating / Score (Ignored)'
        score = -800

    # 2. Definite ID Column (heavily disqualified)
    elif is_id_header or (numeric_ratio > 0.8 and avg_words <= 1.5) or (avg_words <= 1.2 and avg_chars <= 16 and is_id_header):
        category = 'ID'
        label = 'ID / Identifier (Ignored)'
        score = -1000 + min(avg_words, 5)

    # 3. Date / Time Column
    elif is_date_header:
        category = 'DATE'
        label = 'Date / Time (Ignored)'
        score = -700

    # 4. Author / Metadata Column (short text)
    elif is_meta_header and avg_words < 3.5:
        category = 'METADATA'
        label = 'User / Author / Link (Ignored)'
        score = -500

    # 5. Review Text Candidate
    else:
        category = 'REVIEW'
        label = 'Review Content'
        score = 100
        # Heavily reward natural sentence length and word density
        score += min(avg_words * 25, 350)
        score += min(avg_chars * 0.5, 120)

        if is_review_header:
            score += 500
            label = 'Review Text (Recommended)'

        # If it's very short, downgrade to short attribute
        if avg_words < 2.0:
            score -= 250
            category = 'SHORT_TEXT'
            label = 'Short Text / Tag'

    return category, score, label, round(avg_words, 1), round(avg_chars, 1)

def find_best_review_column(df):
    """
    Scans and categorizes all columns in the spreadsheet.
    Identifies the single best review text column and guarantees
    that ID/numeric columns are NEVER chosen.
    """
    columns = [str(c) for c in df.columns]
    if not columns:
        return None, {}, [], []

    columns_metadata = []
    col_reviews_map = {}
    best_col = None
    best_score = -999999

    for col in columns:
        series = df[col].dropna().astype(str)
        non_empty = [s.strip() for s in series if s.strip() and s.lower() != 'nan']
        col_reviews_map[col] = non_empty[:3000]

        cat, score, label, avg_w, avg_c = categorize_column(col, series)

        col_meta = {
            'name': col,
            'category': cat,
            'label': label,
            'score': score,
            'avg_words': avg_w,
            'avg_chars': avg_c,
            'total_rows': len(non_empty),
            'is_review': (cat == 'REVIEW'),
            'is_id': (cat == 'ID')
        }
        columns_metadata.append(col_meta)

        if score > best_score:
            best_score = score
            best_col = col

    # Fallback safety: If best_col has negative score (e.g. all columns lacked review keywords),
    # pick the non-ID column with the highest average words.
    if best_score < 0:
        non_id_cols = [c for c in columns_metadata if c['category'] not in {'ID', 'RATING', 'DATE', 'EMPTY'}]
        if non_id_cols:
            non_id_cols.sort(key=lambda x: x['avg_words'], reverse=True)
            best_col = non_id_cols[0]['name']

    # Final fallback if still None
    if not best_col and columns:
        best_col = columns[0]

    return best_col, col_reviews_map, columns, columns_metadata

def parse_reviews_from_text(text):
    if not text or not text.strip():
        return []

    # Numbered items (e.g. 1. Great product\n2. Terrible service)
    numbered = re.split(r'\n(?=(?:\d+[\.\)]|(?:Review|Comment|Feedback)\s*#?\d*[:\-])\s+)', text, flags=re.IGNORECASE)
    if len(numbered) >= 3:
        cleaned = [r.strip() for r in numbered if len(r.strip()) > 5]
        if len(cleaned) >= 2:
            return cleaned

    # Bullet points
    bullets = re.split(r'\n(?=[•\-\*]\s+)', text)
    if len(bullets) >= 3:
        cleaned = [re.sub(r'^[•\-\*]\s+', '', r).strip() for r in bullets if len(r.strip()) > 5]
        if len(cleaned) >= 2:
            return cleaned

    # Double newlines
    paragraphs = [p.strip() for p in re.split(r'\n\s*\n', text) if len(p.strip()) > 15]
    if len(paragraphs) >= 2:
        return paragraphs

    # Single lines
    lines = [l.strip() for l in text.splitlines() if len(l.strip()) > 15]
    if len(lines) >= 2:
        return lines

    return [text.strip()]

def extract_text_from_file(file_storage):
    original_name = file_storage.filename or "uploaded_document"
    safe_name = secure_filename(original_name) or "document"
    ext = original_name.rsplit('.', 1)[1].lower() if '.' in original_name else ''
    
    if ext not in ALLOWED_EXTENSIONS:
        return None, f"Unsupported file extension .{ext}. Allowed: Excel (.xlsx, .xls), CSV, PDF, Word (.docx), TXT, MD.", {}, []
        
    content_bytes = file_storage.read()
    file_size_bytes = len(content_bytes)
    
    if file_size_bytes == 0:
        return None, "The uploaded file is empty.", {}, []
        
    file_stream = io.BytesIO(content_bytes)
    extracted_text = ""
    units_count = 0
    unit_label = "pages"
    parsed_reviews = []
    columns_list = []
    columns_metadata = []
    selected_column = None
    column_reviews_map = {}
    is_spreadsheet = False

    # 1. EXCEL SPREADSHEETS (.xlsx, .xls)
    if ext in {'xlsx', 'xls'}:
        try:
            df = pd.read_excel(file_stream)
            if df.empty:
                return None, "The Excel worksheet is empty.", {}, []
            best_col, col_reviews_map, columns_list, columns_metadata = find_best_review_column(df)
            selected_column = best_col
            column_reviews_map = col_reviews_map
            parsed_reviews = col_reviews_map.get(best_col, [])
            units_count = len(parsed_reviews)
            unit_label = "reviews"
            extracted_text = "\n\n".join(parsed_reviews)
            is_spreadsheet = True
            if not extracted_text.strip():
                return None, f"No readable text rows found in review column '{best_col}'.", {}, []
        except Exception as e:
            return None, f"Excel file read error: {str(e)}", {}, []

    # 2. CSV SPREADSHEETS (.csv)
    elif ext == 'csv':
        try:
            # Detect encoding
            text_content = None
            for enc in ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252']:
                try:
                    text_content = content_bytes.decode(enc)
                    break
                except UnicodeDecodeError:
                    continue
            if not text_content:
                text_content = content_bytes.decode('utf-8', errors='replace')

            # Sniff delimiter
            sample = text_content[:4096]
            delimiter = ','
            try:
                dialect = csv.Sniffer().sniff(sample, delimiters=',;\t|')
                delimiter = dialect.delimiter
            except Exception:
                delimiter = ','

            df = pd.read_csv(io.StringIO(text_content), delimiter=delimiter)
            if df.empty:
                return None, "The CSV file is empty.", {}, []
            best_col, col_reviews_map, columns_list, columns_metadata = find_best_review_column(df)
            selected_column = best_col
            column_reviews_map = col_reviews_map
            parsed_reviews = col_reviews_map.get(best_col, [])
            units_count = len(parsed_reviews)
            unit_label = "reviews"
            extracted_text = "\n\n".join(parsed_reviews)
            is_spreadsheet = True
            if not extracted_text.strip():
                return None, f"No readable text rows found in review column '{best_col}'.", {}, []
        except Exception as e:
            return None, f"CSV file read error: {str(e)}", {}, []

    # 3. PDF DOCUMENTS (.pdf)
    elif ext == 'pdf':
        try:
            reader = pypdf.PdfReader(file_stream)
            units_count = len(reader.pages)
            unit_label = "pages"
            
            if reader.is_encrypted:
                try:
                    reader.decrypt('')
                except Exception:
                    return None, "This PDF is password-protected.", {}, []

            pages_text = []
            for page in reader.pages:
                txt = page.extract_text() or ''
                if txt.strip():
                    pages_text.append(txt.strip())
            
            extracted_text = "\n\n".join(pages_text)
            if not extracted_text.strip():
                return None, "No readable text found in PDF. Scanned PDFs require OCR.", {}, []
        except Exception as e:
            return None, f"PDF Extraction Error: {str(e)}", {}, []

    # 4. WORD DOCUMENTS (.docx)
    elif ext == 'docx':
        try:
            doc = docx.Document(file_stream)
            paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
            units_count = len(paragraphs)
            unit_label = "paragraphs"
            extracted_text = "\n\n".join(paragraphs)
            
            if not extracted_text.strip():
                return None, "The Word document contains no readable text paragraphs.", {}, []
        except Exception as e:
            return None, f"Word Extraction Error: {str(e)}", {}, []

    # 5. TEXT & MARKDOWN (.txt, .md, .log)
    elif ext in {'txt', 'md', 'log'}:
        unit_label = "lines"
        for encoding in ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252']:
            try:
                extracted_text = content_bytes.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        else:
            extracted_text = content_bytes.decode('utf-8', errors='replace')

        lines = [line for line in extracted_text.splitlines() if line.strip()]
        units_count = len(lines)
        if not extracted_text.strip():
            return None, "The text file is empty.", {}, []

    if not parsed_reviews:
        parsed_reviews = parse_reviews_from_text(extracted_text)

    is_batch = len(parsed_reviews) >= 2
    words = get_word_tokens(extracted_text)
    
    metadata = {
        'filename': original_name,
        'extension': ext.upper(),
        'file_size': file_size_bytes,
        'file_size_formatted': format_file_size(file_size_bytes),
        'units': units_count,
        'unit_label': unit_label,
        'word_count': len(words),
        'char_count': len(extracted_text),
        'is_batch': is_batch,
        'review_count': len(parsed_reviews),
        'is_spreadsheet': is_spreadsheet,
        'columns': columns_list,
        'columns_metadata': columns_metadata,
        'selected_column': selected_column,
        'column_reviews': column_reviews_map
    }

    return extracted_text.strip(), None, metadata, parsed_reviews

def preprocess_feedback_text(text):
    """
    Normalizes feedback text so domain nouns (e.g., 'customer support', 'tech support')
    are treated as neutral entities rather than emotive verbs.
    """
    if not text:
        return ""
    cleaned = re.sub(
        r'\b(customer|tech|technical|product|client|phone|email|helpdesk)\s+support\b',
        r'\1_desk',
        text,
        flags=re.IGNORECASE
    )
    return cleaned

def analyze_dominant_sentiment(text_sample):
    """
    Determines overall dominant sentiment strictly into three classes: Positive, Negative, or Neutral.
    Handles discourse contrast ('but', 'however', 'although', 'yet', 'unfortunately'),
    evaluates clause emphasis, and computes a calibrated confidence level.
    """
    if not sid or not text_sample:
        return 'Neutral 😐', 'neutral', 0.0, 'Low', 50, 'Insufficient text to determine sentiment.'

    processed_text = preprocess_feedback_text(text_sample)
    base_scores = sid.polarity_scores(processed_text)
    base_compound = base_scores['compound']

    contrast_pattern = re.compile(
        r'\b(but|however|yet|although|though|even though|nevertheless|nonetheless|except that|unfortunately|on the other hand)\b',
        re.IGNORECASE
    )

    contrast_match = contrast_pattern.search(processed_text)
    has_contrast = bool(contrast_match)
    
    if contrast_match:
        idx = contrast_match.start()
        clause_pre = processed_text[:idx].strip()
        clause_post = processed_text[contrast_match.end():].strip()

        pre_scores = sid.polarity_scores(clause_pre)
        post_scores = sid.polarity_scores(clause_post)

        # In natural language contrastive structures, the post-contrast clause carries
        # the speaker's updated takeaway and overriding communicative emphasis.
        if abs(post_scores['compound']) >= 0.10:
            weighted_comp = (pre_scores['compound'] * 0.35) + (post_scores['compound'] * 1.65)
            compound = max(-1.0, min(1.0, round(weighted_comp, 3)))
        else:
            compound = base_compound
    else:
        compound = base_compound

    # Three-Class Classification: Exactly Positive, Negative, or Neutral
    if compound >= 0.08:
        sentiment = 'Positive 😄'
        class_name = 'positive'
        if compound >= 0.45:
            confidence = 'High'
            conf_pct = min(98, round(75 + (compound * 23)))
            conf_msg = 'Clear and strong positive approval expressed throughout the text.'
        else:
            confidence = 'Moderate'
            conf_pct = min(84, round(60 + (compound * 30)))
            conf_msg = 'Dominant positive sentiment with favorable overall impression.'
            if has_contrast:
                conf_msg += ' (Contrasting remarks resolved in favor of positive outcome).'
    elif compound <= -0.08:
        sentiment = 'Negative 😔'
        class_name = 'negative'
        if compound <= -0.45:
            confidence = 'High'
            conf_pct = min(98, round(75 + (abs(compound) * 23)))
            conf_msg = 'Strong dissatisfaction, criticism, or critical issues identified.'
        else:
            confidence = 'Moderate'
            conf_pct = min(84, round(60 + (abs(compound) * 30)))
            conf_msg = 'Dominant negative sentiment with critical friction points.'
            if has_contrast:
                conf_msg += ' (Critical takeaway outweighed initial positive remarks).'
    else:
        sentiment = 'Neutral 😐'
        class_name = 'neutral'
        if base_scores['neu'] >= 0.85:
            confidence = 'High'
            conf_pct = 92
            conf_msg = 'Primarily factual and informational statement with minimal emotional bias.'
        else:
            confidence = 'Low'
            conf_pct = 56
            conf_msg = 'Balanced points detected with no single dominant emotional direction; categorized as Neutral.'

    return sentiment, class_name, compound, confidence, conf_pct, conf_msg

def generate_suggested_improvements(text, sentiment_category, compound, pos_drivers, neg_drivers, batch_analysis=None):
    """
    Generates user-friendly, empathetic, and actionable recommendations based on actual content:
    - Positive: Ways to celebrate, reward fans, share social proof, and keep momentum high.
    - Negative: Clear, compassionate fixes for friction points with practical "Next Step" advice.
    - Neutral: Engaging ideas to delight casual users and turn them into fans.
    - Context-Aware: Acknowledges both highlights and hiccups while respecting the dominant sentiment.
    """
    text_lower = text.lower() if text else ""
    improvements = []
    
    # Topic detectors
    has_support = bool(re.search(r'\b(support|service|agent|help|staff|ticket|response|reply|rep|representative|care)\b', text_lower))
    has_product = bool(re.search(r'\b(product|quality|feature|app|tool|bug|crash|error|slow|performance|interface|ui|ux|glitch|freeze|broken)\b', text_lower))
    has_pricing = bool(re.search(r'\b(price|pricing|cost|expensive|cheap|fee|value|billing|subscription|charge|refund|money)\b', text_lower))
    has_delivery = bool(re.search(r'\b(delivery|shipping|ship|order|package|arrived|delay|late|transit|courier|box|dispatch)\b', text_lower))

    if sentiment_category == 'negative':
        # Negative Sentiment: Clear, compassionate, immediate fixes
        if has_support:
            improvements.append({
                'icon': '💬',
                'title': 'Speed Up Customer Support Replies',
                'category': 'Customer Care',
                'priority': 'Needs Attention',
                'description': 'Customers feel stuck waiting for help or felt their issues weren\'t fully heard. A quick, empathetic reply can quickly turn frustration into relief.',
                'action': 'Prioritize unanswered support tickets and send customers a reassuring, personalized update today.'
            })
        if has_product:
            improvements.append({
                'icon': '🛠️',
                'title': 'Fix Annoying Glitches & Boost Speed',
                'category': 'Product Experience',
                'priority': 'Needs Attention',
                'description': 'Users ran into bugs, lags, or crashes that disrupted what they were trying to do. Smoothing these out restores confidence right away.',
                'action': 'Review recent error logs, reproduce the reported bug, and roll out a quick stability fix.'
            })
        if has_pricing:
            improvements.append({
                'icon': '🏷️',
                'title': 'Make Pricing & Value Crystal Clear',
                'category': 'Pricing & Billing',
                'priority': 'Quick Win',
                'description': 'Feedback suggests customers feel surprised by costs or aren\'t sure they got their money\'s worth. Being upfront builds lasting trust.',
                'action': 'Add a simple breakdown of what is included in each plan and ensure invoices are easy to understand.'
            })
        if has_delivery:
            improvements.append({
                'icon': '📦',
                'title': 'Keep Buyers Updated on Shipping',
                'category': 'Shipping & Orders',
                'priority': 'Needs Attention',
                'description': 'Waiting for deliveries without clear updates creates stress. Proactive tracking gives customers peace of mind while they wait.',
                'action': 'Set up automated dispatch emails or SMS with live tracking links and realistic arrival dates.'
            })
        if not improvements:
            improvements.append({
                'icon': '🤝',
                'title': 'Reach Out Personally to Make Things Right',
                'category': 'Customer Retention',
                'priority': 'Needs Attention',
                'description': 'When someone has an unhappy experience, a genuine apology and human gesture can win back their loyalty for good.',
                'action': 'Send a friendly follow-up email apologizing for the inconvenience and offer a helpful solution.'
            })

        # If text also had positive highlights, remind them what to keep doing!
        if len(pos_drivers) > 0:
            top_pos_word = pos_drivers[0]['word']
            improvements.append({
                'icon': '⭐',
                'title': f'Keep Protecting What Worked: "{top_pos_word.title()}"',
                'category': 'Your Strength',
                'priority': 'Keep Doing This!',
                'description': f'Even with the criticism, customers appreciated aspects related to "{top_pos_word}". Make sure any fixes don\'t accidentally change what people already like.',
                'action': f'Let your team know "{top_pos_word}" is a recognized highlight and safeguard it.'
            })

    elif sentiment_category == 'positive':
        # Positive Sentiment: Celebrate, reward fans, and keep standards high
        top_pos = pos_drivers[0]['word'] if pos_drivers else "quality"
        improvements.append({
            'icon': '⭐',
            'title': f'Showcase Praise for "{top_pos.title()}"',
            'category': 'Marketing & Social Proof',
            'priority': 'Growth Opportunity',
            'description': f'Happy customers are raving about "{top_pos}"! Real quotes from real people are the most persuasive recommendation you can share.',
            'action': 'Highlight this review on your website, social channels, or sales materials as proof of quality.'
        })
        improvements.append({
            'icon': '🎁',
            'title': 'Invite Delighted Users to Refer Friends',
            'category': 'Referrals & Community',
            'priority': 'Quick Win',
            'description': 'When people love your product, they\'re naturally excited to tell colleagues and friends. A small incentive makes sharing effortless.',
            'action': 'Send a warm thank-you message with an easy referral link or exclusive loyalty perk.'
        })
        improvements.append({
            'icon': '🏆',
            'title': 'Celebrate this Success with Your Team',
            'category': 'Team Morale',
            'priority': 'Keep Doing This!',
            'description': 'Positive feedback is proof that your hard work is paying off! Sharing the love keeps team energy and standards high.',
            'action': 'Share this shout-out in your team chat or morning huddle to celebrate the win.'
        })

        # Minor negative caveats if any were found
        if len(neg_drivers) > 0:
            top_neg_word = neg_drivers[0]['word']
            improvements.append({
                'icon': '✨',
                'title': f'Polish the Small Hiccup: "{top_neg_word.title()}"',
                'category': 'Finishing Touch',
                'priority': 'Quick Win',
                'description': f'The overall experience was great, but they noted a slight bump around "{top_neg_word}". Polishing this makes the journey 100% delightful.',
                'action': f'Review the "{top_neg_word}" touchpoint to eliminate the last piece of friction.'
            })

    else:
        # Neutral Sentiment: Friendly, engaging ways to turn neutral users into fans
        if has_product or has_pricing or has_support:
            improvements.append({
                'icon': '💡',
                'title': 'Spotlight Your Best Features',
                'category': 'Product Highlights',
                'priority': 'Growth Opportunity',
                'description': 'Neutral feedback usually means users found everything okay, but missed the "wow" factor. Showcasing cool shortcuts or time-savers sparks real excitement.',
                'action': 'Highlight a top feature with a 15-second visual tip or quick demonstration banner.'
            })
        improvements.append({
            'icon': '❓',
            'title': 'Ask a Friendly 1-Question Check-In',
            'category': 'Quick Feedback',
            'priority': 'Quick Win',
            'description': 'Casual users rarely fill out long forms, but love answering one simple question. Their thoughts can give you the secret to making them super fans.',
            'action': 'Ask: "What is one little thing that would make this an absolute 10/10 for you?"'
        })
        improvements.append({
            'icon': '🚀',
            'title': 'Make the First Steps Even Easier',
            'category': 'User Experience',
            'priority': 'Growth Opportunity',
            'description': 'Sometimes people stay neutral simply because they haven\'t explored all the benefits yet. A friendly tip or starter guide helps them hit the ground running.',
            'action': 'Add a quick 3-step checklist to guide new users to their first quick win.'
        })

    return improvements[:4]

def analyze_batch_reviews(reviews_list):
    if not sid or not reviews_list:
        return None

    scored_reviews = []
    pos_count = 0
    neg_count = 0
    neu_count = 0
    total_compound = 0.0

    for idx, r_text in enumerate(reviews_list, start=1):
        clean_text = str(r_text).strip()
        if not clean_text or clean_text.lower() == 'nan':
            continue
        
        _, cat, comp, _, _, _ = analyze_dominant_sentiment(clean_text)
        scores = sid.polarity_scores(preprocess_feedback_text(clean_text))
        total_compound += comp

        if cat == "positive":
            pos_count += 1
        elif cat == "negative":
            neg_count += 1
        else:
            cat = "neutral"
            neu_count += 1

        scored_reviews.append({
            'id': idx,
            'text': clean_text,
            'compound': round(comp, 3),
            'sentiment': cat,
            'pos': round(scores['pos'] * 100),
            'neu': round(scores['neu'] * 100),
            'neg': round(scores['neg'] * 100)
        })

    total_count = len(scored_reviews)
    if total_count == 0:
        return None

    pos_pct = round((pos_count / total_count) * 100, 1)
    neg_pct = round((neg_count / total_count) * 100, 1)
    neu_pct = round((neu_count / total_count) * 100, 1)
    avg_compound = round(total_compound / total_count, 3)

    sorted_by_score = sorted(scored_reviews, key=lambda x: x['compound'])
    top_negative = [r for r in sorted_by_score if r['compound'] <= -0.08][:5]
    top_positive = [r for r in sorted_by_score[::-1] if r['compound'] >= 0.08][:5]

    return {
        'total_reviews': total_count,
        'pos_count': pos_count,
        'pos_pct': pos_pct,
        'neg_count': neg_count,
        'neg_pct': neg_pct,
        'neu_count': neu_count,
        'neu_pct': neu_pct,
        'avg_compound': avg_compound,
        'top_negative': top_negative,
        'top_positive': top_positive,
        'reviews': scored_reviews[:2000]
    }

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/robot/<path:filename>')
def serve_robot(filename):
    robot_dir = os.path.join(app.root_path, 'public', 'robot')
    return send_from_directory(robot_dir, filename)

@app.route('/favicon.ico')
def favicon():
    robot_dir = os.path.join(app.root_path, 'public', 'robot')
    return send_from_directory(robot_dir, 'robot_face.png', mimetype='image/png')

@app.route('/robots.txt')
def robots_txt():
    public_dir = os.path.join(app.root_path, 'public')
    return send_from_directory(public_dir, 'robots.txt', mimetype='text/plain')

@app.route('/sitemap.xml')
def sitemap_xml():
    public_dir = os.path.join(app.root_path, 'public')
    return send_from_directory(public_dir, 'sitemap.xml', mimetype='application/xml')

@app.route('/static/<path:filename>')
def serve_static(filename):
    static_dir = os.path.join(app.root_path, 'static')
    return send_from_directory(static_dir, filename)

@app.route('/extract-document', methods=['POST'])
def extract_document():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part provided in request.'}), 400
        
    file = request.files['file']
    if not file or file.filename == '':
        return jsonify({'error': 'No file selected.'}), 400

    extracted_text, error, metadata, parsed_reviews = extract_text_from_file(file)
    if error:
        return jsonify({'error': error}), 400

    return jsonify({
        'success': True,
        'text': extracted_text,
        'metadata': metadata,
        'reviews': parsed_reviews if metadata.get('is_batch') else []
    })

@app.route('/analyze', methods=['POST'])
def analyze():
    if not sid:
        return jsonify({'error': 'Sentiment analyzer not initialized properly on server.'}), 500
        
    data = request.get_json() or {}
    text = data.get('text', '').strip()
    document_info = data.get('document_info', None)
    provided_reviews = data.get('reviews', None)
    
    if not text and not provided_reviews:
        return jsonify({'error': 'No text or reviews provided for analysis.'}), 400

    reviews_to_analyze = []
    if provided_reviews and isinstance(provided_reviews, list) and len(provided_reviews) >= 2:
        reviews_to_analyze = provided_reviews
    elif text:
        segmented = parse_reviews_from_text(text)
        if len(segmented) >= 2:
            reviews_to_analyze = segmented

    batch_analysis = None
    if reviews_to_analyze and len(reviews_to_analyze) >= 2:
        batch_analysis = analyze_batch_reviews(reviews_to_analyze)

    sample_text = text[:MAX_TEXT_LENGTH] if text else " ".join([str(r) for r in reviews_to_analyze[:100]])
    
    # Classify overall sentiment strictly into Positive, Negative, or Neutral
    sentiment, class_name, compound, confidence, conf_pct, conf_msg = analyze_dominant_sentiment(sample_text)
    
    # If batch analysis exists, determine dominant category from aggregate reviews
    if batch_analysis:
        compound = batch_analysis['avg_compound']
        if compound >= 0.08:
            sentiment = "Positive 😄"
            class_name = "positive"
            confidence = 'High' if compound >= 0.45 else 'Moderate'
            conf_pct = min(98, round(75 + (compound * 23)))
            conf_msg = f"Dominant positive approval across {batch_analysis['total_reviews']} analyzed entries."
        elif compound <= -0.08:
            sentiment = "Negative 😔"
            class_name = "negative"
            confidence = 'High' if compound <= -0.45 else 'Moderate'
            conf_pct = min(98, round(75 + (abs(compound) * 23)))
            conf_msg = f"Dominant critical feedback across {batch_analysis['total_reviews']} analyzed entries."
        else:
            sentiment = "Neutral 😐"
            class_name = "neutral"
            confidence = 'Moderate'
            conf_pct = 70
            conf_msg = f"Balanced sentiment distribution across {batch_analysis['total_reviews']} analyzed entries."
        
    words = get_word_tokens(sample_text)
    word_count = len(words)
    char_count = len(sample_text)
    avg_word_len = round(sum(len(w) for w in words) / word_count, 1) if word_count > 0 else 0
    
    stop_words = get_stopwords_set()
    punctuation = set(string.punctuation)
    
    positive_drivers = []
    negative_drivers = []
    seen = set()
    
    for word in words:
        if word in stop_words or word in punctuation or len(word) < 2 or word.isdigit():
            continue
        if word in seen:
            continue
        seen.add(word)
        
        word_score = sid.polarity_scores(word)['compound']
        if word_score >= 0.15:
            positive_drivers.append({'word': word, 'score': word_score})
        elif word_score <= -0.15:
            negative_drivers.append({'word': word, 'score': word_score})
            
    positive_drivers.sort(key=lambda x: x['score'], reverse=True)
    negative_drivers.sort(key=lambda x: x['score'])
    
    scores = sid.polarity_scores(preprocess_feedback_text(sample_text))
    if batch_analysis:
        pos_pct = round(batch_analysis['pos_pct'])
        neu_pct = round(batch_analysis['neu_pct'])
        neg_pct = round(batch_analysis['neg_pct'])
    else:
        pos_pct = round(scores['pos'] * 100)
        neu_pct = round(scores['neu'] * 100)
        neg_pct = round(scores['neg'] * 100)
    
    total_pct = pos_pct + neu_pct + neg_pct
    if total_pct > 0 and total_pct != 100:
        neu_pct += (100 - total_pct)

    # Generate practical, context-aware Suggested Improvements
    improvements = generate_suggested_improvements(
        sample_text,
        class_name,
        compound,
        positive_drivers,
        negative_drivers,
        batch_analysis
    )

    return jsonify({
        'sentiment': sentiment,
        'class_name': class_name,
        'confidence': confidence,
        'confidence_pct': conf_pct,
        'confidence_message': conf_msg,
        'scores': {
            'compound': compound,
            'pos': pos_pct,
            'neu': neu_pct,
            'neg': neg_pct
        },
        'metrics': {
            'word_count': word_count,
            'char_count': char_count,
            'avg_word_len': avg_word_len,
            'review_count': batch_analysis['total_reviews'] if batch_analysis else 1
        },
        'drivers': {
            'positive': positive_drivers[:8],
            'negative': negative_drivers[:8]
        },
        'improvements': improvements,
        'batch_analysis': batch_analysis,
        'document_info': document_info
    })

@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({'error': 'Uploaded file exceeds the maximum 32MB file limit.'}), 413

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
