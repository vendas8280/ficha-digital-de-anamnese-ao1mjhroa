// pocketbase/hooks/pdf_generator.js
// Utilitários de geração de PDF e envio de e-mail para PocketBase JSVM (Goja)

var B64_MAP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
var B64_REV = {}
for (var _i = 0; _i < B64_MAP.length; _i++) {
  B64_REV[B64_MAP.charAt(_i)] = _i
}

function b64ToBytes(b64Str) {
  var clean = String(b64Str).replace(/[^A-Za-z0-9+/=]/g, '')
  var bytes = []
  var len = clean.length
  for (var i = 0; i < len; i += 4) {
    var c0 = B64_REV[clean.charAt(i)] || 0
    var c1 = B64_REV[clean.charAt(i + 1)] || 0
    var c2 = B64_REV[clean.charAt(i + 2)] || 0
    var c3 = B64_REV[clean.charAt(i + 3)] || 0

    var b0 = (c0 << 2) | (c1 >> 4)
    bytes.push(b0)
    if (clean.charAt(i + 2) !== '=') {
      var b1 = ((c1 & 15) << 4) | (c2 >> 2)
      bytes.push(b1)
    }
    if (clean.charAt(i + 3) !== '=') {
      var b2 = ((c2 & 3) << 6) | c3
      bytes.push(b2)
    }
  }
  return bytes
}

function bytesToB64(bytes) {
  var result = ''
  var len = bytes.length
  var i = 0
  while (i < len) {
    var b0 = bytes[i++]
    var b1 = i < len ? bytes[i++] : NaN
    var b2 = i < len ? bytes[i++] : NaN

    var c0 = b0 >> 2
    var c1 = ((b0 & 3) << 4) | (isNaN(b1) ? 0 : b1 >> 4)
    var c2 = isNaN(b1) ? 64 : ((b1 & 15) << 2) | (isNaN(b2) ? 0 : b2 >> 6)
    var c3 = isNaN(b2) ? 64 : b2 & 63

    result +=
      B64_MAP.charAt(c0) +
      B64_MAP.charAt(c1) +
      (c2 === 64 ? '=' : B64_MAP.charAt(c2)) +
      (c3 === 64 ? '=' : B64_MAP.charAt(c3))
  }
  return result
}

function strToLatinBytes(str) {
  var bytes = []
  for (var i = 0; i < str.length; i++) {
    var code = str.charCodeAt(i)
    if (code > 255) {
      if (code === 8212 || code === 8211) code = 45
      else if (code === 8220 || code === 8221) code = 34
      else if (code === 8216 || code === 8217) code = 39
      else if (code === 8222) code = 34
      else if (code === 8230) code = 46
      else if (code === 8226) code = 149
      else code = 63
    }
    bytes.push(code & 0xff)
  }
  return bytes
}

function latinBytesToStr(bytes) {
  var result = ''
  var chunkSize = 8192
  for (var i = 0; i < bytes.length; i += chunkSize) {
    var chunk = bytes.slice(i, i + chunkSize)
    result += String.fromCharCode.apply(null, chunk)
  }
  return result
}

function escapePdfText(str) {
  if (!str) return ''
  var s = String(str)
  var res = ''
  for (var i = 0; i < s.length; i++) {
    var ch = s.charAt(i)
    if (ch === '\\' || ch === '(' || ch === ')') {
      res += '\\' + ch
    } else if (ch === '\r' || ch === '\n' || ch === '\t') {
      res += ' '
    } else {
      res += ch
    }
  }
  return res
}

// Deflate / Inflate
var TINF_OK = 0
var TINF_DATA_ERROR = -3

function TinfTree() {
  this.table = new Uint16Array(16)
  this.trans = new Uint16Array(288)
}

function TinfData(source, dest) {
  this.source = source
  this.sourceIndex = 0
  this.tag = 0
  this.bitcount = 0
  this.dest = dest
  this.destLen = 0
  this.ltree = new TinfTree()
  this.dtree = new TinfTree()
}

var tinf_sltree = new TinfTree()
var tinf_sdtree = new TinfTree()
var tinf_length_bits = new Uint8Array(30)
var tinf_length_base = new Uint16Array(30)
var tinf_dist_bits = new Uint8Array(30)
var tinf_dist_base = new Uint16Array(30)
var tinf_clcidx = new Uint8Array([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15])
var tinf_code_tree = new TinfTree()
var tinf_lengths = new Uint8Array(288 + 32)
var tinf_offs = new Uint16Array(16)

function tinf_build_bits_base(bits, base, delta, first) {
  var i, sum
  for (i = 0; i < delta; ++i) bits[i] = 0
  for (i = 0; i < 30 - delta; ++i) bits[i + delta] = (i / delta) | 0
  for (sum = first, i = 0; i < 30; ++i) {
    base[i] = sum
    sum += 1 << bits[i]
  }
}

function tinf_build_fixed_trees(lt, dt) {
  var i
  for (i = 0; i < 7; ++i) lt.table[i] = 0
  lt.table[7] = 24
  lt.table[8] = 152
  lt.table[9] = 112
  for (i = 0; i < 24; ++i) lt.trans[i] = 256 + i
  for (i = 0; i < 144; ++i) lt.trans[24 + i] = i
  for (i = 0; i < 8; ++i) lt.trans[24 + 144 + i] = 280 + i
  for (i = 0; i < 112; ++i) lt.trans[24 + 144 + 8 + i] = 144 + i
  for (i = 0; i < 5; ++i) dt.table[i] = 0
  dt.table[5] = 32
  for (i = 0; i < 32; ++i) dt.trans[i] = i
}

function tinf_build_tree(t, lengths, off, num) {
  var i, sum
  for (i = 0; i < 16; ++i) t.table[i] = 0
  for (i = 0; i < num; ++i) t.table[lengths[off + i]]++
  t.table[0] = 0
  for (sum = 0, i = 0; i < 16; ++i) {
    tinf_offs[i] = sum
    sum += t.table[i]
  }
  for (i = 0; i < num; ++i) {
    if (lengths[off + i]) t.trans[tinf_offs[lengths[off + i]]++] = i
  }
}

function tinf_getbit(d) {
  if (!d.bitcount--) {
    d.tag = d.source[d.sourceIndex++]
    d.bitcount = 7
  }
  var bit = d.tag & 1
  d.tag >>>= 1
  return bit
}

function tinf_read_bits(d, num, base) {
  if (!num) return base
  while (d.bitcount < 24) {
    d.tag |= d.source[d.sourceIndex++] << d.bitcount
    d.bitcount += 8
  }
  var val = d.tag & (0xffff >>> (16 - num))
  d.tag >>>= num
  d.bitcount -= num
  return val + base
}

function tinf_decode_symbol(d, t) {
  while (d.bitcount < 24) {
    d.tag |= d.source[d.sourceIndex++] << d.bitcount
    d.bitcount += 8
  }
  var sum = 0,
    cur = 0,
    len = 0
  var tag = d.tag
  do {
    cur = 2 * cur + (tag & 1)
    tag >>>= 1
    ++len
    sum += t.table[len]
    cur -= t.table[len]
  } while (cur >= 0)
  d.tag = tag
  d.bitcount -= len
  return t.trans[sum + cur]
}

function tinf_decode_trees(d, lt, dt) {
  var hlit, hdist, hclen, i, num, length
  hlit = tinf_read_bits(d, 5, 257)
  hdist = tinf_read_bits(d, 5, 1)
  hclen = tinf_read_bits(d, 4, 4)
  for (i = 0; i < 19; ++i) tinf_lengths[i] = 0
  for (i = 0; i < hclen; ++i) {
    tinf_lengths[tinf_clcidx[i]] = tinf_read_bits(d, 3, 0)
  }
  tinf_build_tree(tinf_code_tree, tinf_lengths, 0, 19)
  for (num = 0; num < hlit + hdist; ) {
    var sym = tinf_decode_symbol(d, tinf_code_tree)
    switch (sym) {
      case 16:
        var prev = tinf_lengths[num - 1]
        for (length = tinf_read_bits(d, 2, 3); length; --length) {
          tinf_lengths[num++] = prev
        }
        break
      case 17:
        for (length = tinf_read_bits(d, 3, 3); length; --length) {
          tinf_lengths[num++] = 0
        }
        break
      case 18:
        for (length = tinf_read_bits(d, 7, 11); length; --length) {
          tinf_lengths[num++] = 0
        }
        break
      default:
        tinf_lengths[num++] = sym
        break
    }
  }
  tinf_build_tree(lt, tinf_lengths, 0, hlit)
  tinf_build_tree(dt, tinf_lengths, hlit, hdist)
}

function tinf_inflate_block_data(d, lt, dt) {
  while (1) {
    var sym = tinf_decode_symbol(d, lt)
    if (sym === 256) return TINF_OK
    if (sym < 256) {
      d.dest[d.destLen++] = sym
    } else {
      var length, dist, offs, i
      sym -= 257
      length = tinf_read_bits(d, tinf_length_bits[sym], tinf_length_base[sym])
      dist = tinf_decode_symbol(d, dt)
      offs = d.destLen - tinf_read_bits(d, tinf_dist_bits[dist], tinf_dist_base[dist])
      for (i = offs; i < offs + length; ++i) {
        d.dest[d.destLen++] = d.dest[i]
      }
    }
  }
}

function tinf_inflate_uncompressed_block(d) {
  var length, invlength, i
  while (d.bitcount > 8) {
    d.sourceIndex--
    d.bitcount -= 8
  }
  length = d.source[d.sourceIndex + 1] * 256 + d.source[d.sourceIndex]
  invlength = d.source[d.sourceIndex + 3] * 256 + d.source[d.sourceIndex + 2]
  if (length !== (~invlength & 0x0000ffff)) return TINF_DATA_ERROR
  d.sourceIndex += 4
  for (i = length; i; --i) d.dest[d.destLen++] = d.source[d.sourceIndex++]
  d.bitcount = 0
  return TINF_OK
}

function tinf_uncompress(source, dest) {
  var d = new TinfData(source, dest)
  var bfinal, btype, res
  do {
    bfinal = tinf_getbit(d)
    btype = tinf_read_bits(d, 2, 0)
    switch (btype) {
      case 0:
        res = tinf_inflate_uncompressed_block(d)
        break
      case 1:
        res = tinf_inflate_block_data(d, tinf_sltree, tinf_sdtree)
        break
      case 2:
        tinf_decode_trees(d, d.ltree, d.dtree)
        res = tinf_inflate_block_data(d, d.ltree, d.dtree)
        break
      default:
        res = TINF_DATA_ERROR
    }
    if (res !== TINF_OK) throw new Error('Tinf inflate error')
  } while (!bfinal)
  return d.dest
}

tinf_build_fixed_trees(tinf_sltree, tinf_sdtree)
tinf_build_bits_base(tinf_length_bits, tinf_length_base, 4, 3)
tinf_build_bits_base(tinf_dist_bits, tinf_dist_base, 2, 1)
tinf_length_bits[28] = 0
tinf_length_base[28] = 258

function inflateZlib(zlibBytes, outSize) {
  var deflated = zlibBytes.subarray ? zlibBytes.subarray(2) : zlibBytes.slice(2)
  var dest = new Uint8Array(outSize)
  tinf_uncompress(deflated, dest)
  return dest
}

function extractSignaturePng(dataUrl) {
  try {
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,')) {
      return null
    }
    var b64 = dataUrl.split(',')[1]
    if (!b64) return null
    var pngBytes = b64ToBytes(b64)
    if (pngBytes.length < 33) return null

    if (
      pngBytes[0] !== 0x89 ||
      pngBytes[1] !== 0x50 ||
      pngBytes[2] !== 0x4e ||
      pngBytes[3] !== 0x47
    ) {
      return null
    }

    var pos = 8
    var width = 0
    var height = 0
    var bitDepth = 0
    var colorType = 0
    var idatParts = []

    while (pos < pngBytes.length) {
      var len =
        (pngBytes[pos] << 24) |
        (pngBytes[pos + 1] << 16) |
        (pngBytes[pos + 2] << 8) |
        pngBytes[pos + 3]
      var type = String.fromCharCode(
        pngBytes[pos + 4],
        pngBytes[pos + 5],
        pngBytes[pos + 6],
        pngBytes[pos + 7],
      )

      if (type === 'IHDR') {
        width =
          (pngBytes[pos + 8] << 24) |
          (pngBytes[pos + 9] << 16) |
          (pngBytes[pos + 10] << 8) |
          pngBytes[pos + 11]
        height =
          (pngBytes[pos + 12] << 24) |
          (pngBytes[pos + 13] << 16) |
          (pngBytes[pos + 14] << 8) |
          pngBytes[pos + 15]
        bitDepth = pngBytes[pos + 16]
        colorType = pngBytes[pos + 17]
      } else if (type === 'IDAT') {
        idatParts.push(pngBytes.slice(pos + 8, pos + 8 + len))
      } else if (type === 'IEND') {
        break
      }
      pos += 12 + len
    }

    if (width <= 0 || height <= 0 || idatParts.length === 0) return null

    var totalIdatLen = 0
    for (var j = 0; j < idatParts.length; j++) totalIdatLen += idatParts[j].length
    var allIdat = new Uint8Array(totalIdatLen)
    var off = 0
    for (var k = 0; k < idatParts.length; k++) {
      allIdat.set(idatParts[k], off)
      off += idatParts[k].length
    }

    var bytesPerPixel = colorType === 6 ? 4 : colorType === 2 ? 3 : 1
    var scanlineBytes = width * bytesPerPixel
    var expectedUncompressed = height * (1 + scanlineBytes)

    var decompressed = inflateZlib(allIdat, expectedUncompressed)

    var unfilter = new Uint8Array(height * scanlineBytes)
    var rOff = 0
    var wOff = 0

    function paeth(a, b, c) {
      var p = a + b - c
      var pa = Math.abs(p - a)
      var pb = Math.abs(p - b)
      var pc = Math.abs(p - c)
      if (pa <= pb && pa <= pc) return a
      if (pb <= pc) return b
      return c
    }

    for (var row = 0; row < height; row++) {
      var filterType = decompressed[rOff++]
      var prevRowStart = row > 0 ? (row - 1) * scanlineBytes : -1

      for (var col = 0; col < scanlineBytes; col++) {
        var raw = decompressed[rOff++]
        var left = col >= bytesPerPixel ? unfilter[wOff - bytesPerPixel] : 0
        var up = prevRowStart >= 0 ? unfilter[prevRowStart + col] : 0
        var upLeft =
          prevRowStart >= 0 && col >= bytesPerPixel
            ? unfilter[prevRowStart + col - bytesPerPixel]
            : 0

        var val = raw
        if (filterType === 1) {
          val = (raw + left) & 0xff
        } else if (filterType === 2) {
          val = (raw + up) & 0xff
        } else if (filterType === 3) {
          val = (raw + Math.floor((left + up) / 2)) & 0xff
        } else if (filterType === 4) {
          val = (raw + paeth(left, up, upLeft)) & 0xff
        }
        unfilter[wOff++] = val
      }
    }

    var rgbBytes = []
    if (colorType === 6) {
      for (var p = 0; p < unfilter.length; p += 4) {
        var r = unfilter[p]
        var g = unfilter[p + 1]
        var b = unfilter[p + 2]
        var a = unfilter[p + 3]
        if (a === 0) {
          rgbBytes.push(255, 255, 255)
        } else if (a === 255) {
          rgbBytes.push(r, g, b)
        } else {
          var alpha = a / 255
          var nr = Math.round(r * alpha + 255 * (1 - alpha))
          var ng = Math.round(g * alpha + 255 * (1 - alpha))
          var nb = Math.round(b * alpha + 255 * (1 - alpha))
          rgbBytes.push(nr, ng, nb)
        }
      }
    } else if (colorType === 2) {
      for (var p2 = 0; p2 < unfilter.length; p2++) rgbBytes.push(unfilter[p2])
    } else {
      for (var p3 = 0; p3 < unfilter.length; p3++) {
        var gray = unfilter[p3]
        rgbBytes.push(gray, gray, gray)
      }
    }

    return {
      width: width,
      height: height,
      rgbBytes: rgbBytes,
    }
  } catch (errSig) {
    console.log('Erro ao processar imagem da assinatura:', errSig)
    return null
  }
}

function generatePdf(rec, isPatientCopy, settings) {
  var pName = rec.getString('patient_name') || 'Não informado'
  var pCpf = rec.getString('patient_cpf') || 'Não informado'
  var pEmail = rec.getString('patient_email') || 'Não informado'
  var pPhone = rec.getString('patient_phone') || 'Não informado'
  var pBirth = rec.getString('patient_birth_date') || 'Não informado'
  var pAddress = rec.getString('patient_address') || 'Não informado'
  var pProf = rec.getString('patient_profession') || 'Não informado'
  var pEmerg = rec.getString('patient_emergency_contact') || 'Não informado'
  var fType = rec.getString('form_type')
  var sAt = rec.getString('signed_at') || rec.getString('created')
  var dHash = rec.getString('document_hash') || 'N/A'
  var ip = rec.getString('ip_address') || 'Não disponível'
  var ua = rec.getString('user_agent') || 'Não disponível'
  var tTitle = rec.getString('accepted_term_title') || 'Termo de Consentimento Livre e Esclarecido'
  var tText = rec.getString('accepted_term_text') || ''
  var sigData = rec.getString('signature_data') || ''

  var typeLabels = {
    geral: 'Anamnese Estética Geral',
    labios: 'Lábios & Micropigmentação Labial',
    botox: 'Toxina Botulínica (Botox)',
  }
  var pLabel = typeLabels[fType] || fType || 'Anamnese'

  var brDateStr = ''
  var brTimeStr = ''
  try {
    var d = sAt ? new Date(sAt) : new Date()
    var brMs = d.getTime() - 3 * 3600 * 1000
    var brDate = new Date(brMs)
    var pad = function (n) {
      return String(n).padStart(2, '0')
    }
    brDateStr =
      pad(brDate.getUTCDate()) + '/' + pad(brDate.getUTCMonth() + 1) + '/' + brDate.getUTCFullYear()
    brTimeStr =
      brDateStr +
      ' às ' +
      pad(brDate.getUTCHours()) +
      ':' +
      pad(brDate.getUTCMinutes()) +
      ' (horário de Brasília)'
  } catch (_) {
    brDateStr = '31/10/2026'
    brTimeStr = '31/10/2026 às 12:00 (horário de Brasília)'
  }

  var questionsList = []
  try {
    var rawAnswers = rec.getString('answers')
    if (rawAnswers) {
      var parsed = JSON.parse(rawAnswers)
      if (parsed && typeof parsed === 'object') {
        var keys = Object.keys(parsed)
        for (var ki = 0; ki < keys.length; ki++) {
          var k = keys[ki]
          var val = parsed[k]
          if (typeof val === 'boolean') val = val ? 'Sim' : 'Não'
          if (Array.isArray(val)) val = val.join(', ')
          var qLabel = k.replace(/_/g, ' ')
          qLabel = qLabel.charAt(0).toUpperCase() + qLabel.slice(1)
          questionsList.push({
            question: qLabel,
            answer: String(val || 'Não informado'),
          })
        }
      }
    }
  } catch (_) {}

  function wrapText(text, maxChars) {
    if (!text) return ['']
    var words = String(text).split(/\s+/)
    var lines = []
    var cur = ''
    for (var w = 0; w < words.length; w++) {
      var word = words[w]
      if (!cur) {
        cur = word
      } else if ((cur + ' ' + word).length <= maxChars) {
        cur += ' ' + word
      } else {
        lines.push(cur)
        cur = word
      }
    }
    if (cur) lines.push(cur)
    return lines.length > 0 ? lines : ['']
  }

  var MARGIN_LEFT = 54
  var MARGIN_RIGHT = 54
  var PAGE_WIDTH = 595
  var PAGE_HEIGHT = 842
  var CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT
  var TOP_START_Y = 750
  var BOTTOM_LIMIT_Y = 92

  var pages = []
  var curPageItems = []
  var curY = TOP_START_Y

  function newPage() {
    if (curPageItems.length > 0) {
      pages.push(curPageItems)
      curPageItems = []
    }
    curY = TOP_START_Y
  }

  function ensureSpace(neededHeight) {
    if (curY - neededHeight < BOTTOM_LIMIT_Y) {
      newPage()
    }
  }

  function addSectionHeader(title) {
    ensureSpace(34)
    curY -= 10
    curPageItems.push({
      type: 'sectionHeader',
      y: curY,
      title: title,
    })
    curY -= 20
  }

  // SEÇÃO 1: Dados do Paciente
  addSectionHeader('1. DADOS DO PACIENTE')

  var patientFields = [
    { label: 'Nome Completo', value: pName },
    { label: 'CPF', value: pCpf },
    { label: 'E-mail', value: pEmail },
    { label: 'Telefone', value: pPhone },
    { label: 'Data de Nascimento', value: pBirth },
    { label: 'Profissão', value: pProf },
    { label: 'Contato de Emergência', value: pEmerg },
    { label: 'Endereço', value: pAddress },
  ]

  for (var pi = 0; pi < patientFields.length; pi++) {
    var pf = patientFields[pi]
    var valLines = wrapText(pf.value, 46)
    var rowHeight = Math.max(18, valLines.length * 13 + 5)
    ensureSpace(rowHeight)

    curPageItems.push({
      type: 'tableRow',
      y: curY,
      height: rowHeight,
      col1: pf.label,
      col2Lines: valLines,
      isEven: pi % 2 === 1,
      col1Width: 150,
      col2Width: CONTENT_WIDTH - 150,
      col1Bold: true,
      col2Bold: false,
    })
    curY -= rowHeight
  }

  // SEÇÃO 2: Questionário de Saúde
  addSectionHeader('2. QUESTIONÁRIO DE SAÚDE E ANAMNESE')

  if (questionsList.length === 0) {
    ensureSpace(20)
    curPageItems.push({
      type: 'text',
      x: MARGIN_LEFT,
      y: curY - 12,
      text: 'Nenhuma resposta registrada (ficha pendente).',
      font: 'F1',
      size: 10,
      color: [0.4, 0.4, 0.4],
    })
    curY -= 22
  } else {
    for (var qi = 0; qi < questionsList.length; qi++) {
      var item = questionsList[qi]
      var qLines = wrapText(item.question, 28)
      var aLines = wrapText(item.answer, 44)
      var qRowHeight = Math.max(18, Math.max(qLines.length, aLines.length) * 13 + 5)
      ensureSpace(qRowHeight)

      curPageItems.push({
        type: 'tableRow',
        y: curY,
        height: qRowHeight,
        col1Lines: qLines,
        col2Lines: aLines,
        isEven: qi % 2 === 1,
        col1Width: 175,
        col2Width: CONTENT_WIDTH - 175,
        col1Bold: true,
        col2Bold: false,
      })
      curY -= qRowHeight
    }
  }

  // SEÇÃO 3: Termo de Consentimento
  addSectionHeader('3. TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO')

  ensureSpace(22)
  curPageItems.push({
    type: 'text',
    x: MARGIN_LEFT,
    y: curY - 12,
    text: tTitle,
    font: 'F2',
    size: 10.5,
    color: [0.51, 0.09, 0.26],
  })
  curY -= 20

  var rawParas = String(tText).split(/(?:\r?\n)+/)
  var clauseIndex = 1

  for (var tIdx = 0; tIdx < rawParas.length; tIdx++) {
    var rawP = rawParas[tIdx].trim()
    if (!rawP) continue

    var pText = rawP
    if (!/^\d+[\.\-\)]\s*/.test(pText)) {
      pText = clauseIndex + '. ' + pText
      clauseIndex++
    }

    var pLines = wrapText(pText, 78)
    var pHeight = pLines.length * 13 + 8
    ensureSpace(pHeight)

    curPageItems.push({
      type: 'paragraph',
      x: MARGIN_LEFT,
      y: curY,
      lines: pLines,
      lineHeight: 12.5,
      size: 9.5,
      color: [0.15, 0.15, 0.15],
    })
    curY -= pHeight
  }

  // SEÇÃO 4: Assinatura
  addSectionHeader('4. ASSINATURA ELETRÔNICA DO PACIENTE')

  var sigImageInfo = extractSignaturePng(sigData)
  var sigBoxHeight = 110
  ensureSpace(sigBoxHeight + 40)

  curPageItems.push({
    type: 'signatureBox',
    y: curY,
    height: sigBoxHeight,
    hasImage: sigImageInfo !== null,
    patientName: pName,
    dateTimeStr: brTimeStr,
  })
  curY -= sigBoxHeight + 42

  // SEÇÃO 5: Registro de Auditoria
  addSectionHeader('5. REGISTRO DE AUDITORIA E INTEGRIDADE DIGITAL')

  var auditFields = [
    { label: 'Data e Hora do Aceite', value: brTimeStr },
    { label: 'IP de Origem Real', value: ip },
    { label: 'Dispositivo / Navegador', value: ua },
    { label: 'Hash SHA-256 de Integridade', value: dHash, isSmallMono: true },
  ]

  for (var ai = 0; ai < auditFields.length; ai++) {
    var af = auditFields[ai]
    var aValLines = wrapText(af.value, af.isSmallMono ? 70 : 46)
    var aRowHeight = Math.max(18, aValLines.length * 13 + 5)
    ensureSpace(aRowHeight)

    curPageItems.push({
      type: 'tableRow',
      y: curY,
      height: aRowHeight,
      col1: af.label,
      col2Lines: aValLines,
      isEven: ai % 2 === 1,
      col1Width: 155,
      col2Width: CONTENT_WIDTH - 155,
      col1Bold: true,
      col2Bold: false,
      col2Small: af.isSmallMono,
    })
    curY -= aRowHeight
  }

  ensureSpace(24)
  curPageItems.push({
    type: 'text',
    x: MARGIN_LEFT,
    y: curY - 12,
    text: 'Código de verificação de integridade — garante que este documento não foi alterado após a assinatura.',
    font: 'F1',
    size: 8.5,
    color: [0.35, 0.35, 0.35],
  })
  curY -= 20

  if (curPageItems.length > 0) {
    pages.push(curPageItems)
  }

  var totalPages = pages.length
  if (totalPages === 0) {
    pages.push([])
    totalPages = 1
  }

  var nextObjId = 1
  var catalogId = nextObjId++
  var pagesId = nextObjId++
  var fontNormId = nextObjId++
  var fontBoldId = nextObjId++
  var fontMonoId = nextObjId++

  var imageXObjId = null
  if (sigImageInfo) {
    imageXObjId = nextObjId++
  }

  var pObjIds = []
  var cObjIds = []
  for (var p = 0; p < totalPages; p++) {
    pObjIds.push(nextObjId++)
    cObjIds.push(nextObjId++)
  }

  var objects = []

  objects.push({ id: catalogId, content: '<< /Type /Catalog /Pages ' + pagesId + ' 0 R >>' })

  var kids = pObjIds
    .map(function (id) {
      return id + ' 0 R'
    })
    .join(' ')
  objects.push({
    id: pagesId,
    content: '<< /Type /Pages /Kids [' + kids + '] /Count ' + totalPages + ' >>',
  })

  objects.push({
    id: fontNormId,
    content: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  })
  objects.push({
    id: fontBoldId,
    content:
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  })
  objects.push({
    id: fontMonoId,
    content: '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>',
  })

  if (sigImageInfo && imageXObjId) {
    var rawImgBytes = sigImageInfo.rgbBytes
    var imgStreamHeader =
      '<< /Type /XObject /Subtype /Image /Width ' +
      sigImageInfo.width +
      ' /Height ' +
      sigImageInfo.height +
      ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ' +
      rawImgBytes.length +
      ' >>\nstream\n'
    var fullImgRaw = strToLatinBytes(imgStreamHeader)
      .concat(rawImgBytes)
      .concat(strToLatinBytes('\nendstream'))
    objects.push({
      id: imageXObjId,
      rawBytes: fullImgRaw,
    })
  }

  for (var pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    var items = pages[pageIdx]
    var pageObjId = pObjIds[pageIdx]
    var contentObjId = cObjIds[pageIdx]

    var xObjRes = imageXObjId ? ' /XObject << /SigImg ' + imageXObjId + ' 0 R >>' : ''
    var resContent =
      '<< /Font << /F1 ' +
      fontNormId +
      ' 0 R /F2 ' +
      fontBoldId +
      ' 0 R /F3 ' +
      fontMonoId +
      ' 0 R >>' +
      xObjRes +
      ' >>'

    objects.push({
      id: pageObjId,
      content:
        '<< /Type /Page /Parent ' +
        pagesId +
        ' 0 R /MediaBox [0 0 ' +
        PAGE_WIDTH +
        ' ' +
        PAGE_HEIGHT +
        '] /Contents ' +
        contentObjId +
        ' 0 R /Resources ' +
        resContent +
        ' >>',
    })

    var ops = []

    function drawRect(x, y, w, h, fillCol, strokeCol, lineWidth) {
      ops.push('q')
      if (lineWidth) ops.push(lineWidth + ' w')
      if (fillCol) {
        ops.push(
          fillCol[0].toFixed(2) + ' ' + fillCol[1].toFixed(2) + ' ' + fillCol[2].toFixed(2) + ' rg',
        )
      }
      if (strokeCol) {
        ops.push(
          strokeCol[0].toFixed(2) +
            ' ' +
            strokeCol[1].toFixed(2) +
            ' ' +
            strokeCol[2].toFixed(2) +
            ' RG',
        )
      }
      ops.push(x.toFixed(2) + ' ' + y.toFixed(2) + ' ' + w.toFixed(2) + ' ' + h.toFixed(2) + ' re')
      if (fillCol && strokeCol) ops.push('B')
      else if (fillCol) ops.push('f')
      else if (strokeCol) ops.push('S')
      ops.push('Q')
    }

    function drawLine(x1, y1, x2, y2, strokeCol, lineWidth) {
      ops.push('q')
      ops.push((lineWidth || 0.75) + ' w')
      ops.push(
        strokeCol[0].toFixed(2) +
          ' ' +
          strokeCol[1].toFixed(2) +
          ' ' +
          strokeCol[2].toFixed(2) +
          ' RG',
      )
      ops.push(
        x1.toFixed(2) + ' ' + y1.toFixed(2) + ' m ' + x2.toFixed(2) + ' ' + y2.toFixed(2) + ' l S',
      )
      ops.push('Q')
    }

    function drawText(font, size, x, y, text, color) {
      var col = color || [0.1, 0.1, 0.1]
      ops.push('BT')
      ops.push('/' + font + ' ' + size + ' Tf')
      ops.push(col[0].toFixed(2) + ' ' + col[1].toFixed(2) + ' ' + col[2].toFixed(2) + ' rg')
      ops.push(x.toFixed(2) + ' ' + y.toFixed(2) + ' Td')
      ops.push('(' + escapePdfText(text) + ') Tj')
      ops.push('ET')
    }

    // Cabeçalho padronizado em todas as páginas
    drawText('F2', 12.5, MARGIN_LEFT, 804, 'ANDRESA SOUZA CLINIC', [0.51, 0.09, 0.26])
    drawText(
      'F1',
      9.5,
      MARGIN_LEFT,
      791,
      'Ficha de Anamnese e Termo de Consentimento Assinado',
      [0.3, 0.3, 0.3],
    )
    drawText('F1', 8.5, MARGIN_LEFT, 779, 'Procedimento: ' + pLabel, [0.45, 0.45, 0.45])

    var rightHeaderName = pName
    if (rightHeaderName.length > 28) rightHeaderName = rightHeaderName.substring(0, 26) + '...'
    drawText('F2', 9.5, 380, 804, 'Paciente: ' + rightHeaderName, [0.15, 0.15, 0.15])
    drawText('F1', 8.5, 380, 791, 'Data: ' + brDateStr, [0.4, 0.4, 0.4])
    drawText(
      'F1',
      8,
      380,
      779,
      isPatientCopy ? 'Via do Paciente' : 'Via da Clínica (Prontuário)',
      [0.51, 0.09, 0.26],
    )

    drawLine(MARGIN_LEFT, 772, PAGE_WIDTH - MARGIN_RIGHT, 772, [0.8, 0.8, 0.8], 1)

    // Rodapé padronizado em todas as páginas, sem CNPJ
    var footerLineY = 70
    drawLine(
      MARGIN_LEFT,
      footerLineY + 12,
      PAGE_WIDTH - MARGIN_RIGHT,
      footerLineY + 12,
      [0.85, 0.85, 0.85],
      0.75,
    )

    drawText('F2', 9, MARGIN_LEFT, footerLineY - 2, 'Andresa Souza Clinic', [0.51, 0.09, 0.26])

    var techResp = settings.technical_responsible || 'Andresa Souza'
    var profReg = settings.professional_register || 'CREFITO-13 000000-F'
    var respText = 'Profissional Responsável: ' + techResp + ' — ' + profReg
    drawText('F1', 8.5, MARGIN_LEFT, footerLineY - 14, respText, [0.25, 0.25, 0.25])

    var clinicAddr = settings.clinic_address || 'Jardins, Aracaju - SE'
    var clinicPhone = settings.phone || '(79) 99980-9134'
    var contactText = clinicAddr + ' • Tel: ' + clinicPhone
    drawText('F1', 8, MARGIN_LEFT, footerLineY - 25, contactText, [0.4, 0.4, 0.4])

    var pageIndicator =
      'Horário de Brasília (UTC-3) • Página ' + (pageIdx + 1) + ' de ' + totalPages
    drawText('F1', 8, MARGIN_LEFT, footerLineY - 36, pageIndicator, [0.45, 0.45, 0.45])

    if (isPatientCopy) {
      drawText(
        'F2',
        8,
        320,
        footerLineY - 2,
        'Esta é a sua via do documento assinado. Guarde para seus registros.',
        [0.05, 0.45, 0.25],
      )
    }

    // Itens da página
    for (var itIdx = 0; itIdx < items.length; itIdx++) {
      var itemObj = items[itIdx]

      if (itemObj.type === 'sectionHeader') {
        drawText('F2', 11, MARGIN_LEFT, itemObj.y, itemObj.title, [0.51, 0.09, 0.26])
        drawLine(
          MARGIN_LEFT,
          itemObj.y - 4,
          PAGE_WIDTH - MARGIN_RIGHT,
          itemObj.y - 4,
          [0.9, 0.75, 0.82],
          1,
        )
      } else if (itemObj.type === 'tableRow') {
        var rx = MARGIN_LEFT
        var ry = itemObj.y - itemObj.height
        var rw = CONTENT_WIDTH
        var rh = itemObj.height

        var fill = itemObj.isEven ? [0.95, 0.96, 0.97] : [1.0, 1.0, 1.0]
        drawRect(rx, ry, rw, rh, fill, [0.86, 0.88, 0.9], 0.5)
        drawLine(
          rx + itemObj.col1Width,
          ry,
          rx + itemObj.col1Width,
          ry + rh,
          [0.88, 0.9, 0.92],
          0.5,
        )

        var c1Font = itemObj.col1Bold ? 'F2' : 'F1'
        var c1Y = itemObj.y - 12
        if (itemObj.col1Lines && itemObj.col1Lines.length > 0) {
          for (var cl1 = 0; cl1 < itemObj.col1Lines.length; cl1++) {
            drawText(
              c1Font,
              9.5,
              rx + 6,
              c1Y - cl1 * 12.5,
              itemObj.col1Lines[cl1],
              [0.25, 0.25, 0.25],
            )
          }
        } else if (itemObj.col1) {
          drawText(c1Font, 9.5, rx + 6, c1Y, itemObj.col1, [0.25, 0.25, 0.25])
        }

        var c2Font = itemObj.col2Small ? 'F3' : itemObj.col2Bold ? 'F2' : 'F1'
        var c2Size = itemObj.col2Small ? 8 : 9.5
        var c2Col = itemObj.col2Small ? [0.2, 0.2, 0.2] : [0.1, 0.1, 0.1]
        var c2Y = itemObj.y - (itemObj.col2Small ? 11 : 12)
        if (itemObj.col2Lines && itemObj.col2Lines.length > 0) {
          for (var cl2 = 0; cl2 < itemObj.col2Lines.length; cl2++) {
            drawText(
              c2Font,
              c2Size,
              rx + itemObj.col1Width + 8,
              c2Y - cl2 * 12.5,
              itemObj.col2Lines[cl2],
              c2Col,
            )
          }
        }
      } else if (itemObj.type === 'paragraph') {
        for (var pl = 0; pl < itemObj.lines.length; pl++) {
          drawText(
            'F1',
            itemObj.size,
            itemObj.x,
            itemObj.y - 10 - pl * itemObj.lineHeight,
            itemObj.lines[pl],
            itemObj.color,
          )
        }
      } else if (itemObj.type === 'signatureBox') {
        var sbX = MARGIN_LEFT
        var sbY = itemObj.y - itemObj.height
        var sbW = CONTENT_WIDTH
        var sbH = itemObj.height

        drawRect(sbX, sbY, sbW, sbH, [0.99, 0.99, 1.0], [0.75, 0.78, 0.82], 1)

        if (itemObj.hasImage && imageXObjId) {
          var boxMaxW = 280
          var boxMaxH = 80
          var imgW = boxMaxW
          var imgH = boxMaxH
          if (sigImageInfo.width > 0 && sigImageInfo.height > 0) {
            var aspect = sigImageInfo.width / sigImageInfo.height
            if (boxMaxW / boxMaxH > aspect) {
              imgH = boxMaxH
              imgW = imgH * aspect
            } else {
              imgW = boxMaxW
              imgH = imgW / aspect
            }
          }
          var imgPosX = sbX + (sbW - imgW) / 2
          var imgPosY = sbY + (sbH - imgH) / 2

          ops.push('q')
          ops.push(
            imgW.toFixed(2) +
              ' 0 0 ' +
              imgH.toFixed(2) +
              ' ' +
              imgPosX.toFixed(2) +
              ' ' +
              imgPosY.toFixed(2) +
              ' cm',
          )
          ops.push('/SigImg Do')
          ops.push('Q')
        } else {
          drawText(
            'F1',
            10,
            sbX + sbW / 2 - 80,
            sbY + sbH / 2,
            '[Assinatura Eletrônica Autenticada]',
            [0.5, 0.5, 0.5],
          )
        }

        var lineY = sbY - 14
        drawLine(sbX + 40, lineY + 6, sbX + sbW - 40, lineY + 6, [0.3, 0.3, 0.3], 0.75)
        drawText(
          'F2',
          9.5,
          sbX + 40,
          lineY - 6,
          'Assinatura do Paciente: ' + itemObj.patientName,
          [0.15, 0.15, 0.15],
        )
        drawText(
          'F1',
          8.5,
          sbX + 40,
          lineY - 18,
          'Data e Hora da Assinatura: ' + itemObj.dateTimeStr,
          [0.4, 0.4, 0.4],
        )
      } else if (itemObj.type === 'text') {
        drawText(itemObj.font, itemObj.size, itemObj.x, itemObj.y, itemObj.text, itemObj.color)
      }
    }

    var streamStr = ops.join('\n') + '\n'
    var streamRawBytes = strToLatinBytes(streamStr)
    var streamObjContent = strToLatinBytes('<< /Length ' + streamRawBytes.length + ' >>\nstream\n')
      .concat(streamRawBytes)
      .concat(strToLatinBytes('\nendstream'))

    objects.push({
      id: contentObjId,
      rawBytes: streamObjContent,
    })
  }

  var pdf = strToLatinBytes('%PDF-1.4\n')
  var offsets = {}
  objects.sort(function (a, b) {
    return a.id - b.id
  })

  for (var oi = 0; oi < objects.length; oi++) {
    var obj = objects[oi]
    offsets[obj.id] = pdf.length
    pdf = pdf.concat(strToLatinBytes(obj.id + ' 0 obj\n'))
    if (obj.rawBytes) {
      pdf = pdf.concat(obj.rawBytes)
    } else {
      pdf = pdf.concat(strToLatinBytes(obj.content))
    }
    pdf = pdf.concat(strToLatinBytes('\nendobj\n'))
  }

  var xrefOff = pdf.length
  var pad10 = function (n) {
    return String(n).padStart(10, '0')
  }
  var xrefStr = 'xref\n0 ' + nextObjId + '\n0000000000 65535 f \n'
  for (var id = 1; id < nextObjId; id++) {
    xrefStr += pad10(offsets[id] || 0) + ' 00000 n \n'
  }
  xrefStr +=
    'trailer\n<< /Size ' +
    nextObjId +
    ' /Root ' +
    catalogId +
    ' 0 R >>\nstartxref\n' +
    xrefOff +
    '\n%%EOF\n'
  pdf = pdf.concat(strToLatinBytes(xrefStr))

  var cleanPatientName = String(pName)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  if (!cleanPatientName) cleanPatientName = 'Paciente'

  var fDate = brDateStr.replace(/\//g, '-')
  var filename = 'Ficha-Anamnese-' + cleanPatientName + '-' + fDate + '.pdf'

  return {
    bytes: pdf,
    pdfBytes: latinBytesToStr(pdf),
    base64: bytesToB64(pdf),
    filename: filename,
    size: pdf.length,
    totalPages: totalPages,
  }
}

function getClinicSettings() {
  var defaults = {
    clinic_name: 'Andresa Souza Clinic',
    notification_email: 'gihobaicn@hotmail.com',
    phone: '(79) 99980-9134',
    sender_email: 'Ficha Digital - Andresa Souza Clinic <ficha@andresasouza.com.br>',
    technical_responsible: 'Andresa Souza',
    professional_register: 'CREFITO-13 000000-F',
    clinic_address: 'Jardins, Aracaju - SE',
  }
  try {
    var list = $app.findRecordsByFilter('clinic_settings', '', '-created', 1, 0)
    if (list.length > 0) {
      var s = list[0]
      var p = s.getString('phone')
      var reg = s.getString('professional_register')
      var addr = s.getString('clinic_address')
      var tr = s.getString('technical_responsible')
      return {
        clinic_name: s.getString('clinic_name') || defaults.clinic_name,
        notification_email: s.getString('notification_email') || defaults.notification_email,
        phone: p ? p : defaults.phone,
        sender_email: s.getString('sender_email') || defaults.sender_email,
        technical_responsible: tr ? tr : defaults.technical_responsible,
        professional_register: reg ? reg : defaults.professional_register,
        clinic_address: addr ? addr : defaults.clinic_address,
      }
    }
  } catch (_) {}
  return defaults
}

function formatBrDateTime(isoDateStr) {
  try {
    var d = isoDateStr ? new Date(isoDateStr) : new Date()
    var brMs = d.getTime() - 3 * 3600 * 1000
    var brDate = new Date(brMs)
    var pad = function (n) {
      return String(n).padStart(2, '0')
    }
    return (
      pad(brDate.getUTCDate()) +
      '/' +
      pad(brDate.getUTCMonth() + 1) +
      '/' +
      brDate.getUTCFullYear() +
      ' às ' +
      pad(brDate.getUTCHours()) +
      ':' +
      pad(brDate.getUTCMinutes()) +
      ' (horário de Brasília)'
    )
  } catch (_) {
    return 'Data e hora registradas'
  }
}

function buildEmail(rec, isPatientCopy, settings) {
  var pName = rec.getString('patient_name') || 'Paciente'
  var pCpf = rec.getString('patient_cpf') || '-'
  var pEmail = rec.getString('patient_email') || ''
  var fType = rec.getString('form_type')
  var sAt = rec.getString('signed_at') || rec.getString('created')
  var dHash = rec.getString('document_hash') || 'N/A'
  var tTitle = rec.getString('accepted_term_title') || 'Termo de Consentimento Livre e Esclarecido'
  var ip = rec.getString('ip_address') || 'Não disponível'
  var ua = rec.getString('user_agent') || 'Não disponível'
  var sig = rec.getString('signature_data') || ''

  var typeLabels = {
    geral: 'Anamnese Geral',
    labios: 'Lábios & Micropigmentação Labial',
    botox: 'Toxina Botulínica (Botox)',
  }
  var pLabel = typeLabels[fType] || fType || 'Anamnese'
  var brTime = formatBrDateTime(sAt)

  var sigHtml = sig
    ? '<div style="margin: 16px 0; text-align: center;">' +
      '  <img src="' +
      sig +
      '" alt="Assinatura do paciente" style="max-width: 260px; max-height: 90px; border-bottom: 2px solid #831843; display: inline-block;" />' +
      '  <p style="margin: 6px 0 0 0; font-size: 12px; color: #475569; font-weight: 600;">Assinatura do paciente</p>' +
      '</div>'
    : '<p style="font-style: italic; color: #64748b;">[Assinatura eletrônica autenticada]</p>'

  var clinicFooterHtml = '<strong>' + settings.clinic_name + '</strong>'
  if (settings.technical_responsible) {
    clinicFooterHtml += ' &bull; Responsável Técnica: ' + settings.technical_responsible
    if (settings.professional_register)
      clinicFooterHtml += ' (' + settings.professional_register + ')'
  }
  if (settings.clinic_address) {
    clinicFooterHtml += '<br/>Endereço: ' + settings.clinic_address
  }
  if (settings.phone) {
    clinicFooterHtml += ' &bull; Telefone: ' + settings.phone
  }
  clinicFooterHtml += '<br/>Fuso horário: Horário de Brasília (UTC-3)'

  var html =
    '<!DOCTYPE html>' +
    '<html lang="pt-BR">' +
    '<head><meta charset="UTF-8"><title>Comprovante: Ficha de Anamnese Assinada</title></head>' +
    '<body style="font-family: Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b;">' +
    '  <div style="max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">' +
    '    <div style="background-color: #831843; color: #ffffff; padding: 24px; text-align: center;">' +
    '      <h1 style="margin: 0; font-size: 22px; font-weight: bold;">Andresa Souza Clinic</h1>' +
    '      <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.95;">Comprovante de Ficha de Anamnese e Termo Assinado</p>' +
    '    </div>' +
    '    <div style="padding: 24px;">' +
    '      <p style="font-size: 15px; margin-top: 0;">Olá, <strong>' +
    pName +
    '</strong>!</p>' +
    '      <p style="font-size: 14px; line-height: 1.5; color: #334155;">' +
    '        Confirmamos a conclusão e assinatura digital da sua Ficha de Anamnese e Termo de Consentimento.' +
    (isPatientCopy
      ? ' Esta é a sua via oficial do documento assinado.'
      : ' Esta é a notificação oficial registrada para o prontuário da clínica.') +
    '      </p>' +
    '      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 12px; margin: 16px 0; font-size: 13px; color: #166534;">' +
    '        <strong>O documento completo em PDF está anexado a esta mensagem.</strong>' +
    (isPatientCopy
      ? '<br/><span style="display:inline-block; margin-top:4px; font-weight:600;">Esta é a sua via do documento assinado. Guarde para seus registros.</span>'
      : '') +
    '      </div>' +
    '      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px;">' +
    '        <tr style="background-color: #fdf2f8; border-bottom: 1px solid #fbcfe8;">' +
    '          <td style="padding: 10px 12px; font-weight: bold; width: 38%; color: #831843;">Tipo de Procedimento:</td>' +
    '          <td style="padding: 10px 12px; font-weight: bold; color: #1e293b;">' +
    pLabel +
    '</td>' +
    '        </tr>' +
    '        <tr style="border-bottom: 1px solid #e2e8f0;">' +
    '          <td style="padding: 10px 12px; font-weight: bold; color: #475569;">Nome Completo:</td>' +
    '          <td style="padding: 10px 12px;">' +
    pName +
    '</td>' +
    '        </tr>' +
    '        <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">' +
    '          <td style="padding: 10px 12px; font-weight: bold; color: #475569;">CPF:</td>' +
    '          <td style="padding: 10px 12px;">' +
    pCpf +
    '</td>' +
    '        </tr>' +
    '        <tr style="border-bottom: 1px solid #e2e8f0;">' +
    '          <td style="padding: 10px 12px; font-weight: bold; color: #475569;">Data e Hora do Aceite:</td>' +
    '          <td style="padding: 10px 12px; font-weight: 600; color: #0f172a;">' +
    brTime +
    '</td>' +
    '        </tr>' +
    '        <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">' +
    '          <td style="padding: 10px 12px; font-weight: bold; color: #475569;">Termo e Versão Aceita:</td>' +
    '          <td style="padding: 10px 12px;">' +
    tTitle +
    '</td>' +
    '        </tr>' +
    '        <tr style="border-bottom: 1px solid #e2e8f0;">' +
    '          <td style="padding: 10px 12px; font-weight: bold; color: #475569;">Enviado para:</td>' +
    '          <td style="padding: 10px 12px; color: #0369a1; font-weight: 600;">' +
    pEmail +
    '</td>' +
    '        </tr>' +
    '        <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">' +
    '          <td style="padding: 10px 12px; font-weight: bold; color: #475569;">IP de Origem REAL:</td>' +
    '          <td style="padding: 10px 12px; font-family: monospace;">' +
    ip +
    '</td>' +
    '        </tr>' +
    '        <tr style="border-bottom: 1px solid #e2e8f0;">' +
    '          <td style="padding: 10px 12px; font-weight: bold; color: #475569;">Dispositivo / Navegador:</td>' +
    '          <td style="padding: 10px 12px; font-size: 11px; color: #64748b; word-break: break-all;">' +
    ua +
    '</td>' +
    '        </tr>' +
    '      </table>' +
    '      <div style="background-color: #ffffff; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 12px; margin: 18px 0;">' +
    sigHtml +
    '      </div>' +
    '      <div style="background-color: #f1f5f9; border-left: 4px solid #831843; padding: 12px; margin: 18px 0; border-radius: 4px;">' +
    '        <p style="margin: 0; font-size: 12px; font-weight: bold; color: #0f172a;">Hash SHA-256 do Documento:</p>' +
    '        <p style="margin: 4px 0 0 0; font-family: monospace; font-size: 11px; word-break: break-all; color: #334155;">' +
    dHash +
    '</p>' +
    '        <p style="margin: 6px 0 0 0; font-size: 11px; color: #64748b; font-style: italic;">' +
    '          Código de verificação de integridade — garante que este documento não foi alterado após a assinatura.' +
    '        </p>' +
    '      </div>' +
    '    </div>' +
    '    <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 20px; text-align: center; font-size: 11px; color: #64748b; line-height: 1.5;">' +
    clinicFooterHtml +
    '    </div>' +
    '  </div>' +
    '</body></html>'

  var clinicFooterText = settings.clinic_name
  if (settings.technical_responsible) {
    clinicFooterText += ' - Responsável Técnica: ' + settings.technical_responsible
    if (settings.professional_register)
      clinicFooterText += ' (' + settings.professional_register + ')'
  }
  if (settings.clinic_address) clinicFooterText += '\nEndereço: ' + settings.clinic_address
  if (settings.phone) clinicFooterText += ' - Telefone: ' + settings.phone
  clinicFooterText += '\nFuso horário: Horário de Brasília (UTC-3)'

  var text = [
    'Andresa Souza Clinic - Comprovante: Ficha de Anamnese Assinada - ' + pName + ' - ' + pLabel,
    '==============================================================',
    '',
    'Olá, ' + pName + '!',
    '',
    'Confirmamos o preenchimento e a assinatura da sua Ficha de Anamnese.',
    'O documento completo em PDF está anexado a esta mensagem.',
    isPatientCopy ? 'Esta é a sua via do documento assinado. Guarde para seus registros.' : '',
    '',
    'DADOS DO PROCEDIMENTO E DO PACIENTE:',
    '- Procedimento: ' + pLabel,
    '- Paciente: ' + pName,
    '- CPF: ' + pCpf,
    '- Data e Hora do Aceite: ' + brTime,
    '- Termo e Versão Aceita: ' + tTitle,
    '- Enviado para: ' + pEmail,
    '- IP de Origem REAL: ' + ip,
    '- Dispositivo/Navegador: ' + ua,
    '',
    'Código de verificação de integridade — garante que este documento não foi alterado após a assinatura.',
    'Hash SHA-256: ' + dHash,
    '',
    clinicFooterText,
  ]
    .join('\n')
    .trim()

  return { html: html, text: text, procLabel: pLabel, patientName: pName }
}

function sendEmailWithPdf(toAddr, subject, htmlBody, textBody, pdfData, settings) {
  var defaultSender = 'Ficha Digital - Andresa Souza Clinic <ficha@andresasouza.com.br>'
  var fallbackSender = 'Andresa Souza Clinic <onboarding@resend.dev>'
  var configuredSender = (settings && settings.sender_email) || defaultSender
  var sent = false
  var errorMsg = ''
  var resendId = null
  var responseData = null

  var resendApiKey = $os.getenv('RESEND_API_KEY') || 're_WGhaCJ6S_BhPNPw426wcJqyc4w7mywxsq'

  if (resendApiKey) {
    var sendDirect = function (sender) {
      return $http.send({
        url: 'https://api.resend.com/emails',
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + resendApiKey,
          'Content-Type': 'application/json',
        },
        data: {
          from: sender,
          to: [toAddr],
          subject: subject,
          html: htmlBody,
          text: textBody,
          attachments: [
            {
              filename: pdfData.filename,
              content: pdfData.base64,
            },
          ],
        },
      })
    }

    try {
      var directRes = sendDirect(configuredSender)
      var isOk = directRes.statusCode >= 200 && directRes.statusCode < 300

      if (!isOk) {
        var rawStr = directRes.raw || ''
        if (
          directRes.statusCode === 403 ||
          rawStr.includes('domain is not verified') ||
          rawStr.includes('Forbidden')
        ) {
          console.log(
            'Direct Resend custom domain not verified (403), falling back to onboarding@resend.dev...',
          )
          directRes = sendDirect(fallbackSender)
          isOk = directRes.statusCode >= 200 && directRes.statusCode < 300
        }
      }

      if (isOk) {
        sent = true
        responseData = directRes.json || directRes.raw
        if (directRes.json && directRes.json.id) {
          resendId = directRes.json.id
        }
        console.log(
          'Direct Resend email with attachment sent to ' +
            toAddr +
            '. ID: ' +
            resendId +
            '. Attachment: ' +
            pdfData.filename +
            ' (' +
            pdfData.size +
            ' bytes, ' +
            pdfData.totalPages +
            ' páginas)',
        )
      } else {
        errorMsg = 'Resend API HTTP ' + directRes.statusCode + ': ' + directRes.raw
        console.log('Direct Resend error:', errorMsg)
      }
    } catch (errHttp) {
      console.log('Error calling direct Resend API:', errHttp)
      errorMsg = String(errHttp)
    }
  }

  if (!sent && typeof $connectors !== 'undefined' && $connectors.executeAsOwner) {
    try {
      var payload = {
        from: configuredSender,
        to: [toAddr],
        subject: subject,
        html: htmlBody,
        text: textBody,
        attachments: [
          {
            filename: pdfData.filename,
            content: pdfData.base64,
          },
        ],
      }

      var res = $connectors.executeAsOwner('RESEND_SEND_EMAIL', payload)
      if (!res || !res.successful) {
        payload.from = fallbackSender
        res = $connectors.executeAsOwner('RESEND_SEND_EMAIL', payload)
      }

      if (res && res.successful) {
        sent = true
        responseData = res.data || res
        if (res.data && res.data.id) {
          resendId = res.data.id
        }
      } else {
        if (!errorMsg) {
          errorMsg = res
            ? JSON.stringify(res.error || res.data || 'Erro no conector Resend')
            : 'Sem resposta do conector'
        }
      }
    } catch (errResend) {
      console.log('Error calling RESEND_SEND_EMAIL connector:', errResend)
      if (!errorMsg) errorMsg = String(errResend)
    }
  }

  if (!sent) {
    try {
      var fromName = configuredSender.includes('<')
        ? configuredSender.split('<')[0].trim()
        : 'Andresa Souza Clinic'
      var fromEmail = configuredSender.includes('<')
        ? configuredSender.split('<')[1].replace('>', '').trim()
        : configuredSender

      var msg = new MailerMessage({
        from: {
          address: fromEmail,
          name: fromName,
        },
        to: [{ address: toAddr }],
        subject: subject,
        html: htmlBody,
        text: textBody,
        attachments: [
          {
            name: pdfData.filename,
            data: pdfData.base64,
            type: 'application/pdf',
          },
        ],
      })
      $app.newMailClient().send(msg)
      sent = true
    } catch (errMailer) {
      console.log('Mailer client error with attachment:', errMailer)
      if (!errorMsg) errorMsg = String(errMailer)
    }
  }

  return { sent: sent, error: errorMsg, resendId: resendId, responseData: responseData }
}

module.exports = {
  generatePdf: generatePdf,
  getClinicSettings: getClinicSettings,
  buildEmail: buildEmail,
  sendEmailWithPdf: sendEmailWithPdf,
  formatBrDateTime: formatBrDateTime,
}
