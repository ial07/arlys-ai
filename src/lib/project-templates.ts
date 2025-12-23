/**
 * Project Templates
 *
 * Essential file templates for runnable Next.js projects.
 * These ensure projects can be installed and run immediately.
 */

/**
 * Common NPM packages and their versions
 */
const PACKAGE_VERSIONS: Record<string, string> = {
  // Core
  next: "^14.0.0",
  react: "^18.2.0",
  "react-dom": "^18.2.0",

  // HTTP
  axios: "^1.6.0",

  // Database
  "@prisma/client": "^5.0.0",
  prisma: "^5.0.0",

  // UI Libraries
  "lucide-react": "^0.300.0",
  "react-icons": "^5.0.0",
  clsx: "^2.0.0",
  "class-variance-authority": "^0.7.0",
  tailwindcss: "^3.4.0",
  "tailwind-merge": "^2.0.0",

  // Forms
  "react-hook-form": "^7.0.0",
  zod: "^3.22.0",
  "@hookform/resolvers": "^3.0.0",

  // State
  zustand: "^4.0.0",
  "@tanstack/react-query": "^5.0.0",
  swr: "^2.0.0",

  // Auth
  "next-auth": "^4.0.0",

  // Utils
  dayjs: "^1.11.0",
  "date-fns": "^3.0.0",
  uuid: "^9.0.0",
  lodash: "^4.17.0",

  // Dev dependencies
  "@types/node": "^20.0.0",
  "@types/react": "^18.2.0",
  "@types/react-dom": "^18.2.0",
  "@types/uuid": "^9.0.0",
  "@types/lodash": "^4.14.0",
  typescript: "^5.0.0",
  eslint: "^8.0.0",
  "eslint-config-next": "^14.0.0",
  autoprefixer: "^10.4.0",
  postcss: "^8.4.0",
};

/**
 * Detect dependencies from generated code files
 */
export function detectDependencies(
  files: Array<{ path: string; content: string }>
): {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
} {
  const dependencies: Record<string, string> = {
    next: PACKAGE_VERSIONS.next,
    react: PACKAGE_VERSIONS.react,
    "react-dom": PACKAGE_VERSIONS["react-dom"],
  };
  const devDependencies: Record<string, string> = {
    "@types/node": PACKAGE_VERSIONS["@types/node"],
    "@types/react": PACKAGE_VERSIONS["@types/react"],
    "@types/react-dom": PACKAGE_VERSIONS["@types/react-dom"],
    typescript: PACKAGE_VERSIONS.typescript,
    eslint: PACKAGE_VERSIONS.eslint,
    "eslint-config-next": PACKAGE_VERSIONS["eslint-config-next"],
    tailwindcss: PACKAGE_VERSIONS.tailwindcss,
    autoprefixer: PACKAGE_VERSIONS.autoprefixer,
    postcss: PACKAGE_VERSIONS.postcss,
  };

  // Regex to find imports
  const importRegex = /(?:import|from)\s+['"]([^'"./][^'"]*)['"]/g;
  const requireRegex = /require\s*\(\s*['"]([^'"./][^'"]*)['"]\s*\)/g;

  for (const file of files) {
    const content = file.content;

    // Find all imports
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const pkg = match[1].split("/")[0]; // Get base package name
      if (pkg.startsWith("@")) {
        // Scoped package like @tanstack/react-query
        const scopedPkg = match[1].split("/").slice(0, 2).join("/");
        if (PACKAGE_VERSIONS[scopedPkg] && !dependencies[scopedPkg]) {
          if (scopedPkg.startsWith("@types/")) {
            devDependencies[scopedPkg] = PACKAGE_VERSIONS[scopedPkg];
          } else {
            dependencies[scopedPkg] = PACKAGE_VERSIONS[scopedPkg];
          }
        }
      } else if (PACKAGE_VERSIONS[pkg] && !dependencies[pkg]) {
        if (pkg.startsWith("@types/") || pkg === "prisma") {
          devDependencies[pkg] = PACKAGE_VERSIONS[pkg];
        } else {
          dependencies[pkg] = PACKAGE_VERSIONS[pkg];
        }
      }
    }

    // Also check requires
    while ((match = requireRegex.exec(content)) !== null) {
      const pkg = match[1].split("/")[0];
      if (PACKAGE_VERSIONS[pkg] && !dependencies[pkg]) {
        dependencies[pkg] = PACKAGE_VERSIONS[pkg];
      }
    }

    // Check for Prisma usage
    if (
      content.includes("@prisma/client") ||
      content.includes("PrismaClient")
    ) {
      dependencies["@prisma/client"] = PACKAGE_VERSIONS["@prisma/client"];
      devDependencies["prisma"] = PACKAGE_VERSIONS["prisma"];
    }
  }

  return { dependencies, devDependencies };
}

export const FOUNDATION_FILES = {
  "package.json": (
    projectName: string,
    files?: Array<{ path: string; content: string }>
  ) => {
    // Detect dependencies from code
    const detected = files
      ? detectDependencies(files)
      : {
          dependencies: {
            next: PACKAGE_VERSIONS.next,
            react: PACKAGE_VERSIONS.react,
            "react-dom": PACKAGE_VERSIONS["react-dom"],
          },
          devDependencies: {
            "@types/node": PACKAGE_VERSIONS["@types/node"],
            "@types/react": PACKAGE_VERSIONS["@types/react"],
            "@types/react-dom": PACKAGE_VERSIONS["@types/react-dom"],
            typescript: PACKAGE_VERSIONS.typescript,
            eslint: PACKAGE_VERSIONS.eslint,
            "eslint-config-next": PACKAGE_VERSIONS["eslint-config-next"],
            tailwindcss: PACKAGE_VERSIONS.tailwindcss,
            autoprefixer: PACKAGE_VERSIONS.autoprefixer,
            postcss: PACKAGE_VERSIONS.postcss,
          },
        };

    const pkg = {
      name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      version: "0.1.0",
      private: true,
      scripts: {
        dev: "next dev",
        build: "next build",
        start: "next start",
        lint: "next lint",
      },
      dependencies: detected.dependencies,
      devDependencies: detected.devDependencies,
    };

    return JSON.stringify(pkg, null, 2);
  },

  "tsconfig.json": () =>
    JSON.stringify(
      {
        compilerOptions: {
          lib: ["dom", "dom.iterable", "esnext"],
          allowJs: true,
          skipLibCheck: true,
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          module: "esnext",
          moduleResolution: "bundler",
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: "preserve",
          incremental: true,
          plugins: [{ name: "next" }],
          paths: { "@/*": ["./src/*"] },
        },
        include: [
          "next-env.d.ts",
          "**/*.ts",
          "**/*.tsx",
          ".next/types/**/*.ts",
        ],
        exclude: ["node_modules"],
      },
      null,
      2
    ),

  "next.config.js": () => `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

module.exports = nextConfig;
`,

  "tailwind.config.ts": () => `import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
`,

  "postcss.config.js": () => `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`,

  "src/app/globals.css": () => `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --foreground-rgb: 0, 0, 0;
  --background-rgb: 255, 255, 255;
}

@media (prefers-color-scheme: dark) {
  :root {
    --foreground-rgb: 255, 255, 255;
    --background-rgb: 10, 10, 10;
  }
}

body {
  color: rgb(var(--foreground-rgb));
  background: rgb(var(--background-rgb));
}
`,

  "src/app/layout.tsx": (
    projectName: string
  ) => `import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '${projectName}',
  description: 'Generated by Arlys AI Agent Builder',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`,

  "src/app/page.tsx": (projectName: string) => `export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-gradient-to-b from-gray-900 to-black text-white">
      <h1 className="text-4xl font-bold mb-4">${projectName}</h1>
      <p className="text-gray-400 text-center max-w-md">
        Your Next.js application is ready. Start editing src/app/page.tsx to customize this page.
      </p>
    </main>
  );
}
`,

  ".env.example": () => `# Environment Variables
# Copy this file to .env.local and fill in the values

# Database (if using Prisma)
# DATABASE_URL="postgresql://user:password@localhost:5432/mydb"
`,

  "README.md": (projectName: string, goal: string) => `# ${projectName}

${goal}

> Generated by **ARLYS AI**

## Prerequisites

### Install Node.js
1. Download Node.js LTS from [nodejs.org](https://nodejs.org/)
2. Verify installation:
\`\`\`bash
node -v
npm -v
\`\`\`

## Project Setup

1. Enter project folder:
\`\`\`bash
cd ${projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-")}
\`\`\`

2. Install dependencies:
\`\`\`bash
npm install
\`\`\`

## Environment Variables

1. Copy environment file:
\`\`\`bash
cp .env.example .env.local
\`\`\`

2. Configure .env.local:
- \`DATABASE_URL\`: Connection string for PostgreSQL/MySQL
- \`NEXTAUTH_SECRET\`: Random string for Auth

## Database Setup

1. Generate Prisma Client:
\`\`\`bash
npx prisma generate
\`\`\`

2. Run Migrations:
\`\`\`bash
npx prisma migrate dev
\`\`\`

## Running the Application

1. Start development server:
\`\`\`bash
npm run dev
\`\`\`

2. Open [http://localhost:3000](http://localhost:3000)

## Accessing CMS

Go to [http://localhost:3000/admin](http://localhost:3000/admin) to manage content.

<div align="center">
  <sub>Generated by Arlys AI</sub>
</div>
`,
};

/**
 * List of files required for a runnable Next.js project
 */
export const REQUIRED_FILES = [
  "package.json",
  "tsconfig.json",
  "next.config.js",
  "tailwind.config.ts",
  "postcss.config.js",
  "src/app/globals.css",
  "src/app/layout.tsx",
  "src/app/page.tsx",
];

/**
 * Check which required files are missing
 */
export function getMissingFoundationFiles(existingPaths: string[]): string[] {
  const normalizedPaths = existingPaths.map((p) => p.replace(/^\//, ""));
  return REQUIRED_FILES.filter((req) => !normalizedPaths.includes(req));
}
