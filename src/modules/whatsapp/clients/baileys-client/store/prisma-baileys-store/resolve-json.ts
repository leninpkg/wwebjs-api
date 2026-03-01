import { BufferJSON } from "baileys";

function reviveJSON<T>(value: string): T {
  return JSON.parse(value, BufferJSON.reviver);
}

export default reviveJSON;