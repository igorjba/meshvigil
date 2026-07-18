/**
 * xDLMS APDU layer (IEC 62056-5-3). We decode the two APDUs that actually carry
 * metering payloads in this simulator — GET-Response and DataNotification — and
 * identify the rest by tag so the inspector can label any frame it is given.
 */

import { type ByteReader, bytesToHex, type Span } from "./bytes";
import { type AxdrNode, decodeAxdr, readAxdrLength } from "./axdr";

export const ApduTag = {
  InitiateRequest: 0x01,
  InitiateResponse: 0x08,
  GetRequest: 0xc0,
  SetRequest: 0xc1,
  EventNotificationRequest: 0xc2,
  ActionRequest: 0xc3,
  GetResponse: 0xc4,
  SetResponse: 0xc5,
  ActionResponse: 0xc7,
  DataNotification: 0x0f,
  Aarq: 0x60,
  Aare: 0x61,
  Rlrq: 0x62,
  Rlre: 0x63,
  ExceptionResponse: 0xd8,
  GeneralGloCiphering: 0xdb,
} as const;

const APDU_NAME = new Map<number, string>(
  Object.entries(ApduTag).map(([name, tag]) => [tag, name]),
);

/** data-access-result enumeration (subset that meters actually emit). */
export const DataAccessResult: Record<number, string> = {
  0: "success",
  1: "hardware-fault",
  2: "temporary-failure",
  3: "read-write-denied",
  4: "object-undefined",
  9: "object-unavailable",
  11: "other-reason",
  250: "scope-of-access-violated",
};

export interface CosemApdu {
  readonly tag: number;
  readonly name: string;
  readonly span: Span;
  readonly invokeId?: number;
  readonly priority?: "high" | "normal";
  readonly serviceClass?: "confirmed" | "unconfirmed";
  /** Set when the APDU carries a data-access-result error rather than data. */
  readonly accessError?: string;
  /** The decoded COSEM data payload, when the APDU carries one. */
  readonly data?: AxdrNode;
  /** DataNotification timestamp, if present. */
  readonly timestampHex?: string;
  /** Human note for APDUs we identify but do not fully decode. */
  readonly note?: string;
}

function decodeInvokeIdAndPriority(byte: number): Pick<CosemApdu, "invokeId" | "priority" | "serviceClass"> {
  return {
    invokeId: byte & 0x0f,
    serviceClass: byte & 0x40 ? "confirmed" : "unconfirmed",
    priority: byte & 0x80 ? "high" : "normal",
  };
}

export function decodeApdu(r: ByteReader): CosemApdu {
  const mark = r.span();
  const tag = r.u8();
  const name = APDU_NAME.get(tag) ?? "Unknown-APDU";

  switch (tag) {
    case ApduTag.GetResponse: {
      const responseType = r.u8(); // 1=normal, 2=with-datablock, 3=with-list
      const iap = r.u8();
      const meta = decodeInvokeIdAndPriority(iap);
      if (responseType !== 1) {
        return { tag, name, span: mark.end(), ...meta, note: `GET-Response type ${responseType} (block/list) not decoded` };
      }
      const resultChoice = r.u8(); // 0=data, 1=data-access-result
      if (resultChoice === 1) {
        const err = r.u8();
        return { tag, name, span: mark.end(), ...meta, accessError: DataAccessResult[err] ?? `unknown(${err})` };
      }
      const data = decodeAxdr(r);
      return { tag, name, span: mark.end(), ...meta, data };
    }

    case ApduTag.DataNotification: {
      // long-invoke-id-and-priority is Unsigned32: invoke-id in the low 24 bits,
      // service-class (bit 30) and priority (bit 31) in the top byte.
      const longIap = r.u32();
      const meta = {
        invokeId: longIap & 0xffffff,
        priority: (longIap & 0x8000_0000) !== 0 ? ("high" as const) : ("normal" as const),
        serviceClass: (longIap & 0x4000_0000) !== 0 ? ("confirmed" as const) : ("unconfirmed" as const),
      };
      // date-time: octet-string with an explicit length (0 means absent).
      const dtLen = r.u8();
      const timestampHex = dtLen > 0 ? bytesToHex(r.bytes(dtLen)) : undefined;
      const data = decodeAxdr(r);
      return { tag, name, span: mark.end(), ...meta, ...(timestampHex ? { timestampHex } : {}), data };
    }

    case ApduTag.EventNotificationRequest: {
      // time (optional), cosem-attribute-descriptor, attribute-value
      const hasTime = r.u8();
      if (hasTime) {
        const len = readAxdrLength(r);
        r.bytes(len);
      }
      return { tag, name, span: mark.end(), note: "EventNotification (descriptor not expanded)" };
    }

    case ApduTag.Aarq:
    case ApduTag.Aare:
    case ApduTag.Rlrq:
    case ApduTag.Rlre: {
      // ACSE / association control — BER encoded. We identify it and skip the body.
      const len = r.remaining;
      r.bytes(len);
      return { tag, name, span: mark.end(), note: "ACSE association APDU (BER body not expanded)" };
    }

    case ApduTag.ExceptionResponse: {
      const stateError = r.u8();
      const serviceError = r.u8();
      return { tag, name, span: mark.end(), note: `state-error=${stateError} service-error=${serviceError}` };
    }

    default: {
      if (r.remaining > 0) r.bytes(r.remaining);
      return { tag, name: name === "Unknown-APDU" ? `Unknown-APDU (0x${tag.toString(16)})` : name, span: mark.end(), note: "payload not decoded" };
    }
  }
}

export function isMeteringApdu(tag: number): boolean {
  return tag === ApduTag.GetResponse || tag === ApduTag.DataNotification;
}
