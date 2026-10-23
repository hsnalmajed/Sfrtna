/**
 * Sfrtna's own accounts (owner, 23 Oct 2026). Handle «sfrtnaapp» everywhere;
 * TikTok is «.sfrtna» until it can be renamed (22 Nov 2026). Used by the
 * footer and by the Organization record (`sameAs`), which is how search
 * engines tie these profiles to the site's name.
 */
export interface SocialProfile {
  id: "instagram" | "tiktok" | "snapchat" | "x";
  label: string;
  url: string;
}

export const SOCIAL_PROFILES: SocialProfile[] = [
  { id: "instagram", label: "Instagram", url: "https://www.instagram.com/sfrtnaapp/" },
  { id: "tiktok", label: "TikTok", url: "https://www.tiktok.com/@.sfrtna" },
  { id: "snapchat", label: "Snapchat", url: "https://www.snapchat.com/add/sfrtnaapp" },
  { id: "x", label: "X", url: "https://x.com/Sfrtnaapp" },
];
