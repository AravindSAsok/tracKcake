# Curated nutrition catalogue administration

The shared `nutrition_catalog` is deliberately empty until a maintainer reviews real source-backed facts. Do not populate it with illustrative or AI-invented nutrition values.

## Access model

- Application clients can only read rows where `is_approved = true` and `approved_at` is set.
- Browser roles have no catalogue write grant.
- Catalogue writes run from a trusted maintainer environment using the Supabase service-role key. Never put that key in `PUBLIC_*` variables, browser code, CI logs, or a committed file.
- The admin command does not fetch or invent facts. The maintainer must independently verify the source and values before approval.

## Input format

Create a private JSON file containing an array of records. Each record must include:

- `canonical_name`, optional `aliases`, `brand`, `barcode`, and `category`.
- `calories_kcal`, `protein_g`, `carbs_g`, and `fat_g`, with values exactly supported by the source.
- `basis_amount` and `basis_unit` (`g` or `ml` only). No density or household conversion is inferred.
- `source_name`, and at least one of `source_url` (HTTPS) or `source_record_id`.
- `extraction_method`, `confidence_status` (`Strong source match` or `Good source match`), and `reviewed_by`.
- Optional `serving_definitions` containing only explicit, labelled, quantified g/ml equivalents.
- Optional `optional_nutrients` with supported keys `fiber_g`, `sugar_g`, `saturated_fat_g`, and `sodium_mg`. Values may be null when the source does not state them.

Example shape (placeholders only; not importable nutrition data):

~~~json
[
  {
    "canonical_name": "REPLACE WITH VERIFIED FOOD NAME",
    "aliases": [],
    "brand": null,
    "barcode": null,
    "category": "REPLACE WITH CATEGORY",
    "calories_kcal": 0,
    "protein_g": 0,
    "carbs_g": 0,
    "fat_g": 0,
    "basis_amount": 100,
    "basis_unit": "g",
    "source_name": "REPLACE WITH SOURCE",
    "source_record_id": "REPLACE WITH SOURCE RECORD ID",
    "source_url": "https://REPLACE-WITH-VERIFIED-SOURCE",
    "extraction_method": "REPLACE WITH STRUCTURED SOURCE METHOD",
    "confidence_status": "Good source match",
    "reviewed_by": "REPLACE WITH MAINTAINER",
    "serving_definitions": [],
    "optional_nutrients": {
      "fiber_g": null,
      "sugar_g": null,
      "saturated_fat_g": null,
      "sodium_mg": null
    }
  }
]
~~~

Replace every placeholder and every numeric value with source-verified information before using the upsert command. The example is documentation only and must never be imported.

## Commands

~~~bash
npm run nutrition:catalog -- validate ./private-reviewed-foods.json
SUPABASE_URL=https://YOUR_PROJECT.supabase.co SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY npm run nutrition:catalog -- upsert ./private-reviewed-foods.json
~~~

PowerShell:

~~~powershell
$env:SUPABASE_URL = "https://YOUR_PROJECT.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "<secret from Supabase dashboard>"
npm run nutrition:catalog -- validate .\private-reviewed-foods.json
npm run nutrition:catalog -- upsert .\private-reviewed-foods.json
Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
~~~

The script validates core values, allowed units, source provenance, reviewer identity, optional nutrients, serving definitions, barcodes and duplicate identities. It checks for ambiguous existing duplicates before updating or inserting. It does not merge different source records or silently approve records from user submissions.

After import, verify the row count and approval metadata using the Supabase dashboard. Do not export or expose user-private recipe/diary rows as catalogue material.
