import type { Metadata } from "next"
import { LegalPage } from "@/components/legal/legal-page"

export const metadata: Metadata = { title: "Terms of Use" }

export default function Page() {
  return (
    <LegalPage title="Terms of Use" updated="1 October 2026">
      <p>By using Ownx you agree to these terms.</p>
      <h2>The service</h2>
      <p>
        Ownx stores ownership records. A passport marked Self-Reported was entered by its owner and has not been checked
        by Ownx. Only a Verified badge means a manufacturer or approved seller registered the device.
      </p>
      <h2>Estimates</h2>
      <p>
        Condition scores, AI reports, scrap values and repair advice are estimates, not guarantees or financial advice.
      </p>
      <h2>Your responsibilities</h2>
      <ul>
        <li>Only add items you own or are entitled to record.</li>
        <li>Do not upload unlawful content or someone else&apos;s private documents.</li>
        <li>Keep your login secure.</li>
      </ul>
      <h2>Transfers and sharing</h2>
      <p>A transfer moves a passport to the account with the email you enter. Check the address before sending.</p>
      <h2>Changes and liability</h2>
      <p>
        We may change the service. The service is provided as is, to the extent permitted by law.
      </p>
    </LegalPage>
  )
}
