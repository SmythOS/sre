const { PageEvent } = require('typedoc');

/**
 * A TypeDoc plugin that forces the light theme.
 * @param {import('typedoc').Application} app The TypeDoc application.
 */
function load(app) {
    app.renderer.on(PageEvent.END, (page) => {
        const bodyTag = '<body>';
        if (page.contents && page.contents.includes(bodyTag)) {
            const bodyIndex = page.contents.indexOf(bodyTag) + bodyTag.length;

            const forceThemeScript = `
        <script>
          // Function to force the theme to light.
          const forceLightTheme = () => {
            if (document.documentElement.dataset.theme !== 'light') {
              document.documentElement.dataset.theme = 'light';
            }
          };

          // Set the theme immediately to prevent a flash of the wrong theme.
          forceLightTheme();

          // Create an observer to watch for changes to the data-theme attribute.
          const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
              if (mutation.attributeName === 'data-theme') {
                forceLightTheme();
              }
            });
          });

          // Start observing the document element for attribute changes.
          observer.observe(document.documentElement, { attributes: true });
        </script>
      `;

            page.contents = page.contents.slice(0, bodyIndex) + forceThemeScript + page.contents.slice(bodyIndex);
        }
    });
}

exports.load = load;
