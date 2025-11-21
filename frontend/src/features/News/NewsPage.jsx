import './News.css';

function NewsPage() {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Market News</h1>
        <p className="page-description">Stay updated with the latest financial news and market insights</p>
      </div>
      
      <div className="empty-state">
        <div className="empty-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"></path>
            <path d="M18 14h-8"></path>
            <path d="M15 18h-5"></path>
            <path d="M10 6h8v4h-8V6Z"></path>
          </svg>
        </div>
        <h2 className="empty-title">Financial News Feed</h2>
        <p className="empty-description">
          Get real-time market news, company announcements, and economic updates 
          that impact your investments.
        </p>
      </div>
    </div>
  );
}

export default NewsPage;
