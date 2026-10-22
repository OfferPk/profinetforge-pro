\# ProfinetForge Pro — User Guide & Operations Manual

\*\*Product Record\*\*: \#162    
\*\*Version\*\*: 1.0.0    
\*\*Supported Platforms\*\*: Linux (Ubuntu 22.04/24.04 LTS, Debian 12, PREEMPT\_RT), macOS, Windows (WSL2/Browser)

\---

\#\# 1\. Quick Start

\#\#\# 1.1 Web Studio (Zero Installation)  
Open \`source-code/index.html\` in any modern web browser. No server, compilation, or external package installation is required. All PROFINET frame encoding, DCP discovery dissection, PLC instrumentation, and PCAP generation execute 100% locally in client-side JavaScript.

\`\`\`bash  
\# Launch directly in browser  
xdg-open source-code/index.html  
\# or with Python local server  
python3 \-m http.server 8080 \--directory source-code/  
\`\`\`

\#\#\# 1.2 Standalone Python 3 CLI  
The standalone Python CLI requires no external pip packages:

\`\`\`bash  
chmod \+x build/profinetforge-cli.py  
python3 build/profinetforge-cli.py \--help  
\`\`\`

\---

\#\# 2\. Interactive Web Studio Walkthrough

\#\#\# Tab 1: Cyclic RT & IRT Studio  
\- \*\*Frame ID Configurator\*\*: Enter standard Frame IDs (e.g. \`0x8000\` for Cyclic RT IO, \`0x0100\` for IRT, \`0xFC01\` for High Alarm, \`0xFEFE/0xFEFF\` for DCP).  
\- \*\*APDU Status Modulator\*\*:  
  \- Toggle \*\*PLC RUN Mode\*\* vs \*\*STOP Mode\*\*.  
  \- Toggle \*\*Valid IO Data\*\* vs \*\*Invalid Data\*\*.  
  \- Observe immediate changes in the DataStatus hex output byte (\`0x35\` for RUN/Valid vs \`0x31\` for STOP).  
\- \*\*IEEE 802.1Q Tagging\*\*: Select Tagged VLAN to apply Priority Code Point 6 (PCP 6\) for Isochronous Real-Time (IRT Class 3).  
\- \*\*Wire Dissection\*\*: View full Ethernet II frame hex bytes (Destination/Source MAC \+ EtherType \`0x8892\` \+ Frame ID \+ IO Data \+ APDU Status).  
\- \*\*Preset Quickloaders\*\*:  
  \- \`Cyclic IO Real-Time (ID 0x8000)\`: Standard Class 1/2 IO exchange.  
  \- \`Isochronous Real-Time (ID 0x0100)\`: Motion control with VLAN PCP 6\.  
  \- \`DCP Identify Broadcast (ID 0xFEFF)\`: Multicast discovery packet.  
  \- \`Alarm High Priority (ID 0xFC01)\`: Diagnostic trip frame.  
  \- \`Simulate Controller STOP Fault\`: Demonstrates actuator fail-safe behavior.  
\- \*\*PCAP Downloader\*\*: Click \*\*Export PCAP\*\* to save a binary capture file ready for Wireshark inspection.

\#\#\# Tab 2: DCP Station Scanner  
\- Click \*\*Scan PROFINET Fieldbus\*\* to initiate simulated multicast DCP Identify requests.  
\- Inspect the discovery table displaying device station names (\`simatic-s7-1500-plc\`, \`et200sp-rack1-im155\`, \`sinamics-s120-cu320\`), IP addresses, subnet masks, MAC addresses, and vendor IDs (\`0x002A\` Siemens, \`0x014D\` Festo).  
\- Click \*\*Flash LED\*\* to test physical device locator signals.

\#\#\# Tab 3: PLC Process Dashboard  
\- \*\*Process Sliders\*\*: Modulate temperature (0.0 to 120.0 °C), hydraulic pressure (0.0 to 15.0 Bar), storage tank level (0 to 100%), and pump motor speed (0 to 3,000 RPM).  
\- \*\*Digital Interlocks & LEDs\*\*: Toggle Conveyor Contactor, Safety Gate, and Emergency Stop (E-Stop). Observe active green/red LED states.  
\- \*\*IOPS / IOCS Status\*\*: Displays valid \`0x80\` (GOOD) provider/consumer status bytes.

\#\#\# Tab 4: Real-Time Bus Monitor  
\- Click \*\*Start Stream\*\* to initiate cyclic 100BASE-TX frame streaming (4 Hz simulation).  
\- Monitor Total Frames, Sub-Modules, Cycle Counter Jumps, and Bus Cycle Time.  
\- Interactive table showing live Frame IDs, CR types, cycle counters, data status, and packet previews.

\#\#\# Tab 5: IEC 62443 Security Auditor  
\- Click \*\*Run Compliance Audit\*\* to trigger the 10-point industrial cybersecurity evaluation.  
\- Displays overall score (100/100, PASSED) with individual cards covering:  
  \- Cycle counter replay detection  
  \- DCP station name write locking  
  \- Controller Run/Stop authenticity  
  \- PROFIsafe F-CRC verification  
  \- IRT VLAN Priority 6 QoS  
  \- Netload Class III DoS shielding  
  \- SNMP MIB community string hardening

\#\#\# Tab 6: Gateway & IDS Rules  
\- \*\*Linux nftables\*\*: Hardware-level packet filter rules restricting master interfaces to EtherType \`0x8892\` and DCP ports.  
\- \*\*Suricata L7 IDS\*\*: Signatures detecting rogue DCP station name overwrites, STOP status forcing, and multicast flooding.  
\- \*\*systemd Unit\*\*: Real-time hardened service unit (\`SCHED\_FIFO\` priority 99).

\---

\#\# 3\. CLI Command Reference

\#\#\# 3.1 Pack Cyclic Real-Time Frame  
\`\`\`bash  
python3 build/profinetforge-cli.py pack-rt \--frame-id 0x8000 \--cycle 1024 \--data-hex "01C402AD4E0E05AA8080000000000000"  
\# Output:  
\# Packed PROFINET Frame (38 bytes): 010ECF000000001E67A2B4018892800001C402AD4E0E05AA808000000000000004003500  
\`\`\`

\#\#\# 3.2 Pack Isochronous Real-Time (IRT) Frame with VLAN PCP 6  
\`\`\`bash  
python3 build/profinetforge-cli.py pack-rt \--frame-id 0x0100 \--cycle 2048 \--vlan \--data-hex "000F0008000061A88080"  
\`\`\`

\#\#\# 3.3 Dissect Full Ethernet Frame  
\`\`\`bash  
python3 build/profinetforge-cli.py dissect-frame \--frame-hex "010ECF000000001E67A2B4018892800001C402AD4E0E05AA808000000000000004003500"  
\# Output:  
\# \=== PROFINET Ethernet II Frame Dissection \===  
\# Source MAC      : 00:1E:67:A2:B4:01  
\# Destination MAC : 01:0E:CF:00:00:00  
\# EtherType       : 0x8892 (PROFINET)  
\# Frame ID        : 0x8000 (PROFINET\_RT\_CYCLIC \- PROFINET RT (Cyclic Real-Time IO Data, Class 1/2))  
\# VLAN Tagged     : False  
\# Cycle Counter   : 1024  
\# DataStatus      : 0x35 (RUN: True, Valid: True)  
\# IO Payload Hex  : 01C402AD4E0E05AA8080000000000000  
\`\`\`

\#\#\# 3.4 Pack DCP Identify Frame  
\`\`\`bash  
\# DCP Request  
python3 build/profinetforge-cli.py pack-dcp \--name "et200sp-rack1"

\# DCP Response  
python3 build/profinetforge-cli.py pack-dcp \--name "simatic-s7-1500" \--response \--ip "192.168.1.10"  
\`\`\`

\#\#\# 3.5 Encode / Decode PLC Process Telemetry  
\`\`\`bash  
\# Encode Telemetry  
python3 build/profinetforge-cli.py telemetry \--encode \--temp 45.2 \--pressure 6.85 \--tank 78 \--rpm 1450  
\# Output:  
\# Encoded PLC IO Payload (16 bytes): 01C402AD4E0805AA8080000000000000

\# Decode Telemetry  
python3 build/profinetforge-cli.py telemetry \--decode-hex 01C402AD4E0805AA8080000000000000  
\# Output:  
\# {  
\#   "temperature\_c": 45.2,  
\#   "pressure\_bar": 6.85,  
\#   "tank\_level\_pct": 78,  
\#   "motor\_rpm": 1450,  
\#   "estop\_active": false,  
\#   "safety\_gate\_closed": false,  
\#   "conveyor\_running": false,  
\#   "auto\_mode": true,  
\#   "iops": "GOOD",  
\#   "iocs": "GOOD"  
\# }  
\`\`\`

\#\#\# 3.6 Run IEC 62443 Security Audit  
\`\`\`bash  
python3 build/profinetforge-cli.py audit \--json  
\`\`\`

\#\#\# 3.7 Export Traffic Capture (.pcap)  
\`\`\`bash  
python3 build/profinetforge-cli.py pcap \--count 20 \--output profinet\_trace.pcap  
\# Output:  
\# Exported 20 PROFINET frames to profinet\_trace.pcap (1028 bytes).  
\`\`\`

\#\#\# 3.8 Run Complete Verification Demo  
\`\`\`bash  
python3 build/profinetforge-cli.py demo  
\`\`\`  
