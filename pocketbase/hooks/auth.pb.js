// pocketbase/hooks/auth.pb.js
// Autenticação real do painel (Andresa Souza Clinic).
// Rotas: status, setup (primeiro acesso), login (com bloqueio de 5 tentativas/15min),
// logout, esqueci minha senha (link de 1h via Resend) e registro de acessos.
//
// REGRA DO JSVM: NADA de declaração top-level. Todas as funções auxiliares
// devem estar declaradas DENTRO de cada callback (routerAdd).

// -------------------------------------------------------------
// GET /backend/v1/auth/status
// Indica se o painel ainda não tem administrador (fluxo de primeiro acesso).
// -------------------------------------------------------------
routerAdd('GET', '/backend/v1/auth/status', (e) => {
  var admins = $app.findRecordsByFilter('_pb_users_auth_', '', '', 1, 0)
  return e.json(200, { setup_required: !admins || admins.length === 0 })
})

// -------------------------------------------------------------
// POST /backend/v1/auth/setup
// Cria o ÚNICO usuário administrador (e-mail e senha definidos pela clínica).
// Só funciona quando não existe nenhum administrador ainda.
// -------------------------------------------------------------
routerAdd('POST', '/backend/v1/auth/setup', (e) => {
  var body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {
    body = {}
  }

  var email = String(body.email || '')
    .trim()
    .toLowerCase()
  var password = String(body.password || '')

  if (!email || email.indexOf('@') === -1 || email.indexOf('.') === -1) {
    return e.json(400, { message: 'Informe um e-mail válido.' })
  }
  if (password.length < 8) {
    return e.json(400, { message: 'A senha deve ter pelo menos 8 caracteres.' })
  }

  var existing = null
  try {
    existing = $app.findRecordsByFilter('_pb_users_auth_', '', '', 1, 0)
  } catch (_) {
    existing = null
  }
  if (existing && existing.length > 0) {
    return e.json(403, { message: 'O painel já possui um administrador configurado.' })
  }

  var usersCol = $app.findCollectionByNameOrId('_pb_users_auth_')
  var record = new Record(usersCol)
  record.setEmail(email)
  record.setPassword(password)
  record.setVerified(true)
  record.set('name', 'Andresa Souza Clinic')
  $app.save(record)

  return $apis.recordAuthResponse(e, record, 'password')
})

// -------------------------------------------------------------
// POST /backend/v1/auth/login
// Login com bloqueio: 5 tentativas erradas por e-mail em 15 minutos.
// Nunca revela se o e-mail existe ou não.
// -------------------------------------------------------------
routerAdd('POST', '/backend/v1/auth/login', (e) => {
  var body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {
    body = {}
  }

  function clientIp() {
    var ip = ''
    try {
      var xff = e.request.header.get('X-Forwarded-For')
      if (xff) {
        var parts = xff.split(',')
        if (parts.length > 0 && parts[0].trim()) ip = parts[0].trim()
      }
      if (!ip) {
        var cf = e.request.header.get('CF-Connecting-IP')
        if (cf) ip = cf.trim()
      }
      if (!ip) ip = e.realIP() || ''
    } catch (_) {
      ip = ''
    }
    return ip || '127.0.0.1'
  }

  function userAgent() {
    try {
      return e.request.header.get('User-Agent') || ''
    } catch (_) {
      return ''
    }
  }

  function saveAttempt(email, successful) {
    try {
      var col = $app.findCollectionByNameOrId('login_attempts')
      var rec = new Record(col)
      rec.set('email', email)
      rec.set('successful', successful)
      rec.set('ip', clientIp())
      $app.save(rec)
    } catch (err) {
      console.log('Falha ao gravar login_attempts: ' + err.message)
    }
  }

  function saveAccessLog(userId, event) {
    try {
      var col = $app.findCollectionByNameOrId('auth_access_logs')
      var rec = new Record(col)
      rec.set('user', userId)
      rec.set('event', event)
      rec.set('ip', clientIp())
      rec.set('user_agent', userAgent())
      $app.save(rec)
    } catch (err) {
      console.log('Falha ao gravar auth_access_logs: ' + err.message)
    }
  }

  var email = String(body.email || '')
    .trim()
    .toLowerCase()
  var password = String(body.password || '')

  if (!email || !password) {
    return e.json(400, { message: 'E-mail ou senha incorretos.' })
  }

  // Conta as tentativas erradas deste e-mail nos últimos 15 minutos
  var since = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  var recentFailures = 0
  try {
    var attempts = $app.findRecordsByFilter(
      'login_attempts',
      'email = {:email} && successful = false && created > {:since}',
      '-created',
      0,
      0,
      { email: email, since: since },
    )
    recentFailures = attempts ? attempts.length : 0
  } catch (_) {
    recentFailures = 0
  }

  if (recentFailures >= 5) {
    return e.json(429, { message: 'Muitas tentativas. Tente novamente em alguns minutos.' })
  }

  var record = null
  try {
    record = $app.findAuthRecordByEmail('_pb_users_auth_', email)
  } catch (_) {
    record = null
  }

  if (!record || !record.validatePassword(password)) {
    saveAttempt(email, false)
    // Mensagem genérica: nunca revela se o e-mail está cadastrado
    return e.json(401, { message: 'E-mail ou senha incorretos.' })
  }

  saveAttempt(email, true)
  saveAccessLog(record.id, 'login')
  return $apis.recordAuthResponse(e, record, 'password')
})

// -------------------------------------------------------------
// POST /backend/v1/auth/logout
// Registra o logout (a invalidação do token no cliente é feita pelo frontend;
// o token expira sozinho em até 7 dias).
// -------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/auth/logout',
  (e) => {
    var auth = e.auth
    if (!auth) {
      return e.json(401, { message: 'Sessão não encontrada.' })
    }
    try {
      var col = $app.findCollectionByNameOrId('auth_access_logs')
      var rec = new Record(col)
      rec.set('user', auth.id)
      rec.set('event', 'logout')
      var ip = ''
      try {
        var xff = e.request.header.get('X-Forwarded-For')
        if (xff) {
          var parts = xff.split(',')
          if (parts.length > 0 && parts[0].trim()) ip = parts[0].trim()
        }
        if (!ip) ip = e.realIP() || ''
      } catch (_) {}
      rec.set('ip', ip || '127.0.0.1')
      rec.set('user_agent', e.request.header.get('User-Agent') || '')
      $app.save(rec)
    } catch (err) {
      console.log('Falha ao gravar logout: ' + err.message)
    }
    return e.json(200, { success: true })
  },
  $apis.requireAuth(),
)

// -------------------------------------------------------------
// POST /backend/v1/auth/forgot-password
// Envia link de redefinição (validade de 1 hora) via Resend.
// A resposta é SEMPRE positiva para não revelar e-mails cadastrados.
// -------------------------------------------------------------
routerAdd('POST', '/backend/v1/auth/forgot-password', (e) => {
  var body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {
    body = {}
  }

  var email = String(body.email || '')
    .trim()
    .toLowerCase()
  var resetUrlBase = String(body.reset_url_base || '')

  function respond() {
    return e.json(200, {
      success: true,
      message:
        'Se este e-mail estiver cadastrado, você receberá um link de redefinição em instantes.',
    })
  }

  if (!email || email.indexOf('@') === -1 || !resetUrlBase || resetUrlBase.indexOf('http') !== 0) {
    return respond()
  }

  var record = null
  try {
    record = $app.findAuthRecordByEmail('_pb_users_auth_', email)
  } catch (_) {
    record = null
  }
  if (!record) {
    return respond()
  }

  var token = $security.randomString(40)
  var expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

  try {
    var col = $app.findCollectionByNameOrId('password_resets')
    var rec = new Record(col)
    rec.set('user', record.id)
    rec.set('token', token)
    rec.set('expires_at', expiresAt)
    rec.set('used', false)
    $app.save(rec)
  } catch (err) {
    console.log('Falha ao gravar password_resets: ' + err.message)
    return respond()
  }

  var resetLink = resetUrlBase + '?token=' + token

  // Remetente: mesma config dos lembretes/comprovantes
  var clinicName = 'Andresa Souza Clinic'
  var senderEmail = 'Ficha Digital - Andresa Souza Clinic <ficha@andresasouza.com.br>'
  try {
    var recs = $app.findRecordsByFilter('clinic_settings', '', '-created', 1, 0)
    if (recs && recs.length > 0) {
      var s = recs[0]
      if (s.getString('clinic_name')) clinicName = s.getString('clinic_name')
      if (s.getString('reminder_sender_email')) {
        senderEmail = s.getString('reminder_sender_email')
      } else if (s.getString('sender_email')) {
        senderEmail = s.getString('sender_email')
      }
    }
  } catch (_) {}

  var subject = 'Redefinicao de senha - ' + clinicName
  var html =
    '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Redefinicao de senha</title></head>' +
    '<body style="font-family: Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b;">' +
    '<div style="max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">' +
    '<div style="background-color: #6B3FA0; color: #ffffff; padding: 24px; text-align: center;">' +
    '<h1 style="margin: 0; font-size: 20px; font-weight: bold;">' +
    clinicName +
    '</h1>' +
    '<p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.95;">Redefinicao de senha do painel</p></div>' +
    '<div style="padding: 24px; text-align: center;">' +
    '<p style="font-size: 14px; line-height: 1.5; color: #475569; margin-top: 0;">Recebemos uma solicitacao para redefinir a senha do painel. Use o botao abaixo. O link expira em <strong>1 hora</strong>.</p>' +
    '<p style="margin: 24px 0;"><a href="' +
    resetLink +
    '" style="background-color: #6B3FA0; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 15px; font-weight: bold; display: inline-block;">Redefinir minha senha</a></p>' +
    '<p style="font-size: 12px; color: #64748b; margin-bottom: 0;">Se voce nao solicitou esta redefinicao, ignore esta mensagem e sua senha atual permanecera a mesma.</p>' +
    '</div>' +
    '<div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 14px; text-align: center; font-size: 11px; color: #94a3b8;">' +
    clinicName +
    ' &bull; Ficha Digital Segura</div></div></body></html>'

  var resendApiKey = $os.getenv('RESEND_API_KEY')
  if (resendApiKey) {
    try {
      var res = $http.send({
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
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log('Link de redefinicao de senha enviado para ' + email + '.')
      } else {
        console.log('Falha ao enviar redefinicao (' + res.statusCode + '): ' + res.raw)
      }
    } catch (err) {
      console.log('Falha ao chamar Resend para redefinicao: ' + err.message)
    }
  } else {
    console.log('Aviso: RESEND_API_KEY ausente no cofre; link de redefinicao nao enviado.')
  }

  return respond()
})

// -------------------------------------------------------------
// POST /backend/v1/auth/reset-password
// Define a nova senha a partir do token do e-mail (validade de 1 hora).
// -------------------------------------------------------------
routerAdd('POST', '/backend/v1/auth/reset-password', (e) => {
  var body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {
    body = {}
  }

  var token = String(body.token || '')
  var password = String(body.password || '')

  if (!token || password.length < 8) {
    return e.json(400, { message: 'Link invalido ou expirado. Solicite um novo.' })
  }

  var resets = null
  try {
    resets = $app.findRecordsByFilter('password_resets', 'token = {:token}', '-created', 1, 0, {
      token: token,
    })
  } catch (_) {
    resets = null
  }
  if (!resets || resets.length === 0) {
    return e.json(400, { message: 'Link invalido ou expirado. Solicite um novo.' })
  }

  var reset = resets[0]
  if (reset.getBool('used')) {
    return e.json(400, { message: 'Link invalido ou expirado. Solicite um novo.' })
  }
  var expiresAt = reset.getDateTime('expires_at')
  if (!expiresAt || expiresAt.isZero() || new Date(expiresAt.string()) < new Date()) {
    return e.json(400, { message: 'Link invalido ou expirado. Solicite um novo.' })
  }

  var userId = reset.getString('user')
  var record = null
  try {
    record = $app.findRecordById('_pb_users_auth_', userId)
  } catch (_) {
    record = null
  }
  if (!record) {
    return e.json(400, { message: 'Link invalido ou expirado. Solicite um novo.' })
  }

  record.setPassword(password)
  $app.save(record)

  reset.set('used', true)
  $app.save(reset)

  try {
    var col = $app.findCollectionByNameOrId('auth_access_logs')
    var rec = new Record(col)
    rec.set('user', record.id)
    rec.set('event', 'senha_redefinida')
    rec.set('ip', e.realIP() || '')
    rec.set('user_agent', e.request.header.get('User-Agent') || '')
    $app.save(rec)
  } catch (_) {}

  return e.json(200, { success: true })
})

// -------------------------------------------------------------
// GET /backend/v1/auth/access-logs
// Últimos acessos do próprio administrador (exibidos em Configurações).
// -------------------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/auth/access-logs',
  (e) => {
    var auth = e.auth
    if (!auth) {
      return e.json(401, { message: 'Sessão não encontrada.' })
    }

    var logs = []
    try {
      var records = $app.findRecordsByFilter(
        'auth_access_logs',
        'user = {:user}',
        '-created',
        20,
        0,
        { user: auth.id },
      )
      for (var i = 0; i < records.length; i++) {
        logs.push({
          event: records[i].getString('event'),
          ip: records[i].getString('ip'),
          user_agent: records[i].getString('user_agent'),
          created: records[i].getDateTime('created').string(),
        })
      }
    } catch (err) {
      console.log('Falha ao listar acessos: ' + err.message)
    }

    return e.json(200, { logs: logs })
  },
  $apis.requireAuth(),
)
