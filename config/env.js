const isProduction = process.env.NODE_ENV === 'production';

function getEnv(key, defaultValue = undefined) {
  const value = process.env[key];
  if (value !== undefined && String(value).trim() !== '') {
    return value;
  }
  return defaultValue;
}

function getRequiredEnv(key) {
  const value = getEnv(key);
  if (value === undefined) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

function getJwtSecret() {
  // In production we must have a real secret set
  if (isProduction) {
    return getRequiredEnv('JWT_SECRET');
  }
  // In development/testing provide a stable default if not set
  return getEnv('JWT_SECRET', 'dev_insecure_jwt_secret_change_me');
}

module.exports = {
  isProduction,
  getEnv,
  getRequiredEnv,
  getJwtSecret
};


