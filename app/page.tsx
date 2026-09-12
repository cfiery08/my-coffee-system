import Image from "next/image";
import Navbar from "./components/Navbar";
import MenuCard from "./components/MenuCard";

const popularPicks = [
  {
    name: "Caramel Macchiato",
    desc: "Espresso, steamed milk, and sweet caramel drizzle.",
    price: "₱145.00",
    img: "/Caramel-Macchiato.jpg",
    imgPos: "50% 60%",
  },
  {
    name: "Classic Latte",
    desc: "Smooth espresso with creamy steamed milk.",
    price: "₱135.00",
    img: "/classic_latte.webp",
    imgPos: "center",
  },
  {
    name: "Mocha Frappe",
    desc: "Rich chocolate, espresso, and creamy blended ice.",
    price: "₱155.00",
    img: "/Mocha_Frappe.png",
    imgPos: "center",
  },
  {
    name: "Matcha Latte",
    desc: "Smooth espresso with creamy milk and a hint of sweetness.",
    price: "₱150.00",
    img: "/Matcha_Latte.jpg",
    imgPos: "center",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white font-sans">
      <Navbar />

      {/* Hero Section */}
      <section className="relative w-full h-[420px] overflow-hidden">
        <Image src="/homepage.png" alt="Coffee Hero" fill className="object-cover object-center" priority />
        <div className="absolute inset-0 bg-black/45" />
        <div className="absolute inset-0 flex flex-col justify-center px-16" style={{ maxWidth: "600px" }}>
          <p className="text-white italic font-light text-xl mb-1" style={{ fontFamily: "Georgia, serif" }}>
            Good days start with coffee.
          </p>
          <h1 className="text-white font-extrabold text-5xl leading-tight uppercase">
            YOUR DAILY CUP
          </h1>
          <div className="flex items-center gap-3 mb-3">
            <h1 className="font-extrabold text-5xl uppercase" style={{ color: "#d4900a" }}>
              OF COMFORT
            </h1>
            <Image src="/logo.png" alt="Logo" width={50} height={50} className="rounded-full object-cover flex-shrink-0" />
          </div>
          <p className="text-white/90 text-sm mb-6 leading-relaxed">
            Handcrafted coffee made with premium beans<br />and passion in every cup/
          </p>
          <div className="flex gap-4">
            <button style={{ backgroundColor: "#7c4a1e" }} className="hover:opacity-90 text-white text-sm font-semibold px-7 py-2.5 rounded-full transition-opacity">
              ORDER NOW
            </button>
            <button className="border border-white text-white text-sm font-semibold px-7 py-2.5 rounded-full hover:bg-white/10 transition-colors">
              VIEW MORE
            </button>
          </div>
        </div>
      </section>

      {/* Popular Picks */}
      <section className="px-10 py-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-extrabold text-gray-900 uppercase tracking-wide">Popular Picks</h2>
          <a href="#" className="text-sm font-medium text-gray-700 hover:text-amber-700 flex items-center gap-1 transition-colors">
            View All →
          </a>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {popularPicks.map((item) => (
            <MenuCard key={item.name} item={item} />
          ))}
        </div>
      </section>

    </div>
  );
}
