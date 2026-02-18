import { isJidGroup, isPnUser, WAMessageKey } from "baileys";
import onlyDigits from "../../../../../helpers/only-digits";

/**
 * Tenta extrair o número de telefone do WAMessageKey. 
 */
export function extractPhoneFromKey(key: WAMessageKey): string | null {
  try {
    return extractPhoneFromKeyOrThrow(key);
  } catch {
    return null;
  }
}

/**
 * Tenta extrair o número de telefone do WAMessageKey. 
 * Lança um erro se não conseguir extrair o número de telefone.
 */
export function extractPhoneFromKeyOrThrow(key: WAMessageKey): string {
  const jid = key.remoteJid || key.remoteJidAlt;

  // Se não tiver JID, não tem como pegar o número de telefone. 
  if (!jid) {
    throw new Error("missing remoteJid/remoteJidAlt");
  }

  const isGroup = isJidGroup(jid);

  // Se for grupo, o número de telefone deve estar no participant ou participantAlt.
  if (isGroup) {
    if (key.participant && isPnUser(key.participant)) {
      return onlyDigits(key.participant);
    }
    if (key.participantAlt && isPnUser(key.participantAlt)) {
      return onlyDigits(key.participantAlt);
    }
  }
  // Se for mensagem individual, deve estar no remoteJid ou remoteJidAlt.
  else {
    if (key.remoteJid && isPnUser(key.remoteJid)) {
      return onlyDigits(key.remoteJid);
    }
    if (key.remoteJidAlt && isPnUser(key.remoteJidAlt)) {
      return onlyDigits(key.remoteJidAlt);
    }
  }

  // Se não encontrou o número de telefone, lança um erro.
  throw new Error("no phone number found in key");
}