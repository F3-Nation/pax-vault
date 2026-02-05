export async function createSession(idToken: string) {
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    const message = payload?.error || "Failed to create session";
    throw new Error(message);
  }
}

export async function clearSession() {
  await fetch("/api/auth/logout", {
    method: "POST",
  });
}
