const { createSocialUser, handleExistingUser } = require('./process');
const { findUser, updateUser } = require('~/models');
const { logger } = require('~/config');

// Inline helper to check if env var is enabled (avoids import path issues)
const isEnabled = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase().trim() === 'true';
  return false;
};

const socialLogin =
  (provider, getProfileDetails) => async (accessToken, refreshToken, idToken, profile, cb) => {
    try {
      const { email, id, avatarUrl, username, name, emailVerified } = getProfileDetails({
        idToken, profile,
      });

      const providerKey = `${provider}Id`;
      const oldUser = await findUser({ email: email.trim() });
      const ALLOW_SOCIAL_REGISTRATION = isEnabled(process.env.ALLOW_SOCIAL_REGISTRATION);

      if (oldUser) {
        // Link social provider to existing account if not already linked
        if (!oldUser[providerKey]) {
          logger.info(`[${provider}Login] Linking ${provider} account to existing user: ${email}`);
          await updateUser(oldUser._id, { [providerKey]: id });
          oldUser[providerKey] = id;
        }
        await handleExistingUser(oldUser, avatarUrl);
        return cb(null, oldUser);
      }

      if (ALLOW_SOCIAL_REGISTRATION) {
        const newUser = await createSocialUser({
          email,
          avatarUrl,
          provider,
          providerKey,
          providerId: id,
          username,
          name,
          emailVerified,
        });
        return cb(null, newUser);
      }
    } catch (err) {
      logger.error(`[${provider}Login]`, err);
      return cb(err);
    }
  };

module.exports = socialLogin;
