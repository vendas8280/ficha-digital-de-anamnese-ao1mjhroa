import { describe, it, expect } from 'vitest'
import { computeCrc32, createZipBlob } from './zipWriter'

describe('zipWriter', () => {
  it('computes correct CRC32 for known strings', () => {
    const textEncoder = new TextEncoder()
    const check123456789 = computeCrc32(textEncoder.encode('123456789'))
    // Known standard CRC32 for '123456789' is 0xcbf43926 (3421760262)
    expect(check123456789).toBe(0xcbf43926 >>> 0)
  })

  it('creates a valid zip blob with files', async () => {
    const blob = createZipBlob([
      { name: 'teste.txt', data: 'Ola mundo!' },
      { name: 'dados.csv', data: 'col1,col2\nval1,val2' },
    ])

    expect(blob.type).toBe('application/zip')
    expect(blob.size).toBeGreaterThan(100)

    const buffer = await blob.arrayBuffer()
    const bytes = new Uint8Array(buffer)

    // Check PK\x03\x04 signature at start
    expect(bytes[0]).toBe(0x50)
    expect(bytes[1]).toBe(0x4b)
    expect(bytes[2]).toBe(0x03)
    expect(bytes[3]).toBe(0x04)
  })
})
