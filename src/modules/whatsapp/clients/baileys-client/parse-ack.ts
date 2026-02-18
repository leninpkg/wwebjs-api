import { InpulseMessageStatus } from "../../inpulse-types";

const ACKS_DICT: Array<InpulseMessageStatus> = ["ERROR", "PENDING", "SENT", "RECEIVED", "READ", "READ"];

function parseAck(ack: number): InpulseMessageStatus {
  return ACKS_DICT[ack] || "ERROR";
}

export default parseAck;
