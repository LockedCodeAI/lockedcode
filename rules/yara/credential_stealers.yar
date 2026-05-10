rule CredentialStealer_SSHKey {
  meta:
    author = "LockedCode"
    description = "Detects SSH private key reading with network activity"
    severity = "critical"
    date = "2026-05-09"
  strings:
    $ssh = /~\/\.ssh\/(id_rsa|id_ed25519|id_ecdsa|id_dsa|identity)/
    $read = /(readFile|readFileSync|open|fopen)/
    $net = /(fetch|request|http\.|axios|curl)/
  condition:
    $ssh and $read and $net
}

rule CredentialStealer_AWS {
  meta:
    author = "LockedCode"
    description = "Detects AWS credential exfiltration"
    severity = "critical"
    date = "2026-05-09"
  strings:
    $cred = /~\/\.aws\/(credentials|config)/
    $read = /(readFile|readFileSync|open|fopen)/
    $net = /(fetch|request|http\.|axios|curl)/
  condition:
    $cred and $read and $net
}

rule CredentialStealer_Browser {
  meta:
    author = "LockedCode"
    description = "Detects browser credential database access"
    severity = "critical"
    date = "2026-05-09"
  strings:
    $chrome = /Login Data/i
    $firefox = /logins\.json/i
    $cookie = /Cookies/
    $db = /\.sqlite/
  condition:
    any of ($chrome, $firefox) or ($cookie and $db)
}

rule CredentialStealer_Keylogger {
  meta:
    author = "LockedCode"
    description = "Detects keylogger patterns"
    severity = "critical"
    date = "2026-05-09"
  strings:
    $hook = /(SetWindowsHookEx|keyboard_hook|keylogger)/
    $capture = /(onkey|keypress|keydown|input.*capture|read.*keystroke)/
    $write = /(writeFile|writeFileSync|fprintf|fputs|log\.(info|debug|warn))/
  condition:
    any of ($hook, $capture) and $write
}

rule CredentialStealer_Clipboard {
  meta:
    author = "LockedCode"
    description = "Detects clipboard monitoring"
    severity = "high"
    date = "2026-05-09"
  strings:
    $clip = /(clipboard|Clipboard|GetClipboard|readText|paste)/
    $loop = /(setInterval|while.*true|for.*:)/
    $send = /(fetch|request|axios|http\.|curl)/
  condition:
    $clip and $loop and $send
}
