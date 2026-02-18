import { downloadMediaMessage, WAMessage } from "baileys";
import uploadFile from "../../../../files/upload-file";

export default async function saveMessageMedia(
  message: WAMessage,
  fileName: string,
  fileType: string,
  instance: string,
) {
  const buffer = await downloadMediaMessage(message, "buffer", {});
  const savedFile = await uploadFile(buffer, fileName, fileType, instance);

  return savedFile;
}