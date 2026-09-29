import type { Metadata } from "next";
import { SectionLabel } from "@/components/primitives";

export const metadata: Metadata = {
  title: "Privacy & data policy — Siddhanto",
  description:
    "What Siddhanto records, what it does not, and how submissions are processed by the decision model.",
};

function H({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-9 mb-3 font-mono text-[11px] tracking-[0.18em] text-ink-soft uppercase">
      {children}
    </h2>
  );
}

function Item({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3 border-b border-rule py-2.5 last:border-b-0">
      <span aria-hidden className="mt-2 h-px w-3 shrink-0 bg-rule-strong" />
      <span className="text-[14px] leading-relaxed text-ink-soft">{children}</span>
    </li>
  );
}

export default function Privacy() {
  return (
    <article className="mx-auto max-w-[68ch] pt-12 pb-8">
      <div className="rise">
        <SectionLabel>Privacy &amp; data policy</SectionLabel>
        <h1 className="mt-4 text-[clamp(1.9rem,4.4vw,2.9rem)] leading-[1.05] font-semibold tracking-tighter text-ink">
          What you type, and not who you are.
        </h1>
      </div>

      <div className="rise mt-8 border-y-2 border-ink py-4" style={{ "--i": 1 } as React.CSSProperties}>
        <p className="text-[15px] leading-relaxed text-ink">
          Siddhanto has no accounts, no names and no email addresses. Submissions are stored
          anonymously and used to study how people ask decision questions. Rejected submissions
          are kept too — they are part of the same record.
        </p>
      </div>

      <section className="rise" style={{ "--i": 2 } as React.CSSProperties}>
        <H>What is collected</H>
        <ul>
          <Item>
            The <strong className="font-medium text-ink">state</strong> text and the{" "}
            <strong className="font-medium text-ink">queries</strong> you submit, along with
            every option, level and criterion you define.
          </Item>
          <Item>
            The <strong className="font-medium text-ink">answers</strong> the model returns —
            probabilities, the selected option, expected values, and confidence figures.
          </Item>
          <Item>
            Technical metadata: browser user-agent, referring page, and how long the form was
            open before submission.
          </Item>
          <Item>
            A <strong className="font-medium text-ink">one-way hash</strong> of the IP address
            the request arrived from, used for rate limiting and abuse detection. The raw
            address is never stored.
          </Item>
        </ul>
      </section>

      <section className="rise" style={{ "--i": 3 } as React.CSSProperties}>
        <H>What is not collected</H>
        <ul>
          <Item>No accounts, names, email addresses or passwords.</Item>
          <Item>No raw IP addresses — only the hash described above.</Item>
          <Item>No tracking pixels, advertising networks or cross-site trackers.</Item>
          <Item>No reading of submissions after the fact to build a profile of you.</Item>
        </ul>
      </section>

      <section className="rise" style={{ "--i": 4 } as React.CSSProperties}>
        <H>How submissions are processed</H>
        <p className="text-[14px] leading-relaxed text-ink-soft">
          To produce a decision, your text is sent to{" "}
          <strong className="font-medium text-ink">OpenRouter</strong> and processed by the{" "}
          <strong className="font-medium text-ink">TypeSafe Jev</strong> model. Their own
          privacy policies govern that processing. As with any online tool, please do not paste
          sensitive personal details into the form.
        </p>
      </section>

      <section className="rise" style={{ "--i": 5 } as React.CSSProperties}>
        <H>Retrieval and deletion</H>
        <p className="text-[14px] leading-relaxed text-ink-soft">
          Submissions are not tied to any identity, so a specific person&apos;s data cannot be
          looked up or deleted on request — by design there is no way to connect a record back
          to the person who wrote it.
        </p>
      </section>
    </article>
  );
}
