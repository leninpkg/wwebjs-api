import { Logger } from "@in.pulse-crm/utils";
import { WppEvent } from "../types";
import WppEventEmitter from "./emitter";
import axios from "axios";

class HttpWppEventEmitter implements WppEventEmitter {
  constructor(private endpoints: string[]) { }

  public async emit(event: WppEvent): Promise<void> {
    for (const endpoint of this.endpoints) {
      Logger.debug(`Emitting event to ${endpoint.replace(":clientId", event.clientId.toString())}:`, event);
      await axios.post(endpoint.replace(":clientId", event.clientId.toString()), event);
    }
  }
}

export default HttpWppEventEmitter;
