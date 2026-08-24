/**
 * Minimal IndexedDB key-value store. Two object stores: whole character
 * documents, and the append-only change journal keyed by `${characterId}:${at}`.
 */
const DB_NAME = 'character-sheet'
const DB_VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('characters')) db.createObjectStore('characters')
      if (!db.objectStoreNames.contains('changes')) {
        const store = db.createObjectStore('changes', { keyPath: 'id' })
        store.createIndex('byCharacter', 'characterId')
      }
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode)
        const req = fn(t.objectStore(store))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

export const dbGet = <T>(store: string, key: string) => tx<T>(store, 'readonly', (s) => s.get(key) as IDBRequest<T>)
export const dbPut = (store: string, value: unknown, key?: string) =>
  tx(store, 'readwrite', (s) => (key === undefined ? s.put(value) : s.put(value, key)))
export const dbDelete = (store: string, key: string) => tx(store, 'readwrite', (s) => s.delete(key))
export const dbAll = <T>(store: string) => tx<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>)
export const dbKeys = (store: string) => tx<IDBValidKey[]>(store, 'readonly', (s) => s.getAllKeys())

export async function dbChangesFor<T>(characterId: string): Promise<T[]> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const t = db.transaction('changes', 'readonly')
    const idx = t.objectStore('changes').index('byCharacter')
    const req = idx.getAll(characterId)
    req.onsuccess = () => resolve(req.result as T[])
    req.onerror = () => reject(req.error)
  })
}
