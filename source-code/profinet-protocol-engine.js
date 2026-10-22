/**
 * ProfinetForge Pro - Protocol Engine (profinet-protocol-engine.js)
 * Industrial Real-Time Process Fieldbus Studio (IEC 61158 / IEC 61784)
 * PROFINET IO / IRT Frame Codec, DCP Discovery Engine, IOPS/IOCS State Machine & Libpcap 2.4 Exporter
 */

(function(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ProfinetEngine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function() {
  'use strict';

  // --- PROFINET CONSTANTS & ENUMS ---
  const ETHERTYPE_PROFINET = 0x8892;
  const ETHERTYPE_VLAN = 0x8100;

  const FRAME_ID_TYPES = {
    PTCP_TIME_SYNC:      { min: 0x0020, max: 0x007F, desc: 'PTCP (Precision Time Protocol - Sync)' },
    PROFINET_IRT:        { min: 0x0100, max: 0x7FFF, desc: 'PROFINET IRT (Isochronous Real-Time, Class 3)' },
    PROFINET_RT_CYCLIC:  { min: 0x8000, max: 0xBBFF, desc: 'PROFINET RT (Cyclic Real-Time IO Data, Class 1/2)' },
    PROFINET_RT_DYNAMIC: { min: 0xBC00, max: 0xFBFF, desc: 'PROFINET RT (Dynamic Real-Time IO)' },
    ALARM_HIGH:          { min: 0xFC01, max: 0xFC01, desc: 'Alarm High Priority (Acyclic Real-Time)' },
    ALARM_LOW_RTA:       { min: 0xFE01, max: 0xFE01, desc: 'Alarm Low Priority / RTA Protocol' },
    DCP_HELLO:           { min: 0xFEFC, max: 0xFEFD, desc: 'DCP Hello / Fast Startup Notification' },
    DCP_GET_SET:         { min: 0xFEFE, max: 0xFEFE, desc: 'DCP Get/Set Device Configuration' },
    DCP_IDENTIFY:        { min: 0xFEFF, max: 0xFEFF, desc: 'DCP Identify Multi-Device Discovery' }
  };

  const DCP_SERVICES = {
    0x03: 'GET',
    0x04: 'SET',
    0x05: 'IDENTIFY',
    0x06: 'HELLO'
  };

  const DCP_OPTIONS = {
    0x01: { name: 'IP', suboptions: { 0x01: 'MAC Address', 0x02: 'IP Parameter (IP, Subnet, Gateway)' } },
    0x02: { name: 'Device Properties', suboptions: { 0x01: 'Type of Station', 0x02: 'Name of Station', 0x03: 'Device ID', 0x04: 'Device Role' } },
    0x05: { name: 'Control', suboptions: { 0x01: 'Flash LED (Signal)', 0x02: 'Reset to Factory', 0x03: 'Reset Communication' } }
  };

  function classifyFrameId(frameId) {
    for (const [key, val] of Object.entries(FRAME_ID_TYPES)) {
      if (frameId >= val.min && frameId <= val.max) {
        return { type: key, description: val.desc };
      }
    }
    return { type: 'RESERVED', description: 'Reserved Frame ID' };
  }

  // --- CYCLIC PROFINET RT/IRT FRAME PACKER ---

  function packCyclicFrame(opts = {}) {
    const dstMac = opts.dstMac || [0x01, 0x0E, 0xCF, 0x00, 0x00, 0x00];
    const srcMac = opts.srcMac || [0x00, 0x1E, 0x67, 0xA2, 0xB4, 0x01];
    const useVlan = Boolean(opts.useVlan);
    const vlanPcp = opts.vlanPcp !== undefined ? opts.vlanPcp : 6;
    const vlanId = opts.vlanId || 0;

    const frameId = opts.frameId !== undefined ? opts.frameId : 0x8000;
    const ioData = opts.ioData || [0x00, 0x00, 0x00, 0x00];
    const cycleCounter = opts.cycleCounter !== undefined ? opts.cycleCounter : 1;

    const runMode = opts.runMode !== false;
    const dataValid = opts.dataValid !== false;
    let dataStatus = 0x01; // Primary
    if (dataValid) dataStatus |= 0x04;
    if (runMode) dataStatus |= 0x08;
    dataStatus |= 0x10; // NoStationProblem
    dataStatus |= 0x20; // ProviderState OK

    const transferStatus = opts.transferStatus || 0x00;

    const ethHdrLen = useVlan ? 18 : 14;
    const pnPayloadLen = 2 + ioData.length + 4;
    const totalFrameLen = ethHdrLen + pnPayloadLen;

    const buf = new Uint8Array(totalFrameLen);
    let offset = 0;

    // Ethernet Header
    for (let i = 0; i < 6; i++) buf[offset++] = dstMac[i];
    for (let i = 0; i < 6; i++) buf[offset++] = srcMac[i];

    if (useVlan) {
      buf[offset++] = (ETHERTYPE_VLAN >> 8) & 0xFF;
      buf[offset++] = ETHERTYPE_VLAN & 0xFF;
      const vlanTag = ((vlanPcp & 0x07) << 13) | (vlanId & 0x0FFF);
      buf[offset++] = (vlanTag >> 8) & 0xFF;
      buf[offset++] = vlanTag & 0xFF;
    }

    buf[offset++] = (ETHERTYPE_PROFINET >> 8) & 0xFF;
    buf[offset++] = ETHERTYPE_PROFINET & 0xFF;

    // PROFINET Frame ID (Big Endian)
    buf[offset++] = (frameId >> 8) & 0xFF;
    buf[offset++] = frameId & 0xFF;

    // IO Data
    for (let i = 0; i < ioData.length; i++) {
      buf[offset++] = ioData[i] & 0xFF;
    }

    // APDU Status:
    // Cycle Counter (Big Endian)
    buf[offset++] = (cycleCounter >> 8) & 0xFF;
    buf[offset++] = cycleCounter & 0xFF;
    // DataStatus
    buf[offset++] = dataStatus & 0xFF;
    // TransferStatus
    buf[offset++] = transferStatus & 0xFF;

    return buf;
  }

  function dissectCyclicFrame(rawBytes) {
    if (rawBytes.length < 20) {
      throw new Error("Frame too short for PROFINET RT.");
    }

    const dstMac = Array.from(rawBytes.slice(0, 6)).map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(':');
    const srcMac = Array.from(rawBytes.slice(6, 12)).map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(':');

    let offset = 12;
    let hasVlan = false;
    let vlanPcp = 0;
    let vlanId = 0;

    let ethType = (rawBytes[offset] << 8) | rawBytes[offset + 1];
    if (ethType === ETHERTYPE_VLAN) {
      hasVlan = true;
      const tag = (rawBytes[offset + 2] << 8) | rawBytes[offset + 3];
      vlanPcp = (tag >> 13) & 0x07;
      vlanId = tag & 0x0FFF;
      offset += 4;
      ethType = (rawBytes[offset] << 8) | rawBytes[offset + 1];
    }

    if (ethType !== ETHERTYPE_PROFINET) {
      throw new Error(`Invalid EtherType 0x${ethType.toString(16).toUpperCase()} (Expected 0x8892 PROFINET).`);
    }
    offset += 2;

    const frameId = (rawBytes[offset] << 8) | rawBytes[offset + 1];
    offset += 2;

    const frameClass = classifyFrameId(frameId);

    if (frameId >= 0xFEFC && frameId <= 0xFEFF) {
      return dissectDCPPayload(rawBytes, offset, { dstMac, srcMac, hasVlan, vlanPcp, vlanId, frameId, frameClass });
    }

    const remaining = rawBytes.length - offset;
    const apduLen = 4;
    const ioDataLen = Math.max(0, remaining - apduLen);

    const ioData = [];
    for (let i = 0; i < ioDataLen; i++) {
      ioData.push(rawBytes[offset + i]);
    }

    const apduOffset = offset + ioDataLen;
    const cycleCounter = (rawBytes[apduOffset] << 8) | rawBytes[apduOffset + 1];
    const dataStatus = rawBytes[apduOffset + 2];
    const transferStatus = rawBytes[apduOffset + 3];

    const isPrimary = Boolean(dataStatus & 0x01);
    const isRedundant = Boolean(dataStatus & 0x02);
    const isValid = Boolean(dataStatus & 0x04);
    const isRun = Boolean(dataStatus & 0x08);
    const hasStationProblem = !Boolean(dataStatus & 0x10);
    const isProviderStateOk = Boolean(dataStatus & 0x20);

    return {
      dstMac,
      srcMac,
      hasVlan,
      vlanPcp,
      vlanId,
      ethType: '0x' + ethType.toString(16).toUpperCase().padStart(4, '0'),
      frameId: '0x' + frameId.toString(16).toUpperCase().padStart(4, '0'),
      frameIdNum: frameId,
      frameClass: frameClass.type,
      frameDescription: frameClass.desc,
      ioData,
      ioDataHex: ioData.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' '),
      cycleCounter,
      dataStatus: {
        raw: '0x' + dataStatus.toString(16).toUpperCase().padStart(2, '0'),
        isPrimary,
        isRedundant,
        isValid,
        isRun,
        hasStationProblem,
        isProviderStateOk
      },
      transferStatus: '0x' + transferStatus.toString(16).toUpperCase().padStart(2, '0')
    };
  }

  function packDCPFrame(opts = {}) {
    const isResponse = Boolean(opts.isResponse);
    const frameId = opts.frameId || (isResponse ? 0xFEFF : 0xFEFE);
    const serviceId = opts.serviceId || 0x05;
    const serviceType = isResponse ? 0x01 : 0x00;
    const xid = opts.xid !== undefined ? opts.xid : 0x12345678;
    const responseDelay = opts.responseDelay || 0x0001;

    const stationName = opts.stationName || 'simatic-s7-1500';
    const ipAddr = opts.ipAddr || [192, 168, 1, 10];
    const subnetMask = opts.subnetMask || [255, 255, 255, 0];
    const gateway = opts.gateway || [192, 168, 1, 1];

    const blocks = [];

    const nameBytes = [];
    for (let i = 0; i < stationName.length; i++) {
      nameBytes.push(stationName.charCodeAt(i));
    }
    const nameBlockLen = 2 + nameBytes.length;
    const nameBlock = [
      0x02, 0x02,
      (nameBlockLen >> 8) & 0xFF, nameBlockLen & 0xFF,
      0x00, 0x00
    ].concat(nameBytes);
    if (nameBlock.length % 2 !== 0) nameBlock.push(0x00);
    blocks.push(nameBlock);

    if (isResponse) {
      const ipBlockLen = 2 + 4 + 4 + 4;
      const ipBlock = [
        0x01, 0x02,
        (ipBlockLen >> 8) & 0xFF, ipBlockLen & 0xFF,
        0x00, 0x01
      ].concat(ipAddr).concat(subnetMask).concat(gateway);
      blocks.push(ipBlock);
    }

    let dcpDataBytes = [];
    blocks.forEach(b => dcpDataBytes = dcpDataBytes.concat(b));
    const dcpDataLen = dcpDataBytes.length;

    const dstMac = isResponse 
      ? (opts.dstMac || [0x00, 0x1B, 0x21, 0x88, 0x92, 0x01]) 
      : [0x01, 0x0E, 0xCF, 0x00, 0x00, 0x00];
    const srcMac = opts.srcMac || [0x00, 0x1E, 0x67, 0xFE, 0xAA, 0x02];

    const totalLen = 14 + 2 + 1 + 1 + 4 + 2 + 2 + dcpDataLen;
    const buf = new Uint8Array(totalLen);
    let offset = 0;

    for (let i = 0; i < 6; i++) buf[offset++] = dstMac[i];
    for (let i = 0; i < 6; i++) buf[offset++] = srcMac[i];
    buf[offset++] = (ETHERTYPE_PROFINET >> 8) & 0xFF;
    buf[offset++] = ETHERTYPE_PROFINET & 0xFF;

    buf[offset++] = (frameId >> 8) & 0xFF;
    buf[offset++] = frameId & 0xFF;

    buf[offset++] = serviceId & 0xFF;
    buf[offset++] = serviceType & 0xFF;

    buf[offset++] = (xid >> 24) & 0xFF;
    buf[offset++] = (xid >> 16) & 0xFF;
    buf[offset++] = (xid >> 8) & 0xFF;
    buf[offset++] = xid & 0xFF;

    buf[offset++] = (responseDelay >> 8) & 0xFF;
    buf[offset++] = responseDelay & 0xFF;

    buf[offset++] = (dcpDataLen >> 8) & 0xFF;
    buf[offset++] = dcpDataLen & 0xFF;

    for (let i = 0; i < dcpDataLen; i++) {
      buf[offset++] = dcpDataBytes[i] & 0xFF;
    }

    return buf;
  }

  function dissectDCPPayload(rawBytes, offset, meta) {
    const serviceId = rawBytes[offset];
    const serviceType = rawBytes[offset + 1];
    const xid = (rawBytes[offset + 2] << 24) | (rawBytes[offset + 3] << 16) | (rawBytes[offset + 4] << 8) | rawBytes[offset + 5];
    const responseDelay = (rawBytes[offset + 6] << 8) | rawBytes[offset + 7];
    const dcpDataLen = (rawBytes[offset + 8] << 8) | rawBytes[offset + 9];

    let blockOffset = offset + 10;
    const maxOffset = blockOffset + dcpDataLen;
    const blocks = [];

    while (blockOffset + 4 <= maxOffset && blockOffset + 4 <= rawBytes.length) {
      const opt = rawBytes[blockOffset];
      const subopt = rawBytes[blockOffset + 1];
      const blockLen = (rawBytes[blockOffset + 2] << 8) | rawBytes[blockOffset + 3];
      blockOffset += 4;

      const optMeta = DCP_OPTIONS[opt] || { name: `Option 0x${opt.toString(16)}`, suboptions: {} };
      const suboptName = optMeta.suboptions[subopt] || `Subopt 0x${subopt.toString(16)}`;

      let decodedValue = '';
      if (opt === 0x02 && subopt === 0x02) {
        const strBytes = rawBytes.slice(blockOffset + 2, blockOffset + blockLen);
        decodedValue = String.fromCharCode.apply(null, Array.from(strBytes));
      } else if (opt === 0x01 && subopt === 0x02) {
        const ip = Array.from(rawBytes.slice(blockOffset + 2, blockOffset + 6)).join('.');
        const subnet = Array.from(rawBytes.slice(blockOffset + 6, blockOffset + 10)).join('.');
        const gw = Array.from(rawBytes.slice(blockOffset + 10, blockOffset + 14)).join('.');
        decodedValue = `IP: ${ip}, Mask: ${subnet}, Gateway: ${gw}`;
      }

      blocks.push({
        option: opt,
        optionName: optMeta.name,
        suboption: subopt,
        suboptionName: suboptName,
        blockLen,
        decodedValue
      });

      blockOffset += blockLen;
      if (blockLen % 2 !== 0) blockOffset++;
    }

    return Object.assign({}, meta, {
      isDCP: true,
      serviceId,
      serviceName: DCP_SERVICES[serviceId] || `Service 0x${serviceId.toString(16)}`,
      serviceType: serviceType === 0 ? 'REQUEST' : 'RESPONSE_SUCCESS',
      xid: '0x' + (xid >>> 0).toString(16).toUpperCase().padStart(8, '0'),
      responseDelay,
      dcpDataLen,
      blocks
    });
  }

  function encodePLCIOTelemetry(signals = {}) {
    const tempDegC = signals.temperatureDegC !== undefined ? signals.temperatureDegC : 45.2;
    const pressureBar = signals.pressureBar !== undefined ? signals.pressureBar : 6.85;
    const tankLevelPct = signals.tankLevelPct !== undefined ? signals.tankLevelPct : 78;
    const motorRpm = signals.motorRpm !== undefined ? signals.motorRpm : 1450;

    const estopActive = Boolean(signals.estopActive);
    const safetyGateClosed = signals.safetyGateClosed !== false;
    const conveyorRun = Boolean(signals.conveyorRun);
    const autoMode = signals.autoMode !== false;

    const rawTemp = Math.max(0, Math.min(65535, Math.round(tempDegC * 10)));
    const rawPressure = Math.max(0, Math.min(65535, Math.round(pressureBar * 100)));
    const rawRpm = Math.max(0, Math.min(65535, Math.round(motorRpm)));

    let digitalIn = 0;
    if (estopActive) digitalIn |= 0x01;
    if (safetyGateClosed) digitalIn |= 0x02;
    if (conveyorRun) digitalIn |= 0x04;
    if (autoMode) digitalIn |= 0x08;

    const b = new Array(16).fill(0);
    b[0] = (rawTemp >> 8) & 0xFF;
    b[1] = rawTemp & 0xFF;
    b[2] = (rawPressure >> 8) & 0xFF;
    b[3] = rawPressure & 0xFF;
    b[4] = Math.max(0, Math.min(100, Math.round(tankLevelPct)));
    b[5] = digitalIn;
    b[6] = (rawRpm >> 8) & 0xFF;
    b[7] = rawRpm & 0xFF;
    b[8] = 0x80;
    b[9] = 0x80;

    return b;
  }

  function decodePLCIOTelemetry(b) {
    if (b.length < 10) {
      throw new Error("Telemetry payload requires at least 10 bytes.");
    }
    const rawTemp = (b[0] << 8) | b[1];
    const rawPressure = (b[2] << 8) | b[3];
    const tankLevelPct = b[4];
    const digitalIn = b[5];
    const rawRpm = (b[6] << 8) | b[7];
    const iops = b[8];
    const iocs = b[9];

    return {
      temperatureDegC: +(rawTemp * 0.1).toFixed(1),
      pressureBar: +(rawPressure * 0.01).toFixed(2),
      tankLevelPct,
      motorRpm: rawRpm,
      estopActive: Boolean(digitalIn & 0x01),
      safetyGateClosed: Boolean(digitalIn & 0x02),
      conveyorRun: Boolean(digitalIn & 0x04),
      autoMode: Boolean(digitalIn & 0x08),
      iops: iops === 0x80 ? 'GOOD' : 'BAD',
      iocs: iocs === 0x80 ? 'GOOD' : 'BAD'
    };
  }

  function exportToPCAP(frames) {
    let totalPayloadSize = 0;
    frames.forEach(f => {
      totalPayloadSize += (16 + f.length);
    });

    const totalSize = 24 + totalPayloadSize;
    const buffer = new Uint8Array(totalSize);
    const view = new DataView(buffer.buffer);

    view.setUint32(0, 0xa1b2c3d4, true);
    view.setUint16(4, 2, true);
    view.setUint16(6, 4, true);
    view.setInt32(8, 0, true);
    view.setUint32(12, 0, true);
    view.setUint32(16, 65535, true);
    view.setUint32(20, 1, true);

    let offset = 24;
    const baseTimeSec = Math.floor(Date.now() / 1000) - frames.length;

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const tsSec = baseTimeSec + i;
      const tsUsec = (i * 1000) % 1000000;
      const len = frame.length;

      view.setUint32(offset, tsSec, true);
      view.setUint32(offset + 4, tsUsec, true);
      view.setUint32(offset + 8, len, true);
      view.setUint32(offset + 12, len, true);

      buffer.set(frame, offset + 16);
      offset += (16 + len);
    }

    return buffer;
  }

  return {
    ETHERTYPE_PROFINET,
    ETHERTYPE_VLAN,
    FRAME_ID_TYPES,
    DCP_SERVICES,
    DCP_OPTIONS,
    classifyFrameId,
    packCyclicFrame,
    dissectCyclicFrame,
    packDCPFrame,
    encodePLCIOTelemetry,
    decodePLCIOTelemetry,
    exportToPCAP
  };
}));
