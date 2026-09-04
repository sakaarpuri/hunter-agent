import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  EnvelopeSimple,
  Fingerprint,
  SlidersHorizontal,
} from "@phosphor-icons/react/dist/ssr";
import { Brand } from "@/components/brand";
import { BriefExperience } from "@/components/brief-experience";
import { DreamFilm } from "@/components/dream-film";

const questions = [
  [
    "What if I'm happy in my current job?",
    "That's a good place to start. Tell us what would make a move worth considering. Read your brief, ignore anything that doesn't excite you, and only take the next step when you want to. Active job seekers are welcome too.",
  ],
  [
    "What actually arrives in my inbox?",
    "Up to three standout matches per email. We search daily but only send genuine new matches, never filler. Your email arrives at your chosen time when there is something worthwhile to share.",
  ],
  [
    "Can I choose where you look?",
    "Yes. Set your preferred locations and choose remote, hybrid or on-site work. Remote-work region preferences are separate, so a remote listing still needs to fit where you can work. You can change these preferences in your account.",
  ],
  [
    "What happens when I reply?",
    "Reply with the numbers of the jobs you want to select them in your dashboard. When you're ready, choose to prepare a tailored CV and cover letter, or use your own materials. Simply selecting a job does not start AI writing.",
  ],
  [
    "How long do jobs stay in my account?",
    "Suggestions stay for seven days from first discovery, including ones you've selected but not applied to. Selecting one doesn't restart the clock. Your generated documents and application history are kept separately, so your work isn't lost.",
  ],
  [
    "Will it apply to jobs for me?",
    "You stay in control. Review and edit your materials, then submit your application yourself. Mark it applied to keep track and choose an optional follow-up plan.",
  ],
  [
    "What if I already like my CV?",
    "Keep it. You can choose to prepare your own materials and just use the daily job brief. If you do use AI, you can refine your CV or cover letter separately.",
  ],
  [
    "Are the dream jobs on this page real?",
    "Yes. They're examples from employer career pages, with original links and a review date. They're an editorial snapshot, not a live vacancy feed or personal recommendations. Openings can close. Your own brief follows your skills, ambitions, and preferences, not this deliberately wide-ranging collection.",
  ],
];

export default function Home() {
  return (
    <div className="home-page">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <div className="site-nav">
          <Brand />
          <nav aria-label="Main navigation">
            <a href="#how-it-works">How it works</a>
            <a href="#your-control">Built around you</a>
          </nav>
          <Link className="nav-signin" href="/dashboard?mode=signin">
            Sign in <ArrowUpRight size={16} />
          </Link>
        </div>
      </header>
      <main id="main-content">
        <section className="hero-section" aria-labelledby="hero-title">
          <DreamFilm />
        </section>
        <section
          className="demo-section page-width"
          id="try-it"
          aria-label="Explore real dream-job examples"
        >
          <BriefExperience />
        </section>
        <div className="benefit-strip page-width">
          <span>
            <span className="index-label">01</span> Three worth considering.
            Not another feed.
          </span>
          <span>
            <span className="index-label">02</span> Ambition, not urgency.
          </span>
          <span>
            <span className="index-label">03</span> You decide what is worth a
            move.
          </span>
        </div>
        <section id="how-it-works" className="how-section page-width">
          <div className="section-intro">
            <p className="eyebrow">GET ON WITH LIFE. LEAVE A DOOR OPEN.</p>
            <h2>
              You don&apos;t have to leave.
              <br />
              Just don&apos;t miss it.
            </h2>
            <p>
              A dream job might mean a bigger mission, a different country, or
              simply more room for life. You define the upgrade. We help you
              keep an eye out.
            </p>
          </div>
          <div className="journey-steps">
            <article>
              <span className="journey-number">01</span>
              <div>
                <p className="eyebrow">SET YOUR DIRECTION</p>
                <h3>
                  What would make
                  <br />
                  you say &ldquo;maybe&rdquo;?
                </h3>
                <p>
                  Bring your experience, then set your ambitions: the roles,
                  places, salary, and non-negotiables that could make your next
                  chapter better than this one.
                </p>
                <div className="preference-example">
                  <span>A bigger mission</span>
                  <span>Room for life</span>
                  <span>Open to a new country</span>
                </div>
              </div>
            </article>
            <article>
              <span className="journey-number">02</span>
              <div>
                <p className="eyebrow">A FEW WORTH YOUR ATTENTION</p>
                <h3>
                  Open your email.
                  <br />
                  Keep your options interesting.
                </h3>
                <p>
                  AI searches daily for relevant roles and selects up to three
                  new opportunities for your email, with context on the fit.
                  Nothing catching your eye? Carry on with your day. Something
                  does? Reply with its number.
                </p>
                <div className="reply-example">
                  <EnvelopeSimple size={18} />
                  <span>Number 2 has my attention.</span>
                  <ArrowUpRight size={18} />
                </div>
              </div>
            </article>
            <article>
              <span className="journey-number">03</span>
              <div>
                <p className="eyebrow">MAKE YOUR NEXT MOVE</p>
                <h3>
                  Curious becomes serious.
                  <br />
                  When you decide.
                </h3>
                <p>
                  Only then turn your experience into a tailored CV and letter.
                  Refine, preview, and apply yourself. No pressure to move just
                  because you took a look.
                </p>
                <Link href="/dashboard" className="text-link">
                  Set up your scout <ArrowRight size={17} />
                </Link>
              </div>
            </article>
          </div>
        </section>
        <section className="control-section" id="your-control">
          <div className="page-width control-grid">
            <div>
              <p className="eyebrow">CURIOSITY ISN&apos;T A COMMITMENT</p>
              <h2>
                An agent with initiative.
                <br />
                <span>And boundaries.</span>
              </h2>
              <p>
                The point isn&apos;t to talk you out of a good job. It&apos;s to
                help you recognise an opportunity you might genuinely want.
              </p>
            </div>
            <div className="control-features">
              <article>
                <SlidersHorizontal size={25} />
                <div>
                  <h3>You set the brief.</h3>
                  <p>
                    Location, work type, excluded companies, and delivery time.
                    Change your mind? Change your preferences.
                  </p>
                </div>
              </article>
              <article>
                <Fingerprint size={25} />
                <div>
                  <h3>It starts with your experience.</h3>
                  <p>
                    Review the reasoning and refine the writing. Your CV should
                    sound like you, with every claim checked by you.
                  </p>
                </div>
              </article>
              <article>
                <Check size={25} />
                <div>
                  <h3>You make the final move.</h3>
                  <p>
                    No applications sent behind your back. Pause your brief,
                    edit one section, or handle the materials yourself.
                  </p>
                </div>
              </article>
            </div>
          </div>
        </section>
        <section className="faq-section page-width">
          <div>
            <p className="eyebrow">A FEW GOOD QUESTIONS</p>
            <h2>
              Before your
              <br />
              first possibilities.
            </h2>
          </div>
          <div>
            {questions.map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="closing-section page-width">
          <p className="eyebrow">NO RESIGNATION REQUIRED.</p>
          <h2>Find your &ldquo;what if&rdquo;.</h2>
          <Link href="/dashboard" className="button button-accent">
            Find my what if <ArrowUpRight size={19} />
          </Link>
          <p>Keep doing what you do. Let something extraordinary find you.</p>
        </section>
      </main>
      <footer className="site-footer page-width">
        <Brand />
        <p>A few possibilities. No pressure to move.</p>
        <nav aria-label="Legal">
          <Link href="/privacy" className="text-link">
            Privacy
          </Link>{" "}
          <span aria-hidden="true">·</span>{" "}
          <Link href="/terms" className="text-link">
            Terms
          </Link>
        </nav>
        <a href="#main-content" className="text-link">
          Back to top <ArrowUpRight size={16} />
        </a>
      </footer>
    </div>
  );
}
