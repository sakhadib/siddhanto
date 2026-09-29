import type { Metadata } from "next";
import { SectionLabel } from "@/components/primitives";

export const metadata: Metadata = {
  title: "Privacy & data policy — Siddhanto",
  description:
    "What Siddhanto records, what it does not, and how submissions are processed by the decision model.",
};

function H({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-10 mb-3.5 font-mono text-label font-medium tracking-[0.16em] text-ink uppercase">
      {children}
    </h2>
  );
}

function Item({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3 border-b border-rule py-2.5 last:border-b-0">
      <span aria-hidden className="mt-2 h-px w-3 shrink-0 bg-rule-strong" />
      <span className="text-[15.5px] leading-relaxed text-ink-soft">{children}</span>
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
        <p className="text-lead leading-relaxed text-ink">
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
            The generated <strong className="font-medium text-ink">Reading</strong> — the
            written interpretation of those numbers, and the figures it was written from.
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
        <H>Ratings and written notes</H>
        <p className="text-[15.5px] leading-relaxed text-ink-soft">
          If you choose to rate a response, the following is stored alongside it:
        </p>
        <ul className="mt-3">
          <Item>
            Your <strong className="font-medium text-ink">1–5 usefulness score</strong>, and
            how long the response was on screen before you rated it.
          </Item>
          <Item>
            Any <strong className="font-medium text-ink">written note</strong> you choose to
            add. This is free text you type, it is not screened before it is stored, and it
            may be quoted in aggregate research. Please do not include personal details in
            it.
          </Item>
          <Item>
            Figures describing the response itself — the model build, the question types, the
            model&apos;s own confidence and the highest probability it returned. These are
            calculated on our server, not sent by your browser.
          </Item>
        </ul>
        <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">
          Rating is entirely optional and the response is unaffected if you skip it. There is
          at most one rating per response, and re-rating replaces it.
        </p>
      </section>

      <section className="rise" style={{ "--i": 4 } as React.CSSProperties}>
        <H>What is not collected</H>
        <ul>
          <Item>No accounts, names, email addresses or passwords.</Item>
          <Item>No raw IP addresses — only the hash described above.</Item>
          <Item>No tracking pixels, advertising networks or cross-site trackers.</Item>
          <Item>No reading of submissions after the fact to build a profile of you.</Item>
          <Item>
            No record of what you typed into the composer, unless you go on to submit the form
            it drafted.
          </Item>
        </ul>
      </section>

      <section className="rise" style={{ "--i": 5 } as React.CSSProperties}>
        <H>How submissions are processed</H>
        <p className="text-[15.5px] leading-relaxed text-ink-soft">
          To produce a decision, your text is sent to{" "}
          <strong className="font-medium text-ink">OpenRouter</strong> and processed by the{" "}
          <strong className="font-medium text-ink">TypeSafe Jev</strong> model. Their own
          privacy policies govern that processing. As with any online tool, please do not paste
          sensitive personal details into the form.
        </p>
        <p className="mt-4 text-[15.5px] leading-relaxed text-ink-soft">
          If you describe your situation in words instead of filling the form, the same second
          model reads that description first and drafts a form from it. It receives only what
          you typed in the composer, and it is instructed to produce questions rather than
          answers. What you type there is <em>not</em> stored: a draft is scratch work, and
          nothing is recorded until you press Decide and submit the form it produced.
        </p>
        <p className="mt-4 text-[15.5px] leading-relaxed text-ink-soft">
          If you write in Bangla, that same second model translates your submission into
          English before the decision model reads it, and translates the resulting <em>Reading
          </em> back into Bangla. Both the English the model read and your original Bangla are
          stored together, so a non-English submission is kept as a usable bilingual pair. The
          translation does not change what is decided: the decision model only ever sees the
          English version.
        </p>
        <p className="mt-4 text-[15.5px] leading-relaxed text-ink-soft">
          The written <em>Reading</em> shown beneath the results is produced by a{" "}
          <strong className="font-medium text-ink">second, separate language model</strong>{" "}
          through OpenRouter. It receives the situation you wrote, your queries, and the
          numeric output above, and it writes a short interpretation of those numbers. We do
          not publish which model that is. It is given instructions to interpret rather than
          advise, and it is not shown your identity, your IP address, or your rating.
        </p>
        <p className="mt-4 text-[15.5px] leading-relaxed text-ink-soft">
          That generated text is stored against your decision, together with the figures it was
          written from, so we can study whether the reading is useful and whether it stays
          consistent with the numbers. It may be quoted in aggregate research.
        </p>
      </section>

      <section className="rise" style={{ "--i": 6 } as React.CSSProperties}>
        <H>Retrieval and deletion</H>
        <p className="text-[15.5px] leading-relaxed text-ink-soft">
          Submissions are not tied to any identity, so a specific person&apos;s data cannot be
          looked up or deleted on request — by design there is no way to connect a record back
          to the person who wrote it.
        </p>
      </section>
    </article>
  );
}
