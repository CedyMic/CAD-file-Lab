import {
  openDB,
  type DBSchema,
  type IDBPDatabase,
} from 'idb'

import type {
  SerializedCadProject,
} from '../cad/cadClient'

import type {
  DisplaySettings,
} from '../viewer/displaySettings'

export interface CadRecoveryRecord {
  id: string
  project: SerializedCadProject
  displaySettings: DisplaySettings
  createdAt: number
  updatedAt: number
}

interface CadRecoveryDatabase
  extends DBSchema {
  recoveries: {
    key: string
    value: CadRecoveryRecord
    indexes: {
      'by-updated-at': number
    }
  }
}

const DATABASE_NAME =
  'cad-file-labs'

const DATABASE_VERSION = 1

const RECOVERY_STORE =
  'recoveries'

const MAX_RECOVERY_PROJECTS = 10

let databasePromise:
  Promise<
    IDBPDatabase<CadRecoveryDatabase>
  > | null = null

function getDatabase():
  Promise<
    IDBPDatabase<CadRecoveryDatabase>
  > {
  if (!databasePromise) {
    databasePromise = openDB<
      CadRecoveryDatabase
    >(
      DATABASE_NAME,
      DATABASE_VERSION,
      {
        upgrade(database) {
          if (
            database.objectStoreNames
              .contains(RECOVERY_STORE)
          ) {
            return
          }

          const store =
            database.createObjectStore(
              RECOVERY_STORE,
              {
                keyPath: 'id',
              },
            )

          store.createIndex(
            'by-updated-at',
            'updatedAt',
          )
        },
      },
    )
  }

  return databasePromise
}

export async function requestPersistentStorage():
  Promise<boolean> {
  if (!navigator.storage) {
    return false
  }

  try {
    if (
      navigator.storage.persisted &&
      await navigator.storage.persisted()
    ) {
      return true
    }

    if (!navigator.storage.persist) {
      return false
    }

    return navigator.storage.persist()
  } catch {
    return false
  }
}

export async function saveRecovery(
  project: SerializedCadProject,
  displaySettings: DisplaySettings,
): Promise<CadRecoveryRecord> {
  const database =
    await getDatabase()

  const existing =
    await database.get(
      RECOVERY_STORE,
      project.bodyId,
    )

  const now = Date.now()

  const record: CadRecoveryRecord = {
    id: project.bodyId,
    project: {
      ...project,
      savedAt: now,
    },
    displaySettings: {
      ...displaySettings,
    },
    createdAt:
      existing?.createdAt ?? now,
    updatedAt: now,
  }

  await database.put(
    RECOVERY_STORE,
    record,
  )

  await pruneOldRecoveries(
    MAX_RECOVERY_PROJECTS,
  )

  return record
}

export async function getRecovery(
  recoveryId: string,
): Promise<
  CadRecoveryRecord | undefined
> {
  const database =
    await getDatabase()

  return database.get(
    RECOVERY_STORE,
    recoveryId,
  )
}

export async function listRecoveries():
  Promise<CadRecoveryRecord[]> {
  const database =
    await getDatabase()

  const records =
    await database.getAllFromIndex(
      RECOVERY_STORE,
      'by-updated-at',
    )

  return records.sort(
    (first, second) =>
      second.updatedAt -
      first.updatedAt,
  )
}

export async function getLatestRecovery():
  Promise<
    CadRecoveryRecord | undefined
  > {
  const recoveries =
    await listRecoveries()

  return recoveries[0]
}

export async function deleteRecovery(
  recoveryId: string,
): Promise<void> {
  const database =
    await getDatabase()

  await database.delete(
    RECOVERY_STORE,
    recoveryId,
  )
}

export async function clearRecoveries():
  Promise<void> {
  const database =
    await getDatabase()

  await database.clear(
    RECOVERY_STORE,
  )
}

async function pruneOldRecoveries(
  maximumProjects: number,
): Promise<void> {
  const database =
    await getDatabase()

  const recoveries =
    await database.getAllFromIndex(
      RECOVERY_STORE,
      'by-updated-at',
    )

  const oldestFirst =
    recoveries.sort(
      (first, second) =>
        first.updatedAt -
        second.updatedAt,
    )

  const excessCount =
    Math.max(
      0,
      oldestFirst.length -
        maximumProjects,
    )

  if (excessCount === 0) {
    return
  }

  const transaction =
    database.transaction(
      RECOVERY_STORE,
      'readwrite',
    )

  for (
    const recovery
    of oldestFirst.slice(
      0,
      excessCount,
    )
  ) {
    await transaction.store.delete(
      recovery.id,
    )
  }

  await transaction.done
}
