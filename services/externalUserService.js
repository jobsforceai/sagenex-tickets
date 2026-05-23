const DEFAULT_ENDPOINT = 'https://sagenex-backend.onrender.com/api/v1/external/user';

export async function validateExternalUser(userId) {
  if (!userId) {
    const error = new Error('SGX member user ID is required.');
    error.statusCode = 400;
    throw error;
  }

  const baseUrl = process.env.EXTERNAL_USER_API_BASE_URL || DEFAULT_ENDPOINT;
  const token = process.env.EXTERNAL_USER_API_TOKEN;
  if (!token) {
    const error = new Error('External user API token is not configured.');
    error.statusCode = 500;
    throw error;
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/${encodeURIComponent(userId)}`, {
    headers: { 'x-api-token': token }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success || !payload.data) {
    const error = new Error('Unable to validate SGX member. Please verify the user ID.');
    error.statusCode = 400;
    throw error;
  }
  if (payload.data.status !== 'active') {
    const error = new Error('SGX member is not active.');
    error.statusCode = 400;
    throw error;
  }
  return payload.data;
}
