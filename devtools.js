// Only create the DevTools panel if on a Psychology Today member page
chrome.devtools.inspectedWindow.eval(
  'window.location.hostname',
  function(hostname, isException) {
    if (isException) return;

    // Check if hostname ends with psychologytoday.com
    const isValidHost = hostname && hostname.endsWith('psychologytoday.com');
    if (!isValidHost) return;

    // Check if URL contains "member"
    chrome.devtools.inspectedWindow.eval(
      'window.location.href',
      function(href, isException) {
        if (isException) return;

        const hasMember = href && href.includes('member');
        if (!hasMember) return;

        // Create the DevTools panel
        chrome.devtools.panels.create(
          "Sussex",
          null,
          "panel.html",
          function(panel) {
            console.log("Sussex DevTools panel created");
          }
        );
      }
    );
  }
);
