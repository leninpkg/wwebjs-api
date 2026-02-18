import { isJidGroup, isLidUser, WAMessageKey } from "baileys";

/**
 * Tenta extrair o LID do WAMessageKey. 
 */
export function extractLidFromKey(key: WAMessageKey): string | null {
  try {
    return extractLidFromKeyOrThrow(key);
  } catch {
    return null;
  }
}

/**
 * Tenta extrair o LID do WAMessageKey. 
 * Lança um erro se não conseguir extrair o LID.
 */
export function extractLidFromKeyOrThrow(key: WAMessageKey): string {
  const jid = key.remoteJid || key.remoteJidAlt;

  // Se não tiver JID, não tem como pegar o LID. 
  if (!jid) {
    throw new Error("missing remoteJid/remoteJidAlt");
  }

  const isGroup = isJidGroup(jid);

  // Se for grupo, o LID deve estar no participant ou participantAlt.
  if (isGroup) {
    if (key.participant && isLidUser(key.participant)) {
      return key.participant;
    }
    if (key.participantAlt && isLidUser(key.participantAlt)) {
      return key.participantAlt;
    }
  }
  // Se for mensagem individual, deve estar no remoteJid ou remoteJidAlt.
  else {
    if (key.remoteJid && isLidUser(key.remoteJid)) {
      return key.remoteJid;
    }
    if (key.remoteJidAlt && isLidUser(key.remoteJidAlt)) {
      return key.remoteJidAlt;
    }
  }

  // Se não encontrou o número de telefone, lança um erro.
  throw new Error("no LID found in key");
}