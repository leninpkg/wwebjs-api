import { Contact, isPnUser } from "baileys";

export const getContactPhone = (contact: Partial<Contact>): string | null => {
  if (contact.phoneNumber) {
    return contact.phoneNumber.split("@")[0] || null;
  }

  if (contact.id?.endsWith("@s.whatsapp.net") || isPnUser(contact.id)) {
    return contact.id?.split("@")[0] || null;
  }
  return null;
}

export const getContactLid = (contact: Partial<Contact>): string | null => {
  if (contact.lid) {
    return contact.lid.split("@")[0] || null;
  }

  if (contact.id?.endsWith('@lid')) {
    return contact.id?.split("@")[0] || null;
  }
  return null;
}