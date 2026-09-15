import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Hero } from "@/components/home/hero"
import { Lifecycle } from "@/components/home/lifecycle"
import { Problem } from "@/components/home/problem"
import { Process } from "@/components/home/process"
import { Documents } from "@/components/home/documents"
import { ConditionScore } from "@/components/home/condition-score"
import { ResaleCta } from "@/components/home/resale-cta"

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Lifecycle />
        <Problem />
        <Process />
        <Documents />
        <ConditionScore />
        <ResaleCta />
      </main>
      <SiteFooter />
    </div>
  )
}
