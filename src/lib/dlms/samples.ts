/**
 * Ready-to-inspect DLMS/COSEM frames for the inspector's preset menu.
 *
 * Built with the encoder so every sample is byte-exact and CRC-valid — except
 * the last one, which is deliberately corrupted to show the parser catching a
 * bad FCS rather than trusting the wire.
 */

import { bytesToHex } from "./bytes";
import { DlmsUnit } from "./units";
import {
  encCapture,
  encDateTime,
  encGetResponseNormal,
  encScalerUnit,
  encU16,
  encU32,
  frameApdu,
  frameDataNotification,
} from "./encoder";

export interface SampleFrame {
  readonly id: string;
  readonly title: string;
  readonly blurb: string;
  readonly hex: string;
}

const ts = encDateTime({ year: 2026, month: 7, day: 17, hour: 14, minute: 5, second: 30 });

// Scaler/unit helpers: scaler is the power-of-ten applied to the raw integer.
const WH = (scaler: number) => encScalerUnit(scaler, DlmsUnit.Wh);
const V = () => encScalerUnit(-1, DlmsUnit.V); // 0.1 V resolution
const A = () => encScalerUnit(-2, DlmsUnit.A); // 0.01 A resolution
const W = () => encScalerUnit(0, DlmsUnit.W);

function frameSample(id: string, title: string, blurb: string, bytes: Uint8Array): SampleFrame {
  return { id, title, blurb, hex: bytesToHex(bytes) };
}

const energyPush = frameDataNotification({
  invokeId: 0x000001,
  meterId: "MTR-00042",
  timestamp: ts,
  captures: [encCapture("1.0.1.8.0.255", encU32(1234567), WH(0))],
});

const multiRegisterPush = frameDataNotification({
  invokeId: 0x000002,
  meterId: "MTR-00042",
  timestamp: ts,
  captures: [
    encCapture("1.0.1.8.0.255", encU32(1234593), WH(0)),
    encCapture("1.0.32.7.0.255", encU16(2301), V()),
    encCapture("1.0.31.7.0.255", encU16(842), A()),
    encCapture("1.0.1.7.0.255", encU32(1936), W()),
  ],
});

const rfTelemetryPush = frameDataNotification({
  invokeId: 0x000003,
  meterId: "MTR-00099",
  timestamp: ts,
  captures: [
    encCapture("0.0.96.240.0.255", encI16Signed(-87)),
    encCapture("0.0.96.240.1.255", encU16(3)),
  ],
});

// GET-Response carrying a single energy register value.
const getResponse = frameApdu(encGetResponseNormal(0x02, encU32(1234567)), {
  direction: "response",
  control: 0x30, // I-frame response
});

// A valid frame with one payload byte flipped → FCS must fail.
function corrupt(bytes: Uint8Array): Uint8Array {
  const copy = bytes.slice();
  const idx = Math.floor(copy.length / 2);
  copy[idx] = copy[idx]! ^ 0xff;
  return copy;
}

export const SAMPLE_FRAMES: readonly SampleFrame[] = [
  frameSample("energy", "Energia (+A total)", "DataNotification com um registrador de energia ativa.", energyPush),
  frameSample("multi", "Multiplos registradores", "Energia, tensao, corrente e potencia instantanea num so envio.", multiRegisterPush),
  frameSample("rf", "Telemetria do enlace RF", "RSSI e contagem de saltos na malha reportados via COSEM.", rfTelemetryPush),
  frameSample("get", "GET-Response (normal)", "Leitura do registrador de energia solicitada pelo cliente.", getResponse),
  frameSample("corrupt", "Frame corrompido (FCS invalido)", "Um byte alterado no caminho — o parser acusa o FCS que nao confere.", corrupt(energyPush)),
];

// Local helper: signed 16-bit encoded as `long`, kept here to avoid widening the
// encoder's public surface for a single call site.
function encI16Signed(value: number): Uint8Array {
  return new Uint8Array([0x10, (value >> 8) & 0xff, value & 0xff]);
}
