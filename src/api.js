const Api = require('claudia-api-builder');
const userController = require('./controllers/userController');

require('dotenv').config();

const api = new Api();

api.post('/v1/sign-up', userController.signup);
api.post('/v1/2fa/setup', userController.setup2FA);
api.post('/v1/sign-in', userController.signin);
api.post('/v1/sign-in/2fa', userController.verifySignin2FAToken);
api.post('/v1/sign-in/refresh', userController.refreshTokens);

api.get('/v1/me', userController.getUser);
api.delete('/v1/me', userController.deleteUser);
api.get('/v1/me-public/{username}', userController.getUserPublic);

module.exports = api;
