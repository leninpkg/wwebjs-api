import { JsonValue } from "@prisma/client/runtime/client";
import { BufferJSON } from "baileys";

function resolveJson<T>(value: JsonValue): T {
  if(typeof value === "object") {
    const string = JSON.stringify(value);
    return JSON.parse(string, BufferJSON.reviver) as T;
  }

  return value as T;
}

export default resolveJson;