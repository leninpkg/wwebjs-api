import { Contact } from "baileys";
import ContactsRepository, { UpdateRawContactInput } from "./contacts-repository";
import { ILogger } from "baileys/lib/Utils/logger";

interface UpdateContactInput {
  contact: Partial<Contact>;
  logger: ILogger;
  repository: ContactsRepository;
}

async function updateContact({ contact, logger, repository }: UpdateContactInput): Promise<void> {
  try {
    logger.info({ contact }, "Updating contact");
    if (!contact?.id) {
      logger.warn("Contact ID is missing, skipping update");
      return;
    }

    const existing = await repository.findByJid(contact.id!);
    if (!existing) {
      logger.warn(`Contact with ID ${contact.id} not found, skipping...`);
      return;
    }

    if (!Object.keys(contact).length) {
      logger.warn("No contact fields to update, skipping update");
      return;
    }

    const data: UpdateRawContactInput = {};

    if (typeof contact.name !== "undefined") data.name = contact.name;
    if (typeof contact.notify !== "undefined") data.notify = contact.notify;
    if (typeof contact.verifiedName !== "undefined") data.verifiedName = contact.verifiedName;
    if (typeof contact.imgUrl !== "undefined") data.imgUrl = contact.imgUrl;
    if (typeof contact.status !== "undefined") data.status = contact.status;
    if (typeof contact.phoneNumber !== "undefined") data.phoneNumber = contact.phoneNumber;
    if (typeof contact.lid !== "undefined") data.lid = contact.lid;

    logger.debug({ data }, "Prepared contact update data");
    await repository.updateById(existing.id, data);
    logger.info(`Contact with ID ${contact.id} updated successfully`);
  } catch (err: any) {
    logger.error(err, `Failed to update contact: ${err.message}`);
  }
}

export default updateContact;