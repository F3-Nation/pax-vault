import { getAdminAuth } from "@/lib/firebase/admin";
import { SESSION_COOKIE_MAX_AGE } from "@/lib/auth/constants";

export async function createSessionCookie(idToken: string) {
  const adminAuth = getAdminAuth();
  return adminAuth.createSessionCookie(idToken, {
    expiresIn: SESSION_COOKIE_MAX_AGE * 1000,
  });
}

export async function verifySessionCookie(sessionCookie: string) {
  const adminAuth = getAdminAuth();
  try {
    return await adminAuth.verifySessionCookie(sessionCookie, true);
  } catch (_err) {
    console.log("Failed to verify session cookie", _err);
    return null;
  }
}
