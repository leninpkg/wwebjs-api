import { GroupMetadata } from "baileys";
import BaileysWhatsappClient from "./baileys-whatsapp-client";

interface GroupsUpdateContext {
  client: BaileysWhatsappClient;
  updates: Partial<GroupMetadata>[];
}

/**
 * Captura o evento groups.update da Baileys para atualizar metadados de grupos no banco.
 * Faz merge dos dados parciais com o que já existe no cache.
 */
export default async function handleGroupsUpdate({ client, updates }: GroupsUpdateContext) {
  try {
    for (const update of updates) {
      if (!update.id) continue;

      // Busca dados existentes no banco para fazer merge
      const existing = await client._storage.getGroupMetadata(client.sessionId, update.id);
      if (existing) {
        const merged: GroupMetadata = { ...existing, ...update } as GroupMetadata;
        await client._storage.saveGroupMetadata(client.sessionId, update.id, merged);
      } else {
        // Se não existe no cache, salva o que temos (parcial)
        await client._storage.saveGroupMetadata(client.sessionId, update.id, update as GroupMetadata);
      }
    }

    if (updates.length > 0) {
      console.log(`[Groups ${client.sessionId}] Updated ${updates.length} groups from groups.update`);
    }
  } catch (error) {
    console.error(`[Groups ${client.sessionId}] Error processing groups.update:`, error);
  }
}
