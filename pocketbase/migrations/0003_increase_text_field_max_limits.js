migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('form_submissions')

    // Increase max length for fields that hold large data:
    // signature_data: base64 canvas image data URL (can easily exceed default 5000 chars)
    // accepted_term_text: full legal text of terms (can exceed 5000 chars with detailed terms)
    // patient_address: allow up to 1000 chars
    // user_agent: allow up to 1000 chars
    // email_delivery_error: allow up to 2000 chars
    const signatureField = col.fields.getByName('signature_data')
    if (signatureField) {
      signatureField.max = 500000 // 500KB characters
    }

    const termTextField = col.fields.getByName('accepted_term_text')
    if (termTextField) {
      termTextField.max = 100000 // 100KB characters
    }

    const termTitleField = col.fields.getByName('accepted_term_title')
    if (termTitleField) {
      termTitleField.max = 1000
    }

    const addressField = col.fields.getByName('patient_address')
    if (addressField) {
      addressField.max = 1000
    }

    const emergencyField = col.fields.getByName('patient_emergency_contact')
    if (emergencyField) {
      emergencyField.max = 1000
    }

    const userAgentField = col.fields.getByName('user_agent')
    if (userAgentField) {
      userAgentField.max = 1000
    }

    const emailErrField = col.fields.getByName('email_delivery_error')
    if (emailErrField) {
      emailErrField.max = 2000
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('form_submissions')

    const signatureField = col.fields.getByName('signature_data')
    if (signatureField) {
      signatureField.max = 5000
    }

    const termTextField = col.fields.getByName('accepted_term_text')
    if (termTextField) {
      termTextField.max = 5000
    }

    app.save(col)
  },
)
