const twofactor = require('node-2fa');

const dbClient = require('./dbClient');
const sortKeys = require('../lib/sortKeys');
const tokenClient = require('./tokenClient');

const userClient = {
  async create({ username, salt, signingPublicKey, encryptionPublicKey }) {
    const id = tokenClient.uuid();
    const signinChallenge = tokenClient.uuid();
    const { secret, uri } = twofactor.generateSecret({
      name: process.env.APP_NAME,
      account: username,
    });
    const twoFactorSecret = { secret, uri };
    const createdAt = Date.now();
    const user = {
      id,
      sortKey: sortKeys.user,
      username,
      salt,
      twoFactorSecret,
      twoFactorEnabled: false,
      signingPublicKey,
      encryptionPublicKey,
      signinChallenge,
      createdAt,
    };
    await dbClient.create(user);
    const usernameUser = {
      id: username,
      sortKey: sortKeys.user,
      userId: id,
    };
    await dbClient.create(usernameUser);

    return { id, username, twoFactorSecret };
  },
  async getByUserId(userId) {
    const user = await dbClient.get(userId, sortKeys.user);
    if (user) {
      const {
        id,
        username,
        salt,
        twoFactorSecret,
        twoFactorEnabled,
        signingPublicKey,
        encryptionPublicKey,
        signinChallenge,
        createdAt,
        updatedAt,
      } = user;

      return {
        id,
        username,
        salt,
        twoFactorSecret,
        twoFactorEnabled,
        signingPublicKey,
        encryptionPublicKey,
        signinChallenge,
        createdAt,
        updatedAt,
      };
    }

    return null;
  },
  async getByUsername(username) {
    const usernameUser = await dbClient.get(username, sortKeys.user);
    if (usernameUser) {
      const { userId } = usernameUser;
      const user = await userClient.getByUserId(userId);

      return user;
    }

    return null;
  },
  async finish2FASetup(userId) {
    const user = await dbClient.get(userId, sortKeys.user);
    const updatedUser = await dbClient.update(userId, sortKeys.user, {
      ...user,
      twoFactorEnabled: true,
    });
    return updatedUser;
  },

  async refreshSigninChallenge(userId) {
    const user = await dbClient.get(userId, sortKeys.user);
    const updatedUser = await dbClient.update(userId, sortKeys.user, {
      ...user,
      signinChallenge: tokenClient.uuid(),
    });
    return updatedUser;
  },

  async deleteUser(userId) {
    const user = await userClient.getByUserId(userId);
    await dbClient.delete(userId, sortKeys.user);
    await dbClient.delete(user.username, sortKeys.user);
  },
};

module.exports = userClient;
