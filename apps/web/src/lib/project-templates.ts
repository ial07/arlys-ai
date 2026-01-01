/**
 * Project Templates - PURE STATIC HTML MODE
 *
 * Essential file templates for static HTML preview.
 * NO JAVASCRIPT. NO FRAMEWORKS. NO BUILD STEP.
 * Only: index.html + style.css
 */

export const FOUNDATION_FILES: Record<string, (...args: any[]) => string> = {
  /**
   * STATIC HTML MODE: Entry point
   */
  "index.html": (projectName: string) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectName}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header>
    <h1>${projectName}</h1>
    <p>Your static preview is ready.</p>
  </header>
  
  <main>
    <section>
      <h2>Welcome</h2>
      <p>This is a static HTML preview. No JavaScript. No frameworks.</p>
      <p>Edit index.html to customize your content.</p>
    </section>
    
    <section>
      <h2>Features</h2>
      <ul>
        <li>Fast loading</li>
        <li>No build step</li>
        <li>Instant preview</li>
      </ul>
    </section>
  </main>
  
  <footer>
    <p>Built with Arlys AI</p>
  </footer>
</body>
</html>
`,

  /**
   * STATIC HTML MODE: Stylesheet
   */
  "style.css": () => `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
  min-height: 100vh;
  line-height: 1.6;
}

header {
  text-align: center;
  padding: 4rem 2rem 2rem;
}

header h1 {
  font-size: 3rem;
  margin-bottom: 0.5rem;
}

header p {
  opacity: 0.8;
  font-size: 1.2rem;
}

main {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

section {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 2rem;
  backdrop-filter: blur(10px);
}

section h2 {
  margin-bottom: 1rem;
  font-size: 1.5rem;
}

section p {
  margin-bottom: 0.5rem;
}

ul {
  list-style: none;
  padding-left: 0;
}

li {
  padding: 0.5rem 0;
  padding-left: 1.5rem;
  position: relative;
}

li::before {
  content: '→';
  position: absolute;
  left: 0;
}

footer {
  text-align: center;
  padding: 2rem;
  opacity: 0.7;
}

button, a {
  display: inline-block;
  background: #ffffff;
  color: #667eea;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  text-decoration: none;
  margin-top: 1rem;
}

button:hover, a:hover {
  opacity: 0.9;
}
`,
};

/**
 * List of files required for a static HTML preview
 */
export const REQUIRED_FILES = ["index.html", "style.css"];

/**
 * Check which required files are missing
 */
export function getMissingFoundationFiles(existingPaths: string[]): string[] {
  const normalizedPaths = existingPaths.map((p) => p.replace(/^\//, ""));
  return REQUIRED_FILES.filter((req) => !normalizedPaths.includes(req));
}
