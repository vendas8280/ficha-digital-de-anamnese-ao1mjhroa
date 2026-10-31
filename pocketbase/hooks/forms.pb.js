// pocketbase/hooks/forms.pb.js
// Hook de teste
routerAdd('GET', '/backend/v1/client-ip', (e) => {
  return e.json(200, { ok: true })
})
