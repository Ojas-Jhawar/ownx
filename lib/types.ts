// Minimal hand-written types matching supabase/schema.sql.
// (If you later run `supabase gen types typescript`, you can replace this
// with the generated file — the shape below matches it closely on purpose.)

export type AssetStatus = "draft" | "active" | "archived"
export type ExtractionSource = "ai" | "manual" | null

export interface Asset {
  id: string
  owner_id: string
  status: AssetStatus
  product_name: string | null
  brand: string | null
  category: string | null
  image_url: string | null
  serial_number: string | null
  purchase_date: string | null
  purchase_price: number | null
  currency: string
  warranty_months: number | null
  condition_score: number | null
  condition_notes: string | null
  extraction_source: ExtractionSource
  extraction_raw: Record<string, unknown> | null
  extraction_confidence: Record<string, unknown> | null
  invoice_document_id: string | null
  created_at: string
  updated_at: string
}

export interface DocumentRow {
  id: string
  asset_id: string | null
  owner_id: string
  kind: "invoice" | "warranty" | "service_bill" | "other"
  storage_path: string
  file_name: string | null
  mime_type: string | null
  created_at: string
}

export interface ServiceRecord {
  id: string
  asset_id: string
  owner_id: string
  title: string
  notes: string | null
  cost: number | null
  performed_by: string | null
  receipt_document_id: string | null
  serviced_at: string
  created_at: string
}

export interface Listing {
  id: string
  asset_id: string
  owner_id: string
  slug: string
  asking_price: number | null
  status: "active" | "sold" | "withdrawn"
  created_at: string
}

export type ShareStatus = "active" | "revoked"

export interface PassportShare {
  id: string
  asset_id: string
  owner_id: string
  slug: string
  status: ShareStatus
  created_at: string
}

export type TransferStatus = "pending" | "accepted" | "declined" | "cancelled"

export interface OwnershipTransfer {
  id: string
  asset_id: string
  from_user_id: string
  to_email: string
  to_user_id: string | null
  note: string | null
  status: TransferStatus
  created_at: string
  resolved_at: string | null
}

// ----------------------------------------------------------------------------
// AI Diagnose
// ----------------------------------------------------------------------------
export type RecommendationAction = "buy_accessory" | "upgrade" | "repair" | "sell" | "recycle" | "keep_using"
export type Urgency = "low" | "medium" | "high"

export interface DeviceCheck {
  os: string
  command: string
  output: string
}

export interface ScoreBreakdown {
  battery: number | null
  performance: number | null
  cosmetic: number | null
  functionality: number | null
}

export interface AiDiagnosis {
  id: string
  asset_id: string
  owner_id: string
  category: string
  survey_answers: Record<string, string>
  device_check: DeviceCheck | null
  ai_score: number
  score_breakdown: ScoreBreakdown
  condition_summary: string
  key_findings: string[]
  recommendation_action: RecommendationAction
  recommendation_title: string
  recommendation_detail: string
  estimated_cost_min: number | null
  estimated_cost_max: number | null
  estimated_cost_currency: string
  urgency: Urgency
  service_record_id: string | null
  created_at: string
}

// The strict schema the Anthropic API must return when generating a
// diagnostic report from survey answers (+ optional device-check output).
export interface DiagnosticReport {
  ai_score: number
  score_breakdown: ScoreBreakdown
  condition_summary: string
  key_findings: string[]
  recommendation_action: RecommendationAction
  recommendation_title: string
  recommendation_detail: string
  estimated_cost_min: number | null
  estimated_cost_max: number | null
  estimated_cost_currency: string
  urgency: Urgency
}


export interface Profile {
  id: string
  full_name: string | null
  email: string | null
  avatar_initials: string | null
  created_at: string
}

// The strict schema the Anthropic API must return when extracting an invoice.
// Every field carries a confidence flag so the review screen can highlight
// anything the model is unsure about instead of silently guessing.
export interface ExtractedField<T> {
  value: T | null
  confidence: "high" | "medium" | "low"
}

export interface InvoiceExtraction {
  product_name: ExtractedField<string>
  brand: ExtractedField<string>
  category: ExtractedField<string>
  serial_number: ExtractedField<string>
  purchase_date: ExtractedField<string> // ISO yyyy-mm-dd
  purchase_price: ExtractedField<number>
  currency: ExtractedField<string>
  warranty_months: ExtractedField<number>
  notes: ExtractedField<string>
}

// Supabase generated-types placeholder so `createClient<Database>()` type-checks.
// Safe to leave as-is; it only affects editor autocomplete, not runtime behavior.
export type Database = any

// ----------------------------------------------------------------------------
// Device Passport Platform
// ----------------------------------------------------------------------------
export type OrgType = "manufacturer" | "seller" | "repair_shop" | "admin"
export type PlatformRole = "owner" | OrgType

export interface Organization {
  id: string
  name: string
  org_type: OrgType
  verified: boolean
  created_at: string
}

export interface OrganizationMember {
  id: string
  organization_id: string
  user_id: string
  role: "owner" | "staff"
  created_at: string
}

export type DeviceStatus = "registered" | "sold" | "active" | "archived"

export interface Device {
  id: string
  ownx_id: string
  manufacturer_org_id: string | null
  product_name: string
  brand: string | null
  category: string | null
  model_number: string | null
  serial_number: string | null
  imei: string | null
  manufactured_at: string | null
  warranty_months: number | null
  authenticity_notes: string | null
  image_url: string | null
  status: DeviceStatus
  current_owner_id: string | null
  asset_id: string | null
  created_at: string
  updated_at: string
}

export type LifecycleEventType =
  | "manufactured" | "sale_recorded" | "ownership_transfer_initiated" | "ownership_transfer_accepted"
  | "repair" | "accessory_added" | "document_added" | "condition_update" | "note" | "verification"
export type LifecycleStatus = "reported" | "documented" | "verified" | "confirmed"

export interface LifecycleEvent {
  id: string
  device_id: string
  event_type: LifecycleEventType
  status: LifecycleStatus
  actor_user_id: string | null
  actor_org_id: string | null
  title: string
  detail: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface DeviceTransfer {
  id: string
  device_id: string
  from_org_id: string | null
  to_email: string
  to_user_id: string | null
  sale_price: number | null
  invoice_document_id: string | null
  note: string | null
  status: "pending" | "accepted" | "declined" | "cancelled"
  created_at: string
  resolved_at: string | null
}