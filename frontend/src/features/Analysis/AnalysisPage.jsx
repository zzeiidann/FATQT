import { useState, useEffect, useCallback, useRef } from 'react';
import { stockAPI as api } from '../../services/api';
import './Analysis.css';

function AnalysisPage() {
  // Filter states - now arrays for multi-select
  const [years, setYears] = useState([2025]);
  const [periodes, setPeriodes] = useState(['tw1']);
  const [emiten, setEmiten] = useState('');
  const [emitenList, setEmitenList] = useState([]);
  const [emitenSearch, setEmitenSearch] = useState('');
  const [showEmitenDropdown, setShowEmitenDropdown] = useState(false);
  const emitenRef = useRef(null);
  
  // PDF list states
  const [pdfFiles, setPdfFiles] = useState([]);
  const [selectedPDFs, setSelectedPDFs] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  
  // Download & extract states
  const [downloading, setDownloading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [downloadedFiles, setDownloadedFiles] = useState([]);
  
  // Results
  const [shareholderResults, setShareholderResults] = useState([]);
  const [error, setError] = useState('');

  // Load emiten list on mount
  useEffect(() => {
    const loadEmiten = async () => {
      try {
        const data = await api.getIDXEmiten();
        setEmitenList(data.emiten || []);
      } catch (err) {
        console.error('Failed to load emiten:', err);
      }
    };
    loadEmiten();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emitenRef.current && !emitenRef.current.contains(event.target)) {
        setShowEmitenDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Clear cache on unmount
  useEffect(() => {
    return () => {
      api.clearPDFCache().catch(console.error);
    };
  }, []);

  const filteredEmiten = emitenList.filter(e => 
    e.code.toLowerCase().includes(emitenSearch.toLowerCase()) ||
    e.name.toLowerCase().includes(emitenSearch.toLowerCase())
  );

  const toggleYear = (year) => {
    setYears(prev => {
      if (prev.includes(year)) {
        return prev.filter(y => y !== year);
      }
      return [...prev, year].sort((a, b) => b - a);
    });
  };

  const togglePeriode = (p) => {
    setPeriodes(prev => {
      if (prev.includes(p)) {
        return prev.filter(x => x !== p);
      }
      return [...prev, p];
    });
  };

  const handleSearch = async () => {
    if (years.length === 0 || periodes.length === 0) {
      setError('Pilih minimal satu tahun dan satu periode');
      return;
    }

    setLoadingSearch(true);
    setError('');
    setPdfFiles([]);
    setSelectedPDFs([]);
    setShareholderResults([]);
    
    try {
      // Search for all combinations of years and periodes
      const allFiles = [];
      
      for (const year of years) {
        for (const periode of periodes) {
          const data = await api.searchIDXReports(year, periode, emiten);
          if (data.files && data.files.length > 0) {
            // Add year/periode info to each file
            data.files.forEach(f => {
              f.year = year;
              f.periode = periode;
            });
            allFiles.push(...data.files);
          }
        }
      }
      
      setPdfFiles(allFiles);
      
      if (allFiles.length === 0) {
        setError('Tidak ada laporan ditemukan untuk filter ini');
      }
    } catch (err) {
      setError('Gagal mencari laporan: ' + err.message);
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleSelectPDF = (pdf) => {
    setSelectedPDFs(prev => {
      const exists = prev.find(p => p.url === pdf.url);
      if (exists) {
        return prev.filter(p => p.url !== pdf.url);
      }
      return [...prev, pdf];
    });
  };

  const handleSelectAll = () => {
    if (selectedPDFs.length === pdfFiles.length) {
      setSelectedPDFs([]);
    } else {
      setSelectedPDFs([...pdfFiles]);
    }
  };

  const handleDownloadAndExtract = async () => {
    if (selectedPDFs.length === 0) {
      setError('Pilih minimal satu PDF untuk dianalisis');
      return;
    }

    setError('');
    setDownloading(true);
    setShareholderResults([]);
    
    try {
      // Step 1: Download PDFs
      const urls = selectedPDFs.map(p => p.url);
      const downloadResult = await api.downloadIDXPDFs(urls);
      
      if (downloadResult.downloaded.length === 0) {
        setError('Gagal download PDF');
        setDownloading(false);
        return;
      }
      
      setDownloadedFiles(downloadResult.downloaded);
      setDownloading(false);
      setExtracting(true);
      
      // Step 2: Extract shareholders
      const fileNames = downloadResult.downloaded.map(d => d.file_name);
      const extractResult = await api.extractShareholders(fileNames);
      
      setShareholderResults(extractResult.results || []);
      
    } catch (err) {
      setError('Gagal memproses PDF: ' + err.message);
    } finally {
      setDownloading(false);
      setExtracting(false);
    }
  };

  const handleClearResults = async () => {
    setShareholderResults([]);
    setDownloadedFiles([]);
    setSelectedPDFs([]);
    
    try {
      await api.clearPDFCache();
    } catch (err) {
      console.error('Failed to clear cache:', err);
    }
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('id-ID').format(num);
  };

  const periodeLabels = {
    tw1: 'TW1',
    tw2: 'TW2',
    tw3: 'TW3',
    tahunan: 'Tahunan'
  };

  return (
    <div className="analysis-page">
      <div className="analysis-container">
        {/* Header */}
        <div className="analysis-header">
          <h1 className="page-title">Shareholder Analysis</h1>
          <p className="page-description">
            Extract shareholder data from IDX financial reports
          </p>
        </div>

        {/* Filters Card */}
        <div className="card filter-card">
          <div className="card-header">
            <h2 className="card-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
              </svg>
              Filter Laporan
            </h2>
          </div>
          
          <div className="filter-grid">
            {/* Year - Multi Select */}
            <div className="filter-group">
              <label className="filter-label">Tahun</label>
              <div className="multi-select-group">
                {[2025, 2024, 2023, 2022, 2021].map(year => (
                  <button
                    key={year}
                    className={`chip ${years.includes(year) ? 'active' : ''}`}
                    onClick={() => toggleYear(year)}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>

            {/* Periode - Multi Select */}
            <div className="filter-group">
              <label className="filter-label">Periode</label>
              <div className="multi-select-group">
                {['tw1', 'tw2', 'tw3', 'tahunan'].map(p => (
                  <button
                    key={p}
                    className={`chip ${periodes.includes(p) ? 'active' : ''}`}
                    onClick={() => togglePeriode(p)}
                  >
                    {periodeLabels[p]}
                  </button>
                ))}
              </div>
            </div>

            {/* Emiten */}
            <div className="filter-group emiten-group" ref={emitenRef}>
              <label className="filter-label">Kode Emiten</label>
              <div className="emiten-input-wrapper">
                <input
                  type="text"
                  className="filter-input"
                  placeholder="Cari emiten (misal: DEWA)"
                  value={emitenSearch}
                  onChange={(e) => {
                    setEmitenSearch(e.target.value);
                    setShowEmitenDropdown(true);
                  }}
                  onFocus={() => setShowEmitenDropdown(true)}
                />
                {emiten && (
                  <span className="selected-emiten-badge">{emiten}</span>
                )}
                {showEmitenDropdown && emitenSearch && filteredEmiten.length > 0 && (
                  <div className="emiten-dropdown">
                    {filteredEmiten.slice(0, 10).map(e => (
                      <div 
                        key={e.code}
                        className={`emiten-option ${emiten === e.code ? 'selected' : ''}`}
                        onClick={() => {
                          setEmiten(e.code);
                          setEmitenSearch(e.code);
                          setShowEmitenDropdown(false);
                        }}
                      >
                        <span className="emiten-code">{e.code}</span>
                        <span className="emiten-name">{e.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {emiten && (
                <button 
                  className="clear-emiten"
                  onClick={() => {
                    setEmiten('');
                    setEmitenSearch('');
                  }}
                >
                  ✕ Clear
                </button>
              )}
            </div>

            {/* Search Button */}
            <div className="filter-group filter-actions">
              <button 
                className="btn btn-primary btn-glow"
                onClick={handleSearch}
                disabled={loadingSearch}
              >
                {loadingSearch ? (
                  <>
                    <span className="spinner"></span>
                    Mencari...
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8"></circle>
                      <path d="m21 21-4.3-4.3"></path>
                    </svg>
                    Cari Laporan
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="error-message">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            {error}
          </div>
        )}

        {/* PDF List Card */}
        {pdfFiles.length > 0 && (
          <div className="card pdf-list-card">
            <div className="card-header">
              <h2 className="card-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                Daftar PDF ({pdfFiles.length} file)
              </h2>
              <div className="card-actions">
                <button 
                  className="btn btn-outline btn-sm"
                  onClick={handleSelectAll}
                >
                  {selectedPDFs.length === pdfFiles.length ? 'Batalkan Semua' : 'Pilih Semua'}
                </button>
                <button 
                  className="btn btn-primary btn-sm btn-glow"
                  onClick={handleDownloadAndExtract}
                  disabled={selectedPDFs.length === 0 || downloading || extracting}
                >
                  {downloading ? (
                    <>
                      <span className="spinner"></span>
                      Downloading...
                    </>
                  ) : extracting ? (
                    <>
                      <span className="spinner"></span>
                      Extracting...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                      Analisis ({selectedPDFs.length})
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="pdf-list">
              {pdfFiles.map((pdf, idx) => (
                <div 
                  key={idx}
                  className={`pdf-item ${selectedPDFs.find(p => p.url === pdf.url) ? 'selected' : ''}`}
                  onClick={() => handleSelectPDF(pdf)}
                >
                  <div className="pdf-checkbox">
                    <input 
                      type="checkbox"
                      checked={!!selectedPDFs.find(p => p.url === pdf.url)}
                      onChange={() => {}}
                    />
                  </div>
                  <div className="pdf-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                  </div>
                  <div className="pdf-info">
                    <span className="pdf-name">{pdf.file_name}</span>
                    <span className="pdf-meta">
                      <span className="pdf-badge emiten">{pdf.emiten}</span>
                      <span className="pdf-badge year">{pdf.year}</span>
                      <span className="pdf-badge periode">{periodeLabels[pdf.periode]}</span>
                      <span className="pdf-size">{pdf.file_size_kb} KB</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results Card */}
        {shareholderResults.length > 0 && (
          <div className="card results-card">
            <div className="card-header">
              <h2 className="card-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                Data Pemegang Saham
              </h2>
              <button 
                className="btn btn-outline btn-sm"
                onClick={handleClearResults}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                Clear Results
              </button>
            </div>

            {shareholderResults.map((result, idx) => (
              <div key={idx} className="result-section">
                <h3 className="result-file-name">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                  </svg>
                  {result.file_name}
                  {result.error && <span className="result-error">Error: {result.error}</span>}
                  {result.shareholders && result.shareholders.length > 0 && (
                    <span className="result-count">{result.shareholders.length} pemegang saham</span>
                  )}
                </h3>
                
                {result.shareholders && result.shareholders.length > 0 ? (
                  <div className="table-wrapper">
                    <table className="shareholders-table">
                      <thead>
                        <tr>
                          <th>Tanggal</th>
                          <th>Pemegang Saham</th>
                          <th className="text-right">Jumlah Saham</th>
                          <th className="text-right">Persentase (%)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.shareholders.map((sh, shIdx) => (
                          <tr key={shIdx}>
                            <td><span className="date-badge">{sh.tanggal}</span></td>
                            <td className="shareholder-name">{sh.pemegang_saham}</td>
                            <td className="text-right num-cell">{formatNumber(sh.jumlah_saham)}</td>
                            <td className="text-right">
                              <span className={`pct-badge ${sh.persentase >= 20 ? 'high' : sh.persentase >= 5 ? 'medium' : 'low'}`}>
                                {sh.persentase.toFixed(2)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="no-data">Tidak ada data pemegang saham ditemukan</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AnalysisPage;
