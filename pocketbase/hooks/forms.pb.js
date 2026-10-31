// pocketbase/hooks/forms.pb.js

routerAdd('GET', '/backend/v1/test-resend-raw11', (e) => {
  let res = {}
  try {
    const raw = new DynamicModel({ id: '', value: '' })
    $app.db().newQuery("SELECT id, value FROM _params WHERE id = 'settings'").one(raw)
    const settings = JSON.parse(raw.value)
    res.smtp = settings.smtp
  } catch (err) {
    res.err = err.message
  }
  return e.json(200, res)
})
