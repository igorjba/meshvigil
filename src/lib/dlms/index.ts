/** Public surface of the DLMS/COSEM codec. */

export { hexToBytes, bytesToHex, crc16X25, ByteReader, ByteWriter, ByteParseError, type Span } from "./bytes";
export { type AxdrNode, type AxdrValue, type DataTypeName, DataType, decodeAxdr, axdrToPrimitive } from "./axdr";
export { type CosemApdu, ApduTag, DataAccessResult, decodeApdu, isMeteringApdu } from "./cosem";
export { type HdlcFrame, type HdlcAddress, type HdlcControl, decodeHdlc, apduFromFrame } from "./hdlc";
export {
  type ObisCode,
  type ObisDefinition,
  toObisCode,
  describeObis,
  isKnownObis,
  listKnownObis,
  OBIS_MEDIA,
} from "./obis";
export {
  type ParsedFrame,
  type ParsedField,
  type Reading,
  type FieldGroup,
  parseFrame,
  parseToObject,
} from "./parser";
export {
  type DataNotificationInput,
  type FrameOptions,
  frameDataNotification,
  frameApdu,
  encGetResponseNormal,
  encCapture,
  encStructure,
  encArray,
  encOctetString,
  encU32,
  encU16,
  encI16,
  encEnum,
  encScalerUnit,
  encDateTime,
} from "./encoder";
export { DlmsUnit, type DlmsUnitName, UNIT_SYMBOL } from "./units";
export { SAMPLE_FRAMES, type SampleFrame } from "./samples";
