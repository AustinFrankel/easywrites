import Dexie, { type Table } from 'dexie'
import type { Doc } from './types'

export class EasyWritesDB extends Dexie {
  docs!: Table<Doc, string>

  constructor() {
    super('easywrites')
    this.version(1).stores({
      docs: 'id, updatedAt, createdAt',
    })
  }
}

export const db = new EasyWritesDB()

