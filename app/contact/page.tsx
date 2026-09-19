import Image from "next/image";
import Navbar from "../components/Navbar";

export default function ContactPage() {
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
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f0e6d3]">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#b16b16]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[12px] font-bold text-[#21140b]">Visit Us</p>
                  <p className="text-[11px] text-[#5a3e2b]">123 Coffee Lane, Brew City, BC 12345, Philippines</p>
                </div>
              </div>

              {/* Email Us */}
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f0e6d3]">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#b16b16]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[12px] font-bold text-[#21140b]">Email Us</p>
                  <p className="text-[11px] text-[#5a3e2b]">hello@breworacoffee.com</p>
                </div>
              </div>

              {/* Call Us */}
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f0e6d3]">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#b16b16]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[12px] font-bold text-[#21140b]">Call Us</p>
                  <p className="text-[11px] text-[#5a3e2b]">+63 912 345 6789</p>
                </div>
              </div>

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

            <form className="mt-4 flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-[#21140b]">Full Name</label>
                <input
                  type="text"
                  placeholder="Enter your full name"
                  className="w-full rounded border border-[#d4c4b0] bg-white px-3 py-2 text-[12px] text-[#21140b] placeholder-[#b0a090] outline-none focus:border-[#b16b16] focus:ring-1 focus:ring-[#b16b16]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-[#21140b]">Email Address</label>
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="w-full rounded border border-[#d4c4b0] bg-white px-3 py-2 text-[12px] text-[#21140b] placeholder-[#b0a090] outline-none focus:border-[#b16b16] focus:ring-1 focus:ring-[#b16b16]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-[#21140b]">Subject</label>
                <input
                  type="text"
                  placeholder="What is this about?"
                  className="w-full rounded border border-[#d4c4b0] bg-white px-3 py-2 text-[12px] text-[#21140b] placeholder-[#b0a090] outline-none focus:border-[#b16b16] focus:ring-1 focus:ring-[#b16b16]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-[#21140b]">Message</label>
                <textarea
                  rows={5}
                  placeholder="Tell us more..."
                  className="w-full rounded border border-[#d4c4b0] bg-white px-3 py-2 text-[12px] text-[#21140b] placeholder-[#b0a090] outline-none focus:border-[#b16b16] focus:ring-1 focus:ring-[#b16b16] resize-none"
                />
              </div>
              <button
                type="submit"
                className="mt-1 w-full rounded bg-[#b16b16] py-2.5 text-[12px] font-bold uppercase tracking-[0.15em] text-white transition-colors hover:bg-[#8f5210]"
              >
                Send Message
              </button>
            </form>
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
