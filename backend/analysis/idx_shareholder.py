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
    """Extract shareholder data from PDF - handles multi-column date tables"""
    
    with pdfplumber.open(pdf_path) as pdf:
        all_shareholders = []
        
        # Find pages with shareholder table
        # Look for pages that have shareholder names + share counts + percentages
        shareholder_pages = []
        
        for page_num, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            
            # Method 1: Traditional check (modal saham + pemegang saham + persentase)
            has_modal_saham = bool(re.search(r'modal\s*saham|share\s*capital', text, re.IGNORECASE))
            has_shareholder_header = bool(re.search(r'pemegang\s*saham|shareholders', text, re.IGNORECASE))
            has_percentage_header = bool(re.search(r'(?:persentase|percentage|ownership\s*\(?\s*%)', text, re.IGNORECASE))
            is_toc = bool(re.search(r'daftar\s*isi|table\s*of\s*contents', text, re.IGNORECASE))
            
            # Method 2: Look for actual data pattern - PT/Masyarakat + large number + percentage
            # Pattern: "PT Xxx 2.774.000.000 61,13%"
            has_shareholder_data = bool(re.search(
                r'(PT\s+[A-Za-z][A-Za-z\s]+|Masyarakat)\s+[\d\.]+\s+\d{1,2}[,\.]\d{2}\s*%?',
                text, re.IGNORECASE
            ))
            
            # Method 3: Multiple lines with PT + numbers + percentages
            pt_lines_with_pct = len(re.findall(
                r'PT\s+[A-Za-z].+\d{1,3}(?:\.\d{3})+.+\d{1,2}[,\.]\d{2}',
                text
            ))
            
            if is_toc:
                continue
            
            # Select page if traditional criteria met OR has actual data
            if (has_modal_saham and has_shareholder_header and has_percentage_header):
                shareholder_pages.append(page_num)
            elif has_shareholder_data and pt_lines_with_pct >= 3:
                # Has at least 3 shareholder entries with percentages
                shareholder_pages.append(page_num)
        
        if not shareholder_pages:
            return []
        
        # Extract data from each page
        for page_num in shareholder_pages:
            page = pdf.pages[page_num]
            text = page.extract_text() or ""
            
            # Detect all dates in the page (typically 2 columns: current period & previous period)
            dates = detect_dates(text)
            
            # Parse shareholders with multi-date awareness
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
    """Detect dates in text with priority to newer dates"""
    dates = []
    
    # Comprehensive patterns - order matters (newer dates first)
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
        (r'30\s*Juni\s*2023', "30 Juni 2023"),
        (r'31\s*Maret\s*2023', "31 Maret 2023"),
        (r'31\s*Desember\s*2023', "31 Desember 2023"),
    ]
    
    for pattern, date_str in patterns:
        if re.search(pattern, text, re.IGNORECASE) and date_str not in dates:
            dates.append(date_str)
    
    return dates


def parse_shareholders_multidate(text: str, dates: List[str]) -> List[Dict]:
    """
    Smart parser for shareholder extraction with multi-date support.
    Handles two formats:
    1. Two separate tables with date headers (30 Juni 2025, 31 Desember 2024)
    2. Single table with two date columns
    """
    shareholders = []
    lines = text.split('\n')
    
    # Default date
    current_date = dates[0] if dates else "Unknown"
    
    # Patterns for shareholder names
    shareholder_patterns = [
        # PT xxx
        r'^(PT\s+[A-Za-z][A-Za-z\s]+(?:Tbk\.?|Nusantara|Pratama|Makmur|Indonesia|Sejahtera|Holdco|Rahardja)?)',
        # xxx Pte. Ltd / Ltd
        r'^((?:Bes|Goldwave|Zurich|Asia|Global|Pacific|UBS)\s*[A-Za-z\s]*(?:Trus|Capital|Assets)?\s*(?:Pte\.?\s*)?Ltd\.?)',
        # General company with Pte. Ltd / Ltd / Limited
        r'^([A-Za-z][A-Za-z\s]+(?:Pte\.?\s*Ltd\.?|Ltd\.?|Limited))',
        # Masyarakat
        r'^(Masyarakat\s*(?:\([^)]+\))?)',
        # Public
        r'^(Public\s*(?:\([^)]+\))?)',
        # Individual names (Tn./Mr./Ny./Mrs.)
        r'^((?:Tn\.|Mr\.|Ny\.|Mrs\.)\s+[A-Za-z][A-Za-z\s\.]+)',
        # Plain Indonesian names (capitalized words, 2+ words)
        r'^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)',
    ]
    
    # Date patterns to detect section headers
    date_patterns = [
        (r'30\s*Juni\s*2025', "30 Juni 2025"),
        (r'31\s*Desember\s*2024', "31 Desember 2024"),
        (r'31\s*Maret\s*2025', "31 Maret 2025"),
        (r'30\s*September\s*2024', "30 September 2024"),
        (r'30\s*Juni\s*2024', "30 Juni 2024"),
        (r'31\s*Maret\s*2024', "31 Maret 2024"),
        (r'31\s*Desember\s*2023', "31 Desember 2023"),
    ]
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Check if this line is a date header (section marker)
        for pattern, date_str in date_patterns:
            if re.search(f'^{pattern}$', line, re.IGNORECASE) or re.search(f'^{pattern}\s*$', line, re.IGNORECASE):
                current_date = date_str
                break
        
        # Skip headers and total rows
        if re.search(r'^(pemegang\s*saham|shareholders?|jumlah\s*saham|total|sub-?jumlah|sub-?total|number\s*of|percentage|saham\s*seri|nama\s*pemegang|persentase)', 
                    line, re.IGNORECASE):
            continue
        
        # Skip non-shareholder content
        if re.search(r'utang|liabilitas|beban|aset|pendapatan|biaya|catatan|note|modal\s*dasar|modal\s*ditempatkan|jumlah\s*modal', line, re.IGNORECASE):
            continue
        
        # Try to extract shareholder data
        result = extract_shareholder_single_row(line, shareholder_patterns, current_date)
        
        if result:
            shareholders.append(result)
    
    return shareholders


def extract_shareholder_single_row(line: str, patterns: List[str], current_date: str) -> Optional[Dict]:
    """
    Extract shareholder data from a single row.
    Format: Name | Shares | Percentage | ModalSaham (optional)
    Example: PT Omudas Investment Holdco 2.774.000.000 61,13% 69.350.000.000
    """
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
        match = re.search(r'(\d{1,3}(?:\.\d{3})+)', line)
        if match:
            name = line[:match.start()].strip()
            name_end_pos = match.start()
    
    if not name or len(name) < 3:
        return None
    
    # Clean name
    name = ' '.join(name.split())
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
                     'dikurangi', 'pembangunan', 'lainnya']
    if any(kw in name.lower() for kw in skip_keywords):
        return None
    
    name = name.strip('.,;:- ')
    
    # Validate name - must start with valid char and have letters
    if not re.search(r'^[A-Za-z(]', name):
        return None
    if not re.search(r'[A-Za-z]', name):
        return None
    # Name should not be too short or look like a date/number
    if len(name) < 5:
        return None
    
    remaining = line[name_end_pos:]
    
    # Find share count - first large number (with thousands separator)
    # Format: X.XXX.XXX.XXX (billions/millions with dots)
    share_match = re.search(r'\b(\d{1,3}(?:\.\d{3}){2,})\b', remaining)  # At least 2 dot groups
    if not share_match:
        return None
    
    shares = int(share_match.group(1).replace('.', ''))
    if shares < 1_000_000:  # Must be at least 1 million shares
        return None
    
    # Position after share count
    after_shares = remaining[share_match.end():]
    
    # Find percentage AFTER share count - pattern: XX,XX% or XX.XX% 
    # Must have % symbol or be followed by another large number (modal saham)
    pct_match = re.search(r'\b(\d{1,2})[,.](\d{2})\s*%', after_shares)
    if not pct_match:
        # Try without % but must be followed by another number
        pct_match = re.search(r'\b(\d{1,2})[,.](\d{2})\s+\d', after_shares)
    if not pct_match:
        return None
    
    try:
        percentage = float(f"{pct_match.group(1)}.{pct_match.group(2)}")
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
