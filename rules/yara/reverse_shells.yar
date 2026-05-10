rule ReverseShell_Bash_DevTcp {
  meta:
    author = "LockedCode"
    description = "Detects bash reverse shell using /dev/tcp"
    severity = "critical"
    date = "2026-05-09"
  strings:
    $tcp = /bash -i >[^ ]* \/dev\/tcp\//
    $exec = /exec \d+<>\/dev\/tcp\//
    $connect = /\/dev\/tcp\/[0-9]/
  condition:
    any of ($tcp, $exec, $connect)
}

rule ReverseShell_Python {
  meta:
    author = "LockedCode"
    description = "Detects python reverse shell pattern"
    severity = "critical"
    date = "2026-05-09"
  strings:
    $socket = /socket\.socket\(.*AF_INET.*SOCK_STREAM\)/
    $connect = /\.connect\(\(/
    $popen = /subprocess\.(Popen|call|run)/
    $pseudo = /os\.(system|popen)/
  condition:
    any of ($socket, $connect) and any of ($popen, $pseudo)
}

rule ReverseShell_NodeJS {
  meta:
    author = "LockedCode"
    description = "Detects Node.js reverse shell using net module"
    severity = "critical"
    date = "2026-05-09"
  strings:
    $net = /require\(['"]net['"]\)/
    $connect = /\.connect\([^)]+\)/
    $spawn = /child_process\.(exec|spawn|execSync)/
    $pty = /child_process\.spawn\('[a-z]/
  condition:
    any of ($net, $connect) and any of ($spawn, $pty)
}

rule ReverseShell_PHP {
  meta:
    author = "LockedCode"
    description = "Detects PHP reverse shell patterns"
    severity = "critical"
    date = "2026-05-09"
  strings:
    $fsock = "fsockopen"
    $popen = "proc_open"
    $exec = "shell_exec"
    $sock = "socket_create"
  condition:
    ($fsock or $sock) and ($popen or $exec)
}

rule ReverseShell_Perl {
  meta:
    author = "LockedCode"
    description = "Detects Perl reverse shell"
    severity = "critical"
    date = "2026-05-09"
  strings:
    $socket = /use Socket/
    $connect = /connect\(/
    $exec = /exec\(['"]\/bin\/sh['"]/
  condition:
    all of them
}
