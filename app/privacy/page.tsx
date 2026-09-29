export default function Privacy() {
  return (
    <article className="mx-auto max-w-xl space-y-4 text-sm leading-relaxed text-zinc-600">
      <h2 className="text-xl font-bold text-zinc-900">Privacy &amp; Data Policy</h2>

      <p className="rounded-xl border border-zinc-200 bg-white p-4 text-zinc-700 shadow-sm">
        <strong>The short version:</strong> we collect <em>what you type</em>, not{" "}
        <em>who you are</em>. Siddhanto has no accounts, no names, no emails — your
        submissions are stored anonymously and used to study how people ask decision
        questions.
      </p>

      <h3 className="pt-2 font-semibold text-zinc-900">What we collect</h3>
      <ul className="list-disc space-y-1 pl-5">
        <li>The <strong>state</strong> text and <strong>questions</strong> you submit,
          along with the options/criteria you define.</li>
        <li>The <strong>decisions</strong> the model returns (probabilities, choices, scores).</li>
        <li>Basic technical metadata: browser type, referring page, and time spent on the form.</li>
      </ul>

      <h3 className="pt-2 font-semibold text-zinc-900">What we don&apos;t collect</h3>
      <ul className="list-disc space-y-1 pl-5">
        <li>No accounts, names, email addresses, or passwords — we have no way to know who you are.</li>
        <li>Your IP address is only stored as a <strong>one-way hash</strong>; we never keep the raw address.</li>
        <li>No tracking pixels, ad networks, or cross-site trackers.</li>
      </ul>

      <h3 className="pt-2 font-semibold text-zinc-900">How submissions are processed</h3>
      <p>
        To produce decisions, your text is sent to <strong>OpenRouter</strong> and processed by
        the <strong>TypeSafe Jev</strong> model. Their privacy policies apply to that processing.
        As with any online tool, please don&apos;t paste sensitive personal details into the form.
      </p>

      <h3 className="pt-2 font-semibold text-zinc-900">Questions?</h3>
      <p>
        Because submissions aren&apos;t tied to any identity, we can&apos;t look up or delete
        a specific person&apos;s data — by design, there is no way to connect a submission
        back to you.
      </p>
    </article>
  );
}
