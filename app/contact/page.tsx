"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import Navbar from "../components/Navbar";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabaseClient";

export default function ContactPage() {
  const { user, role, loading: authLoading } = useAuth();
  const [profileName, setProfileName] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);
  const [subject, setSubject] = useState("");
  const [otherSubject, setOtherSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user || role !== "customer") {
      setProfileLoading(false);
      return;
    }
    let active = true;
    supabase.from("user_accounts").select("full_name").eq("id", user.id).maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setFormError("We couldn't load your account details. Please refresh and try again.");
        else setProfileName(data?.full_name?.trim() ?? "");
        setProfileLoading(false);
      });
    return () => { active = false; };
  }, [authLoading, user?.id, role]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setSuccess("");
    if (!user || role !== "customer") return;
    setSending(true);
    const { error } = await supabase.rpc("submit_contact_message", {
      p_subject: subject || null,
      p_message: message.trim(),
      p_other_subject: subject === "Other" ? otherSubject.trim() || null : null,
    });
    if (error) setFormError(error.message);
    else {
      setSuccess("Your message has been sent to our team.");
      setSubject("");
      setOtherSubject("");
      setMessage("");
    }
    setSending(false);
  }

  return (
    <main className="min-h-screen bg-[#f7f0e7] font-sans text-[#21140b]">
      <Navbar />

      {/* Hero Banner */}
      <section className="relative w-full h-[230px] overflow-hidden">
        <Image
          src="/contactus.png"
          alt="Contact us banner"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
          quality={100}
        />
        <div className="absolute inset-0 bg-black/50" />

        <div className="relative z-10 flex h-full flex-col justify-center px-10 sm:px-14 md:px-20 max-w-[700px]">
          <div className="mb-2 flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Brewora logo"
              width={50}
              height={50}
              className="h-[50px] w-[50px] rounded-full object-cover"
            />
            <p className="text-[13px] font-extrabold uppercase tracking-[0.18em] text-white">
              Contact Us
            </p>
          </div>

          <h1 className="font-serif text-[36px] font-bold leading-[1.1] text-white">
            We&apos;d love to
          </h1>
          <h1 className="font-serif text-[36px] font-normal italic leading-[1.1] text-[#e0b15a]">
            hear from you.
          </h1>

          <p className="mt-4 text-[11px] font-semibold leading-[1.5] text-white">
            Have a question, suggestion, or just want to say hello?
            <br />
            We&apos;re here for you. Let&apos;s connect!
          </p>
        </div>
      </section>

      {/* Bottom Section */}
      <section className="bg-white px-8 py-8 sm:px-12 md:px-16">
        <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-8 md:grid-cols-[1fr_1.4fr_1.2fr]">

          {/* Left: Get In Touch */}
          <div>
            <p className="text-[12px] font-extrabold uppercase tracking-[0.2em] text-[#b16b16]">
              Get In Touch
            </p>
            <h2 className="mt-1 font-serif text-[26px] font-bold text-[#21140b]">
              Let&apos;s talk{" "}
              <span className="font-normal italic text-[#b16b16]">coffee.</span>
            </h2>
            <p className="mt-2 text-[11px] leading-[1.55] text-[#5a3e2b]">
              Whether you have a question about our beans, need help
              with an order, or want to collaborate, we&apos;re just a message
              away.
            </p>

            <div className="mt-5 flex flex-col gap-4">
              {/* Visit Us */}
              <a href="https://www.google.com/maps/search/?api=1&query=123%20Coffee%20Lane%2C%20Brew%20City%2C%20BC%2012345%2C%20Philippines" target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b16b16]">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f0e6d3]">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#b16b16]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[12px] font-bold text-[#21140b]">Visit Us</p>
                  <p className="text-[11px] text-[#5a3e2b] underline-offset-2 hover:underline">123 Coffee Lane, Brew City, BC 12345, Philippines</p>
                </div>
              </a>

              {/* Email Us */}
              <a href="https://mail.google.com/mail/?view=cm&fs=1&to=fierycristine17%40gmail.com" target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b16b16]">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f0e6d3]">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#b16b16]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[12px] font-bold text-[#21140b]">Email Us</p>
                  <p className="text-[11px] text-[#5a3e2b] underline-offset-2 hover:underline">fierycristine17@gmail.com</p>
                </div>
              </a>

              {/* Call Us */}
              <a href="tel:+639918370193" className="flex items-start gap-3 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b16b16]">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f0e6d3]">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#b16b16]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[12px] font-bold text-[#21140b]">Call Us</p>
                  <p className="text-[11px] text-[#5a3e2b] underline-offset-2 hover:underline">+63 9918370193</p>
                </div>
              </a>

              {/* Hours */}
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f0e6d3]">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#b16b16]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[12px] font-bold text-[#21140b]">Hours</p>
                  <p className="text-[11px] text-[#5a3e2b]">Mon – Sun: 7:00 AM – 9:00 PM</p>
                </div>
              </div>
            </div>
          </div>

          {/* Middle: Send Us Message Form */}
          <div>
            <p className="text-[12px] font-extrabold uppercase tracking-[0.2em] text-[#b16b16]">
              Send Us Message
            </p>

            {authLoading || profileLoading ? (
              <p className="mt-4 rounded-lg bg-[#faf6f2] p-4 text-sm text-[#7a5c44]">Loading your account details…</p>
            ) : !user ? (
              <div className="mt-4 rounded-lg border border-[#eadfd5] bg-[#fffaf5] p-4 text-sm text-[#5a3e2b]">
                Please log in with your customer account to send a message. Your registered name and email will be added automatically.
                <Link href="/login" className="mt-3 inline-flex font-bold text-[#7c4a1e] underline underline-offset-2">Log in</Link>
              </div>
            ) : role !== "customer" ? (
              <p className="mt-4 rounded-lg border border-[#eadfd5] bg-[#fffaf5] p-4 text-sm text-[#5a3e2b]">This contact form is for customer accounts. Please use a customer account to send a message.</p>
            ) : (
              <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
                {formError && <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{formError}</p>}
                {success && <p role="status" className="rounded border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">{success}</p>}
                <div>
                  <label htmlFor="contact-full-name" className="mb-1 block text-[11px] font-semibold text-[#21140b]">Full Name</label>
                  <input id="contact-full-name" type="text" value={profileName || "Customer"} readOnly required autoComplete="name" className="w-full rounded border border-[#d4c4b0] bg-[#f8f5f1] px-3 py-2 text-[12px] text-[#5a3e2b] outline-none" />
                </div>
                <div>
                  <label htmlFor="contact-email" className="mb-1 block text-[11px] font-semibold text-[#21140b]">Email Address</label>
                  <input id="contact-email" type="email" value={user.email ?? ""} readOnly required autoComplete="email" className="w-full rounded border border-[#d4c4b0] bg-[#f8f5f1] px-3 py-2 text-[12px] text-[#5a3e2b] outline-none" />
                </div>
                <div>
                  <label htmlFor="contact-subject" className="mb-1 block text-[11px] font-semibold text-[#21140b]">Subject <span className="font-normal text-[#8b7766]">(optional)</span></label>
                  <select id="contact-subject" value={subject} onChange={(event) => setSubject(event.target.value)} className="w-full rounded border border-[#d4c4b0] bg-white px-3 py-2 text-[12px] text-[#21140b] outline-none focus:border-[#b16b16] focus:ring-1 focus:ring-[#b16b16]">
                    <option value="">General inquiry</option>
                    <option value="Order support">Order support</option>
                    <option value="Menu question">Menu question</option>
                    <option value="Feedback">Feedback</option>
                    <option value="Business inquiry">Business inquiry</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                {subject === "Other" && <div>
                  <label htmlFor="contact-other-subject" className="mb-1 block text-[11px] font-semibold text-[#21140b]">What is the subject about?</label>
                  <input id="contact-other-subject" type="text" value={otherSubject} onChange={(event) => setOtherSubject(event.target.value)} maxLength={100} required placeholder="Enter a short subject" className="w-full rounded border border-[#d4c4b0] bg-white px-3 py-2 text-[12px] text-[#21140b] placeholder-[#b0a090] outline-none focus:border-[#b16b16] focus:ring-1 focus:ring-[#b16b16]" />
                </div>}
                <div>
                  <label htmlFor="contact-message" className="mb-1 block text-[11px] font-semibold text-[#21140b]">Message</label>
                  <textarea id="contact-message" value={message} onChange={(event) => setMessage(event.target.value)} rows={5} maxLength={3000} required placeholder="Tell us more..." className="w-full resize-none rounded border border-[#d4c4b0] bg-white px-3 py-2 text-[12px] text-[#21140b] placeholder-[#b0a090] outline-none focus:border-[#b16b16] focus:ring-1 focus:ring-[#b16b16]" />
                  <p className="mt-1 text-right text-[10px] text-[#9a8777]">{message.length}/3000</p>
                </div>
                <button type="submit" disabled={sending} className="mt-1 w-full rounded bg-[#b16b16] py-2.5 text-[12px] font-bold uppercase tracking-[0.15em] text-white transition-colors hover:bg-[#8f5210] disabled:cursor-not-allowed disabled:opacity-60">
                  {sending ? "Sending…" : "Send Message"}
                </button>
              </form>
            )}
          </div>

          {/* Right: Coffee Image */}
          <div className="relative min-h-[320px] overflow-hidden rounded-xl shadow-md">
            <Image
              src="/Matcha_Latte.jpg"
              alt="Matcha latte on café table"
              fill
              sizes="(min-width: 768px) 320px, 100vw"
              className="object-cover object-center"
            />
          </div>

        </div>
      </section>
    </main>
  );
}
