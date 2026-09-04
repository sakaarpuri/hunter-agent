import type { Metadata } from "next";
import {
  LegalContact,
  LegalDocument,
} from "@/components/legal-document";

export const metadata: Metadata = {
  title: "Privacy | HunterAgent",
  description:
    "How HunterAgent collects, uses, shares, retains, and protects personal information.",
};

export default function PrivacyPage() {
  return (
    <LegalDocument
      eyebrow="Your information"
      title="Privacy, plainly."
      summary="This notice describes the current HunterAgent product: a job-discovery and application-writing service that you direct. It does not describe features that have not been built."
      updated="4 September 2026"
    >
      <section>
        <h2>Who is responsible</h2>
        <p>
          HunterAgent operates the service and is responsible for deciding how
          the personal information described here is used.
        </p>
        <p>
          <strong>Privacy and legal contact:</strong> <LegalContact />
        </p>
      </section>

      <section>
        <h2>Information HunterAgent handles</h2>
        <h3>Account and security information</h3>
        <p>
          This includes your name, email address, a hashed version of your
          password, account dates, password-reset records, session-token hashes,
          and the IP address associated with a login session.
        </p>
        <h3>Career profile and preferences</h3>
        <p>
          This can include your current title, target roles, preferred locations,
          salary preference, work and workplace preferences, remote-work regions,
          excluded companies, career ambitions, strengths, skills, education,
          employment history, work-sample links, email delivery time, timezone,
          and document-style choices.
        </p>
        <h3>CV information</h3>
        <p>
          If you upload a CV, HunterAgent processes the file to extract text and
          profile fields. The current app does not intentionally retain the
          original uploaded file. It does retain the file name and the extracted
          or edited career details you save to your profile. When AI CV parsing
          is available, up to the first 4,000 characters of extracted CV text are
          sent to Anthropic for structured extraction.
        </p>
        <h3>Job and application activity</h3>
        <p>
          This includes jobs shown to you, matching explanations, email-brief
          metadata, selected jobs, replies to brief emails, generated CV and
          cover-letter content, refinement instructions and history, work-sample
          reasoning, application dates, and optional follow-up plans and drafts.
        </p>
        <h3>Service and provider records</h3>
        <p>
          HunterAgent keeps limited records used to secure the service, prevent
          duplicate searches, enforce daily usage limits, diagnose failures, and
          control provider costs. Server logs may include internal user IDs,
          event IDs, request outcomes, and error descriptions. The AI path is
          designed not to log prompts, model responses, names, or CV content.
        </p>
      </section>

      <section>
        <h2>How the information is used</h2>
        <ul>
          <li>To create and secure your account and maintain your session.</li>
          <li>
            To search for public job listings, apply your filters, rank possible
            matches, and avoid repeatedly showing the same job.
          </li>
          <li>
            To send job briefs and process replies that select jobs from a brief.
          </li>
          <li>
            To create and refine application materials only when you request
            them, and to save the materials and application records you choose.
          </li>
          <li>
            To provide password resets, account settings, support, security,
            abuse prevention, reliability, and usage controls.
          </li>
          <li>To meet legal obligations that apply to the operator.</li>
        </ul>
        <p>
          Depending on the law that applies, these activities may rely on the
          need to provide the service you request, the operator&apos;s legitimate
          interests in running and securing the service, consent where required,
          or compliance with a legal obligation.
        </p>
      </section>

      <section>
        <h2>AI and automated assistance</h2>
        <p>
          HunterAgent uses AI to interpret optional career preferences, assess
          supplied job-listing evidence against your profile, extract information
          from a CV, and draft or refine application materials and follow-up
          messages. Different tasks receive different information.
        </p>
        <p>
          Matching requests omit your name, email address, full CV, and
          work-sample URLs. Application-writing requests can include your name,
          career profile, guided CV details, work-sample links, the relevant job,
          your editing instruction, and existing draft sections.
        </p>
        <p>
          AI output can be incomplete or wrong. HunterAgent does not apply for a
          job, contact an employer, or make an employment decision for you. You
          decide which jobs to pursue and must review every claim before using a
          generated document.
        </p>
      </section>

      <section>
        <h2>Who receives information</h2>
        <ul>
          <li>
            <strong>Supabase/Postgres</strong> stores account records, workspace
            data, public-search caches, limited AI-response caches, and usage
            controls for the current deployment.
          </li>
          <li>
            <strong>Anthropic</strong> processes the limited prompts and content
            needed for enabled AI tasks, as described above.
          </li>
          <li>
            <strong>Tavily</strong> receives public job-search queries made from
            target-role and region terms. The search-query builder excludes your
            name, email, CV, salary, strengths, excluded employers, and private
            career-preference text.
          </li>
          <li>
            <strong>AgentMail</strong> processes your delivery email address,
            outbound job briefs and password-reset emails, and replies sent to
            the HunterAgent inbox together with message-routing metadata.
          </li>
          <li>
            <strong>Netlify</strong> hosts the deployed application and server
            functions and may process ordinary request, network, and operational
            information when you use the service.
          </li>
        </ul>
        <p>
          These providers operate under their own terms and may process
          information in countries other than the one where you live. Their
          privacy notices explain their locations and data-handling practices.
        </p>
        <p>
          Job-board and employer sites receive information directly from you only
          when you choose to visit or submit an application there. HunterAgent
          does not currently submit applications to employers for you. Personal
          information may also be disclosed when required by law, to protect the
          service or others, or as part of a properly managed business transfer.
        </p>
      </section>

      <section>
        <h2>Cookies and similar storage</h2>
        <p>
          HunterAgent uses one essential, HTTP-only session cookie to keep you
          signed in. It is set with a 30-day expiry and is marked Secure in
          production. The current code does not include advertising cookies or a
          third-party analytics service. Browser features may keep ordinary data
          such as a downloaded or printed CV at your direction.
        </p>
      </section>

      <section>
        <h2>How long information is kept</h2>
        <ul>
          <li>
            Unsaved job suggestions expire seven days after first discovery.
            Selecting a suggestion does not restart that period.
          </li>
          <li>
            A job&apos;s no-repeat fingerprint is normally kept for 30 days and
            pruned when a new brief is prepared.
          </li>
          <li>
            Generated materials, saved job records, application history, inbound
            reply content, profile information, and preferences remain in your
            workspace until you remove the account, unless the service needs to
            retain something for a legal or security reason.
          </li>
          <li>
            Limited public-search, AI-response, and usage-control records are
            pruned on a rolling basis, with database cleanup capped at 30 days.
          </li>
          <li>
            Login sessions expire after 30 days. Password-reset links become
            unusable after one hour; their records are removed when used,
            replaced, or when the account is deleted.
          </li>
        </ul>
        <p>
          Infrastructure backups and provider-held records may follow separate
          retention schedules and can remain for a limited period after active
          records are removed for recovery, security, or legal reasons.
        </p>
      </section>

      <section>
        <h2>Your choices and rights</h2>
        <p>
          You can change job preferences, pause brief emails, choose not to use
          AI-generated materials, sign out, or delete your account from account
          settings. Deleting the account removes the user record and the linked
          workspace, sessions, reset records, user discovery-run record, and
          user-specific AI cache from the active database through linked deletion.
        </p>
        <p>
          Depending on where you live, you may also have rights to ask for access,
          correction, deletion, restriction, portability, or an objection to
          certain uses of your information, and to withdraw consent where a use
          relies on consent. Contact HunterAgent to exercise a right. Identity
          verification may be required before information is disclosed or changed.
        </p>
        <p>
          You may complain to the data-protection authority where you live or
          work. In the United Kingdom, this is the Information Commissioner&apos;s
          Office.
        </p>
      </section>

      <section>
        <h2>Security and changes</h2>
        <p>
          The current service hashes passwords and session tokens, limits direct
          database access to server-side code, verifies inbound email webhook
          signatures, and avoids placing private profile data in shared public
          search caches. No online service can guarantee absolute security.
        </p>
        <p>
          This notice may change when the product, providers, or legal obligations
          change. A revised date will appear at the top. Material changes should
          be brought to account holders&apos; attention through an appropriate
          service notice.
        </p>
      </section>
    </LegalDocument>
  );
}
