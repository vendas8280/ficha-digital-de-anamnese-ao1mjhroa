/// <reference path="../types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId('form_submissions')

  // Adiciona o campo form_code se ainda não existir
  const hasFormCode = collection.fields.some((f) => f.name === 'form_code')
  if (!hasFormCode) {
    collection.fields.add(
      new TextField({
        name: 'form_code',
        required: false,
      }),
    )
    app.save(collection)
  }

  // Backfill de códigos sequenciais por ano nas fichas existentes ordenadas por data de criação
  try {
    const records = app.findRecordsByFilter('form_submissions', '', 'created', 1000, 0)
    const countsByYear = {}

    for (let i = 0; i < records.length; i++) {
      const rec = records[i]
      const existing = rec.getString('form_code')
      const createdStr = rec.getString('created') || rec.getString('signed_at') || '2026-01-01'
      const year = createdStr.substring(0, 4) || '2026'

      countsByYear[year] = (countsByYear[year] || 0) + 1
      const seqStr = String(countsByYear[year]).padStart(4, '0')
      const code = `AN-${year}-${seqStr}`

      if (!existing || existing.trim() === '') {
        rec.set('form_code', code)
        app.save(rec)
      }
    }
  } catch (err) {
    console.log('Aviso no backfill de form_code:', err.message)
  }
})
