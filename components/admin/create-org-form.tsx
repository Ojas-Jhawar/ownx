"use client"

import { useActionState } from "react"
import { Plus } from "lucide-react"
import { createOrganizationForOwner, type AdminOrgState } from "@/app/actions/organizations"

const initialState: AdminOrgState = { error: null }

const inputClass =
  "mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"

function Field({
  name,
  label,
  type = "text",
  required = true,
  placeholder,
}: {
  name: string
  label: string
  type?: string
  required?: boolean
  placeholder?: string
}) {
  return (
    <div>
      <label htmlFor={name} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <input id={name} name={name} type={type} required={required} placeholder={placeholder} className={inputClass} />
    </div>
  )
}

export function CreateOrgForm() {
  const [state, action, pending] = useActionState(createOrganizationForOwner, initialState)

  return (
    <form action={action} className="mt-4 grid gap-3 sm:grid-cols-2">
      <Field name="org_name" label="Organisation name" placeholder="Acme Electronics Pvt Ltd" />
      <div>
        <label htmlFor="org_type" className="text-xs font-medium text-muted-foreground">
          Type
        </label>
        <select id="org_type" name="org_type" required defaultValue="" className={inputClass}>
          <option value="" disabled>
            Choose type…
          </option>
          <option value="manufacturer">Manufacturer</option>
          <option value="seller">Seller / Retailer</option>
          <option value="repair_shop">Repair shop</option>
        </select>
      </div>
      <Field name="owner_name" label="Owner's full name" />
      <Field name="owner_email" label="Owner's email (invite is sent here)" type="email" />
      <Field name="registration_number" label="GSTIN / registration no." />
      <Field name="contact_phone" label="Phone (optional)" required={false} />
      <div className="sm:col-span-2">
        <label htmlFor="notes" className="text-xs font-medium text-muted-foreground">
          Verification notes (Google Form row, how you verified, date)
        </label>
        <textarea id="notes" name="notes" rows={2} className={inputClass} />
      </div>

      {state.error && <p className="text-sm text-destructive sm:col-span-2">{state.error}</p>}
      {state.success && <p className="text-sm text-brand sm:col-span-2">{state.success}</p>}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center gap-1.5 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-60 sm:col-span-2"
      >
        <Plus className="size-4" /> {pending ? "Creating…" : "Create organisation & invite owner"}
      </button>
    </form>
  )
}
