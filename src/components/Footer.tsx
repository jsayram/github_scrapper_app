import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="mt-16 flex gap-6 flex-wrap items-center justify-center text-sm text-gray-500">
      <div>© {new Date().getFullYear()} GitHub Scraper</div>
      <div>Analyze any repository with ease</div>
    </footer>
  );
};

export default Footer;