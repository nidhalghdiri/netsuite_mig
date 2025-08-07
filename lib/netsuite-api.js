export const initiateOAuth = (instanceType) => {
  const config = {
    old: {
      clientId: process.env.NEXT_PUBLIC_OLD_NS_CLIENT_ID,
      authUrl: process.env.NEXT_PUBLIC_OLD_NS_AUTH_URL,
      accountId: process.env.NEXT_PUBLIC_OLD_NS_ACCOUNT_ID,
    },
    new: {
      clientId: process.env.NEXT_PUBLIC_NEW_NS_CLIENT_ID,
      authUrl: process.env.NEXT_PUBLIC_NEW_NS_AUTH_URL,
      accountId: process.env.NEXT_PUBLIC_NEW_NS_ACCOUNT_ID,
    },
  };

  const { clientId, authUrl, accountId } = config[instanceType];
  const redirectUri = encodeURIComponent(
    `${window.location.origin}/api/auth/callback`
  );

  window.location.href = `${authUrl}?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=rest_webservices&account=${accountId}&state=${instanceType}`;
};
