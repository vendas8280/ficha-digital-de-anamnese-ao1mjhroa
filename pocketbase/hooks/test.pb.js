// pocketbase/hooks/test.pb.js
routerAdd('GET', '/backend/v1/test-require', (e) => {
  try {
    var res = require(`${__hooks}/pdf_generator.js`)
    return e.json(200, { ok: true, keys: Object.keys(res || {}) })
  } catch (err) {
    return e.json(500, { ok: false, error: String(err) })
  }
})
