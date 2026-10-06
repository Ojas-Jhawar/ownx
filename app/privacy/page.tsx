import type { Metadata } from "next"
import { LegalPage } from "@/components/legal/legal-page"

export const metadata: Metadata = { title: "Privacy Policy" }

export default function Page() {
  return (
    <LegalPage title="Privacy Policy" updated="1 October 2026">
      <p>Ownx keeps a record of the things you own. This page explains what we store and why.</p>
      <h2>What we collect</h2>
      <ul>
        <li>Account details: name and email.</li>
        <li>Passport data you enter or upload: product details, serial numbers, invoices, service records, photos.</li>
        <li>Diagnostic answers and any device-check output you paste into AI Diagnose.</li>
        <li>Email addresses you give us for a waitlist or an ownership transfer.</li>
      </ul>
      <h2>How we use it</h2>
      <ul>
        <li>To show your passport, warranty status and history to you.</li>
        <li>To read invoices and generate condition reports using an AI provider (Anthropic). Files are sent only when you press the extract or diagnose button.</li>
        <li>To let you share a read-only link or transfer a passport. Share links reveal only what the share page displays.</li>
      </ul>
      <h2>Who can see your data</h2>
      <p>
        Only you, people you share a link with, and a transfer recipient once you send a transfer. Invoices are stored in a
        private bucket. Ownx staff access data only to operate or secure the service.
      </p>
      <h2>Your choices</h2>
      <ul>
        <li>Revoke any share link from the passport&apos;s Share tab.</li>
        <li>Delete a passport at any time.</li>
        <li>Ask us to export or delete your account data by emailing the contact on the About page.</li>
      </ul>
      <h2>Retention and security</h2>
      <p>We keep data while your account is active. Access is protected by row-level security and private storage.</p>
    </LegalPage>
  )
}
