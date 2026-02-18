import { FileDirType } from "@in.pulse-crm/sdk";
import filesService from "./files.service";

export default async function uploadFile(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  instance: string
) {
  const uploadedFile = await filesService.uploadFile({
    buffer,
    fileName,
    mimeType,
    dirType: FileDirType.PUBLIC,
    instance,
  });

  return uploadedFile;
}