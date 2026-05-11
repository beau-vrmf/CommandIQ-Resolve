import { openDB, type IDBPDatabase } from 'idb'
import type { ActiveSession } from '../store/session'

const DB_NAME = 'ext-power-trainer'
const DB_VERSION = 1

type DB = IDBPDatabase<unknown>

let dbPromise: Promise<DB> | null = null
function getDB(): Promise<DB> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('photos')) {
          db.createObjectStore('photos')
        }
      },
    })
  }
  return dbPromise
}

export async function archiveSession(session: ActiveSession): Promise<void> {
  const db = await getDB()
  await db.put('sessions', session)
}

export async function listSessions(): Promise<ActiveSession[]> {
  const db = await getDB()
  const all = (await db.getAll('sessions')) as ActiveSession[]
  return all.sort((a, b) => b.startedAt - a.startedAt)
}

export async function savePhoto(blob: Blob): Promise<string> {
  const id = crypto.randomUUID()
  const db = await getDB()
  await db.put('photos', blob, id)
  return id
}

export async function getPhoto(id: string): Promise<Blob | undefined> {
  const db = await getDB()
  return (await db.get('photos', id)) as Blob | undefined
}
