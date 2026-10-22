\# ProfinetForge Pro — System Architecture & Fieldbus Specifications

\*\*Product Record\*\*: \#162    
\*\*Version\*\*: 1.0.0    
\*\*Protocol Standards\*\*: IEC 61158-5-10, IEC 61158-6-10, IEC 61784-2, PROFIBUS & PROFINET International (PI)    
\*\*Cybersecurity Standards\*\*: IEC 62443-4-2, IEC 62443-3-3, NIST SP 800-82 Rev 3, PI Security Guideline Class 1-3    
\*\*Functional Safety\*\*: IEC 61508 / ISO 13849-1 SIL 3 / PLe (PROFIsafe Black-Channel Standard)  

\---

\#\# 1\. Executive Technical Overview

PROFINET (Process Field Network) is the dominant industrial Ethernet communication standard worldwide, connecting programmable logic controllers (PLCs), distributed I/O racks, servo drives, sensors, and actuators across factory automation and process plants.

Unlike standard office Ethernet or TCP/IP networks that suffer from nondeterministic queueing and latency variations, PROFINET partitions communication into deterministic tiers:  
1\. \*\*PROFINET NRT (Non-Real Time)\*\*: Uses standard UDP/IP and TCP/IP (Ports 34962–34964, 49152+) for commissioning, engineering downloads (Siemens TIA Portal), and web diagnostics.  
2\. \*\*PROFINET RT (Real-Time, Class 1 & 2)\*\*: Bypasses the IP and transport layers completely, streaming raw Ethernet II frames directly over EtherType \`0x8892\` with cycle times of 1 ms to 4 ms and jitter under 100 μs.  
3\. \*\*PROFINET IRT (Isochronous Real-Time, Class 3)\*\*: Implements hardware-synchronized, scheduled time-division multiplexing with IEEE 802.1Q VLAN Priority Code Point 6 (\`0xC000\`), delivering sub-microsecond synchronization (\< 1 μs) for high-speed multi-axis robotics and CNC motion control.

\*\*ProfinetForge Pro\*\* delivers:  
\- Bit-accurate encoding and dissection of PROFINET RT and IRT frames over EtherType \`0x8892\`.  
\- Complete Frame ID communication relationship (CR) classification (\`0x8000–0xBBFF\` Cyclic RT, \`0x0100–0x7FFF\` IRT, \`0xFC01\` High Alarm, \`0xFE01\` Low Alarm, \`0xFEFE/0xFEFF\` DCP).  
\- Full implementation of the Discovery and Basic Configuration Protocol (DCP) for station identification, IP parameterization, and device health scanning.  
\- APDU status validation (Cycle Counter monotonicity, DataStatus Run/Stop and Primary/Backup state machine, and TransferStatus tracking).  
\- Industrial PLC process automation instrumentation modeling analog variables (temperature, pressure, tank level, motor RPM) and safety interlocks (E-Stop, safety gate).  
\- A 10-point IEC 62443 / PROFIsafe cybersecurity auditor.  
\- Central gateway rules generator producing Linux \`nftables\` hardware filter tables, Suricata L7 intrusion signatures, and sandboxed real-time \`systemd\` service units.  
\- Direct generation of Libpcap 2.4 Ethernet captures for native Wireshark dissection.

\---

\#\# 2\. PROFINET Frame Anatomy & Bit Structure

PROFINET RT/IRT frames transmit directly on Layer 2 of the OSI model:

\`\`\`  
\+-----------------------------------------------------------------------------------------------+  
\|                                 PROFINET ETHERNET II FRAME                                    \|  
\+-----------------------------------------------------------------------------------------------+  
\| Ethernet II Header:                                                                           \|  
\|   Destination MAC : 6 Bytes (e.g. 01:0E:CF:00:00:00 Multicast or Unicast Device MAC)          \|  
\|   Source MAC      : 6 Bytes (IO-Controller MAC, e.g. 00:1E:67:A2:B4:01)                       \|  
\|   \[Optional VLAN\] : 4 Bytes (IEEE 802.1Q: EtherType 0x8100, Priority 6, VID 0\)               \|  
\|   EtherType       : 2 Bytes (0x8892 \= PROFINET Real-Time Protocol)                           \|  
\+-----------------------------------------------------------------------------------------------+  
\| PROFINET RT/IRT Payload Segment:                                                              \|  
\|   Frame ID        : 2 Bytes (Big Endian, e.g. 0x8000 for Cyclic RT, 0x0100 for IRT)           \|  
\|   C\_SDU (IO Data) : N Bytes (Input/Output Process Data, e.g. 16 Bytes Analog/Digital IO)      \|  
\|   APDU Status     : 4 Bytes                                                                   \|  
\|     \- Cycle Count : 2 Bytes (Big Endian, Monotonic Modulo 65536 Counter)                      \|  
\|     \- DataStatus  : 1 Byte  (Run/Stop, Primary/Backup, Valid/Invalid, Problem Indicator)      \|  
\|     \- TransferSt  : 1 Byte  (Transmission error flags, 0x00 OK)                               \|  
\+-----------------------------------------------------------------------------------------------+  
\| Frame Check Sequence (FCS) : 4 Bytes (Hardware Ethernet CRC-32)                               \|  
\+-----------------------------------------------------------------------------------------------+  
\`\`\`

\#\#\# 2.1 16-Bit Frame ID Communication Hierarchy  
\- \`0x0020 – 0x007F\`: PTCP (Precision Time Control Protocol \- Sync & Delay).  
\- \`0x0100 – 0x7FFF\`: PROFINET IRT (Isochronous Real-Time Class 3, motion control).  
\- \`0x8000 – 0xBBFF\`: PROFINET RT (Cyclic Real-Time Class 1 & 2, standard I/O).  
\- \`0xBC00 – 0xFBFF\`: PROFINET RT Dynamic (Dynamic Communication Relationships).  
\- \`0xFC01\`: Alarm High Priority (Diagnostic emergencies, trip signals).  
\- \`0xFE01\`: Alarm Low Priority / RTA Protocol (Maintenance notices).  
\- \`0xFEFC – 0xFEFD\`: DCP Hello (Fast startup controller announcements).  
\- \`0xFEFE\`: DCP Get / Set (Device IP and station name configuration).  
\- \`0xFEFF\`: DCP Identify (Multicast network scanning and device discovery).

\---

\#\# 3\. APDU Status & DataStatus Byte Specification

At the end of every cyclic IO frame, a 4-byte APDU (Application Protocol Data Unit) status structure guarantees message freshness and operational integrity:

\`\`\`  
\+-----------------------------------------------------------------------------+  
\|                               APDU STATUS BYTES                             \|  
\+-------------------------------------+-------------------+-------------------+  
\| Cycle Counter \[15:0\] (2 Bytes)      \| DataStatus (1B)   \| TransferStatus(1B)\|  
\+-------------------------------------+-------------------+-------------------+  
\`\`\`

\#\#\# 3.1 DataStatus Bitfield Definitions  
\- \*\*Bit 0 (Primary / Backup)\*\*:  
  \- \`1\`: Primary IO-Controller active.  
  \- \`0\`: Backup Controller (System Redundancy active).  
\- \*\*Bit 1 (Redundancy State)\*\*:  
  \- \`0\`: Primary operating normally.  
  \- \`1\`: Redundancy takeover initiated.  
\- \*\*Bit 2 (Valid / Invalid)\*\*:  
  \- \`1\`: IO data in C\_SDU is valid and fresh.  
  \- \`0\`: IO data is invalid (actuators hold fail-safe state).  
\- \*\*Bit 3 (Run / Stop)\*\*:  
  \- \`1\`: PLC CPU is in RUN mode.  
  \- \`0\`: PLC CPU is in STOP mode (outputs de-energized).  
\- \*\*Bit 4 (Station Problem Indicator)\*\*:  
  \- \`1\`: No station problem (normal).  
  \- \`0\`: Station problem detected (diagnostic pending).  
\- \*\*Bit 5 (Provider State)\*\*:  
  \- \`1\`: Provider state OK.  
  \- \`0\`: Provider state error.

\---

\#\# 4\. Discovery and basic Configuration Protocol (DCP)

PROFINET DCP allows commissioning engineers and PLC controllers to discover devices, assign device station names (e.g. \`simatic-s7-1500\`, \`et200sp-rack1\`), and configure IP addresses across unconfigured subnets:

\`\`\`  
\[Engineering Tool / Master\]   
         \|   
         \| Multicast Identify Request (Frame ID 0xFEFE / 0xFEFF, MAC 01:0E:CF:00:00:00)  
         v  
  \+---------------+---------------+---------------+  
  \|  ET200SP IO   \|  Sinamics S120\|  Festo Valve  \|  
  \+---------------+---------------+---------------+  
         \|  
         \| Unicast Identify Response (Device Name, IP, Subnet, MAC, Vendor ID 0x002A)  
         v  
\[Engineering Tool / Master Confirms Topology & Assigns IP via DCP Set\]  
\`\`\`

\#\#\# 4.1 DCP Block Architecture  
\- \*\*Option 0x01: IP Parameter\*\*:  
  \- Suboption \`0x01\`: MAC Address.  
  \- Suboption \`0x02\`: IP Parameter Block (IP Address, Subnet Mask, Default Gateway).  
\- \*\*Option 0x02: Device Properties\*\*:  
  \- Suboption \`0x01\`: Type of Station (e.g. \`ET200SP\`).  
  \- Suboption \`0x02\`: Name of Station (e.g. \`conveyor-drive-station1\`).  
  \- Suboption \`0x03\`: Device ID / Vendor ID (e.g. Siemens \`0x002A\`).  
\- \*\*Option 0x05: Control\*\*:  
  \- Suboption \`0x01\`: Signal / Flash LED (Locate physical hardware device in rack).  
  \- Suboption \`0x02\`: Reset to Factory Settings.

\---

\#\# 5\. Industrial Process Automation Telemetry & IOPS/IOCS

In PROFINET IO, each IO sub-module is paired with status qualifier bytes:  
\- \*\*IOPS (IO Provider Status)\*\*: Produced by the transmitter of data. Bit 7 set (\`0x80\`) indicates GOOD; bit 7 clear (\`0x00\`) indicates BAD.  
\- \*\*IOCS (IO Consumer Status)\*\*: Returned by the consumer acknowledging receipt of valid data. Bit 7 set (\`0x80\`) indicates GOOD.

\#\#\# 5.1 Cyclic IO Telemetry Mapping (16 Bytes)  
\- \`Bytes \[0:1\]\`: Process Temperature (\$\\text{RAW} \\times 0.1\\,^\\circ\\text{C}\$, 0.0 to 120.0 °C).  
\- \`Bytes \[2:3\]\`: Hydraulic Pressure (\$\\text{RAW} \\times 0.01\\,\\text{Bar}\$, 0.00 to 15.00 Bar).  
\- \`Byte 4\`: Storage Tank Level (\$0\\text{--}100\\%\$).  
\- \`Byte 5\`: Digital Inputs & Interlocks (Bit 0: E-Stop, Bit 1: Safety Gate, Bit 2: Conveyor Run, Bit 3: Auto Mode).  
\- \`Bytes \[6:7\]\`: Pump Motor Speed (\$\\text{RAW} \\times 1\\,\\text{RPM}\$, 0 to 3000 RPM).  
\- \`Byte 8\`: IOPS Status Qualifier (\`0x80\` Good).  
\- \`Byte 9\`: IOCS Status Qualifier (\`0x80\` Good).  
\- \`Bytes \[10:15\]\`: Reserved / Safety Padding.

\---

\#\# 6\. OT Cybersecurity & IEC 62443 Defense-in-Depth

PROFINET fieldbus networks are critical operational technology (OT) assets. ProfinetForge Pro establishes comprehensive defense boundaries:  
1\. \*\*L2 Protocol Isolation\*\*: Ingress hardware filter restricts interface strictly to EtherType \`0x8892\` and VLAN \`0x8100\`.  
2\. \*\*Anti-Spoofing & MAC Pinning\*\*: Primary Controller MAC address is pinned, preventing rogue laptops from sending forged STOP commands or overriding outputs.  
3\. \*\*Netload Class III DoS Shielding\*\*: Rate-limits multicast discovery and broadcast storms at 10,000 pps to protect cyclic IO buffers.  
4\. \*\*Suricata L7 Deep Packet Inspection\*\*: Audits DCP Service IDs and APDU Status bytes in real-time to flag illegal runtime station name changes and cycle counter replay jumps.  
5\. \*\*Real-Time Linux systemd Daemon\*\*: Sandboxed controller unit running under \`SCHED\_FIFO\` priority 99 with \`ProtectSystem=strict\` and \`LimitMEMLOCK=infinity\`.  
