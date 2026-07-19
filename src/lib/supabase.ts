import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error("[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "digiattend.auth",
  },
});

export const FUNCTIONS_URL = `${url}/functions/v1`;

export class EdgeFunctionError extends Error {
  code?: string;
  status: number;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "EdgeFunctionError";
    this.status = status;
    this.code = code;
  }
}

export async function callEdgeFunction(name: string, body: unknown) {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) {
    throw new EdgeFunctionError("Your session has expired. Please sign in again.", 401, "NO_SESSION");
  }
  let res: Response;
  try {
    res = await fetch(`${FUNCTIONS_URL}/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
      },
      body: JSON.stringify(body),
    });
  } catch (networkErr: any) {
    console.error(`[edge:${name}] network error`, networkErr);
    throw new EdgeFunctionError("Unable to reach the server. Check your internet connection and try again.", 0, "NETWORK");
  }
  let data: any;
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) {
    console.error(`[edge:${name}] ${res.status}`, data);
    throw new EdgeFunctionError(data.error || `Request failed (${res.status})`, res.status, data.code);
  }
  return data;
}

export async function callPublicFunction(name: string, body: unknown) {
  let res: Response;
  try {
    res = await fetch(`${FUNCTIONS_URL}/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
      },
      body: JSON.stringify(body),
    });
  } catch (networkErr: any) {
    console.error(`[edge:${name}] network error`, networkErr);
    throw new EdgeFunctionError("Unable to reach the server. Check your internet connection and try again.", 0, "NETWORK");
  }
  let data: any;
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) {
    console.error(`[edge:${name}] ${res.status}`, data);
    throw new EdgeFunctionError(data.error || `Request failed (${res.status})`, res.status, data.code);
  }
  return data;
}
