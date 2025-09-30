import React from 'react';

interface AboutSupportProps {
  showDebugConsole: boolean;
  onToggleDebugConsole: (enabled: boolean) => void;
}

const AboutSupport: React.FC<AboutSupportProps> = ({ showDebugConsole, onToggleDebugConsole }) => {

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
    <div>
      <p className="text-slate-600 dark:text-slate-300 mb-4">
        This is an open-source project. We welcome contributions and feedback from the community.
      </p>
      <div className="space-y-4">
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
      <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
            <div>
                <h4 className="font-semibold text-slate-800 dark:text-slate-100">Debug Console</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Show the developer debug console for this session only.
                </p>
            </div>
            <button
              type="button"
              onClick={() => onToggleDebugConsole(!showDebugConsole)}
              className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 dark:focus:ring-offset-slate-800 ${showDebugConsole ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-600'}`}
              aria-pressed={showDebugConsole}
              aria-label="Toggle Debug Console"
            >
              <span className="sr-only">Toggle Debug Console</span>
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${showDebugConsole ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
        </div>
      </div>
    </div>
  );
};

export default AboutSupport;
