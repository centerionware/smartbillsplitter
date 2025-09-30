import React, { useState, useEffect } from 'react';

const PwaInstallBanner: React.FC = () => {
  const [canOpen, setCanOpen] = useState(false);
  const [appUrl, setAppUrl] = useState('');
  const isInIframe = window.self !== window.top;

  useEffect(() => {
    // This effect runs only when in an iframe to determine if the "Open" button can work.
    if (isInIframe) {
      try {
        // We attempt to construct a valid root URL. `window.location.href` is used
        // as the base. In some sandboxed environments, this `href` might be
        // something like 'about:blank', which would cause the URL constructor to fail.
        const url = new URL('/app.html', window.location.href).href;
        setAppUrl(url);
        setCanOpen(true); // If construction succeeds, we can show the button.
      } catch (e) {
        // If it fails, we're in a restrictive sandbox. We can't open a new tab reliably.
        console.warn("Cannot construct a valid URL to open in a new tab due to sandboxing.");
        setCanOpen(false); // The button will be hidden, and a message shown instead.
      }
    }
  }, [isInIframe]);

  if (!isInIframe) {
    return null; // Don't show the banner if not in an iframe.
  }

  const openInNewTab = () => {
    if (canOpen && appUrl) {
      window.open(appUrl, '_blank');
    }
  };

  return (
    <div className="bg-teal-50 dark:bg-teal-900/50 p-4 text-center text-sm text-teal-800 dark:text-teal-200 shadow-sm z-50">
      <div className="container mx-auto flex flex-col sm:flex-row items-center justify-center gap-3">
        {canOpen ? (
          <>
            <p>
              For the best experience, including offline use and installation, please open this app in its own tab.
            </p>
            <button
              onClick={openInNewTab}
              className="bg-teal-500 text-white font-semibold px-4 py-2 rounded-lg hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-300 flex-shrink-0"
            >
              Open Fullscreen
            </button>
          </>
        ) : (
          <p>
            For the best experience, please open this app's main URL in a new browser tab. This preview environment does not support opening a new tab automatically.
          </p>
        )}
      </div>
    </div>
  );
};

export default PwaInstallBanner;