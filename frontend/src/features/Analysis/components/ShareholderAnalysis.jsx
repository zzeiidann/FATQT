import { useState, useEffect, useRef } from 'react';
import { stockAPI as api } from '../../../services/api';

function ShareholderAnalysis() {
  // Filter states
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
  
  // Results
  const [shareholderResults, setShareholderResults] = useState([]);
  const [error, setError] = useState('');

  // Load emiten list
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

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emitenRef.current && !emitenRef.current.contains(event.target)) {
        setShowEmitenDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      api.clearPDFCache().catch(console.error);
    };
  }, []);

  const filteredEmiten = emitenList.filter(e => 
    e.code.toLowerCase().includes(emitenSearch.toLowerCase()) ||
    e.name.toLowerCase().includes(emitenSearch.toLowerCase())
  ).slice(0, 8);

  const toggleYear = (year) => {
    setYears(prev => prev.includes(year) 
      ? prev.filter(y => y !== year)
      : [...prev, year].sort((a, b) => b - a)
    );
  };

  const togglePeriode = (p) => {
    setPeriodes(prev => prev.includes(p) 
      ? prev.filter(x => x !== p)
      : [...prev, p]
    );
  };

  const handleSearch = async () => {
    if (years.length === 0 || periodes.length === 0) {
      setError('Pilih minimal satu tahun dan periode');
      return;
    }

    setLoadingSearch(true);
    setError('');
    setPdfFiles([]);
    setSelectedPDFs([]);
    setShareholderResults([]);
    
    try {
      const allFiles = [];
      
      for (const year of years) {
        for (const periode of periodes) {
          const data = await api.searchIDXReports(year, periode, emiten);
          if (data.files?.length > 0) {
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
        setError('Tidak ada laporan ditemukan');
      }
    } catch (err) {
      setError('Gagal mencari: ' + err.message);
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleSelectPDF = (pdf) => {
    setSelectedPDFs(prev => {
      const exists = prev.find(p => p.url === pdf.url);
      return exists 
        ? prev.filter(p => p.url !== pdf.url)
        : [...prev, pdf];
    });
  };

  const handleSelectAll = () => {
    setSelectedPDFs(
      selectedPDFs.length === pdfFiles.length ? [] : [...pdfFiles]
    );
  };

  const handleAnalyze = async () => {
    if (selectedPDFs.length === 0) {
      setError('Pilih minimal satu PDF');
      return;
    }

    setError('');
    setDownloading(true);
    setShareholderResults([]);
    
    try {
      console.log('Starting analysis for', selectedPDFs.length, 'PDFs');
      const urls = selectedPDFs.map(p => p.url);
      console.log('URLs to download:', urls);
      
      const downloadResult = await api.downloadIDXPDFs(urls);
      console.log('Download result:', downloadResult);
      
      if (!downloadResult.downloaded || downloadResult.downloaded.length === 0) {
        setError('Gagal download PDF');
        setDownloading(false);
        return;
      }
      
      setDownloading(false);
      setExtracting(true);
      
      const fileNames = downloadResult.downloaded.map(d => d.file_name);
      console.log('Files to extract:', fileNames);
      
      const extractResult = await api.extractShareholders(fileNames);
      console.log('Extract result:', extractResult);
      
      setShareholderResults(extractResult.results || []);
    } catch (err) {
      console.error('Analysis error:', err);
      setError('Gagal memproses: ' + err.message);
    } finally {
      setDownloading(false);
      setExtracting(false);
    }
  };

  const handleClear = async () => {
    setShareholderResults([]);
    setSelectedPDFs([]);
    try {
      await api.clearPDFCache();
    } catch (err) {
      console.error('Clear cache error:', err);
    }
  };

  const formatNumber = (num) => new Intl.NumberFormat('id-ID').format(num);

  const periodeLabels = { tw1: 'TW1', tw2: 'TW2', tw3: 'TW3', tahunan: 'Tahunan' };

  return (
    <div className="shareholder-analysis">
      {/* Compact Filter Bar */}
      <div className="filter-bar">
        <div className="filter-section">
          <span className="filter-label">Tahun</span>
          <div className="chip-group">
            {[2025, 2024, 2023].map(year => (
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

        <div className="filter-section">
          <span className="filter-label">Periode</span>
          <div className="chip-group">
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

        <div className="filter-section emiten-section" ref={emitenRef}>
          <span className="filter-label">Emiten</span>
          <div className="emiten-input-wrapper">
            <input
              type="text"
              className="emiten-input"
              placeholder="Cari kode/nama..."
              value={emitenSearch}
              onChange={(e) => {
                setEmitenSearch(e.target.value);
                setShowEmitenDropdown(true);
              }}
              onFocus={() => setShowEmitenDropdown(true)}
            />
            {emiten && (
              <button className="emiten-badge" onClick={() => { setEmiten(''); setEmitenSearch(''); }}>
                {emiten} ×
              </button>
            )}
            {showEmitenDropdown && emitenSearch && filteredEmiten.length > 0 && (
              <div className="emiten-dropdown">
                {filteredEmiten.map(e => (
                  <div 
                    key={e.code}
                    className="emiten-option"
                    onClick={() => {
                      setEmiten(e.code);
                      setEmitenSearch('');
                      setShowEmitenDropdown(false);
                    }}
                  >
                    <span className="code">{e.code}</span>
                    <span className="name">{e.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <button 
          className="btn-search"
          onClick={handleSearch}
          disabled={loadingSearch}
        >
          {loadingSearch ? (
            <span className="spinner" />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.3-4.3"></path>
            </svg>
          )}
          Search
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="error-toast">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          {error}
        </div>
      )}

      {/* Content Area - Split View */}
      {pdfFiles.length > 0 && (
        <div className="content-split">
          {/* Left: PDF List */}
          <div className="pdf-panel">
            <div className="panel-header">
              <h3>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
                PDF Files
                <span className="count">{pdfFiles.length}</span>
              </h3>
              <div className="panel-actions">
                <button className="btn-ghost" onClick={handleSelectAll}>
                  {selectedPDFs.length === pdfFiles.length ? 'None' : 'All'}
                </button>
                <button 
                  className="btn-primary btn-sm"
                  onClick={handleAnalyze}
                  disabled={selectedPDFs.length === 0 || downloading || extracting}
                >
                  {downloading ? 'Downloading...' : extracting ? 'Extracting...' : `Analyze (${selectedPDFs.length})`}
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
                  <input 
                    type="checkbox"
                    checked={!!selectedPDFs.find(p => p.url === pdf.url)}
                    onChange={() => {}}
                  />
                  <div className="pdf-info">
                    <span className="pdf-name">{pdf.file_name}</span>
                    <div className="pdf-meta">
                      <span className="badge emiten">{pdf.emiten}</span>
                      <span className="badge">{pdf.year}</span>
                      <span className="badge">{periodeLabels[pdf.periode]}</span>
                      <span className="size">{pdf.file_size_kb} KB</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Results */}
          <div className="results-panel">
            {shareholderResults.length > 0 ? (
              <>
                <div className="panel-header">
                  <h3>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    Shareholders
                  </h3>
                  <button className="btn-ghost" onClick={handleClear}>Clear</button>
                </div>

                <div className="results-scroll">
                  {shareholderResults.map((result, idx) => (
                    <div key={idx} className="result-block">
                      <div className="result-header">
                        <span className="file-name">{result.file_name}</span>
                        {result.error && <span className="error-tag">Error</span>}
                        {result.shareholders?.length > 0 && (
                          <span className="count-tag">{result.shareholders.length}</span>
                        )}
                      </div>
                      
                      {result.shareholders?.length > 0 ? (
                        <table className="shareholders-table">
                          <thead>
                            <tr>
                              <th>Tanggal</th>
                              <th>Pemegang Saham</th>
                              <th className="right">Saham</th>
                              <th className="right">%</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.shareholders.map((sh, shIdx) => (
                              <tr key={shIdx}>
                                <td><span className="date-tag">{sh.tanggal}</span></td>
                                <td className="name-cell">{sh.pemegang_saham}</td>
                                <td className="right mono">{formatNumber(sh.jumlah_saham)}</td>
                                <td className="right">
                                  <span className={`pct ${sh.persentase >= 20 ? 'high' : sh.persentase >= 5 ? 'med' : 'low'}`}>
                                    {sh.persentase < 0.01 ? sh.persentase.toFixed(4) : sh.persentase.toFixed(2)}%
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="no-data">No shareholders found</p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                <h4>No Results Yet</h4>
                <p>Select PDFs and click Analyze to extract shareholder data</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty State - No PDFs */}
      {pdfFiles.length === 0 && !loadingSearch && (
        <div className="initial-state">
          <div className="initial-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
          </div>
          <h3>Search IDX Financial Reports</h3>
          <p>Filter by year, periode, and emiten, then search for available PDF reports</p>
        </div>
      )}
    </div>
  );
}

export default ShareholderAnalysis;
