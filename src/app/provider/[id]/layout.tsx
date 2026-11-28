import type { Metadata, ResolvingMetadata } from "next";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

type Props = {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
};

export async function generateMetadata(
  props: { params: Promise<{ id: string }> },
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { id } = await props.params;
  const siteUrl = "https://promohbusiness.netlify.app";

  try {
    const snap = await getDoc(doc(db, "providers", id));
    if (snap.exists()) {
      const data = snap.data();
      const name =
        data.businessName ||
        `${data.firstName || ""} ${data.lastName || ""}`.trim() ||
        "Verified Professional";
      const services = data.servicesOffered || "Local Services";
      const location = data.location ? ` in ${data.location}` : "";
      const rating = data.rating ? ` (${Number(data.rating).toFixed(1)}★)` : "";
      const title = `${name}${rating} - ${services}${location} | Promoh`;
      const description =
        data.description?.slice(0, 155) ||
        `Book ${name} on Promoh for trusted ${services}${location}. 100% verified provider with customer satisfaction guarantee.`;
      const image = data.photoURL || "/logo.png";

      return {
        title,
        description,
        alternates: {
          canonical: `${siteUrl}/provider/${id}`,
        },
        openGraph: {
          title,
          description,
          url: `${siteUrl}/provider/${id}`,
          siteName: "Promoh",
          images: [
            {
              url: image,
              width: 800,
              height: 600,
              alt: `${name} on Promoh`,
            },
          ],
          type: "profile",
        },
        twitter: {
          card: "summary_large_image",
          title,
          description,
          images: [image],
        },
      };
    }
  } catch (err) {
    console.warn("Failed to generate provider metadata:", err);
  }

  return {
    title: "Service Provider Profile | Promoh",
    description: "Book verified local and online service experts on Promoh.",
  };
}

export default async function ProviderProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let jsonLd: Record<string, any> | null = null;

  try {
    const snap = await getDoc(doc(db, "providers", id));
    if (snap.exists()) {
      const data = snap.data();
      const name =
        data.businessName ||
        `${data.firstName || ""} ${data.lastName || ""}`.trim() ||
        "Professional Provider";

      jsonLd = {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        name,
        description: data.description || `${name} on Promoh`,
        image: data.photoURL || "https://promohbusiness.netlify.app/logo.png",
        telephone: data.phone || undefined,
        address: data.location
          ? {
              "@type": "PostalAddress",
              addressLocality: data.location,
            }
          : undefined,
        priceRange: data.hourlyRate ? `$${data.hourlyRate}/hr` : undefined,
        aggregateRating: data.rating
          ? {
              "@type": "AggregateRating",
              ratingValue: Number(data.rating).toFixed(1),
              reviewCount: data.reviewCount || 1,
            }
          : undefined,
      };
    }
  } catch {}

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {children}
    </>
  );
}
