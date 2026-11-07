// Gerador binário puro de arquivos .zip (PKZip format) sem dependências externas.
// Utiliza o método Stored (sem compressão - Compression Method 0x00), 100% suportado por
// todos os utilitários de descompactação (Windows Explorer, macOS Finder, Linux unzip, WinRAR, 7-Zip).

export interface ZipFileEntry {
  name: string
  data: Uint8Array | string
  date?: Date
}

// Tabela estática CRC32
let crc32Table: Uint32Array | null = null

function getCrc32Table(): Uint32Array {
  if (crc32Table) return crc32Table
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[i] = c >>> 0
  }
  crc32Table = table
  return table
}

export function computeCrc32(data: Uint8Array): number {
  const table = getCrc32Table()
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function dateToDosTimeAndDate(date: Date): { dosTime: number; dosDate: number } {
  const d = date || new Date()
  const year = d.getFullYear()
  const month = d.getMonth() + 1
  const day = d.getDate()
  const hours = d.getHours()
  const minutes = d.getMinutes()
  const seconds = d.getSeconds()

  const dosDate =
    (((Math.max(1980, year) - 1980) & 0x7f) << 9) | ((month & 0x0f) << 5) | (day & 0x1f)
  const dosTime = ((hours & 0x1f) << 11) | ((minutes & 0x3f) << 5) | ((seconds >> 1) & 0x1f)

  return { dosTime, dosDate }
}

const textEncoder = new TextEncoder()

function stringToBytes(str: string): Uint8Array {
  return textEncoder.encode(str)
}

/**
 * Cria um arquivo .zip contendo os arquivos passados.
 * Retorna um Blob do tipo 'application/zip'.
 */
export function createZipBlob(entries: ZipFileEntry[]): Blob {
  const parts: Uint8Array[] = []
  let offset = 0

  interface CentralDirEntry {
    nameBytes: Uint8Array
    crc: number
    size: number
    dosTime: number
    dosDate: number
    localHeaderOffset: number
  }

  const centralEntries: CentralDirEntry[] = []

  for (const entry of entries) {
    const rawData = typeof entry.data === 'string' ? stringToBytes(entry.data) : entry.data
    const nameBytes = stringToBytes(entry.name.replace(/\\/g, '/'))
    const crc = computeCrc32(rawData)
    const size = rawData.length
    const { dosTime, dosDate } = dateToDosTimeAndDate(entry.date || new Date())

    const localHeaderOffset = offset

    // Local file header: 30 bytes + name length
    const localHeader = new Uint8Array(30 + nameBytes.length)
    const view = new DataView(localHeader.buffer)

    // Signature 0x04034b50 (PK\x03\x04)
    view.setUint32(0, 0x04034b50, true)
    // Version needed to extract: 20 (2.0)
    view.setUint16(4, 20, true)
    // General purpose bit flag: 0x0800 (Bit 11: Language encoding flag / UTF-8)
    view.setUint16(6, 0x0800, true)
    // Compression method: 0 (Stored)
    view.setUint16(8, 0, true)
    // Last mod time
    view.setUint16(10, dosTime, true)
    // Last mod date
    view.setUint16(12, dosDate, true)
    // CRC-32
    view.setUint32(14, crc, true)
    // Compressed size
    view.setUint32(18, size, true)
    // Uncompressed size
    view.setUint32(22, size, true)
    // File name length
    view.setUint16(26, nameBytes.length, true)
    // Extra field length
    view.setUint16(28, 0, true)

    localHeader.set(nameBytes, 30)

    parts.push(localHeader)
    parts.push(rawData)

    offset += localHeader.length + rawData.length

    centralEntries.push({
      nameBytes,
      crc,
      size,
      dosTime,
      dosDate,
      localHeaderOffset,
    })
  }

  const centralDirStartOffset = offset

  for (const cd of centralEntries) {
    // Central directory file header: 46 bytes + name length
    const cdHeader = new Uint8Array(46 + cd.nameBytes.length)
    const view = new DataView(cdHeader.buffer)

    // Signature 0x02014b50 (PK\x01\x02)
    view.setUint32(0, 0x02014b50, true)
    // Version made by: 20 (2.0) / upper byte 0 (MS-DOS/FAT)
    view.setUint16(4, 20, true)
    // Version needed to extract: 20
    view.setUint16(6, 20, true)
    // Bit flag: UTF-8
    view.setUint16(8, 0x0800, true)
    // Compression method: 0
    view.setUint16(10, 0, true)
    // Dos time
    view.setUint16(12, cd.dosTime, true)
    // Dos date
    view.setUint16(14, cd.dosDate, true)
    // CRC-32
    view.setUint32(16, cd.crc, true)
    // Compressed size
    view.setUint32(20, cd.size, true)
    // Uncompressed size
    view.setUint32(24, cd.size, true)
    // File name length
    view.setUint16(28, cd.nameBytes.length, true)
    // Extra field length
    view.setUint16(30, 0, true)
    // File comment length
    view.setUint16(32, 0, true)
    // Disk number start
    view.setUint16(34, 0, true)
    // Internal file attributes
    view.setUint16(36, 0, true)
    // External file attributes
    view.setUint32(38, 0, true)
    // Relative offset of local header
    view.setUint32(42, cd.localHeaderOffset, true)

    cdHeader.set(cd.nameBytes, 46)

    parts.push(cdHeader)
    offset += cdHeader.length
  }

  const centralDirSize = offset - centralDirStartOffset

  // End of central directory record: 22 bytes
  const eocd = new Uint8Array(22)
  const eocdView = new DataView(eocd.buffer)

  // Signature 0x06054b50 (PK\x05\x06)
  eocdView.setUint32(0, 0x06054b50, true)
  // Number of this disk: 0
  eocdView.setUint16(4, 0, true)
  // Disk where central directory starts: 0
  eocdView.setUint16(6, 0, true)
  // Number of central directory records on this disk
  eocdView.setUint16(8, centralEntries.length, true)
  // Total number of central directory records
  eocdView.setUint16(10, centralEntries.length, true)
  // Size of central directory
  eocdView.setUint32(12, centralDirSize, true)
  // Offset of start of central directory
  eocdView.setUint32(16, centralDirStartOffset, true)
  // Comment length: 0
  eocdView.setUint16(20, 0, true)

  parts.push(eocd)

  return new Blob(parts as unknown as BlobPart[], { type: 'application/zip' })
}
