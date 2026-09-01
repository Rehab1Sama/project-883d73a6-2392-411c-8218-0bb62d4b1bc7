/** لوحات ألوان جاهزة لهوية المقرأة */

export type ColorPalette = {
  id: string;
  name: string;
  primary: string;
  accent: string;
};

export const COLOR_PALETTES: ColorPalette[] = [
  { id: "teal", name: "سُحُب", primary: "#2E7D8F", accent: "#C9A227" },
  { id: "emerald", name: "روضة", primary: "#0F766E", accent: "#D4A017" },
  { id: "indigo", name: "سَكينة", primary: "#4338CA", accent: "#F59E0B" },
  { id: "plum", name: "بنفسج", primary: "#6D28D9", accent: "#EC4899" },
  { id: "rose", name: "وردي هادئ", primary: "#BE185D", accent: "#F59E0B" },
  { id: "sand", name: "رمال", primary: "#92400E", accent: "#0EA5E9" },
  { id: "ocean", name: "محيط", primary: "#1D4ED8", accent: "#22D3EE" },
  { id: "olive", name: "زيتون", primary: "#4D7C0F", accent: "#CA8A04" },
];

/** لوحات باستيل هادئة — درجات فاتحة ومتناسقة */
export const PASTEL_COLOR_PALETTES: ColorPalette[] = [
  { id: "pastel-rosewater", name: "ماء الورد", primary: "#D998A6", accent: "#F4C6D0" },
  { id: "pastel-lavender", name: "لافندر", primary: "#A78BC9", accent: "#D9C8EC" },
  { id: "pastel-mint", name: "نعناع", primary: "#7FBFA4", accent: "#C6E8DA" },
  { id: "pastel-sky", name: "سماء فاتحة", primary: "#7FA8C9", accent: "#C9E2F2" },
  { id: "pastel-peach", name: "خوخي", primary: "#E3A587", accent: "#F6D6C2" },
  { id: "pastel-lemon", name: "ليموني", primary: "#D9C46A", accent: "#F2E8B8" },
  { id: "pastel-sage", name: "أخضر مريمية", primary: "#93A57E", accent: "#D3DEC3" },
  { id: "pastel-blush", name: "خزامى وردي", primary: "#D9879B", accent: "#F0C9D4" },
  { id: "pastel-periwinkle", name: "بنفسجي سماوي", primary: "#8B9FD4", accent: "#D4DCF2" },
  { id: "pastel-apricot", name: "مشمشي", primary: "#E0A96D", accent: "#F5DEBF" },
  { id: "pastel-seafoam", name: "زبد البحر", primary: "#7EC2B8", accent: "#C9EBE4" },
  { id: "pastel-lilac", name: "ليلكي", primary: "#B78BC7", accent: "#E4CCEC" },
  { id: "pastel-honey", name: "عسلي فاتح", primary: "#D9A24E", accent: "#F2DCA8" },
  { id: "pastel-dustyblue", name: "أزرق ترابي", primary: "#7089A3", accent: "#C7D4E0" },
  { id: "pastel-coral", name: "مرجاني ناعم", primary: "#E08E82", accent: "#F5CFC8" },
  { id: "pastel-pistachio", name: "فستقي", primary: "#9CB077", accent: "#DCE6C6" },
  { id: "pastel-mauve", name: "بنفسجي رمادي", primary: "#AD8B9C", accent: "#E2CFD9" },
  { id: "pastel-buttercream", name: "زبدي", primary: "#D9C08A", accent: "#F2E7CB" },
  { id: "pastel-aqua", name: "فيروزي فاتح", primary: "#6FB8B0", accent: "#C3E6E1" },
  { id: "pastel-terracotta", name: "طيني وردي", primary: "#C98368", accent: "#EBC7B4" },
];
