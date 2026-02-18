import { Logger } from "@in.pulse-crm/utils";
import { AuthenticationCreds, AuthenticationState, BufferJSON, initAuthCreds, proto, SignalDataTypeMap } from "baileys";
import { prisma } from "../../../../../prisma";
import BaileysAuth from "./baileys-auth";

class PrismaBaileysAuth implements BaileysAuth {
  private _sessionId: string;
  private _creds: AuthenticationCreds;

  private constructor(sessionId: string, creds: AuthenticationCreds) {
    this._creds = creds;
    this._sessionId = sessionId;
  }

  public static async fromSession(sessionId: string): Promise<PrismaBaileysAuth> {
    const creds = await PrismaBaileysAuth.loadCredentials(sessionId);
    return new PrismaBaileysAuth(sessionId, creds);
  }

  private static parse(value: any): any {
    if (!value) return null;
    try {
      // O Prisma já retorna o objeto do campo Json, então só precisamos aplicar o reviver
      const raw = JSON.stringify(value);
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

    return PrismaBaileysAuth.parse(data?.value);
  }

  private static async loadCredentials(sessionId: string): Promise<AuthenticationCreds> {
    const loadedCreds = await PrismaBaileysAuth.readData(sessionId, "creds");
    return loadedCreds || initAuthCreds();
  }

  private debug(message: string, obj?: any) {
    Logger.debug(`(BaileysAuth<${this._sessionId}>): ${message}`, obj);
  }

  private async writeData(key: string, value: any) {
    this.debug(`${key} | <${typeof value}>:`, value);

    // O Prisma espera um objeto JavaScript para campos Json, não uma string
    // Usamos JSON.parse/stringify com replacer para serializar Buffers corretamente
    const valueFixed = JSON.parse(JSON.stringify(value, BufferJSON.replacer));

    try {
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
    } catch (error) {
      Logger.error(`Failed to write data for key ${key}:`, error as Error);
      throw error;
    }
  }

  private async removeData(key: string) {
    this.debug(`Removing key: ${key}`);
    try {
      await prisma.baileysAuth.delete({
        where: {
          uq_baileys_data_session_id_key: {
            sessionId: this.sessionId,
            key
          }
        }
      });
    } catch (error) {
      // Ignora erro se o registro não existir
      if ((error as any).code !== 'P2025') {
        Logger.error(`Failed to remove data for key ${key}:`, error as Error);
        throw error;
      }
    }
  }

  public async saveCredentials() {
    return await this.writeData("creds", this._creds);
  }

  public async clearData() {
    await prisma.baileysAuth.deleteMany({
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
              let value = await PrismaBaileysAuth.readData(this._sessionId, `${type}-${id}`);
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
              const task = value ? this.writeData(key, value) : this.removeData(key);
              // Encapsula cada task para capturar erros individualmente
              tasks.push(
                task.catch((error) => {
                  Logger.error(`Failed to process key ${key}:`, error);
                  // Re-throw para que o Baileys saiba que falhou
                  throw error;
                })
              );
            }
          }

          await Promise.all(tasks);
        }
      }
    }
  }
}

export default PrismaBaileysAuth;