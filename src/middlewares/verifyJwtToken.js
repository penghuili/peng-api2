const tokenClient = require('../clients/tokenClient');

const errorCodes = require('../lib/errorCodes');
const parseRequest = require('../lib/parseRequest');
const response = require('../lib/response');

async function verifyJwtToken(request) {
  const { headers } = parseRequest(request);

  const { authorization, Authorization } = headers || {};

  const authorizationHeader = Authorization || authorization;
  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    throw response(errorCodes.UNAUTHORIZED, 401);
  }

  const token = authorizationHeader.split(' ')[1];

  const decoded = tokenClient.verifyAccessToken(token);
  return decoded;
}

module.exports = verifyJwtToken;
