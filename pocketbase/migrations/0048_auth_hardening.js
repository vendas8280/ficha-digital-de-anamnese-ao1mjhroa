/// <reference path="../pb_data/types.d.ts" />
// 0048 - Endurecimento da autenticação do painel:
// 1. Regras da coleção users: só o próprio administrador lê/altera o próprio registro;
//    sem criação pública (criação acontece server-side na rota de primeiro acesso).
// 2. Sessão (authToken) com validade de 7 dias, renovada pelo frontend a cada authRefresh.
// 3. Remove TODOS os usuários existentes (a credencial fixa seed está comprometida e não
//    pode permanecer). O administrador define e-mail e senha na tela de primeiro acesso.
// 4. Cria auth_access_logs (registro de acessos), login_attempts (proteção contra força
//    bruta: 5 tentativas por e-mail em 15 minutos) e password_resets (link de 1 hora).
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.listRule = 'id = @request.auth.id'
    users.viewRule = 'id = @request.auth.id'
    users.createRule = null
    users.updateRule = 'id = @request.auth.id'
    users.deleteRule = null
    users.authToken.duration = 604800 // 7 dias
    app.save(users)

    // Remove usuários existentes (credencial fixa comprometida / usuários de teste)
    const existingUsers = app.findRecordsByFilter('_pb_users_auth_', '', '', 0, 0)
    for (const u of existingUsers) {
      try {
        app.delete(u)
      } catch (err) {
        console.log('Falha ao remover usuário existente: ' + err.message)
      }
    }

    const accessLogs = new Collection({
      name: 'auth_access_logs',
      type: 'base',
      listRule: 'user = @request.auth.id',
      viewRule: 'user = @request.auth.id',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: users.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'event', type: 'text', required: true, max: 40 },
        { name: 'ip', type: 'text', required: false, max: 64 },
        { name: 'user_agent', type: 'text', required: false, max: 500 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      ],
      indexes: ['CREATE INDEX idx_auth_access_logs_user ON auth_access_logs (user, created)'],
    })
    app.save(accessLogs)

    const loginAttempts = new Collection({
      name: 'login_attempts',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'email', type: 'text', required: true, max: 200 },
        { name: 'successful', type: 'bool', required: false },
        { name: 'ip', type: 'text', required: false, max: 64 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      ],
      indexes: ['CREATE INDEX idx_login_attempts_email ON login_attempts (email, created)'],
    })
    app.save(loginAttempts)

    const passwordResets = new Collection({
      name: 'password_resets',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: users.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'token', type: 'text', required: true, max: 64 },
        { name: 'expires_at', type: 'date', required: true },
        { name: 'used', type: 'bool', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_password_resets_token ON password_resets (token)'],
    })
    app.save(passwordResets)
  },
  (app) => {
    // down: restaura regras originais e remove as coleções criadas
    try {
      const users = app.findCollectionByNameOrId('_pb_users_auth_')
      users.listRule = 'id = @request.auth.id'
      users.viewRule = 'id = @request.auth.id'
      users.createRule = ''
      users.updateRule = 'id = @request.auth.id'
      users.deleteRule = 'id = @request.auth.id'
      app.save(users)
    } catch (_) {}
    for (const name of ['auth_access_logs', 'login_attempts', 'password_resets']) {
      try {
        app.delete(app.findCollectionByNameOrId(name))
      } catch (_) {}
    }
  },
)
