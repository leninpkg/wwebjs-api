import { InpulseMessageStatus } from "../../../inpulse-types";

const ACKS_DICT: Array<InpulseMessageStatus> = ["ERROR", "PENDING", "SENT", "RECEIVED", "READ", "READ"];

function getMessageStatus(ack: number): InpulseMessageStatus {
  return ACKS_DICT[ack] || "ERROR";
}

export default getMessageStatus;
