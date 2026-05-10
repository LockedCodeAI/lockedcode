rule CryptoMiner_Stratum {
  meta:
    author = "LockedCode"
    description = "Detects Stratum mining protocol reference"
    severity = "critical"
    date = "2026-05-09"
  strings:
    $stratum_tcp = "stratum+tcp://"
    $stratum_ssl = "stratum+ssl://"
    $stratum2 = "stratum2+tcp://"
  condition:
    any of them
}

rule CryptoMiner_PoolDomain {
  meta:
    author = "LockedCode"
    description = "Detects known mining pool references"
    severity = "critical"
    date = "2026-05-09"
  strings:
    $pool1 = /miningpool/i
    $pool2 = /pool\.(mine|mining|xmr|eth|btc)/i
    $pool3 = /(nanopool|ethermine|f2pool|poolin|viabtc|slushpool)/i
    $pool4 = /(supportxmr|monerohash|xmrpool)/i
  condition:
    any of them
}

rule CryptoMiner_XMRig {
  meta:
    author = "LockedCode"
    description = "Detects XMRig miner configuration"
    severity = "critical"
    date = "2026-05-09"
  strings:
    $xmrig1 = "donate-level"
    $xmrig2 = "coin"
    $xmrig3 = "cpu-priority"
    $threads = /"threads"\s*:\s*\d/
  condition:
    any of ($xmrig1, $xmrig2) and $threads
}

rule CryptoMiner_WalletAddress {
  meta:
    author = "LockedCode"
    description = "Detects cryptocurrency wallet address patterns"
    severity = "high"
    date = "2026-05-09"
  strings:
    $btc = /[13][a-km-zA-HJ-NP-Z1-9]{25,34}/
    $eth = /0x[a-fA-F0-9]{40}/
    $xmr = /4[0-9AB][1-9A-HJ-NP-Za-km-z]{93}/
  condition:
    #btc >= 1 or #eth >= 1 or #xmr >= 1
}

rule CryptoMiner_CPUNetwork {
  meta:
    author = "LockedCode"
    description = "Detects CPU maximization with network activity"
    severity = "high"
    date = "2026-05-09"
  strings:
    $cpu = /(cpus|num_cpus|cpu_count|numCPU|NumCPU|availableProcessors)/
    $hash = /(sha256|sha3|sha_256|blake2|hashlib|crypto_hash)/
    $loop = /(while.*true|for.*:|setInterval.*10)/
    $net = /(fetch|request|http\.|axios|https.request)/
  condition:
    ($cpu or $hash) and $loop and $net
}
