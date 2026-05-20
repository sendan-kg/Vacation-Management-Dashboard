/**
 * MSAL.js 設定（M365 SSO）。
 *
 * 環境変数:
 *   NEXT_PUBLIC_AAD_CLIENT_ID  - Azure AD アプリ (sendan-minutes-bot) の client ID
 *   NEXT_PUBLIC_AAD_TENANT_ID  - tenant ID
 *
 * Azure AD アプリ登録には SPA プラットフォームの redirect URI が必要:
 *   - 開発: http://localhost:3000
 *   - 本番: https://<vercel-domain>/
 */
import type { Configuration, RedirectRequest } from "@azure/msal-browser";

const tenantId = process.env.NEXT_PUBLIC_AAD_TENANT_ID ?? "";
const clientId = process.env.NEXT_PUBLIC_AAD_CLIENT_ID ?? "";

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri:
      typeof window !== "undefined" ? window.location.origin : "/",
    postLogoutRedirectUri:
      typeof window !== "undefined" ? window.location.origin : "/",
  },
  cache: {
    cacheLocation: "sessionStorage",
  },
};

export const loginRequest: RedirectRequest = {
  scopes: ["User.Read", "Sites.ReadWrite.All"],
};

export const graphTokenRequest = {
  scopes: ["Sites.ReadWrite.All"],
};
