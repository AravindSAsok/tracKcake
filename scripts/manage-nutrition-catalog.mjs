import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";

const [, , action, file] = process.argv;
const url = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const fail = (message) => { console.error(message); process.exitCode = 1; };

function normalize(value) {
  return String(value ?? "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
function validate(row, index) {
  const label = "Record " + (index + 1);
  if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error(label + " must be an object.");
  const requiredText = ["canonical_name", "source_name", "extraction_method", "confidence_status"];
  for (const field of requiredText) if (typeof row[field] !== "string" || !row[field].trim()) throw new Error(label + ": " + field + " is required.");
  if (row.canonical_name.length > 160 || row.source_name.length > 120) throw new Error(label + ": name/source is too long.");
  if (!["Strong source match", "Good source match"].includes(row.confidence_status)) throw new Error(label + ": confidence_status must be Strong source match or Good source match.");
  if (!["g", "ml"].includes(row.basis_unit) || typeof row.basis_amount !== "number" || !Number.isFinite(row.basis_amount) || row.basis_amount <= 0) throw new Error(label + ": basis must be a positive g or ml amount.");
  for (const field of ["calories_kcal", "protein_g", "carbs_g", "fat_g"]) {
    if (typeof row[field] !== "number" || !Number.isFinite(row[field]) || row[field] < 0) throw new Error(label + ": " + field + " must be a non-negative numeric source value.");
  }
  if (row.source_url && !/^https:\/\//i.test(row.source_url)) throw new Error(label + ": source_url must use HTTPS.");
  if (!row.source_url && !row.source_record_id) throw new Error(label + ": provide a source_url or source_record_id for provenance.");
  if (row.source_record_id && String(row.source_record_id).length > 180) throw new Error(label + ": source_record_id is too long.");
  if (typeof row.reviewed_by !== "string" || !row.reviewed_by.trim() || row.reviewed_by.length > 120) throw new Error(label + ": reviewed_by is required for an approved record.");
  if (row.barcode && !/^\d{8,14}$/.test(String(row.barcode))) throw new Error(label + ": barcode must contain 8–14 digits.");
  if (row.category !== undefined && (typeof row.category !== "string" || row.category.length > 80)) throw new Error(label + ": category must be text up to 80 characters.");
  const servings = row.serving_definitions ?? [];
  if (!Array.isArray(servings) || servings.length > 30 || servings.some((item) =>
    !item || typeof item.label !== "string" || !item.label.trim() ||
    typeof item.amount !== "number" || !Number.isFinite(item.amount) || item.amount <= 0 || !["g", "ml"].includes(item.unit))) {
    throw new Error(label + ": serving_definitions must contain labelled, quantified g/ml equivalents only.");
  }
  const optional = row.optional_nutrients ?? {};
  if (!optional || typeof optional !== "object" || Array.isArray(optional) ||
      Object.entries(optional).some(([key, value]) => !["fiber_g","sugar_g","saturated_fat_g","sodium_mg"].includes(key) ||
        (value !== null && (typeof value !== "number" || !Number.isFinite(value) || value < 0)))) {
    throw new Error(label + ": optional_nutrients contains an unsupported or invalid nutrient.");
  }
  const aliases = Array.isArray(row.aliases) ? row.aliases : [];
  if (aliases.some((alias) => typeof alias !== "string" || !alias.trim() || alias.length > 160)) throw new Error(label + ": aliases must be non-empty strings up to 160 characters.");
  return {
    ...row,
    normalized_name: normalize(row.canonical_name),
    aliases: [...new Set(aliases.map((alias) => alias.trim()))],
    is_approved: true,
    approved_at: new Date().toISOString(),
    provenance: {
      ...(row.provenance && typeof row.provenance === "object" ? row.provenance : {}),
      reviewed_at: new Date().toISOString(),
      review_method: "catalog-admin-script"
    }
  };
}

if (!["validate", "upsert"].includes(action) || !file) {
  console.log("Usage: node scripts/manage-nutrition-catalog.mjs <validate|upsert> <records.json>");
  process.exit(2);
}
try {
  const input = JSON.parse(await readFile(file, "utf8"));
  if (!Array.isArray(input) || input.length < 1 || input.length > 500) throw new Error("Input must be a JSON array containing 1–500 reviewed records.");
  const records = input.map(validate);
  const seen = new Set();
  for (const record of records) {
    const identity = [record.normalized_name, record.brand || "", record.barcode || "", record.source_name, record.source_record_id || ""].join("|");
    if (seen.has(identity)) throw new Error("Duplicate catalogue identity in input: " + record.canonical_name);
    seen.add(identity);
  }
  if (action === "validate") {
    console.log("Validated " + records.length + " catalogue records. No database writes performed.");
  } else {
    if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the trusted admin environment.");
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    let written = 0;
    for (const record of records) {
      let query = supabase.from("nutrition_catalog").select("id").eq("source_name", record.source_name);
      if (record.source_record_id) {
        query = query.eq("source_record_id", record.source_record_id);
      } else {
        query = query.eq("normalized_name", record.normalized_name);
        query = record.brand ? query.eq("brand", record.brand) : query.is("brand", null);
        query = record.barcode ? query.eq("barcode", record.barcode) : query.is("barcode", null);
      }
      const { data: existing, error: lookupError } = await query.limit(2);
      if (lookupError) throw lookupError;
      if ((existing || []).length > 1) throw new Error("Existing duplicate rows found for " + record.canonical_name + "; resolve them before upsert.");
      const result = existing?.length
        ? await supabase.from("nutrition_catalog").update(record).eq("id", existing[0].id)
        : await supabase.from("nutrition_catalog").insert(record);
      if (result.error) throw result.error;
      written += 1;
    }
    console.log("Upserted " + written + " reviewed catalogue records.");
  }
} catch (error) {
  fail(error instanceof Error ? error.message : "Catalogue operation failed.");
}
