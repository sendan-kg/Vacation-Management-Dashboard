"use client";

/**
 * MSAL の React プロバイダ。
 * shift-submission-flow/web-app から流用。
 */
import { PublicClientApplication, EventType } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { useEffect, useState } from "react";
import { msalConfig } from "@/lib/msal-config";

let pcaInstance: PublicClientApplication | null = null;

function getPca(): PublicClientApplication {
  if (!pcaInstance) {
    pcaInstance = new PublicClientApplication(msalConfig);
  }
  return pcaInstance;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const pca = getPca();
    pca
      .initialize()
      .then(() => pca.handleRedirectPromise())
      .then((response) => {
        if (response?.account) {
          pca.setActiveAccount(response.account);
        } else {
          const accounts = pca.getAllAccounts();
          if (accounts.length > 0) pca.setActiveAccount(accounts[0]);
        }
        setReady(true);
      })
      .catch((err) => {
        console.error("MSAL init error", err);
        try {
          sessionStorage.clear();
        } catch {}
        setReady(true);
      });

    const callbackId = pca.addEventCallback((event) => {
      if (
        event.eventType === EventType.LOGIN_SUCCESS &&
        event.payload &&
        "account" in event.payload &&
        event.payload.account
      ) {
        pca.setActiveAccount(event.payload.account);
      }
    });

    return () => {
      if (callbackId) pca.removeEventCallback(callbackId);
    };
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-500">
        読み込み中…
      </div>
    );
  }

  return <MsalProvider instance={getPca()}>{children}</MsalProvider>;
}
