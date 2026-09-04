import type { Metadata } from "next";
import {
  LegalContact,
  LegalDocument,
} from "@/components/legal-document";

export const metadata: Metadata = {
  title: "Terms | HunterAgent",
  description: "The terms for using the current HunterAgent service.",
};

export default function TermsPage() {
  return (
    <LegalDocument
      eyebrow="Using the service"
      title="Terms without surprises."
      summary="These terms cover the current HunterAgent service. HunterAgent helps you discover possibilities and prepare materials; it does not make career decisions or apply to jobs for you."
      updated="4 September 2026"
    >
      <section>
        <h2>About these terms</h2>
        <p>
          By creating an account or using HunterAgent, you agree to these terms
          and the Privacy Notice. If you do not agree, do not use the service.
        </p>
        <p>
          These terms are between you and HunterAgent, the operator of the
          service.
        </p>
        <p>
          <strong>Legal and support contact:</strong> <LegalContact />
        </p>
      </section>

      <section>
        <h2>What HunterAgent does</h2>
        <p>
          HunterAgent searches public job sources using your preferences, filters
          and ranks possible matches, and can email up to three new suggestions
          in a brief. When you choose a job, HunterAgent can help draft or refine
          a CV, cover letter, work-sample reasoning, and a follow-up message.
        </p>
        <p>
          Search results depend on third-party listings and may be incomplete,
          inaccurate, duplicated, changed, or already closed. Suggestions expire
          from the active brief seven days after first discovery. HunterAgent does
          not promise a particular number of matches, uninterrupted delivery, an
          interview, an offer, or any employment outcome.
        </p>
      </section>

      <section>
        <h2>Your account</h2>
        <p>
          You must provide accurate account details, keep your password and
          devices secure, and promptly report suspected unauthorised access. You
          are responsible for activity performed through your account unless the
          law says otherwise.
        </p>
        <p>
          The service is designed for people managing their own career. It is not
          knowingly directed to children, and the current product does not include
          an age-verification mechanism. A parent or guardian who believes a child
          has provided personal information should contact HunterAgent.
        </p>
      </section>

      <section>
        <h2>Your decisions and AI output</h2>
        <p>
          Job matching and generated writing are assistance, not professional,
          legal, immigration, tax, financial, or recruitment advice. AI and source
          data can be wrong. Before acting, you must check the original listing,
          employer identity, deadline, salary, location, work eligibility, and
          every factual statement in generated materials.
        </p>
        <p>
          You decide whether to select, pursue, or apply for a job. HunterAgent
          does not currently send applications, make commitments, accept terms,
          or contact employers on your behalf. You submit any application yourself.
        </p>
      </section>

      <section>
        <h2>Your content</h2>
        <p>
          You keep any rights you have in the CV, profile information, prompts,
          work samples, and other content you provide. You give the operator a
          limited permission to host, copy, process, and transmit that content
          only as reasonably needed to provide, secure, maintain, and support the
          service.
        </p>
        <p>
          You must have the right to provide that content. Do not upload another
          person&apos;s confidential or personal information without proper authority,
          or material that infringes intellectual-property, privacy, or other rights.
        </p>
      </section>

      <section>
        <h2>Acceptable use</h2>
        <p>You must not use HunterAgent to:</p>
        <ul>
          <li>break the law, mislead employers, impersonate someone, or commit fraud;</li>
          <li>submit malicious files, code, prompts, or content;</li>
          <li>
            probe, attack, disrupt, overload, scrape, reverse engineer, or bypass
            security, rate limits, usage controls, or access restrictions;
          </li>
          <li>
            access another person&apos;s account or use information from the service
            to harass, discriminate against, or harm someone; or
          </li>
          <li>resell or operate the service for others without written permission.</li>
        </ul>
      </section>

      <section>
        <h2>Third-party services</h2>
        <p>
          HunterAgent relies on service providers for hosting, database storage,
          AI processing, web search, and email delivery. It also links to employer
          and job-board websites. Those third parties have their own terms,
          privacy practices, availability, and content. HunterAgent does not
          control an employer&apos;s recruitment process or a third-party site.
        </p>
      </section>

      <section>
        <h2>Billing is not active</h2>
        <p>
          The current HunterAgent product has no active checkout, paid
          subscription, renewal, cancellation-billing, or payment-card processing.
          You will not be charged through the current service.
        </p>
        <p>
          If paid access is introduced, the price, billing interval, taxes where
          applicable, and any additional payment terms must be shown before you
          affirmatively agree to a charge. These terms do not promise a future
          price or a refund policy.
        </p>
      </section>

      <section>
        <h2>Service availability and changes</h2>
        <p>
          HunterAgent may change, pause, limit, or discontinue features to
          maintain security, reliability, provider limits, or the product itself.
          The operator may suspend or close an account that appears to violate
          these terms, creates risk for the service or others, or must be limited
          by law. Where practical and appropriate, notice should be provided.
        </p>
        <p>
          You may stop using HunterAgent at any time and can delete your account
          in account settings. Sections that by their nature should continue,
          including rights in content, disclaimers, and responsibility for prior
          conduct, remain relevant after account closure.
        </p>
      </section>

      <section>
        <h2>HunterAgent materials</h2>
        <p>
          The service&apos;s software, interface, branding, and original site content
          belong to the operator or applicable licensors. These terms give you a
          personal, limited, non-exclusive, non-transferable right to use the
          service while you comply with them. They do not transfer ownership of
          HunterAgent&apos;s technology or brand.
        </p>
      </section>

      <section>
        <h2>Disclaimers and responsibility</h2>
        <p>
          HunterAgent is provided on an &ldquo;as available&rdquo; basis. To the
          fullest extent permitted by applicable law, no guarantee is made that
          the service, search results, AI output, emails, or third-party links will
          always be available, accurate, secure, or suitable for a particular role.
        </p>
        <p>
          Nothing in these terms excludes or limits responsibility that cannot be
          excluded by law. Subject to that rule, the operator is not responsible
          for indirect or consequential losses, lost opportunities, employer
          decisions, third-party conduct, or action taken without checking source
          information and generated content. Mandatory consumer rights remain
          unaffected.
        </p>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>
          These terms may change as HunterAgent changes. The date at the top will
          be updated, and material changes should be communicated through an
          appropriate service notice. Continuing to use the service after revised
          terms take effect means you accept them, where permitted by law.
        </p>
        <p>
          Questions, complaints, or notices should be sent to the configured legal
          contact above.
        </p>
      </section>
    </LegalDocument>
  );
}
