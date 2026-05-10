/**
 * Levenshtein distance between two strings.
 * Used for typosquatting detection.
 */
export function levenshtein(a: string, b: string): number {
  const an = a.length
  const bn = b.length
  const matrix: number[][] = []

  for (let i = 0; i <= an; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= bn; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= an; i++) {
    for (let j = 1; j <= bn; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      )
    }
  }

  return matrix[an][bn]
}

/** Typosquatting finding. */
export interface TyposquatFinding {
  readonly packageName: string
  readonly similarTo: string
  readonly similarityType: "edit-distance" | "hyphen-confusion" | "scope-confusion" | "prefix-suffix" | "transposed"
  readonly confidence: "low" | "medium" | "high"
  readonly severity: "warning" | "high" | "critical"
}

/** Top popular npm packages. */
const POPULAR_NPM = [
  "react", "express", "lodash", "axios", "webpack", "typescript", "next", "vue",
  "angular", "moment", "chalk", "commander", "inquirer", "dotenv", "cors", "uuid",
  "debug", "yargs", "fs-extra", "glob", "semver", "request", "async", "bluebird",
  "body-parser", "cookie-parser", "jsonwebtoken", "mongoose", "passport", "socket.io",
  "babel-core", "eslint", "prettier", "jest", "mocha", "chai", "sinon",
  "cheerio", "puppeteer", "playwright", "date-fns", "dayjs", "rxjs", "zone.js",
  "rimraf", "mkdirp", "node-fetch", "got", "superagent", "form-data",
  "nodemon", "concurrently", "cross-env", "dotenv-expand", "envalid",
  "immer", "redux", "mobx", "zustand", "react-router-dom", "react-query",
  "styled-components", "tailwindcss", "postcss", "autoprefixer",
  "sharp", "bcrypt", "helmet", "compression", "morgan", "winston", "pino",
  "socket.io-client", "graphql", "apollo-client", "apollo-server",
  "prisma", "typeorm", "sequelize", "knex", "drizzle-orm", "zod", "joi",
  "class-validator", "class-transformer", "reflect-metadata",
  "swagger-ui-express", "swagger-jsdoc", "openapi-types",
  "ioredis", "redis", "pg", "mysql2", "sqlite3", "mongodb",
  "bull", "amqplib", "kafkajs", "mqtt", "ws",
  "crypto-js", "jsonwebtoken", "passport-jwt", "bcryptjs",
  "husky", "lint-staged", "commitizen", "standard-version",
  "nx", "turbo", "lerna", "changesets",
]

/** Top popular pip packages. */
const POPULAR_PIP = [
  "requests", "flask", "django", "numpy", "pandas", "boto3", "setuptools",
  "pytest", "pillow", "beautifulsoup4", "scrapy", "tensorflow", "torch",
  "scikit-learn", "matplotlib", "seaborn", "fastapi", "uvicorn", "gunicorn",
  "sqlalchemy", "alembic", "celery", "redis", "psycopg2", "pymongo",
  "jinja2", "werkzeug", "click", "typer", "rich", "tqdm",
  "pydantic", "pydantic-settings", "python-dotenv", "python-dateutil",
  "black", "flake8", "isort", "mypy", "pylint", "coverage",
  "sphinx", "mkdocs", "httpx", "aiohttp", "asyncio", "websockets",
  "cryptography", "pycryptodome", "authlib", "python-jose",
  "boto3", "botocore", "awscli", "google-cloud-storage", "azure-storage-blob",
  "docker", "kubernetes", "apache-airflow", "prefect", "dagster",
  "jupyter", "ipython", "notebook", "streamlit", "gradio",
  "loguru", "structlog", "sentry-sdk", "opentelemetry-api",
  "pydub", "moviepy", "opencv-python", "nltk", "spacy", "transformers",
]

/** Combined popular packages for all ecosystems. */
const ALL_POPULAR = [
  ...POPULAR_NPM.map((n) => ({ name: n, source: "npm" as const })),
  ...POPULAR_PIP.map((n) => ({ name: n, source: "pip" as const })),
]

/**
 * Check a package name for typosquatting against popular packages.
 */
export function checkTyposquat(name: string, sensitivity: "low" | "medium" | "high" = "medium"): TyposquatFinding[] {
  const findings: TyposquatFinding[] = []
  const cleanName = name.replace(/^@[^/]+\//, "") // strip scope for comparison

  // Check scope confusion
  if (name.startsWith("@")) {
    const unscoped = cleanName
    if (ALL_POPULAR.some((p) => p.name === unscoped)) {
      findings.push({
        packageName: name,
        similarTo: unscoped,
        similarityType: "scope-confusion",
        confidence: "high",
        severity: "critical",
      })
    }
  }

  const maxDist = sensitivity === "high" ? 2 : sensitivity === "low" ? 1 : 2

  for (const popular of ALL_POPULAR) {
    if (popular.name === cleanName) continue // exact match is not typosquatting

    // Hyphen/underscore confusion
    const hyphenForm = popular.name.replace(/-/g, "_")
    const underscoreForm = popular.name.replace(/_/g, "-")
    if (cleanName === hyphenForm || cleanName === underscoreForm) {
      findings.push({
        packageName: name,
        similarTo: popular.name,
        similarityType: "hyphen-confusion",
        confidence: "high",
        severity: "high",
      })
      continue
    }

    // Edit distance
    const dist = levenshtein(cleanName.toLowerCase(), popular.name.toLowerCase())
    if (dist > 0 && dist <= maxDist) {
      const isTransposed = dist === 2 && cleanName.length === popular.name.length &&
        cleanName.split("").sort().join("") === popular.name.split("").sort().join("")

      findings.push({
        packageName: name,
        similarTo: popular.name,
        similarityType: isTransposed ? "transposed" : "edit-distance",
        confidence: dist === 1 ? "high" : dist === 2 ? "medium" : "low",
        severity: dist === 1 ? "critical" : "high",
      })
      continue
    }

    // Prefix/suffix tricks: popular name + common suffix
    if (maxDist >= 2) {
      const commonSuffixes = ["-helper", "-utils", "-lib", "-js", "-node", "-pkg", "-core", "-client", "-server", "-types", "-api"]
      for (const suffix of commonSuffixes) {
        if (cleanName === popular.name + suffix) {
          findings.push({
            packageName: name,
            similarTo: popular.name,
            similarityType: "prefix-suffix",
            confidence: "medium",
            severity: "warning",
          })
          break
        }
      }
    }
  }

  // Deduplicate by keeping the highest confidence finding for each similarTo
  return deduplicate(findings)
}

function deduplicate(findings: TyposquatFinding[]): TyposquatFinding[] {
  const best = new Map<string, TyposquatFinding>()
  for (const f of findings) {
    const key = f.similarTo
    const existing = best.get(key)
    if (!existing) {
      best.set(key, f)
    } else {
      const order = ["low", "medium", "high"]
      if (order.indexOf(f.confidence) > order.indexOf(existing.confidence)) {
        best.set(key, f)
      }
    }
  }
  return Array.from(best.values())
}
