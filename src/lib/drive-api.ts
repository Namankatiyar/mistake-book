export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
};

export type ManifestSource = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  isDeleted: boolean;
};

export type ManifestQuestion = {
  id: string;
  driveFileId: string;
  driveFilePath: string;
  imageHash: string;
  subjectId: string;
  chapterId: string;
  mistakeId: string | null;
  sourceId: string | null;
  answerKey: string;
  note: string;
  revisionCount: number;
  lastRevisionDay: string | null;
  stashed: boolean;
  createdAt: number;
  updatedAt: number;
  isDeleted: boolean;
};

export type ManifestData = {
  version: 1;
  lastSyncedAt: number;
  sources: ManifestSource[];
  questions: ManifestQuestion[];
};

const TIMEOUT_MS = 15000;
const folderCache = new Map<string, string>();

export function clearFolderCache(): void {
  folderCache.clear();
}

export function escapeDriveQueryString(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export function formatQuestionFileName(question: {
  id: string;
  createdAt: number | bigint;
  mistakeId?: string | null;
}): string {
  const d = new Date(Number(question.createdAt));
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const dateStr = `${year}-${month}-${day}`;
  const mistake = question.mistakeId || "unclassified";
  const shortId = question.id.substring(0, 6);
  return `${dateStr}_${mistake}_${shortId}.png`;
}

export { computeBytesHash, computeImageHash } from "./image-hash";

async function driveFetch(
  url: string,
  options: RequestInit & { accessToken: string }
): Promise<Response> {
  const { accessToken, headers, signal, ...rest } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error(`Drive API request timed out after ${TIMEOUT_MS}ms: ${url}`));
  }, TIMEOUT_MS);

  if (signal) {
    signal.addEventListener("abort", () => controller.abort(signal.reason), {
      once: true,
    });
  }

  try {
    const res = await fetch(url, {
      ...rest,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...headers,
      },
    });

    if (!res.ok) {
      let bodyText = "";
      try {
        bodyText = await res.text();
      } catch {
        // ignore
      }
      throw new Error(
        `Drive API error (${res.status} ${res.statusText})${bodyText ? `: ${bodyText}` : ""}`
      );
    }

    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function findOrCreateFolder(
  accessToken: string,
  name: string,
  parentId?: string
): Promise<string> {
  const cacheKey = `${parentId || "root"}:${name}`;
  const cached = folderCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  let query = `name = '${escapeDriveQueryString(name)}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  if (parentId) {
    query += ` and '${escapeDriveQueryString(parentId)}' in parents`;
  }

  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    query
  )}&fields=files(id,name,mimeType,parents)&spaces=drive`;

  const searchRes = await driveFetch(searchUrl, {
    accessToken,
    method: "GET",
  });

  const searchData = (await searchRes.json()) as {
    files?: DriveFile[];
  };

  if (searchData.files && searchData.files.length > 0) {
    const foundId = searchData.files[0].id;
    folderCache.set(cacheKey, foundId);
    return foundId;
  }

  const createPayload: {
    name: string;
    mimeType: string;
    parents?: string[];
  } = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentId) {
    createPayload.parents = [parentId];
  }

  const createRes = await driveFetch("https://www.googleapis.com/drive/v3/files", {
    accessToken,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(createPayload),
  });

  const createData = (await createRes.json()) as { id: string };
  folderCache.set(cacheKey, createData.id);
  return createData.id;
}

export async function resolveChapterFolder(
  accessToken: string,
  subjectName: string,
  chapterName: string,
  rootFolderId: string
): Promise<string> {
  const subjectFolderId = await findOrCreateFolder(accessToken, subjectName, rootFolderId);
  const chapterFolderId = await findOrCreateFolder(accessToken, chapterName, subjectFolderId);
  return chapterFolderId;
}

export async function uploadImage(
  accessToken: string,
  imageBlob: Blob,
  fileName: string,
  folderId: string,
  existingFileId?: string
): Promise<string> {
  const boundary = `-------mb_img_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const metadata = existingFileId
    ? { name: fileName }
    : { name: fileName, parents: [folderId] };

  const mimeType = imageBlob.type || "image/png";

  const multipartParts = [
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
    imageBlob,
    `\r\n--${boundary}--`,
  ];

  const multipartBody = new Blob(multipartParts, {
    type: `multipart/related; boundary=${boundary}`,
  });

  const url = existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;

  const method = existingFileId ? "PATCH" : "POST";

  const res = await driveFetch(url, {
    accessToken,
    method,
    headers: {
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function downloadImage(accessToken: string, fileId: string): Promise<Blob> {
  const res = await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    accessToken,
    method: "GET",
  });
  return await res.blob();
}

export async function trashFile(accessToken: string, fileId: string): Promise<void> {
  await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    accessToken,
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ trashed: true }),
  });
}

export async function getManifest(
  accessToken: string,
  rootFolderId: string
): Promise<ManifestData | null> {
  const query = `name = 'manifest.json' and '${escapeDriveQueryString(
    rootFolderId
  )}' in parents and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    query
  )}&fields=files(id,name)&spaces=drive`;

  const res = await driveFetch(url, { accessToken, method: "GET" });
  const data = (await res.json()) as { files?: Array<{ id: string; name: string }> };

  if (!data.files || data.files.length === 0) {
    return null;
  }

  const fileId = data.files[0].id;
  const downloadRes = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { accessToken, method: "GET" }
  );

  try {
    const json = (await downloadRes.json()) as ManifestData;
    return json;
  } catch {
    return null;
  }
}

export async function uploadManifest(
  accessToken: string,
  manifest: ManifestData,
  rootFolderId: string,
  existingManifestId?: string
): Promise<string> {
  let fileId = existingManifestId;
  if (!fileId) {
    const query = `name = 'manifest.json' and '${escapeDriveQueryString(
      rootFolderId
    )}' in parents and trashed = false`;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      query
    )}&fields=files(id)&spaces=drive`;
    const searchRes = await driveFetch(searchUrl, { accessToken, method: "GET" });
    const searchData = (await searchRes.json()) as { files?: Array<{ id: string }> };
    if (searchData.files && searchData.files.length > 0) {
      fileId = searchData.files[0].id;
    }
  }

  const boundary = `-------mb_manifest_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const metadata = fileId
    ? { name: "manifest.json" }
    : { name: "manifest.json", parents: [rootFolderId] };

  const jsonContent = JSON.stringify(manifest, null, 2);
  const jsonBlob = new Blob([jsonContent], {
    type: "application/json; charset=UTF-8",
  });

  const multipartParts = [
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n`,
    jsonBlob,
    `\r\n--${boundary}--`,
  ];

  const multipartBody = new Blob(multipartParts, {
    type: `multipart/related; boundary=${boundary}`,
  });

  const url = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;

  const method = fileId ? "PATCH" : "POST";

  const res = await driveFetch(url, {
    accessToken,
    method,
    headers: {
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  const data = (await res.json()) as { id: string };
  return data.id;
}
