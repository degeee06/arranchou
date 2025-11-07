/**
 * Finds and unregisters any active Service Workers.
 * This is useful for cleaning up old/broken service workers that might be causing caching issues.
 */
export const unregisterServiceWorkers = () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      if (registrations.length > 0) {
        console.log('Unregistering existing service workers...');
        for (const registration of registrations) {
          registration.unregister().then((unregistered) => {
            if (unregistered) {
              console.log('Service worker unregistered successfully. Page will reload.');
              // Reload the page to ensure the new content is loaded without the service worker's interference.
              window.location.reload();
            } else {
              console.log('Service worker unregistration failed.');
            }
          }).catch((error) => {
            console.error('Error during service worker unregistration:', error);
          });
        }
      }
    }).catch((error) => {
      console.error('Error getting service worker registrations:', error);
    });
  }
};
