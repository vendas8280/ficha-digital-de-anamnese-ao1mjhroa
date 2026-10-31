// pocketbase/hooks/forms.pb.js

routerAdd('GET', '/backend/v1/probe-v3', (e) => {
  let paramKey = ''
  try {
    const raw = $app.findRecordById('_params', 'settings') // or something
    paramKey = raw ? 'found_settings' : 'no'
  } catch (err) {
    paramKey = 'find_err: ' + err.message
  }

  let dbResult = ''
  try {
    const rows = arrayOf(new Record())
    $app.db().select('id').from('_params').all(rows)
    dbResult = rows.map((r) => r.get('id')).join(',')
  } catch (err2) {
    dbResult = 'sql_err: ' + err2.message
  }

  let testKey = ''
  if (typeof $secrets !== 'undefined') {
    try {
      testKey = $secrets.get('RESEND_API_KEY') ? 'got_secret' : 'empty_secret'
    } catch (err3) {
      testKey = 'sec_err: ' + err3.message
    }
  }

  return e.json(200, {
    paramKey: paramKey,
    dbResult: dbResult,
    testKey: testKey,
  })
})
