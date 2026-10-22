  
PN

# 

ProfinetForge **Pro**

INDUSTRIAL REAL-TIME FIELDBUS STUDIO \[IEC 61158 / IEC 61784\]

ETHERTYPE 0x8892  
PLC: RUN MODE  
Export PCAP  
Cyclic RT & IRT Studio DCP Station Scanner PLC Process Dashboard Real-Time Bus Monitor IEC 62443 Security Auditor Gateway & IDS Rules

Quick-Load Fieldbus Presets  
Cyclic IO Real-Time (ID 0x8000) Isochronous Real-Time (ID 0x0100 \+ VLAN) DCP Identify Broadcast (ID 0xFEFF) Alarm High Priority (ID 0xFC01) Simulate Controller STOP Fault

PROFINET Frame Generator  
PROFINET RT CYCLIC

Frame ID (16-bit Hex)  
Cycle Counter (0 \- 65535\)

Controller Mode (DataStatus) PLC RUN Mode (Active) PLC STOP Mode (Halted)  
Data Validity Flag Valid IO Data (0x04) Invalid / Discard (0x00)

IEEE 802.1Q VLAN Tag Untagged (Standard RT) Tagged VLAN (Priority 6 IRT)  
Destination MAC Address  
Cyclic IO Payload Bytes (Hex)

Wire Dissection & APDU Status  
STATUS VALID

DataStatus Byte  
0x35

TransferStatus  
0x00 (OK)

Decoded APDU Status Flags

Controller Role: **Primary Controller**  
Operating Mode: **RUN Mode**  
Data Validity: **Valid IO Data**  
Station Diagnostic: **No Station Problem**

Full Ethernet II Frame Representation (Wire Bytes)  
01 0E CF 00 00 00 00 1E 67 A2 B4 01 88 92 80 00 01 C4 02 AD 4E 0E 05 AA 80 80 04 00 35 00

Discovery & basic Configuration Protocol (DCP) Scanner  
Scan PROFINET Fieldbus  
PROFINET DCP uses Ethernet multicast frames (Frame ID 0xFEFE / 0xFEFF) to automatically discover device station names, vendor IDs, and configure IP addresses without requiring pre-assigned IP networking.

| Device Station Name | IP Address | Subnet Mask | MAC Address | Vendor ID / Device ID | Device Role | Action   |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- |

Industrial Process Instrumentation  
IOPS: GOOD (0x80)  
Process Temperature (0.0 to 120.0 °C)  
0.0 °C 45.2 °C 120.0 °C  
Hydraulic Pressure (0.0 to 15.0 Bar)  
0.0 Bar 6.85 Bar 15.0 Bar  
Storage Tank Level (0 to 100%)  
0% 78% 100%  
Pump Motor Speed (0 to 3,000 RPM)  
0 RPM 1,450 RPM 3,000 RPM

Encoded Cyclic IO Sub-Module Payload (16 Bytes)  
01 C4 02 AD 4E 0E 05 AA 80 80 00 00 00 00 00 00

Digital I/O & Safety Interlocks  
PROFIsafe SIL 3

AUTO MODE (RUN)  
SAFETY GATE CLOSED  
CONVEYOR RUNNING  
EMERGENCY STOP (E-STOP)  
Toggle Conveyor Contactor Toggle Safety Interlock Gate Trigger Emergency Stop

Real-Time PROFINET 100BASE-TX Stream Monitor  
Start Stream Stop Stream Clear

Frames Transmitted  
0

Sub-Modules Received  
0

Cycle Counter Jumps  
0

Bus Cycle Time (ms)  
1.0

| Frame \# | Frame ID | Type / CR | Cycle Count | Length | Process Data Preview | DataStatus | Status   |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- |

IEC 62443 / PROFIsafe Fieldbus Cybersecurity Auditor  
Run Compliance Audit

Security Compliance Score  
100/100

Auditor Verdict  
PASSED

Industrial Security Configuration Generator  
Linux nftables Suricata L7 IDS systemd Service