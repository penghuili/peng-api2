const twofactor = require('node-2fa');
const cryptoClient = require('../clients/cryptoClient');
const tokenClient = require('../clients/tokenClient');
const userClient = require('../clients/userClient');
const errorCodes = require('../lib/errorCodes');
const parseRequest = require('../lib/parseRequest');
const response = require('../lib/response');
const verifyAccessTokenMiddleware = require('../middlewares/verifyAccessTokenMiddleware');

const userController = {
  async signup(request) {
    const {
      body: { username, salt, signingPublicKey, encryptionPublicKey },
    } = parseRequest(request);

    const existingUser = await userClient.getByUsername(username);
    if (existingUser) {
      throw response(errorCodes.USER_EXISTS, 400);
    }

    const { id, twoFactorSecret } = await userClient.create({
      username,
      salt,
      signingPublicKey,
      encryptionPublicKey,
    });

    return { id, username, twoFactorSecret };
  },

  async setup2FA(request) {
    const {
      body: { username, token },
    } = parseRequest(request);

    const user = await userClient.getByUsername(username);
    if (!user) {
      throw response(errorCodes.USER_NOT_FOUND, 404);
    }

    const {
      twoFactorSecret: { secret },
      id,
    } = user;

    const result = twofactor.verifyToken(secret, token);
    const isValidToken = !!result && result.delta === 0;
    if (!isValidToken) {
      throw response(errorCodes.INVALID_2FA_TOKEN, 400);
    }

    await userClient.finish2FASetup(id);

    return { id, username };
  },

  async signin(request) {
    const {
      body: { username, signature },
    } = parseRequest(request);

    const user = await userClient.getByUsername(username);
    if (!user) {
      throw response(errorCodes.BAD_REQUEST, 400);
    }

    const {
      id,
      signingPublicKey,
      signinChallenge,
      twoFactorSecret,
      twoFactorEnabled,
    } = user;
    const isCorrectSignature = await cryptoClient.verifySignature(
      signingPublicKey,
      signature,
      signinChallenge
    );
    if (isCorrectSignature !== true) {
      throw response(errorCodes.BAD_REQUEST, 400);
    }

    if (!twoFactorEnabled) {
      return { id, username, twoFactorSecret };
    }

    const tempToken = tokenClient.generateTempToken(id);

    return { id, tempToken };
  },

  async verifySignin2FAToken(request) {
    const {
      body: { tempToken, twoFactorToken },
    } = parseRequest(request);

    const decoded = tokenClient.verifyTempToken(tempToken);

    const userId = decoded.user;
    const user = await userClient.getByUserId(userId);
    const {
      twoFactorSecret: { secret },
    } = user;
    const result = twofactor.verifyToken(secret, twoFactorToken);
    const isValidToken = !!result && result.delta === 0;
    if (!isValidToken) {
      throw response(errorCodes.INVALID_2FA_TOKEN, 400);
    }

    const accessToken = tokenClient.generateAccessToken(userId);
    const refreshToken = tokenClient.generateRefreshToken(userId);

    await userClient.refreshSigninChallenge(userId);

    return {
      id: userId,
      accessToken,
      refreshToken,
      expiresIn: +process.env.JWT_ACCESS_TOKEN_EXPIRES_IN,
    };
  },

  async refreshTokens(request) {
    const {
      body: { refreshToken },
    } = parseRequest(request);

    const decoded = tokenClient.verifyRefreshToken(refreshToken);

    const userId = decoded.user;
    const newAccessToken = tokenClient.generateAccessToken(userId);
    const newRefreshToken = tokenClient.generateRefreshToken(userId);

    return {
      id: userId,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: +process.env.JWT_ACCESS_TOKEN_EXPIRES_IN,
    };
  },

  async getUser(request) {
    const { user: userId } = await verifyAccessTokenMiddleware(request);

    const { id, username, twoFactorSecret, createdAt, updatedAt } =
      await userClient.getByUserId(userId);

    return {
      id,
      username,
      twoFactorSecret,
      createdAt,
      updatedAt,
    };
  },

  async deleteUser(request) {
    const { user: userId } = await verifyAccessTokenMiddleware(request);

    await userClient.deleteUser(userId);

    return {
      id: userId,
    };
  },

  async getUserPublic(request) {
    const {
      pathParams: { username },
    } = parseRequest(request);
    const user = await userClient.getByUsername(username);
    if (user) {
      const { salt, signinChallenge } = user;

      return { salt, signinChallenge };
    }

    const randomSalt = await cryptoClient.generateSalt();
    const randomChallenge = tokenClient.uuid();
    return { salt: randomSalt, signinChallenge: randomChallenge };
  },
};

module.exports = userController;
