import './Portfolio.css';

function PortfolioPage() {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Portfolio</h1>
        <p className="page-description">Track your investment performance and holdings</p>
      </div>
      
      <div className="empty-state">
        <div className="empty-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
          </svg>
        </div>
        <h2 className="empty-title">Portfolio Analytics Coming Soon</h2>
        <p className="empty-description">
          View comprehensive analytics of your investment portfolio, including performance metrics, 
          asset allocation, and historical returns.
        </p>
      </div>
    </div>
  );
}

export default PortfolioPage;
