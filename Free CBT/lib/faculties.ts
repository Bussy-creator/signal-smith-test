export interface Department {
  code: string;
  name: string;
}
export interface Faculty {
  id: string;
  name: string;
  departments: Department[];
}

/**
 * FUTA faculties/schools and their departments.
 *
 * Verified against FUTA's official recruitment ads, department sites, and
 * 2024/2025 restructuring news. Notable corrections vs. older lists:
 *  - The old "School of Engineering & Engineering Technology (SEET)" was
 *    split in 2024 into SESE and SIMME (below).
 *  - School of Computing gained a 6th department: Data Science.
 *  - School of Physical Sciences includes General Studies (GNS).
 *  - SLIT gained Financial Technology (FIN) and Procurement Technology (PRC).
 * Re-verify against the current admission brochure periodically — FUTA's
 * structure has changed more than once in recent years.
 */
export const FACULTIES: Faculty[] = [
  {
    id: "chs",
    name: "College of Health Sciences (CHS)",
    departments: [
      { code: "ANA", name: "Human Anatomy" },
      { code: "BIM", name: "Biomedical Technology" },
      { code: "PHS", name: "Human Physiology" },
      { code: "MLS", name: "Medical Laboratory Science" },
      { code: "MBBS", name: "Medicine & Surgery" }
    ]
  },
  {
    id: "slit",
    name: "School of Logistics & Innovation Technology (SLIT)",
    departments: [
      { code: "BIT", name: "Business Information Technology" },
      { code: "BMT", name: "Business Management Technology" },
      { code: "ENT", name: "Entrepreneurship Management Technology" },
      { code: "LTT", name: "Logistics & Transport Technology" },
      { code: "PMT", name: "Project Management Technology" },
      { code: "SIM", name: "Securities & Investment Management Technology" },
      { code: "FIN", name: "Financial Technology" },
      { code: "PRC", name: "Procurement Technology" }
    ]
  },
  {
    id: "soc",
    name: "School of Computing (SOC)",
    departments: [
      { code: "CSC", name: "Computer Science" },
      { code: "CYS", name: "Cyber Security" },
      { code: "IFS", name: "Information Systems" },
      { code: "IFT", name: "Information Technology" },
      { code: "SEN", name: "Software Engineering" },
      { code: "DTS", name: "Data Science" }
    ]
  },
  {
    id: "sps",
    name: "School of Physical Sciences (SPS)",
    departments: [
      { code: "CHM", name: "Chemistry" },
      { code: "EDT", name: "Educational Technology" },
      { code: "LIS", name: "Library and Information Science" },
      { code: "MTS", name: "Mathematics" },
      { code: "PHY", name: "Physics" },
      { code: "STA", name: "Statistics" },
      { code: "GNS", name: "General Studies" }
    ]
  },
  {
    id: "sls",
    name: "School of Life Sciences (SLS)",
    departments: [
      { code: "BCH", name: "Biochemistry" },
      { code: "BIO", name: "Biology" },
      { code: "BTH", name: "Biotechnology" },
      { code: "MCB", name: "Microbiology" }
    ]
  },
  {
    id: "sese",
    name: "School of Electrical Systems Engineering (SESE)",
    departments: [
      { code: "BME", name: "Biomedical Engineering" },
      { code: "CPE", name: "Computer Engineering" },
      { code: "EEE", name: "Electrical & Electronics Engineering" },
      { code: "ICE", name: "Information & Communication Engineering" },
      { code: "MCE", name: "Mechatronics Engineering" }
    ]
  },
  {
    id: "simme",
    name: "School of Infrastructure, Minerals & Manufacturing Engineering (SIMME)",
    departments: [
      { code: "AGE", name: "Agricultural & Environmental Engineering" },
      { code: "CVE", name: "Civil & Environmental Engineering" },
      { code: "IPE", name: "Industrial & Production Engineering" },
      { code: "MEE", name: "Mechanical Engineering" },
      { code: "MME", name: "Metallurgical & Materials Engineering" },
      { code: "MNE", name: "Mining Engineering" }
    ]
  },
  {
    id: "sems",
    name: "School of Earth & Mineral Sciences (SEMS)",
    departments: [
      { code: "AGY", name: "Applied Geology" },
      { code: "AGP", name: "Applied Geophysics" },
      { code: "MST", name: "Marine Science & Technology" },
      { code: "MCS", name: "Meteorology & Climate Science" },
      { code: "RSG", name: "Remote Sensing & Geoinformatics" }
    ]
  },
  {
    id: "set",
    name: "School of Environmental Technology (SET)",
    departments: [
      { code: "ARC", name: "Architecture" },
      { code: "BDG", name: "Building Technology" },
      { code: "ESM", name: "Estate Management" },
      { code: "IDD", name: "Industrial Design" },
      { code: "QSV", name: "Quantity Surveying" },
      { code: "SVG", name: "Surveying & Geoinformatics" },
      { code: "URP", name: "Urban & Regional Planning" }
    ]
  },
  {
    id: "saat",
    name: "School of Agriculture & Agricultural Technology (SAAT)",
    departments: [
      { code: "AEC", name: "Agricultural Extension & Communication Technology" },
      { code: "ARE", name: "Agricultural & Resource Economics" },
      { code: "APH", name: "Animal Production & Health" },
      { code: "CSP", name: "Crop, Soil & Pest Management" },
      { code: "EWM", name: "Ecotourism & Wildlife Management" },
      { code: "FAT", name: "Fisheries & Aquaculture Technology" },
      { code: "FST", name: "Food Science & Technology" },
      { code: "FWT", name: "Forestry & Wood Technology" },
      { code: "NTD", name: "Nutrition and Dietetics" }
    ]
  }
];
