import { GroupMetadata } from "baileys";
import BaileysWhatsappClient from "./baileys-whatsapp-client";

interface GroupsUpsertContext {
  client: BaileysWhatsappClient;
  groups: GroupMetadata[];
}

/**
 * Captura o evento groups.upsert da Baileys para armazenar/atualizar metadados de grupos no banco.
 * Isso permite listar grupos sem consultar a API do WhatsApp (evita banimento).
 */
export default async function handleGroupsUpsert({ client, groups }: GroupsUpsertContext) {
  try {
    for (const group of groups) {
      if (!group.id) continue;
      await client._storage.saveGroupMetadata(client.sessionId, group.id, group);
    }

    if (groups.length > 0) {
      console.log(`[Groups ${client.sessionId}] Saved ${groups.length} groups from groups.upsert`);
    }
  } catch (error) {
    console.error(`[Groups ${client.sessionId}] Error processing groups.upsert:`, error);
  }
}
