/* eslint-disable @next/next/no-img-element */
export default function SiteFooter() {
  return (
    <footer className="uftr-footer">
      <style>{`
        .uftr-footer{position:relative;z-index:1;background:#0d1b2e;color:rgba(255,255,255,.6);font-size:1rem;line-height:1.6;display:block;width:100%;}
        .uftr-container{width:100%;max-width:1280px;margin:0 auto;padding:2rem;display:flex;flex-wrap:wrap;gap:2rem;justify-content:space-between;}
        .uftr-brand img{height:42px;width:auto;}
        .uftr-col h4{color:#fff;margin-bottom:.75rem;font-size:1rem;}
        .uftr-col a{display:block;color:rgba(255,255,255,.6);text-decoration:none;margin:.25rem 0;}
        .uftr-col a:hover{color:#fff;}
        .uftr-bottom{border-top:1px solid rgba(255,255,255,.07);padding:1rem 2rem;text-align:center;font-size:.85rem;color:rgba(255,255,255,.45);}
      `}</style>
      <div className="uftr-container">
        <div className="uftr-brand">
          <img src="/assets/images/edulari-logo.png" alt="Edulari" />
          <p>Learn from expert instructors online.</p>
        </div>
        <div className="uftr-col">
          <h4>Platform</h4>
          <a href="/browse-courses">Browse Courses</a>
          <a href="/categories">Categories</a>
          <a href="/verify-certificate">Verify Certificate</a>
        </div>
        <div className="uftr-col">
          <h4>Company</h4>
          <a href="/about">About</a>
          <a href="/updates">Updates</a>
          <a href="/security">Security</a>
        </div>
        <div className="uftr-col">
          <h4>Support</h4>
          <a href="/help-center">Help Center</a>
          <a href="/contact">Contact Us</a>
          <a href="/report-bug">Report a Bug</a>
        </div>
      </div>
      <div className="uftr-bottom">&copy; 2026 Edulari. All rights reserved.</div>
    </footer>
  );
}
