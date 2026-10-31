/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. Add pdf_attached_to_email (bool) and pdf_file (file) to form_submissions
    const formsCol = app.findCollectionByNameOrId('form_submissions')
    if (formsCol) {
      if (!formsCol.fields.getByName('pdf_attached_to_email')) {
        formsCol.fields.add(
          new BoolField({
            name: 'pdf_attached_to_email',
          }),
        )
      }
      if (!formsCol.fields.getByName('pdf_file')) {
        formsCol.fields.add(
          new FileField({
            name: 'pdf_file',
            maxSelect: 1,
            maxSize: 10485760, // 10MB
            mimeTypes: ['application/pdf'],
          }),
        )
      }
      app.save(formsCol)
    }

    // 2. Clear CNPJ from clinic_settings and set real clinic defaults
    const settingsCol = app.findCollectionByNameOrId('clinic_settings')
    if (settingsCol) {
      const records = app.findAllRecords('clinic_settings')
      for (const record of records) {
        // Clear CNPJ as per instruction (no CNPJ should ever appear)
        try {
          record.set('clinic_cnpj', '')
        } catch (e) {}

        // Update sender email to own domain
        record.set(
          'sender_email',
          'Ficha Digital - Andresa Souza Clinic <ficha@andresasouza.com.br>',
        )
        app.save(record)
      }
    }
  },
  (app) => {
    const formsCol = app.findCollectionByNameOrId('form_submissions')
    if (formsCol) {
      const f1 = formsCol.fields.getByName('pdf_attached_to_email')
      if (f1) formsCol.fields.remove(f1)
      const f2 = formsCol.fields.getByName('pdf_file')
      if (f2) formsCol.fields.remove(f2)
      app.save(formsCol)
    }
  },
)
