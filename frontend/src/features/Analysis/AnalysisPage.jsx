import './Analysis.css';

function AnalysisPage() {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Analysis</h1>
        <p className="page-description">Advanced technical and fundamental analysis tools</p>
      </div>
      
      <div className="empty-state">
        <div className="empty-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
        </div>
        <h2 className="empty-title">Market Analysis Tools</h2>
        <p className="empty-description">
          Access advanced charting tools, technical indicators, and fundamental analysis 
          to make informed trading decisions.
        </p>
      </div>
    </div>
  );
}

export default AnalysisPage;
