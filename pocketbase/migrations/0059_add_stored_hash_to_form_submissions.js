migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('form_submissions')

    if (!col.fields.getByName('stored_hash')) {
      col.fields.add(
        new TextField({
          name: 'stored_hash',
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('pdf_file')) {
      col.fields.add(
        new FileField({
          name: 'pdf_file',
          maxSelect: 1,
          maxSize: 52428800, // 50MB
          mimeTypes: ['application/pdf'],
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('form_submissions')
    if (col.fields.getByName('stored_hash')) {
      col.fields.removeByName('stored_hash')
    }
    app.save(col)
  },
)
