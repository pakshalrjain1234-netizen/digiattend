export interface DeviceInfo {
  userAgent: string;
  platform: string;
  language: string;
  screen: string;
  timezone: string;
}

export interface BrowserInfo {
  name: string;
  version: string;
  os: string;
}

export function getDeviceInfo(): DeviceInfo {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

export function getBrowserInfo(): BrowserInfo {
  const ua = navigator.userAgent;
  let name = "Unknown";
  let version = "";
  if (ua.includes("Edg/")) { name = "Edge"; version = ua.match(/Edg\/([\d.]+)/)?.[1] || ""; }
  else if (ua.includes("Chrome/")) { name = "Chrome"; version = ua.match(/Chrome\/([\d.]+)/)?.[1] || ""; }
  else if (ua.includes("Firefox/")) { name = "Firefox"; version = ua.match(/Firefox\/([\d.]+)/)?.[1] || ""; }
  else if (ua.includes("Safari/")) { name = "Safari"; version = ua.match(/Version\/([\d.]+)/)?.[1] || ""; }

  let os = "Unknown";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Linux")) os = "Linux";

  return { name, version, os };
}

export async function getDeviceFingerprint(): Promise<string> {
  const components = [
    navigator.userAgent,
    navigator.platform,
    navigator.language,
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    String(navigator.hardwareConcurrency || 0),
    String((navigator as any).deviceMemory || 0),
    new Date().getTimezoneOffset(),
  ];
  const joined = components.join("|");
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(joined));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}
