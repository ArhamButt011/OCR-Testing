export const getErrorToastText = (
  err: any,
  fallback = 'Something went wrong'
) => {
  if (!err) return fallback;

  if (err.error) {
    const detail = err.details?.[0];
    return detail ? `${err.error}: ${detail}` : err.error;
  }

  if (err.response?.data) {
    const data = err.response.data;
    const message = data.error || data.message;
    const detail = data.details?.[0];
    if (message) {
      return detail ? `${message}: ${detail}` : message;
    }
  }
  if (err.message) return err.message;

  return fallback;
};
