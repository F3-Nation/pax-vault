import { AuthClient, type AuthClientConfig } from "f3-nation-auth-sdk";

const authConfig: AuthClientConfig = {
  client: {
    CLIENT_ID: process.env.OAUTH_CLIENT_ID || "",
    CLIENT_SECRET: process.env.OAUTH_CLIENT_SECRET || "",
    REDIRECT_URI: process.env.OAUTH_REDIRECT_URI || "",
    AUTH_SERVER_URL: process.env.AUTH_PROVIDER_URL || "",
  },
};

const authClient = new AuthClient(authConfig);

export function getOAuthConfig() {
  return authClient.getOAuthConfig();
}

export async function exchangeCodeForToken(params: { code: string }) {
  return authClient.exchangeCodeForToken(params);
}

export async function getUserInfo(
  accessToken: string,
): Promise<{ sub: string; email: string; name?: string }> {
  const authServerUrl = authConfig.client.AUTH_SERVER_URL;
  if (!authServerUrl) {
    throw new Error("AUTH_PROVIDER_URL is not configured");
  }

  const response = await fetch(`${authServerUrl}/api/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = (await response.json()) as Record<string, string>;
      detail = body.error_description || body.error || body.message || detail;
    } catch {
      // use default detail
    }
    throw new Error(`Failed to fetch user info: ${detail}`);
  }

  return response.json() as Promise<{
    sub: string;
    email: string;
    name?: string;
  }>;
}
