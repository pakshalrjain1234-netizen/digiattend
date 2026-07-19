export interface ImportRow {
  register_number: string;
  full_name: string;
  email: string;
  department: string;
  year: string;
  section: string;
  phone: string;
  password: string;
}

export interface ImportFailure {
  row: number;
  register_number: string;
  full_name: string;
  email: string;
  reason: string;
  category: "validation" | "duplicate" | "auth" | "db" | "role";
}

export interface ImportResult {
  total: number;
  imported: number;
  failed: number;
  duplicates: number;
  validation_errors: number;
  auth_errors: number;
  failures: ImportFailure[];
}

const VALID_DEPARTMENTS = ["AI & DS", "CSE", "ECE", "EEE", "MECH", "CIVIL", "IT"];
const VALID_YEARS = ["1", "2", "3", "4"];

export function validateStudentRow(raw: Record<string, unknown>): { row: ImportRow } | { error: string } {
  const register_number = String(raw.register_number || raw.Register || raw["Register Number"] || "").replace(/\.0$/, "").trim();
  const full_name = String(raw.full_name || raw.Name || raw["Full Name"] || raw.name || "").trim();
  const email = String(raw.email || raw.Email || "").trim();
  const departmentRaw = String(raw.department || raw.Department || raw.Dept || raw.dept || "").trim();
  const yearRaw = String(raw.year || raw.Year || raw["Year"] || "1").replace(/\.0$/, "").trim();
  const section = String(raw.section || raw.room || raw.Room || raw["Room Number"] || raw["Section"] || "").replace(/\.0$/, "").trim();
  const phone = String(raw.phone || raw.Phone || "").replace(/\.0$/, "").trim();
  const password = String(raw.password || raw.Password || register_number || "").trim();

  if (!register_number) return { error: "Register number is required" };
  if (!full_name) return { error: "Full name is required" };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Valid email is required" };

  const department = normalizeDepartment(departmentRaw);
  if (!department) return { error: `Invalid department: ${departmentRaw}` };

  const year = normalizeYear(yearRaw);
  if (!year) return { error: `Invalid year: ${yearRaw}` };

  if (!section) return { error: "Room/Section is required" };
  if (!password || password.length < 6) return { error: "Password must be at least 6 characters" };

  return {
    row: {
      register_number, full_name, email, department, year, section, phone, password,
    },
  };
}

function normalizeDepartment(d: string): string | null {
  const normalized = d.toLowerCase().replace(/[^a-z&]/g, "");
  const map: Record<string, string> = {
    "aids": "AI & DS", "aids": "AI & DS", "ai&ds": "AI & DS",
    "cse": "CSE", "ece": "ECE", "eee": "EEE", "mech": "MECH", "mechanical": "MECH",
    "civil": "CIVIL", "it": "IT",
  };
  return map[normalized] || (VALID_DEPARTMENTS.includes(d) ? d : null);
}

function normalizeYear(y: string): string | null {
  const n = String(y).replace(/[^1-4]/g, "");
  return VALID_YEARS.includes(n) ? n : null;
}
