const sodium = require('libsodium-wrappers');

const cryptoClient = {
  async verifySignature(signingPublicKey, signature, originalMessage) {
    await sodium.ready;

    try {
      const opened = sodium.to_string(
        sodium.crypto_sign_open(
          sodium.from_hex(signature),
          sodium.from_hex(signingPublicKey)
        )
      );

      return opened === originalMessage;
    } catch (err) {
      return false;
    }
  },
  async generateSalt() {
    await sodium.ready;

    const salt = sodium.to_hex(
      sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES)
    );

    return salt;
  },
};

module.exports = cryptoClient;
