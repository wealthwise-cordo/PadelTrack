import type { Metadata } from 'next'
import LegalPage, { Section, List } from '@/components/legal/LegalPage'
import { LEGAL } from '@/lib/legal'

export const metadata: Metadata = { title: 'Terms of Use · PadelTrack' }

// Terms of use, including liability and safety (one document since
// LEGAL_VERSION 2026-10-12; /liability redirects to the safety section).
export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Use"
      intro={`These terms are an agreement between you and ${LEGAL.operator} (“PadelTrack”, “we”, “us”). They apply whenever you use PadelTrack at ${LEGAL.website}, and they include important information about safety and our liability in sections 5 and 8. By creating an account you agree to them. Please also read our Privacy Notice, which explains how we use your information.`}
    >
      <Section title="1. Your account">
        <List>
          <li>Give accurate information when you sign up and keep it up to date. Use one account per person.</li>
          <li>Keep your password secret. You are responsible for activity on your account. Tell us straight away if you think someone else has used it.</li>
          <li>A parent or guardian must create and manage the account of anyone under 13, and accept these terms on their behalf. Players aged 13 to 17 need a parent or guardian’s permission.</li>
        </List>
      </Section>

      <Section title="2. Using PadelTrack fairly">
        <p>PadelTrack is free to use. In return, you agree not to:</p>
        <List>
          <li>record false or made-up results, or try to manipulate ratings or rankings;</li>
          <li>add other people as guests, or enter their details, without their permission;</li>
          <li>harass, abuse or impersonate anyone, or use offensive names or content;</li>
          <li>break the law, or use PadelTrack for commercial purposes without our agreement;</li>
          <li>try to access other accounts, interfere with how PadelTrack works, or copy or scrape it by automated means.</li>
        </List>
        <p>We may remove content, correct or cancel results, or suspend or close an account that breaks these terms.</p>
      </Section>

      <Section title="3. Ratings, rankings and results">
        <p>Ratings and levels are PadelTrack’s own estimate, calculated from results that players enter. Levels are based on the LTA Padel Rating System for reference, but they are not official LTA ratings and are not endorsed by the LTA. We do our best to keep them accurate but cannot guarantee that any rating, ranking or result is correct.</p>
      </Section>

      <Section title="4. What PadelTrack does and doesn’t do">
        <p>PadelTrack is a tool for recording results, ratings, events and leagues. Matches, events and leagues are arranged by players and organisers themselves. We do not organise, supervise, referee, insure or run any match, event, league, court or venue, and we do not check the fitness, ability or conduct of players or organisers.</p>
        <List>
          <li>Arrangements to play, court bookings, fees and cancellations are between you, other players, organisers and venues.</li>
          <li>If you organise an event or league, you are responsible for running it safely and fairly, for any arrangements you make with players and venues, and for following venue rules.</li>
          <li>Venue details in the club list are for convenience and may not be up to date.</li>
        </List>
      </Section>

      <div id="safety" className="scroll-mt-6">
        <Section title="5. Playing safely, at your own risk">
          <p>Padel is a fast, physical sport. Taking part carries a risk of injury, including from collisions, the ball, rackets, walls and glass, slips and falls, and overexertion. You take part voluntarily and are responsible for:</p>
          <List>
            <li>making sure you are fit and healthy enough to play, and seeking medical advice if you are unsure;</li>
            <li>warming up, using suitable footwear and equipment, and playing within your ability;</li>
            <li>following the rules and safety instructions of the venue and any organiser;</li>
            <li>looking after your own belongings.</li>
          </List>
          <p>PadelTrack does not provide insurance. You may wish to take out your own personal accident or sports insurance. Venues and organisers may have their own cover and requirements.</p>
          <p>If a player is under 18, their parent or guardian accepts these terms on their behalf and is responsible for deciding whether they play.</p>
        </Section>
      </div>

      <Section title="6. Content you add">
        <p>You are responsible for the names, results and other content you add. You keep any rights you have in it, and you give us permission to store and display it to other players so we can run PadelTrack.</p>
      </Section>

      <Section title="7. Availability and changes">
        <p>We provide PadelTrack “as is” and may change, suspend or stop any part of it. We will try to give notice of significant changes, but we cannot promise PadelTrack will always be available, error-free or secure. We may update these terms. If we make significant changes we will tell you, and continuing to use PadelTrack means you accept them.</p>
      </Section>

      <Section title="8. Our liability">
        <List>
          <li>Nothing in these terms limits or excludes our liability for death or personal injury caused by our negligence, for fraud, or for anything else that cannot be limited or excluded by law. Nothing affects your legal rights as a consumer.</li>
          <li>Subject to that, and to the extent the law allows, we are not responsible for injury, illness, loss or damage arising from playing padel, travelling to or from venues, the condition of venues or equipment, or the actions of other players, organisers or venues.</li>
          <li>We are also not liable for losses that were not foreseeable, for business losses, or for losses caused by your own actions.</li>
          <li>Because PadelTrack is free, and subject to the first point, our total liability to you is limited to £100.</li>
        </List>
      </Section>

      <Section title="9. Ending your account">
        <p>You can stop using PadelTrack at any time and delete your account under Edit profile on your profile page, or by emailing <a href={`mailto:${LEGAL.contactEmail}`} className="text-orange-600 underline">{LEGAL.contactEmail}</a>. Your name stays on matches that were already confirmed, as our privacy notice explains. We may suspend or close accounts that break these terms or put other players at risk.</p>
      </Section>

      <Section title="10. Law">
        <p>These terms are governed by the law of {LEGAL.country}. You can bring legal proceedings in the courts of England and Wales. If you live in Scotland or Northern Ireland, you can also bring proceedings in your local courts.</p>
      </Section>
    </LegalPage>
  )
}
