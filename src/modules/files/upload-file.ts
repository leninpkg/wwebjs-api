import { FileDirType } from "@in.pulse-crm/sdk";
import filesService from "./files.service";


export default async function uploadFile(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  instance: string
) {
  try {
    const uploadedFile = await filesService.uploadFile({
      buffer,
      fileName,
      mimeType,
      dirType: FileDirType.PUBLIC,
      instance,
    });

    return uploadedFile;
  } catch (err: any) {
    const msg = err?.response?.data?.message || err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to upload file: ${msg}`);
  }
}