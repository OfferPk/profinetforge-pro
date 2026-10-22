/**
 * ProfinetForge Pro - Application Controller (app.js)
 * UI Event Coordination, DCP Station Scanning, Process Instrumentation & PCAP Generation
 */

document.addEventListener('DOMContentLoaded', () => {
  const Engine = window.ProfinetEngine;
  const Auditor = window.ProfinetSecurityAuditor;
  const Synthesizer = window.ProfinetConfigSynthesizer;

  if (!Engine || !Auditor || !Synthesizer) {
    console.error('ProfinetForge modules failed to load properly.');
    return;
  }

  // --- TAB NAVIGATION ---
  const tabBtns = document.querySelectorAll('.nav-tab');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  // --- STUDIO INPUT ELEMENTS ---
  const inputFrameId = document.getElementById('inputFrameId');
  const inputCycleCounter = document.getElementById('inputCycleCounter');
  const selectRunMode = document.getElementById('selectRunMode');
  const selectDataValid = document.getElementById('selectDataValid');
  const checkVlan = document.getElementById('checkVlan');
  const inputDestMac = document.getElementById('inputDestMac');
  const inputPayloadHex = document.getElementById('inputPayloadHex');

  // Outputs
  const badgeFrameClass = document.getElementById('badgeFrameClass');
  const apduStatusBadge = document.getElementById('apduStatusBadge');
  const outDataStatusHex = document.getElementById('outDataStatusHex');
  const outTransferStatusHex = document.getElementById('outTransferStatusHex');
  const outPrimaryRole = document.getElementById('outPrimaryRole');
  const outOperatingMode = document.getElementById('outOperatingMode');
  const outDataValidState = document.getElementById('outDataValidState');
  const outStationProblem = document.getElementById('outStationProblem');
  const outFullFrameHex = document.getElementById('outFullFrameHex');

  // Live Stream State
  let streamRunning = false;
  let streamTimer = null;
  let frameCounter = 0;
  let txCount = 0;
  let rxCount = 0;
  let errCount = 0;

  // --- RECALCULATE PROFINET FRAME ---
  function recalculateStudio() {
    if (!inputFrameId) return {};

    const rawIdStr = inputFrameId.value.replace(/[^0-9A-Fa-f]/g, '');
    const frameId = parseInt(rawIdStr, 16) || 0x8000;
    const cycleCounter = parseInt(inputCycleCounter.value, 10) || 0;
    const runMode = selectRunMode.value === 'RUN';
    const dataValid = selectDataValid.value === 'VALID';
    const useVlan = checkVlan.value === 'YES';

    // Parse MAC
    let dstMacParts = inputDestMac.value.split(':').map(h => parseInt(h, 16) || 0);
    while (dstMacParts.length < 6) dstMacParts.push(0);

    // Parse Payload
    let rawHex = inputPayloadHex.value.replace(/[^0-9A-Fa-f]/g, '');
    if (rawHex.length % 2 !== 0) rawHex += '0';
    const ioData = [];
    for (let i = 0; i < rawHex.length; i += 2) {
      ioData.push(parseInt(rawHex.substr(i, 2), 16));
    }

    const frameClass = Engine.classifyFrameId(frameId);
    if (badgeFrameClass) badgeFrameClass.textContent = frameClass.type.replace(/_/g, ' ');

    // Pack Frame
    const packedFrame = Engine.packCyclicFrame({
      dstMac: dstMacParts,
      useVlan,
      vlanPcp: 6,
      frameId,
      ioData,
      cycleCounter,
      runMode,
      dataValid
    });

    // Dissect for verification
    const dissected = Engine.dissectCyclicFrame(packedFrame);

    if (outDataStatusHex) outDataStatusHex.textContent = dissected.dataStatus.raw;
    if (outTransferStatusHex) outTransferStatusHex.textContent = dissected.transferStatus;

    if (outPrimaryRole) {
      outPrimaryRole.textContent = dissected.dataStatus.isPrimary ? 'Primary Controller' : 'Backup / Redundant';
    }
    if (outOperatingMode) {
      outOperatingMode.textContent = dissected.dataStatus.isRun ? 'RUN Mode' : 'STOP Mode (HALTED)';
      outOperatingMode.style.color = dissected.dataStatus.isRun ? 'var(--accent-emerald)' : 'var(--accent-rose)';
    }
    if (outDataValidState) {
      outDataValidState.textContent = dissected.dataStatus.isValid ? 'Valid IO Data' : 'Invalid Data Discard';
      outDataValidState.style.color = dissected.dataStatus.isValid ? 'var(--accent-emerald)' : 'var(--accent-rose)';
    }
    if (outStationProblem) {
      outStationProblem.textContent = dissected.dataStatus.hasStationProblem ? 'Station Diagnostic Fault' : 'No Station Problem';
      outStationProblem.style.color = dissected.dataStatus.hasStationProblem ? 'var(--accent-rose)' : 'var(--accent-emerald)';
    }

    const isValidAPDU = dissected.dataStatus.isValid && dissected.dataStatus.isRun && !dissected.dataStatus.hasStationProblem;
    if (apduStatusBadge) {
      apduStatusBadge.textContent = isValidAPDU ? 'STATUS VALID' : 'APDU STATUS FAULT';
      apduStatusBadge.className = 'badge ' + (isValidAPDU ? 'badge-success' : 'badge-danger');
    }

    // Wire Bytes Hex
    let frameHexStr = '';
    packedFrame.forEach(b => frameHexStr += b.toString(16).toUpperCase().padStart(2, '0') + ' ');
    if (outFullFrameHex) outFullFrameHex.textContent = frameHexStr.trim();

    return {
      frameId,
      cycleCounter,
      packedFrame,
      dissected
    };
  }

  // Bind change listeners
  [inputFrameId, inputCycleCounter, selectRunMode, selectDataValid, checkVlan, inputDestMac, inputPayloadHex].forEach(el => {
    if (el) el.addEventListener('input', recalculateStudio);
  });

  // Presets
  const presetCyclicRT = document.getElementById('presetCyclicRT');
  const presetMotionIRT = document.getElementById('presetMotionIRT');
  const presetDCPIdentify = document.getElementById('presetDCPIdentify');
  const presetAlarmHigh = document.getElementById('presetAlarmHigh');
  const presetStopFault = document.getElementById('presetStopFault');

  if (presetCyclicRT) {
    presetCyclicRT.addEventListener('click', () => {
      inputFrameId.value = '0x8000';
      inputCycleCounter.value = '1024';
      selectRunMode.value = 'RUN';
      selectDataValid.value = 'VALID';
      checkVlan.value = 'NO';
      inputDestMac.value = '01:0E:CF:00:00:00';
      inputPayloadHex.value = '01 C4 02 AD 4E 0E 05 AA 80 80 00 00 00 00 00 00';
      recalculateStudio();
    });
  }

  if (presetMotionIRT) {
    presetMotionIRT.addEventListener('click', () => {
      inputFrameId.value = '0x0100'; // IRT Class 3
      inputCycleCounter.value = '2048';
      selectRunMode.value = 'RUN';
      selectDataValid.value = 'VALID';
      checkVlan.value = 'YES'; // 802.1Q Priority 6
      inputDestMac.value = '01:0E:CF:00:00:00';
      inputPayloadHex.value = '00 0F 00 08 00 00 61 A8 00 00 07 08 01 C2 80 80';
      recalculateStudio();
    });
  }

  if (presetDCPIdentify) {
    presetDCPIdentify.addEventListener('click', () => {
      inputFrameId.value = '0xFEFF';
      inputCycleCounter.value = '0';
      selectRunMode.value = 'RUN';
      checkVlan.value = 'NO';
      inputDestMac.value = '01:0E:CF:00:00:00';
      inputPayloadHex.value = '05 00 12 34 56 78 00 01 00 04 02 02 00 00';
      recalculateStudio();
    });
  }

  if (presetAlarmHigh) {
    presetAlarmHigh.addEventListener('click', () => {
      inputFrameId.value = '0xFC01';
      inputCycleCounter.value = '55';
      selectRunMode.value = 'RUN';
      checkVlan.value = 'NO';
      inputDestMac.value = '00:1E:67:A2:B4:01';
      inputPayloadHex.value = '01 00 01 02 00 08 00 01 00 02 00 00 80 80';
      recalculateStudio();
    });
  }

  if (presetStopFault) {
    presetStopFault.addEventListener('click', () => {
      inputFrameId.value = '0x8000';
      selectRunMode.value = 'STOP'; // Halted
      selectDataValid.value = 'INVALID';
      recalculateStudio();
    });
  }

  // --- DCP STATION SCANNER ---
  const btnScanDCP = document.getElementById('btnScanDCP');
  const dcpTableBody = document.getElementById('dcpTableBody');

  const SAMPLE_DCP_DEVICES = [
    { name: 'simatic-s7-1500-plc', ip: '192.168.1.10', mask: '255.255.255.0', mac: '00:1E:67:A2:B4:01', id: '0x002A / 0x010E (Siemens)', role: 'IO-Controller' },
    { name: 'et200sp-rack1-im155', ip: '192.168.1.20', mask: '255.255.255.0', mac: '00:1E:67:FE:AA:02', id: '0x002A / 0x0301 (Siemens)', role: 'IO-Device (ET200SP)' },
    { name: 'sinamics-s120-cu320', ip: '192.168.1.30', mask: '255.255.255.0', mac: '00:0E:CF:12:34:56', id: '0x002A / 0x0504 (Siemens)', role: 'Motion Drive (IRT)' },
    { name: 'festo-cpx-terminal', ip: '192.168.1.40', mask: '255.255.255.0', mac: '00:0E:F0:45:67:89', id: '0x014D / 0x0010 (Festo)', role: 'Pneumatic Valve IO' }
  ];

  function renderDCPTable() {
    if (!dcpTableBody) return;
    dcpTableBody.innerHTML = '';

    SAMPLE_DCP_DEVICES.forEach(dev => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${dev.name}</strong></td>
        <td><span style="color: var(--accent-cyan); font-weight: 700;">${dev.ip}</span></td>
        <td>${dev.mask}</td>
        <td>${dev.mac}</td>
        <td>${dev.id}</td>
        <td><span class="badge ${dev.role.includes('Controller') ? 'badge-primary' : 'badge-teal'}">${dev.role}</span></td>
        <td><button class="btn btn-secondary btn-sm" onclick="alert('Signal Flash LED sent to ${dev.name}')">Flash LED</button></td>
      `;
      dcpTableBody.appendChild(tr);
    });
  }

  if (btnScanDCP) {
    btnScanDCP.addEventListener('click', () => {
      btnScanDCP.disabled = true;
      btnScanDCP.textContent = 'Scanning Fieldbus (DCP Broadcast)...';
      setTimeout(() => {
        renderDCPTable();
        btnScanDCP.disabled = false;
        btnScanDCP.textContent = 'Scan PROFINET Fieldbus';
      }, 500);
    });
  }

  // --- INDUSTRIAL PLC PROCESS INSTRUMENTATION ---
  const sliderTemp = document.getElementById('sliderTemp');
  const sliderPressure = document.getElementById('sliderPressure');
  const sliderTank = document.getElementById('sliderTank');
  const sliderRpm = document.getElementById('sliderRpm');

  const valTemp = document.getElementById('valTemp');
  const valPressure = document.getElementById('valPressure');
  const valTank = document.getElementById('valTank');
  const valRpm = document.getElementById('valRpm');
  const outTelemetryHex = document.getElementById('outTelemetryHex');

  const ledAuto = document.getElementById('ledAuto');
  const ledGate = document.getElementById('ledGate');
  const ledConveyor = document.getElementById('ledConveyor');
  const ledEstop = document.getElementById('ledEstop');

  let stateEstop = false;
  let stateGate = true;
  let stateConveyor = true;

  function updateTelemetryDashboard() {
    if (!sliderTemp) return;

    const temp = sliderTemp.value * 0.1;
    const press = sliderPressure.value * 0.01;
    const tank = parseInt(sliderTank.value, 10);
    const rpm = parseInt(sliderRpm.value, 10);

    if (valTemp) valTemp.textContent = `${temp.toFixed(1)} °C`;
    if (valPressure) valPressure.textContent = `${press.toFixed(2)} Bar`;
    if (valTank) valTank.textContent = `${tank}%`;
    if (valRpm) valRpm.textContent = `${rpm.toLocaleString()} RPM`;

    // Encode into IO payload
    const enc = Engine.encodePLCIOTelemetry({
      temperatureDegC: temp,
      pressureBar: press,
      tankLevelPct: tank,
      motorRpm: rpm,
      estopActive: stateEstop,
      safetyGateClosed: stateGate,
      conveyorRun: stateConveyor,
      autoMode: !stateEstop
    });

    if (outTelemetryHex) {
      outTelemetryHex.textContent = enc.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    }
  }

  [sliderTemp, sliderPressure, sliderTank, sliderRpm].forEach(sl => {
    if (sl) sl.addEventListener('input', updateTelemetryDashboard);
  });

  const btnToggleConveyor = document.getElementById('btnToggleConveyor');
  const btnToggleGate = document.getElementById('btnToggleGate');
  const btnTriggerEstop = document.getElementById('btnTriggerEstop');

  if (btnToggleConveyor) {
    btnToggleConveyor.addEventListener('click', () => {
      stateConveyor = !stateConveyor;
      if (ledConveyor) {
        ledConveyor.className = stateConveyor ? 'led on-green' : 'led';
      }
      updateTelemetryDashboard();
    });
  }

  if (btnToggleGate) {
    btnToggleGate.addEventListener('click', () => {
      stateGate = !stateGate;
      if (ledGate) {
        ledGate.className = stateGate ? 'led on-green' : 'led on-red';
      }
      updateTelemetryDashboard();
    });
  }

  if (btnTriggerEstop) {
    btnTriggerEstop.addEventListener('click', () => {
      stateEstop = !stateEstop;
      if (ledEstop) {
        ledEstop.className = stateEstop ? 'led on-red' : 'led';
      }
      if (ledAuto) {
        ledAuto.className = stateEstop ? 'led' : 'led on-green';
      }
      btnTriggerEstop.textContent = stateEstop ? 'Reset Emergency Stop' : 'Trigger Emergency Stop';
      btnTriggerEstop.className = stateEstop ? 'btn btn-secondary btn-sm' : 'btn btn-danger btn-sm';
      updateTelemetryDashboard();
    });
  }

  // --- STREAM MONITOR ---
  const btnStartStream = document.getElementById('btnStartStream');
  const btnStopStream = document.getElementById('btnStopStream');
  const btnClearStream = document.getElementById('btnClearStream');
  const streamTableBody = document.getElementById('streamTableBody');
  const statTx = document.getElementById('statTx');
  const statRx = document.getElementById('statRx');
  const statErr = document.getElementById('statErr');

  function addStreamRow(item) {
    txCount++;
    rxCount++;
    if (item.status === 'ERROR') errCount++;

    if (statTx) statTx.textContent = txCount.toLocaleString();
    if (statRx) statRx.textContent = rxCount.toLocaleString();
    if (statErr) statErr.textContent = errCount.toLocaleString();

    if (!streamTableBody) return;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>#${item.frameNo}</td>
      <td><strong>${item.frameId}</strong></td>
      <td><span class="badge ${item.isIRT ? 'badge-primary' : 'badge-teal'}">${item.type}</span></td>
      <td>${item.cycleCount}</td>
      <td>${item.len}B</td>
      <td style="font-family: var(--font-mono); font-size: 0.8rem;">${item.preview}</td>
      <td>${item.dataStatus}</td>
      <td><span class="badge ${item.status === 'VALID' ? 'badge-success' : 'badge-danger'}">${item.status}</span></td>
    `;

    streamTableBody.insertBefore(row, streamTableBody.firstChild);

    while (streamTableBody.children.length > 40) {
      streamTableBody.removeChild(streamTableBody.lastChild);
    }
  }

  function generateSampleStreamFrame() {
    frameCounter++;
    const isIRT = Math.random() > 0.6;
    const frameId = isIRT ? '0x0100' : '0x8000';
    const type = isIRT ? 'IRT Motion (Class 3)' : 'RT Cyclic IO (Class 1)';
    const cycleCount = (frameCounter * 4) % 65536;

    let preview = '';
    if (isIRT) {
      preview = 'Servo 1 Motion Position Stream (16B)';
    } else {
      preview = 'Process IO: Temp 45.2°C, Press 6.85 Bar';
    }

    const hasFault = Math.random() < 0.03;
    const dataStatus = hasFault ? '0x31 (STOPPED)' : '0x35 (RUN/VALID)';

    addStreamRow({
      frameNo: frameCounter,
      frameId,
      isIRT,
      type,
      cycleCount,
      len: 16,
      preview,
      dataStatus,
      status: hasFault ? 'ERROR' : 'VALID'
    });
  }

  if (btnStartStream) {
    btnStartStream.addEventListener('click', () => {
      if (streamRunning) return;
      streamRunning = true;
      btnStartStream.disabled = true;
      btnStopStream.disabled = false;
      streamTimer = setInterval(generateSampleStreamFrame, 250);
    });
  }

  if (btnStopStream) {
    btnStopStream.addEventListener('click', () => {
      streamRunning = false;
      btnStartStream.disabled = false;
      btnStopStream.disabled = true;
      if (streamTimer) clearInterval(streamTimer);
    });
  }

  if (btnClearStream) {
    btnClearStream.addEventListener('click', () => {
      if (streamTableBody) streamTableBody.innerHTML = '';
      txCount = 0;
      rxCount = 0;
      errCount = 0;
      if (statTx) statTx.textContent = '0';
      if (statRx) statRx.textContent = '0';
      if (statErr) statErr.textContent = '0';
    });
  }

  // --- PCAP DOWNLOAD ---
  const btnExportPcap = document.getElementById('btnExportPcap');
  if (btnExportPcap) {
    btnExportPcap.addEventListener('click', () => {
      const activeData = recalculateStudio();
      const pcapBuffer = Engine.exportToPCAP([activeData.packedFrame]);
      const blob = new Blob([pcapBuffer], { type: 'application/vnd.tcpdump.pcap' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `profinet_frame_${activeData.frameId}_capture.pcap`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  // --- IEC 62443 / PROFIsafe AUDITOR ---
  const btnRunAudit = document.getElementById('btnRunAudit');
  const auditScoreEl = document.getElementById('auditScore');
  const auditVerdictEl = document.getElementById('auditVerdict');
  const auditResultsContainer = document.getElementById('auditResultsContainer');

  function renderAudit() {
    const report = Auditor.runComprehensiveAudit();

    if (auditScoreEl) auditScoreEl.textContent = `${report.score}/100`;
    if (auditVerdictEl) {
      auditVerdictEl.textContent = report.verdict;
      auditVerdictEl.className = 'badge ' + (report.verdict === 'PASSED' ? 'badge-success' : 'badge-danger');
    }

    if (!auditResultsContainer) return;
    auditResultsContainer.innerHTML = '';

    report.rules.forEach(rule => {
      const card = document.createElement('div');
      card.className = `rule-card ${rule.status === 'PASS' ? 'pass' : 'fail'}`;

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <h4 style="margin: 0; font-size: 1rem; color: #f8fafc;">${rule.id}: ${rule.name}</h4>
          <span class="badge ${rule.status === 'PASS' ? 'badge-success' : 'badge-danger'}">${rule.status}</span>
        </div>
        <p style="margin: 0 0 0.5rem 0; font-size: 0.85rem; color: #94a3b8;">${rule.description}</p>
        <div style="font-size: 0.8rem; background: rgba(0,0,0,0.3); padding: 0.5rem; border-radius: 4px; color: #38bdf8;">
          <strong>Security Control:</strong> ${rule.details}
        </div>
        <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.25rem;">Standard: ${rule.standard} | Severity: ${rule.severity}</div>
      `;
      auditResultsContainer.appendChild(card);
    });
  }

  if (btnRunAudit) btnRunAudit.addEventListener('click', renderAudit);

  // --- GATEWAY CONFIG SYNTHESIS ---
  const btnGenNftables = document.getElementById('btnGenNftables');
  const btnGenSuricata = document.getElementById('btnGenSuricata');
  const btnGenSystemd = document.getElementById('btnGenSystemd');
  const configOutputArea = document.getElementById('configOutputArea');

  if (btnGenNftables) {
    btnGenNftables.addEventListener('click', () => {
      if (configOutputArea) configOutputArea.value = Synthesizer.generateNftablesRules();
    });
  }

  if (btnGenSuricata) {
    btnGenSuricata.addEventListener('click', () => {
      if (configOutputArea) configOutputArea.value = Synthesizer.generateSuricataSignatures();
    });
  }

  if (btnGenSystemd) {
    btnGenSystemd.addEventListener('click', () => {
      if (configOutputArea) configOutputArea.value = Synthesizer.generateSystemdService();
    });
  }

  // Initial Load
  recalculateStudio();
  renderDCPTable();
  updateTelemetryDashboard();
  renderAudit();
  if (configOutputArea) configOutputArea.value = Synthesizer.generateNftablesRules();
});
