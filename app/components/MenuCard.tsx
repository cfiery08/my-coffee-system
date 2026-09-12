import Image from "next/image";

type MenuItem = {
  name: string;
  desc: string;
  price: string;
  img: string;
  imgPos?: string;
};

export default function MenuCard({ item }: { item: MenuItem }) {
  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 hover:shadow-lg transition-shadow flex flex-col overflow-hidden">
      <div className="relative w-full overflow-hidden" style={{ height: "180px" }}>
        <Image
          src={item.img}
          alt={item.name}
          fill
          sizes="(max-width: 768px) 50vw, 25vw"
          className="object-cover"
          style={{ objectPosition: item.imgPos ?? "center" }}
        />
      </div>
      <div className="flex flex-col flex-1 p-3 gap-1">
        <h3 className="font-bold text-gray-900 text-sm leading-snug">{item.name}</h3>
        <p className="text-gray-500 text-xs leading-snug flex-1">{item.desc}</p>
        <div className="flex items-center justify-between mt-2">
          <span className="font-bold text-gray-900 text-sm">{item.price}</span>
          <button className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-700 border border-amber-700 text-white hover:bg-amber-800 transition-colors flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
