rule WebShell_PHP_Eval {
  meta:
    author = "LockedCode"
    description = "Detects PHP eval-based web shell"
    severity = "critical"
    date = "2026-05-09"
  strings:
    $eval = /eval\((\$_(GET|POST|REQUEST|COOKIE|SERVER)\[[^\]]+\])/
    $assert = /assert\((\$_(GET|POST|REQUEST|COOKIE)\[[^\]]+\])/
    $system = /system\((\$_(GET|POST|REQUEST)\[[^\]]+\])/
    $exec = /exec\((\$_(GET|POST|REQUEST)\[[^\]]+\])/
    $shell = /shell_exec\((\$_(GET|POST|REQUEST)\[[^\]]+\])/
  condition:
    any of ($eval, $assert, $system, $exec, $shell)
}

rule WebShell_PHP_Passthru {
  meta:
    author = "LockedCode"
    description = "Detects PHP passthru web shell"
    severity = "critical"
    date = "2026-05-09"
  strings:
    $p1 = "passthru"
    $p2 = "popen"
    $p3 = "proc_open"
    $input = /\$_(GET|POST|REQUEST|COOKIE)\[[^\]]+\]/
  condition:
    any of ($p1, $p2, $p3) and $input
}

rule WebShell_JSP {
  meta:
    author = "LockedCode"
    description = "Detects JSP web shell patterns"
    severity = "critical"
    date = "2026-05-09"
  strings:
    $exec = /Runtime\.getRuntime\(\)\.exec/
    $req = /request\.getParameter/
    $proc = /ProcessBuilder/
  condition:
    $exec and ($req or $proc)
}

rule WebShell_ASPX {
  meta:
    author = "LockedCode"
    description = "Detects ASPX web shell patterns"
    severity = "critical"
    date = "2026-05-09"
  strings:
    $proc = /Process\.Start\(/
    $input = /Request\.(Form|QueryString)\[/
    $cmd = /cmd\.(exe|com)/
  condition:
    $proc and ($input or $cmd)
}

rule WebShell_Python_Flask {
  meta:
    author = "LockedCode"
    description = "Detects Python Flask-based command execution endpoint"
    severity = "high"
    date = "2026-05-09"
  strings:
    $route = /@app\.route/
    $exec = /subprocess\.(call|run|Popen|check_output)/
    $input = /request\.(args|form|json|data)/
    $shell = /os\.(system|popen)/
  condition:
    $route and any of ($exec, $shell) and $input
}
