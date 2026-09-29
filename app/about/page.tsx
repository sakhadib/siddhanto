import type { Metadata } from "next";
import { SectionLabel } from "@/components/primitives";

export const metadata: Metadata = {
  title: "About — Siddhanto",
  description:
    "What Siddhanto is, how the numbers are meant to be read, where the model stops and the page begins, and what the recordings are for.",
};

function H({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-10 mb-3.5 font-mono text-label font-medium tracking-[0.16em] text-ink uppercase">
      {children}
    </h2>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-[15.5px] leading-relaxed text-ink-soft">{children}</p>;
}

function Item({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3 border-b border-rule py-2.5 last:border-b-0">
      <span aria-hidden className="mt-2 h-px w-3 shrink-0 bg-rule-strong" />
      <span className="text-[15.5px] leading-relaxed text-ink-soft">{children}</span>
    </li>
  );
}

export default function About() {
  return (
    <article className="mx-auto max-w-[68ch] pt-12 pb-8">
      <div className="rise">
        <SectionLabel>About</SectionLabel>
        <h1 className="mt-4 text-[clamp(1.9rem,4.4vw,2.9rem)] leading-[1.05] font-semibold tracking-tighter text-ink">
          A number is a reading of a situation, not an instruction about it.
        </h1>
      </div>

      <div
        className="rise mt-8 border-y-2 border-ink py-4"
        style={{ "--i": 1 } as React.CSSProperties}
      >
        <p className="text-lead leading-relaxed text-ink">
          Siddhanto exists because the useful part of a hard decision is usually not an answer
          but a number — a sense of how the possibilities actually divide, and how sure anyone
          can be. The page is built to give you that and then stop.
        </p>
      </div>

      <section className="rise" style={{ "--i": 2 } as React.CSSProperties}>
        <H>What you give it</H>
        <P>
          A situation written out in full, and up to ten questions about it. Each question is
          one of three shapes:
        </P>
        <ul className="mt-4">
          <Item>
            <strong className="font-medium text-ink">Statement</strong> — something to judge
            as true or false, returned as a probability.
          </Item>
          <Item>
            <strong className="font-medium text-ink">Scale</strong> — an ordered range, such
            as a 1–10 or low/medium/high, returned as an expected value.
          </Item>
          <Item>
            <strong className="font-medium text-ink">Options</strong> — a closed set of
            mutually exclusive possibilities, returned as a distribution across them.
          </Item>
        </ul>
        <P>
          If you would rather not fill that in, describe the situation in ordinary words in
          the composer and it will be turned into this form for you. Either way you read it
          and correct it before anything is decided — the drafting step answers nothing.
        </P>
      </section>

      <section className="rise" style={{ "--i": 3 } as React.CSSProperties}>
        <H>What comes back</H>
        <P>
          Numbers, drawn against the same 0–100 scale in every case, so they can be compared
          across questions. Each answer carries a confidence figure, and that figure describes
          the shape of the distribution rather than the winner. A distribution with all its
          weight on one option and one with 60/40 can both be reported as high confidence; they
          mean different things, and the second is not a near miss.
        </P>
        <P>
          Beneath the numbers there is a short written <em>Reading</em> — an interpretation of
          those specific figures, written by a separate model. It is deliberately not
          instructed to advise. It describes what the numbers lean toward, and it is not
          shown your identity, your address, or your rating.
        </P>
      </section>

      <section className="rise" style={{ "--i": 4 } as React.CSSProperties}>
        <H>Where the model ends</H>
        <P>
          It is a judgement model, not a search engine, and it is working from the situation
          you wrote and nothing else. It has not seen the contract, the listing history, the
          message thread, or anything about the world outside the state. Where a question needs
          facts the state does not contain, the honest answer is that the model is guessing
          from the shape of the words, and the number will not show you that.
        </P>
        <P>
          The same applies to the Reading. A fluent paragraph is not a source, and it should
          not be quoted back at anyone as though it were a finding.
        </P>
      </section>

      <section className="rise" style={{ "--i": 5 } as React.CSSProperties}>
        <H>Bangla</H>
        <P>
          Write in English or Bangla. Detection is a Unicode check, not a guess. When Bangla
          arrives, the whole submission is translated into English before the decision model
          sees it, and the resulting Reading is translated back. Both versions are kept, so a
          Bangla submission is stored as a usable bilingual pair. The decision model only ever
          reads English; the translation changes the language, not the judgement.
        </P>
      </section>

      <section className="rise" style={{ "--i": 6 } as React.CSSProperties}>
        <H>Why any of it is recorded</H>
        <P>
          Ratings exist so that confidence can be checked against how good the advice turned
          out to be. That is the only reason for the collection: a number nobody has ever been
          right about is worth nothing, so the figures are stored alongside a 1–5 rating and
          whatever comment you choose to add, and the Reading beside both.
        </P>
        <P>
          There are no accounts, no names, no email addresses, and no raw IP addresses — only a
          salted hash, kept to slow down abuse of the free endpoint. Nothing ties a record to
          the person who wrote it, which also means no one can be looked up or deleted on
          request, by design.
        </P>
        <P>
          The <a
            href="/privacy"
            className="text-ink underline decoration-rule-strong underline-offset-4 hover:text-signal hover:decoration-signal"
          >
            privacy and data policy
          </a>{" "}
          sets out the fields, the processing, and the retrieval limits in full.
        </P>
      </section>

      <section className="rise" style={{ "--i": 7 } as React.CSSProperties}>
        <H>The design</H>
        <P>
          Laid out like an instrument rather than a landing page: a serif-free, fixed-width
          scaffold, no gradients, no rounded cards, and rules only where they separate one
          measurement from the next. Every figure is also given as selectable text beside its
          chart, so nothing here requires a pointer, and nothing depends on a colour you might
          not distinguish.
        </P>
      </section>
    </article>
  );
}
