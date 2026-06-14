interface FetchOptions extends RequestInit {
  body?: any;
}

export async function fetchWithAuth(url: string, options: FetchOptions = {}) {
  const headers = new Headers(options.headers || {});

  if (options.body && typeof options.body === "object") {
    options.body = JSON.stringify(options.body);
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const json = JSON.parse(text) as { error?: string };
      if (json.error) message = json.error;
    } catch {
      /* response was not JSON */
    }
    throw new Error(
      message.length > 300 ? `${message.slice(0, 300)}…` : message
    );
  }
  return res.json();
}

export async function fetchPages() {
  return fetchWithAuth("/api/pages");
}

export async function createPageApi(
  title: string = "Untitled",
  parentId?: string | null
) {
  return fetchWithAuth("/api/pages", {
    method: "POST",
    body: { title, parentId: parentId ?? null },
  });
}

export async function updatePageApi(
  id: string,
  updates: { title?: string; content?: string; parentId?: string | null }
) {
  return fetchWithAuth(`/api/pages/${id}`, {
    method: "PUT",
    body: updates,
  });
}

export async function fetchChatMessages() {
  return fetchWithAuth("/api/chat/messages") as Promise<{
    messages: Array<{
      id: string;
      role: "user" | "assistant";
      content: string;
      createdAt: string;
    }>;
  }>;
}

export async function loginApi(email: string, password: string) {
  return fetchWithAuth("/api/auth/login", {
    method: "POST",
    body: { email, password },
  }) as Promise<{ user: { uid: string; email: string | null; displayName: string | null } }>;
}

export async function signupApi(
  email: string,
  password: string,
  name: string
) {
  return fetchWithAuth("/api/auth/signup", {
    method: "POST",
    body: { email, password, name },
  }) as Promise<{ user: { uid: string; email: string | null; displayName: string | null } }>;
}

export async function logoutApi() {
  return fetchWithAuth("/api/auth/logout", { method: "POST" });
}
