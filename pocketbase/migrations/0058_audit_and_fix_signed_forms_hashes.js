/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    var signedForms = []
    try {
      signedForms = app.findRecordsByFilter(
        'form_submissions',
        "status = 'preenchida'",
        'created',
        500,
        0,
      )
    } catch (e) {
      console.log('Aviso ao consultar form_submissions assinadas: ' + e.message)
      return
    }

    var nowIso = new Date().toISOString()
    var auditCol = null
    try {
      auditCol = app.findCollectionByNameOrId('audit_events')
    } catch (_) {
      return
    }

    for (var i = 0; i < signedForms.length; i++) {
      var form = signedForms[i]
      var pdfFile = form.getString('pdf_file')
      var fileExistsInStorage = false
      var recalculatedHash = ''

      if (pdfFile) {
        var fsys = null
        var reader = null
        try {
          fsys = app.newFilesystem()
          var key = form.baseFilesPath() + '/' + pdfFile
          reader = fsys.getReader(key)
          var bytes = toString(reader)
          if (bytes && bytes.length > 0) {
            fileExistsInStorage = true
            try {
              recalculatedHash = $security.sha256(bytes)
            } catch (_) {}
          }
        } catch (err) {
          fileExistsInStorage = false
        } finally {
          if (reader && typeof reader.close === 'function') reader.close()
          if (fsys && typeof fsys.close === 'function') fsys.close()
        }
      }

      if (fileExistsInStorage && recalculatedHash) {
        var oldHash = form.getString('document_hash')
        if (oldHash !== recalculatedHash) {
          form.set('document_hash', recalculatedHash)
          app.save(form)

          var eventCorr = new Record(auditCol)
          eventCorr.set('form_submission', form.id)
          eventCorr.set('event_type', 'correcao_hash_pdf_original')
          eventCorr.set(
            'description',
            'Hash do PDF recalculado sobre o arquivo gravado original no storage em ' +
              nowIso +
              '. Hash anterior: ' +
              oldHash +
              ' -> Novo hash verificado: ' +
              recalculatedHash,
          )
          eventCorr.set('step_number', 6)
          eventCorr.set('timestamp', nowIso)
          eventCorr.set('metadata', {
            data_correcao: nowIso,
            hash_anterior: oldHash,
            hash_corrigido: recalculatedHash,
            arquivo_storage: pdfFile,
          })
          app.save(eventCorr)
        }
      } else {
        // PDF original não existe no storage.
        var existingEvents = []
        try {
          existingEvents = app.findRecordsByFilter(
            'audit_events',
            "form_submission = {:fid} && event_type = 'pdf_original_nao_recuperado'",
            '',
            1,
            0,
            { fid: form.id },
          )
        } catch (_) {}

        if (!existingEvents || existingEvents.length === 0) {
          var eventNaoRec = new Record(auditCol)
          eventNaoRec.set('form_submission', form.id)
          eventNaoRec.set('event_type', 'pdf_original_nao_recuperado')
          eventNaoRec.set(
            'description',
            'Arquivo PDF original da assinatura não pôde ser recuperado no storage para recalcular hash. Ficha assinada anteriormente sem retenção do arquivo binário gravado.',
          )
          eventNaoRec.set('step_number', 6)
          eventNaoRec.set('timestamp', nowIso)
          eventNaoRec.set('metadata', {
            data_verificacao: nowIso,
            document_hash_registrado: form.getString('document_hash') || '',
            motivo: 'Ficha anterior à versão de congelamento do PDF no storage',
          })
          app.save(eventNaoRec)
        }
      }
    }
  },
  (app) => {
    // down migration
  },
)
