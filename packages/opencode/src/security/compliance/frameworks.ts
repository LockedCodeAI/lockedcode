export interface FrameworkControl {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly dataSources: string[] // what audit/trust/provenance data can evidence this
}

export interface FrameworkMapping {
  readonly framework: string
  readonly name: string
  readonly controls: FrameworkControl[]
}

export const FRAMEWORKS: FrameworkMapping[] = [
  {
    framework: "soc2",
    name: "SOC2",
    controls: [
      { id: "CC6.1", name: "Logical Access Controls", description: "Access to systems is restricted to authorized users and models", dataSources: ["registry", "policy", "trust"] },
      { id: "CC6.6", name: "Security Monitoring", description: "Security monitoring detects and alerts on anomalous activities", dataSources: ["audit", "scanning"] },
      { id: "CC6.8", name: "Change Management", description: "Changes are authorized, tracked, and logged", dataSources: ["provenance", "audit"] },
      { id: "CC7.2", name: "System Monitoring", description: "Systems are monitored for availability and performance issues", dataSources: ["trust", "audit"] },
      { id: "CC8.1", name: "Change Authorization", description: "Changes require authorization with documented justification", dataSources: ["audit", "policy"] },
    ],
  },
  {
    framework: "iso27001",
    name: "ISO 27001",
    controls: [
      { id: "A.8.9", name: "Configuration Management", description: "Security configurations are defined, implemented, and monitored", dataSources: ["policy"] },
      { id: "A.8.16", name: "Monitoring Activities", description: "Activities are monitored and logs are reviewed", dataSources: ["audit", "siem"] },
      { id: "A.8.25", name: "Secure Development", description: "Security is integrated into the development lifecycle", dataSources: ["scanning", "audit"] },
      { id: "A.8.28", name: "Secure Coding", description: "Coding practices include security review", dataSources: ["scanning", "injection"] },
    ],
  },
  {
    framework: "hipaa",
    name: "HIPAA",
    controls: [
      { id: "164.312(a)(1)", name: "Access Control", description: "ePHI access is restricted to authorized persons", dataSources: ["confinement", "policy"] },
      { id: "164.312(b)", name: "Audit Controls", description: "Activity logs are recorded and reviewed", dataSources: ["audit"] },
      { id: "164.312(c)(1)", name: "Integrity Controls", description: "ePHI integrity is protected against unauthorized modification", dataSources: ["audit"] },
      { id: "164.312(e)(1)", name: "Transmission Security", description: "ePHI transmitted over networks is protected", dataSources: ["dlp", "scanning"] },
    ],
  },
  {
    framework: "fedramp",
    name: "FedRAMP",
    controls: [
      { id: "AC-6", name: "Least Privilege", description: "Users and processes operate with least privilege", dataSources: ["confinement", "cascade"] },
      { id: "AU-2", name: "Audit Events", description: "Events are logged with sufficient detail for auditing", dataSources: ["audit"] },
      { id: "SI-3", name: "Malware Protection", description: "Malicious code protection mechanisms are deployed", dataSources: ["scanning"] },
      { id: "SI-10", name: "Information Input Validation", description: "Input is validated before processing", dataSources: ["scanning", "injection"] },
    ],
  },
]
