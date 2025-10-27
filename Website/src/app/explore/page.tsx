import { AppShell } from "@/components/app-shell";
import Image from "next/image";

export default function ExplorePage() {
  const images = Array.from({ length: 21 }, (_, i) => ({
    id: i,
    src: `https://picsum.photos/seed/${i + 100}/500/400`,
    alt: `Explore image ${i+1}`,
  }));

  return (
    <AppShell>
      <h1 className="text-3xl font-bold tracking-tight mb-8">Explore</h1>
      <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-4 space-y-4">
        {images.map(image => (
          <div key={image.id} className="break-inside-avoid">
             <Image 
                src={image.src} 
                alt={image.alt} 
                width={500}
                height={400}
                className="rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300"
                data-ai-hint="travel landscape"
              />
          </div>
        ))}
      </div>
    </AppShell>
  );
}
