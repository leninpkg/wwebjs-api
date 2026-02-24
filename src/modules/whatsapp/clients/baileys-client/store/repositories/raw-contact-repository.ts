import { Contact } from "baileys";
import { prisma } from "../../../../../../prisma";

interface UpdateRawContactInput {
  phoneNumber?: string;
  name?: string | null;
  notify?: string | null;
  verifiedName?: string | null;
  imgUrl?: string | null;
  status?: string | null;
}

interface UpsertRawContactInput {
  id: string;
  phoneNumber: string;
  name: string | null;
  notify: string | null;
  verifiedName: string | null;
  imgUrl: string | null;
  status: string | null;
}

class RawContactRepository {
  constructor(
    private readonly sessionId: string,
    private readonly instance: string,
  ) {}

  public async findById(id: string) {
    return prisma.rawContact.findFirst({
      where: {
        id,
        sessionId: this.sessionId,
        instance: this.instance,
      },
    });
  }

  public async updateById(id: string, data: UpdateRawContactInput): Promise<void> {
    await prisma.rawContact.update({
      where: { id },
      data,
    });
  }

  public async upsert(input: UpsertRawContactInput): Promise<void> {
    await prisma.rawContact.upsert({
      where: {
        id: input.id,
      },
      create: {
        id: input.id,
        instance: this.instance,
        sessionId: this.sessionId,
        phoneNumber: input.phoneNumber,
        name: input.name,
        notify: input.notify,
        verifiedName: input.verifiedName,
        imgUrl: input.imgUrl,
        status: input.status,
      },
      update: {
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
    return prisma.rawContact.findMany({
      where: {
        sessionId: this.sessionId,
        instance: this.instance,
      },
    });
  }

  public async findByPossibleIds(possibleIds: string[]) {
    return prisma.rawContact.findFirst({
      where: {
        sessionId: this.sessionId,
        instance: this.instance,
        id: {
          in: possibleIds,
        },
      },
    });
  }

  public async findByPhone(phoneNumber: string) {
    return prisma.rawContact.findFirst({
      where: {
        sessionId: this.sessionId,
        instance: this.instance,
        phoneNumber,
      },
    });
  }

  public mapToRawContact(contact: {
    id: string;
    instance: string;
    sessionId: string;
    phoneNumber: string;
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

export type { UpdateRawContactInput };
export default RawContactRepository;
