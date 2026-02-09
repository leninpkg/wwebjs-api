import { Contact } from "baileys";
import BaileysWhatsappClient from "./baileys-whatsapp-client";

interface ContactsSetContext {
  client: BaileysWhatsappClient;
  contacts: Contact[];
}

export default async function handleContactsUpsert({ client, contacts }: ContactsSetContext) {
  try {
    const mappings: Array<{ lid: string; phoneNumber: string; contactName?: string | null }> = [];

    for (const contact of contacts) {
      const id = contact.id || "";
      const lid = contact.lid;
      const phoneNumber = contact.phoneNumber;
      const name = contact.name || contact.notify || contact.verifiedName;

      // Caso 1: id é um PN e tem lidR
      if (id.endsWith("@s.whatsapp.net") && lid && lid.endsWith("@lid")) {
        mappings.push({
          lid: lid.split("@")[0]!,
          phoneNumber: id.split("@")[0]!,
          contactName: name || phoneNumber?.split("@")[0] || null,
        });
      }
      // Caso 2: id é um LID e tem phoneNumber
      else if (id.endsWith("@lid") && phoneNumber && phoneNumber.endsWith("@s.whatsapp.net")) {
        mappings.push({
          lid: id.split("@")[0]!,
          phoneNumber: phoneNumber.split("@")[0]!,
          contactName: name || phoneNumber?.split("@")[0] || null,
        });
      }
    }

    if (mappings.length > 0) {
      console.log(`[LID Mapping ${client.sessionId}] Saving ${mappings.length} LID mappings from contacts.upsert`);
      await client._storage.saveLidMappings(client.sessionId, mappings);
    }
  } catch (error) {
    console.error(`[LID Mapping ${client.sessionId}] Error processing contacts.upsert:`, error);
  }
}