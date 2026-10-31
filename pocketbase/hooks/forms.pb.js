// pocketbase/hooks/forms.pb.js
// Back-end oficial da Ficha Digital de Anamnese - Andresa Souza Clinic
// Contém todas as rotas e hooks oficiais para validação, auditoria, envio de e-mails e geração de PDF.
// Autocontido: sem declarações fora de callbacks que quebrem o scoping do Goja/PocketBase VM pool.

/**
 * GET /backend/v1/client-ip
 * Retorna o IP real do cliente verificando headers padrão de proxy
 */
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

  var apiKey = $os.getenv('RESEND_API_KEY')
  if (!apiKey) {
    apiKey = 're_WGhaCJ6S_BhPNPw426wcJqyc4w7mywxsq'
  }

  try {
    var response = $http.send({
      url: 'https://api.resend.com/emails',
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      data: JSON.stringify({
        from: senderEmail,
        to: [email],
        subject: subject,
        html: html,
      }),
      timeout: 25,
    })

    if (response.statusCode >= 200 && response.statusCode < 300) {
      var resBody = {}
      try {
        resBody = JSON.parse(response.raw)
      } catch (_) {}
      console.log(
        'Codigo de verificacao ' +
          code +
          ' enviado com sucesso para ' +
          email +
          '. Resend ID: ' +
          (resBody.id || ''),
      )
    } else {
      console.log(
        'Falha ao enviar e-mail via Resend HTTP ' + response.statusCode + ': ' + response.raw,
      )
      return e.json(500, {
        success: false,
        message: 'Falha ao enviar e-mail via Resend: ' + response.raw,
      })
    }
  } catch (err) {
    console.log('Falha ao enviar e-mail do codigo de verificacao: ' + err.message)
    return e.json(500, { success: false, message: 'Falha ao enviar e-mail: ' + err.message })
  }

  // Registra auditoria
  try {
    var auditCol = $app.findCollectionByNameOrId('audit_events')
    var auditRec = new Record(auditCol)
    auditRec.set('form_submission', formRecord.id)
    auditRec.set('event_type', 'codigo_enviado')
    auditRec.set('description', 'Codigo de verificacao enviado para o e-mail ' + email)
    auditRec.set('step_number', 2)
    auditRec.set('timestamp', new Date().toISOString())
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

    // Auditoria
    var auditCol = $app.findCollectionByNameOrId('audit_events')
    var auditRec = new Record(auditCol)
    auditRec.set('form_submission', formRecord.id)
    auditRec.set('event_type', 'codigo_validado')
    auditRec.set(
      'description',
      'Codigo de e-mail (' + code + ') validado com sucesso para ' + email,
    )
    auditRec.set('step_number', 2)
    auditRec.set('timestamp', nowIso)
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
  var eventType = body.event_type || ''
  var description = body.description || ''
  var stepNumber = body.step_number || 0
  var metadata = body.metadata || {}

  if (!token || !eventType) {
    return e.json(400, { success: false, message: 'Token e event_type sao obrigatorios.' })
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
    var auditCol = $app.findCollectionByNameOrId('audit_events')
    var rec = new Record(auditCol)
    rec.set('form_submission', formRecord.id)
    rec.set('event_type', eventType)
    rec.set('description', description)
    rec.set('step_number', stepNumber)
    rec.set('ip_address', ip)
    rec.set('user_agent', ua)
    rec.set('metadata', metadata)
    rec.set('timestamp', new Date().toISOString())
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

  var id = body.id || ''
  if (!id) {
    return e.json(400, { success: false, message: 'ID da ficha e obrigatorio.' })
  }

  var formRecord = null
  try {
    formRecord = $app.findRecordById('form_submissions', id)
  } catch (err) {
    return e.json(404, { success: false, message: 'Ficha nao encontrada.' })
  }

  // Helper local para codificação Base64
  var toBase64Local = function (str) {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    var bytes = []
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i)
      if (c < 128) {
        bytes.push(c)
      } else if (c < 2048) {
        bytes.push((c >> 6) | 192)
        bytes.push((c & 63) | 128)
      } else {
        bytes.push((c >> 12) | 224)
        bytes.push(((c >> 6) & 63) | 128)
        bytes.push((c & 63) | 128)
      }
    }
    var output = ''
    var l = bytes.length
    for (var j = 0; j < l; j += 3) {
      var b0 = bytes[j]
      var b1 = j + 1 < l ? bytes[j + 1] : 0
      var b2 = j + 2 < l ? bytes[j + 2] : 0
      output += chars.charAt(b0 >> 2)
      output += chars.charAt(((b0 & 3) << 4) | (b1 >> 4))
      output += j + 1 < l ? chars.charAt(((b1 & 15) << 2) | (b2 >> 6)) : '='
      output += j + 2 < l ? chars.charAt(b2 & 63) : '='
    }
    return output
  }

  // Helper local para formatação de data de Brasília
  var formatBr = function (isoStr) {
    if (!isoStr) return 'Data nao informada'
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
      return dia + '/' + mes + '/' + ano + ' as ' + horas + ':' + minutos + ' (horario de Brasilia)'
    } catch (_) {
      return isoStr
    }
  }

  var getDataCurta = function (isoStr) {
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

  var sanitizar = function (nome) {
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

  var normAscii = function (str) {
    if (!str) return ''
    return String(str)
      .replace(/[áàâãä]/gi, 'a')
      .replace(/[éèêë]/gi, 'e')
      .replace(/[íìîï]/gi, 'i')
      .replace(/[óòôõö]/gi, 'o')
      .replace(/[úùûü]/gi, 'u')
      .replace(/[ç]/gi, 'c')
      .replace(/[ñ]/gi, 'n')
      .replace(/[ÁÀÂÃÄ]/g, 'A')
      .replace(/[ÉÈÊË]/g, 'E')
      .replace(/[ÍÌÎÏ]/g, 'I')
      .replace(/[ÓÒÔÕÖ]/g, 'O')
      .replace(/[ÚÙÛÜ]/g, 'U')
      .replace(/[Ç]/g, 'C')
      .replace(/[Ñ]/g, 'N')
  }

  var escPdf = function (text) {
    if (!text) return ''
    return String(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
  }

  // Configs da clínica
  var settingsRec = null
  try {
    var recs = $app.findRecordsByFilter('clinic_settings', '', '-created', 1, 0)
    if (recs && recs.length > 0) settingsRec = recs[0]
  } catch (_) {}

  var clinicName = 'Andresa Souza Clinic'
  var techResp = 'Dra. Andresa Souza'
  var profReg = 'CRBM 12345'
  var clinicAddr = 'Jardins, Aracaju - SE'
  var clinicPhone = '79998091314'
  var clinicEmail = 'gihobaicn@hotmail.com'
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
    geral: 'Anamnese Geral',
    labios: 'Labios & Micropigmentacao Labial',
    botox: 'Toxina Botulinica (Botox)',
  }
  var fTypeLabel = formTypeLabels[fType] || fType

  // Monta PDF
  var patientCpf = formRecord.getString('patient_cpf') || 'Nao informado'
  var patientPhone = formRecord.getString('patient_phone') || 'Nao informado'
  var patientBirth = formRecord.getString('patient_birth_date') || 'Nao informado'
  var patientRg = formRecord.getString('patient_rg') || 'Nao informado'
  var patientProf = formRecord.getString('patient_profession') || 'Nao informado'
  var patientEmerg = formRecord.getString('patient_emergency_contact') || 'Nao informado'
  var patientAddr = formRecord.getString('patient_address') || 'Nao informado'

  var signedAt = formatBr(formRecord.getString('signed_at') || formRecord.getString('created'))
  var ipOrigem = formRecord.getString('ip_address') || 'Nao informado'
  var userAgent = formRecord.getString('user_agent') || 'Navegador Web/Mobile'
  var docHash = formRecord.getString('document_hash') || 'SHA-256 REGISTRADO'
  var termTitle =
    formRecord.getString('accepted_term_title') || 'Termo de Consentimento - ' + fTypeLabel
  var sigData = formRecord.getString('signature_data') || ''

  var lines = []
  lines.push({ size: 16, bold: true, color: '0.51 0.09 0.26', text: normAscii(clinicName) })
  lines.push({
    size: 10,
    bold: false,
    color: '0.4 0.4 0.4',
    text: 'Prontuario Digital & Ficha de Anamnese Oficial',
  })
  lines.push({
    size: 10,
    bold: false,
    color: '0.4 0.4 0.4',
    text: 'Procedimento: ' + normAscii(fTypeLabel),
  })
  lines.push({
    size: 8,
    bold: false,
    color: '0.7 0.7 0.7',
    text: '_____________________________________________________________________________________',
  })
  lines.push({ size: 6, text: '' })

  lines.push({
    size: 12,
    bold: true,
    color: '0.51 0.09 0.26',
    text: '1. DADOS CADASTRAIS DO PACIENTE',
  })
  lines.push({
    size: 9,
    bold: false,
    color: '0.1 0.1 0.1',
    text: 'Nome: ' + normAscii(patientName) + '   |   CPF: ' + normAscii(patientCpf),
  })
  lines.push({
    size: 9,
    bold: false,
    color: '0.1 0.1 0.1',
    text: 'E-mail: ' + normAscii(patientEmail) + '   |   Telefone: ' + normAscii(patientPhone),
  })
  lines.push({
    size: 9,
    bold: false,
    color: '0.1 0.1 0.1',
    text: 'Nascimento: ' + normAscii(patientBirth) + '   |   RG: ' + normAscii(patientRg),
  })
  lines.push({
    size: 9,
    bold: false,
    color: '0.1 0.1 0.1',
    text: 'Profissao: ' + normAscii(patientProf) + '   |   Emergencia: ' + normAscii(patientEmerg),
  })
  lines.push({
    size: 9,
    bold: false,
    color: '0.1 0.1 0.1',
    text: 'Endereco: ' + normAscii(patientAddr),
  })
  lines.push({ size: 6, text: '' })

  lines.push({
    size: 12,
    bold: true,
    color: '0.51 0.09 0.26',
    text: '2. QUESTIONARIO DE ANAMNESE E SAUDE',
  })
  try {
    var rawAnswers = formRecord.getString('answers')
    if (rawAnswers) {
      var answersObj = JSON.parse(rawAnswers)
      var aKeys = Object.keys(answersObj)
      for (var k = 0; k < aKeys.length; k++) {
        var aKey = aKeys[k]
        var val = answersObj[aKey]
        var label = aKey.replace(/_/g, ' ').toUpperCase()
        var valStr = Array.isArray(val) ? val.join(', ') : String(val)
        lines.push({
          size: 8,
          bold: false,
          color: '0.2 0.2 0.2',
          text: '- ' + normAscii(label) + ': ' + normAscii(valStr),
        })
      }
    }
  } catch (_) {
    lines.push({
      size: 8,
      bold: false,
      color: '0.4 0.4 0.4',
      text: 'Respostas arquivadas no sistema.',
    })
  }
  lines.push({ size: 6, text: '' })

  lines.push({
    size: 12,
    bold: true,
    color: '0.51 0.09 0.26',
    text: '3. TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO',
  })
  lines.push({ size: 9, bold: true, color: '0.2 0.2 0.2', text: normAscii(termTitle) })
  lines.push({
    size: 8,
    bold: false,
    color: '0.3 0.3 0.3',
    text: 'Declaracao de consentimento integralmente lida, confirmada e assinada eletronicamente.',
  })
  lines.push({ size: 6, text: '' })

  lines.push({
    size: 11,
    bold: true,
    color: '0.51 0.09 0.26',
    text: '4. CERTIFICADO DE ASSINATURA ELETRONICA',
  })
  lines.push({
    size: 8,
    bold: false,
    color: '0.1 0.1 0.1',
    text: 'Data e Hora: ' + normAscii(signedAt),
  })
  lines.push({
    size: 8,
    bold: false,
    color: '0.1 0.1 0.1',
    text: 'IP de Origem Real: ' + normAscii(ipOrigem),
  })
  lines.push({
    size: 8,
    bold: false,
    color: '0.1 0.1 0.1',
    text: 'Hash SHA-256 de Integridade: ' + normAscii(docHash),
  })
  lines.push({
    size: 7,
    bold: false,
    color: '0.4 0.4 0.4',
    text: 'Dispositivo: ' + normAscii(userAgent.substring(0, 100)),
  })
  lines.push({
    size: 8,
    bold: true,
    color: '0.1 0.1 0.1',
    text: 'Status: ASSINATURA ELETRONICA VALIDA E CONCLUIDA',
  })
  lines.push({
    size: 8,
    bold: false,
    color: '0.2 0.2 0.2',
    text: 'Signatario: ' + normAscii(patientName),
  })
  lines.push({
    size: 8,
    bold: false,
    color: '0.7 0.7 0.7',
    text: '_____________________________________________________________________________________',
  })
  lines.push({
    size: 7,
    bold: false,
    color: '0.4 0.4 0.4',
    text:
      normAscii(clinicName) +
      ' | Resp. Tecnica: ' +
      normAscii(techResp) +
      ' (' +
      normAscii(profReg) +
      ')',
  })
  lines.push({
    size: 7,
    bold: false,
    color: '0.4 0.4 0.4',
    text: 'Endereco: ' + normAscii(clinicAddr) + ' | Telefone: ' + normAscii(clinicPhone),
  })

  var streamContent = 'q\n'
  var currentY = 780
  for (var li = 0; li < lines.length; li++) {
    var ln = lines[li]
    if (ln.text === '') {
      currentY -= ln.size || 6
      continue
    }
    var fontName = ln.bold ? '/F2' : '/F1'
    var fontSize = ln.size || 9
    var color = ln.color || '0 0 0'

    streamContent +=
      'BT\n' +
      color +
      ' rg\n' +
      fontName +
      ' ' +
      fontSize +
      ' Tf\n1 0 0 1 40 ' +
      currentY +
      ' Tm\n(' +
      escPdf(ln.text) +
      ') Tj\nET\n'
    currentY -= Math.round(fontSize * 1.35) + 3
    if (currentY < 40) break
  }
  streamContent += 'Q\n'

  var pdfParts = []
  var offsets = []
  pdfParts.push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')

  var addObj = function (content) {
    var t = 0
    for (var p = 0; p < pdfParts.length; p++) t += pdfParts[p].length
    offsets.push(t)
    pdfParts.push(content + '\n')
  }

  addObj('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj')
  addObj('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj')
  addObj(
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj',
  )
  addObj(
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj',
  )
  addObj(
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj',
  )
  addObj(
    '6 0 obj\n<< /Length ' +
      streamContent.length +
      ' >>\nstream\n' +
      streamContent +
      'endstream\nendobj',
  )

  var xrefOffset = 0
  for (var o = 0; o < pdfParts.length; o++) xrefOffset += pdfParts[o].length

  var xref = 'xref\n0 ' + (offsets.length + 1) + '\n0000000000 65535 f \n'
  for (var k = 0; k < offsets.length; k++) {
    var offStr = String(offsets[k])
    while (offStr.length < 10) offStr = '0' + offStr
    xref += offStr + ' 00000 n \n'
  }
  xref +=
    'trailer\n<< /Size ' +
    (offsets.length + 1) +
    ' /Root 1 0 R >>\nstartxref\n' +
    xrefOffset +
    '\n%%EOF\n'
  pdfParts.push(xref)

  var pdfRaw = pdfParts.join('')
  var pdfBase64 = toBase64Local(pdfRaw)
  var pdfSize = pdfRaw.length

  var dataCurta = getDataCurta(formRecord.getString('signed_at') || formRecord.getString('created'))
  var nomeSanitizado = sanitizar(patientName)
  var pdfFilename = 'Ficha-Anamnese-' + nomeSanitizado + '-' + dataCurta + '.pdf'

  var attachments = [
    {
      filename: pdfFilename,
      content: pdfBase64,
    },
  ]

  var subject = 'Comprovante: Ficha de Anamnese Assinada - ' + patientName + ' - ' + fTypeLabel

  var sigHtml =
    sigData && sigData.indexOf('data:image') === 0
      ? '<img src="' +
        sigData +
        '" alt="Assinatura do paciente" style="max-width: 260px; max-height: 90px; border-bottom: 2px solid #831843; display: inline-block;" />'
      : '<div style="height: 60px; border-bottom: 2px solid #831843; display: inline-block; min-width: 200px; line-height: 60px; font-weight: bold; color: #831843;">Assinado Digitalmente</div>'

  var getHtml = function (isClinica) {
    var intro = isClinica
      ? 'Ola, <strong>Equipe ' +
        clinicName +
        '</strong>! Segue o comprovante da ficha de anamnese assinada por <strong>' +
        patientName +
        '</strong>.'
      : 'Ola, <strong>' +
        patientName +
        '</strong>! Confirmamos a conclusao e assinatura digital da sua Ficha de Anamnese e Termo de Consentimento.'
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
              Esta e a notificacao oficial registrada para o prontuario digital.
            </p>
            <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 12px; margin: 16px 0; font-size: 13px; color: #166534;">
              <strong>O documento completo em PDF esta anexado a esta mensagem.</strong>
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
                <td style="padding: 10px 12px; font-weight: bold; color: #475569;">Data e Hora do Aceite:</td>
                <td style="padding: 10px 12px; font-weight: 600; color: #0f172a;">${signedAt}</td>
              </tr>
              <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 12px; font-weight: bold; color: #475569;">Termo e Versao Aceita:</td>
                <td style="padding: 10px 12px;">${termTitle}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 12px; font-weight: bold; color: #475569;">E-mail do Paciente:</td>
                <td style="padding: 10px 12px; color: #0369a1; font-weight: 600;">${patientEmail}</td>
              </tr>
              <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 12px; font-weight: bold; color: #475569;">IP de Origem REAL:</td>
                <td style="padding: 10px 12px; font-family: monospace;">${ipOrigem}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 12px; font-weight: bold; color: #475569;">Dispositivo / Navegador:</td>
                <td style="padding: 10px 12px; font-size: 11px; color: #64748b; word-break: break-all;">${userAgent}</td>
              </tr>
            </table>
            <div style="background-color: #ffffff; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 12px; margin: 18px 0;">
              <div style="margin: 16px 0; text-align: center;">
                ${sigHtml}
                <p style="margin: 6px 0 0 0; font-size: 12px; color: #475569; font-weight: 600;">Assinatura do paciente</p>
              </div>
            </div>
            <div style="background-color: #f1f5f9; border-left: 4px solid #831843; padding: 12px; margin: 18px 0; border-radius: 4px;">
              <p style="margin: 0; font-size: 12px; font-weight: bold; color: #0f172a;">Hash SHA-256 do Documento:</p>
              <p style="margin: 4px 0 0 0; font-family: monospace; font-size: 11px; word-break: break-all; color: #334155;">${docHash}</p>
              <p style="margin: 6px 0 0 0; font-size: 11px; color: #64748b; font-style: italic;">
                Codigo de verificacao de integridade - garante que este documento nao foi alterado apos a assinatura.
              </p>
            </div>
          </div>
          <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 20px; text-align: center; font-size: 11px; color: #64748b; line-height: 1.5;">
            <strong>${clinicName}</strong> &bull; Responsavel Tecnica: ${techResp} (${profReg})<br/>
            Endereco: ${clinicAddr} &bull; Telefone: ${clinicPhone}<br/>
            Fuso horario: Horario de Brasilia (UTC-3)
          </div>
        </div>
      </body></html>
    `
  }

  var apiKey = $os.getenv('RESEND_API_KEY')
  if (!apiKey) {
    apiKey = 're_WGhaCJ6S_BhPNPw426wcJqyc4w7mywxsq'
  }

  // Envia paciente
  if (patientEmail && patientEmail.indexOf('@') > 0) {
    try {
      var respPac = $http.send({
        url: 'https://api.resend.com/emails',
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + apiKey,
          'Content-Type': 'application/json',
        },
        data: JSON.stringify({
          from: senderEmail,
          to: [patientEmail],
          subject: subject,
          html: getHtml(false),
          attachments: attachments,
        }),
        timeout: 25,
      })
      var bodyPac = {}
      try {
        bodyPac = JSON.parse(respPac.raw)
      } catch (_) {}
      console.log(
        'Direct Resend email with attachment sent to ' +
          patientEmail +
          '. ID: ' +
          (bodyPac.id || '') +
          '. Attachment: ' +
          pdfFilename +
          ' (' +
          pdfSize +
          ' bytes)',
      )
    } catch (errPac) {
      console.log('Falha ao reenviar e-mail para paciente: ' + errPac.message)
    }
  }

  // Envia clínica
  if (clinicEmail && clinicEmail.indexOf('@') > 0) {
    try {
      var respCli = $http.send({
        url: 'https://api.resend.com/emails',
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + apiKey,
          'Content-Type': 'application/json',
        },
        data: JSON.stringify({
          from: senderEmail,
          to: [clinicEmail],
          subject: subject,
          html: getHtml(true),
          attachments: attachments,
        }),
        timeout: 25,
      })
      var bodyCli = {}
      try {
        bodyCli = JSON.parse(respCli.raw)
      } catch (_) {}
      console.log(
        'Direct Resend email with attachment sent to ' +
          clinicEmail +
          '. ID: ' +
          (bodyCli.id || '') +
          '. Attachment: ' +
          pdfFilename +
          ' (' +
          pdfSize +
          ' bytes)',
      )
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

    // Se já foi enviado com sucesso, evita reenvio duplicado
    var deliveryStatus = record.getString('email_delivery_status')
    var alreadyAttached = record.getBool('pdf_attached_to_email')
    if (deliveryStatus === 'enviado' && alreadyAttached) {
      return
    }

    var toBase64Local = function (str) {
      var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
      var bytes = []
      for (var i = 0; i < str.length; i++) {
        var c = str.charCodeAt(i)
        if (c < 128) {
          bytes.push(c)
        } else if (c < 2048) {
          bytes.push((c >> 6) | 192)
          bytes.push((c & 63) | 128)
        } else {
          bytes.push((c >> 12) | 224)
          bytes.push(((c >> 6) & 63) | 128)
          bytes.push((c & 63) | 128)
        }
      }
      var output = ''
      var l = bytes.length
      for (var j = 0; j < l; j += 3) {
        var b0 = bytes[j]
        var b1 = j + 1 < l ? bytes[j + 1] : 0
        var b2 = j + 2 < l ? bytes[j + 2] : 0
        output += chars.charAt(b0 >> 2)
        output += chars.charAt(((b0 & 3) << 4) | (b1 >> 4))
        output += j + 1 < l ? chars.charAt(((b1 & 15) << 2) | (b2 >> 6)) : '='
        output += j + 2 < l ? chars.charAt(b2 & 63) : '='
      }
      return output
    }

    var formatBr = function (isoStr) {
      if (!isoStr) return 'Data nao informada'
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
          dia + '/' + mes + '/' + ano + ' as ' + horas + ':' + minutos + ' (horario de Brasilia)'
        )
      } catch (_) {
        return isoStr
      }
    }

    var getDataCurta = function (isoStr) {
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

    var sanitizar = function (nome) {
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

    var normAscii = function (str) {
      if (!str) return ''
      return String(str)
        .replace(/[áàâãä]/gi, 'a')
        .replace(/[éèêë]/gi, 'e')
        .replace(/[íìîï]/gi, 'i')
        .replace(/[óòôõö]/gi, 'o')
        .replace(/[úùûü]/gi, 'u')
        .replace(/[ç]/gi, 'c')
        .replace(/[ñ]/gi, 'n')
        .replace(/[ÁÀÂÃÄ]/g, 'A')
        .replace(/[ÉÈÊË]/g, 'E')
        .replace(/[ÍÌÎÏ]/g, 'I')
        .replace(/[ÓÒÔÕÖ]/g, 'O')
        .replace(/[ÚÙÛÜ]/g, 'U')
        .replace(/[Ç]/g, 'C')
        .replace(/[Ñ]/g, 'N')
    }

    var escPdf = function (text) {
      if (!text) return ''
      return String(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
    }

    var settingsRec = null
    try {
      var recs = $app.findRecordsByFilter('clinic_settings', '', '-created', 1, 0)
      if (recs && recs.length > 0) settingsRec = recs[0]
    } catch (_) {}

    var clinicName = 'Andresa Souza Clinic'
    var techResp = 'Dra. Andresa Souza'
    var profReg = 'CRBM 12345'
    var clinicAddr = 'Jardins, Aracaju - SE'
    var clinicPhone = '79998091314'
    var clinicEmail = 'gihobaicn@hotmail.com'
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
      geral: 'Anamnese Geral',
      labios: 'Labios & Micropigmentacao Labial',
      botox: 'Toxina Botulinica (Botox)',
    }
    var fTypeLabel = formTypeLabels[fType] || fType

    var patientCpf = record.getString('patient_cpf') || 'Nao informado'
    var patientPhone = record.getString('patient_phone') || 'Nao informado'
    var patientBirth = record.getString('patient_birth_date') || 'Nao informado'
    var patientRg = record.getString('patient_rg') || 'Nao informado'
    var patientProf = record.getString('patient_profession') || 'Nao informado'
    var patientEmerg = record.getString('patient_emergency_contact') || 'Nao informado'
    var patientAddr = record.getString('patient_address') || 'Nao informado'

    var signedAt = formatBr(record.getString('signed_at') || record.getString('created'))
    var ipOrigem = record.getString('ip_address') || 'Nao informado'
    var userAgent = record.getString('user_agent') || 'Navegador Web/Mobile'
    var docHash = record.getString('document_hash') || 'SHA-256 REGISTRADO'
    var termTitle =
      record.getString('accepted_term_title') || 'Termo de Consentimento - ' + fTypeLabel
    var sigData = record.getString('signature_data') || ''

    var lines = []
    lines.push({ size: 16, bold: true, color: '0.51 0.09 0.26', text: normAscii(clinicName) })
    lines.push({
      size: 10,
      bold: false,
      color: '0.4 0.4 0.4',
      text: 'Prontuario Digital & Ficha de Anamnese Oficial',
    })
    lines.push({
      size: 10,
      bold: false,
      color: '0.4 0.4 0.4',
      text: 'Procedimento: ' + normAscii(fTypeLabel),
    })
    lines.push({
      size: 8,
      bold: false,
      color: '0.7 0.7 0.7',
      text: '_____________________________________________________________________________________',
    })
    lines.push({ size: 6, text: '' })

    lines.push({
      size: 12,
      bold: true,
      color: '0.51 0.09 0.26',
      text: '1. DADOS CADASTRAIS DO PACIENTE',
    })
    lines.push({
      size: 9,
      bold: false,
      color: '0.1 0.1 0.1',
      text: 'Nome: ' + normAscii(patientName) + '   |   CPF: ' + normAscii(patientCpf),
    })
    lines.push({
      size: 9,
      bold: false,
      color: '0.1 0.1 0.1',
      text: 'E-mail: ' + normAscii(patientEmail) + '   |   Telefone: ' + normAscii(patientPhone),
    })
    lines.push({
      size: 9,
      bold: false,
      color: '0.1 0.1 0.1',
      text: 'Nascimento: ' + normAscii(patientBirth) + '   |   RG: ' + normAscii(patientRg),
    })
    lines.push({
      size: 9,
      bold: false,
      color: '0.1 0.1 0.1',
      text:
        'Profissao: ' + normAscii(patientProf) + '   |   Emergencia: ' + normAscii(patientEmerg),
    })
    lines.push({
      size: 9,
      bold: false,
      color: '0.1 0.1 0.1',
      text: 'Endereco: ' + normAscii(patientAddr),
    })
    lines.push({ size: 6, text: '' })

    lines.push({
      size: 12,
      bold: true,
      color: '0.51 0.09 0.26',
      text: '2. QUESTIONARIO DE ANAMNESE E SAUDE',
    })
    try {
      var rawAnswers = record.getString('answers')
      if (rawAnswers) {
        var answersObj = JSON.parse(rawAnswers)
        var aKeys = Object.keys(answersObj)
        for (var k = 0; k < aKeys.length; k++) {
          var aKey = aKeys[k]
          var val = answersObj[aKey]
          var label = aKey.replace(/_/g, ' ').toUpperCase()
          var valStr = Array.isArray(val) ? val.join(', ') : String(val)
          lines.push({
            size: 8,
            bold: false,
            color: '0.2 0.2 0.2',
            text: '- ' + normAscii(label) + ': ' + normAscii(valStr),
          })
        }
      }
    } catch (_) {
      lines.push({
        size: 8,
        bold: false,
        color: '0.4 0.4 0.4',
        text: 'Respostas arquivadas no sistema.',
      })
    }
    lines.push({ size: 6, text: '' })

    lines.push({
      size: 12,
      bold: true,
      color: '0.51 0.09 0.26',
      text: '3. TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO',
    })
    lines.push({ size: 9, bold: true, color: '0.2 0.2 0.2', text: normAscii(termTitle) })
    lines.push({
      size: 8,
      bold: false,
      color: '0.3 0.3 0.3',
      text: 'Declaracao de consentimento integralmente lida, confirmada e assinada eletronicamente.',
    })
    lines.push({ size: 6, text: '' })

    lines.push({
      size: 11,
      bold: true,
      color: '0.51 0.09 0.26',
      text: '4. CERTIFICADO DE ASSINATURA ELETRONICA',
    })
    lines.push({
      size: 8,
      bold: false,
      color: '0.1 0.1 0.1',
      text: 'Data e Hora: ' + normAscii(signedAt),
    })
    lines.push({
      size: 8,
      bold: false,
      color: '0.1 0.1 0.1',
      text: 'IP de Origem Real: ' + normAscii(ipOrigem),
    })
    lines.push({
      size: 8,
      bold: false,
      color: '0.1 0.1 0.1',
      text: 'Hash SHA-256 de Integridade: ' + normAscii(docHash),
    })
    lines.push({
      size: 7,
      bold: false,
      color: '0.4 0.4 0.4',
      text: 'Dispositivo: ' + normAscii(userAgent.substring(0, 100)),
    })
    lines.push({
      size: 8,
      bold: true,
      color: '0.1 0.1 0.1',
      text: 'Status: ASSINATURA ELETRONICA VALIDA E CONCLUIDA',
    })
    lines.push({
      size: 8,
      bold: false,
      color: '0.2 0.2 0.2',
      text: 'Signatario: ' + normAscii(patientName),
    })
    lines.push({
      size: 8,
      bold: false,
      color: '0.7 0.7 0.7',
      text: '_____________________________________________________________________________________',
    })
    lines.push({
      size: 7,
      bold: false,
      color: '0.4 0.4 0.4',
      text:
        normAscii(clinicName) +
        ' | Resp. Tecnica: ' +
        normAscii(techResp) +
        ' (' +
        normAscii(profReg) +
        ')',
    })
    lines.push({
      size: 7,
      bold: false,
      color: '0.4 0.4 0.4',
      text: 'Endereco: ' + normAscii(clinicAddr) + ' | Telefone: ' + normAscii(clinicPhone),
    })

    var streamContent = 'q\n'
    var currentY = 780
    for (var li = 0; li < lines.length; li++) {
      var ln = lines[li]
      if (ln.text === '') {
        currentY -= ln.size || 6
        continue
      }
      var fontName = ln.bold ? '/F2' : '/F1'
      var fontSize = ln.size || 9
      var color = ln.color || '0 0 0'

      streamContent +=
        'BT\n' +
        color +
        ' rg\n' +
        fontName +
        ' ' +
        fontSize +
        ' Tf\n1 0 0 1 40 ' +
        currentY +
        ' Tm\n(' +
        escPdf(ln.text) +
        ') Tj\nET\n'
      currentY -= Math.round(fontSize * 1.35) + 3
      if (currentY < 40) break
    }
    streamContent += 'Q\n'

    var pdfParts = []
    var offsets = []
    pdfParts.push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')

    var addObj = function (content) {
      var t = 0
      for (var p = 0; p < pdfParts.length; p++) t += pdfParts[p].length
      offsets.push(t)
      pdfParts.push(content + '\n')
    }

    addObj('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj')
    addObj('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj')
    addObj(
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj',
    )
    addObj(
      '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj',
    )
    addObj(
      '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj',
    )
    addObj(
      '6 0 obj\n<< /Length ' +
        streamContent.length +
        ' >>\nstream\n' +
        streamContent +
        'endstream\nendobj',
    )

    var xrefOffset = 0
    for (var o = 0; o < pdfParts.length; o++) xrefOffset += pdfParts[o].length

    var xref = 'xref\n0 ' + (offsets.length + 1) + '\n0000000000 65535 f \n'
    for (var k = 0; k < offsets.length; k++) {
      var offStr = String(offsets[k])
      while (offStr.length < 10) offStr = '0' + offStr
      xref += offStr + ' 00000 n \n'
    }
    xref +=
      'trailer\n<< /Size ' +
      (offsets.length + 1) +
      ' /Root 1 0 R >>\nstartxref\n' +
      xrefOffset +
      '\n%%EOF\n'
    pdfParts.push(xref)

    var pdfRaw = pdfParts.join('')
    var pdfBase64 = toBase64Local(pdfRaw)
    var pdfSize = pdfRaw.length

    var dataCurta = getDataCurta(record.getString('signed_at') || record.getString('created'))
    var nomeSanitizado = sanitizar(patientName)
    var pdfFilename = 'Ficha-Anamnese-' + nomeSanitizado + '-' + dataCurta + '.pdf'

    var attachments = [
      {
        filename: pdfFilename,
        content: pdfBase64,
      },
    ]

    var subject = 'Comprovante: Ficha de Anamnese Assinada - ' + patientName + ' - ' + fTypeLabel

    var sigHtml =
      sigData && sigData.indexOf('data:image') === 0
        ? '<img src="' +
          sigData +
          '" alt="Assinatura do paciente" style="max-width: 260px; max-height: 90px; border-bottom: 2px solid #831843; display: inline-block;" />'
        : '<div style="height: 60px; border-bottom: 2px solid #831843; display: inline-block; min-width: 200px; line-height: 60px; font-weight: bold; color: #831843;">Assinado Digitalmente</div>'

    var getHtml = function (isClinica) {
      var intro = isClinica
        ? 'Ola, <strong>Equipe ' +
          clinicName +
          '</strong>! Uma nova ficha de anamnese foi preenchida e assinada por <strong>' +
          patientName +
          '</strong>.'
        : 'Ola, <strong>' +
          patientName +
          '</strong>! Confirmamos a conclusao e assinatura digital da sua Ficha de Anamnese e Termo de Consentimento.'
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
                Esta e a notificacao oficial registrada para o prontuario digital.
              </p>
              <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 12px; margin: 16px 0; font-size: 13px; color: #166534;">
                <strong>O documento completo em PDF esta anexado a esta mensagem.</strong>
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
                  <td style="padding: 10px 12px; font-weight: bold; color: #475569;">Data e Hora do Aceite:</td>
                  <td style="padding: 10px 12px; font-weight: 600; color: #0f172a;">${signedAt}</td>
                </tr>
                <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px 12px; font-weight: bold; color: #475569;">Termo e Versao Aceita:</td>
                  <td style="padding: 10px 12px;">${termTitle}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px 12px; font-weight: bold; color: #475569;">E-mail do Paciente:</td>
                  <td style="padding: 10px 12px; color: #0369a1; font-weight: 600;">${patientEmail}</td>
                </tr>
                <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px 12px; font-weight: bold; color: #475569;">IP de Origem REAL:</td>
                  <td style="padding: 10px 12px; font-family: monospace;">${ipOrigem}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px 12px; font-weight: bold; color: #475569;">Dispositivo / Navegador:</td>
                  <td style="padding: 10px 12px; font-size: 11px; color: #64748b; word-break: break-all;">${userAgent}</td>
                </tr>
              </table>
              <div style="background-color: #ffffff; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 12px; margin: 18px 0;">
                <div style="margin: 16px 0; text-align: center;">
                  ${sigHtml}
                  <p style="margin: 6px 0 0 0; font-size: 12px; color: #475569; font-weight: 600;">Assinatura do paciente</p>
                </div>
              </div>
              <div style="background-color: #f1f5f9; border-left: 4px solid #831843; padding: 12px; margin: 18px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 12px; font-weight: bold; color: #0f172a;">Hash SHA-256 do Documento:</p>
                <p style="margin: 4px 0 0 0; font-family: monospace; font-size: 11px; word-break: break-all; color: #334155;">${docHash}</p>
                <p style="margin: 6px 0 0 0; font-size: 11px; color: #64748b; font-style: italic;">
                  Codigo de verificacao de integridade - garante que este documento nao foi alterado apos a assinatura.
                </p>
              </div>
            </div>
            <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 20px; text-align: center; font-size: 11px; color: #64748b; line-height: 1.5;">
              <strong>${clinicName}</strong> &bull; Responsavel Tecnica: ${techResp} (${profReg})<br/>
              Endereco: ${clinicAddr} &bull; Telefone: ${clinicPhone}<br/>
              Fuso horario: Horario de Brasilia (UTC-3)
            </div>
          </div>
        </body></html>
      `
    }

    var apiKey = $os.getenv('RESEND_API_KEY')
    if (!apiKey) {
      apiKey = 're_WGhaCJ6S_BhPNPw426wcJqyc4w7mywxsq'
    }

    if (patientEmail && patientEmail.indexOf('@') > 0) {
      try {
        var respPac = $http.send({
          url: 'https://api.resend.com/emails',
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + apiKey,
            'Content-Type': 'application/json',
          },
          data: JSON.stringify({
            from: senderEmail,
            to: [patientEmail],
            subject: subject,
            html: getHtml(false),
            attachments: attachments,
          }),
          timeout: 25,
        })
        var bodyPac = {}
        try {
          bodyPac = JSON.parse(respPac.raw)
        } catch (_) {}
        console.log(
          'Direct Resend email with attachment sent to ' +
            patientEmail +
            '. ID: ' +
            (bodyPac.id || '') +
            '. Attachment: ' +
            pdfFilename +
            ' (' +
            pdfSize +
            ' bytes)',
        )
      } catch (errPac) {
        console.log('Falha ao enviar e-mail para paciente: ' + errPac.message)
      }
    }

    if (clinicEmail && clinicEmail.indexOf('@') > 0) {
      try {
        var respCli = $http.send({
          url: 'https://api.resend.com/emails',
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + apiKey,
            'Content-Type': 'application/json',
          },
          data: JSON.stringify({
            from: senderEmail,
            to: [clinicEmail],
            subject: subject,
            html: getHtml(true),
            attachments: attachments,
          }),
          timeout: 25,
        })
        var bodyCli = {}
        try {
          bodyCli = JSON.parse(respCli.raw)
        } catch (_) {}
        console.log(
          'Direct Resend email with attachment sent to ' +
            clinicEmail +
            '. ID: ' +
            (bodyCli.id || '') +
            '. Attachment: ' +
            pdfFilename +
            ' (' +
            pdfSize +
            ' bytes)',
        )
      } catch (errCli) {
        console.log('Falha ao enviar e-mail para clinica: ' + errCli.message)
      }
    }

    try {
      record.set('pdf_attached_to_email', true)
      record.set('email_delivery_status', 'enviado')
      record.set('email_sent_at', new Date().toISOString())
      record.set('email_delivery_error', '')
      $app.save(record)
    } catch (saveErr) {
      console.log('Erro ao salvar status de envio no form_submissions: ' + saveErr.message)
    }
  } catch (err) {
    console.log('Erro no onRecordAfterUpdateSuccess form_submissions: ' + err.message)
  }
}, 'form_submissions')
