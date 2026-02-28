import { Contact, GroupMetadata } from "baileys";
import { ILogger } from "baileys/lib/Utils/logger";
import GroupsRepository from "../groups/groups-repository";
import ContactsRepository from "./contacts-repository";
import { getContactLid, getContactPhone } from "../../../helpers/contact-helpers";

interface UpsertContactDto {
  contact: Contact;
  logger: ILogger;
  contactsRepo: ContactsRepository;
  groupsRepo: GroupsRepository;
}

async function upsertContact({ contact, logger, contactsRepo, groupsRepo }: UpsertContactDto): Promise<void> {
  try {
    if (contact.id.endsWith("@g.us")) {
      const groupData: Partial<GroupMetadata> = {
        id: contact.id,
        ...(contact.name ? { subject: contact.name } : {}),
      }
      await groupsRepo.upsert(contact.id, groupData, contact.name);
      logger.info(`Contact with ID ${contact.id} is a group, saved on groups repository`);
    } else {
      await contactsRepo.upsert({
        id: contact.id,
        lid: getContactLid(contact),
        phoneNumber: getContactPhone(contact),
        name: contact.name || null,
        notify: contact.notify || null,
        verifiedName: contact.verifiedName || null,
        imgUrl: contact.imgUrl || null,
        status: contact.status || null,
      });
      logger.info(`Contact with ID ${contact.id} upserted successfully`);
    }

  } catch (err) {
    logger.error(err, `Failed to upsert contact with ID ${contact.id}`);
  }
}

export default upsertContact;