/**
 * Google Drive REST API integration for Direxis / Nóminas synchronization.
 * Manages the driver's private folder hierarchy and file synchronization.
 */

export interface DriveFolderInfo {
  direxisFolderId: string;
  nominasFolderId: string;
}

export interface DriveFileInfo {
  id: string;
  name: string;
  mimeType?: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
}

const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';

/**
 * Searches for a folder by name, optionally inside a specific parent folder.
 */
export async function findFolder(
  token: string,
  folderName: string,
  parentFolderId?: string
): Promise<DriveFileInfo | null> {
  let query = `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and trashed = false`;
  if (parentFolderId) {
    query += ` and '${parentFolderId}' in parents`;
  }

  const url = `${DRIVE_API_URL}?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,modifiedTime,webViewLink)&pageSize=1`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Error buscando carpeta en Drive:', response.status, errorText);
    throw new Error(`Error en Google Drive al buscar "${folderName}": ${response.statusText}`);
  }

  const data = await response.json();
  if (data.files && data.files.length > 0) {
    return data.files[0];
  }
  return null;
}

/**
 * Creates a new folder in Google Drive.
 */
export async function createFolder(
  token: string,
  folderName: string,
  parentFolderId?: string
): Promise<DriveFileInfo> {
  const metadata: { name: string; mimeType: string; parents?: string[] } = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentFolderId) {
    metadata.parents = [parentFolderId];
  }

  const response = await fetch(DRIVE_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Error creando carpeta en Drive:', response.status, errorText);
    throw new Error(`Error al crear la carpeta "${folderName}" en Google Drive`);
  }

  return response.json();
}

/**
 * Ensures the required folder hierarchy:
 * "Direxis" -> "Nóminas"
 * Returns the folder IDs.
 */
export async function ensureDirexisHierarchy(token: string): Promise<DriveFolderInfo> {
  // 1. Check or create 'Direxis' folder
  let direxisFolder = await findFolder(token, 'Direxis');
  if (!direxisFolder) {
    direxisFolder = await createFolder(token, 'Direxis');
  }

  // 2. Check or create 'Nóminas' folder inside 'Direxis'
  let nominasFolder = await findFolder(token, 'Nóminas', direxisFolder.id);
  if (!nominasFolder) {
    nominasFolder = await createFolder(token, 'Nóminas', direxisFolder.id);
  }

  return {
    direxisFolderId: direxisFolder.id,
    nominasFolderId: nominasFolder.id,
  };
}

/**
 * Finds a file by name inside a parent folder.
 */
export async function findFileInFolder(
  token: string,
  fileName: string,
  parentFolderId: string
): Promise<DriveFileInfo | null> {
  const query = `'${parentFolderId}' in parents and name = '${fileName}' and trashed = false`;
  const url = `${DRIVE_API_URL}?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,modifiedTime,size,webViewLink)&pageSize=1`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    console.error('Error buscando archivo en Drive:', response.statusText);
    return null;
  }

  const data = await response.json();
  if (data.files && data.files.length > 0) {
    return data.files[0];
  }
  return null;
}

/**
 * Reads a JSON file content from Google Drive by fileId.
 */
export async function readDriveJsonFile<T>(token: string, fileId: string): Promise<T | null> {
  const url = `${DRIVE_API_URL}/${fileId}?alt=media`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    console.error('Error descargando archivo JSON de Drive:', response.statusText);
    return null;
  }

  try {
    return await response.json();
  } catch (err) {
    console.error('Error parseando contenido JSON de Drive:', err);
    return null;
  }
}

/**
 * Saves or updates a JSON file inside a specific parent folder in Drive.
 */
export async function saveOrUpdateDriveJsonFile<T>(
  token: string,
  parentFolderId: string,
  fileName: string,
  data: T
): Promise<DriveFileInfo> {
  const contentStr = JSON.stringify(data, null, 2);
  const existingFile = await findFileInFolder(token, fileName, parentFolderId);

  if (existingFile) {
    // Update existing file content
    const updateUrl = `${DRIVE_UPLOAD_URL}/${existingFile.id}?uploadType=media`;
    const response = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: contentStr,
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Error actualizando archivo en Drive:', err);
      throw new Error(`Error al actualizar "${fileName}" en Google Drive`);
    }

    return response.json();
  } else {
    // Create new file with multipart upload
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata = {
      name: fileName,
      mimeType: 'application/json',
      parents: [parentFolderId],
    };

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      contentStr +
      closeDelimiter;

    const response = await fetch(`${DRIVE_UPLOAD_URL}?uploadType=multipart`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Error creando archivo en Drive:', err);
      throw new Error(`Error al crear "${fileName}" en Google Drive`);
    }

    return response.json();
  }
}

/**
 * Saves a PDF document into the Nóminas folder in Drive.
 */
export async function uploadPdfToDrive(
  token: string,
  parentFolderId: string,
  fileName: string,
  pdfBlob: Blob
): Promise<DriveFileInfo> {
  const existingFile = await findFileInFolder(token, fileName, parentFolderId);
  const boundary = '-------314159265358979323846';

  if (existingFile) {
    const updateUrl = `${DRIVE_UPLOAD_URL}/${existingFile.id}?uploadType=media`;
    const response = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/pdf',
      },
      body: pdfBlob,
    });

    if (!response.ok) {
      throw new Error(`Error al actualizar nómina PDF en Google Drive`);
    }
    return response.json();
  }

  const metadata = {
    name: fileName,
    mimeType: 'application/pdf',
    parents: [parentFolderId],
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', pdfBlob);

  const response = await fetch(`${DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,name,webViewLink,modifiedTime`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  if (!response.ok) {
    throw new Error('Error al subir el archivo PDF de la nómina a Google Drive');
  }

  return response.json();
}

/**
 * Lists all archived nóminas and files in the Nóminas subfolder.
 */
export async function listArchivedFilesInNominas(
  token: string,
  nominasFolderId: string
): Promise<DriveFileInfo[]> {
  const query = `'${nominasFolderId}' in parents and trashed = false`;
  const url = `${DRIVE_API_URL}?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,modifiedTime,size,webViewLink)&orderBy=modifiedTime desc`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    console.error('Error listando nóminas en Drive:', response.statusText);
    return [];
  }

  const data = await response.json();
  return data.files || [];
}
