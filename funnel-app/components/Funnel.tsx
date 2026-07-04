"use client";

import { useEffect, useRef, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import CheckoutForm from "./CheckoutForm";
import {
  BASE,
  BUMPS,
  OTOS,
  baseOrderAmount,
  baseOrderLines,
  usd,
  type BumpKey,
  type OrderLine,
  type OtoKey,
} from "@/lib/products";

const PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise: Promise<Stripe | null> | null = PK ? loadStripe(PK) : null;

const GREETING =
  "Hey, I'm Maya, a sample clone built with this exact Blueprint. Ask me anything a client might ask a productivity coach, and watch how I answer. 👇";
const FALLBACK =
  "Real talk, the live demo's catching its breath for a sec. But here's the point: everything I say comes out in my voice, my phrasing, my rules. That's exactly what the Blueprint sets up for YOU. Try me again in a moment.";

type View = "sales" | "oto1" | "downsell" | "thankyou";
type ChatMsg = { role: "user" | "assistant"; text: string };

// ---- small inline icons ----
const Check = ({ s = 16, stroke = "#4B3FE4" }: { s?: number; stroke?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.4">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);
const Cross = ({ s = 16 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" strokeWidth="2.4">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

export default function Funnel() {
  const [view, setView] = useState<View>("sales");

  // modal + checkout
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [emailErr, setEmailErr] = useState(false);
  const [bumps, setBumps] = useState<Record<BumpKey, boolean>>({ voice: false, content: false });

  // order + purchase state
  const [order, setOrder] = useState<OrderLine[]>([]);
  const [buyerName, setBuyerName] = useState("");
  const [purchase, setPurchase] = useState<{ customerId: string; paymentMethodId: string } | null>(null);

  // OTO
  const [otoBusy, setOtoBusy] = useState(false);
  const [otoError, setOtoError] = useState<string | null>(null);

  // Maya demo
  const [chat, setChat] = useState<ChatMsg[]>([{ role: "assistant", text: GREETING }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const amount = baseOrderAmount(bumps);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat, loading]);

  // esc closes modal
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && modalOpen) closeModal();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modalOpen]);

  function switchView(v: View) {
    setView(v);
    window.scrollTo(0, 0);
  }

  // ---- modal ----
  function openModal() {
    setModalOpen(true);
    setStep(1);
    document.body.style.overflow = "hidden";
  }
  function closeModal() {
    setModalOpen(false);
    document.body.style.overflow = "";
  }
  function goStep2() {
    if (!email || email.indexOf("@") < 1) {
      setEmailErr(true);
      return;
    }
    setEmailErr(false);
    setBuyerName(name.trim());
    // Fire-and-forget email capture before payment (abandoned-cart safe).
    fetch("/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), email }),
    }).catch(() => {});
    setStep(2);
  }

  function handlePaid(result: { customerId: string; paymentMethodId: string }) {
    setPurchase(result);
    setOrder(baseOrderLines(bumps));
    closeModal();
    switchView("oto1");
  }

  // ---- one-click OTO ----
  async function acceptOto(product: OtoKey) {
    if (!purchase) return;
    setOtoBusy(true);
    setOtoError(null);
    try {
      const res = await fetch("/api/oto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: purchase.customerId,
          paymentMethodId: purchase.paymentMethodId,
          product,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Charge failed.");
      setOrder((o) => [...o, data.line as OrderLine]);
      switchView("thankyou");
    } catch (err) {
      setOtoError(err instanceof Error ? err.message : "Charge failed.");
    } finally {
      setOtoBusy(false);
    }
  }

  // ---- Maya demo ----
  async function sendDemo() {
    const text = input.trim();
    if (!text || loading) return;
    const next: ChatMsg[] = [...chat, { role: "user", text }];
    setChat(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/maya", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.slice(1).map((m) => ({ role: m.role, content: m.text })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.reply) throw new Error("bad");
      setChat((c) => [...c, { role: "assistant", text: data.reply }]);
    } catch {
      setChat((c) => [...c, { role: "assistant", text: FALLBACK }]);
    } finally {
      setLoading(false);
    }
  }

  const orderTotal = order.reduce((s, l) => s + l.price, 0);

  return (
    <>
      <header>
        <div className="wrap bar">
          <div className="wordmark">
            <span className="dot" />
            THE CLONE BLUEPRINT
          </div>
          <div className="tag">$27 · instant access</div>
        </div>
      </header>

      {/* ===== VIEW 1: SALES ===== */}
      {view === "sales" && (
        <div className="view active">
          {/* HERO */}
          <section className="wrap hero">
            <div>
              <div className="eyebrow">For coaches · consultants · creators</div>
              <p
                style={{
                  maxWidth: "42ch",
                  color: "var(--ink-soft)",
                  fontSize: "1rem",
                  lineHeight: 1.5,
                  marginBottom: 16,
                }}
              >
                You&apos;ve seen the &quot;AI clones&quot; that sound like a robot reading your notes.
                This is how you build one that actually sounds like you.
              </p>
              <h1>
                Clone your voice into an AI that <em>answers exactly like you.</em>
              </h1>
              <p className="sub">
                Fill in one blueprint, drop in a few pieces of your content, and you&apos;ll be
                talking to an AI version of yourself in <b>under an hour</b>, one that uses your
                phrases, your rules, your tone. <b>No code. No tech background.</b>
              </p>
              <button className="cta" onClick={openModal}>
                Get the Blueprint <span className="price">$27</span>
              </button>
              <div className="anchor">
                <s>$298 value</s> · <b>today just $27</b> · instant access · under an hour
              </div>
            </div>
            <div>
              <div className="chatcard">
                <div className="stamp">try it live</div>
                <div className="chathead">
                  <div className="avatar">M</div>
                  <div>
                    <div className="who">Maya · a sample AI clone</div>
                    <div className="status">
                      <span className="pulse" />
                      answers in her real voice
                    </div>
                  </div>
                </div>
                <div className="demo-scroll" ref={scrollRef}>
                  {chat.map((m, i) => (
                    <div key={i} className={"msg " + (m.role === "user" ? "them" : "you")}>
                      {m.text}
                    </div>
                  ))}
                  {loading && (
                    <div className="msg you typing">
                      <span />
                      <span />
                      <span />
                    </div>
                  )}
                </div>
                <div className="demo-input-row">
                  <input
                    type="text"
                    placeholder="Ask Maya something…"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") sendDemo();
                    }}
                  />
                  <button className="demo-send" onClick={sendDemo} disabled={loading}>
                    Send
                  </button>
                </div>
                <p className="demo-hint">
                  This is a real AI clone. Yours would sound like <b>you</b>. That&apos;s what the
                  Blueprint sets up.
                </p>
              </div>
            </div>
          </section>

          {/* FOR YOU IF */}
          <section className="band foryou">
            <div className="wrap">
              <div className="section-eyebrow">This is for you if…</div>
              <div className="foryou-grid">
                <div className="foryou-item">
                  <div className="ic">
                    <Check />
                  </div>
                  <p>
                    You answer the <b>same questions from your audience</b> over and over, and wish
                    they could just get &quot;you&quot; on demand.
                  </p>
                </div>
                <div className="foryou-item">
                  <div className="ic">
                    <Check />
                  </div>
                  <p>
                    You&apos;ve tried a custom GPT and it came out <b>robotic and generic</b>,
                    nothing like the way you actually talk.
                  </p>
                </div>
                <div className="foryou-item">
                  <div className="ic">
                    <Check />
                  </div>
                  <p>
                    You want to give your audience or clients <b>access to your thinking 24/7</b>{" "}
                    without being on call yourself.
                  </p>
                </div>
                <div className="foryou-item">
                  <div className="ic">
                    <Check />
                  </div>
                  <p>
                    You&apos;re <b>not technical</b>, and every &quot;build an AI&quot; tutorial lost
                    you somewhere around step three.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* STORY / PROOF */}
          <section className="band story">
            <div className="narrow">
              <div className="section-eyebrow kick">How I know this works</div>
              <h2>The first AI version of myself I built was terrible.</h2>
              <div className="steps">
                <div className="step-row">
                  <div className="num">1</div>
                  <p>
                    I did what everyone does: dumped my docs into a custom GPT and asked it a
                    question. It gave me a technically-correct answer that sounded like a stranger
                    reading my notes. Nothing like me. I almost wrote the whole idea off.
                  </p>
                </div>
                <div className="step-row">
                  <div className="num">2</div>
                  <p>
                    Then it clicked: the tool had my information, but nobody had ever given it my{" "}
                    <b>voice</b>, my phrases, my rules, how I actually open an answer. So I built a
                    way to capture that first, before any content went in.
                  </p>
                </div>
                <div className="step-row">
                  <div className="num">3</div>
                  <p>
                    The difference was night and day. So I did it for a coach, trained on how she
                    actually talks. Her members started asking it questions between calls, and
                    couldn&apos;t tell it wasn&apos;t her.
                  </p>
                </div>
                <div className="step-row">
                  <div className="num">4</div>
                  <p>
                    That whole voice-capture part? It fits on <b>one page</b>. That page is the
                    Blueprint you&apos;re getting.
                  </p>
                </div>
              </div>
              <p
                style={{
                  textAlign: "center",
                  color: "#9A9BC0",
                  fontSize: ".9rem",
                  marginTop: 30,
                  fontFamily: "'JetBrains Mono',monospace",
                }}
              >
                I build production AI systems for businesses, the kind agencies charge $15k+ for.
                This is the stripped-down, do-it-yourself version of the very first thing I set up.
              </p>
            </div>
          </section>

          {/* CASE STUDIES */}
          <section className="band" style={{ background: "var(--porcelain)" }}>
            <div className="wrap">
              <div className="section-eyebrow">Two people who built one</div>

              {/* Case 1 — testimonial screenshot 1 (Victoria / HS) */}
              <div className="case">
                <div className="case-body">
                  <div className="ctag">Clone yourself</div>
                  <h3>She runs a sales coaching community. The questions were eating her business.</h3>
                  <p>
                    Her students loved having access to her, which was exactly the problem. She spent
                    her days answering the same sales questions over and over, and there was no time
                    left to actually <b>run the business</b> she&apos;d built.
                  </p>
                  <p>
                    So she built an AI version of herself, trained on how she coaches. It now handles
                    the bulk of those questions, in her voice, so students still get &quot;her&quot;
                    any time, and she got her days back to work <b>on</b> the business instead of
                    buried in the inbox.
                  </p>
                  <p className="said">&quot;It&apos;s literally me in a chat.&quot;</p>
                  <div className="attrib2">Sales coach · shared with permission, name withheld by request</div>
                </div>
                <div className="case-shot">
                  <div className="receipt">✓ real message</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/assets/vicky-testimonial.png"
                    alt="Client message: Love it, it really elevated my sales coaching business. It takes me out of answering the same questions; the AI handles them, and it's literally me in a chat."
                  />
                </div>
              </div>

              {/* Case 2 — testimonial screenshot 2 (orange avatar) */}
              <div className="case rev">
                <div className="case-body">
                  <div className="ctag">Clone your company&apos;s knowledge</div>
                  <h3>They wanted one source of truth for the whole business.</h3>
                  <p>
                    A coaching company with a growing team wanted an AI that had{" "}
                    <b>fully ingested how the business works</b>, so anyone could go to it as the
                    single source of truth instead of chasing down answers across docs, people, and
                    Slack threads.
                  </p>
                  <p>
                    Once it was built, the whole team started leaning on it every day. It knows the
                    business, so it answers like the business, and it took the &quot;where do I find
                    this?&quot; friction out of the day-to-day.
                  </p>
                  <p className="said">
                    &quot;It&apos;s ingested the knowledge of our entire company, and they&apos;re
                    blown away by it.&quot;
                  </p>
                  <div className="attrib2">
                    Coaching business owner · shared with permission, name withheld by request
                  </div>
                </div>
                <div className="case-shot">
                  <div className="receipt">✓ real message</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/assets/liz-testimonial.png"
                    alt="Client message: This is absolutely amazing! It's ingested the knowledge of our entire company, all of my employees are currently using it rigorously every day and they're blown away by it. Thanks a lot!"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* WHY DIFFERENT */}
          <section className="band">
            <div className="wrap">
              <h2 className="h2">
                Why yours sounds like a robot, and this <em>won&apos;t.</em>
              </h2>
              <p className="lead">
                Every tool starts with your <b>documents</b> and hopes a voice appears. It never
                does. The Blueprint starts with <b>you</b> (the way you&apos;d actually answer a
                client at 9pm) before a single file gets uploaded. That&apos;s the whole difference.
              </p>
              <div className="compare">
                <div className="col old">
                  <div className="clab">The old way</div>
                  <h3>Upload &amp; pray</h3>
                  <ul>
                    <li>
                      <Cross /> Dump PDFs into a custom GPT
                    </li>
                    <li>
                      <Cross /> It skims them and answers like plain ChatGPT
                    </li>
                    <li>
                      <Cross /> Sounds nothing like you
                    </li>
                    <li>
                      <Cross /> Endless tweaking, then you give up
                    </li>
                  </ul>
                </div>
                <div className="col new">
                  <div className="clab">The Blueprint way</div>
                  <h3>Voice first</h3>
                  <ul>
                    <li>
                      <Check stroke="#fff" /> Fill in the voice blueprint (15 min)
                    </li>
                    <li>
                      <Check stroke="#fff" /> Paste it in, add a little content
                    </li>
                    <li>
                      <Check stroke="#fff" /> Talk to an AI that sounds like you
                    </li>
                    <li>
                      <Check stroke="#fff" /> Done in under an hour
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* MECHANISM */}
          <section className="band" style={{ background: "var(--porcelain)" }}>
            <div className="wrap">
              <h2 className="h2">
                How it works: <em>three steps, under 30 minutes.</em>
              </h2>
              <p className="lead">No setup, no accounts to wire together, no code. Just this:</p>
              <div className="mech-steps">
                <div className="mech-step">
                  <div className="mnum">1</div>
                  <h3>Fill in the Blueprint</h3>
                  <p>
                    Answer the prompts that capture how you actually talk: your phrases, your rules,
                    how you open an answer.
                  </p>
                  <span className="time">~15 min</span>
                </div>
                <div className="mech-step">
                  <div className="mnum">2</div>
                  <h3>Paste it in, add content</h3>
                  <p>
                    Drop your finished Blueprint into the setup, add a few pieces of your own content.
                    It&apos;s live.
                  </p>
                  <span className="time">~10 min</span>
                </div>
                <div className="mech-step">
                  <div className="mnum">3</div>
                  <h3>Test it &amp; share</h3>
                  <p>
                    Run the 10 test questions to prove it sounds like you, then send the link to
                    anyone.
                  </p>
                  <span className="time">~5 min</span>
                </div>
              </div>
              <p className="mech-total">
                That&apos;s it. <em>A working AI version of you</em>, before lunch.
              </p>
            </div>
          </section>

          {/* WHAT YOU GET */}
          <section
            className="band"
            style={{
              background: "var(--white)",
              borderTop: "1px solid var(--line)",
              borderBottom: "1px solid var(--line)",
            }}
          >
            <div className="wrap">
              <h2 className="h2">What&apos;s inside the kit</h2>
              <p className="lead">
                Three things. That&apos;s it. Enough to get a working clone that sounds like you, not
                a course you&apos;ll never finish.
              </p>
              <div className="grid3">
                <div className="item">
                  <div className="n">01</div>
                  <h3>The Voice Blueprint</h3>
                  <ul>
                    <li>The fill-in prompts that capture your voice</li>
                    <li>Your signature phrases &amp; &quot;never-say&quot; list</li>
                    <li>How you open, answer, and close</li>
                  </ul>
                </div>
                <div className="item">
                  <div className="n">02</div>
                  <h3>The Instant Setup</h3>
                  <ul>
                    <li>Paste your blueprint in, it&apos;s live</li>
                    <li>The &quot;what content to add first&quot; picker</li>
                    <li>Nothing to configure or wire up</li>
                  </ul>
                </div>
                <div className="item">
                  <div className="n">03</div>
                  <h3>The 20-min Walkthrough</h3>
                  <ul>
                    <li>One screen-share, blank page to done</li>
                    <li>Follow along once, that&apos;s the build</li>
                    <li>The 10 test questions to prove it</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* VALUE STACK */}
          <section className="band">
            <div className="wrap">
              <h2 className="h2">Everything you get today</h2>
              <div className="stackbox" style={{ marginTop: 34 }}>
                <div className="srow">
                  <span>The Voice Blueprint (fill-in kit)</span>
                  <span>$97</span>
                </div>
                <div className="srow">
                  <span>The Instant Setup + 20-min walkthrough</span>
                  <span>$67</span>
                </div>
                <div className="stackdiv">Free bonuses included today</div>
                <div className="srow bonus">
                  <span>The Voice-Capture Prompt</span>
                  <span>$39</span>
                </div>
                <div className="srow bonus">
                  <span>The Clone Test Kit: 10 questions</span>
                  <span>$29</span>
                </div>
                <div className="srow bonus">
                  <span>3 Done-For-You Example Personas</span>
                  <span>$47</span>
                </div>
                <div className="srow bonus">
                  <span>The 1-Page Quick-Start Checklist</span>
                  <span>$19</span>
                </div>
                <div className="tot">
                  <span>Total value</span>
                  <span>$298</span>
                </div>
                <div className="anchorbar">
                  <div className="today">
                    <s>$298</s>$27
                  </div>
                  <div className="mono" style={{ color: "var(--ink-soft)", fontSize: ".82rem" }}>
                    one-time · you save $271 today
                  </div>
                  <div
                    className="mono"
                    style={{ color: "var(--red)", fontSize: ".82rem", marginTop: 6 }}
                  >
                    Launch price. Goes to $47 after launch week.
                  </div>
                </div>
                <button className="cta" onClick={openModal}>
                  Get the Blueprint <span className="price">$27</span>
                </button>
              </div>
            </div>
          </section>

          {/* GUARANTEE */}
          <section className="band" style={{ paddingTop: 0 }}>
            <div className="wrap">
              <div className="guarantee">
                <div className="shield">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4B3FE4" strokeWidth="2">
                    <path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-4z" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                </div>
                <div>
                  <h3>Talk to AI-you within 60 minutes, or don&apos;t pay.</h3>
                  <p>
                    Open the Blueprint and follow it. If you don&apos;t have an AI that sounds like
                    you inside an hour, email me for a full refund, and keep the kit anyway. The risk
                    is mine.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section className="band" style={{ background: "var(--white)", borderTop: "1px solid var(--line)" }}>
            <div className="wrap">
              <h2 className="h2">Questions</h2>
              <div className="faq" style={{ marginTop: 30 }}>
                <div className="qa">
                  <div className="q">Do I need to know how to code?</div>
                  <div className="a">
                    No. If you can fill in a document and copy-paste, you can build this. That&apos;s
                    the whole point.
                  </div>
                </div>
                <div className="qa">
                  <div className="q">How long does it actually take?</div>
                  <div className="a">
                    Under an hour, start to finish, following the walkthrough. Most of that is you
                    filling in the voice blueprint.
                  </div>
                </div>
                <div className="qa">
                  <div className="q">What if I don&apos;t have much content?</div>
                  <div className="a">
                    You only need a handful of pieces: a few posts, a talk, the answers you give most.
                    The voice layer does the heavy lifting, not the volume.
                  </div>
                </div>
                <div className="qa warn">
                  <div className="q">Who should NOT buy this?</div>
                  <div className="a">
                    If you want a fully production-grade AI trained on your entire body of work,
                    deployed on your own infrastructure with airtight accuracy, this isn&apos;t that,
                    and I don&apos;t want you disappointed. This is the fast, working{" "}
                    <em>first version</em> that sounds like you. (The full production build is a
                    separate, much bigger thing.)
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* FINAL CTA */}
          <section className="wrap final">
            <h2>Talk to AI-you tonight.</h2>
            <button className="cta" onClick={openModal}>
              Get the Blueprint <span className="price">$27</span>
            </button>
            <div className="anchor">
              <s>$298 value</s> · <b>today just $27</b> · you save $271
            </div>
          </section>

          <footer>
            <div className="wrap">
              <p>
                You&apos;re buying a build kit, not an income promise. Just the fastest way to a
                working clone of your voice.
              </p>
            </div>
          </footer>
        </div>
      )}

      {/* ===== VIEW 2: OTO 1 ===== */}
      {view === "oto1" && (
        <div className="view active">
          <section className="wrap oto">
            <div className="flag">One-time offer · you won&apos;t see this again</div>
            <h2>
              Wait, your clone works. Want it <em>live on your website</em> in 20 minutes?
            </h2>
            <p className="o-lede">
              Right now your clone lives inside a tool. The Deploy Kit gives you the exact copy-paste
              steps to embed it on your own site, so your audience can actually talk to it, today, on
              your domain.
            </p>
            <div className="otocard">
              <div className="price-lg">
                {usd(OTOS["deploy-kit"].price)} <small>one-time · add with one click</small>
              </div>
              <ul>
                <li>
                  <Check s={18} /> The embed snippet + step-by-step placement guide
                </li>
                <li>
                  <Check s={18} /> Where to put it so it gets used, not buried
                </li>
                <li>
                  <Check s={18} /> A capture prompt so it collects emails while it chats
                </li>
              </ul>
              <button
                className="btn btn-yes"
                onClick={() => acceptOto("deploy-kit")}
                disabled={otoBusy}
              >
                {otoBusy ? "Adding…" : `Yes, add the Deploy Kit (${usd(OTOS["deploy-kit"].price)})`}
              </button>
              <div className="oneclick">🔒 One click, your card is already on file</div>
              {otoError && <p className="merror">{otoError}</p>}
              <button
                className="decline"
                onClick={() => {
                  setOtoError(null);
                  switchView("downsell");
                }}
              >
                No thanks, I&apos;ll keep it simple
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ===== VIEW 3: DOWNSELL ===== */}
      {view === "downsell" && (
        <div className="view active">
          <section className="wrap oto">
            <div className="flag">Last chance</div>
            <h2>
              No problem, want just the <em>embed snippet?</em>
            </h2>
            <p className="o-lede">
              If the full Deploy Kit is more than you need, grab the bare snippet + a one-page
              placement guide. Enough to get your clone onto your site, minus the extras.
            </p>
            <div className="otocard">
              <div className="price-lg">
                {usd(OTOS["deploy-lite"].price)} <small>one-time · add with one click</small>
              </div>
              <ul>
                <li>
                  <Check s={18} /> The embed snippet
                </li>
                <li>
                  <Check s={18} /> A one-page &quot;where to place it&quot; guide
                </li>
              </ul>
              <button
                className="btn btn-yes"
                onClick={() => acceptOto("deploy-lite")}
                disabled={otoBusy}
              >
                {otoBusy ? "Adding…" : `Add Deploy Lite (${usd(OTOS["deploy-lite"].price)})`}
              </button>
              {otoError && <p className="merror">{otoError}</p>}
              <button className="decline" onClick={() => switchView("thankyou")}>
                No thanks, take me to my kit
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ===== VIEW 4: THANK YOU ===== */}
      {view === "thankyou" && (
        <div className="view active">
          <section className="narrow ty">
            <div className="check">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <h2>
              {buyerName ? `You're in, ${buyerName}. Your clone is ready to build.` : "You're in. Your clone is ready to build."}
            </h2>
            <p className="t-lede">
              Everything&apos;s below. Start with the walkthrough, you&apos;ll be talking to AI-you
              before you finish your coffee.
            </p>
            <div className="video">
              <div className="play">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <div className="vlabel">▶ Your 20-minute walkthrough</div>
            </div>
            <p className="vcap">(In production the training Loom sits right here, no members&apos; area.)</p>
            <div className="orderbox">
              <div className="oh">Your order</div>
              <div>
                {order.map((l, i) => (
                  <div className="row" key={i}>
                    <span>{l.name}</span>
                    <span className="mono">{usd(l.price)}</span>
                  </div>
                ))}
                <div
                  className="row total"
                  style={{ borderTop: "1px solid var(--line)", paddingTop: 12, marginTop: 6 }}
                >
                  <span>Total paid</span>
                  <span className="mono">{usd(orderTotal)}</span>
                </div>
              </div>
            </div>
            <div className="bridge">
              <div className="kick">One honest heads-up before you build</div>
              <h3>
                Your clone is going to feel great, and then you&apos;ll <em>hit its ceiling.</em>
              </h3>
              <p>
                That&apos;s not you doing it wrong. It&apos;s where the toy ends and the real system
                begins. The version you&apos;re about to build will start to show its edges:
              </p>
              <div className="walls">
                <span className="wall">it makes things up</span>
                <span className="wall">won&apos;t hold all your content</span>
                <span className="wall">you don&apos;t really own it</span>
                <span className="wall">stuck inside a tool</span>
              </div>
              <p>
                When you&apos;re ready to build the <b>production</b> version (accurate, trained on
                everything you&apos;ve made, deployed on infrastructure you own), that&apos;s the full
                AI Clone Course.
              </p>
              <button
                className="cta"
                style={{ marginTop: 20 }}
                onClick={() => alert("In production this links to the AI Clone Course VSL ($297 to $497).")}
              >
                See the production system →
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ORDER MODAL */}
      <div
        className={"overlay" + (modalOpen ? " open" : "")}
        role="dialog"
        aria-modal="true"
        onClick={(e) => {
          if (e.target === e.currentTarget) closeModal();
        }}
      >
        <div className="modal">
          <div className="mhead">
            <span className="step">
              {step === 1 ? "Step 1 of 2 · Your details" : "Step 2 of 2 · Checkout"}
            </span>
            <button className="x" onClick={closeModal} aria-label="Close">
              ×
            </button>
          </div>

          {step === 1 && (
            <div className="mbody">
              <h4>Where should we send it?</h4>
              <p className="m-lede">Instant access. You&apos;ll be building within minutes.</p>
              <label className="fld">
                Your name
                <input
                  type="text"
                  placeholder="Jane Doe"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="fld">
                Email
                <input
                  type="email"
                  placeholder="you@email.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={emailErr ? { borderColor: "#c0392b" } : undefined}
                />
              </label>
              <button className="btn" onClick={goStep2}>
                Continue →
              </button>
              <p className="mnote">🔒 Secure checkout · never submit passwords</p>
            </div>
          )}

          {step === 2 && (
            <div className="mbody">
              <button className="back" onClick={() => setStep(1)}>
                ← back
              </button>
              <h4>Complete your order</h4>
              <p className="m-lede">Two quick add-ons most people grab. Check any that help.</p>

              <label className="bump">
                <input
                  type="checkbox"
                  checked={bumps.voice}
                  onChange={(e) => setBumps((b) => ({ ...b, voice: e.target.checked }))}
                />
                <span>
                  <span className="bt">
                    The &quot;Sounds Exactly Like Me&quot; Voice Upgrade{" "}
                    <span>+{usd(BUMPS.voice.price)}</span>
                  </span>
                  <span className="bd">
                    Advanced calibration prompts that take the clone from &quot;close&quot; to eerily
                    on. Kills the robotic edge before it starts.
                  </span>
                </span>
              </label>

              <label className="bump">
                <input
                  type="checkbox"
                  checked={bumps.content}
                  onChange={(e) => setBumps((b) => ({ ...b, content: e.target.checked }))}
                />
                <span>
                  <span className="bt">
                    The &quot;What to Feed It First&quot; Content Pack{" "}
                    <span>+{usd(BUMPS.content.price)}</span>
                  </span>
                  <span className="bd">
                    Done-for-you checklist + templates for choosing and prepping your starter content,
                    so it&apos;s sharp from message one.
                  </span>
                </span>
              </label>

              <div className="summary">
                <div className="row">
                  <span>{BASE.name}</span>
                  <span className="mono">{usd(BASE.price)}</span>
                </div>
                {bumps.voice && (
                  <div className="row">
                    <span>Voice Upgrade</span>
                    <span className="mono">{usd(BUMPS.voice.price)}</span>
                  </div>
                )}
                {bumps.content && (
                  <div className="row">
                    <span>Content Pack</span>
                    <span className="mono">{usd(BUMPS.content.price)}</span>
                  </div>
                )}
                <div className="row total">
                  <span>Total</span>
                  <span className="mono">{usd(amount)}</span>
                </div>
              </div>

              {stripePromise ? (
                <Elements
                  stripe={stripePromise}
                  options={{
                    mode: "payment",
                    amount,
                    currency: "usd",
                    appearance: {
                      variables: {
                        colorPrimary: "#4B3FE4",
                        fontFamily: "Inter, system-ui, sans-serif",
                        borderRadius: "11px",
                      },
                    },
                  }}
                >
                  <CheckoutForm email={email} name={name} bumps={bumps} amount={amount} onPaid={handlePaid} />
                </Elements>
              ) : (
                <p className="merror">
                  Stripe is not configured. Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY and
                  STRIPE_SECRET_KEY to .env.local to enable checkout.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
