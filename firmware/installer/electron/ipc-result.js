function ok(data = {}) {
  return { success: true, ...data };
}

function err(message, detail) {
  const result = { success: false, error: message };
  if (detail !== undefined) result.detail = String(detail);
  return result;
}

module.exports = { ok, err };
