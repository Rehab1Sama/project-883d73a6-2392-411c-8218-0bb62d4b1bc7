/** محتوى الموقع التعريفي — نصوص ثابتة تُستخدم في الرئيسية والصفحات الفرعية */

export const SITE_NAV = [
  { label: "الرئيسية", to: "/" },
  { label: "المميزات", to: "/features" },
  { label: "الأدوار", to: "/roles" },
  { label: "الأسعار", to: "/plans" },
  { label: "مقارنة الباقات", to: "/compare" },
  { label: "تواصل", to: "/contact" },
] as const;

export type FeatureItem = { icon: string; title: string; text: string };

export const FEATURES: FeatureItem[] = [
  {
    icon: "CalendarCheck",
    title: "تسجيل الحضور والغياب",
    text: "تسجيل سريع لحضور الطالبات في كل حلقة، مع سجل يومي دقيق وتنبيه للغياب المتكرر.",
  },
  {
    icon: "BarChart3",
    title: "إحصائيات وتقارير",
    text: "أعداد ونِسب جاهزة: الحضور، الإنجاز، ومقارنة المسارات خلال الأسبوع أو الشهر.",
  },
  {
    icon: "Route",
    title: "إدارة المسارات",
    text: "قسّمي المقرأة إلى مسارات، وأسندي لكل مسار مسؤولة ومعلمات وطالبات بخطوات بسيطة.",
  },
  {
    icon: "BookOpenCheck",
    title: "متابعة الحفظ والتلاوة",
    text: "تسجيل الوِرد اليومي والمراجعة والتقييم، مع لوحة تقدّم واضحة لكل طالبة.",
  },
  {
    icon: "Link2",
    title: "رابط خاص لكل مقرأة",
    text: "كل مقرأة لها رابطها المستقل وبياناتها ومميزاتها، منفصلة تمامًا عن غيرها.",
  },
  {
    icon: "ShieldCheck",
    title: "صلاحيات متعددة",
    text: "ست صلاحيات مختلفة، كل حساب يرى ما يخصّه فقط ولا يتجاوز نطاق مسؤوليته.",
  },
];

export type RoleItem = { icon: string; title: string; text: string };

export const ROLES: RoleItem[] = [
  { icon: "Crown", title: "القائدة", text: "صاحبة المقرأة: إعداداتها العامة، الاشتراك، وكل الحسابات والتقارير." },
  { icon: "UserCog", title: "المشرفة العامة", text: "إدارة المسارات والمعلمات والطالبات ومتابعة الأداء على مستوى المقرأة." },
  { icon: "Compass", title: "مسؤولة المسار", text: "متابعة مسارها فقط: حلقاته ومعلماته وحضور طالباته وتقاريره." },
  { icon: "GraduationCap", title: "المعلمة", text: "تسجيل الحضور والوِرد اليومي والتقييم لطالبات حلقتها." },
  { icon: "Eye", title: "المشرفة", text: "متابعة الالتزام والتنبيهات ورفع الملاحظات دون تعديل البيانات." },
  { icon: "BookOpen", title: "الطالبة", text: "صفحتها الخاصة: وِردها، تقييماتها، ونسبة حضورها وتقدّمها." },
];

export const HERO_STATS = [
  { label: "حضور اليوم", value: "٩٤٪" },
  { label: "طالبة مسجّلة", value: "٢٤٨" },
  { label: "مسارات نشطة", value: "٦" },
];

export type WorkflowStep = { title: string; text: string };

export const WORKFLOW: WorkflowStep[] = [
  { title: "اختاري الباقة", text: "حدّدي الباقة ونوع الاشتراك: شهري أو سنوي (بشهرين مجانًا)، وأرسلي طلبك." },
  { title: "نجهّز مقرأتك", text: "ننشئ حساب المقرأة ورابطها الخاص ونضيف القائدة والمشرفات." },
  { title: "ابدئي التسجيل", text: "أضيفي المسارات والحلقات والطالبات، وابدئي تسجيل الحضور والوِرد." },
];

export const CONTACT_EMAIL = "suhub1r@gmail.com";
export const CONTACT_TELEGRAM = "@suhub1r";
export const CONTACT_TELEGRAM_URL = "https://t.me/suhub1r";
export const REPLY_TIME_TEXT = "الرد خلال ٤٨ ساعة";

