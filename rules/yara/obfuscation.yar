rule Obfuscation_MultiBase64 {
  meta:
    author = "LockedCode"
    description = "Detects multi-layer base64 encoding"
    severity = "warning"
    date = "2026-05-09"
  strings:
    $b64b64 = /(atob|btoa|base64_decode|base64_encode).*(atob|btoa|base64_decode|base64_encode)/
    $nested = /base64_decode\(.*base64_decode/
    $chain = /(fromCharCode|charCodeAt).*(fromCharCode|charCodeAt)/
  condition:
    any of ($b64b64, $nested, $chain)
}

rule Obfuscation_StringSplitting {
  meta:
    author = "LockedCode"
    description = "Detects string character-by-character building"
    severity = "warning"
    date = "2026-05-09"
  strings:
    $split = /fromCharCode\(/
    $join  = /\.join\(['"]?['"]?\)/
    $split2 = /\.split\(['"]?['"]?\)/
    $concat = /\.concat\(/
  condition:
    (any of ($split, $split2) and any of ($join, $concat)) or
    (#split >= 5 and #join >= 1)
}

rule Obfuscation_UnicodeEscape {
  meta:
    author = "LockedCode"
    description = "Detects unicode escape sequences building strings"
    severity = "warning"
    date = "2026-05-09"
  strings:
    $unesc = /\\u[0-9a-fA-F]{4}/
    $decode = /(decodeURIComponent|unescape)/
  condition:
    (#unesc >= 5 and $decode) or #unesc >= 10
}

rule Obfuscation_SingleCharVars {
  meta:
    author = "LockedCode"
    description = "Detects obfuscated single-character variable usage"
    severity = "info"
    date = "2026-05-09"
  strings:
    $var = /var [a-z] *=/
    $let = /let [a-z] *=/
    $const = /const [a-z] *=/
    $func = /function\([a-z]\)/
  condition:
    (#var >= 5 or #let >= 5 or #const >= 5) or (#func >= 3 and (#var >= 3 or #let >= 3))
}

rule Obfuscation_ROT13 {
  meta:
    author = "LockedCode"
    description = "Detects ROT13 usage in code"
    severity = "warning"
    date = "2026-05-09"
  strings:
    $rot13 = /(rot13|ROT13|ROT-13|caesar.*13)/
    $codec = /(codecs\.decode.*rot13|str\.translate.*rot)/
  condition:
    any of ($rot13, $codec)
}
