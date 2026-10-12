import { redirect } from 'next/navigation'

// Liability & Safety is now part of the Terms of Use; keep old links working.
export default function LiabilityPage() {
  redirect('/terms#safety')
}
