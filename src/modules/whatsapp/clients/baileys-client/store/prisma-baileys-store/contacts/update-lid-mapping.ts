import ContactsRepository from "./contacts-repository";

interface LidMappingUpdateEvent {
  lid: string;
  pn: string;
  repository: ContactsRepository;
}

async function updateLidMapping({ lid, pn, repository }: LidMappingUpdateEvent) {
  try {
    lid = lid.split("@")[0] || lid;
    pn = pn.split("@")[0] || pn;
    await repository.updateLidPn(lid, pn);
  } catch { }
}

export default updateLidMapping;
