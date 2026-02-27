import { Contact, isLidUser, isPnUser } from "baileys";
import { ILogger } from "baileys/lib/Utils/logger";
import ContactsRepository from "./contacts-repository";

const getContactPhone = (contact: Contact): string | null => {
  if (contact.phoneNumber) {
    return contact.phoneNumber.split("@")[0] || null;
  }

  if (isPnUser(contact.id)) {
    return contact.id.split("@")[0] || null;
  }
  return null;
}

const getContactLid = (contact: Contact): string | null => {
  if (contact.lid) {
    return contact.lid.split("@")[0] || null;
  }

  if (isLidUser(contact.id)) {
    return contact.id.split("@")[0] || null;
  }
  return null;
}

async function upsertContact(logger: ILogger, contact: Contact, repository: ContactsRepository): Promise<void> {
  try {
    logger.info({ contact }, "Upserting contact");

    await repository.upsert({
      id: contact.id,
      lid: contact.lid || getContactLid(contact),
      phoneNumber: contact.phoneNumber || getContactPhone(contact),
      name: contact.name || null,
      notify: contact.notify || null,
      verifiedName: contact.verifiedName || null,
      imgUrl: contact.imgUrl || null,
      status: contact.status || null,
    });
    logger.info(`Contact with ID ${contact.id} upserted successfully`);
  } catch (error) {
    logger.error({ error }, "Failed to upsert contact");
    throw error;
  }
}

export default upsertContact;