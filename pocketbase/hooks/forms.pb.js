// pocketbase/hooks/forms.pb.js - v2
// Back-end oficial da Ficha Digital de Anamnese - Andresa Souza Clinic
// Contém todas as rotas e hooks oficiais para validação, auditoria, envio de e-mails e geração de PDF.
// Autocontido: cada callback é 100% autocontido sem nenhuma declaração top-level.

/**
 * GET /backend/v1/client-ip
 * Retorna o IP real do cliente verificando headers padrão de proxy
 */

// Testes automáticos em onRecordViewRequest removidos para não disparar envios espúrios

routerAdd('GET', '/backend/v1/client-ip', (e) => {
  var headers = e.request.header
  var ip = ''

  var xForwardedFor = headers.get('X-Forwarded-For')
  if (xForwardedFor) {
    var parts = xForwardedFor.split(',')
    if (parts.length > 0 && parts[0].trim()) {
      ip = parts[0].trim()
    }
  }

  if (!ip) {
    var cfIp = headers.get('CF-Connecting-IP')
    if (cfIp) ip = cfIp.trim()
  }

  if (!ip) {
    var realIp = headers.get('X-Real-IP')
    if (realIp) ip = realIp.trim()
  }

  if (!ip) {
    ip = e.realIP() || ''
  }

  return e.json(200, { ip: ip || '127.0.0.1' })
})

/**
 * POST /backend/v1/forms/send-verification-code
 * Body: { token: string, email: string, patient_name?: string }
 * Gera código de 6 dígitos numéricos, grava em email_verifications (expira em 15 min) e envia e-mail via Resend
 */
routerAdd('POST', '/backend/v1/forms/send-verification-code', (e) => {
  var body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {
    body = {}
  }

  var token = body.token || ''
  var email = (body.email || '').trim().toLowerCase()
  var patientName = (body.patient_name || '').trim()

  if (!token || !email || email.indexOf('@') === -1) {
    return e.json(400, { success: false, message: 'Token e e-mail valido sao obrigatorios.' })
  }

  // Localiza a ficha correspondente
  var formRecord = null
  try {
    var forms = $app.findRecordsByFilter('form_submissions', 'token = {:token}', '', 1, 0, {
      token: token,
    })
    if (forms && forms.length > 0) formRecord = forms[0]
  } catch (err) {
    return e.json(404, { success: false, message: 'Ficha de anamnese nao encontrada.' })
  }

  if (!formRecord) {
    return e.json(404, { success: false, message: 'Ficha de anamnese nao encontrada.' })
  }

  // Gera código aleatório numérico de 6 dígitos
  var code = String(Math.floor(100000 + Math.random() * 900000))
  var expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

  // Salva na coleção email_verifications
  try {
    var verifCol = $app.findCollectionByNameOrId('email_verifications')
    var verifRec = new Record(verifCol)
    verifRec.set('form_submission', formRecord.id)
    verifRec.set('email', email)
    verifRec.set('code', code)
    verifRec.set('verified', false)
    verifRec.set('expires_at', expiresAt)
    $app.save(verifRec)
  } catch (err) {
    console.log('Erro ao gravar email_verifications: ' + err.message)
    return e.json(500, { success: false, message: 'Falha ao salvar codigo de verificacao.' })
  }

  // Configurações da clínica
  var clinicName = 'Andresa Souza Clinic'
  var senderEmail = 'Ficha Digital - Andresa Souza Clinic <ficha@andresasouza.com.br>'

  try {
    var recs = $app.findRecordsByFilter('clinic_settings', '', '-created', 1, 0)
    if (recs && recs.length > 0) {
      var s = recs[0]
      if (s.getString('clinic_name')) clinicName = s.getString('clinic_name')
      if (s.getString('sender_email')) senderEmail = s.getString('sender_email')
    }
  } catch (_) {}

  var subject = 'Seu Codigo de Validacao: ' + code + ' - ' + clinicName
  var html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head><meta charset="UTF-8"><title>Codigo de Validacao</title></head>
    <body style="font-family: Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b;">
      <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        <div style="background-color: #831843; color: #ffffff; padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 20px; font-weight: bold;">${clinicName}</h1>
          <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.95;">Validacao de Identidade para Assinatura Eletronica</p>
        </div>
        <div style="padding: 24px; text-align: center;">
          <p style="font-size: 15px; margin-top: 0; color: #334155;">
            Ola${patientName ? ', <strong>' + patientName + '</strong>' : ''}!
          </p>
          <p style="font-size: 14px; line-height: 1.5; color: #475569;">
            Use o codigo abaixo para confirmar seu e-mail e prosseguir com o preenchimento da sua ficha:
          </p>
          <div style="margin: 24px 0; background-color: #fdf2f8; border: 2px dashed #f472b6; border-radius: 8px; padding: 16px; display: inline-block;">
            <span style="font-size: 32px; font-weight: bold; font-family: monospace; letter-spacing: 6px; color: #831843;">${code}</span>
          </div>
          <p style="font-size: 12px; color: #64748b; margin-bottom: 0;">
            Este codigo expira em <strong>15 minutos</strong>. Caso nao tenha solicitado este codigo, ignore esta mensagem.
          </p>
        </div>
        <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 14px; text-align: center; font-size: 11px; color: #94a3b8;">
          ${clinicName} &bull; Ficha Digital Segura &bull; Horario de Brasilia
        </div>
      </div>
    </body></html>
  `

  // Envio prioritário: chamada DIRETA à API REST do Resend com RESEND_API_KEY do cofre
  var resendApiKey = $os.getenv('RESEND_API_KEY')
  var emailSent = false
  var lastErrorMsg = ''

  if (resendApiKey) {
    try {
      var directRes = $http.send({
        url: 'https://api.resend.com/emails',
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + resendApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: senderEmail,
          to: [email],
          subject: subject,
          html: html,
        }),
      })

      if (directRes.statusCode >= 200 && directRes.statusCode < 300) {
        var directData = directRes.json || {}
        console.log(
          'Codigo de verificacao ' +
            code +
            ' enviado com sucesso para ' +
            email +
            ' via Resend REST API direta. Resend ID: ' +
            (directData.id || ''),
        )
        emailSent = true
      } else {
        lastErrorMsg =
          'Falha ao enviar via Resend API (' + directRes.statusCode + '): ' + directRes.raw
        console.log(lastErrorMsg)
      }
    } catch (errDirect) {
      lastErrorMsg = 'Falha ao chamar API REST do Resend: ' + errDirect.message
      console.log(lastErrorMsg)
    }
  } else {
    console.log('Aviso: Segredo RESEND_API_KEY nao encontrado no ambiente.')
  }

  // Fallback via conector apenas se o envio direto não tiver ocorrido ou falhado
  if (!emailSent) {
    try {
      var r = $connectors.executeAsOwner('RESEND_SEND_EMAIL', {
        from: senderEmail,
        to: [email],
        subject: subject,
        html: html,
      })

      if (r && r.successful) {
        var resData = r.data || {}
        console.log(
          'Codigo de verificacao ' +
            code +
            ' enviado com sucesso para ' +
            email +
            ' via conector Resend. Resend ID: ' +
            (resData.id || ''),
        )
        emailSent = true
      } else {
        var errMsg = r && r.error ? String(r.error) : 'erro desconhecido'
        console.log('Falha ao enviar e-mail via conector Resend: ' + errMsg)
        lastErrorMsg = lastErrorMsg ? lastErrorMsg + ' | Conector: ' + errMsg : errMsg
      }
    } catch (err) {
      console.log('Falha ao enviar e-mail via conector Resend: ' + err.message)
      lastErrorMsg = lastErrorMsg ? lastErrorMsg + ' | Conector: ' + err.message : err.message
    }
  }

  if (!emailSent) {
    var clientMsg =
      'Não foi possível enviar o código por e-mail no momento. Por favor, tente novamente em instantes.'
    if (
      lastErrorMsg.indexOf('daily_quota_exceeded') !== -1 ||
      lastErrorMsg.indexOf('quota') !== -1 ||
      lastErrorMsg.indexOf('429') !== -1
    ) {
      clientMsg =
        'Limite diário de envio de e-mails da conta Resend atingido (cota diária esgotada). Entre em contato com a clínica ou tente novamente mais tarde.'
    } else if (
      lastErrorMsg.indexOf('API key') !== -1 ||
      lastErrorMsg.indexOf('401') !== -1 ||
      lastErrorMsg.indexOf('403') !== -1 ||
      lastErrorMsg.indexOf('restricted') !== -1 ||
      lastErrorMsg.indexOf('not authorized') !== -1
    ) {
      clientMsg =
        'Falha de autenticação no serviço de e-mail (Resend). A clínica precisa verificar a chave de envio.'
    }
    return e.json(500, {
      success: false,
      message: clientMsg,
      detail: lastErrorMsg,
    })
  }

  // Registra auditoria com encadeamento criptográfico
  try {
    function computeSha256Hex(str) {
      function rightRotate(value, amount) {
        return (value >>> amount) | (value << (32 - amount))
      }
      var mathPow = Math.pow
      var maxWord = mathPow(2, 32)
      var i, j
      var result = ''
      var words = []
      var asciiBitLength = str.length * 8
      var hash = []
      var k = []
      var primeCounter = 0
      var isComposite = {}
      for (var candidate = 2; primeCounter < 64; candidate++) {
        if (!isComposite[candidate]) {
          for (i = candidate * candidate; i < 312; i += candidate) {
            isComposite[i] = true
          }
          hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0
          k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0
        }
      }
      str += '\x80'
      while ((str.length % 64) - 56) str += '\x00'
      for (i = 0; i < str.length; i++) {
        j = str.charCodeAt(i)
        words[i >> 2] |= j << (((3 - i) % 4) * 8)
      }
      words[words.length] = (asciiBitLength / maxWord) | 0
      words[words.length] = asciiBitLength | 0
      for (j = 0; j < words.length; ) {
        var w = words.slice(j, (j += 16))
        var oldHash = hash.slice(0)
        for (i = 0; i < 64; i++) {
          var w15 = w[i - 15],
            w2 = w[i - 2]
          var s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)
          var s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10)
          w[i] = i < 16 ? w[i] : (w[i - 16] + s0 + w[i - 7] + s1) | 0
          var ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6])
          var maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2])
          var temp1 =
            (hash[7] +
              (rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25)) +
              ch +
              k[i] +
              w[i]) |
            0
          var temp2 =
            ((rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22)) +
              maj) |
            0
          hash = [
            (temp1 + temp2) | 0,
            hash[0],
            hash[1],
            hash[2],
            (hash[3] + temp1) | 0,
            hash[4],
            hash[5],
            hash[6],
          ]
        }
        for (i = 0; i < 8; i++) {
          hash[i] = (hash[i] + oldHash[i]) | 0
        }
      }
      for (i = 0; i < 8; i++) {
        for (j = 3; j >= 0; j--) {
          var b = (hash[i] >> (j * 8)) & 255
          result += (b < 16 ? '0' : '') + b.toString(16)
        }
      }
      return result
    }

    var auditCol = $app.findCollectionByNameOrId('audit_events')
    var lastAudits = $app.findRecordsByFilter(
      'audit_events',
      'form_submission = {:fid}',
      '-created',
      1,
      0,
      { fid: formRecord.id },
    )
    var prevHash = ''
    if (lastAudits && lastAudits.length > 0) {
      prevHash = lastAudits[0].getString('chain_hash') || ''
    }
    var nowIso = new Date().toISOString()
    var eventDesc = 'Código de verificação enviado para ' + email
    var chainPayload =
      (prevHash || 'GENESIS') + '|' + formRecord.id + '|codigo_enviado|' + eventDesc + '|' + nowIso
    var cHash = computeSha256Hex(chainPayload)

    var auditRec = new Record(auditCol)
    auditRec.set('form_submission', formRecord.id)
    auditRec.set('event_type', 'codigo_enviado')
    auditRec.set('description', eventDesc)
    auditRec.set('step_number', 2)
    auditRec.set('timestamp', nowIso)
    auditRec.set('previous_hash', prevHash)
    auditRec.set('chain_hash', cHash)
    $app.save(auditRec)
  } catch (_) {}

  return e.json(200, { success: true, message: 'Codigo de verificacao enviado com sucesso.' })
})

/**
 * POST /backend/v1/forms/verify-email-code
 * Body: { token: string, email: string, code: string }
 * Valida código de 6 dígitos numéricos
 */
routerAdd('POST', '/backend/v1/forms/verify-email-code', (e) => {
  var body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {
    body = {}
  }

  var token = body.token || ''
  var email = (body.email || '').trim().toLowerCase()
  var code = (body.code || '').trim()

  if (!token || !email || !code) {
    return e.json(400, { success: false, message: 'Token, e-mail e codigo sao obrigatorios.' })
  }

  var formRecord = null
  try {
    var forms = $app.findRecordsByFilter('form_submissions', 'token = {:token}', '', 1, 0, {
      token: token,
    })
    if (forms && forms.length > 0) formRecord = forms[0]
  } catch (_) {}

  if (!formRecord) {
    return e.json(404, { success: false, message: 'Ficha de anamnese nao encontrada.' })
  }

  var verifs = []
  try {
    verifs = $app.findRecordsByFilter(
      'email_verifications',
      'form_submission = {:fid} && email = {:email} && code = {:code}',
      '-created',
      1,
      0,
      { fid: formRecord.id, email: email, code: code },
    )
  } catch (err) {
    console.log('Erro ao buscar email_verifications: ' + err.message)
  }

  if (!verifs || verifs.length === 0) {
    return e.json(400, {
      success: false,
      message: 'Codigo invalido ou incorreto. Por favor, confira os numeros digitados.',
    })
  }

  var verif = verifs[0]
  var expiresAt = verif.getString('expires_at')
  if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
    return e.json(400, {
      success: false,
      message: 'Este codigo ja expirou. Por favor, solicite um novo codigo.',
    })
  }

  // Marca como verificado
  var nowIso = new Date().toISOString()
  try {
    verif.set('verified', true)
    verif.set('verified_at', nowIso)
    $app.save(verif)

    formRecord.set('status', 'codigo_validado')
    formRecord.set('email_code_verified_at', nowIso)
    $app.save(formRecord)

    // Auditoria com proteção de código (apenas hash, sem expor número) e encadeamento
    function computeSha256Hex(str) {
      function rightRotate(value, amount) {
        return (value >>> amount) | (value << (32 - amount))
      }
      var mathPow = Math.pow
      var maxWord = mathPow(2, 32)
      var i, j
      var result = ''
      var words = []
      var asciiBitLength = str.length * 8
      var hash = []
      var k = []
      var primeCounter = 0
      var isComposite = {}
      for (var candidate = 2; primeCounter < 64; candidate++) {
        if (!isComposite[candidate]) {
          for (i = candidate * candidate; i < 312; i += candidate) {
            isComposite[i] = true
          }
          hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0
          k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0
        }
      }
      str += '\x80'
      while ((str.length % 64) - 56) str += '\x00'
      for (i = 0; i < str.length; i++) {
        j = str.charCodeAt(i)
        words[i >> 2] |= j << (((3 - i) % 4) * 8)
      }
      words[words.length] = (asciiBitLength / maxWord) | 0
      words[words.length] = asciiBitLength | 0
      for (j = 0; j < words.length; ) {
        var w = words.slice(j, (j += 16))
        var oldHash = hash.slice(0)
        for (i = 0; i < 64; i++) {
          var w15 = w[i - 15],
            w2 = w[i - 2]
          var s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)
          var s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10)
          w[i] = i < 16 ? w[i] : (w[i - 16] + s0 + w[i - 7] + s1) | 0
          var ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6])
          var maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2])
          var temp1 =
            (hash[7] +
              (rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25)) +
              ch +
              k[i] +
              w[i]) |
            0
          var temp2 =
            ((rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22)) +
              maj) |
            0
          hash = [
            (temp1 + temp2) | 0,
            hash[0],
            hash[1],
            hash[2],
            (hash[3] + temp1) | 0,
            hash[4],
            hash[5],
            hash[6],
          ]
        }
        for (i = 0; i < 8; i++) {
          hash[i] = (hash[i] + oldHash[i]) | 0
        }
      }
      for (i = 0; i < 8; i++) {
        for (j = 3; j >= 0; j--) {
          var b = (hash[i] >> (j * 8)) & 255
          result += (b < 16 ? '0' : '') + b.toString(16)
        }
      }
      return result
    }

    var auditCol = $app.findCollectionByNameOrId('audit_events')
    var lastAudits = $app.findRecordsByFilter(
      'audit_events',
      'form_submission = {:fid}',
      '-created',
      1,
      0,
      { fid: formRecord.id },
    )
    var prevHash = ''
    if (lastAudits && lastAudits.length > 0) {
      prevHash = lastAudits[0].getString('chain_hash') || ''
    }
    var codeHash = computeSha256Hex(code)
    var eventDesc = 'Código de e-mail validado com sucesso para ' + email
    var chainPayload =
      (prevHash || 'GENESIS') + '|' + formRecord.id + '|codigo_validado|' + eventDesc + '|' + nowIso
    var cHash = computeSha256Hex(chainPayload)

    var auditRec = new Record(auditCol)
    auditRec.set('form_submission', formRecord.id)
    auditRec.set('event_type', 'codigo_validado')
    auditRec.set('description', eventDesc)
    auditRec.set('step_number', 2)
    auditRec.set('metadata', { code_hash: codeHash })
    auditRec.set('timestamp', nowIso)
    auditRec.set('previous_hash', prevHash)
    auditRec.set('chain_hash', cHash)
    $app.save(auditRec)
  } catch (err) {
    console.log('Erro ao atualizar status verificado: ' + err.message)
  }

  return e.json(200, { success: true, message: 'E-mail validado com sucesso!' })
})

/**
 * POST /backend/v1/forms/audit-event
 * Body: { token: string, event_type: string, description: string, step_number?: number, metadata?: object }
 * Grava evento na trilha de auditoria
 */
routerAdd('POST', '/backend/v1/forms/audit-event', (e) => {
  var body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {
    body = {}
  }

  var token = body.token || ''
  var formSubmissionId = body.form_submission_id || body.form_id || ''
  var eventType = body.event_type || ''
  var description = body.description || ''
  var stepNumber = body.step_number || 0
  var metadata = body.metadata || {}

  if ((!token && !formSubmissionId) || !eventType) {
    return e.json(400, {
      success: false,
      message: 'Identificador da ficha (token ou id) e event_type sao obrigatorios.',
    })
  }

  var formRecord = null
  try {
    if (formSubmissionId) {
      formRecord = $app.findRecordById('form_submissions', formSubmissionId)
    } else if (token) {
      var forms = $app.findRecordsByFilter('form_submissions', 'token = {:token}', '', 1, 0, {
        token: token,
      })
      if (forms && forms.length > 0) formRecord = forms[0]
    }
  } catch (_) {}

  if (!formRecord) {
    return e.json(404, { success: false, message: 'Ficha de anamnese nao encontrada.' })
  }

  // Captura IP e User-Agent reais
  var headers = e.request.header
  var ip = ''
  var xff = headers.get('X-Forwarded-For')
  if (xff) {
    var parts = xff.split(',')
    if (parts.length > 0) ip = parts[0].trim()
  }
  if (!ip) ip = headers.get('CF-Connecting-IP') || headers.get('X-Real-IP') || e.realIP() || ''
  var ua = headers.get('User-Agent') || ''

  try {
    function computeSha256Hex(str) {
      function rightRotate(value, amount) {
        return (value >>> amount) | (value << (32 - amount))
      }
      var mathPow = Math.pow
      var maxWord = mathPow(2, 32)
      var i, j
      var result = ''
      var words = []
      var asciiBitLength = str.length * 8
      var hash = []
      var k = []
      var primeCounter = 0
      var isComposite = {}
      for (var candidate = 2; primeCounter < 64; candidate++) {
        if (!isComposite[candidate]) {
          for (i = candidate * candidate; i < 312; i += candidate) {
            isComposite[i] = true
          }
          hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0
          k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0
        }
      }
      str += '\x80'
      while ((str.length % 64) - 56) str += '\x00'
      for (i = 0; i < str.length; i++) {
        j = str.charCodeAt(i)
        words[i >> 2] |= j << (((3 - i) % 4) * 8)
      }
      words[words.length] = (asciiBitLength / maxWord) | 0
      words[words.length] = asciiBitLength | 0
      for (j = 0; j < words.length; ) {
        var w = words.slice(j, (j += 16))
        var oldHash = hash.slice(0)
        for (i = 0; i < 64; i++) {
          var w15 = w[i - 15],
            w2 = w[i - 2]
          var s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)
          var s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10)
          w[i] = i < 16 ? w[i] : (w[i - 16] + s0 + w[i - 7] + s1) | 0
          var ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6])
          var maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2])
          var temp1 =
            (hash[7] +
              (rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25)) +
              ch +
              k[i] +
              w[i]) |
            0
          var temp2 =
            ((rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22)) +
              maj) |
            0
          hash = [
            (temp1 + temp2) | 0,
            hash[0],
            hash[1],
            hash[2],
            (hash[3] + temp1) | 0,
            hash[4],
            hash[5],
            hash[6],
          ]
        }
        for (i = 0; i < 8; i++) {
          hash[i] = (hash[i] + oldHash[i]) | 0
        }
      }
      for (i = 0; i < 8; i++) {
        for (j = 3; j >= 0; j--) {
          var b = (hash[i] >> (j * 8)) & 255
          result += (b < 16 ? '0' : '') + b.toString(16)
        }
      }
      return result
    }

    // Limpa qualquer dado sensível (código de 6 dígitos numéricos) na descrição
    var safeDesc = String(description)
      .replace(
        /Código de e-mail \(\d+\) validado com sucesso/gi,
        'Código de e-mail validado com sucesso',
      )
      .replace(/código\s*\(\d+\)/gi, 'código')

    var auditCol = $app.findCollectionByNameOrId('audit_events')
    var lastAudits = $app.findRecordsByFilter(
      'audit_events',
      'form_submission = {:fid}',
      '-created',
      1,
      0,
      { fid: formRecord.id },
    )
    var prevHash = ''
    if (lastAudits && lastAudits.length > 0) {
      prevHash = lastAudits[0].getString('chain_hash') || ''
    }
    var nowIso = new Date().toISOString()
    var chainPayload =
      (prevHash || 'GENESIS') +
      '|' +
      formRecord.id +
      '|' +
      eventType +
      '|' +
      safeDesc +
      '|' +
      nowIso
    var cHash = computeSha256Hex(chainPayload)

    var rec = new Record(auditCol)
    rec.set('form_submission', formRecord.id)
    rec.set('event_type', eventType)
    rec.set('description', safeDesc)
    rec.set('step_number', stepNumber)
    rec.set('ip_address', ip)
    rec.set('user_agent', ua)
    rec.set('metadata', metadata)
    rec.set('timestamp', nowIso)
    rec.set('previous_hash', prevHash)
    rec.set('chain_hash', cHash)
    $app.save(rec)
  } catch (err) {
    console.log('Erro ao salvar audit_event: ' + err.message)
    return e.json(500, { success: false, message: err.message })
  }

  return e.json(200, { success: true })
})

/**
 * POST /backend/v1/forms/resend-email
 * Body: { id: string }
 * Reenvio manual do comprovante por ID (usado no painel da clínica)
 */

routerAdd('POST', '/backend/v1/forms/resend-email', (e) => {
  var body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {
    body = {}
  }

  var qInfo = {}
  try {
    qInfo = e.requestInfo().query || {}
  } catch (_) {}
  var id = body.id || body.form_id || qInfo.id || qInfo.form_id || ''
  if (!id) {
    return e.json(400, { success: false, message: 'ID da ficha e obrigatorio.' })
  }

  var formRecord = null
  try {
    formRecord = $app.findRecordById('form_submissions', id)
  } catch (err) {
    return e.json(404, { success: false, message: 'Ficha nao encontrada.' })
  }

  // Configs da clínica
  var settingsRec = null
  try {
    var recs = $app.findRecordsByFilter('clinic_settings', '', '-created', 1, 0)
    if (recs && recs.length > 0) settingsRec = recs[0]
  } catch (_) {}

  var clinicName = 'Andresa Souza Clinic'
  var techResp = 'Andresa Souza — CREFITO-13 000000-F'
  var profReg = 'CREFITO-13 000000-F'
  var clinicAddr = 'Jardins, Aracaju - SE'
  var clinicPhone = '(79) 99980-9134'
  var clinicEmail = 'andresasouzaclinic@gmail.com'
  var senderEmail = 'Ficha Digital - Andresa Souza Clinic <ficha@andresasouza.com.br>'

  if (settingsRec) {
    try {
      if (settingsRec.getString('clinic_name')) clinicName = settingsRec.getString('clinic_name')
      if (settingsRec.getString('technical_responsible'))
        techResp = settingsRec.getString('technical_responsible')
      if (settingsRec.getString('professional_register'))
        profReg = settingsRec.getString('professional_register')
      if (settingsRec.getString('clinic_address'))
        clinicAddr = settingsRec.getString('clinic_address')
      if (settingsRec.getString('phone')) clinicPhone = settingsRec.getString('phone')
      if (settingsRec.getString('notification_email'))
        clinicEmail = settingsRec.getString('notification_email')
      if (settingsRec.getString('sender_email')) senderEmail = settingsRec.getString('sender_email')
    } catch (_) {}
  }

  var patientEmail = formRecord.getString('patient_email')
  var patientName = formRecord.getString('patient_name') || 'Paciente'
  var fType = formRecord.getString('form_type') || 'geral'
  var formTypeLabels = {
    geral: 'Anamnese Estética Geral',
    labios: 'Lábios, Micropigmentação & Revitalização Labial',
    botox: 'Toxina Botulínica (Botox)',
  }
  var fTypeLabel = formTypeLabels[fType] || fType

  // --- GERADOR DE PDF INLINE AUTOCONTIDO ---
  var pdfResult = (function (rec, settings) {
    var base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    var base64Lookup = new Uint8Array(256)
    for (var bIdx = 0; bIdx < base64Chars.length; bIdx++) {
      base64Lookup[base64Chars.charCodeAt(bIdx)] = bIdx
    }

    function decodeBase64ToBytes(base64Str) {
      var clean = base64Str.replace(/[^A-Za-z0-9+/=]/g, '')
      var len = clean.length
      var placeHolders = clean.charAt(len - 1) === '=' ? (clean.charAt(len - 2) === '=' ? 2 : 1) : 0
      var byteLen = Math.floor((len * 3) / 4) - placeHolders
      var bytes = new Uint8Array(byteLen)
      var curByte = 0
      for (var i = 0; i < len; i += 4) {
        var enc1 = base64Lookup[clean.charCodeAt(i)]
        var enc2 = base64Lookup[clean.charCodeAt(i + 1)]
        var enc3 = base64Lookup[clean.charCodeAt(i + 2)]
        var enc4 = base64Lookup[clean.charCodeAt(i + 3)]

        bytes[curByte++] = (enc1 << 2) | (enc2 >> 4)
        if (curByte < byteLen) bytes[curByte++] = ((enc2 & 15) << 4) | (enc3 >> 2)
        if (curByte < byteLen) bytes[curByte++] = ((enc3 & 3) << 6) | enc4
      }
      return bytes
    }

    function encodeBinaryStringToBase64(binStr) {
      var output = ''
      var len = binStr.length
      for (var j = 0; j < len; j += 3) {
        var b0 = binStr.charCodeAt(j) & 0xff
        var b1 = j + 1 < len ? binStr.charCodeAt(j + 1) & 0xff : 0
        var b2 = j + 2 < len ? binStr.charCodeAt(j + 2) & 0xff : 0
        output += base64Chars.charAt(b0 >> 2)
        output += base64Chars.charAt(((b0 & 3) << 4) | (b1 >> 4))
        output += j + 1 < len ? base64Chars.charAt(((b1 & 15) << 2) | (b2 >> 6)) : '='
        output += j + 2 < len ? base64Chars.charAt(b2 & 63) : '='
      }
      return output
    }

    function tinfUncompress(source) {
      var TINF_OK = 0
      var sltree = { table: new Uint16Array(16), trans: new Uint16Array(288) }
      var sdtree = { table: new Uint16Array(16), trans: new Uint16Array(288) }
      var length_bits = new Uint8Array(30)
      var length_base = new Uint16Array(30)
      var dist_bits = new Uint8Array(30)
      var dist_base = new Uint16Array(30)
      var clcidx = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]

      function tinf_build_bits_base(bits, base, delta, first) {
        var i, sum
        for (i = 0; i < delta; ++i) bits[i] = 0
        for (i = 0; i < 30 - delta; ++i) bits[i + delta] = Math.floor(i / delta)
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

      tinf_build_fixed_trees(sltree, sdtree)
      tinf_build_bits_base(length_bits, length_base, 4, 3)
      tinf_build_bits_base(dist_bits, dist_base, 2, 1)
      length_bits[28] = 0
      length_base[28] = 258

      function tinf_build_tree(t, lengths, off, num) {
        var offs = new Uint16Array(16)
        var i, sum
        for (i = 0; i < 16; ++i) t.table[i] = 0
        for (i = 0; i < num; ++i) t.table[lengths[off + i]]++
        t.table[0] = 0
        for (sum = 0, i = 0; i < 16; ++i) {
          offs[i] = sum
          sum += t.table[i]
        }
        for (i = 0; i < num; ++i) {
          if (lengths[off + i]) t.trans[offs[lengths[off + i]]++] = i
        }
      }

      var d = {
        source: source,
        sourceIndex: 0,
        tag: 0,
        bitcount: 0,
        dest: new Uint8Array(source.length * 8 + 65536),
        destLen: 0,
        ltree: { table: new Uint16Array(16), trans: new Uint16Array(288) },
        dtree: { table: new Uint16Array(16), trans: new Uint16Array(288) },
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
        var hlit = tinf_read_bits(d, 5, 257)
        var hdist = tinf_read_bits(d, 5, 1)
        var hclen = tinf_read_bits(d, 4, 4)
        var lengths = new Uint8Array(288 + 32)
        var code_tree = { table: new Uint16Array(16), trans: new Uint16Array(288) }
        var i, num, length

        for (i = 0; i < 19; ++i) lengths[i] = 0
        for (i = 0; i < hclen; ++i) {
          lengths[clcidx[i]] = tinf_read_bits(d, 3, 0)
        }
        tinf_build_tree(code_tree, lengths, 0, 19)

        for (num = 0; num < hlit + hdist; ) {
          var sym = tinf_decode_symbol(d, code_tree)
          switch (sym) {
            case 16:
              var prev = lengths[num - 1]
              for (length = tinf_read_bits(d, 2, 3); length; --length) lengths[num++] = prev
              break
            case 17:
              for (length = tinf_read_bits(d, 3, 3); length; --length) lengths[num++] = 0
              break
            case 18:
              for (length = tinf_read_bits(d, 7, 11); length; --length) lengths[num++] = 0
              break
            default:
              lengths[num++] = sym
              break
          }
        }
        tinf_build_tree(lt, lengths, 0, hlit)
        tinf_build_tree(dt, lengths, hlit, hdist)
      }

      function tinf_inflate_block_data(d, lt, dt) {
        while (1) {
          var sym = tinf_decode_symbol(d, lt)
          if (sym === 256) return TINF_OK
          if (sym < 256) {
            if (d.destLen >= d.dest.length) {
              var bigger = new Uint8Array(d.dest.length * 2)
              bigger.set(d.dest)
              d.dest = bigger
            }
            d.dest[d.destLen++] = sym
          } else {
            sym -= 257
            var length = tinf_read_bits(d, length_bits[sym], length_base[sym])
            var dist = tinf_decode_symbol(d, dt)
            var offs = d.destLen - tinf_read_bits(d, dist_bits[dist], dist_base[dist])
            if (d.destLen + length >= d.dest.length) {
              var bigger2 = new Uint8Array(Math.max(d.dest.length * 2, d.destLen + length + 65536))
              bigger2.set(d.dest)
              d.dest = bigger2
            }
            for (var i = offs; i < offs + length; ++i) {
              d.dest[d.destLen++] = d.dest[i]
            }
          }
        }
      }

      function tinf_inflate_uncompressed_block(d) {
        while (d.bitcount > 8) {
          d.sourceIndex--
          d.bitcount -= 8
        }
        var length = d.source[d.sourceIndex + 1] * 256 + d.source[d.sourceIndex]
        d.sourceIndex += 4
        if (d.destLen + length >= d.dest.length) {
          var bigger = new Uint8Array(d.dest.length + length + 65536)
          bigger.set(d.dest)
          d.dest = bigger
        }
        for (var i = length; i; --i) d.dest[d.destLen++] = d.source[d.sourceIndex++]
        d.bitcount = 0
        return TINF_OK
      }

      var bfinal
      do {
        bfinal = tinf_getbit(d)
        var btype = tinf_read_bits(d, 2, 0)
        switch (btype) {
          case 0:
            tinf_inflate_uncompressed_block(d)
            break
          case 1:
            tinf_inflate_block_data(d, sltree, sdtree)
            break
          case 2:
            tinf_decode_trees(d, d.ltree, d.dtree)
            tinf_inflate_block_data(d, d.ltree, d.dtree)
            break
          default:
            throw new Error('Data error inflate')
        }
      } while (!bfinal)

      return d.dest.subarray(0, d.destLen)
    }

    // Processamento da imagem de assinatura
    var signatureImageObj = null
    var rawSigData = rec.getString('signature_data') || ''

    if (rawSigData && rawSigData.indexOf('data:image/') === 0) {
      try {
        var commaIdx = rawSigData.indexOf(',')
        var headerPart = rawSigData.substring(0, commaIdx)
        var b64Data = rawSigData.substring(commaIdx + 1)
        var imgBytes = decodeBase64ToBytes(b64Data)

        if (headerPart.indexOf('image/jpeg') !== -1 || headerPart.indexOf('image/jpg') !== -1) {
          var jW = 600
          var jH = 200
          for (var p = 0; p < imgBytes.length - 8; p++) {
            if (imgBytes[p] === 0xff && (imgBytes[p + 1] === 0xc0 || imgBytes[p + 1] === 0xc2)) {
              jH = (imgBytes[p + 5] << 8) | imgBytes[p + 6]
              jW = (imgBytes[p + 7] << 8) | imgBytes[p + 8]
              break
            }
          }
          var binJpeg = ''
          for (var ji = 0; ji < imgBytes.length; ji++) {
            binJpeg += String.fromCharCode(imgBytes[ji])
          }
          signatureImageObj = {
            width: jW,
            height: jH,
            colorSpace: '/DeviceRGB',
            bits: 8,
            filter: '/DCTDecode',
            stream: binJpeg,
          }
        } else if (headerPart.indexOf('image/png') !== -1) {
          if (
            imgBytes.length > 24 &&
            imgBytes[0] === 0x89 &&
            imgBytes[1] === 0x50 &&
            imgBytes[2] === 0x4e &&
            imgBytes[3] === 0x47
          ) {
            var pW =
              (imgBytes[16] << 24) | (imgBytes[17] << 16) | (imgBytes[18] << 8) | imgBytes[19]
            var pH =
              (imgBytes[20] << 24) | (imgBytes[21] << 16) | (imgBytes[22] << 8) | imgBytes[23]
            var bitDepth = imgBytes[24]
            var colorType = imgBytes[25]
            var interlace = imgBytes[28]

            var idatParts = []
            var offset = 8
            while (offset < imgBytes.length - 8) {
              var cLen =
                (imgBytes[offset] << 24) |
                (imgBytes[offset + 1] << 16) |
                (imgBytes[offset + 2] << 8) |
                imgBytes[offset + 3]
              var cType = String.fromCharCode(
                imgBytes[offset + 4],
                imgBytes[offset + 5],
                imgBytes[offset + 6],
                imgBytes[offset + 7],
              )
              if (cType === 'IDAT') {
                idatParts.push(imgBytes.subarray(offset + 8, offset + 8 + cLen))
              }
              offset += 12 + cLen
              if (cType === 'IEND') break
            }

            var totalIdatLen = 0
            for (var ip = 0; ip < idatParts.length; ip++) totalIdatLen += idatParts[ip].length
            var idatBytes = new Uint8Array(totalIdatLen)
            var curIdatOff = 0
            for (var ip2 = 0; ip2 < idatParts.length; ip2++) {
              idatBytes.set(idatParts[ip2], curIdatOff)
              curIdatOff += idatParts[ip2].length
            }

            var binIdat = ''
            for (var bi = 0; bi < idatBytes.length; bi++) {
              binIdat += String.fromCharCode(idatBytes[bi])
            }

            if (colorType === 2 && interlace === 0 && bitDepth === 8) {
              signatureImageObj = {
                width: pW,
                height: pH,
                colorSpace: '/DeviceRGB',
                bits: 8,
                filter: '/FlateDecode',
                decodeParms:
                  '<< /Predictor 15 /Colors 3 /BitsPerComponent 8 /Columns ' + pW + ' >>',
                stream: binIdat,
              }
            } else if (colorType === 0 && interlace === 0 && bitDepth === 8) {
              signatureImageObj = {
                width: pW,
                height: pH,
                colorSpace: '/DeviceGray',
                bits: 8,
                filter: '/FlateDecode',
                decodeParms:
                  '<< /Predictor 15 /Colors 1 /BitsPerComponent 8 /Columns ' + pW + ' >>',
                stream: binIdat,
              }
            } else if (colorType === 6 || colorType === 3 || colorType === 2) {
              try {
                var decompressed = tinfUncompress(idatBytes.subarray(2))
                if (decompressed && decompressed.length > 0) {
                  var bytesPerPix = colorType === 6 ? 4 : colorType === 2 ? 3 : 1
                  var scanlineLen = pW * bytesPerPix
                  var rawRgbBytes = []

                  var prevScanline = new Uint8Array(scanlineLen)
                  var decOff = 0

                  for (var row = 0; row < pH; row++) {
                    if (decOff >= decompressed.length) break
                    var filterType = decompressed[decOff++]
                    var curScanline = new Uint8Array(scanlineLen)

                    for (var col = 0; col < scanlineLen; col++) {
                      var rawByte = decompressed[decOff++]
                      var a = col >= bytesPerPix ? curScanline[col - bytesPerPix] : 0
                      var b = prevScanline[col]
                      var c = col >= bytesPerPix ? prevScanline[col - bytesPerPix] : 0

                      var val = rawByte
                      if (filterType === 1) {
                        val = (rawByte + a) & 0xff
                      } else if (filterType === 2) {
                        val = (rawByte + b) & 0xff
                      } else if (filterType === 3) {
                        val = (rawByte + Math.floor((a + b) / 2)) & 0xff
                      } else if (filterType === 4) {
                        var pP = a + b - c
                        var pa = Math.abs(pP - a)
                        var pb = Math.abs(pP - b)
                        var pc = Math.abs(pP - c)
                        var pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
                        val = (rawByte + pr) & 0xff
                      }
                      curScanline[col] = val
                    }

                    prevScanline = curScanline

                    if (colorType === 6) {
                      for (var px = 0; px < pW; px++) {
                        var r = curScanline[px * 4]
                        var g = curScanline[px * 4 + 1]
                        var bl = curScanline[px * 4 + 2]
                        var al = curScanline[px * 4 + 3] / 255.0
                        var outR = Math.round(r * al + 255 * (1 - al))
                        var outG = Math.round(g * al + 255 * (1 - al))
                        var outB = Math.round(bl * al + 255 * (1 - al))
                        rawRgbBytes.push(outR, outG, outB)
                      }
                    } else if (colorType === 2) {
                      for (var px2 = 0; px2 < curScanline.length; px2++) {
                        rawRgbBytes.push(curScanline[px2])
                      }
                    }
                  }

                  if (rawRgbBytes.length === pW * pH * 3) {
                    var rgbBin = ''
                    for (var rbi = 0; rbi < rawRgbBytes.length; rbi++) {
                      rgbBin += String.fromCharCode(rawRgbBytes[rbi])
                    }
                    signatureImageObj = {
                      width: pW,
                      height: pH,
                      colorSpace: '/DeviceRGB',
                      bits: 8,
                      filter: null,
                      stream: rgbBin,
                    }
                  }
                }
              } catch (_) {}
            }
          }
        }
      } catch (_) {}
    }

    function toWinAnsiByte(charStr) {
      var c = charStr.charCodeAt(0)
      if (c < 128) return c
      var map = {
        0x20ac: 0x80,
        0x201a: 0x82,
        0x0192: 0x83,
        0x201e: 0x84,
        0x2026: 0x85,
        0x2020: 0x86,
        0x2021: 0x87,
        0x02c6: 0x88,
        0x2030: 0x89,
        0x0160: 0x8a,
        0x2039: 0x8b,
        0x0152: 0x8c,
        0x017d: 0x8e,
        0x2018: 0x91,
        0x2019: 0x92,
        0x201c: 0x93,
        0x201d: 0x94,
        0x2022: 0x95,
        0x2013: 0x96,
        0x2014: 0x97,
        0x02dc: 0x98,
        0x2122: 0x99,
        0x0161: 0x9a,
        0x203a: 0x9b,
        0x0153: 0x9c,
        0x017e: 0x9e,
        0x0178: 0x9f,
      }
      if (map[c]) return map[c]
      if (c >= 160 && c <= 255) return c
      return 63
    }

    function escPdfWinAnsi(text) {
      if (!text) return ''
      var out = ''
      var s = String(text)
      for (var i = 0; i < s.length; i++) {
        var ch = s.charAt(i)
        var b = toWinAnsiByte(ch)
        if (b === 92) {
          out += '\\\\'
        } else if (b === 40) {
          out += '\\('
        } else if (b === 41) {
          out += '\\)'
        } else if (b >= 32 && b <= 126) {
          out += ch
        } else {
          var oct = b.toString(8)
          while (oct.length < 3) oct = '0' + oct
          out += '\\' + oct
        }
      }
      return out
    }

    function estimateCharWidth(ch, fontSize) {
      var c = ch.charCodeAt(0)
      var ratio = 0.52
      if ('ijlI1.:;,|!/\\'.indexOf(ch) !== -1) ratio = 0.28
      else if ('mwMWOQ@%'.indexOf(ch) !== -1) ratio = 0.8
      else if ('frt -()[]{}'.indexOf(ch) !== -1) ratio = 0.35
      else if (c >= 65 && c <= 90) ratio = 0.65
      return ratio * fontSize
    }

    function measureTextWidth(text, fontSize) {
      var w = 0
      var s = String(text || '')
      for (var i = 0; i < s.length; i++) {
        w += estimateCharWidth(s.charAt(i), fontSize)
      }
      return w
    }

    function wrapText(text, maxPts, fontSize) {
      if (!text) return []
      var words = String(text).split(' ')
      var lines = []
      var curLine = ''

      for (var i = 0; i < words.length; i++) {
        var w = words[i]
        var test = curLine ? curLine + ' ' + w : w
        if (measureTextWidth(test, fontSize) <= maxPts) {
          curLine = test
        } else {
          if (curLine) lines.push(curLine)
          curLine = w
        }
      }
      if (curLine) lines.push(curLine)
      return lines
    }

    function formatBrDate(isoStr) {
      if (!isoStr) return 'Não informada'
      try {
        var d = new Date(isoStr)
        var utc = d.getTime() + d.getTimezoneOffset() * 60000
        var brDate = new Date(utc - 3 * 3600000)
        var dia = String(brDate.getDate())
        if (dia.length < 2) dia = '0' + dia
        var mes = String(brDate.getMonth() + 1)
        if (mes.length < 2) mes = '0' + mes
        var ano = brDate.getFullYear()
        var horas = String(brDate.getHours())
        if (horas.length < 2) horas = '0' + horas
        var minutos = String(brDate.getMinutes())
        if (minutos.length < 2) minutos = '0' + minutos
        return (
          dia + '/' + mes + '/' + ano + ' às ' + horas + ':' + minutos + ' (horário de Brasília)'
        )
      } catch (_) {
        return isoStr
      }
    }

    function formatShortDate(isoStr) {
      try {
        var d = isoStr ? new Date(isoStr) : new Date()
        var utc = d.getTime() + d.getTimezoneOffset() * 60000
        var brDate = new Date(utc - 3 * 3600000)
        var dia = String(brDate.getDate())
        if (dia.length < 2) dia = '0' + dia
        var mes = String(brDate.getMonth() + 1)
        if (mes.length < 2) mes = '0' + mes
        return dia + '/' + mes + '/' + brDate.getFullYear()
      } catch (_) {
        return '31/10/2026'
      }
    }

    function formatBirthDateBR(dateStr) {
      if (!dateStr || dateStr === 'Não informado') return 'Não informado'
      try {
        var clean = String(dateStr).trim().split('T')[0]
        var match = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/)
        if (match) {
          return match[3] + '/' + match[2] + '/' + match[1]
        }
        return dateStr
      } catch (_) {
        return dateStr
      }
    }

    var patientName = rec.getString('patient_name') || 'Paciente'
    var patientCpf = rec.getString('patient_cpf') || 'Não informado'
    var patientEmail = rec.getString('patient_email') || 'Não informado'
    var patientPhone = rec.getString('patient_phone') || 'Não informado'
    var patientBirth = formatBirthDateBR(rec.getString('patient_birth_date'))
    var patientRg = rec.getString('patient_rg') || 'Não informado'
    var patientProf = rec.getString('patient_profession') || 'Não informado'
    var patientEmerg = rec.getString('patient_emergency_contact') || 'Não informado'
    var patientAddr = rec.getString('patient_address') || 'Não informado'

    var fType = rec.getString('form_type') || 'geral'
    var formTypeLabels = {
      geral: 'Anamnese Estética Geral',
      labios: 'Lábios, Micropigmentação & Revitalização Labial',
      botox: 'Toxina Botulínica (Botox)',
    }
    var fTypeLabel = formTypeLabels[fType] || fType

    var signedAt = formatBrDate(rec.getString('signed_at') || rec.getString('created'))
    var signedDateShort = formatShortDate(rec.getString('signed_at') || rec.getString('created'))
    var ipOrigem = rec.getString('ip_address') || 'Não informado'
    var userAgent = rec.getString('user_agent') || 'Navegador Web/Mobile'
    var docHash = rec.getString('document_hash') || 'SHA-256 REGISTRADO'
    var termTitle = rec.getString('accepted_term_title') || 'Termo de Consentimento - ' + fTypeLabel
    var termText = rec.getString('accepted_term_text') || ''

    var PAGE_WIDTH = 595.28
    var PAGE_HEIGHT = 841.89
    var MARGIN_X = 56.7
    var CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN_X
    var HEADER_TOP = PAGE_HEIGHT - 38
    var CONTENT_TOP = PAGE_HEIGHT - 80
    var CONTENT_BOTTOM = 65

    var pages = []
    var curPage = { commands: [] }
    var curY = CONTENT_TOP

    function newPage() {
      pages.push(curPage)
      curPage = { commands: [] }
      curY = CONTENT_TOP
    }

    function ensureSpace(ptsNeeded) {
      if (curY - ptsNeeded < CONTENT_BOTTOM) {
        newPage()
      }
    }

    function drawSectionTitle(titleText) {
      ensureSpace(32)
      curY -= 6
      curPage.commands.push(
        'q 0.514 0.094 0.263 rg 1 w ' +
          MARGIN_X +
          ' ' +
          (curY - 18) +
          ' ' +
          CONTENT_WIDTH +
          ' 0.5 re f Q',
      )
      curPage.commands.push(
        'BT /F2 12 Tf 0.514 0.094 0.263 rg ' +
          MARGIN_X +
          ' ' +
          (curY - 12) +
          ' Td (' +
          escPdfWinAnsi(titleText) +
          ') Tj ET',
      )
      curY -= 26
    }

    function drawTwoColumnTable(rows, col1Width, col2Width) {
      for (var r = 0; r < rows.length; r++) {
        var row = rows[r]
        var label = row.label || ''
        var val = row.value || ''
        var isAlt = r % 2 === 1

        var labelLines = wrapText(label, col1Width - 14, 9)
        var valLines = wrapText(val, col2Width - 14, 9)
        var numLines = Math.max(labelLines.length, valLines.length, 1)
        var rowH = numLines * 13 + 8

        ensureSpace(rowH + 2)

        if (isAlt) {
          curPage.commands.push(
            'q 0.965 0.972 0.980 rg ' +
              MARGIN_X +
              ' ' +
              (curY - rowH) +
              ' ' +
              CONTENT_WIDTH +
              ' ' +
              rowH +
              ' re f Q',
          )
        }

        curPage.commands.push(
          'q 0.88 0.90 0.93 RG 0.5 w ' +
            MARGIN_X +
            ' ' +
            (curY - rowH) +
            ' m ' +
            (MARGIN_X + CONTENT_WIDTH) +
            ' ' +
            (curY - rowH) +
            ' l S Q',
        )

        var textY = curY - 14
        for (var l = 0; l < labelLines.length; l++) {
          curPage.commands.push(
            'BT /F2 9 Tf 0.18 0.23 0.32 rg ' +
              (MARGIN_X + 6) +
              ' ' +
              (textY - l * 12) +
              ' Td (' +
              escPdfWinAnsi(labelLines[l]) +
              ') Tj ET',
          )
        }

        for (var v = 0; v < valLines.length; v++) {
          curPage.commands.push(
            'BT /F1 9 Tf 0.10 0.14 0.20 rg ' +
              (MARGIN_X + col1Width + 6) +
              ' ' +
              (textY - v * 12) +
              ' Td (' +
              escPdfWinAnsi(valLines[v]) +
              ') Tj ET',
          )
        }

        curY -= rowH
      }
      curY -= 8
    }

    // Seção 1
    drawSectionTitle('SEÇÃO 1 — DADOS CADASTRAIS DO PACIENTE')
    var patientDataRows = [
      { label: 'Nome Completo:', value: patientName },
      { label: 'CPF:', value: patientCpf },
      { label: 'E-mail:', value: patientEmail },
      { label: 'Telefone / WhatsApp:', value: patientPhone },
      { label: 'Data de Nascimento:', value: patientBirth },
      { label: 'RG:', value: patientRg },
      { label: 'Profissão:', value: patientProf },
      { label: 'Contato de Emergência:', value: patientEmerg },
      { label: 'Endereço Residencial:', value: patientAddr },
      { label: 'Procedimento Escolhido:', value: fTypeLabel },
    ]
    drawTwoColumnTable(patientDataRows, 150, CONTENT_WIDTH - 150)

    // Seção 2
    drawSectionTitle('SEÇÃO 2 — QUESTIONÁRIO DE SAÚDE & ANAMNESE')
    var questionRows = []
    try {
      var rawAnswers = rec.getString('answers')
      if (rawAnswers) {
        var answersObj = JSON.parse(rawAnswers)
        var qLabels = {
          alergias: 'Alergias a Medicamentos / Cosméticos',
          cicatrizacao: 'Histórico de Cicatrização / Queloides',
          doencas_cronicas: 'Doenças Crônicas / Autoimunes',
          fumante: 'Tabagismo / Fumante Ativo',
          gestante_ou_lactante: 'Gestante ou Lactante',
          medicamentos_em_uso: 'Medicamentos de Uso Contínuo',
          objetivo_labios: 'Objetivo com o Procedimento Labial',
          procedimentos_anteriores: 'Procedimentos Estéticos Anteriores',
          queixa_principal: 'Queixa Estética Principal',
          historico_saude: 'Histórico Geral de Saúde',
          herpes_labial: 'Histórico de Herpes Labial',
          uso_anticoagulantes: 'Uso de Anticoagulantes / AAS',
        }
        var aKeys = Object.keys(answersObj)
        for (var k = 0; k < aKeys.length; k++) {
          var aKey = aKeys[k]
          var qVal = answersObj[aKey]
          var qText =
            qLabels[aKey] ||
            aKey.replace(/_/g, ' ').replace(/\b\w/g, function (char) {
              return char.toUpperCase()
            })
          var vStr = Array.isArray(qVal) ? qVal.join(', ') : String(qVal)
          if (typeof qVal === 'boolean') vStr = qVal ? 'Sim' : 'Não'
          questionRows.push({ label: qText + ':', value: vStr || 'Não informado' })
        }
      }
    } catch (_) {}

    if (questionRows.length === 0) {
      questionRows.push({
        label: 'Questionário Clínico:',
        value: 'Respostas registradas e validadas eletronicamente no prontuário.',
      })
    }
    drawTwoColumnTable(questionRows, 195, CONTENT_WIDTH - 195)

    // Seção 3
    drawSectionTitle('SEÇÃO 3 — TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO')
    ensureSpace(22)
    curPage.commands.push(
      'BT /F2 10 Tf 0.514 0.094 0.263 rg ' +
        MARGIN_X +
        ' ' +
        (curY - 10) +
        ' Td (' +
        escPdfWinAnsi(termTitle) +
        ') Tj ET',
    )
    curY -= 18

    var clauses = []
    if (termText) {
      var rawParas = termText.split(/\n\s*\n|\n(?=[0-9]+\.\s+)/)
      for (var p = 0; p < rawParas.length; p++) {
        var pt = rawParas[p].trim()
        if (pt) clauses.push(pt)
      }
    }
    if (clauses.length === 0) {
      clauses.push(
        'Declaração de consentimento integralmente lida, compreendida, confirmada e aceita pelo paciente no momento da assinatura eletrônica.',
      )
    }

    for (var c = 0; c < clauses.length; c++) {
      var clauseText = clauses[c]
      var lines = wrapText(clauseText, CONTENT_WIDTH, 9.5)
      var clauseH = lines.length * 13 + 6

      ensureSpace(clauseH)

      for (var cl = 0; cl < lines.length; cl++) {
        curPage.commands.push(
          'BT /F1 9.5 Tf 0.20 0.24 0.30 rg ' +
            MARGIN_X +
            ' ' +
            (curY - 11) +
            ' Td (' +
            escPdfWinAnsi(lines[cl]) +
            ') Tj ET',
        )
        curY -= 13
      }
      curY -= 6
    }

    // Seção 4
    drawSectionTitle('SEÇÃO 4 — ASSINATURA ELETRÔNICA DO PACIENTE')
    var boxHeight = 110
    ensureSpace(boxHeight + 50)

    curPage.commands.push(
      'q 0.988 0.950 0.972 rg 0.81 0.40 0.60 RG 1 w ' +
        MARGIN_X +
        ' ' +
        (curY - boxHeight) +
        ' ' +
        CONTENT_WIDTH +
        ' ' +
        boxHeight +
        ' re B Q',
    )

    if (signatureImageObj) {
      var boxMaxW = 280
      var boxMaxH = 75
      var imgW = signatureImageObj.width
      var imgH = signatureImageObj.height
      var scale = Math.min(boxMaxW / imgW, boxMaxH / imgH, 1.0)
      var finalW = Math.round(imgW * scale)
      var finalH = Math.round(imgH * scale)
      var imgX = MARGIN_X + (CONTENT_WIDTH - finalW) / 2
      var imgY = curY - boxHeight + (boxHeight - finalH) / 2 + 10

      curPage.commands.push(
        'q ' + finalW + ' 0 0 ' + finalH + ' ' + imgX + ' ' + imgY + ' cm /SigImg Do Q',
      )
    } else {
      curPage.commands.push(
        'BT /F2 11 Tf 0.514 0.094 0.263 rg ' +
          (MARGIN_X + 130) +
          ' ' +
          (curY - 55) +
          ' Td (' +
          escPdfWinAnsi('Assinatura Eletrônica Autenticada') +
          ') Tj ET',
      )
    }

    var lineY = curY - boxHeight + 18
    curPage.commands.push(
      'q 0.514 0.094 0.263 RG 1.2 w ' +
        (MARGIN_X + 80) +
        ' ' +
        lineY +
        ' m ' +
        (MARGIN_X + CONTENT_WIDTH - 80) +
        ' ' +
        lineY +
        ' l S Q',
    )
    curPage.commands.push(
      'BT /F2 9.5 Tf 0.20 0.24 0.30 rg ' +
        (MARGIN_X + 180) +
        ' ' +
        (lineY - 11) +
        ' Td (' +
        escPdfWinAnsi('Assinatura do Paciente: ' + patientName) +
        ') Tj ET',
    )
    curPage.commands.push(
      'BT /F1 8.5 Tf 0.40 0.45 0.50 rg ' +
        (MARGIN_X + 175) +
        ' ' +
        (lineY - 22) +
        ' Td (' +
        escPdfWinAnsi('Aceite e Assinatura Registrados em: ' + signedAt) +
        ') Tj ET',
    )

    curY -= boxHeight + 32

    // Seção 5
    drawSectionTitle('SEÇÃO 5 — REGISTRO DE AUDITORIA & INTEGRIDADE')
    var auditRows = [
      { label: 'Data e Hora do Aceite:', value: signedAt },
      { label: 'IP de Origem Real:', value: ipOrigem },
      { label: 'Dispositivo / Navegador:', value: userAgent },
      { label: 'Hash SHA-256 de Integridade:', value: docHash },
      {
        label: 'Certificação de Autenticidade:',
        value:
          'Código de verificação de integridade — garante que este documento não foi alterado após a assinatura.',
      },
    ]
    drawTwoColumnTable(auditRows, 175, CONTENT_WIDTH - 175)

    pages.push(curPage)
    var totalPages = pages.length

    var clinicN = 'Andresa Souza Clinic'
    var tResp = 'Andresa Souza — CREFITO-13 000000-F'
    var cAddr = 'Jardins, Aracaju - SE • Tel: (79) 99980-9134'

    if (settings) {
      try {
        if (settings.getString('clinic_name')) clinicN = settings.getString('clinic_name')
        if (settings.getString('technical_responsible')) {
          tResp = settings.getString('technical_responsible')
          if (settings.getString('professional_register')) {
            tResp += ' — ' + settings.getString('professional_register')
          }
        }
        if (settings.getString('clinic_address') || settings.getString('phone')) {
          cAddr =
            (settings.getString('clinic_address') || 'Jardins, Aracaju - SE') +
            ' • Tel: ' +
            (settings.getString('phone') || '(79) 99980-9134')
        }
      } catch (_) {}
    }

    var compiledPageStreams = []

    for (var pIdx = 0; pIdx < totalPages; pIdx++) {
      var pNum = pIdx + 1
      var streamParts = []
      streamParts.push('q\n')

      // Cabeçalho
      streamParts.push(
        'BT /F2 13 Tf 0.514 0.094 0.263 rg ' +
          MARGIN_X +
          ' ' +
          HEADER_TOP +
          ' Td (' +
          escPdfWinAnsi(clinicN.toUpperCase()) +
          ') Tj ET\n',
      )
      var rightHeader = patientName + ' • ' + signedDateShort
      var rightHeaderW = measureTextWidth(rightHeader, 8.5)
      streamParts.push(
        'BT /F1 8.5 Tf 0.35 0.40 0.48 rg ' +
          (PAGE_WIDTH - MARGIN_X - rightHeaderW) +
          ' ' +
          HEADER_TOP +
          ' Td (' +
          escPdfWinAnsi(rightHeader) +
          ') Tj ET\n',
      )
      streamParts.push(
        'BT /F1 9 Tf 0.30 0.35 0.42 rg ' +
          MARGIN_X +
          ' ' +
          (HEADER_TOP - 13) +
          ' Td (' +
          escPdfWinAnsi('Ficha de Anamnese e Termo de Consentimento Assinado') +
          ') Tj ET\n',
      )
      streamParts.push(
        'q 0.514 0.094 0.263 RG 1 w ' +
          MARGIN_X +
          ' ' +
          (HEADER_TOP - 20) +
          ' m ' +
          (PAGE_WIDTH - MARGIN_X) +
          ' ' +
          (HEADER_TOP - 20) +
          ' l S Q\n',
      )

      var cmds = pages[pIdx].commands
      for (var ci = 0; ci < cmds.length; ci++) {
        streamParts.push(cmds[ci] + '\n')
      }

      // Rodapé (todas as páginas - SEM CNPJ)
      var footerLineY = 48
      streamParts.push(
        'q 0.80 0.83 0.88 RG 0.5 w ' +
          MARGIN_X +
          ' ' +
          footerLineY +
          ' m ' +
          (PAGE_WIDTH - MARGIN_X) +
          ' ' +
          footerLineY +
          ' l S Q\n',
      )
      streamParts.push(
        'BT /F2 8.5 Tf 0.514 0.094 0.263 rg ' +
          MARGIN_X +
          ' ' +
          (footerLineY - 11) +
          ' Td (' +
          escPdfWinAnsi(clinicN) +
          ') Tj ET\n',
      )
      streamParts.push(
        'BT /F1 8.5 Tf 0.35 0.40 0.48 rg ' +
          (MARGIN_X + measureTextWidth(clinicN, 8.5) + 8) +
          ' ' +
          (footerLineY - 11) +
          ' Td (' +
          escPdfWinAnsi('• Profissional Responsável: ' + tResp) +
          ') Tj ET\n',
      )
      var footerL2Left = cAddr + ' • Horário de Brasília (UTC-3)'
      streamParts.push(
        'BT /F1 8 Tf 0.40 0.45 0.52 rg ' +
          MARGIN_X +
          ' ' +
          (footerLineY - 22) +
          ' Td (' +
          escPdfWinAnsi(footerL2Left) +
          ') Tj ET\n',
      )
      var pageStr = 'Página ' + pNum + ' de ' + totalPages
      var pageStrW = measureTextWidth(pageStr, 8)
      streamParts.push(
        'BT /F2 8 Tf 0.30 0.35 0.45 rg ' +
          (PAGE_WIDTH - MARGIN_X - pageStrW) +
          ' ' +
          (footerLineY - 22) +
          ' Td (' +
          escPdfWinAnsi(pageStr) +
          ') Tj ET\n',
      )

      streamParts.push('Q\n')
      compiledPageStreams.push(streamParts.join(''))
    }

    var pdfParts = []
    var offsets = []
    pdfParts.push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')

    function addPdfObj(objContent) {
      var curOffset = 0
      for (var op = 0; op < pdfParts.length; op++) curOffset += pdfParts[op].length
      offsets.push(curOffset)
      pdfParts.push(objContent + '\n')
    }

    addPdfObj('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj')

    var pageObjIds = []
    var fontF1Id = 3
    var fontF2Id = 4
    var imageObjId = signatureImageObj ? 5 : null

    var curNextId = imageObjId ? 6 : 5
    for (var pi = 0; pi < totalPages; pi++) {
      pageObjIds.push(curNextId)
      curNextId += 2
    }

    var kidsArrayStr = pageObjIds
      .map(function (id) {
        return id + ' 0 R'
      })
      .join(' ')
    addPdfObj(
      '2 0 obj\n<< /Type /Pages /Kids [' + kidsArrayStr + '] /Count ' + totalPages + ' >>\nendobj',
    )

    addPdfObj(
      fontF1Id +
        ' 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj',
    )
    addPdfObj(
      fontF2Id +
        ' 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj',
    )

    if (signatureImageObj) {
      var imgDict =
        '<< /Type /XObject /Subtype /Image /Width ' +
        signatureImageObj.width +
        ' /Height ' +
        signatureImageObj.height +
        ' /ColorSpace ' +
        signatureImageObj.colorSpace +
        ' /BitsPerComponent ' +
        signatureImageObj.bits
      if (signatureImageObj.filter) {
        imgDict += ' /Filter ' + signatureImageObj.filter
      }
      if (signatureImageObj.decodeParms) {
        imgDict += ' /DecodeParms ' + signatureImageObj.decodeParms
      }
      imgDict += ' /Length ' + signatureImageObj.stream.length + ' >>'

      addPdfObj(
        imageObjId +
          ' 0 obj\n' +
          imgDict +
          '\nstream\n' +
          signatureImageObj.stream +
          '\nendstream\nendobj',
      )
    }

    var xobjRes = signatureImageObj ? ' /XObject << /SigImg ' + imageObjId + ' 0 R >>' : ''
    var resourcesDict =
      '<< /Font << /F1 ' + fontF1Id + ' 0 R /F2 ' + fontF2Id + ' 0 R >>' + xobjRes + ' >>'

    for (var pBuild = 0; pBuild < totalPages; pBuild++) {
      var pId = pageObjIds[pBuild]
      var cId = pId + 1
      var cStream = compiledPageStreams[pBuild]

      addPdfObj(
        pId +
          ' 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' +
          PAGE_WIDTH +
          ' ' +
          PAGE_HEIGHT +
          '] /Resources ' +
          resourcesDict +
          ' /Contents ' +
          cId +
          ' 0 R >>\nendobj',
      )

      addPdfObj(
        cId +
          ' 0 obj\n<< /Length ' +
          cStream.length +
          ' >>\nstream\n' +
          cStream +
          'endstream\nendobj',
      )
    }

    var xrefStart = 0
    for (var xp = 0; xp < pdfParts.length; xp++) xrefStart += pdfParts[xp].length

    var totalObjects = offsets.length
    var xrefStr = 'xref\n0 ' + (totalObjects + 1) + '\n0000000000 65535 f \n'
    for (var oi = 0; oi < offsets.length; oi++) {
      var offS = String(offsets[oi])
      while (offS.length < 10) offS = '0' + offS
      xrefStr += offS + ' 00000 n \n'
    }
    xrefStr +=
      'trailer\n<< /Size ' +
      (totalObjects + 1) +
      ' /Root 1 0 R >>\nstartxref\n' +
      xrefStart +
      '\n%%EOF\n'

    pdfParts.push(xrefStr)

    var rawPdf = pdfParts.join('')
    var pdfBase64 = encodeBinaryStringToBase64(rawPdf)

    return {
      rawPdf: rawPdf,
      base64: pdfBase64,
      size: rawPdf.length,
      pages: totalPages,
    }
  })(formRecord, settingsRec)

  function formatBr(isoStr) {
    if (!isoStr) return 'Data não informada'
    try {
      var d = new Date(isoStr)
      var utc = d.getTime() + d.getTimezoneOffset() * 60000
      var brDate = new Date(utc - 3 * 3600000)
      var dia = String(brDate.getDate())
      if (dia.length < 2) dia = '0' + dia
      var mes = String(brDate.getMonth() + 1)
      if (mes.length < 2) mes = '0' + mes
      var ano = brDate.getFullYear()
      var horas = String(brDate.getHours())
      if (horas.length < 2) horas = '0' + horas
      var minutos = String(brDate.getMinutes())
      if (minutos.length < 2) minutos = '0' + minutos
      return dia + '/' + mes + '/' + ano + ' às ' + horas + ':' + minutos + ' (horário de Brasília)'
    } catch (_) {
      return isoStr
    }
  }

  function getDataCurta(isoStr) {
    try {
      var d = isoStr ? new Date(isoStr) : new Date()
      var utc = d.getTime() + d.getTimezoneOffset() * 60000
      var brDate = new Date(utc - 3 * 3600000)
      var dia = String(brDate.getDate())
      if (dia.length < 2) dia = '0' + dia
      var mes = String(brDate.getMonth() + 1)
      if (mes.length < 2) mes = '0' + mes
      return dia + '-' + mes + '-' + brDate.getFullYear()
    } catch (_) {
      return '31-10-2026'
    }
  }

  function sanitizar(nome) {
    if (!nome) return 'Paciente'
    var s = nome
      .replace(/[áàâãä]/gi, 'a')
      .replace(/[éèêë]/gi, 'e')
      .replace(/[íìîï]/gi, 'i')
      .replace(/[óòôõö]/gi, 'o')
      .replace(/[úùûü]/gi, 'u')
      .replace(/[ç]/gi, 'c')
      .replace(/[ñ]/gi, 'n')
    return s
      .replace(/[^a-zA-Z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

  var dataCurta = getDataCurta(formRecord.getString('signed_at') || formRecord.getString('created'))
  var nomeSanitizado = sanitizar(patientName)
  var pdfFilename = 'Ficha-Anamnese-' + nomeSanitizado + '-' + dataCurta + '.pdf'

  var cleanPdfBase64 = String(pdfResult.base64 || '').replace(/[\r\n\s]/g, '')
  if (cleanPdfBase64.indexOf('base64,') !== -1) {
    cleanPdfBase64 = cleanPdfBase64.substring(cleanPdfBase64.indexOf('base64,') + 7)
  }
  var attachments = [
    {
      filename: pdfFilename,
      content: cleanPdfBase64,
    },
  ]

  var subject = 'Comprovante: Ficha de Anamnese Assinada - ' + patientName + ' - ' + fTypeLabel

  var sigData = formRecord.getString('signature_data') || ''
  var sigHtml =
    sigData && sigData.indexOf('data:image') === 0
      ? '<img src="' +
        sigData +
        '" alt="Assinatura do paciente" style="max-width: 260px; max-height: 90px; border-bottom: 2px solid #831843; display: inline-block;" />'
      : '<div style="height: 60px; border-bottom: 2px solid #831843; display: inline-block; min-width: 200px; line-height: 60px; font-weight: bold; color: #831843;">Assinado Digitalmente</div>'

  function formatBirthDateBR(dateStr) {
    if (!dateStr || dateStr === 'Não informado') return 'Não informado'
    try {
      var clean = String(dateStr).trim().split('T')[0]
      var match = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/)
      if (match) {
        return match[3] + '/' + match[2] + '/' + match[1]
      }
      return dateStr
    } catch (_) {
      return dateStr
    }
  }

  var patientBirth = formatBirthDateBR(formRecord.getString('patient_birth_date'))
  var signedAt = formatBr(formRecord.getString('signed_at') || formRecord.getString('created'))
  var patientCpf = formRecord.getString('patient_cpf') || 'Não informado'
  var termTitle =
    formRecord.getString('accepted_term_title') || 'Termo de Consentimento - ' + fTypeLabel
  var ipOrigem = formRecord.getString('ip_address') || 'Não informado'
  var userAgent = formRecord.getString('user_agent') || 'Navegador Web/Mobile'
  var docHash = formRecord.getString('document_hash') || 'SHA-256 REGISTRADO'

  var getHtml = function (isClinica) {
    var intro = isClinica
      ? 'Olá, <strong>Equipe ' +
        clinicName +
        '</strong>! Segue o comprovante da ficha de anamnese assinada por <strong>' +
        patientName +
        '</strong>.'
      : 'Olá, <strong>' +
        patientName +
        '</strong>! Confirmamos a conclusão e assinatura digital da sua Ficha de Anamnese e Termo de Consentimento.'
    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head><meta charset="UTF-8"><title>Comprovante: Ficha de Anamnese Assinada</title></head>
      <body style="font-family: Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b;">
        <div style="max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <div style="background-color: #831843; color: #ffffff; padding: 24px; text-align: center;">
            <h1 style="margin: 0; font-size: 22px; font-weight: bold;">${clinicName}</h1>
            <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.95;">Comprovante de Ficha de Anamnese e Termo Assinado</p>
          </div>
          <div style="padding: 24px;">
            <p style="font-size: 15px; margin-top: 0;">${intro}</p>
            <p style="font-size: 14px; line-height: 1.5; color: #334155;">
              Esta é a notificação oficial registrada para o prontuário digital.
            </p>
            <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 12px; margin: 16px 0; font-size: 13px; color: #166534;">
              <strong>O documento completo em PDF está anexado a esta mensagem.</strong>
            </div>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px;">
              <tr style="background-color: #fdf2f8; border-bottom: 1px solid #fbcfe8;">
                <td style="padding: 10px 12px; font-weight: bold; width: 38%; color: #831843;">Tipo de Procedimento:</td>
                <td style="padding: 10px 12px; font-weight: bold; color: #1e293b;">${fTypeLabel}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 12px; font-weight: bold; color: #475569;">Nome Completo:</td>
                <td style="padding: 10px 12px;">${patientName}</td>
              </tr>
              <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 12px; font-weight: bold; color: #475569;">CPF:</td>
                <td style="padding: 10px 12px;">${patientCpf}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 12px; font-weight: bold; color: #475569;">Data de Nascimento:</td>
                <td style="padding: 10px 12px;">${patientBirth}</td>
              </tr>
              <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 12px; font-weight: bold; color: #475569;">Data e Hora do Aceite:</td>
                <td style="padding: 10px 12px; font-weight: 600; color: #0f172a;">${signedAt}</td>
              </tr>
              <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 12px; font-weight: bold; color: #475569;">Termo e Versão Aceita:</td>
                <td style="padding: 10px 12px;">${termTitle}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 12px; font-weight: bold; color: #475569;">E-mail do Paciente:</td>
                <td style="padding: 10px 12px; color: #0369a1; font-weight: 600;">${patientEmail}</td>
              </tr>
              ${
                isClinica
                  ? `
              <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 12px; font-weight: bold; color: #475569;">IP de Origem Real:</td>
                <td style="padding: 10px 12px; font-family: monospace;">${ipOrigem}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 12px; font-weight: bold; color: #475569;">Dispositivo / Navegador:</td>
                <td style="padding: 10px 12px; font-size: 11px; color: #64748b; word-break: break-all;">${userAgent}</td>
              </tr>`
                  : ''
              }
            </table>
            <div style="background-color: #ffffff; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 12px; margin: 18px 0;">
              <div style="margin: 16px 0; text-align: center;">
                ${sigHtml}
                <p style="margin: 6px 0 0 0; font-size: 12px; color: #475569; font-weight: 600;">Assinatura do paciente</p>
              </div>
            </div>
            ${
              isClinica
                ? `
            <div style="background-color: #f1f5f9; border-left: 4px solid #831843; padding: 12px; margin: 18px 0; border-radius: 4px;">
              <p style="margin: 0; font-size: 12px; font-weight: bold; color: #0f172a;">Hash SHA-256 do Documento:</p>
              <p style="margin: 4px 0 0 0; font-family: monospace; font-size: 11px; word-break: break-all; color: #334155;">${docHash}</p>
              <p style="margin: 6px 0 0 0; font-size: 11px; color: #64748b; font-style: italic;">
                Código de verificação de integridade — garante que este documento não foi alterado após a assinatura.
              </p>
            </div>`
                : `
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px 16px; margin: 18px 0; font-size: 13px; color: #334155; line-height: 1.6;">
              <p style="margin: 0; font-weight: 500; color: #1e293b;">
                Sua assinatura foi registrada eletronicamente com data, hora e confirmação por e-mail. Você pode solicitar o registro completo a qualquer momento.
              </p>
            </div>`
            }
          </div>
          <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 20px; text-align: center; font-size: 11px; color: #64748b; line-height: 1.5;">
            ${!isClinica ? '<p style="margin: 0 0 8px 0; font-weight: 600; color: #065f46;">Esta é a sua via do documento assinado. Guarde para seus registros.</p>' : ''}
            <p style="margin: 0 0 6px 0; font-size: 11px; color: #475569;">Enviado para: <strong>${patientEmail}</strong></p>
            <strong>${clinicName}</strong> &bull; Profissional Responsável: ${techResp} (${profReg})<br/>
            Endereço: ${clinicAddr} &bull; Telefone: ${clinicPhone}<br/>
            Fuso horário: Horário de Brasília (UTC-3)
          </div>
        </div>
      </body></html>
    `
  }

  // Envia paciente direto via API REST Resend com anexo
  var resendApiKey = $os.getenv('RESEND_API_KEY')
  if (!resendApiKey) {
    console.log('ATENCAO: Segredo RESEND_API_KEY nao configurado no ambiente!')
  }

  if (patientEmail && patientEmail.indexOf('@') > 0 && resendApiKey) {
    try {
      var resPac = $http.send({
        url: 'https://api.resend.com/emails',
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + resendApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: senderEmail,
          to: [patientEmail],
          subject: subject,
          html: getHtml(false),
          attachments: [
            {
              filename: pdfFilename,
              content: cleanPdfBase64,
            },
          ],
        }),
      })

      if (resPac.statusCode >= 200 && resPac.statusCode < 300) {
        var dataPac = resPac.json || {}
        console.log(
          'Direct Resend REST API email with attachment sent to ' +
            patientEmail +
            '. ID: ' +
            (dataPac.id || '') +
            '. Attachment: ' +
            pdfFilename +
            ' (' +
            pdfResult.size +
            ' bytes, ' +
            pdfResult.pages +
            ' paginas)',
        )
      } else {
        console.log(
          'Falha ao reenviar e-mail para paciente via Resend API (' +
            resPac.statusCode +
            '): ' +
            resPac.raw,
        )
      }
    } catch (errPac) {
      console.log('Falha ao reenviar e-mail para paciente: ' + errPac.message)
    }
  }

  // Envia clínica direto via API REST Resend com anexo
  if (clinicEmail && clinicEmail.indexOf('@') > 0 && resendApiKey) {
    try {
      var resCli = $http.send({
        url: 'https://api.resend.com/emails',
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + resendApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: senderEmail,
          to: [clinicEmail],
          subject: subject,
          html: getHtml(true),
          attachments: [
            {
              filename: pdfFilename,
              content: cleanPdfBase64,
            },
          ],
        }),
      })

      if (resCli.statusCode >= 200 && resCli.statusCode < 300) {
        var dataCli = resCli.json || {}
        console.log(
          'Direct Resend REST API email with attachment sent to ' +
            clinicEmail +
            '. ID: ' +
            (dataCli.id || '') +
            '. Attachment: ' +
            pdfFilename +
            ' (' +
            pdfResult.size +
            ' bytes, ' +
            pdfResult.pages +
            ' paginas)',
        )
      } else {
        console.log(
          'Falha ao reenviar e-mail para clinica via Resend API (' +
            resCli.statusCode +
            '): ' +
            resCli.raw,
        )
      }
    } catch (errCli) {
      console.log('Falha ao reenviar e-mail para clinica: ' + errCli.message)
    }
  }

  return e.json(200, {
    success: true,
    message: 'Comprovantes reenviados com sucesso com o PDF anexado (' + pdfFilename + ').',
  })
})

/**
 * Endpoint POST /backend/v1/forms/send-audit-proof:
 * Disparado sob demanda pela administradora (ação no menu da ficha)
 * Envia à paciente o comprovante COMPLETO (PDF da ficha + relatório de auditoria detalhado anexado ou no corpo)
 */
routerAdd('POST', '/backend/v1/forms/send-audit-proof', (e) => {
  var data = e.requestInfo().body || {}
  var formId = data.id || data.form_submission_id || data.form_id || ''
  var token = data.token || ''

  if (!formId && !token) {
    return e.json(400, { error: 'ID ou token da ficha é obrigatório' })
  }

  var formRecord = null
  try {
    if (formId) {
      formRecord = $app.findRecordById('form_submissions', formId)
    } else if (token) {
      var forms = $app.findRecordsByFilter('form_submissions', 'token = {:token}', '', 1, 0, {
        token: token,
      })
      if (forms && forms.length > 0) formRecord = forms[0]
    }
  } catch (err) {
    return e.json(404, { error: 'Ficha não encontrada: ' + err.message })
  }

  if (formRecord.getString('status') !== 'preenchida') {
    return e.json(400, { error: 'Ficha ainda não foi concluída/assinada' })
  }

  var patientEmail = formRecord.getString('patient_email')
  if (!patientEmail || patientEmail.indexOf('@') <= 0) {
    return e.json(400, { error: 'Paciente não possui e-mail válido cadastrado nesta ficha' })
  }

  var patientName = formRecord.getString('patient_name') || 'Paciente'
  var patientCpf = formRecord.getString('patient_cpf') || 'Não informado'
  var fType = formRecord.getString('form_type') || 'geral'
  var fTypeLabel =
    fType === 'botox'
      ? 'Toxina Botulínica'
      : fType === 'preenchimento'
        ? 'Preenchimento'
        : fType === 'fios'
          ? 'Fios de PDO'
          : fType === 'peeling'
            ? 'Peeling Químico'
            : fType === 'limpeza_pele'
              ? 'Limpeza de Pele'
              : fType === 'estetica_facial'
                ? 'Estética Facial'
                : fType === 'estetica_corporal'
                  ? 'Estética Corporal'
                  : 'Anamnese Geral'

  var clinicSettings = null
  try {
    var cRecords = $app.findRecordsByFilter('clinic_settings', '1=1', '-created', 1, 0)
    if (cRecords && cRecords.length > 0) {
      clinicSettings = cRecords[0]
    }
  } catch (errSet) {
    console.log('Aviso ao carregar clinic_settings para comprovante completo: ' + errSet.message)
  }

  var clinicName = clinicSettings
    ? clinicSettings.getString('clinic_name') || 'Clínica'
    : 'Andresa Souza Clinic'
  var techResp = clinicSettings
    ? clinicSettings.getString('technical_responsible') || 'Andresa Souza'
    : 'Andresa Souza'
  var profReg = clinicSettings
    ? clinicSettings.getString('professional_registry') || 'Resp. Técnica'
    : 'Resp. Técnica'
  var clinicAddr = clinicSettings
    ? clinicSettings.getString('clinic_address') ||
      'Rua Jovino de Medeiros, 23, Salgado Filho, Aracaju - SE'
    : 'Rua Jovino de Medeiros, 23, Salgado Filho, Aracaju - SE'
  var clinicPhone = clinicSettings
    ? clinicSettings.getString('clinic_phone') || '(79) 99809-1314'
    : '(79) 99809-1314'

  var senderEmail =
    'nao-responda@' +
    (clinicSettings
      ? clinicSettings.getString('resend_domain') || 'andresasouzaclinic.com'
      : 'andresasouzaclinic.com')

  // Gera o PDF da ficha
  var pdfResult = generatePdfForRecord(formRecord, clinicSettings)
  if (!pdfResult || !pdfResult.base64) {
    return e.json(500, { error: 'Não foi possível renderizar o PDF da ficha' })
  }

  function formatBr(dateStr) {
    if (!dateStr) return 'Não registrado'
    try {
      var d = new Date(dateStr)
      if (isNaN(d.getTime())) return dateStr
      var utc = d.getTime() + d.getTimezoneOffset() * 60000
      var brDate = new Date(utc - 3 * 60 * 60 * 1000)
      var dia = ('0' + brDate.getDate()).slice(-2)
      var mes = ('0' + (brDate.getMonth() + 1)).slice(-2)
      var hora = ('0' + brDate.getHours()).slice(-2)
      var min = ('0' + brDate.getMinutes()).slice(-2)
      return (
        dia +
        '/' +
        mes +
        '/' +
        brDate.getFullYear() +
        ' às ' +
        hora +
        ':' +
        min +
        ' (Horário de Brasília)'
      )
    } catch (_) {
      return dateStr
    }
  }

  function getDataCurta(dateStr) {
    try {
      var d = new Date(dateStr)
      if (isNaN(d.getTime())) return '31-10-2026'
      var utc = d.getTime() + d.getTimezoneOffset() * 60000
      var brDate = new Date(utc - 3 * 60 * 60 * 1000)
      var dia = ('0' + brDate.getDate()).slice(-2)
      var mes = ('0' + (brDate.getMonth() + 1)).slice(-2)
      return dia + '-' + mes + '-' + brDate.getFullYear()
    } catch (_) {
      return '31-10-2026'
    }
  }

  function sanitizar(nome) {
    if (!nome) return 'Paciente'
    var s = nome
      .replace(/[áàâãä]/gi, 'a')
      .replace(/[éèêë]/gi, 'e')
      .replace(/[íìîï]/gi, 'i')
      .replace(/[óòôõö]/gi, 'o')
      .replace(/[úùûü]/gi, 'u')
      .replace(/[ç]/gi, 'c')
      .replace(/[ñ]/gi, 'n')
    return s
      .replace(/[^a-zA-Z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

  var dataCurta = getDataCurta(formRecord.getString('signed_at') || formRecord.getString('created'))
  var nomeSanitizado = sanitizar(patientName)
  var pdfFilename = 'Ficha-Anamnese-' + nomeSanitizado + '-' + dataCurta + '.pdf'

  var cleanPdfBase64 = String(pdfResult.base64 || '').replace(/[\r\n\s]/g, '')
  if (cleanPdfBase64.indexOf('base64,') !== -1) {
    cleanPdfBase64 = cleanPdfBase64.substring(cleanPdfBase64.indexOf('base64,') + 7)
  }

  // Busca os eventos da trilha de auditoria para construir o relatório legível
  var auditRows = []
  try {
    auditRows = $app.findRecordsByFilter(
      'audit_events',
      "form_submission = '" + formId + "'",
      'created',
      200,
      0,
    )
  } catch (errEvents) {
    console.log('Aviso ao consultar audit_events para comprovante completo: ' + errEvents.message)
  }

  var auditReportText =
    '=================================================================\n' +
    '   ANDRESA SOUZA CLINIC — COMPROVANTE COMPLETO DE AUDITORIA DIGITAL\n' +
    '=================================================================\n\n' +
    'PACIENTE: ' +
    patientName +
    '\n' +
    'CPF: ' +
    patientCpf +
    '\n' +
    'PROCEDIMENTO: ' +
    fTypeLabel +
    '\n' +
    'DATA DA ASSINATURA: ' +
    formatBr(formRecord.getString('signed_at') || formRecord.getString('created')) +
    '\n' +
    'IP DE ORIGEM: ' +
    (formRecord.getString('ip_address') || 'Não informado') +
    '\n' +
    'DISPOSITIVO / NAVEGADOR: ' +
    (formRecord.getString('user_agent') || 'Não informado') +
    '\n' +
    'HASH SHA-256 DO DOCUMENTO: ' +
    (formRecord.getString('document_hash') || 'SHA-256 REGISTRADO') +
    '\n' +
    'STATUS DA TRILHA: Imutável com encadeamento criptográfico SHA-256\n\n' +
    '-----------------------------------------------------------------\n' +
    'HISTÓRICO CRONOLÓGICO DOS EVENTOS REGISTRADOS:\n' +
    '-----------------------------------------------------------------\n'

  if (!auditRows || auditRows.length === 0) {
    auditReportText +=
      '(Nenhum evento intermediário individual registrado. Ficha preenchida diretamente.)\n'
  } else {
    for (var i = 0; i < auditRows.length; i++) {
      var ev = auditRows[i]
      auditReportText +=
        '[' +
        (i + 1) +
        '] ' +
        formatBr(ev.getString('created')) +
        '\n' +
        '    Tipo: ' +
        ev.getString('event_type') +
        '\n' +
        '    Descrição: ' +
        (ev.getString('description') || '-') +
        '\n' +
        '    IP: ' +
        (ev.getString('ip_address') || '-') +
        '\n' +
        '    Chain Hash: ' +
        (ev.getString('chain_hash') || '(primeiro elo da cadeia)') +
        '\n\n'
    }
  }

  auditReportText +=
    '-----------------------------------------------------------------\n' +
    'AUTENTICIDADE E INTEGRIDADE:\n' +
    'Este documento comprova o preenchimento e consentimento eletrônico\n' +
    'em conformidade com a MP 2.200-2/2001 e a LGPD (Lei 13.709/2018).\n' +
    'A trilha de auditoria é protegida contra edição e exclusão no banco de dados.\n' +
    'Emitido sob solicitação da paciente em ' +
    formatBr(new Date().toISOString()) +
    '.\n' +
    '=================================================================\n'

  var auditBase64 = encodeBinaryStringToBase64(auditReportText)
  var auditFilename = 'Trilha-Auditoria-' + nomeSanitizado + '-' + dataCurta + '.txt'

  var attachments = [
    {
      filename: pdfFilename,
      content: cleanPdfBase64,
    },
    {
      filename: auditFilename,
      content: auditBase64,
    },
  ]

  var signedAt = formatBr(formRecord.getString('signed_at') || formRecord.getString('created'))
  var docHash = formRecord.getString('document_hash') || 'SHA-256 REGISTRADO'
  var ipOrigem = formRecord.getString('ip_address') || 'Não informado'
  var userAgent = formRecord.getString('user_agent') || 'Navegador Web/Mobile'

  var subject = 'Comprovante Completo com Trilha de Auditoria - ' + patientName + ' - ' + fTypeLabel

  var auditHtmlTableRows = ''
  if (auditRows && auditRows.length > 0) {
    for (var j = 0; j < auditRows.length; j++) {
      var r = auditRows[j]
      auditHtmlTableRows +=
        '<tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">' +
        '<td style="padding: 6px 8px; color: #475569; white-space: nowrap;">' +
        formatBr(r.getString('created')) +
        '</td>' +
        '<td style="padding: 6px 8px; font-weight: 600; color: #0f172a;">' +
        r.getString('event_type') +
        '</td>' +
        '<td style="padding: 6px 8px; color: #334155;">' +
        (r.getString('description') || '-') +
        '</td>' +
        '<td style="padding: 6px 8px; font-family: monospace; font-size: 10px; color: #64748b;">' +
        (r.getString('chain_hash') ? r.getString('chain_hash').substring(0, 16) + '...' : '-') +
        '</td>' +
        '</tr>'
    }
  }

  var fullProofHtml = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head><meta charset="UTF-8"><title>Comprovante Completo com Trilha de Auditoria</title></head>
    <body style="font-family: Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b;">
      <div style="max-width: 660px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        <div style="background-color: #831843; color: #ffffff; padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 22px; font-weight: bold;">${clinicName}</h1>
          <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.95;">Comprovante Completo de Auditoria Digital & Termo Assinado</p>
        </div>
        <div style="padding: 24px;">
          <p style="font-size: 15px; margin-top: 0;">
            Olá, <strong>${patientName}</strong>! Conforme sua solicitação, segue o registro técnico completo e detalhado da assinatura eletrônica da sua ficha.
          </p>
          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 12px; margin: 16px 0; font-size: 13px; color: #166534;">
            <strong>Anexos inclusos:</strong><br/>
            &bull; <strong>${pdfFilename}</strong> (PDF oficial da ficha assinada)<br/>
            &bull; <strong>${auditFilename}</strong> (Relatório técnico da trilha de auditoria digital com hash encadeado)
          </div>

          <h3 style="font-size: 14px; color: #831843; margin: 20px 0 10px 0; text-transform: uppercase; letter-spacing: 0.5px;">Resumo dos Dados de Autenticidade</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px;">
            <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 10px; font-weight: bold; width: 35%; color: #475569;">Paciente:</td>
              <td style="padding: 8px 10px;">${patientName} (CPF: ${patientCpf})</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 10px; font-weight: bold; color: #475569;">Procedimento:</td>
              <td style="padding: 8px 10px; font-weight: 600;">${fTypeLabel}</td>
            </tr>
            <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 10px; font-weight: bold; color: #475569;">Data e Hora da Assinatura:</td>
              <td style="padding: 8px 10px;">${signedAt}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 10px; font-weight: bold; color: #475569;">IP de Origem:</td>
              <td style="padding: 8px 10px; font-family: monospace;">${ipOrigem}</td>
            </tr>
            <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 10px; font-weight: bold; color: #475569;">Dispositivo / Navegador:</td>
              <td style="padding: 8px 10px; font-size: 11px; color: #64748b; word-break: break-all;">${userAgent}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 10px; font-weight: bold; color: #475569;">Hash SHA-256 do Documento:</td>
              <td style="padding: 8px 10px; font-family: monospace; font-size: 11px; word-break: break-all; color: #831843;">${docHash}</td>
            </tr>
          </table>

          ${
            auditHtmlTableRows
              ? `
          <h3 style="font-size: 13px; color: #0f172a; margin: 16px 0 8px 0; font-weight: bold;">Histórico da Cadeia de Auditoria Digital (Imutável):</h3>
          <div style="overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 18px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
              <thead>
                <tr style="background-color: #f1f5f9; text-align: left; color: #475569;">
                  <th style="padding: 6px 8px;">Data/Hora</th>
                  <th style="padding: 6px 8px;">Evento</th>
                  <th style="padding: 6px 8px;">Descrição</th>
                  <th style="padding: 6px 8px;">Hash Cadeia</th>
                </tr>
              </thead>
              <tbody>
                ${auditHtmlTableRows}
              </tbody>
            </table>
          </div>`
              : ''
          }

          <div style="background-color: #f1f5f9; border-left: 4px solid #831843; padding: 12px; margin: 18px 0; border-radius: 4px; font-size: 12px; color: #334155; line-height: 1.5;">
            <strong>Garantia de Autenticidade e Imutabilidade:</strong><br/>
            Este registro técnico é protegido por encadeamento criptográfico SHA-256 e regras de imutabilidade no banco de dados. Os arquivos originais anexados a este e-mail comprovam a integridade e irretratabilidade do consentimento assinado.
          </div>
        </div>
        <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 20px; text-align: center; font-size: 11px; color: #64748b; line-height: 1.5;">
          <p style="margin: 0 0 6px 0; font-size: 11px; color: #475569;">Enviado para: <strong>${patientEmail}</strong> por solicitação da titular</p>
          <strong>${clinicName}</strong> &bull; Profissional Responsável: ${techResp} (${profReg})<br/>
          Endereço: ${clinicAddr} &bull; Telefone: ${clinicPhone}<br/>
          Fuso horário: Horário de Brasília (UTC-3)
        </div>
      </div>
    </body></html>
  `

  var resendApiKey = $os.getenv('RESEND_API_KEY')
  if (!resendApiKey) {
    return e.json(500, { error: 'Segredo RESEND_API_KEY não configurado no backend' })
  }

  try {
    var resPac = $http.send({
      url: 'https://api.resend.com/emails',
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + resendApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: senderEmail,
        to: [patientEmail],
        subject: subject,
        html: fullProofHtml,
        attachments: attachments,
      }),
    })

    if (resPac.statusCode < 200 || resPac.statusCode >= 300) {
      console.log(
        'Falha ao enviar comprovante completo via Resend API (' +
          resPac.statusCode +
          '): ' +
          resPac.raw,
      )
      return e.json(502, { error: 'Falha no envio via Resend: ' + resPac.raw })
    }

    // Registra na trilha de auditoria que o comprovante completo foi gerado e enviado
    try {
      var reqHeaders = e.request ? e.request.header : null
      var reqIp = ''
      if (reqHeaders) {
        var reqXff = reqHeaders.get('X-Forwarded-For')
        if (reqXff) {
          var pXff = reqXff.split(',')
          if (pXff.length > 0) reqIp = pXff[0].trim()
        }
        if (!reqIp) reqIp = reqHeaders.get('CF-Connecting-IP') || reqHeaders.get('X-Real-IP')
      }
      if (!reqIp && typeof e.realIP === 'function') {
        try {
          reqIp = e.realIP()
        } catch (_) {}
      }
      var reqUa =
        (reqHeaders && reqHeaders.get('User-Agent')) ||
        (e.requestInfo().headers && e.requestInfo().headers['user-agent']) ||
        'Admin Panel'

      var auditCol = $app.findCollectionByNameOrId('audit_events')
      var recAudit = new Record(auditCol)
      recAudit.set('form_submission', formId)
      recAudit.set('event_type', 'comprovante_completo_enviado')
      recAudit.set(
        'description',
        'Administradora enviou comprovante completo com trilha de auditoria para ' + patientEmail,
      )
      recAudit.set('step_number', 6)
      recAudit.set('ip_address', reqIp || '127.0.0.1')
      recAudit.set('user_agent', reqUa)
      recAudit.set('metadata', {
        recipient: patientEmail,
        requested_by: 'admin_panel',
        attachments: [pdfFilename, auditFilename],
      })
      recAudit.set('timestamp', new Date().toISOString())
      $app.save(recAudit)
    } catch (errAud) {
      console.log(
        'Aviso ao registrar auditoria de envio de comprovante completo: ' + errAud.message,
      )
    }

    return e.json(200, {
      success: true,
      message:
        'Comprovante completo com trilha de auditoria enviado com sucesso para ' +
        patientEmail +
        '.',
    })
  } catch (errSend) {
    return e.json(500, { error: 'Erro ao enviar comprovante completo: ' + errSend.message })
  }
})

/**
 * onRecordAfterUpdateSuccess para form_submissions:
 * Disparado quando o paciente conclui a ficha (status muda para 'preenchida')
 */
onRecordAfterUpdateSuccess((e) => {
  e.next()

  try {
    var record = e.record
    var status = record.getString('status')

    // Só processa se o status atual for 'preenchida'
    if (status !== 'preenchida') {
      return
    }

    // --- Auxiliares locais dos lembretes (autocontidos no callback) ---

    // Data/hora do procedimento do agendamento convertida para timestamp UTC real.
    // procedure_date é a data em America/Sao_Paulo (UTC-3) e procedure_time é HH:MM em UTC-3.
    // Logo, UTC = hora_local + 3 horas.
    function lembrarApptDateTime(a) {
      var dateVal = a.getString('procedure_date')
      var timeVal = (a.getString('procedure_time') || '').trim()
      if (!dateVal) return null
      var m = String(dateVal)
        .substring(0, 10)
        .match(/^(\d{4})-(\d{2})-(\d{2})/)
      if (!m) return null
      var hh = 0
      var mm = 0
      var tm = timeVal.match(/^(\d{1,2}):(\d{2})/)
      if (tm) {
        hh = parseInt(tm[1], 10)
        mm = parseInt(tm[2], 10)
        if (isNaN(hh) || hh < 0 || hh > 23) hh = 0
        if (isNaN(mm) || mm < 0 || mm > 59) mm = 0
      }
      var ts = Date.UTC(
        parseInt(m[1], 10),
        parseInt(m[2], 10) - 1,
        parseInt(m[3], 10),
        hh + 3, // Converte hora local America/Sao_Paulo (UTC-3) para UTC
        mm,
        0,
        0,
      )
      if (isNaN(ts)) return null
      return new Date(ts)
    }

    // Cria o lembrete do tipo informado se ainda não existir. O índice
    // único (appointment, kind) garante 1 lembrete por tipo por
    // agendamento; aqui a idempotência é reforçada buscando antes de criar.
    // O scheduled_for é SEMPRE derivado da data/hora do procedimento menos
    // as horas correspondentes (24h ou 2h), nunca do momento da assinatura.
    function lembrarEnsure(aId, kind, schedFor) {
      var existing = $app.findRecordsByFilter(
        'appointment_reminders',
        'appointment = {:aid} && kind = {:kind}',
        '',
        1,
        0,
        { aid: aId, kind: kind },
      )
      if (existing && existing.length > 0) {
        var existingRem = existing[0]
        // Se ainda estiver programado e o horário previsto for diferente, atualiza
        if (existingRem.getString('status') === 'programado') {
          var expectedIso = schedFor.toISOString()
          if (existingRem.getString('scheduled_for') !== expectedIso) {
            existingRem.set('scheduled_for', expectedIso)
            $app.save(existingRem)
          }
        }
        return existingRem
      }
      var remCol = $app.findCollectionByNameOrId('appointment_reminders')
      var rem = new Record(remCol)
      rem.set('appointment', aId)
      rem.set('kind', kind)
      rem.set('scheduled_for', schedFor.toISOString())
      rem.set('status', 'programado')
      $app.save(rem)
      return rem
    }

    // --- LEMBRETES DE AGENDAMENTO (Etapa 3): captura de e-mail + cálculo respeitando antecedência mínima ---
    try {
      var remAppts = $app.findRecordsByFilter(
        'procedure_appointments',
        'form_submission = {:fid}',
        '-created',
        1,
        0,
        { fid: record.id },
      )
      if (remAppts && remAppts.length > 0) {
        var remAppt = remAppts[0]
        var remFormEmail = (record.getString('patient_email') || '').trim().toLowerCase()
        var remApptEmail = (remAppt.getString('patient_email') || '').trim().toLowerCase()
        var remDirty = false

        // Obter configurações de antecedência mínima e chaves ativas
        var sMinAdv = 6
        var sEnable24 = true
        var sEnable2 = true
        try {
          var cSettings = $app.findRecordsByFilter('clinic_settings', '', '-created', 1, 0)
          if (cSettings && cSettings.length > 0) {
            var cs = cSettings[0]
            var mAdvStr = cs.getString('reminder_min_advance_hours')
            if (mAdvStr) {
              var pAdv = parseInt(mAdvStr, 10)
              if (!isNaN(pAdv)) sMinAdv = pAdv
            }
            if (
              cs.get('reminder_enable_24h') !== undefined &&
              cs.get('reminder_enable_24h') !== null
            ) {
              sEnable24 = cs.getBool('reminder_enable_24h')
            }
            if (
              cs.get('reminder_enable_2h') !== undefined &&
              cs.get('reminder_enable_2h') !== null
            ) {
              sEnable2 = cs.getBool('reminder_enable_2h')
            }
          }
        } catch (_) {}

        if (remAppt.getString('status') === 'cancelado') {
          // Agendamento cancelado: cancela os lembretes existentes.
          var remToCancel = $app.findRecordsByFilter(
            'appointment_reminders',
            'appointment = {:aid} && status != "cancelado"',
            '',
            0,
            0,
            { aid: remAppt.id },
          )
          for (var remC = 0; remC < remToCancel.length; remC++) {
            remToCancel[remC].set('status', 'cancelado')
            $app.save(remToCancel[remC])
          }
          if (remAppt.getString('reminder_state') !== 'cancelado') {
            remAppt.set('reminder_state', 'cancelado')
            remDirty = true
          }
        } else {
          var remApptAt = lembrarApptDateTime(remAppt)
          if (remApptAt) {
            var remHoursLeft = (remApptAt.getTime() - Date.now()) / 3600000
            var remNewState = ''

            // Regra de programação de lembretes:
            // Lembrete 24h = data+hora do procedimento menos 24 horas.
            // Lembrete 2h  = data+hora do procedimento menos 2 horas.
            // Horário previsto SEMPRE derivado da data/hora do procedimento.
            //
            // Se faltarem 2h ou menos até o procedimento, a janela de ambos já expirou: 'fora do prazo'.
            // Se faltarem entre >2h e <=24h: o de 24h já expirou, programa apenas o de 2h se ativo: 'parcial: apenas 2h'.
            // Se faltarem >24h: programa ambos conforme interruptores.
            if (remHoursLeft <= 2) {
              remNewState = 'fora do prazo'
            } else if (remHoursLeft > 24) {
              if (sEnable24) {
                lembrarEnsure(remAppt.id, '24h', new Date(remApptAt.getTime() - 24 * 3600000))
              }
              if (sEnable2) {
                lembrarEnsure(remAppt.id, '2h', new Date(remApptAt.getTime() - 2 * 3600000))
              }
              remNewState = sEnable24
                ? 'lembretes programados'
                : sEnable2
                  ? 'parcial: apenas 2h'
                  : 'fora do prazo'
            } else {
              // Faltam entre >2h e <=24h até o procedimento: programa apenas o lembrete de 2h
              if (sEnable2) {
                lembrarEnsure(remAppt.id, '2h', new Date(remApptAt.getTime() - 2 * 3600000))
                remNewState = 'parcial: apenas 2h'
              } else {
                remNewState = 'fora do prazo'
              }
            }

            if (remAppt.getString('reminder_state') !== remNewState) {
              remAppt.set('reminder_state', remNewState)
              remDirty = true
            }
          }
        }

        // Captura do e-mail da ficha: quando o agendamento ainda não tem
        // e-mail registrado, grava o último informado pelo paciente.
        if (remFormEmail && !remApptEmail) {
          remAppt.set('patient_email', remFormEmail)
          remDirty = true
        }

        if (remDirty) {
          $app.save(remAppt)
        }
        console.log(
          'Lembretes da ficha ' +
            record.id +
            ' calculados (agendamento ' +
            remAppt.id +
            ', estado: ' +
            (remAppt.getString('reminder_state') || '') +
            ')',
        )
      }
    } catch (remErr) {
      console.log('Erro ao calcular lembretes na assinatura: ' + remErr.message)
    }

    // Se já foi enviado com sucesso ou se já foi processado neste ciclo, evita reenvio duplicado/loop
    var deliveryStatus = record.getString('email_delivery_status')
    var alreadyAttached = record.getBool('pdf_attached_to_email')
    var forceResend = record.getBool('force_email_resend')
    if (
      (deliveryStatus === 'enviado' || deliveryStatus === 'processado') &&
      alreadyAttached &&
      !forceResend
    ) {
      return
    }

    var settingsRec = null
    try {
      var recs = $app.findRecordsByFilter('clinic_settings', '', '-created', 1, 0)
      if (recs && recs.length > 0) settingsRec = recs[0]
    } catch (_) {}

    var clinicName = 'Andresa Souza Clinic'
    var techResp = 'Andresa Souza — CREFITO-13 000000-F'
    var profReg = 'CREFITO-13 000000-F'
    var clinicAddr = 'Jardins, Aracaju - SE'
    var clinicPhone = '(79) 99980-9134'
    var clinicEmail = 'andresasouzaclinic@gmail.com'
    var senderEmail = 'Ficha Digital - Andresa Souza Clinic <ficha@andresasouza.com.br>'

    if (settingsRec) {
      try {
        if (settingsRec.getString('clinic_name')) clinicName = settingsRec.getString('clinic_name')
        if (settingsRec.getString('technical_responsible'))
          techResp = settingsRec.getString('technical_responsible')
        if (settingsRec.getString('professional_register'))
          profReg = settingsRec.getString('professional_register')
        if (settingsRec.getString('clinic_address'))
          clinicAddr = settingsRec.getString('clinic_address')
        if (settingsRec.getString('phone')) clinicPhone = settingsRec.getString('phone')
        if (settingsRec.getString('notification_email'))
          clinicEmail = settingsRec.getString('notification_email')
        if (settingsRec.getString('sender_email'))
          senderEmail = settingsRec.getString('sender_email')
      } catch (_) {}
    }

    var patientEmail = record.getString('patient_email')
    var patientName = record.getString('patient_name') || 'Paciente'
    var fType = record.getString('form_type') || 'geral'
    var formTypeLabels = {
      geral: 'Anamnese Estética Geral',
      labios: 'Lábios, Micropigmentação & Revitalização Labial',
      botox: 'Toxina Botulínica (Botox)',
    }
    var fTypeLabel = formTypeLabels[fType] || fType

    // --- GERADOR DE PDF INLINE AUTOCONTIDO ---
    var pdfResult = (function (rec, settings) {
      if (!rec) return { rawPdf: '', base64: '', size: 0, pages: 1 }
      var base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
      var base64Lookup = new Uint8Array(256)
      for (var bIdx = 0; bIdx < base64Chars.length; bIdx++) {
        base64Lookup[base64Chars.charCodeAt(bIdx)] = bIdx
      }

      function decodeBase64ToBytes(base64Str) {
        var clean = base64Str.replace(/[^A-Za-z0-9+/=]/g, '')
        var len = clean.length
        var placeHolders =
          clean.charAt(len - 1) === '=' ? (clean.charAt(len - 2) === '=' ? 2 : 1) : 0
        var byteLen = Math.floor((len * 3) / 4) - placeHolders
        var bytes = new Uint8Array(byteLen)
        var curByte = 0
        for (var i = 0; i < len; i += 4) {
          var enc1 = base64Lookup[clean.charCodeAt(i)]
          var enc2 = base64Lookup[clean.charCodeAt(i + 1)]
          var enc3 = base64Lookup[clean.charCodeAt(i + 2)]
          var enc4 = base64Lookup[clean.charCodeAt(i + 3)]

          bytes[curByte++] = (enc1 << 2) | (enc2 >> 4)
          if (curByte < byteLen) bytes[curByte++] = ((enc2 & 15) << 4) | (enc3 >> 2)
          if (curByte < byteLen) bytes[curByte++] = ((enc3 & 3) << 6) | enc4
        }
        return bytes
      }

      function encodeBinaryStringToBase64(binStr) {
        var output = ''
        var len = binStr.length
        for (var j = 0; j < len; j += 3) {
          var b0 = binStr.charCodeAt(j) & 0xff
          var b1 = j + 1 < len ? binStr.charCodeAt(j + 1) & 0xff : 0
          var b2 = j + 2 < len ? binStr.charCodeAt(j + 2) & 0xff : 0
          output += base64Chars.charAt(b0 >> 2)
          output += base64Chars.charAt(((b0 & 3) << 4) | (b1 >> 4))
          output += j + 1 < len ? base64Chars.charAt(((b1 & 15) << 2) | (b2 >> 6)) : '='
          output += j + 2 < len ? base64Chars.charAt(b2 & 63) : '='
        }
        return output
      }

      function tinfUncompress(source) {
        var TINF_OK = 0
        var sltree = { table: new Uint16Array(16), trans: new Uint16Array(288) }
        var sdtree = { table: new Uint16Array(16), trans: new Uint16Array(288) }
        var length_bits = new Uint8Array(30)
        var length_base = new Uint16Array(30)
        var dist_bits = new Uint8Array(30)
        var dist_base = new Uint16Array(30)
        var clcidx = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]

        function tinf_build_bits_base(bits, base, delta, first) {
          var i, sum
          for (i = 0; i < delta; ++i) bits[i] = 0
          for (i = 0; i < 30 - delta; ++i) bits[i + delta] = Math.floor(i / delta)
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

        tinf_build_fixed_trees(sltree, sdtree)
        tinf_build_bits_base(length_bits, length_base, 4, 3)
        tinf_build_bits_base(dist_bits, dist_base, 2, 1)
        length_bits[28] = 0
        length_base[28] = 258

        function tinf_build_tree(t, lengths, off, num) {
          var offs = new Uint16Array(16)
          var i, sum
          for (i = 0; i < 16; ++i) t.table[i] = 0
          for (i = 0; i < num; ++i) t.table[lengths[off + i]]++
          t.table[0] = 0
          for (sum = 0, i = 0; i < 16; ++i) {
            offs[i] = sum
            sum += t.table[i]
          }
          for (i = 0; i < num; ++i) {
            if (lengths[off + i]) t.trans[offs[lengths[off + i]]++] = i
          }
        }

        var d = {
          source: source,
          sourceIndex: 0,
          tag: 0,
          bitcount: 0,
          dest: new Uint8Array(source.length * 8 + 65536),
          destLen: 0,
          ltree: { table: new Uint16Array(16), trans: new Uint16Array(288) },
          dtree: { table: new Uint16Array(16), trans: new Uint16Array(288) },
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
          var hlit = tinf_read_bits(d, 5, 257)
          var hdist = tinf_read_bits(d, 5, 1)
          var hclen = tinf_read_bits(d, 4, 4)
          var lengths = new Uint8Array(288 + 32)
          var code_tree = { table: new Uint16Array(16), trans: new Uint16Array(288) }
          var i, num, length

          for (i = 0; i < 19; ++i) lengths[i] = 0
          for (i = 0; i < hclen; ++i) {
            lengths[clcidx[i]] = tinf_read_bits(d, 3, 0)
          }
          tinf_build_tree(code_tree, lengths, 0, 19)

          for (num = 0; num < hlit + hdist; ) {
            var sym = tinf_decode_symbol(d, code_tree)
            switch (sym) {
              case 16:
                var prev = lengths[num - 1]
                for (length = tinf_read_bits(d, 2, 3); length; --length) lengths[num++] = prev
                break
              case 17:
                for (length = tinf_read_bits(d, 3, 3); length; --length) lengths[num++] = 0
                break
              case 18:
                for (length = tinf_read_bits(d, 7, 11); length; --length) lengths[num++] = 0
                break
              default:
                lengths[num++] = sym
                break
            }
          }
          tinf_build_tree(lt, lengths, 0, hlit)
          tinf_build_tree(dt, lengths, hlit, hdist)
        }

        function tinf_inflate_block_data(d, lt, dt) {
          while (1) {
            var sym = tinf_decode_symbol(d, lt)
            if (sym === 256) return TINF_OK
            if (sym < 256) {
              if (d.destLen >= d.dest.length) {
                var bigger = new Uint8Array(d.dest.length * 2)
                bigger.set(d.dest)
                d.dest = bigger
              }
              d.dest[d.destLen++] = sym
            } else {
              sym -= 257
              var length = tinf_read_bits(d, length_bits[sym], length_base[sym])
              var dist = tinf_decode_symbol(d, dt)
              var offs = d.destLen - tinf_read_bits(d, dist_bits[dist], dist_base[dist])
              if (d.destLen + length >= d.dest.length) {
                var bigger2 = new Uint8Array(
                  Math.max(d.dest.length * 2, d.destLen + length + 65536),
                )
                bigger2.set(d.dest)
                d.dest = bigger2
              }
              for (var i = offs; i < offs + length; ++i) {
                d.dest[d.destLen++] = d.dest[i]
              }
            }
          }
        }

        function tinf_inflate_uncompressed_block(d) {
          while (d.bitcount > 8) {
            d.sourceIndex--
            d.bitcount -= 8
          }
          var length = d.source[d.sourceIndex + 1] * 256 + d.source[d.sourceIndex]
          d.sourceIndex += 4
          if (d.destLen + length >= d.dest.length) {
            var bigger = new Uint8Array(d.dest.length + length + 65536)
            bigger.set(d.dest)
            d.dest = bigger
          }
          for (var i = length; i; --i) d.dest[d.destLen++] = d.source[d.sourceIndex++]
          d.bitcount = 0
          return TINF_OK
        }

        var bfinal
        do {
          bfinal = tinf_getbit(d)
          var btype = tinf_read_bits(d, 2, 0)
          switch (btype) {
            case 0:
              tinf_inflate_uncompressed_block(d)
              break
            case 1:
              tinf_inflate_block_data(d, sltree, sdtree)
              break
            case 2:
              tinf_decode_trees(d, d.ltree, d.dtree)
              tinf_inflate_block_data(d, d.ltree, d.dtree)
              break
            default:
              throw new Error('Data error inflate')
          }
        } while (!bfinal)

        return d.dest.subarray(0, d.destLen)
      }

      var signatureImageObj = null
      var rawSigData = rec.getString('signature_data') || ''

      if (rawSigData && rawSigData.indexOf('data:image/') === 0) {
        try {
          var commaIdx = rawSigData.indexOf(',')
          var headerPart = rawSigData.substring(0, commaIdx)
          var b64Data = rawSigData.substring(commaIdx + 1)
          var imgBytes = decodeBase64ToBytes(b64Data)

          if (headerPart.indexOf('image/jpeg') !== -1 || headerPart.indexOf('image/jpg') !== -1) {
            var jW = 600
            var jH = 200
            for (var p = 0; p < imgBytes.length - 8; p++) {
              if (imgBytes[p] === 0xff && (imgBytes[p + 1] === 0xc0 || imgBytes[p + 1] === 0xc2)) {
                jH = (imgBytes[p + 5] << 8) | imgBytes[p + 6]
                jW = (imgBytes[p + 7] << 8) | imgBytes[p + 8]
                break
              }
            }
            var binJpeg = ''
            for (var ji = 0; ji < imgBytes.length; ji++) {
              binJpeg += String.fromCharCode(imgBytes[ji])
            }
            signatureImageObj = {
              width: jW,
              height: jH,
              colorSpace: '/DeviceRGB',
              bits: 8,
              filter: '/DCTDecode',
              stream: binJpeg,
            }
          } else if (headerPart.indexOf('image/png') !== -1) {
            if (
              imgBytes.length > 24 &&
              imgBytes[0] === 0x89 &&
              imgBytes[1] === 0x50 &&
              imgBytes[2] === 0x4e &&
              imgBytes[3] === 0x47
            ) {
              var pW =
                (imgBytes[16] << 24) | (imgBytes[17] << 16) | (imgBytes[18] << 8) | imgBytes[19]
              var pH =
                (imgBytes[20] << 24) | (imgBytes[21] << 16) | (imgBytes[22] << 8) | imgBytes[23]
              var bitDepth = imgBytes[24]
              var colorType = imgBytes[25]
              var interlace = imgBytes[28]

              var idatParts = []
              var offset = 8
              while (offset < imgBytes.length - 8) {
                var cLen =
                  (imgBytes[offset] << 24) |
                  (imgBytes[offset + 1] << 16) |
                  (imgBytes[offset + 2] << 8) |
                  imgBytes[offset + 3]
                var cType = String.fromCharCode(
                  imgBytes[offset + 4],
                  imgBytes[offset + 5],
                  imgBytes[offset + 6],
                  imgBytes[offset + 7],
                )
                if (cType === 'IDAT') {
                  idatParts.push(imgBytes.subarray(offset + 8, offset + 8 + cLen))
                }
                offset += 12 + cLen
                if (cType === 'IEND') break
              }

              var totalIdatLen = 0
              for (var ip = 0; ip < idatParts.length; ip++) totalIdatLen += idatParts[ip].length
              var idatBytes = new Uint8Array(totalIdatLen)
              var curIdatOff = 0
              for (var ip2 = 0; ip2 < idatParts.length; ip2++) {
                idatBytes.set(idatParts[ip2], curIdatOff)
                curIdatOff += idatParts[ip2].length
              }

              var binIdat = ''
              for (var bi = 0; bi < idatBytes.length; bi++) {
                binIdat += String.fromCharCode(idatBytes[bi])
              }

              if (colorType === 2 && interlace === 0 && bitDepth === 8) {
                signatureImageObj = {
                  width: pW,
                  height: pH,
                  colorSpace: '/DeviceRGB',
                  bits: 8,
                  filter: '/FlateDecode',
                  decodeParms:
                    '<< /Predictor 15 /Colors 3 /BitsPerComponent 8 /Columns ' + pW + ' >>',
                  stream: binIdat,
                }
              } else if (colorType === 0 && interlace === 0 && bitDepth === 8) {
                signatureImageObj = {
                  width: pW,
                  height: pH,
                  colorSpace: '/DeviceGray',
                  bits: 8,
                  filter: '/FlateDecode',
                  decodeParms:
                    '<< /Predictor 15 /Colors 1 /BitsPerComponent 8 /Columns ' + pW + ' >>',
                  stream: binIdat,
                }
              } else if (colorType === 6 || colorType === 3 || colorType === 2) {
                try {
                  var decompressed = tinfUncompress(idatBytes.subarray(2))
                  if (decompressed && decompressed.length > 0) {
                    var bytesPerPix = colorType === 6 ? 4 : colorType === 2 ? 3 : 1
                    var scanlineLen = pW * bytesPerPix
                    var rawRgbBytes = []

                    var prevScanline = new Uint8Array(scanlineLen)
                    var decOff = 0

                    for (var row = 0; row < pH; row++) {
                      if (decOff >= decompressed.length) break
                      var filterType = decompressed[decOff++]
                      var curScanline = new Uint8Array(scanlineLen)

                      for (var col = 0; col < scanlineLen; col++) {
                        var rawByte = decompressed[decOff++]
                        var a = col >= bytesPerPix ? curScanline[col - bytesPerPix] : 0
                        var b = prevScanline[col]
                        var c = col >= bytesPerPix ? prevScanline[col - bytesPerPix] : 0

                        var val = rawByte
                        if (filterType === 1) {
                          val = (rawByte + a) & 0xff
                        } else if (filterType === 2) {
                          val = (rawByte + b) & 0xff
                        } else if (filterType === 3) {
                          val = (rawByte + Math.floor((a + b) / 2)) & 0xff
                        } else if (filterType === 4) {
                          var pP = a + b - c
                          var pa = Math.abs(pP - a)
                          var pb = Math.abs(pP - b)
                          var pc = Math.abs(pP - c)
                          var pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
                          val = (rawByte + pr) & 0xff
                        }
                        curScanline[col] = val
                      }

                      prevScanline = curScanline

                      if (colorType === 6) {
                        for (var px = 0; px < pW; px++) {
                          var r = curScanline[px * 4]
                          var g = curScanline[px * 4 + 1]
                          var bl = curScanline[px * 4 + 2]
                          var al = curScanline[px * 4 + 3] / 255.0
                          var outR = Math.round(r * al + 255 * (1 - al))
                          var outG = Math.round(g * al + 255 * (1 - al))
                          var outB = Math.round(bl * al + 255 * (1 - al))
                          rawRgbBytes.push(outR, outG, outB)
                        }
                      } else if (colorType === 2) {
                        for (var px2 = 0; px2 < curScanline.length; px2++) {
                          rawRgbBytes.push(curScanline[px2])
                        }
                      }
                    }

                    if (rawRgbBytes.length === pW * pH * 3) {
                      var rgbBin = ''
                      for (var rbi = 0; rbi < rawRgbBytes.length; rbi++) {
                        rgbBin += String.fromCharCode(rawRgbBytes[rbi])
                      }
                      signatureImageObj = {
                        width: pW,
                        height: pH,
                        colorSpace: '/DeviceRGB',
                        bits: 8,
                        filter: null,
                        stream: rgbBin,
                      }
                    }
                  }
                } catch (_) {}
              }
            }
          }
        } catch (_) {}
      }

      function toWinAnsiByte(charStr) {
        var c = charStr.charCodeAt(0)
        if (c < 128) return c
        var map = {
          0x20ac: 0x80,
          0x201a: 0x82,
          0x0192: 0x83,
          0x201e: 0x84,
          0x2026: 0x85,
          0x2020: 0x86,
          0x2021: 0x87,
          0x02c6: 0x88,
          0x2030: 0x89,
          0x0160: 0x8a,
          0x2039: 0x8b,
          0x0152: 0x8c,
          0x017d: 0x8e,
          0x2018: 0x91,
          0x2019: 0x92,
          0x201c: 0x93,
          0x201d: 0x94,
          0x2022: 0x95,
          0x2013: 0x96,
          0x2014: 0x97,
          0x02dc: 0x98,
          0x2122: 0x99,
          0x0161: 0x9a,
          0x203a: 0x9b,
          0x0153: 0x9c,
          0x017e: 0x9e,
          0x0178: 0x9f,
        }
        if (map[c]) return map[c]
        if (c >= 160 && c <= 255) return c
        return 63
      }

      function escPdfWinAnsi(text) {
        if (!text) return ''
        var out = ''
        var s = String(text)
        for (var i = 0; i < s.length; i++) {
          var ch = s.charAt(i)
          var b = toWinAnsiByte(ch)
          if (b === 92) {
            out += '\\\\'
          } else if (b === 40) {
            out += '\\('
          } else if (b === 41) {
            out += '\\)'
          } else if (b >= 32 && b <= 126) {
            out += ch
          } else {
            var oct = b.toString(8)
            while (oct.length < 3) oct = '0' + oct
            out += '\\' + oct
          }
        }
        return out
      }

      function estimateCharWidth(ch, fontSize) {
        var c = ch.charCodeAt(0)
        var ratio = 0.52
        if ('ijlI1.:;,|!/\\'.indexOf(ch) !== -1) ratio = 0.28
        else if ('mwMWOQ@%'.indexOf(ch) !== -1) ratio = 0.8
        else if ('frt -()[]{}'.indexOf(ch) !== -1) ratio = 0.35
        else if (c >= 65 && c <= 90) ratio = 0.65
        return ratio * fontSize
      }

      function measureTextWidth(text, fontSize) {
        var w = 0
        var s = String(text || '')
        for (var i = 0; i < s.length; i++) {
          w += estimateCharWidth(s.charAt(i), fontSize)
        }
        return w
      }

      function wrapText(text, maxPts, fontSize) {
        if (!text) return []
        var words = String(text).split(' ')
        var lines = []
        var curLine = ''

        for (var i = 0; i < words.length; i++) {
          var w = words[i]
          var test = curLine ? curLine + ' ' + w : w
          if (measureTextWidth(test, fontSize) <= maxPts) {
            curLine = test
          } else {
            if (curLine) lines.push(curLine)
            curLine = w
          }
        }
        if (curLine) lines.push(curLine)
        return lines
      }

      function formatBrDate(isoStr) {
        if (!isoStr) return 'Não informada'
        try {
          var d = new Date(isoStr)
          var utc = d.getTime() + d.getTimezoneOffset() * 60000
          var brDate = new Date(utc - 3 * 3600000)
          var dia = String(brDate.getDate())
          if (dia.length < 2) dia = '0' + dia
          var mes = String(brDate.getMonth() + 1)
          if (mes.length < 2) mes = '0' + mes
          var ano = brDate.getFullYear()
          var horas = String(brDate.getHours())
          if (horas.length < 2) horas = '0' + horas
          var minutos = String(brDate.getMinutes())
          if (minutos.length < 2) minutos = '0' + minutos
          return (
            dia + '/' + mes + '/' + ano + ' às ' + horas + ':' + minutos + ' (horário de Brasília)'
          )
        } catch (_) {
          return isoStr
        }
      }

      function formatShortDate(isoStr) {
        try {
          var d = isoStr ? new Date(isoStr) : new Date()
          var utc = d.getTime() + d.getTimezoneOffset() * 60000
          var brDate = new Date(utc - 3 * 3600000)
          var dia = String(brDate.getDate())
          if (dia.length < 2) dia = '0' + dia
          var mes = String(brDate.getMonth() + 1)
          if (mes.length < 2) mes = '0' + mes
          return dia + '/' + mes + '/' + brDate.getFullYear()
        } catch (_) {
          return '31/10/2026'
        }
      }

      function formatBirthDateBR(dateStr) {
        if (!dateStr || dateStr === 'Não informado') return 'Não informado'
        try {
          var clean = String(dateStr).trim().split('T')[0]
          var match = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/)
          if (match) {
            return match[3] + '/' + match[2] + '/' + match[1]
          }
          return dateStr
        } catch (_) {
          return dateStr
        }
      }

      var patientName = rec.getString('patient_name') || 'Paciente'
      var patientCpf = rec.getString('patient_cpf') || 'Não informado'
      var patientEmail = rec.getString('patient_email') || 'Não informado'
      var patientPhone = rec.getString('patient_phone') || 'Não informado'
      var patientBirth = formatBirthDateBR(rec.getString('patient_birth_date'))
      var patientRg = rec.getString('patient_rg') || 'Não informado'
      var patientProf = rec.getString('patient_profession') || 'Não informado'
      var patientEmerg = rec.getString('patient_emergency_contact') || 'Não informado'
      var patientAddr = rec.getString('patient_address') || 'Não informado'

      var fType = rec.getString('form_type') || 'geral'
      var formTypeLabels = {
        geral: 'Anamnese Estética Geral',
        labios: 'Lábios, Micropigmentação & Revitalização Labial',
        botox: 'Toxina Botulínica (Botox)',
      }
      var fTypeLabel = formTypeLabels[fType] || fType

      var signedAt = formatBrDate(rec.getString('signed_at') || rec.getString('created'))
      var signedDateShort = formatShortDate(rec.getString('signed_at') || rec.getString('created'))
      var ipOrigem = rec.getString('ip_address') || 'Não informado'
      var userAgent = rec.getString('user_agent') || 'Navegador Web/Mobile'
      var docHash = rec.getString('document_hash') || 'SHA-256 REGISTRADO'
      var termTitle =
        rec.getString('accepted_term_title') || 'Termo de Consentimento - ' + fTypeLabel
      var termText = rec.getString('accepted_term_text') || ''

      var PAGE_WIDTH = 595.28
      var PAGE_HEIGHT = 841.89
      var MARGIN_X = 56.7
      var CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN_X
      var HEADER_TOP = PAGE_HEIGHT - 38
      var CONTENT_TOP = PAGE_HEIGHT - 80
      var CONTENT_BOTTOM = 65

      var pages = []
      var curPage = { commands: [] }
      var curY = CONTENT_TOP

      function newPage() {
        pages.push(curPage)
        curPage = { commands: [] }
        curY = CONTENT_TOP
      }

      function ensureSpace(ptsNeeded) {
        if (curY - ptsNeeded < CONTENT_BOTTOM) {
          newPage()
        }
      }

      function drawSectionTitle(titleText) {
        ensureSpace(32)
        curY -= 6
        curPage.commands.push(
          'q 0.514 0.094 0.263 rg 1 w ' +
            MARGIN_X +
            ' ' +
            (curY - 18) +
            ' ' +
            CONTENT_WIDTH +
            ' 0.5 re f Q',
        )
        curPage.commands.push(
          'BT /F2 12 Tf 0.514 0.094 0.263 rg ' +
            MARGIN_X +
            ' ' +
            (curY - 12) +
            ' Td (' +
            escPdfWinAnsi(titleText) +
            ') Tj ET',
        )
        curY -= 26
      }

      function drawTwoColumnTable(rows, col1Width, col2Width) {
        for (var r = 0; r < rows.length; r++) {
          var row = rows[r]
          var label = row.label || ''
          var val = row.value || ''
          var isAlt = r % 2 === 1

          var labelLines = wrapText(label, col1Width - 14, 9)
          var valLines = wrapText(val, col2Width - 14, 9)
          var numLines = Math.max(labelLines.length, valLines.length, 1)
          var rowH = numLines * 13 + 8

          ensureSpace(rowH + 2)

          if (isAlt) {
            curPage.commands.push(
              'q 0.965 0.972 0.980 rg ' +
                MARGIN_X +
                ' ' +
                (curY - rowH) +
                ' ' +
                CONTENT_WIDTH +
                ' ' +
                rowH +
                ' re f Q',
            )
          }

          curPage.commands.push(
            'q 0.88 0.90 0.93 RG 0.5 w ' +
              MARGIN_X +
              ' ' +
              (curY - rowH) +
              ' m ' +
              (MARGIN_X + CONTENT_WIDTH) +
              ' ' +
              (curY - rowH) +
              ' l S Q',
          )

          var textY = curY - 14
          for (var l = 0; l < labelLines.length; l++) {
            curPage.commands.push(
              'BT /F2 9 Tf 0.18 0.23 0.32 rg ' +
                (MARGIN_X + 6) +
                ' ' +
                (textY - l * 12) +
                ' Td (' +
                escPdfWinAnsi(labelLines[l]) +
                ') Tj ET',
            )
          }

          for (var v = 0; v < valLines.length; v++) {
            curPage.commands.push(
              'BT /F1 9 Tf 0.10 0.14 0.20 rg ' +
                (MARGIN_X + col1Width + 6) +
                ' ' +
                (textY - v * 12) +
                ' Td (' +
                escPdfWinAnsi(valLines[v]) +
                ') Tj ET',
            )
          }

          curY -= rowH
        }
        curY -= 8
      }

      drawSectionTitle('SEÇÃO 1 — DADOS CADASTRAIS DO PACIENTE')
      var patientDataRows = [
        { label: 'Nome Completo:', value: patientName },
        { label: 'CPF:', value: patientCpf },
        { label: 'E-mail:', value: patientEmail },
        { label: 'Telefone / WhatsApp:', value: patientPhone },
        { label: 'Data de Nascimento:', value: patientBirth },
        { label: 'RG:', value: patientRg },
        { label: 'Profissão:', value: patientProf },
        { label: 'Contato de Emergência:', value: patientEmerg },
        { label: 'Endereço Residencial:', value: patientAddr },
        { label: 'Procedimento Escolhido:', value: fTypeLabel },
      ]
      drawTwoColumnTable(patientDataRows, 150, CONTENT_WIDTH - 150)

      drawSectionTitle('SEÇÃO 2 — QUESTIONÁRIO DE SAÚDE & ANAMNESE')
      var questionRows = []
      try {
        var rawAnswers = rec.getString('answers')
        if (rawAnswers) {
          var answersObj = JSON.parse(rawAnswers)
          var qLabels = {
            alergias: 'Alergias a Medicamentos / Cosméticos',
            cicatrizacao: 'Histórico de Cicatrização / Queloides',
            doencas_cronicas: 'Doenças Crônicas / Autoimunes',
            fumante: 'Tabagismo / Fumante Ativo',
            gestante_ou_lactante: 'Gestante ou Lactante',
            medicamentos_em_uso: 'Medicamentos de Uso Contínuo',
            objetivo_labios: 'Objetivo com o Procedimento Labial',
            procedimentos_anteriores: 'Procedimentos Estéticos Anteriores',
            queixa_principal: 'Queixa Estética Principal',
            historico_saude: 'Histórico Geral de Saúde',
            herpes_labial: 'Histórico de Herpes Labial',
            uso_anticoagulantes: 'Uso de Anticoagulantes / AAS',
          }
          var aKeys = Object.keys(answersObj)
          for (var k = 0; k < aKeys.length; k++) {
            var aKey = aKeys[k]
            var qVal = answersObj[aKey]
            var qText =
              qLabels[aKey] ||
              aKey.replace(/_/g, ' ').replace(/\b\w/g, function (char) {
                return char.toUpperCase()
              })
            var vStr = Array.isArray(qVal) ? qVal.join(', ') : String(qVal)
            if (typeof qVal === 'boolean') vStr = qVal ? 'Sim' : 'Não'
            questionRows.push({ label: qText + ':', value: vStr || 'Não informado' })
          }
        }
      } catch (_) {}

      if (questionRows.length === 0) {
        questionRows.push({
          label: 'Questionário Clínico:',
          value: 'Respostas registradas e validadas eletronicamente no prontuário.',
        })
      }
      drawTwoColumnTable(questionRows, 195, CONTENT_WIDTH - 195)

      drawSectionTitle('SEÇÃO 3 — TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO')
      ensureSpace(22)
      curPage.commands.push(
        'BT /F2 10 Tf 0.514 0.094 0.263 rg ' +
          MARGIN_X +
          ' ' +
          (curY - 10) +
          ' Td (' +
          escPdfWinAnsi(termTitle) +
          ') Tj ET',
      )
      curY -= 18

      var clauses = []
      if (termText) {
        var rawParas = termText.split(/\n\s*\n|\n(?=[0-9]+\.\s+)/)
        for (var p = 0; p < rawParas.length; p++) {
          var pt = rawParas[p].trim()
          if (pt) clauses.push(pt)
        }
      }
      if (clauses.length === 0) {
        clauses.push(
          'Declaração de consentimento integralmente lida, compreendida, confirmada e aceita pelo paciente no momento da assinatura eletrônica.',
        )
      }

      for (var c = 0; c < clauses.length; c++) {
        var clauseText = clauses[c]
        var lines = wrapText(clauseText, CONTENT_WIDTH, 9.5)
        var clauseH = lines.length * 13 + 6

        ensureSpace(clauseH)

        for (var cl = 0; cl < lines.length; cl++) {
          curPage.commands.push(
            'BT /F1 9.5 Tf 0.20 0.24 0.30 rg ' +
              MARGIN_X +
              ' ' +
              (curY - 11) +
              ' Td (' +
              escPdfWinAnsi(lines[cl]) +
              ') Tj ET',
          )
          curY -= 13
        }
        curY -= 6
      }

      drawSectionTitle('SEÇÃO 4 — ASSINATURA ELETRÔNICA DO PACIENTE')
      var boxHeight = 110
      ensureSpace(boxHeight + 50)

      curPage.commands.push(
        'q 0.988 0.950 0.972 rg 0.81 0.40 0.60 RG 1 w ' +
          MARGIN_X +
          ' ' +
          (curY - boxHeight) +
          ' ' +
          CONTENT_WIDTH +
          ' ' +
          boxHeight +
          ' re B Q',
      )

      if (signatureImageObj) {
        var boxMaxW = 280
        var boxMaxH = 75
        var imgW = signatureImageObj.width
        var imgH = signatureImageObj.height
        var scale = Math.min(boxMaxW / imgW, boxMaxH / imgH, 1.0)
        var finalW = Math.round(imgW * scale)
        var finalH = Math.round(imgH * scale)
        var imgX = MARGIN_X + (CONTENT_WIDTH - finalW) / 2
        var imgY = curY - boxHeight + (boxHeight - finalH) / 2 + 10

        curPage.commands.push(
          'q ' + finalW + ' 0 0 ' + finalH + ' ' + imgX + ' ' + imgY + ' cm /SigImg Do Q',
        )
      } else {
        curPage.commands.push(
          'BT /F2 11 Tf 0.514 0.094 0.263 rg ' +
            (MARGIN_X + 130) +
            ' ' +
            (curY - 55) +
            ' Td (' +
            escPdfWinAnsi('Assinatura Eletrônica Autenticada') +
            ') Tj ET',
        )
      }

      var lineY = curY - boxHeight + 18
      curPage.commands.push(
        'q 0.514 0.094 0.263 RG 1.2 w ' +
          (MARGIN_X + 80) +
          ' ' +
          lineY +
          ' m ' +
          (MARGIN_X + CONTENT_WIDTH - 80) +
          ' ' +
          lineY +
          ' l S Q',
      )
      curPage.commands.push(
        'BT /F2 9.5 Tf 0.20 0.24 0.30 rg ' +
          (MARGIN_X + 180) +
          ' ' +
          (lineY - 11) +
          ' Td (' +
          escPdfWinAnsi('Assinatura do Paciente: ' + patientName) +
          ') Tj ET',
      )
      curPage.commands.push(
        'BT /F1 8.5 Tf 0.40 0.45 0.50 rg ' +
          (MARGIN_X + 175) +
          ' ' +
          (lineY - 22) +
          ' Td (' +
          escPdfWinAnsi('Aceite e Assinatura Registrados em: ' + signedAt) +
          ') Tj ET',
      )

      curY -= boxHeight + 32

      drawSectionTitle('SEÇÃO 5 — REGISTRO DE AUDITORIA & INTEGRIDADE')
      var auditRows = [
        { label: 'Data e Hora do Aceite:', value: signedAt },
        { label: 'IP de Origem Real:', value: ipOrigem },
        { label: 'Dispositivo / Navegador:', value: userAgent },
        { label: 'Hash SHA-256 de Integridade:', value: docHash },
        {
          label: 'Certificação de Autenticidade:',
          value:
            'Código de verificação de integridade — garante que este documento não foi alterado após a assinatura.',
        },
      ]
      drawTwoColumnTable(auditRows, 175, CONTENT_WIDTH - 175)

      pages.push(curPage)
      var totalPages = pages.length

      var clinicN = 'Andresa Souza Clinic'
      var tResp = 'Andresa Souza — CREFITO-13 000000-F'
      var cAddr = 'Jardins, Aracaju - SE • Tel: (79) 99980-9134'

      if (settings) {
        try {
          if (settings.getString('clinic_name')) clinicN = settings.getString('clinic_name')
          if (settings.getString('technical_responsible')) {
            tResp = settings.getString('technical_responsible')
            if (settings.getString('professional_register')) {
              tResp += ' — ' + settings.getString('professional_register')
            }
          }
          if (settings.getString('clinic_address') || settings.getString('phone')) {
            cAddr =
              (settings.getString('clinic_address') || 'Jardins, Aracaju - SE') +
              ' • Tel: ' +
              (settings.getString('phone') || '(79) 99980-9134')
          }
        } catch (_) {}
      }

      var compiledPageStreams = []

      for (var pIdx = 0; pIdx < totalPages; pIdx++) {
        var pNum = pIdx + 1
        var streamParts = []
        streamParts.push('q\n')

        streamParts.push(
          'BT /F2 13 Tf 0.514 0.094 0.263 rg ' +
            MARGIN_X +
            ' ' +
            HEADER_TOP +
            ' Td (' +
            escPdfWinAnsi(clinicN.toUpperCase()) +
            ') Tj ET\n',
        )
        var rightHeader = patientName + ' • ' + signedDateShort
        var rightHeaderW = measureTextWidth(rightHeader, 8.5)
        streamParts.push(
          'BT /F1 8.5 Tf 0.35 0.40 0.48 rg ' +
            (PAGE_WIDTH - MARGIN_X - rightHeaderW) +
            ' ' +
            HEADER_TOP +
            ' Td (' +
            escPdfWinAnsi(rightHeader) +
            ') Tj ET\n',
        )
        streamParts.push(
          'BT /F1 9 Tf 0.30 0.35 0.42 rg ' +
            MARGIN_X +
            ' ' +
            (HEADER_TOP - 13) +
            ' Td (' +
            escPdfWinAnsi('Ficha de Anamnese e Termo de Consentimento Assinado') +
            ') Tj ET\n',
        )
        streamParts.push(
          'q 0.514 0.094 0.263 RG 1 w ' +
            MARGIN_X +
            ' ' +
            (HEADER_TOP - 20) +
            ' m ' +
            (PAGE_WIDTH - MARGIN_X) +
            ' ' +
            (HEADER_TOP - 20) +
            ' l S Q\n',
        )

        var cmds = pages[pIdx].commands
        for (var ci = 0; ci < cmds.length; ci++) {
          streamParts.push(cmds[ci] + '\n')
        }

        var footerLineY = 48
        streamParts.push(
          'q 0.80 0.83 0.88 RG 0.5 w ' +
            MARGIN_X +
            ' ' +
            footerLineY +
            ' m ' +
            (PAGE_WIDTH - MARGIN_X) +
            ' ' +
            footerLineY +
            ' l S Q\n',
        )
        streamParts.push(
          'BT /F2 8.5 Tf 0.514 0.094 0.263 rg ' +
            MARGIN_X +
            ' ' +
            (footerLineY - 11) +
            ' Td (' +
            escPdfWinAnsi(clinicN) +
            ') Tj ET\n',
        )
        streamParts.push(
          'BT /F1 8.5 Tf 0.35 0.40 0.48 rg ' +
            (MARGIN_X + measureTextWidth(clinicN, 8.5) + 8) +
            ' ' +
            (footerLineY - 11) +
            ' Td (' +
            escPdfWinAnsi('• Profissional Responsável: ' + tResp) +
            ') Tj ET\n',
        )
        var footerL2Left = cAddr + ' • Horário de Brasília (UTC-3)'
        streamParts.push(
          'BT /F1 8 Tf 0.40 0.45 0.52 rg ' +
            MARGIN_X +
            ' ' +
            (footerLineY - 22) +
            ' Td (' +
            escPdfWinAnsi(footerL2Left) +
            ') Tj ET\n',
        )
        var pageStr = 'Página ' + pNum + ' de ' + totalPages
        var pageStrW = measureTextWidth(pageStr, 8)
        streamParts.push(
          'BT /F2 8 Tf 0.30 0.35 0.45 rg ' +
            (PAGE_WIDTH - MARGIN_X - pageStrW) +
            ' ' +
            (footerLineY - 22) +
            ' Td (' +
            escPdfWinAnsi(pageStr) +
            ') Tj ET\n',
        )

        streamParts.push('Q\n')
        compiledPageStreams.push(streamParts.join(''))
      }

      var pdfParts = []
      var offsets = []
      pdfParts.push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')

      function addPdfObj(objContent) {
        var curOffset = 0
        for (var op = 0; op < pdfParts.length; op++) curOffset += pdfParts[op].length
        offsets.push(curOffset)
        pdfParts.push(objContent + '\n')
      }

      addPdfObj('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj')

      var pageObjIds = []
      var fontF1Id = 3
      var fontF2Id = 4
      var imageObjId = signatureImageObj ? 5 : null

      var curNextId = imageObjId ? 6 : 5
      for (var pi = 0; pi < totalPages; pi++) {
        pageObjIds.push(curNextId)
        curNextId += 2
      }

      var kidsArrayStr = pageObjIds
        .map(function (id) {
          return id + ' 0 R'
        })
        .join(' ')
      addPdfObj(
        '2 0 obj\n<< /Type /Pages /Kids [' +
          kidsArrayStr +
          '] /Count ' +
          totalPages +
          ' >>\nendobj',
      )

      addPdfObj(
        fontF1Id +
          ' 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj',
      )
      addPdfObj(
        fontF2Id +
          ' 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj',
      )

      if (signatureImageObj) {
        var imgDict =
          '<< /Type /XObject /Subtype /Image /Width ' +
          signatureImageObj.width +
          ' /Height ' +
          signatureImageObj.height +
          ' /ColorSpace ' +
          signatureImageObj.colorSpace +
          ' /BitsPerComponent ' +
          signatureImageObj.bits
        if (signatureImageObj.filter) {
          imgDict += ' /Filter ' + signatureImageObj.filter
        }
        if (signatureImageObj.decodeParms) {
          imgDict += ' /DecodeParms ' + signatureImageObj.decodeParms
        }
        imgDict += ' /Length ' + signatureImageObj.stream.length + ' >>'

        addPdfObj(
          imageObjId +
            ' 0 obj\n' +
            imgDict +
            '\nstream\n' +
            signatureImageObj.stream +
            '\nendstream\nendobj',
        )
      }

      var xobjRes = signatureImageObj ? ' /XObject << /SigImg ' + imageObjId + ' 0 R >>' : ''
      var resourcesDict =
        '<< /Font << /F1 ' + fontF1Id + ' 0 R /F2 ' + fontF2Id + ' 0 R >>' + xobjRes + ' >>'

      for (var pBuild = 0; pBuild < totalPages; pBuild++) {
        var pId = pageObjIds[pBuild]
        var cId = pId + 1
        var cStream = compiledPageStreams[pBuild]

        addPdfObj(
          pId +
            ' 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' +
            PAGE_WIDTH +
            ' ' +
            PAGE_HEIGHT +
            '] /Resources ' +
            resourcesDict +
            ' /Contents ' +
            cId +
            ' 0 R >>\nendobj',
        )

        addPdfObj(
          cId +
            ' 0 obj\n<< /Length ' +
            cStream.length +
            ' >>\nstream\n' +
            cStream +
            'endstream\nendobj',
        )
      }

      var xrefStart = 0
      for (var xp = 0; xp < pdfParts.length; xp++) xrefStart += pdfParts[xp].length

      var totalObjects = offsets.length
      var xrefStr = 'xref\n0 ' + (totalObjects + 1) + '\n0000000000 65535 f \n'
      for (var oi = 0; oi < offsets.length; oi++) {
        var offS = String(offsets[oi])
        while (offS.length < 10) offS = '0' + offS
        xrefStr += offS + ' 00000 n \n'
      }
      xrefStr +=
        'trailer\n<< /Size ' +
        (totalObjects + 1) +
        ' /Root 1 0 R >>\nstartxref\n' +
        xrefStart +
        '\n%%EOF\n'

      pdfParts.push(xrefStr)

      var rawPdf = pdfParts.join('')
      var pdfBase64 = encodeBinaryStringToBase64(rawPdf)

      return {
        rawPdf: rawPdf,
        base64: pdfBase64,
        size: rawPdf.length,
        pages: totalPages,
      }
    })(record, settingsRec)

    function formatBr(isoStr) {
      if (!isoStr) return 'Data não informada'
      try {
        var d = new Date(isoStr)
        var utc = d.getTime() + d.getTimezoneOffset() * 60000
        var brDate = new Date(utc - 3 * 3600000)
        var dia = String(brDate.getDate())
        if (dia.length < 2) dia = '0' + dia
        var mes = String(brDate.getMonth() + 1)
        if (mes.length < 2) mes = '0' + mes
        var ano = brDate.getFullYear()
        var horas = String(brDate.getHours())
        if (horas.length < 2) horas = '0' + horas
        var minutos = String(brDate.getMinutes())
        if (minutos.length < 2) minutos = '0' + minutos
        return (
          dia + '/' + mes + '/' + ano + ' às ' + horas + ':' + minutos + ' (horário de Brasília)'
        )
      } catch (_) {
        return isoStr
      }
    }

    function getDataCurta(isoStr) {
      try {
        var d = isoStr ? new Date(isoStr) : new Date()
        var utc = d.getTime() + d.getTimezoneOffset() * 60000
        var brDate = new Date(utc - 3 * 3600000)
        var dia = String(brDate.getDate())
        if (dia.length < 2) dia = '0' + dia
        var mes = String(brDate.getMonth() + 1)
        if (mes.length < 2) mes = '0' + mes
        return dia + '-' + mes + '-' + brDate.getFullYear()
      } catch (_) {
        return '31-10-2026'
      }
    }

    function sanitizar(nome) {
      if (!nome) return 'Paciente'
      var s = nome
        .replace(/[áàâãä]/gi, 'a')
        .replace(/[éèêë]/gi, 'e')
        .replace(/[íìîï]/gi, 'i')
        .replace(/[óòôõö]/gi, 'o')
        .replace(/[úùûü]/gi, 'u')
        .replace(/[ç]/gi, 'c')
        .replace(/[ñ]/gi, 'n')
      return s
        .replace(/[^a-zA-Z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
    }

    var dataCurta = getDataCurta(record.getString('signed_at') || record.getString('created'))
    var nomeSanitizado = sanitizar(patientName)
    var pdfFilename = 'Ficha-Anamnese-' + nomeSanitizado + '-' + dataCurta + '.pdf'

    var cleanPdfBase64 = String(pdfResult.base64 || '').replace(/[\r\n\s]/g, '')
    if (cleanPdfBase64.indexOf('base64,') !== -1) {
      cleanPdfBase64 = cleanPdfBase64.substring(cleanPdfBase64.indexOf('base64,') + 7)
    }
    var attachments = [
      {
        filename: pdfFilename,
        content: cleanPdfBase64,
      },
    ]

    var subject = 'Comprovante: Ficha de Anamnese Assinada - ' + patientName + ' - ' + fTypeLabel

    var sigData = record.getString('signature_data') || ''
    var sigHtml =
      sigData && sigData.indexOf('data:image') === 0
        ? '<img src="' +
          sigData +
          '" alt="Assinatura do paciente" style="max-width: 260px; max-height: 90px; border-bottom: 2px solid #831843; display: inline-block;" />'
        : '<div style="height: 60px; border-bottom: 2px solid #831843; display: inline-block; min-width: 200px; line-height: 60px; font-weight: bold; color: #831843;">Assinado Digitalmente</div>'

    function formatBirthDateBR(dateStr) {
      if (!dateStr || dateStr === 'Não informado') return 'Não informado'
      try {
        var clean = String(dateStr).trim().split('T')[0]
        var match = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/)
        if (match) {
          return match[3] + '/' + match[2] + '/' + match[1]
        }
        return dateStr
      } catch (_) {
        return dateStr
      }
    }

    var patientBirth = formatBirthDateBR(record.getString('patient_birth_date'))
    var signedAt = formatBr(record.getString('signed_at') || record.getString('created'))
    var patientCpf = record.getString('patient_cpf') || 'Não informado'
    var termTitle =
      record.getString('accepted_term_title') || 'Termo de Consentimento - ' + fTypeLabel
    var ipOrigem = record.getString('ip_address') || 'Não informado'
    var userAgent = record.getString('user_agent') || 'Navegador Web/Mobile'
    var docHash = record.getString('document_hash') || 'SHA-256 REGISTRADO'

    var getHtml = function (isClinica) {
      var intro = isClinica
        ? 'Olá, <strong>Equipe ' +
          clinicName +
          '</strong>! Uma nova ficha de anamnese foi preenchida e assinada por <strong>' +
          patientName +
          '</strong>.'
        : 'Olá, <strong>' +
          patientName +
          '</strong>! Confirmamos a conclusão e assinatura digital da sua Ficha de Anamnese e Termo de Consentimento.'
      return `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head><meta charset="UTF-8"><title>Comprovante: Ficha de Anamnese Assinada</title></head>
        <body style="font-family: Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b;">
          <div style="max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <div style="background-color: #831843; color: #ffffff; padding: 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 22px; font-weight: bold;">${clinicName}</h1>
              <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.95;">Comprovante de Ficha de Anamnese e Termo Assinado</p>
            </div>
            <div style="padding: 24px;">
              <p style="font-size: 15px; margin-top: 0;">${intro}</p>
              <p style="font-size: 14px; line-height: 1.5; color: #334155;">
                Esta é a notificação oficial registrada para o prontuário digital.
              </p>
              <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 12px; margin: 16px 0; font-size: 13px; color: #166534;">
                <strong>O documento completo em PDF está anexado a esta mensagem.</strong>
              </div>
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px;">
                <tr style="background-color: #fdf2f8; border-bottom: 1px solid #fbcfe8;">
                  <td style="padding: 10px 12px; font-weight: bold; width: 38%; color: #831843;">Tipo de Procedimento:</td>
                  <td style="padding: 10px 12px; font-weight: bold; color: #1e293b;">${fTypeLabel}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px 12px; font-weight: bold; color: #475569;">Nome Completo:</td>
                  <td style="padding: 10px 12px;">${patientName}</td>
                </tr>
                <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px 12px; font-weight: bold; color: #475569;">CPF:</td>
                  <td style="padding: 10px 12px;">${patientCpf}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px 12px; font-weight: bold; color: #475569;">Data de Nascimento:</td>
                  <td style="padding: 10px 12px;">${patientBirth}</td>
                </tr>
                <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px 12px; font-weight: bold; color: #475569;">Data e Hora do Aceite:</td>
                  <td style="padding: 10px 12px; font-weight: 600; color: #0f172a;">${signedAt}</td>
                </tr>
                <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px 12px; font-weight: bold; color: #475569;">Termo e Versão Aceita:</td>
                  <td style="padding: 10px 12px;">${termTitle}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px 12px; font-weight: bold; color: #475569;">E-mail do Paciente:</td>
                  <td style="padding: 10px 12px; color: #0369a1; font-weight: 600;">${patientEmail}</td>
                </tr>
                ${
                  isClinica
                    ? `
                <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px 12px; font-weight: bold; color: #475569;">IP de Origem Real:</td>
                  <td style="padding: 10px 12px; font-family: monospace;">${ipOrigem}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px 12px; font-weight: bold; color: #475569;">Dispositivo / Navegador:</td>
                  <td style="padding: 10px 12px; font-size: 11px; color: #64748b; word-break: break-all;">${userAgent}</td>
                </tr>`
                    : ''
                }
              </table>
              <div style="background-color: #ffffff; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 12px; margin: 18px 0;">
                <div style="margin: 16px 0; text-align: center;">
                  ${sigHtml}
                  <p style="margin: 6px 0 0 0; font-size: 12px; color: #475569; font-weight: 600;">Assinatura do paciente</p>
                </div>
              </div>
              ${
                isClinica
                  ? `
              <div style="background-color: #f1f5f9; border-left: 4px solid #831843; padding: 12px; margin: 18px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 12px; font-weight: bold; color: #0f172a;">Hash SHA-256 do Documento:</p>
                <p style="margin: 4px 0 0 0; font-family: monospace; font-size: 11px; word-break: break-all; color: #334155;">${docHash}</p>
                <p style="margin: 6px 0 0 0; font-size: 11px; color: #64748b; font-style: italic;">
                  Código de verificação de integridade — garante que este documento não foi alterado após a assinatura.
                </p>
              </div>`
                  : `
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px 16px; margin: 18px 0; font-size: 13px; color: #334155; line-height: 1.6;">
                <p style="margin: 0; font-weight: 500; color: #1e293b;">
                  Sua assinatura foi registrada eletronicamente com data, hora e confirmação por e-mail. Você pode solicitar o registro completo a qualquer momento.
                </p>
              </div>`
              }
            </div>
            <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 20px; text-align: center; font-size: 11px; color: #64748b; line-height: 1.5;">
              ${!isClinica ? '<p style="margin: 0 0 8px 0; font-weight: 600; color: #065f46;">Esta é a sua via do documento assinado. Guarde para seus registros.</p>' : ''}
              <p style="margin: 0 0 6px 0; font-size: 11px; color: #475569;">Enviado para: <strong>${patientEmail}</strong></p>
              <strong>${clinicName}</strong> &bull; Profissional Responsável: ${techResp} (${profReg})<br/>
              Endereço: ${clinicAddr} &bull; Telefone: ${clinicPhone}<br/>
              Fuso horário: Horário de Brasília (UTC-3)
            </div>
          </div>
        </body></html>
      `
    }

    // Envia paciente direto via API REST Resend com anexo
    var resendApiKey = $os.getenv('RESEND_API_KEY')
    if (!resendApiKey) {
      console.log('ATENCAO: Segredo RESEND_API_KEY nao configurado no ambiente!')
    }

    function computeSha256HexLocal(str) {
      function rightRotate(value, amount) {
        return (value >>> amount) | (value << (32 - amount))
      }
      var mathPow = Math.pow
      var maxWord = mathPow(2, 32)
      var i, j
      var result = ''
      var words = []
      var asciiBitLength = str.length * 8
      var hash = []
      var k = []
      var primeCounter = 0
      var isComposite = {}
      for (var candidate = 2; primeCounter < 64; candidate++) {
        if (!isComposite[candidate]) {
          for (i = candidate * candidate; i < 312; i += candidate) {
            isComposite[i] = true
          }
          hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0
          k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0
        }
      }
      str += '\x80'
      while ((str.length % 64) - 56) str += '\x00'
      for (i = 0; i < str.length; i++) {
        j = str.charCodeAt(i)
        words[i >> 2] |= j << (((3 - i) % 4) * 8)
      }
      words[words.length] = (asciiBitLength / maxWord) | 0
      words[words.length] = asciiBitLength | 0
      for (j = 0; j < words.length; ) {
        var w = words.slice(j, (j += 16))
        var oldHash = hash.slice(0)
        for (i = 0; i < 64; i++) {
          var w15 = w[i - 15],
            w2 = w[i - 2]
          var s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)
          var s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10)
          w[i] = i < 16 ? w[i] : (w[i - 16] + s0 + w[i - 7] + s1) | 0
          var ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6])
          var maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2])
          var temp1 =
            (hash[7] +
              (rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25)) +
              ch +
              k[i] +
              w[i]) |
            0
          var temp2 =
            ((rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22)) +
              maj) |
            0
          hash = [
            (temp1 + temp2) | 0,
            hash[0],
            hash[1],
            hash[2],
            (hash[3] + temp1) | 0,
            hash[4],
            hash[5],
            hash[6],
          ]
        }
        for (i = 0; i < 8; i++) {
          hash[i] = (hash[i] + oldHash[i]) | 0
        }
      }
      for (i = 0; i < 8; i++) {
        for (j = 3; j >= 0; j--) {
          var b = (hash[i] >> (j * 8)) & 255
          result += (b < 16 ? '0' : '') + b.toString(16)
        }
      }
      return result
    }

    function recordAuditInHook(formId, evType, desc, stepNum, meta) {
      try {
        var aCol = $app.findCollectionByNameOrId('audit_events')
        var recs = $app.findRecordsByFilter(
          'audit_events',
          'form_submission = {:fid}',
          '-created',
          1,
          0,
          { fid: formId },
        )
        var pHash = ''
        if (recs && recs.length > 0) {
          pHash = recs[0].getString('chain_hash') || ''
        }
        var nIso = new Date().toISOString()
        var payload = (pHash || 'GENESIS') + '|' + formId + '|' + evType + '|' + desc + '|' + nIso
        var cHash = computeSha256HexLocal(payload)
        var aRec = new Record(aCol)
        aRec.set('form_submission', formId)
        aRec.set('event_type', evType)
        aRec.set('description', desc)
        aRec.set('step_number', stepNum || 3)
        aRec.set('metadata', meta || null)
        aRec.set('timestamp', nIso)
        aRec.set('previous_hash', pHash)
        aRec.set('chain_hash', cHash)
        $app.save(aRec)
      } catch (err) {
        console.log('Erro ao salvar auditoria em hook: ' + err.message)
      }
    }

    var pacDeliveryOk = false
    var pacDeliveryError = ''

    if (patientEmail && patientEmail.indexOf('@') > 0 && resendApiKey) {
      try {
        var resPac = $http.send({
          url: 'https://api.resend.com/emails',
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + resendApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: senderEmail,
            to: [patientEmail],
            subject: subject,
            html: getHtml(false),
            attachments: [
              {
                filename: pdfFilename,
                content: cleanPdfBase64,
              },
            ],
          }),
        })

        if (resPac.statusCode >= 200 && resPac.statusCode < 300) {
          var dataPac = resPac.json || {}
          pacDeliveryOk = true
          console.log(
            'Direct Resend REST API email with attachment sent to ' +
              patientEmail +
              '. ID: ' +
              (dataPac.id || '') +
              '. Attachment: ' +
              pdfFilename +
              ' (' +
              pdfResult.size +
              ' bytes, ' +
              pdfResult.pages +
              ' paginas)',
          )
          recordAuditInHook(
            record.id,
            'email_comprovante_enviado',
            'Comprovante com PDF enviado com sucesso para ' + patientEmail,
            3,
            { resend_id: dataPac.id || '', recipient: patientEmail, status: 'enviado' },
          )
        } else {
          var rawMsg = resPac.raw || ''
          pacDeliveryError = 'Status ' + resPac.statusCode + ': ' + rawMsg
          console.log(
            'Falha ao enviar e-mail para paciente via Resend API (' +
              resPac.statusCode +
              '): ' +
              rawMsg,
          )
          recordAuditInHook(
            record.id,
            'email_comprovante_falha',
            'Falha no envio do comprovante para ' + patientEmail + ': ' + rawMsg.substring(0, 200),
            3,
            { status_code: resPac.statusCode, error: rawMsg.substring(0, 500) },
          )
        }
      } catch (errPac) {
        pacDeliveryError = errPac.message
        console.log('Falha ao enviar e-mail para paciente: ' + errPac.message)
        recordAuditInHook(
          record.id,
          'email_comprovante_falha',
          'Falha de conexão no envio do comprovante para ' + patientEmail + ': ' + errPac.message,
          3,
          { error: errPac.message },
        )
      }
    }

    // Envia clínica direto via API REST Resend com anexo
    if (clinicEmail && clinicEmail.indexOf('@') > 0 && resendApiKey) {
      try {
        var resCli = $http.send({
          url: 'https://api.resend.com/emails',
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + resendApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: senderEmail,
            to: [clinicEmail],
            subject: subject,
            html: getHtml(true),
            attachments: [
              {
                filename: pdfFilename,
                content: cleanPdfBase64,
              },
            ],
          }),
        })

        if (resCli.statusCode >= 200 && resCli.statusCode < 300) {
          var dataCli = resCli.json || {}
          console.log(
            'Direct Resend REST API email with attachment sent to ' +
              clinicEmail +
              '. ID: ' +
              (dataCli.id || '') +
              '. Attachment: ' +
              pdfFilename +
              ' (' +
              pdfResult.size +
              ' bytes, ' +
              pdfResult.pages +
              ' paginas)',
          )
        } else {
          console.log(
            'Falha ao enviar e-mail para clinica via Resend API (' +
              resCli.statusCode +
              '): ' +
              resCli.raw,
          )
        }
      } catch (errCli) {
        console.log('Falha ao enviar e-mail para clinica: ' + errCli.message)
      }
    }

    try {
      record.set('pdf_attached_to_email', pacDeliveryOk)
      record.set('force_email_resend', false)
      record.set('email_delivery_status', pacDeliveryOk ? 'enviado' : 'falha')
      record.set('email_sent_at', new Date().toISOString())
      record.set('email_delivery_error', pacDeliveryError || '')
      $app.save(record)
    } catch (saveErr) {
      console.log('Erro ao salvar status de envio no form_submissions: ' + saveErr.message)
    }
  } catch (err) {
    console.log('Erro no onRecordAfterUpdateSuccess form_submissions: ' + err.message)
  }
}, 'form_submissions')
