// 0055: adiciona campo last_backup_export_at na coleção clinic_settings
migrate(
  (app) => {
    const settingsCol = app.findCollectionByNameOrId('clinic_settings')
    if (!settingsCol.fields.getByName('last_backup_export_at')) {
      settingsCol.fields.add(new DateField({ name: 'last_backup_export_at' }))
      app.save(settingsCol)
    }
  },
  (app) => {
    try {
      const settingsCol = app.findCollectionByNameOrId('clinic_settings')
      if (settingsCol.fields.getByName('last_backup_export_at')) {
        settingsCol.fields.removeByName('last_backup_export_at')
        app.save(settingsCol)
      }
    } catch (_) {}
  },
)
