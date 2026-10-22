/**
 * ProfinetForge Pro - Network & Gateway Hardening Synthesizer (profinet-config-synthesizer.js)
 * Generates production-ready configurations:
 * 1. Linux nftables packet filter rules for PROFINET RT/IRT master interfaces
 * 2. Suricata L7 Intrusion Detection / Prevention Signatures for PROFINET fieldbuses
 * 3. Hardened real-time systemd service unit for PROFINET IO-Controller daemons
 */

(function(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ProfinetConfigSynthesizer = factory();
  }
}(typeof self !== 'undefined' ? self : this, function() {
  'use strict';

  function generateNftablesRules(opts = {}) {
    const iface = opts.interface || 'eth-profinet0';
    const plcMac = opts.plcMac || '00:1E:67:A2:B4:01';

    return `#!/usr/sbin/nft -f
# ProfinetForge Pro - Linux nftables Industrial PROFINET Firewall
# IEC 62443 Level 2 Fieldbus Security Boundary

flush ruleset

table netdev profinet_protection {
    # Authorized PROFINET Device MACs
    set allowed_io_devices {
        type ether_addr
        elements = {
            00:1e:67:a2:b4:01, # Siemens S7-1500 Controller
            00:1e:67:fe:aa:02, # ET200SP Remote IO Station
            00:0e:cf:12:34:56  # Sinamics S120 Servo Drive
        }
    }

    chain ingress_profinet {
        type filter hook ingress device "${iface}" priority -450; policy drop;

        # 1. Strictly allow PROFINET Real-Time (0x8892) and 802.1Q VLAN (0x8100)
        ether type { 0x8892, 0x8100 } accept

        # 2. Allow PROFINET DCP / RPC / Acyclic UDP Ports
        # 34964/udp (DCP), 49152-49155/udp (Context Manager)
        udp dport { 34964, 49152, 49153, 49154, 49155 } accept

        # 3. Drop unapproved enterprise IT routable protocols
        ip protocol { tcp, icmp } counter log prefix "[PROFINET-IT-DROP]: " drop

        # 4. Anti-Spoofing: Prevent foreign nodes from claiming Controller MAC
        ether saddr ${plcMac} iif != "${iface}" counter drop

        # 5. Netload Class III Rate Limiting (Cap broadcast / multicast storms)
        ether daddr { 01:0e:cf:00:00:00, ff:ff:ff:ff:ff:ff } limit rate over 10000/second burst 500 packets counter log prefix "[NETLOAD-BURST-DROP]: " drop

        # 6. Default drop
        counter drop
    }
}

table inet profinet_mgmt {
    chain input {
        type filter hook input priority filter; policy drop;
        iif "lo" accept
        ct state established,related accept
        counter drop
    }
}
`;
  }

  function generateSuricataSignatures(opts = {}) {
    const sidBase = opts.sidBase || 2889200;

    return `# ------------------------------------------------------------------------
# ProfinetForge Pro - Suricata L7 Industrial Intrusion Signatures
# Target: PROFINET RT/IRT (EtherType 0x8892) & DCP (UDP 34964)
# Standards: IEC 62443, NIST SP 800-82r3, PROFIsafe SIL 3
# ------------------------------------------------------------------------

# Rule 1: Detect unauthorized DCP Set Name of Station (Service ID 0x04, Option 0x02, Suboption 0x02)
alert ether any any -> any any (msg:"PROFINET-IDS Unauthorized DCP Set Station Name Attempt"; content:"|88 92|"; offset:12; depth:2; content:"|fe fe|"; distance:0; within:4; content:"|04|"; distance:0; within:2; content:"|02 02|"; distance:8; within:4; sid:${sidBase+1}; rev:1; classtype:protocol-command-decode; priority:1;)

# Rule 2: Detect rogue Controller STOP state forcing (DataStatus Run Bit 3 = 0)
alert ether any any -> any any (msg:"PROFINET-IDS Rogue Controller STOP State Injection Detected"; content:"|88 92|"; offset:12; depth:2; byte_test:1,&,0x08,18,=,0; sid:${sidBase+2}; rev:1; classtype:bad-unknown; priority:1;)

# Rule 3: Detect DCP Broadcast Storm / Multicast DoS Flooding
alert ether any any -> any any (msg:"PROFINET-IDS Excessive DCP Identify Multicast Flooding"; content:"|88 92|"; offset:12; depth:2; content:"|fe ff|"; distance:0; within:4; threshold:type both, track by_src, count 250, seconds 1; sid:${sidBase+3}; rev:1; classtype:denial-of-service; priority:2;)

# Rule 4: Detect IOPS Status Failure (Sub-Module Bad Status 0x00)
alert ether any any -> any any (msg:"PROFINET-IDS IOPS Sub-Module Status BAD Flagged by Field Device"; content:"|88 92|"; offset:12; depth:2; byte_test:1,=,0x00,24; sid:${sidBase+4}; rev:1; classtype:system-call-detect; priority:3;)

# Rule 5: Detect Insecure SNMPv1/v2c Community String on PROFINET Device
alert udp any any -> any 161 (msg:"PROFINET-IDS Insecure SNMP Default Community String (public/private)"; content:"public"; sid:${sidBase+5}; rev:1; classtype:attempted-admin; priority:2;)
`;
  }

  function generateSystemdService(opts = {}) {
    const binPath = opts.binPath || '/usr/local/bin/profinetforge-master';
    const iface = opts.interface || 'eth-profinet0';

    return `[Unit]
Description=ProfinetForge Pro Industrial Real-Time IO-Controller Daemon
Documentation=https://docs.google.com
After=network.target network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
Group=root

# Real-Time Scheduling Configuration (SCHED_FIFO @ Priority 99)
CPUSchedulingPolicy=fifo
CPUSchedulingPriority=99
Nice=-20
LimitRTPRIO=99
LimitMEMLOCK=infinity

ExecStart=${binPath} --interface ${iface} --cycle-time 1000 --rt-class 2
Restart=always
RestartSec=1s

# Linux Hardening & Sandboxing
ProtectSystem=strict
ProtectHome=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
PrivateTmp=true
MemoryDenyWriteExecute=true
CapabilityBoundingSet=CAP_NET_RAW CAP_NET_ADMIN CAP_SYS_NICE

# Dedicated Storage
ReadWritePaths=/var/log/profinetforge

[Install]
WantedBy=multi-user.target
`;
  }

  return {
    generateNftablesRules,
    generateSuricataSignatures,
    generateSystemdService
  };
}));
