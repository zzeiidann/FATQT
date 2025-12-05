"""
IDX Shareholder Analysis Module
Extracts shareholder data from IDX financial report PDFs
"""

import os
import re
import shutil
import tempfile
from typing import List, Dict, Optional

import cloudscraper
import pdfplumber

# Global cloudscraper instance for IDX
idx_scraper = cloudscraper.create_scraper(
    browser={'browser': 'chrome', 'platform': 'darwin', 'mobile': False}
)

# Temporary folder for downloaded PDFs
PDF_CACHE_DIR = os.path.join(tempfile.gettempdir(), "fatqt_pdf_cache")


# ============================================================
# IDX API FUNCTIONS
# ============================================================

def get_idx_reports(year: int, periode: str, emiten: str = "") -> Dict:
    """Search IDX financial reports by year, periode, and emiten"""
    BASE_URL = "https://www.idx.co.id/primary/ListedCompany/GetFinancialReport"
    
    periode_map = {
        "tw1": "tw1",
        "tw2": "tw2", 
        "tw3": "tw3",
        "tahunan": "audit"
    }
    
    params = {
        "indexFrom": 0,
        "pageSize": 100,
        "year": year,
        "reportType": "rdf",
        "EmitenType": "s",
        "periode": periode_map.get(periode, "tw1"),
        "kodeEmiten": emiten.upper() if emiten else "",
        "SortColumn": "KodeEmiten",
        "SortOrder": "asc",
    }
    
    response = idx_scraper.get(BASE_URL, params=params)
    
    if response.status_code != 200:
        raise Exception(f"Failed to fetch IDX reports: HTTP {response.status_code}")
    
    data = response.json()
    reports = data.get('Results', [])
    
    # Collect all PDF files
    all_files = []
    for report in reports:
        emiten_code = report.get('KodeEmiten', '')
        nama = report.get('NamaEmiten', '')
        attachments = report.get('Attachments', [])
        
        for att in attachments:
            file_type = att.get('File_Type', '')
            if file_type == '.pdf':
                all_files.append({
                    'emiten': emiten_code,
                    'company': nama,
                    'file_name': att.get('File_Name', ''),
                    'file_size_kb': round(att.get('File_Size', 0) / 1024, 1),
                    'url': f"https://www.idx.co.id{att.get('File_Path', '')}"
                })
    
    return {
        "year": year,
        "periode": periode,
        "emiten": emiten,
        "total": len(all_files),
        "files": all_files
    }


def download_pdfs(urls: List[str]) -> Dict:
    """Download PDFs from IDX"""
    os.makedirs(PDF_CACHE_DIR, exist_ok=True)
    
    downloaded = []
    errors = []
    
    for url in urls:
        try:
            file_name = url.split('/')[-1]
            save_path = os.path.join(PDF_CACHE_DIR, file_name)
            
            response = idx_scraper.get(url)
            
            if response.status_code == 200:
                with open(save_path, 'wb') as f:
                    f.write(response.content)
                
                downloaded.append({
                    'file_name': file_name,
                    'size_kb': round(len(response.content) / 1024, 1),
                    'path': save_path
                })
            else:
                errors.append({
                    'url': url,
                    'error': f"HTTP {response.status_code}"
                })
        except Exception as e:
            errors.append({
                'url': url,
                'error': str(e)
            })
    
    return {
        "downloaded": downloaded,
        "errors": errors,
        "total_downloaded": len(downloaded)
    }


def clear_cache() -> Dict:
    """Clear all downloaded PDF cache"""
    if os.path.exists(PDF_CACHE_DIR):
        shutil.rmtree(PDF_CACHE_DIR)
        os.makedirs(PDF_CACHE_DIR, exist_ok=True)
    
    return {"message": "Cache cleared successfully"}


# ============================================================
# PDF SHAREHOLDER EXTRACTION FUNCTIONS
# ============================================================

def extract_shareholders_from_pdf(pdf_path: str) -> List[Dict]:
    """Extract shareholder data from PDF - handles multiple report formats"""
    
    with pdfplumber.open(pdf_path) as pdf:
        all_shareholders = []
        
        # Find pages with shareholder data
        shareholder_pages = []
        
        for page_num, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            
            # Skip table of contents
            is_toc = bool(re.search(r'daftar\s*isi|table\s*of\s*contents', text, re.IGNORECASE))
            if is_toc:
                continue
            
            # Skip pages about sales/customers
            is_sales_page = bool(re.search(r'penjualan\s*neto|net\s*sales|pelanggan\s+yang|customers?\s+which', text, re.IGNORECASE))
            if is_sales_page:
                continue
            
            # PRIMARY: Detect "Modal Saham" section header (numbered like "16. Modal Saham" or "22. Modal Saham")
            # But NOT continuation pages "(Lanjutan)" / "(Continued)" / "(lanjutan)"
            has_modal_saham_section = bool(re.search(r'\d+\.\s*Modal\s*Saham', text, re.IGNORECASE))
            # Continuation must be specifically "Modal Saham (Lanjutan)" or "Modal Saham (lanjutan)" or "(Continued)"
            is_modal_saham_continuation = bool(re.search(r'\d+\.\s*Modal\s*Saham\s*\((?:Lanjutan|lanjutan|Continued|continued)\)', text, re.IGNORECASE))
            
            # Skip only if it's SPECIFICALLY a Modal Saham continuation page
            if is_modal_saham_continuation:
                has_modal_saham_section = False
            
            # SECONDARY: "Susunan Pemegang Saham" as title within the page
            has_susunan_in_page = bool(re.search(r'Susunan\s*pemegang\s*saham', text, re.IGNORECASE))
            
            has_pemegang_saham = bool(re.search(r'pemegang\s*saham|shareholders', text, re.IGNORECASE))
            has_persentase = bool(re.search(r'persentase|percentage|ownership', text, re.IGNORECASE))
            
            # Look for shareholder data with ANY thousand separator (dot or comma)
            # Pattern: Name + large number (shares) + percentage
            has_shareholder_data = bool(re.search(
                r'(?:PT\s+[A-Za-z]|Masyarakat|Goldwave|Zurich|Muhammad|Public).+\d{1,3}[.,]\d{3}[.,\d]+.+\d{1,2}[,\.]\d{2,4}',
                text, re.IGNORECASE
            ))
            
            # Select page based on criteria - PRIORITY ORDER MATTERS
            # 1. Modal Saham section header - highest priority (both DEWA and INET style)
            if has_modal_saham_section and has_pemegang_saham:
                shareholder_pages.append((page_num, 'modal_saham'))
            # 2. Susunan Pemegang Saham with shareholder data
            elif has_susunan_in_page and has_shareholder_data:
                shareholder_pages.append((page_num, 'susunan'))
            # 3. Has shareholder table data with percentage
            elif has_shareholder_data and has_pemegang_saham and has_persentase:
                shareholder_pages.append((page_num, 'susunan'))
        
        if not shareholder_pages:
            return []
        
        # Extract data from each page
        for page_num, page_type in shareholder_pages:
            page = pdf.pages[page_num]
            text = page.extract_text() or ""
            
            # Detect dates in the page
            dates = detect_dates(text)
            
            # Parse shareholders - Modal Saham format handles both DEWA and INET style
            if page_type == 'modal_saham':
                shareholders = parse_modal_saham_format(text, dates)
            else:
                shareholders = parse_shareholders_multidate(text, dates)
            
            all_shareholders.extend(shareholders)
    
    # Remove exact duplicates
    seen = set()
    unique_shareholders = []
    for sh in all_shareholders:
        key = (sh['tanggal'], sh['pemegang_saham'], sh['jumlah_saham'])
        if key not in seen:
            seen.add(key)
            unique_shareholders.append(sh)
    
    # Sort by date (newest first) then by percentage (highest first)
    unique_shareholders.sort(key=lambda x: (x['tanggal'], -x['persentase']), reverse=True)
    
    return unique_shareholders


def parse_modal_saham_format(text: str, dates: List[str]) -> List[Dict]:
    """
    Parse "Modal Saham" / "Share Capital" format (like DEWA).
    This format has date section headers followed by shareholder data.
    
    The PDF text is bilingual with Indonesian on left, English on right.
    Example line: "PT Madhani Talatah Nusantara 10,093,210,520 24.81 504,660,526 PT Madhani Talatah Nusantara"
    
    We need to extract: name, shares, percentage from each data line.
    """
    shareholders = []
    lines = text.split('\n')
    
    # Default date
    current_date = dates[0] if dates else "Unknown"
    
    # Date section detection - look for:
    # 1. "31 Maret 2025 / March 31, 2025" (DEWA/INET style with slash)
    # 2. "31 Maret 2025" alone on a line (CBRE style - date header before table)
    date_section_pattern = re.compile(
        r'^(31\s*(?:Maret|Desember)|30\s*(?:Juni|September))\s*(\d{4})(?:\s*/|\s*$)',
        re.IGNORECASE
    )
    
    # Known shareholder patterns to look for
    shareholder_patterns = [
        # PT companies
        r'(PT\s+[A-Za-z][A-Za-z\s]+?)(?:\s+\d)',
        # Foreign companies with Ltd
        r'([A-Za-z]+\s+(?:Capital|Assets|Investment|Holdings?)\s+(?:Limited|Ltd\.?|Pte))(?:\s+\d)',
        # Masyarakat/Public
        r'(Masyarakat\s*\([^)]+\)|Public\s*\([^)]+\))',
    ]
    
    # Track pending multi-line names
    pending_name = None
    
    for i, line in enumerate(lines):
        line_stripped = line.strip()
        if not line_stripped:
            pending_name = None
            continue
        
        # Check for date section header (e.g., "31 Maret 2025 / March 31, 2025")
        date_match = date_section_pattern.match(line_stripped)
        if date_match:
            month_day = date_match.group(1).strip()
            year = date_match.group(2)
            current_date = f"{month_day} {year}"
            pending_name = None
            continue
        
        # Skip header rows
        if re.search(r'^(pemegang\s*saham|shareholders?\b|jumlah\s*saham|number\s*of|percentage|persentase)', 
                    line_stripped, re.IGNORECASE):
            pending_name = None
            continue
        
        # Skip sub-total and total rows
        if re.search(r'^(sub-?jumlah|sub-?total|jumlah\b|total\b)', line_stripped, re.IGNORECASE):
            pending_name = None
            continue
        
        # Skip section headers
        if re.search(r'^(saham\s*seri|series\s*[ab])', line_stripped, re.IGNORECASE):
            pending_name = None
            continue
        
        # Skip explanatory text
        if re.search(r'^(catatan|note|berdasarkan|based on|komposisi|composition|nama\s*pemegang)', line_stripped, re.IGNORECASE):
            pending_name = None
            continue
        
        # Check if line has share numbers (ANY thousand separator - dot or comma)
        has_numbers = re.search(r'\d{1,3}[.,]\d{3}', line_stripped)
        
        if not has_numbers:
            # This might be start of multi-line name
            # PT company name without numbers
            if re.match(r'^PT\s+[A-Za-z][A-Za-z\s]+$', line_stripped):
                pending_name = line_stripped
            # Masyarakat continuation
            elif re.match(r'^Masyarakat$', line_stripped, re.IGNORECASE):
                pending_name = "Masyarakat"
            # (masing-masing... continuation - keep Masyarakat as pending
            elif pending_name == "Masyarakat" and re.match(r'^\(masing-masing', line_stripped, re.IGNORECASE):
                # Keep pending_name as Masyarakat
                pass
            # qq. continuation for foreign company
            elif pending_name and re.match(r'^\([qQ]{2}\.', line_stripped):
                pending_name = pending_name + " " + line_stripped
            # Other name-only lines
            elif re.match(r'^[A-Za-z][A-Za-z\s]+$', line_stripped) and len(line_stripped) > 3:
                if not pending_name:
                    pending_name = line_stripped
            continue
        
        # Line has numbers - try to extract shareholder data
        result = extract_modal_saham_row_v2(line_stripped, current_date, pending_name)
        
        if result:
            shareholders.append(result)
        
        pending_name = None
    
    return shareholders


def extract_modal_saham_row_v2(line: str, current_date: str, name_prefix: Optional[str] = None) -> Optional[Dict]:
    """
    Extract shareholder from Modal Saham format row.
    Handles both:
    - DEWA style: comma thousands (10,093,210,520), dot decimals (24.81)
    - INET style: dot thousands (5.311.440.200), comma decimals (69,0717%)
    
    Valid lines must:
    1. Start with a proper shareholder name (PT..., Masyarakat, person name, or company name)
    2. Contain share count (large number)
    3. Contain percentage (XX.XX% or XX,XXXX%)
    
    Examples:
    "PT Madhani Talatah Nusantara 10,093,210,520 24.81 504,660,526 PT Madhani Talatah Nusantara"
    "Nusantara 5.311.440.200 69,0717% 53.114.402.000 Nusantara"
    """
    
    # Skip lines that are clearly not shareholder data
    skip_patterns = [
        r'^(?:pada|berdasarkan|dari|yang|sesuai|dengan|melalui|sebesar|sebanyak)',
        r'^(?:based|from|according|through|in|the|a|an)\s',
        r'penawaran\s*umum|public\s*offering',
        r'modal\s*dasar|authorized\s*capital',
        r'modal\s*ditempatkan|issued\s*capital',
        r'modal\s*disetor|paid.*capital',
        r'saham\s*biasa|common\s*stock',
        r'nilai\s*nominal|par\s*value',
        r'waran\s*seri|warrant.*series',
        r'^c\.\s|^d\.\s|^[a-e]\)',  # List items
        r'KONSOLIDASIAN|CONSOLIDATED',  # Report headers
        r'rencana\s*perseroan|company.*plan',  # Future plans text
        r'PMTHMETD|PMHMETD',  # Stock offering terms
        r'FINANCIAL\s*STATEMENTS',  # Report headers
        r'konteks|context',  # Context text
    ]
    
    for pattern in skip_patterns:
        if re.search(pattern, line, re.IGNORECASE):
            return None
    
    # Line must start with a valid shareholder name pattern OR be a continuation
    valid_start_patterns = [
        r'^PT\s+[A-Z]',                          # PT companies
        r'^Masyarakat',                          # Public/Masyarakat
        r'^[A-Z][a-z]+\s+[A-Z][a-z]+\s+\d',     # Person name followed by number
        r'^[A-Z][a-z]+wave|^Zurich',            # Known foreign shareholders
        r'^Nusantara\s+\d',                      # Continuation line with data
        r'^kepemilikan\s+di\s+bawah',           # Continuation for Masyarakat
        r'^International\s+Ltd',                 # Continuation for foreign company
        r'^[A-Z][a-z]+\s+[A-Z][a-z]+\s+Pte',    # Foreign company with Pte (e.g., "Bes Trus Pte. Ltd")
        r'^[A-Z][a-z]+\s+[A-Z][a-z]+\s+Ltd',    # Foreign company ending with Ltd
    ]
    
    has_valid_start = any(re.match(p, line, re.IGNORECASE) for p in valid_start_patterns)
    
    # Or continuation from prefix
    if not has_valid_start and not name_prefix:
        return None
    
    # Detect format by looking at the large numbers pattern
    # INET: has numbers like 5.311.440.200 (dot thousands, at least 3 groups)
    # DEWA: has numbers like 10,093,210,520 (comma thousands, at least 3 groups)
    
    dot_thousands_match = re.search(r'\d{1,3}(?:\.\d{3}){2,}', line)  # 3+ digit groups with dots
    comma_thousands_match = re.search(r'\d{1,3}(?:,\d{3}){2,}', line)  # 3+ digit groups with commas
    
    # Determine which separator is used for thousands
    if dot_thousands_match and not comma_thousands_match:
        # INET style: dot thousands, comma decimals
        thousand_sep = '.'
        decimal_sep = ','
        numbers = re.findall(r'\d{1,3}(?:\.\d{3})+', line)
    elif comma_thousands_match and not dot_thousands_match:
        # DEWA style: comma thousands, dot decimals
        thousand_sep = ','
        decimal_sep = '.'
        numbers = re.findall(r'\d{1,3}(?:,\d{3})+', line)
    elif dot_thousands_match and comma_thousands_match:
        # Both present - check which makes more sense
        # Usually the one with more digit groups is thousands
        dot_nums = re.findall(r'\d{1,3}(?:\.\d{3})+', line)
        comma_nums = re.findall(r'\d{1,3}(?:,\d{3})+', line)
        
        # Count total digits in each format
        dot_digits = sum(len(n.replace('.', '')) for n in dot_nums)
        comma_digits = sum(len(n.replace(',', '')) for n in comma_nums)
        
        if dot_digits >= comma_digits:
            # More likely INET style (dot thousands)
            thousand_sep = '.'
            decimal_sep = ','
            numbers = dot_nums
        else:
            # More likely DEWA style (comma thousands)
            thousand_sep = ','
            decimal_sep = '.'
            numbers = comma_nums
    else:
        # Small numbers - check for single group (like 10.000)
        small_dot = re.search(r'\d{1,3}\.\d{3}(?!\d)', line)
        small_comma = re.search(r'\d{1,3},\d{3}(?!\d)', line)
        
        if small_dot:
            thousand_sep = '.'
            decimal_sep = ','
            numbers = re.findall(r'\d{1,3}(?:\.\d{3})+', line)
        elif small_comma:
            thousand_sep = ','
            decimal_sep = '.'
            numbers = re.findall(r'\d{1,3}(?:,\d{3})+', line)
        else:
            return None
    
    if len(numbers) < 1:
        return None
    
    # Find percentage using the decimal separator
    # Pattern: 1-3 digits, decimal separator, 2-4 digits, optional %
    if decimal_sep == ',':
        pct_match = re.search(r'(\d{1,3}),(\d{2,4})(?:\s*%)?', line)
    else:
        pct_match = re.search(r'(\d{1,3})\.(\d{2,4})(?:\s*%)?(?!\d{3})', line)  # Don't match thousands
    
    if not pct_match:
        return None
    
    try:
        pct_int = pct_match.group(1)
        pct_dec = pct_match.group(2)
        # For very small percentages like 0,0001%, keep full decimal precision
        # For normal percentages like 69,0717%, normalize to 2 decimal places
        if pct_int == '0' and pct_dec.startswith('0'):
            # Very small percentage - keep full precision (e.g., 0.0001)
            percentage = float(f"{pct_int}.{pct_dec}")
        elif len(pct_dec) > 2:
            # Normal percentage - truncate to 2 decimal places
            pct_dec = pct_dec[:2]
            percentage = float(f"{pct_int}.{pct_dec}")
        else:
            percentage = float(f"{pct_int}.{pct_dec}")
    except:
        return None
    
    if percentage < 0 or percentage > 100:
        return None
    
    # Parse shares - first large number
    shares_str = numbers[0]
    # Remove thousand separator (dot or comma based on detected format)
    shares = int(shares_str.replace(thousand_sep, ''))
    
    # Minimum 1,000 shares (lowered to include small shareholders like Muhammad Arif)
    if shares < 1_000:
        return None
    
    # Extract name - text before first number
    first_num_pos = line.find(numbers[0])
    name_part = line[:first_num_pos].strip() if first_num_pos > 0 else ""
    
    # Handle various name patterns
    name = None
    
    # Check for "kepemilikan di bawah" continuation (Masyarakat)
    if re.search(r'kepemilikan\s+di\s+bawah', name_part, re.IGNORECASE):
        name = "Masyarakat"
    # Check for Masyarakat
    elif re.search(r'Masyarakat', name_part, re.IGNORECASE):
        name = "Masyarakat"
    # Check for individual name (e.g., "Muhammad Arif")
    elif re.match(r'^[A-Z][a-z]+\s+[A-Z][a-z]+$', name_part):
        name = name_part
    # Check for PT company
    elif re.search(r'^PT\s+', name_part, re.IGNORECASE):
        name = name_part
    # Check for continuation line (like "Nusantara" after "PT Abadi Kreasi Unggul")
    elif name_prefix and name_part:
        # This is continuation - combine with prefix
        name = name_prefix + " " + name_part
    # Check for foreign company ending with Ltd/Limited
    elif re.search(r'Ltd\.?\)?$|Limited\)?$', name_part, re.IGNORECASE):
        if name_prefix:
            name = name_prefix + " " + name_part
        else:
            name = name_part
    # Just use prefix if no name_part
    elif name_prefix:
        name = name_prefix
    elif name_part and len(name_part) > 3:
        name = name_part
    
    if not name or len(name) < 4:
        return None
    
    # Clean up the name
    name = clean_shareholder_name_v2(name)
    
    if not name or len(name) < 4:
        return None
    
    return {
        'tanggal': current_date,
        'pemegang_saham': name,
        'jumlah_saham': shares,
        'persentase': percentage
    }


def clean_shareholder_name_v2(name: str) -> str:
    """Clean shareholder name - handle bilingual duplicates and special chars"""
    if not name:
        return ""
    
    # Remove extra whitespace
    name = ' '.join(name.split())
    
    # Remove trailing punctuation and parentheses
    name = name.strip('.,;:- ')
    
    # Remove (qq. ...) patterns - these are custodian references
    name = re.sub(r'\s*\(?\s*qq\.?\s*[^)]*\)?\s*', '', name, flags=re.IGNORECASE)
    
    # Remove trailing parenthetical parts like "(each below 5%)" or "(masing-masing di bawah 5%)"
    name = re.sub(r'\s*\([^)]*below[^)]*\)\s*$', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\s*\([^)]*bawah[^)]*\)\s*$', '', name, flags=re.IGNORECASE)
    
    # Fix "di bawah 5%" -> "Masyarakat"
    if re.search(r'^di\s*bawah\s*5', name, re.IGNORECASE):
        return "Masyarakat"
    
    # Fix duplicate bilingual names - handles:
    # "Goldwave Capital Limited Goldwave Capital Limited" -> "Goldwave Capital Limited"
    # "PT Abadi Kreasi Unggul PT Abadi Kreasi Unggul Nusantara" -> "PT Abadi Kreasi Unggul Nusantara"
    
    # Check for "PT X Y Z PT X Y Z" pattern (exact duplicate)
    pt_dup_match = re.match(r'^(PT\s+[A-Za-z\s]+?)\s+\1(.*)$', name, re.IGNORECASE)
    if pt_dup_match:
        name = pt_dup_match.group(1) + pt_dup_match.group(2)
        name = name.strip()
    
    # Check for company name duplicate pattern
    words = name.split()
    if len(words) >= 4:
        # Try different split points
        for split_at in range(len(words)//2 - 1, len(words)//2 + 2):
            if 2 <= split_at < len(words) - 1:
                first_half = ' '.join(words[:split_at])
                second_part = ' '.join(words[split_at:])
                # Check if second part starts with first half
                if second_part.lower().startswith(first_half.lower()):
                    # Keep first half + remainder after duplicate
                    remainder = second_part[len(first_half):].strip()
                    name = first_half + (' ' + remainder if remainder else '')
                    break
                # Check exact duplicate
                if first_half.lower() == second_part.lower():
                    name = first_half
                    break
    
    # Final cleanup
    name = name.strip('.,;:-)( ')
    
    return name


def extract_modal_saham_row(line: str, current_date: str, name_prefix: Optional[str] = None) -> Optional[Dict]:
    """
    Extract shareholder from Modal Saham format row.
    
    Format examples:
    - "Goldwave Capital Limited 3,815,217,000 9.38 381,521,700 Goldwave Capital Limited"
    - "PT Madhani Talatah Nusantara 10,093,210,520 24.81 504,660,526 PT Madhani Talatah Nusantara"
    - "International Ltd.) 3,815,217,000 9.38 381,521,700 International Ltd.)"
    - "Masyarakat (masing-masing di bawah 5%) 15,525,338,402 38.15 1,552,533,840 Public (each below 5%)"
    """
    
    # Must have share number and percentage
    has_shares = re.search(r'\d{1,3}(?:[.,]\d{3})+', line)
    has_pct = re.search(r'\d{1,2}[,\.]\d{2,4}(?:\s*%)?', line)
    
    if not has_shares or not has_pct:
        return None
    
    # Extract shareholder name
    name = None
    
    # Check for Masyarakat / Public
    if re.search(r'^Masyarakat|^Public', line, re.IGNORECASE):
        name = "Masyarakat"
    elif re.search(r'di\s*bawah\s*5\%?\)|below\s*5\%?\)', line, re.IGNORECASE):
        name = "Masyarakat"
    elif name_prefix:
        # Use prefix and extract continuation
        cont_match = re.match(r'^([A-Za-z][A-Za-z\s\.\(\)]+?)\s+\d', line)
        if cont_match:
            continuation = cont_match.group(1).strip()
            # Clean up the continuation
            continuation = re.sub(r'\s*(International\s*Ltd\.?\)?)\s*$', r' \1', continuation)
            name = name_prefix
            if continuation and not continuation.lower().startswith('international'):
                name = name + " " + continuation
        else:
            name = name_prefix
    else:
        # Try to extract name from line
        # Pattern: Name followed by large number
        name_match = re.match(
            r'^((?:PT\s+)?[A-Za-z][A-Za-z\s\.\(\)]+?)\s+(\d{1,3}[.,]\d{3})',
            line
        )
        if name_match:
            name = name_match.group(1).strip()
    
    if not name or len(name) < 3:
        return None
    
    # Clean name - remove duplicate (bilingual format)
    name = clean_shareholder_name(name)
    
    # Skip if name is not valid
    if not name or len(name) < 4:
        return None
    
    # Extract shares - first large number
    shares_match = re.search(r'(\d{1,3}(?:[.,]\d{3})+)', line)
    if not shares_match:
        return None
    
    shares_str = shares_match.group(1)
    # Handle both dot (Indonesian) and comma (some formats) as thousand separator
    shares = int(shares_str.replace('.', '').replace(',', ''))
    
    if shares < 10_000:  # Minimum 10k shares
        return None
    
    # Extract percentage - after shares
    remaining = line[shares_match.end():]
    pct_match = re.search(r'(\d{1,2})[,\.](\d{2,4})', remaining)
    
    if not pct_match:
        return None
    
    try:
        percentage = float(f"{pct_match.group(1)}.{pct_match.group(2)}")
        if len(pct_match.group(2)) > 2:
            percentage = round(percentage, 2)
    except:
        return None
    
    if percentage <= 0 or percentage > 100:
        return None
    
    return {
        'tanggal': current_date,
        'pemegang_saham': name,
        'jumlah_saham': shares,
        'persentase': percentage
    }


def clean_shareholder_name(name: str) -> str:
    """Clean and normalize shareholder name"""
    if not name:
        return ""
    
    # Remove extra whitespace
    name = ' '.join(name.split())
    
    # Remove trailing punctuation
    name = name.strip('.,;:-() ')
    
    # Remove (qq. ...) patterns
    name = re.sub(r'\s*\(?\s*qq\.?\s*[^)]*\)?\s*$', '', name, flags=re.IGNORECASE)
    
    # Check for duplicate (bilingual) - "PT ABC PT ABC" -> "PT ABC"
    words = name.split()
    if len(words) >= 4:
        half = len(words) // 2
        first_half = ' '.join(words[:half])
        second_half = ' '.join(words[half:])
        if first_half.lower() == second_half.lower():
            name = first_half
    
    # Remove trailing "International Ltd.)" duplicate patterns
    name = re.sub(r'\s+International\s*Ltd\.?\)?\s+International\s*Ltd\.?\)?$', ' International Ltd.', name, flags=re.IGNORECASE)
    
    # Final cleanup
    name = name.strip('.,;:-() ')
    
    return name


def extract_from_files(file_names: List[str]) -> Dict:
    """Extract shareholder data from multiple downloaded PDFs"""
    all_results = []
    
    for file_name in file_names:
        pdf_path = os.path.join(PDF_CACHE_DIR, file_name)
        
        if not os.path.exists(pdf_path):
            all_results.append({
                'file_name': file_name,
                'error': 'File not found',
                'shareholders': []
            })
            continue
        
        try:
            shareholders = extract_shareholders_from_pdf(pdf_path)
            all_results.append({
                'file_name': file_name,
                'shareholders': shareholders,
                'total': len(shareholders)
            })
        except Exception as e:
            all_results.append({
                'file_name': file_name,
                'error': str(e),
                'shareholders': []
            })
    
    return {
        "results": all_results,
        "total_files": len(all_results)
    }


def detect_dates(text: str) -> List[str]:
    """Detect dates in text with priority to newer dates. Handles bilingual format."""
    dates = []
    
    # Comprehensive patterns - order matters (newer dates first)
    # Handles bilingual: "31 Desember 2024 / December 31, 2024"
    patterns = [
        # 2025 dates
        (r'30\s*September\s*2025', "30 September 2025"),
        (r'September\s*30,?\s*2025', "30 September 2025"),
        (r'30\s*Juni\s*2025', "30 Juni 2025"),
        (r'June\s*30,?\s*2025', "30 Juni 2025"),
        (r'31\s*Maret\s*2025', "31 Maret 2025"),
        (r'March\s*31,?\s*2025', "31 Maret 2025"),
        (r'31\s*Desember\s*2025', "31 Desember 2025"),
        (r'December\s*31,?\s*2025', "31 Desember 2025"),
        # 2024 dates
        (r'30\s*September\s*2024', "30 September 2024"),
        (r'September\s*30,?\s*2024', "30 September 2024"),
        (r'30\s*Juni\s*2024', "30 Juni 2024"),
        (r'June\s*30,?\s*2024', "30 Juni 2024"),
        (r'31\s*Maret\s*2024', "31 Maret 2024"),
        (r'March\s*31,?\s*2024', "31 Maret 2024"),
        (r'31\s*Desember\s*2024', "31 Desember 2024"),
        (r'December\s*31,?\s*2024', "31 Desember 2024"),
        # 2023 dates
        (r'30\s*September\s*2023', "30 September 2023"),
        (r'September\s*30,?\s*2023', "30 September 2023"),
        (r'30\s*Juni\s*2023', "30 Juni 2023"),
        (r'June\s*30,?\s*2023', "30 Juni 2023"),
        (r'31\s*Maret\s*2023', "31 Maret 2023"),
        (r'March\s*31,?\s*2023', "31 Maret 2023"),
        (r'31\s*Desember\s*2023', "31 Desember 2023"),
        (r'December\s*31,?\s*2023', "31 Desember 2023"),
    ]
    
    for pattern, date_str in patterns:
        if re.search(pattern, text, re.IGNORECASE) and date_str not in dates:
            dates.append(date_str)
    
    return dates


def parse_shareholders_multidate(text: str, dates: List[str]) -> List[Dict]:
    """
    Smart parser for shareholder extraction with multi-date support.
    Handles:
    1. Two separate tables with date headers (30 Juni 2025, 31 Desember 2024)
    2. Multi-line shareholder names (e.g., "PT Abadi Kreasi Unggul" on line 1, "Nusantara 5.311.440.200 69,0717%" on line 2)
    3. Percentages with 2-4 decimals
    """
    shareholders = []
    lines = text.split('\n')
    
    # Default date
    current_date = dates[0] if dates else "Unknown"
    
    # Date patterns to detect section headers
    date_patterns = [
        # 2025
        (r'30\s*September\s*2025', "30 September 2025"),
        (r'September\s*30,?\s*2025', "30 September 2025"),
        (r'30\s*Juni\s*2025', "30 Juni 2025"),
        (r'June\s*30,?\s*2025', "30 Juni 2025"),
        (r'31\s*Maret\s*2025', "31 Maret 2025"),
        (r'March\s*31,?\s*2025', "31 Maret 2025"),
        (r'31\s*Desember\s*2025', "31 Desember 2025"),
        (r'December\s*31,?\s*2025', "31 Desember 2025"),
        # 2024
        (r'30\s*September\s*2024', "30 September 2024"),
        (r'September\s*30,?\s*2024', "30 September 2024"),
        (r'30\s*Juni\s*2024', "30 Juni 2024"),
        (r'June\s*30,?\s*2024', "30 Juni 2024"),
        (r'31\s*Maret\s*2024', "31 Maret 2024"),
        (r'March\s*31,?\s*2024', "31 Maret 2024"),
        (r'31\s*Desember\s*2024', "31 Desember 2024"),
        (r'December\s*31,?\s*2024', "31 Desember 2024"),
        # 2023
        (r'30\s*September\s*2023', "30 September 2023"),
        (r'30\s*Juni\s*2023', "30 Juni 2023"),
        (r'31\s*Maret\s*2023', "31 Maret 2023"),
        (r'31\s*Desember\s*2023', "31 Desember 2023"),
    ]
    
    # Track pending name prefix from previous line
    pending_name_prefix = None
    
    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            pending_name_prefix = None  # Reset on empty line
            continue
        
        # Check if this line contains a date header (section marker)
        for pattern, date_str in date_patterns:
            if re.search(pattern, line, re.IGNORECASE):
                current_date = date_str
                pending_name_prefix = None
                break
        
        # Skip headers and total rows
        if re.search(r'^(pemegang\s*saham|shareholders?|jumlah\s*saham|total|sub-?jumlah|sub-?total|number\s*of|percentage|saham\s*seri|nama\s*pemegang|persentase|ditempatkan|disetor|issued)', 
                    line, re.IGNORECASE):
            pending_name_prefix = None
            continue
        
        # Skip "Jumlah" total rows (Indonesian for Total)
        if re.search(r'^Jumlah\b', line, re.IGNORECASE):
            pending_name_prefix = None
            continue
        
        # Skip non-shareholder content
        if re.search(r'utang|liabilitas|beban|aset|pendapatan|biaya|catatan|note|modal\s*dasar|modal\s*ditempatkan|jumlah\s*modal|ownership\s*\(%\)', line, re.IGNORECASE):
            pending_name_prefix = None
            continue
        
        # Skip explanatory text in parentheses only (without data)
        # BUT don't skip lines that contain share data (numbers + percentages)
        if re.search(r'^\(masing-masing|^\(each below', line, re.IGNORECASE):
            # Check if this line also has data
            if not (re.search(r'\d{1,3}(?:\.\d{3})+', line) and re.search(r'\d{1,3}[,.]\d{2,4}\s*%', line)):
                continue
        
        # Check if this line is a name prefix (no numbers, just text like "PT Abadi Kreasi Unggul")
        # Pattern: starts with PT and no large numbers
        if re.match(r'^PT\s+[A-Za-z][A-Za-z\s]+$', line) and not re.search(r'\d{1,3}(?:\.\d{3}){2,}', line):
            # Clean potential duplicate (bilingual: "PT Abadi Kreasi Unggul PT Abadi Kreasi Unggul")
            words = line.split()
            if len(words) >= 4 and len(words) % 2 == 0:
                half = len(words) // 2
                first_half = ' '.join(words[:half])
                second_half = ' '.join(words[half:])
                if first_half.lower() == second_half.lower():
                    line = first_half
            pending_name_prefix = line
            continue
        
        # Try to extract shareholder data, with optional prefix from previous line
        result = extract_shareholder_single_row_v2(line, current_date, pending_name_prefix)
        
        if result:
            shareholders.append(result)
            pending_name_prefix = None
        elif pending_name_prefix and not re.search(r'\d', line):
            # Might be continuation of name (e.g., "Nusantara" without numbers yet)
            # Keep building the prefix
            pending_name_prefix = pending_name_prefix + " " + line
        else:
            pending_name_prefix = None
    
    return shareholders


def extract_shareholder_single_row(line: str, patterns: List[str], current_date: str) -> Optional[Dict]:
    """
    Extract shareholder data from a single row.
    Format: Name | Shares | Percentage | ModalSaham (optional)
    Example: PT Omudas Investment Holdco 2.774.000.000 61,13% 69.350.000.000
    """
    # Use the v2 function with no prefix
    return extract_shareholder_single_row_v2(line, current_date, None)


def extract_shareholder_single_row_v2(line: str, current_date: str, name_prefix: Optional[str] = None) -> Optional[Dict]:
    """
    Extract shareholder data from a single row, with optional name prefix from previous line.
    
    Handles formats like:
    - "PT Omudas Investment Holdco 2.774.000.000 61,13%"
    - Line 1: "PT Abadi Kreasi Unggul", Line 2: "Nusantara 5.311.440.200 69,0717%"
    - "Muhammad Arif 10.000 0,0001%"
    - "Masyarakat 2.378.299.284 30,9282%"
    - "kepemilikan di bawah 5%) 2.378.299.284 30,9282% 23.782.992.840 ownership)" -> Masyarakat
    """
    
    # Patterns for shareholder names
    shareholder_patterns = [
        # PT xxx
        r'^(PT\s+[A-Za-z][A-Za-z\s]+)',
        # xxx Pte. Ltd / Ltd  
        r'^((?:Bes|Goldwave|Zurich|Asia|Global|Pacific|UBS)\s*[A-Za-z\s]*(?:Trus|Capital|Assets)?\s*(?:Pte\.?\s*)?Ltd\.?)',
        # General company with Pte. Ltd / Ltd / Limited
        r'^([A-Za-z][A-Za-z\s]+(?:Pte\.?\s*Ltd\.?|Ltd\.?|Limited))',
        # Masyarakat (with or without parenthetical)
        r'^(Masyarakat)',
        # Public
        r'^(Public)',
        # Individual names (Tn./Mr./Ny./Mrs.)
        r'^((?:Tn\.|Mr\.|Ny\.|Mrs\.)\s+[A-Za-z][A-Za-z\s\.]+)',
        # Plain names (capitalized words) - but only if followed by numbers
        r'^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
    ]
    
    # First, check if this line has shareholder data (shares + percentage)
    # Pattern: large number + percentage (0,0001% to 99,9999%)
    has_shares = re.search(r'\d{1,3}(?:\.\d{3}){1,}', line)  # At least 1 dot group (e.g., 10.000)
    has_percentage = re.search(r'\d{1,2}[,\.]\d{2,4}\s*%', line)
    
    if not has_shares or not has_percentage:
        return None
    
    # Special case: line starts with "kepemilikan di bawah" - this is Masyarakat continuation
    if re.search(r'^kepemilikan\s+di\s+bawah|^ownership\)', line, re.IGNORECASE):
        # This is Masyarakat's data line
        name = "Masyarakat"
    else:
        # Try to find the name
        name = None
        name_end_pos = 0
        
        # If we have a prefix from previous line (e.g., "PT Abadi Kreasi Unggul")
        if name_prefix:
            # Line might start with continuation (e.g., "Nusantara 5.311.440.200 69,0717%")
            # Extract any text before the first number
            match = re.search(r'^([A-Za-z][A-Za-z\s]*)', line)
            if match:
                continuation = match.group(1).strip()
                name = name_prefix + " " + continuation
                name_end_pos = match.end()
            else:
                name = name_prefix
                name_end_pos = 0
        else:
            # Try each pattern to match shareholder name
            for pattern in shareholder_patterns:
                match = re.search(pattern, line, re.IGNORECASE)
                if match:
                    name = match.group(1).strip()
                    name_end_pos = match.end()
                    break
            
            # Fallback: take text before first large number
            if not name:
                match = re.search(r'(\d{1,3}(?:\.\d{3})+)', line)
                if match:
                    potential_name = line[:match.start()].strip()
                    if potential_name and re.search(r'[A-Za-z]', potential_name):
                        name = potential_name
                        name_end_pos = match.start()
    
    if not name or len(name) < 3:
        return None
    
    # Clean name - remove duplicate (bilingual format "PT ABC PT ABC" -> "PT ABC")
    name = ' '.join(name.split())
    
    # Check for duplicate name (bilingual) - e.g., "PT Abadi Kreasi Unggul PT Abadi Kreasi Unggul"
    # or "Nusantara ... Nusantara"
    words = name.split()
    if len(words) >= 4:
        # Try to detect duplicate
        half = len(words) // 2
        first_half = ' '.join(words[:half])
        second_half = ' '.join(words[half:])
        if first_half.lower() == second_half.lower():
            name = first_half
    
    name = name.strip('.,;:-')
    name = re.sub(r'\(?\s*qq\.?\s*', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\(\s*\)', '', name)
    name = re.sub(r'\s*\)\s*$', '', name)
    
    # Skip malformed entries
    if name.startswith('di ') or name.startswith('kepemilikan') or name.lower().startswith('jumlah'):
        return None
    
    # Skip non-shareholder names
    skip_keywords = ['asuransi', 'docking', 'direksi', 'komisaris', 'bahan bakar', 'sewa', 
                     'peralatan', 'perlengkapan', 'kapal', 'kendaraan', 'deposit', 'belum jatuh',
                     'dikurangi', 'pembangunan', 'lainnya', 'issued', 'fully paid']
    if any(kw in name.lower() for kw in skip_keywords):
        return None
    
    name = name.strip('.,;:- ')
    
    # Validate name - must start with valid char and have letters
    if not re.search(r'^[A-Za-z(]', name):
        return None
    if not re.search(r'[A-Za-z]', name):
        return None
    # Name should not be too short
    if len(name) < 5:
        return None
    
    # Find share count - number with thousands separator
    # Format: X.XXX or X.XXX.XXX (with dots as thousand separators)
    share_match = re.search(r'\b(\d{1,3}(?:\.\d{3})+)\b', line)
    
    if not share_match:
        return None
    
    shares = int(share_match.group(1).replace('.', ''))
    if shares < 1_000:  # Must be at least 1,000 shares
        return None
    
    # Position after share count
    after_shares = line[share_match.end():]
    
    # Find percentage AFTER share count - pattern: X,XXXX% or XX,XX% (0-2 digits before comma, 2-4 after)
    # Handles: 69,0717%, 30,9282%, 0,0001%, 100,0000%
    pct_match = re.search(r'(\d{1,3})[,.](\d{2,4})\s*%', after_shares)
    if not pct_match:
        # Try without % but must be followed by another number (for old formats)
        pct_match = re.search(r'(\d{1,3})[,.](\d{2,4})\s+\d', after_shares)
    if not pct_match:
        return None
    
    try:
        # Handle both 2-decimal (61,13) and 4-decimal (69,0717) formats
        integer_part = pct_match.group(1)
        decimal_part = pct_match.group(2)
        percentage = float(f"{integer_part}.{decimal_part}")
        # Only round to 2 decimals if percentage >= 0.01 (to preserve small percentages like 0.0001)
        if len(decimal_part) > 2 and percentage >= 0.01:
            percentage = round(percentage, 2)
    except:
        return None
    
    if percentage <= 0 or percentage > 100:
        return None
    
    return {
        'tanggal': current_date,
        'pemegang_saham': name,
        'jumlah_saham': shares,
        'persentase': percentage
    }


def extract_shareholder_multicolumn(line: str, patterns: List[str], date1: str, date2: Optional[str]) -> List[Dict]:
    """
    Extract shareholder data from a line that may contain data for 2 date columns.
    Returns list of shareholders (typically 1 or 2 entries for same shareholder with different dates).
    """
    results = []
    
    # Try each pattern to match shareholder name
    name = None
    name_end_pos = 0
    
    for pattern in patterns:
        match = re.search(pattern, line, re.IGNORECASE)
        if match:
            name = match.group(1).strip()
            name_end_pos = match.end()
            break
    
    # Fallback: take text before first large number
    if not name:
        match = re.search(r'(\d{1,3}(?:[.,]\d{3})+)', line)
        if match:
            name = line[:match.start()].strip()
            name_end_pos = match.start()
    
    if not name or len(name) < 3:
        return []
    
    # Clean name
    name = ' '.join(name.split())
    name = name.strip('.,;:-')
    name = re.sub(r'\(?\s*qq\.?\s*', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\(\s*\)', '', name)
    name = re.sub(r'\s*\)\s*$', '', name)
    
    # Skip malformed entries
    if name.startswith('di ') or name.startswith('kepemilikan'):
        return []
    
    name = name.strip('.,;:- ')
    
    # Validate
    if not re.search(r'^[A-Za-z(]', name):
        return []
    if not re.search(r'[A-Za-z]', name):
        return []
    
    remaining = line[name_end_pos:]
    
    # Find ALL number groups (each represents shares or percentage)
    # Pattern: number with thousands separator followed by percentage
    # Example: "2.774.000.000 61,13 513.000.000 11,30" (2 sets of data)
    
    # Find all large numbers (share counts)
    share_numbers = []
    for match in re.finditer(r'\b(\d{1,3}(?:\.\d{3})+)\b', remaining):
        num_str = match.group(1)
        num = int(num_str.replace('.', ''))
        if num >= 1_000_000:  # Only count shares >= 1 million
            share_numbers.append((num, match.start()))
    
    # Find all percentages
    percentages = []
    for match in re.finditer(r'\b(\d{1,2})[,.](\d{2})\b', remaining):
        try:
            pct = float(f"{match.group(1)}.{match.group(2)}")
            if 0 < pct <= 100:
                percentages.append((pct, match.start()))
        except:
            pass
    
    # If we have no data, skip
    if not share_numbers or not percentages:
        return []
    
    # Match shares with their corresponding percentages
    # Typically: shares1 pct1 shares2 pct2 (positional pairing)
    
    if len(share_numbers) == 1 and len(percentages) >= 1:
        # Single data column - only date1
        results.append({
            'tanggal': date1,
            'pemegang_saham': name,
            'jumlah_saham': share_numbers[0][0],
            'persentase': percentages[0][0]
        })
    
    elif len(share_numbers) >= 2 and len(percentages) >= 2:
        # Two data columns - date1 and date2
        # Sort by position to pair correctly
        share_numbers.sort(key=lambda x: x[1])
        percentages.sort(key=lambda x: x[1])
        
        # First set -> date1 (newer date)
        results.append({
            'tanggal': date1,
            'pemegang_saham': name,
            'jumlah_saham': share_numbers[0][0],
            'persentase': percentages[0][0]
        })
        
        # Second set -> date2 (older date)
        if date2:
            results.append({
                'tanggal': date2,
                'pemegang_saham': name,
                'jumlah_saham': share_numbers[1][0],
                'persentase': percentages[1][0]
            })
    
    return results
