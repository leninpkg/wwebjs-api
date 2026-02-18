function phoneToJid(phone: string): string {
  if (!phone.includes("@s.whatsapp.net")) {
    return `${phone}@s.whatsapp.net`;
  }
  return phone;
}

function phoneToAltBr(phone: string): string {
  if (phone.startsWith("55")) {
    const DDI = phone.slice(0, 2);
    const DDD = phone.slice(2, 4);
    const restNumber = phone.slice(4);

    if (DDI === "55" && restNumber.length === 9) {
      return `${DDI}${DDD}${restNumber}`;
    }
    if (DDI === "55" && restNumber.length === 10) {
      return `${DDI}${DDD}9${restNumber}`;
    }
  }
  return phone;
}

function phoneToAltBrJid(phone: string): string {
  const altPhone = phoneToAltBr(phone);
  return phoneToJid(altPhone);
}

export { phoneToJid, phoneToAltBr, phoneToAltBrJid };
