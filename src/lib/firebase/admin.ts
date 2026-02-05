import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing Firebase Admin credentials. Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY. Missing: ${name}`,
    );
  }
  return v;
}

/**
 * Lazily initializes Firebase Admin.
 *
 * IMPORTANT:
 * - Do NOT read env vars or throw at module import time.
 * - Next.js/GitHub CI may import server files during build/route analysis.
 */
export function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0]!;

  const projectId = requireEnv("FIREBASE_ADMIN_PROJECT_ID");
  const clientEmail = requireEnv("FIREBASE_ADMIN_CLIENT_EMAIL");
  const privateKey = requireEnv("FIREBASE_ADMIN_PRIVATE_KEY").replace(
    /\\n/g,
    "\n",
  );

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}
