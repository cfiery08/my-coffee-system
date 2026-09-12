import Navbar from "../components/Navbar";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white font-sans">
      <Navbar />
      <div className="flex items-center justify-center py-32">
        <h1 className="text-3xl font-bold text-gray-800">This is about page</h1>
      </div>
    </div>
  );
}
