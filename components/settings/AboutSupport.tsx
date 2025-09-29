import React from 'react';

const AboutSupport: React.FC = () => {

  const links = [
    {
      href: 'https://github.com/centerionware/smartbillsplitter',
      title: 'GitHub Repository',
      description: 'View the source code, star the project, or contribute.',
      icon: '⭐'
    },
    {
      href: 'https://github.com/centerionware/smartbillsplitter/issues',
      title: 'Report an Issue / Request a Feature',
      description: 'Found a bug or have a great idea? Let us know!',
      icon: '🐞'
    },
    {
      href: 'https://github.com/centerionware/smartbillsplitter/commits/main',
      title: 'Changelog',
      description: 'See what’s new by viewing recent commit messages.',
      icon: '📜'
    }
  ];

  return (
    <div className="space-y-4">
      <p className="text-slate-600 dark:text-slate-300">
        This is an open-source project. We welcome contributions and feedback from the community.
      </p>
      {links.map(link => (
        <a 
          key={link.href}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full text-left p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors flex items-center gap-4"
        >
          <div className="text-2xl">{link.icon}</div>
          <div className="flex-grow">
            <h4 className="font-semibold text-slate-800 dark:text-slate-100">{link.title}</h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{link.description}</p>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400 dark:text-slate-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
        </a>
      ))}
    </div>
  );
};

export default AboutSupport;