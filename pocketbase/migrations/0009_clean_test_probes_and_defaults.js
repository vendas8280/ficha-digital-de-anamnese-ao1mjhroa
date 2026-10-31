/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. Clean test records created by test probes in email_verifications
    try {
      const records = app.findRecordsByFilter(
        'email_verifications',
        'email ~ "test_probe" || code ~ "PROBE" || code ~ "RES" || code ~ "ERR"',
        '',
        100,
        0,
      )
      for (const r of records) {
        try {
          app.delete(r)
        } catch (_) {}
      }
    } catch (_) {}

    // 2. Remove default/example data from clinic_settings
    // Remove CNPJ completely and clear any example values (CRBM 12345, Av. Paulista 1000, 99999-8888)
    try {
      const settingsRecords = app.findAllRecords('clinic_settings')
      for (const s of settingsRecords) {
        s.set('clinic_cnpj', '')

        const currentRegister = s.getString('professional_register')
        if (currentRegister.includes('12345') || currentRegister.includes('CRBM 12345')) {
          s.set('professional_register', '')
        }

        const currentAddr = s.getString('clinic_address')
        if (currentAddr.includes('Paulista') || currentAddr.includes('Av. Paulista')) {
          s.set('clinic_address', '')
        }

        const currentPhone = s.getString('phone')
        if (currentPhone.includes('99999-8888')) {
          s.set('phone', '')
        }

        app.save(s)
      }
    } catch (_) {}
  },
  (app) => {},
)
