import { Contact, isLidUser, isPnUser } from "baileys";
import { prisma } from "../../../../../../../prisma";

interface UpdateRawContactDto {
  lid?: string | null;
  phoneNumber?: string | null;
  name?: string | null;
  notify?: string | null;
  verifiedName?: string | null;
  imgUrl?: string | null;
  status?: string | null;
}

interface UpsertRawContactDto {
  id: string;
  lid: string | null;
  phoneNumber: string | null;
  name: string | null;
  notify: string | null;
  verifiedName: string | null;
  imgUrl: string | null;
  status: string | null;
}

class ContactsRepository {
  constructor(
    private readonly sessionId: string,
    private readonly instance: string,
  ) { }

  public async findByJid(jid: string) {
    const isPn = isPnUser(jid);
    const isLid = isLidUser(jid);

    if (isLid) {
      return prisma.rawContact.findFirst({
        where: {
          lid: jid,
          sessionId: this.sessionId,
          instance: this.instance,
        },
      });
    }
    if (isPn) {
      return prisma.rawContact.findFirst({
        where: {
          phoneNumber: jid.split("@")[0]!,
          sessionId: this.sessionId,
          instance: this.instance,
        },
      });
    }

    return prisma.rawContact.findFirst({
      where: {
        id: jid,
        sessionId: this.sessionId,
        instance: this.instance,
      },
    });
  }

  public async updateById(id: string, data: UpdateRawContactDto): Promise<void> {
    await prisma.rawContact.update({
      where: { id },
      data,
    });
  }

  public async updateLidPn(lid: string, phoneNumber: string): Promise<void> {
    await prisma.rawContact.updateMany({
      where: {
        sessionId: this.sessionId,
        instance: this.instance,
        OR: [
          { lid },
          { phoneNumber },
        ]
      },
      data: {
        lid,
        phoneNumber,
      }
    });
  }

  public async upsert(input: UpsertRawContactDto): Promise<void> {
    await prisma.rawContact.upsert({
      where: {
        id: input.id,
      },
      create: {
        id: input.id,
        instance: this.instance,
        sessionId: this.sessionId,
        lid: input.lid,
        phoneNumber: input.phoneNumber,
        name: input.name,
        notify: input.notify,
        verifiedName: input.verifiedName,
        imgUrl: input.imgUrl,
        status: input.status,
      },
      update: {
        lid: input.lid,
        phoneNumber: input.phoneNumber,
        name: input.name,
        notify: input.notify,
        verifiedName: input.verifiedName,
        imgUrl: input.imgUrl,
        status: input.status,
      },
    });
  }

  public async findMany() {
    const contacts = await prisma.rawContact.findMany({
      where: {
        sessionId: this.sessionId,
        instance: this.instance,
      },
    });
    return contacts.map(contact => this.mapToRawContact(contact));
  }

  public async findByLid(lid: string) {
    return prisma.rawContact.findFirst({
      where: {
        sessionId: this.sessionId,
        instance: this.instance,
        OR: [
          { lid },
          { id: lid + "@lid" },
        ]
      },
    });
  }

  public async findByPhone(phoneNumber: string) {
    return prisma.rawContact.findFirst({
      where: {
        sessionId: this.sessionId,
        instance: this.instance,
        OR: [
          { phoneNumber },
          { id: phoneNumber + "@s.whatsapp.net" },
        ]
      },
    });
  }

  public mapToRawContact(contact: {
    id: string;
    instance: string;
    sessionId: string;
    phoneNumber: string | null;
    name: string | null;
    verifiedName: string | null;
    imgUrl: string | null;
  }) {
    return {
      id: contact.id,
      instance: contact.instance,
      sessionId: contact.sessionId,
      avatarUrl: contact.imgUrl,
      name: contact.name,
      phone: contact.phoneNumber,
      verifiedName: contact.verifiedName,
      rawData: contact as unknown as Contact,
    };
  }
}

export type { UpdateRawContactDto as UpdateRawContactInput };
export default ContactsRepository;
