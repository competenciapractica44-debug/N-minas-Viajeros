/**
 * Google Drive REST API integration for Direxis / Nóminas synchronization.
 * Manages the driver's private folder hierarchy and file synchronization.
 */

export interface DriveFolderInfo {
  direxisFolderId: string;
  nominasFolderId: string;
  direxisWebViewLink?: string;
  nominasWebViewLink?: string;
}

export interface DriveFileInfo {
  id: string;
  name: string;
  mimeType?: string;
  modifiedTime?: string;
  size?: string;
  parents?: string[];
  webViewLink?: string;
}

const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';

const BACKUP_FILE_NAMES = new Set([
  'turnos_base.json',
  'chofer_config.json',
  'convenio_2026.json',
  'cuadrante_asignaciones.json',
  'catalogo_extras.json',
]);

/**
 * Searches for a folder by name inside a specific parent folder (defaults to 'root').
 */
export async function findFolder(
  token: string,
  folderName: string,
  parentFolderId = 'root'
): Promise<DriveFileInfo | null> {
  const safeName = folderName.replace(/'/g, "\\'");
  const query = `mimeType = 'application/vnd.google-apps.folder' and name = '${safeName}' and '${parentFolderId}' in parents and trashed = false`;

  const url = `${DRIVE_API_URL}?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,parents,modifiedTime,webViewLink)&pageSize=5`;
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
 * Creates a new folder in Google Drive inside parentFolderId (defaults to 'root').
 */
export async function createFolder(
  token: string,
  folderName: string,
  parentFolderId = 'root'
): Promise<DriveFileInfo> {
  const metadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentFolderId],
  };

  const response = await fetch(`${DRIVE_API_URL}?fields=id,name,mimeType,parents,webViewLink`, {
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
 * Moves a file into targetFolderId and removes it from currentParents.
 */
async function moveFileToFolder(
  token: string,
  fileId: string,
  targetFolderId: string,
  previousParents: string[] = []
): Promise<void> {
  const params = new URLSearchParams({
    addParents: targetFolderId,
    fields: 'id,parents',
  });
  if (previousParents.length > 0) {
    params.set('removeParents', previousParents.join(','));
  }

  const response = await fetch(`${DRIVE_API_URL}/${fileId}?${params.toString()}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    console.warn('No se pudo mover archivo a la carpeta Nóminas:', response.statusText);
  }
}

/**
 * Moves any stray app backup or payroll files created in 'root' or directly in 'Direxis'
 * into the 'Direxis / Nóminas' subfolder.
 */
async function relocateStrayBackupFiles(
  token: string,
  direxisFolderId: string,
  nominasFolderId: string
): Promise<void> {
  try {
    const parentsToScan = ['root', direxisFolderId];
    for (const parentId of parentsToScan) {
      const query = `'${parentId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`;
      const url = `${DRIVE_API_URL}?q=${encodeURIComponent(query)}&fields=files(id,name,parents)&pageSize=50`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
      if (!response.ok) continue;
      const data = await response.json();
      const files: DriveFileInfo[] = data.files || [];

      for (const f of files) {
        const isAppBackup =
          BACKUP_FILE_NAMES.has(f.name) ||
          f.name.startsWith('Nomina_');
        if (isAppBackup && !(f.parents || []).includes(nominasFolderId)) {
          await moveFileToFolder(token, f.id, nominasFolderId, f.parents || [parentId]);
        }
      }
    }
  } catch (err) {
    console.warn('Error reubicando archivos sueltos a Direxis/Nóminas:', err);
  }
}

/**
 * Ensures the required folder hierarchy in My Drive root:
 * "Direxis" -> "Nóminas"
 * Also relocates any stray app backup files into "Direxis / Nóminas".
 */
export async function ensureDirexisHierarchy(token: string): Promise<DriveFolderInfo> {
  // 1. Check or create 'Direxis' folder in My Drive root
  let direxisFolder = await findFolder(token, 'Direxis', 'root');
  if (!direxisFolder) {
    direxisFolder = await createFolder(token, 'Direxis', 'root');
  }

  // 2. Check or create 'Nóminas' folder inside 'Direxis' (also match 'Nominas' or 'nominas' if created before)
  let nominasFolder =
    (await findFolder(token, 'Nóminas', direxisFolder.id)) ||
    (await findFolder(token, 'Nominas', direxisFolder.id)) ||
    (await findFolder(token, 'nominas', direxisFolder.id));

  if (!nominasFolder) {
    nominasFolder = await createFolder(token, 'Nóminas', direxisFolder.id);
  }

  // 3. Ensure any previously saved loose backup files are moved into 'Direxis / Nóminas'
  await relocateStrayBackupFiles(token, direxisFolder.id, nominasFolder.id);

  return {
    direxisFolderId: direxisFolder.id,
    nominasFolderId: nominasFolder.id,
    direxisWebViewLink: direxisFolder.webViewLink || `https://drive.google.com/drive/folders/${direxisFolder.id}`,
    nominasWebViewLink: nominasFolder.webViewLink || `https://drive.google.com/drive/folders/${nominasFolder.id}`,
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
  const safeName = fileName.replace(/'/g, "\\'");
  const query = `'${parentFolderId}' in parents and name = '${safeName}' and trashed = false`;
  const url = `${DRIVE_API_URL}?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,parents,modifiedTime,size,webViewLink)&pageSize=1`;

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
 * Saves or updates a JSON file strictly inside parentFolderId in Google Drive.
 */
export async function saveOrUpdateDriveJsonFile<T>(
  token: string,
  parentFolderId: string,
  fileName: string,
  data: T
): Promise<DriveFileInfo> {
  if (!parentFolderId) {
    throw new Error(`Falta la carpeta de destino en Google Drive para guardar "${fileName}".`);
  }

  const contentStr = JSON.stringify(data, null, 2);
  const existingFile = await findFileInFolder(token, fileName, parentFolderId);

  if (existingFile) {
    const updateUrl = `${DRIVE_UPLOAD_URL}/${existingFile.id}?uploadType=media&fields=id,name,parents,modifiedTime,webViewLink`;
    const response = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
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
    const metadata = {
      name: fileName,
      mimeType: 'application/json',
      parents: [parentFolderId],
    };

    const form = new FormData();
    form.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json; charset=UTF-8' })
    );
    form.append(
      'file',
      new Blob([contentStr], { type: 'application/json; charset=UTF-8' })
    );

    const response = await fetch(`${DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,name,parents,modifiedTime,webViewLink`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
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
  if (!parentFolderId) {
    throw new Error(`Falta la carpeta de destino en Google Drive para guardar "${fileName}".`);
  }

  const existingFile = await findFileInFolder(token, fileName, parentFolderId);

  if (existingFile) {
    const updateUrl = `${DRIVE_UPLOAD_URL}/${existingFile.id}?uploadType=media&fields=id,name,parents,modifiedTime,webViewLink`;
    const response = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/pdf',
      },
      body: pdfBlob,
    });

    if (!response.ok) {
      throw new Error('Error al actualizar nómina PDF en Google Drive');
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
    new Blob([JSON.stringify(metadata)], { type: 'application/json; charset=UTF-8' })
  );
  form.append('file', pdfBlob);

  const response = await fetch(`${DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,name,parents,webViewLink,modifiedTime`, {
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
  const url = `${DRIVE_API_URL}?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,parents,modifiedTime,size,webViewLink)&orderBy=modifiedTime desc`;

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
