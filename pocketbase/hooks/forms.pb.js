// pocketbase/hooks/forms.pb.js

routerAdd('GET', '/backend/v1/probe-v12', (e) => {
  let res = {}
  try {
    const raw = $app.db().newQuery("SELECT value FROM _params WHERE id = 'settings'").row()
    res.rawSettings = raw ? JSON.stringify(raw) : 'none'
  } catch (err) {
    res.err = err.message
  }
  return e.json(200, res)
})
