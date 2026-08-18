import { createReadStream } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

import { v2 as cloudinary } from "cloudinary";

import { environment } from "../config.js";

const publicRoot = resolve(environment.PUBLIC_UPLOAD_DIR);
const privateRoot = resolve(environment.PRIVATE_UPLOAD_DIR);
const cloudinaryEnabled = environment.STORAGE_PROVIDER === "cloudinary" && Boolean(
  environment.CLOUDINARY_NAME && environment.CLOUDINARY_KEY && environment.CLOUDINARY_SECRET,
);

if (cloudinaryEnabled) {
  cloudinary.config({
    cloud_name: environment.CLOUDINARY_NAME,
    api_key: environment.CLOUDINARY_KEY,
    api_secret: environment.CLOUDINARY_SECRET,
    secure: true,
  });
}

function safeExtension(file: Express.Multer.File): string {
  const allowed: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/avif": ".avif",
    "application/pdf": ".pdf",
  };
  return allowed[file.mimetype] ?? extname(file.originalname).toLowerCase().slice(0, 8);
}

function uploadCloudinary(
  file: Express.Multer.File,
  options: { folder: string; type?: "authenticated"; resourceType?: "image" | "auto" },
): Promise<{ secureUrl: string; publicId: string; format: string; resourceType: string }> {
  return new Promise((resolveUpload, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      folder: options.folder,
      type: options.type,
      resource_type: options.resourceType ?? "image",
      transformation: options.resourceType === "image" ? [{ quality: "auto", fetch_format: "auto" }] : undefined,
    }, (error, result) => {
      if (error || !result) return reject(error ?? new Error("Cloudinary no devolvió un resultado"));
      resolveUpload({
        secureUrl: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        resourceType: result.resource_type,
      });
    });
    stream.end(file.buffer);
  });
}

export async function uploadProductFiles(files: Express.Multer.File[], tenantId: string): Promise<string[]> {
  if (cloudinaryEnabled) {
    const uploads = await Promise.all(files.map((file) => uploadCloudinary(file, {
      folder: `infinityshop/${tenantId}/products`,
      resourceType: "image",
    })));
    return uploads.map(({ secureUrl }) => secureUrl);
  }

  const directory = resolve(publicRoot, "tenants", tenantId, "products");
  await mkdir(directory, { recursive: true });
  return Promise.all(files.map(async (file) => {
    const name = `${randomUUID()}${safeExtension(file)}`;
    await writeFile(resolve(directory, name), file.buffer, { flag: "wx" });
    return `${environment.API_PUBLIC_URL.replace(/\/$/, "")}/uploads/tenants/${tenantId}/products/${name}`;
  }));
}

export type StoredReceipt = {
  storageProvider: "LOCAL" | "CLOUDINARY";
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeInBytes: number;
};

export async function uploadReceiptFile(
  file: Express.Multer.File,
  tenantId: string,
  orderId: string,
): Promise<StoredReceipt> {
  if (cloudinaryEnabled) {
    const uploaded = await uploadCloudinary(file, {
      folder: `infinityshop/${tenantId}/payment-receipts`,
      type: "authenticated",
      resourceType: "auto",
    });
    return {
      storageProvider: "CLOUDINARY",
      storageKey: JSON.stringify({ publicId: uploaded.publicId, format: uploaded.format, resourceType: uploaded.resourceType }),
      originalName: file.originalname.slice(0, 160),
      mimeType: file.mimetype,
      sizeInBytes: file.size,
    };
  }

  const directory = resolve(privateRoot, tenantId, orderId);
  await mkdir(directory, { recursive: true });
  const name = `${randomUUID()}${safeExtension(file)}`;
  const relativeKey = `${tenantId}/${orderId}/${name}`;
  await writeFile(resolve(privateRoot, relativeKey), file.buffer, { flag: "wx" });
  return {
    storageProvider: "LOCAL",
    storageKey: relativeKey,
    originalName: file.originalname.slice(0, 160),
    mimeType: file.mimetype,
    sizeInBytes: file.size,
  };
}

export async function deleteStoredReceipt(receipt: Pick<StoredReceipt, "storageProvider" | "storageKey">): Promise<void> {
  if (receipt.storageProvider === "LOCAL") {
    await rm(resolve(privateRoot, receipt.storageKey), { force: true });
    return;
  }
  const parsed = JSON.parse(receipt.storageKey) as { publicId: string; resourceType: string };
  await cloudinary.uploader.destroy(parsed.publicId, {
    resource_type: parsed.resourceType,
    type: "authenticated",
    invalidate: true,
  });
}

export function getStoredReceiptAccess(receipt: Pick<StoredReceipt, "storageProvider" | "storageKey">):
  { kind: "local"; stream: ReturnType<typeof createReadStream> } | { kind: "redirect"; url: string } {
  if (receipt.storageProvider === "LOCAL") {
    return { kind: "local", stream: createReadStream(resolve(privateRoot, receipt.storageKey)) };
  }
  const parsed = JSON.parse(receipt.storageKey) as { publicId: string; format: string; resourceType: string };
  return {
    kind: "redirect",
    url: cloudinary.utils.private_download_url(parsed.publicId, parsed.format, {
      resource_type: parsed.resourceType,
      type: "authenticated",
      expires_at: Math.floor(Date.now() / 1000) + 300,
    }),
  };
}

export { publicRoot };
