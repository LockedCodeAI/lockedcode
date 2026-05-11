import type { Severity } from "../types"

/**
 * A single secret detection pattern.
 */
export interface SecretPattern {
  readonly id: string
  readonly name: string
  readonly regex: RegExp
  readonly severity: "high" | "critical"
  readonly description: string
  readonly remediation: string
}

/**
 * The full pattern library for secret detection.
 */
export const SECRET_PATTERNS: SecretPattern[] = [
  // ============================================================
  // Cloud Provider Keys
  // ============================================================
  {
    id: "aws-access-key-id",
    name: "AWS Access Key ID",
    regex: /AKIA[0-9A-Z]{16}/,
    severity: "critical",
    description: "AWS Access Key ID",
    remediation: "Revoke the key in AWS IAM and rotate to a new key.",
  },
  {
    id: "aws-secret-access-key",
    name: "AWS Secret Access Key",
    regex: /(?:aws_secret_access_key|aws secret access key)\s*[:=]\s*['"][A-Za-z0-9\/+=]{40}['"]/i,
    severity: "critical",
    description: "AWS Secret Access Key",
    remediation: "Revoke the key in AWS IAM and rotate to a new key.",
  },
  {
    id: "google-api-key",
    name: "Google API Key",
    regex: /AIza[0-9A-Za-z\-_]{35}/,
    severity: "high",
    description: "Google API Key",
    remediation: "Revoke the key in Google Cloud Console and generate a new one.",
  },
  {
    id: "azure-storage-account-key",
    name: "Azure Storage Account Key",
    regex: /(?:accountkey|account_key|storageaccountkey)\s*[:=]\s*['"][A-Za-z0-9+/=]{86,88}['"]/i,
    severity: "critical",
    description: "Azure Storage Account Key",
    remediation: "Rotate the key in Azure Portal and update all applications.",
  },

  // ============================================================
  // Source Control & CI
  // ============================================================
  {
    id: "github-pat-classic",
    name: "GitHub Personal Access Token (Classic)",
    regex: /ghp_[0-9A-Za-z]{36}/,
    severity: "critical",
    description: "GitHub Personal Access Token (Classic)",
    remediation: "Revoke the token in GitHub Settings > Developer settings.",
  },
  {
    id: "github-pat-fine-grained",
    name: "GitHub Personal Access Token (Fine-Grained)",
    regex: /github_pat_[0-9A-Za-z_]{82}/,
    severity: "critical",
    description: "GitHub Personal Access Token (Fine-Grained)",
    remediation: "Revoke the token in GitHub Settings > Developer settings.",
  },
  {
    id: "github-oauth-token",
    name: "GitHub OAuth Access Token",
    regex: /gho_[0-9A-Za-z]{36}/,
    severity: "critical",
    description: "GitHub OAuth Access Token",
    remediation: "Revoke the OAuth token in GitHub Settings.",
  },
  {
    id: "github-app-token",
    name: "GitHub App Token",
    regex: /gh[su]_[0-9A-Za-z]{36}/,
    severity: "critical",
    description: "GitHub App Token",
    remediation: "Regenerate the app token in GitHub App settings.",
  },
  {
    id: "gitlab-pat",
    name: "GitLab Personal Access Token",
    regex: /glpat-[0-9A-Za-z\-]{20}/,
    severity: "critical",
    description: "GitLab Personal Access Token",
    remediation: "Revoke the token in GitLab User Settings > Access Tokens.",
  },

  // ============================================================
  // Payment & Commerce
  // ============================================================
  {
    id: "stripe-secret-key",
    name: "Stripe Secret Key",
    regex: /(?:sk|rk|rk_live)_(?:live|test)_[0-9A-Za-z]{20,}/,
    severity: "critical",
    description: "Stripe Secret or Restricted Key",
    remediation: "Rotate the key in Stripe Dashboard > Developers > API Keys.",
  },
  {
    id: "square-access-token",
    name: "Square Access Token",
    regex: /sq0atp-[0-9A-Za-z\-_]{22}/,
    severity: "critical",
    description: "Square Access Token",
    remediation: "Revoke the token in Square Developer Dashboard.",
  },

  // ============================================================
  // Communication & SaaS
  // ============================================================
  {
    id: "slack-bot-token",
    name: "Slack Bot Token",
    regex: /xoxb-[0-9]{10,}-[0-9]{10,}-[0-9A-Za-z]{24}/,
    severity: "critical",
    description: "Slack Bot Token",
    remediation: "Revoke and regenerate the token in Slack API dashboard.",
  },
  {
    id: "slack-webhook-url",
    name: "Slack Webhook URL",
    regex: /https:\/\/hooks\.slack\.com\/services\/T[0-9A-Z]{8,}\/B[0-9A-Z]{8,}\/[0-9A-Za-z]{24}/,
    severity: "high",
    description: "Slack Webhook URL",
    remediation: "Delete or rotate the webhook in Slack API dashboard.",
  },
  {
    id: "twilio-account-sid",
    name: "Twilio Account SID",
    regex: /AC[0-9a-f]{32}/,
    severity: "high",
    description: "Twilio Account SID",
    remediation: "Rotate the auth token in Twilio Console.",
  },
  {
    id: "sendgrid-api-key",
    name: "SendGrid API Key",
    regex: /SG\.[0-9A-Za-z\-_]{22}\.[0-9A-Za-z\-_]{43}/,
    severity: "critical",
    description: "SendGrid API Key",
    remediation: "Rotate the key in SendGrid Settings > API Keys.",
  },
  {
    id: "mailgun-api-key",
    name: "Mailgun API Key",
    regex: /key-[0-9a-z]{32}/,
    severity: "high",
    description: "Mailgun API Key",
    remediation: "Rotate the key in Mailgun Dashboard.",
  },

  // ============================================================
  // Database Connection Strings
  // ============================================================
  {
    id: "db-connection-string",
    name: "Database Connection String with Password",
    regex: /(?:postgres|mysql|mongodb(?:\+srv)?|redis|rediss):\/\/[^:]+:[^@]+@/,
    severity: "critical",
    description: "Database connection string with embedded password",
    remediation: "Rotate the database password. Use environment variables or a secret manager.",
  },

  // ============================================================
  // Cryptographic Keys
  // ============================================================
  {
    id: "rsa-private-key",
    name: "RSA Private Key",
    regex: /-----BEGIN RSA PRIVATE KEY-----/,
    severity: "critical",
    description: "RSA Private Key header detected",
    remediation: "Remove the private key from source code. Use a secrets manager or environment variable.",
  },
  {
    id: "ec-private-key",
    name: "EC Private Key",
    regex: /-----BEGIN EC PRIVATE KEY-----/,
    severity: "critical",
    description: "EC Private Key header detected",
    remediation: "Remove the private key from source code. Use a secrets manager.",
  },
  {
    id: "generic-private-key",
    name: "Private Key",
    regex: /-----BEGIN PRIVATE KEY-----/,
    severity: "critical",
    description: "Generic Private Key header detected",
    remediation: "Remove the private key from source code. Use a secrets manager.",
  },
  {
    id: "pgp-private-key",
    name: "PGP Private Key",
    regex: /-----BEGIN PGP PRIVATE KEY BLOCK-----/,
    severity: "critical",
    description: "PGP Private Key Block detected",
    remediation: "Remove the private key from source code. Use a secrets manager.",
  },
  {
    id: "ssh-private-key",
    name: "SSH Private Key",
    regex: /-----BEGIN OPENSSH PRIVATE KEY-----/,
    severity: "critical",
    description: "SSH Private Key header detected",
    remediation: "Remove the SSH key from source code. Use ssh-agent or a secrets manager.",
  },

  // ============================================================
  // Authentication Tokens
  // ============================================================
  {
    id: "jwt-token",
    name: "JWT Token",
    regex: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
    severity: "high",
    description: "JWT Token detected",
    remediation: "If this is a valid token, revoke it and use short-lived tokens where possible.",
  },
  {
    id: "bearer-token-in-header",
    name: "Bearer Token in Code",
    regex: /Bearer\s+[A-Za-z0-9_\-\.]{20,}/,
    severity: "high",
    description: "Bearer token literal in source code",
    remediation: "Move the token to an environment variable.",
  },

  // ============================================================
  // AI/ML Provider Keys
  // ============================================================
  {
    id: "openai-api-key",
    name: "OpenAI API Key",
    regex: /sk-[0-9A-Za-z]{32,}/,
    severity: "critical",
    description: "OpenAI API Key",
    remediation: "Rotate the key in OpenAI Dashboard > API Keys.",
  },
  {
    id: "anthropic-api-key",
    name: "Anthropic API Key",
    regex: /sk-ant-[0-9A-Za-z\-]{32,}/,
    severity: "critical",
    description: "Anthropic API Key",
    remediation: "Rotate the key in Anthropic Console.",
  },
  {
    id: "huggingface-token",
    name: "Hugging Face Token",
    regex: /hf_[0-9A-Za-z]{34}/,
    severity: "high",
    description: "Hugging Face API Token",
    remediation: "Rotate the token in Hugging Face Settings.",
  },
]
