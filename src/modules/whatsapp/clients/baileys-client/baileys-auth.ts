import { Logger } from "@in.pulse-crm/utils";
import { AuthenticationCreds, AuthenticationState, BufferJSON, initAuthCreds, proto, SignalDataTypeMap } from "baileys";
import { prisma } from "../../../../prisma";

class BaileysAuth {
  private _sessionId: string;
  private _creds: AuthenticationCreds;

  private constructor(sessionId: string, creds: AuthenticationCreds) {
    this._creds = creds;
    this._sessionId = sessionId;
  }

  public static async create(sessionId: string): Promise<BaileysAuth> {
    const creds = await BaileysAuth.loadCredentials(sessionId);
    return new BaileysAuth(sessionId, creds);
  }

  private static parse(value: any): any {
    if (!value) return null;
    try {
      const raw = typeof value === 'object' ? JSON.stringify(value) : value;
      return JSON.parse(raw, BufferJSON.reviver);
    } catch (error) {
      Logger.error('Failed to parse data:', error as Error);
      return null;
    }
  }

  private static async readData(sessionId: string, key: string): Promise<any> {
    const data = await prisma.baileysAuth.findFirst({
      where: { sessionId, key }
    });

    return BaileysAuth.parse(data?.value);
  }

  private static async loadCredentials(sessionId: string): Promise<AuthenticationCreds> {
    const loadedCreds = await BaileysAuth.readData(sessionId, "creds");
    return loadedCreds || initAuthCreds();
  }

  private debug(message: string, obj?: any) {
    Logger.debug(`(BaileysAuth<${this._sessionId}>): ${message}`, obj);
  }

  private async writeData(key: string, value: any) {
    this.debug(`${key} | <${typeof value}>:`, value);

    const isObject = typeof value === "object" && value !== null;
    const valueFixed = isObject ? JSON.stringify(value, BufferJSON.replacer) : value as string;

    await prisma.baileysAuth.upsert({
      create: {
        sessionId: this.sessionId,
        key,
        value: valueFixed
      },
      update: {
        value: valueFixed
      },
      where: {
        uq_baileys_data_session_id_key: {
          sessionId: this.sessionId,
          key
        }
      }
    });
  }

  private async removeData(key: string) {
    this.debug(`Removing key: ${key}`);
    await prisma.baileysAuth.delete({
      where: {
        uq_baileys_data_session_id_key: {
          sessionId: this.sessionId,
          key
        }
      }
    });
  }

  public async saveCredentials() {
    return await this.writeData("creds", this._creds);
  }

  public async clearData() {
    return await prisma.baileysAuth.deleteMany({
      where: { sessionId: this._sessionId }
    });
  }

  public async removeCredentials() {
    await this.clearData();
    return await this.removeData("creds");
  }

  get creds() {
    return this._creds;
  }

  get sessionId() {
    return this._sessionId;
  }

  get state(): AuthenticationState {
    return {
      creds: this._creds,
      keys: {
        get: async (type, ids) => {
          const data: { [id: string]: any } = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await BaileysAuth.readData(this._sessionId, `${type}-${id}`);
              if (type === 'app-state-sync-key' && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value;
            })
          );
          return data;
        },
        set: async (data) => {
          const tasks: Array<Promise<void>> = [];
          for (const category in data) {
            for (const id in data[category as keyof SignalDataTypeMap]) {
              const key = `${category}-${id}`;
              const value = data[category as keyof SignalDataTypeMap]![id];
              tasks.push(value ? this.writeData(key, value) : this.removeData(key));
            }
          }

          await Promise.all(tasks);
        }
      }
    }
  }
}

export default BaileysAuth;