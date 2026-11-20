// Public values the Square payment form needs. No secrets here.
const { ENV, LOCATION_ID, send } = require('./_lib/square');
module.exports = (req, res) => send(res, 200, { env: ENV, applicationId: process.env.SQUARE_APPLICATION_ID || '', locationId: LOCATION_ID() || '' }, 'public, max-age=300');
