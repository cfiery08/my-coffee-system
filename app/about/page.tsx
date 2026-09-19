import Image from "next/image";
import Navbar from "../components/Navbar";

const values = [
  {
    title: "Quality Beans",
    text: "We source premium beans from trusted growers.",
    icon: "/first2.png",
  },
  {
    title: "Expert Craftsmanship",
    text: "Every cup is carefully crafted by our skilled baristas.",
    icon: "/second2.png",
  },
  {
    title: "Made with Love",
    text: "We pour passion and care into every cup we serve.",
    icon: "/third.png",
  },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#f7f0e7] font-sans text-[#21140b]">
      <Navbar />

      <section className="relative isolate aspect-[624/161] min-h-[190px] w-full overflow-hidden md:min-h-[192px]">
        <Image
          src="/aboutusback-hd.png"
          alt="Brewora coffee bar"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-black/45" />

        <div className="relative z-10 flex h-full max-w-[746px] flex-col justify-center px-8 sm:px-12 md:px-16">
          <div className="mb-2 flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Brewora logo"
              width={55}
              height={55}
              className="h-[55px] w-[55px] rounded-full object-cover"
            />
            <p className="text-[13px] font-extrabold uppercase tracking-[0.18em] text-white">
              About Us
            </p>
          </div>

          <h1 className="max-w-[420px] font-serif text-[33px] font-bold leading-[1.12] tracking-[0.04em] text-white sm:text-[40px] md:text-[42px]">
            Brewed with{" "}
            <span className="font-normal italic tracking-normal text-[#e0b15a]">
              passion,
            </span>
            <br />
            served with{" "}
            <span className="font-normal italic tracking-normal text-[#e0b15a]">
              heart.
            </span>
          </h1>

          <p className="mt-4 max-w-[440px] text-[10px] font-semibold leading-[1.45] tracking-[0.02em] text-white sm:text-[11px]">
            At Brewora Coffee Shop, we believe that a great cup of coffee can brighten your day and
            bring people together. Every cup we serve is a blend of quality beans, expert
            craftsmanship, and genuine love for coffee.
          </p>
        </div>
      </section>

      <section className="bg-[#f7f0e7] px-6 py-7 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-[1180px] items-center gap-8 md:grid-cols-[minmax(280px,0.9fr)_minmax(330px,1fr)] lg:grid-cols-[minmax(330px,0.95fr)_minmax(360px,1fr)_minmax(250px,0.72fr)] lg:gap-10">
          <div className="relative aspect-[624/433] overflow-hidden rounded-lg shadow-[0_5px_18px_rgba(46,31,20,0.28)] ring-4 ring-white">
            <Image
              src="/aboutussec.png"
              alt="Coffee cup on a cafe table"
              fill
              sizes="(min-width: 1024px) 360px, (min-width: 768px) 45vw, 100vw"
              className="object-cover object-center"
            />
          </div>

          <div className="flex flex-col justify-center">
            <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.24em] text-[#b16b16]">
              Our Story
            </p>
            <h2 className="font-serif text-[31px] font-bold leading-[1.35] tracking-[0.05em] text-[#24150b] md:text-[34px]">
              From a small dream
              <br />
              to your{" "}
              <span className="font-normal italic tracking-normal text-[#b16b16]">
                daily ritual.
              </span>
            </h2>
            <p className="mt-5 max-w-[500px] text-[13px] leading-[1.55] tracking-[0.03em] text-[#35261d]">
              Brewora started as a small passion project with a simple goal - to create a cozy space
              where people can relax, connect, and enjoy high-quality coffee.
            </p>
            <p className="mt-4 max-w-[500px] text-[13px] leading-[1.55] tracking-[0.03em] text-[#35261d]">
              Today, we continue that tradition by sourcing the finest beans and crafting every drink
              with care, so you can experience comfort in every sip.
            </p>
          </div>

          <div className="flex flex-col justify-center gap-8 md:col-span-2 md:grid md:grid-cols-3 lg:col-span-1 lg:flex lg:grid-cols-none">
            {values.map((value) => (
              <div key={value.title} className="flex items-center gap-4">
                <div className="flex h-[66px] w-[66px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#eadcc5]">
                  <Image
                    src={value.icon}
                    alt=""
                    width={70}
                    height={84}
                    className="h-[84px] w-[70px] max-w-none object-contain"
                  />
                </div>
                <div>
                  <h3 className="text-[13px] font-extrabold leading-tight text-[#24150b]">
                    {value.title}
                  </h3>
                  <p className="mt-1.5 text-[11px] leading-[1.35] tracking-[0.02em] text-[#35261d]">
                    {value.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
