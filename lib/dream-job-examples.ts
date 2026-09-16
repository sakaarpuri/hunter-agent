export type DreamJobExample = {
  id: string;
  company: string;
  title: string;
  location: string;
  category: string;
  hook: string;
  appeal: string;
  requirements: string;
  reality: string;
  sourceUrl: string;
  sourceLabel: string;
  reviewedOn: string;
};

// Editorial snapshots, not a live feed or personal recommendations. Recheck the
// employer pages before updating reviewedOn; never imply a rolling verification.
export const DREAM_JOB_EXAMPLES: DreamJobExample[] = [
  {
    id: "arctic",
    company: "Northern Horizon",
    title: "Aurora & Fjord Tour Guide",
    location: "Tromso, Norway",
    category: "A different everyday",
    hook: "Trade the office lights for the northern lights.",
    appeal:
      "Guide small groups through Arctic nights and fjord landscapes, taking and editing photographs along the way. A real role that combines people, the outdoors, and photography.",
    requirements:
      "The employer asks for English fluency, local knowledge, photography skills, and availability for the full contract period.",
    reality:
      "This is a seasonal guiding role, not a photography residency. Ask about pay, accommodation, work permission, and the night-time schedule before considering a move.",
    sourceUrl: "https://northernhorizon.no/join-us",
    sourceLabel: "Northern Horizon careers",
    reviewedOn: "2026-09-02",
  },
  {
    id: "seoul",
    company: "Channel Corp.",
    title: "Chief Information Security Officer",
    location: "Seoul, South Korea · Hybrid",
    category: "A bigger seat at the table",
    hook: "Your next chapter could be C-suite. In Seoul.",
    appeal:
      "Build the security function for an AI customer-messaging business expanding internationally. A leadership opportunity spanning strategy, certifications, and customer trust.",
    requirements:
      "The listing asks for at least five years in information or privacy security, certification experience, and cloud-security expertise.",
    reality:
      "The original listing is in Korean and includes Korean regulatory experience. Confirm working-language expectations, relocation support, and work eligibility with the employer.",
    sourceUrl:
      "https://jobs.lever.co/zoyi/56ea1f23-744a-4998-a880-4ba0f78a4a54",
    sourceLabel: "Channel Corp. on Lever",
    reviewedOn: "2026-09-02",
  },
  {
    id: "ocean",
    company: "Six Senses Kanuhura",
    title: "Marine Biologist",
    location: "Lhaviyani Atoll, Maldives",
    category: "Work with a purpose",
    hook: "Make the reef part of your working day.",
    appeal:
      "Combine underwater ecological surveys with research and guest education in the Maldives. Marine science with a direct connection to the places it studies.",
    requirements:
      "A relevant bachelor's degree, Rescue Diver certification or equivalent, and marine research skills are required. A master's degree is strongly preferred.",
    reality:
      "This combines science with resort operations and guest-facing work. Check the contract, island accommodation, working pattern, and relocation arrangements.",
    sourceUrl:
      "https://careers.ihg.com/es-la/job-details/?jobref=Marine+Biologist+%E2%80%93+Six+Senses+Kanuhura%7CGB%7C159870",
    sourceLabel: "IHG careers · Job 159870",
    reviewedOn: "2026-09-02",
  },
  {
    id: "racing",
    company: "McLaren Racing",
    title: "Junior Aerodynamics Design Engineer",
    location: "Factory-based · Full-time",
    category: "Closer to your obsession",
    hook: "Design the details that make a race car faster.",
    appeal:
      "Work on aerodynamic surfaces and wind-tunnel components alongside the engineers and specialists turning race-car designs into on-track performance.",
    requirements:
      "An engineering degree or equivalent relevant experience, 3D CAD knowledge, and an understanding of vehicle design are requested.",
    reality:
      "This is a junior, predominantly factory-based role with occasional travel, not a promise of travelling the racing calendar. Confirm the work location and package.",
    sourceUrl:
      "https://jobs.smartrecruiters.com/McLarenRacingLtd1/744000145662700-junior-aerodynamics-design-engineer",
    sourceLabel: "McLaren Racing on SmartRecruiters",
    reviewedOn: "2026-09-02",
  },
  {
    id: "space",
    company: "SpaceX",
    title: "Software Engineer, Flight Software (Starship)",
    location: "Starbase, Texas, USA",
    category: "A mission on another scale",
    hook: "Write software with somewhere extraordinary to go.",
    appeal:
      "Develop and test software that controls and simulates Starship flight systems. The posting explicitly says previous aerospace experience is not required.",
    requirements:
      "A relevant engineering degree or at least two years of professional software development in lieu of a degree. Systems-programming experience is preferred.",
    reality:
      "The listing includes long hours and weekends when needed, plus US export-control eligibility requirements. A compelling mission still needs to fit your life.",
    sourceUrl: "https://job-boards.greenhouse.io/spacex/jobs/8562284002",
    sourceLabel: "SpaceX on Greenhouse",
    reviewedOn: "2026-09-02",
  },
];
