import type { MetadataRoute } from "next";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://promohbusiness.netlify.app";
  const now = new Date();

  // Core static marketing and public discovery routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/search`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/online-jobs`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/register/provider`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/register/customer`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  // Dynamically include active approved providers for search indexing
  let providerRoutes: MetadataRoute.Sitemap = [];
  try {
    const q = query(
      collection(db, "providers"),
      where("status", "==", "Approved"),
      limit(250)
    );
    const snap = await getDocs(q);
    providerRoutes = snap.docs.map((docSnap) => ({
      url: `${baseUrl}/provider/${docSnap.id}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
  } catch (err) {
    console.warn("Sitemap: Failed to query providers dynamically, falling back to static routes:", err);
  }

  return [...staticRoutes, ...providerRoutes];
}
