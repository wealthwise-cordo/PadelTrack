import type { Metadata } from 'next'
import LegalPage, { Section, List } from '@/components/legal/LegalPage'
import { LEGAL } from '@/lib/legal'

export const metadata: Metadata = { title: 'Privacy Notice · PadelTrack' }

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Notice"
      intro={`This notice explains what personal information PadelTrack collects, why, who can see it and the choices you have. PadelTrack is run by ${LEGAL.operator} (“PadelTrack”, “we”, “us”), based in the United Kingdom. We are the controller of your personal information under UK data protection law (the UK GDPR and the Data Protection Act 2018).`}
    >
      <Section title="1. Information we collect">
        <p>When you create an account and use PadelTrack we collect:</p>
        <List>
          <li><strong>Account details</strong> — your name, email address and password (stored only in scrambled, hashed form), and the playing level you choose.</li>
          <li><strong>Profile details</strong> — your gender, date of birth and country when you sign up directly, plus any display name, nickname and avatar colour you set.</li>
          <li><strong>Playing information</strong> — matches you record or take part in (players, scores, date and venue), confirmations, your rating and its history, and events and leagues you organise or play in.</li>
          <li><strong>Information about other people you add</strong> — when you add a guest to a match or event, their name and, if you give one, the level you think they play at. The matches a guest plays in are kept on their guest profile. If PadelTrack verifies a guest so that their ranked matches count before they join, we also keep a rating and rating history for them. A guest can take all of this over by joining PadelTrack with their invite link, or ask us to remove it by emailing <a href={`mailto:${LEGAL.contactEmail}`} className="text-orange-600 underline">{LEGAL.contactEmail}</a>. Only add people who are happy for you to do so.</li>
          <li><strong>Usage and technical information</strong> — when you sign in, which days you use the app, and reports of errors (the page involved, the time and your account identifier). Our hosting provider also keeps standard server logs, including IP addresses, for security.</li>
          <li><strong>Messages</strong> — emails we send you, such as password-reset links, and anything you send us.</li>
        </List>
      </Section>

      <Section title="2. Why we use it, and our legal basis">
        <List>
          <li><strong>To provide PadelTrack</strong> — running your account, recording matches, calculating ratings, and running events and leagues. Legal basis: performing our contract with you (the Terms of Use).</li>
          <li><strong>To show your results to other players</strong> — rankings only work if the players you play with can see shared results. Legal basis: contract, and our legitimate interest in running a fair rankings service.</li>
          <li><strong>To keep PadelTrack secure and working</strong> — preventing misuse, fixing errors, and sending essential emails such as password resets. Legal basis: legitimate interests.</li>
          <li><strong>To understand and improve PadelTrack</strong> — counting sign-ups, activity and which features are used, and which venues to add. We look at this inside PadelTrack only, and only the operator can see it. Legal basis: legitimate interests.</li>
          <li><strong>To meet legal obligations</strong> — for example, responding to lawful requests.</li>
        </List>
        <p>We do not sell your information, use it for advertising, or make decisions about you based solely on automated processing that have legal or similarly significant effects. Your rating is calculated automatically from match results, but it is a sporting estimate only.</p>
      </Section>

      <Section title="3. Who can see your information">
        <List>
          <li><strong>Other PadelTrack players</strong> can see your name, display name and nickname, avatar colour, level and rating, and the matches, results and statistics you share with them. Players in an event or league can see its fixtures and results.</li>
          <li><strong>Your date of birth, gender, country, email address and password</strong> are not shown to other players.</li>
          <li><strong>Service providers</strong> who run parts of PadelTrack for us, under contracts that require them to protect your information: Vercel (website hosting), Neon (database hosting) and Resend (sending email).</li>
          <li><strong>Authorities</strong>, if the law requires it.</li>
        </List>
      </Section>

      <Section title="4. International transfers">
        <p>Some of our service providers store or process information outside the UK, including in the United States and the European Union. Where they do, the transfer is protected by safeguards recognised under UK law, such as the UK International Data Transfer Addendum to the EU Standard Contractual Clauses or the UK–US data bridge.</p>
      </Section>

      <Section title="5. How long we keep it">
        <List>
          <li>Account, profile and playing information: for as long as your account is open. You can delete your account at any time under Edit profile on your profile page, or by emailing us. When you do, we straight away erase your email address, password, nickname, gender, date of birth and country, and remove any of your matches still waiting to be confirmed. Your name stays on matches that were already confirmed, so other players’ results and ratings don’t change, but your profile can no longer be viewed and you are removed from other players’ circles.</li>
          <li>Error reports: up to 90 days.</li>
          <li>Password-reset links: they expire after 1 hour.</li>
          <li>Information we must keep for legal reasons: for as long as the law requires.</li>
        </List>
      </Section>

      <Section title="6. Cookies">
        <p>PadelTrack uses one essential cookie to keep you signed in. It is strictly necessary for the service to work, so it does not need your consent. We do not use advertising or third-party analytics cookies.</p>
      </Section>

      <Section title="7. Your rights">
        <p>You have the right to ask for a copy of your information, to have it corrected, deleted or restricted, to object to how we use it, and to receive it in a portable format. You can delete your account yourself under Edit profile on your profile page. To use any of the other rights, email <a href={`mailto:${LEGAL.contactEmail}`} className="text-orange-600 underline">{LEGAL.contactEmail}</a>. We will reply within one month.</p>
        <p>If you are unhappy with how we handle your information, please contact us first. You also have the right to complain to the Information Commissioner’s Office (ICO): <a href="https://ico.org.uk/make-a-complaint/" className="text-orange-600 underline">ico.org.uk/make-a-complaint</a>, or 0303 123 1113.</p>
      </Section>

      <Section title="8. Children">
        <p>A parent or guardian must create and manage the account of anyone under 13, and accept our terms on their behalf. Players aged 13 to 17 should have a parent or guardian’s permission. If you think a child is using PadelTrack without this, contact us and we will deal with it.</p>
      </Section>

      <Section title="9. Security">
        <p>We use appropriate technical and organisational measures to protect your information, including encrypted connections and hashed passwords. No online service can be completely secure, so please use a strong, unique password.</p>
      </Section>

      <Section title="10. Changes to this notice">
        <p>We may update this notice from time to time. If we make significant changes we will tell you in the app or by email. The date at the top shows when it last changed.</p>
      </Section>
    </LegalPage>
  )
}
