// Mapping of Malaysian states to their 2-digit postal code prefixes
const POSTAL_DATA = {
  "Perlis": ["01", "02"],
  "Kedah": ["05", "06", "07", "08", "09"],
  "Penang": ["10", "11", "12", "13", "14"],
  "Kelantan": ["15", "16", "17", "18"],
  "Terengganu": ["20", "21", "22", "23", "24"],
  "Pahang": ["25", "26", "27", "28", "39", "49", "69"],
  "Perak": ["30", "31", "32", "33", "34", "35", "36"],
  "Selangor": ["40", "41", "42", "43", "44", "45", "46", "47", "48", "63", "64", "68"],
  "WP Kuala Lumpur": ["50", "51", "52", "53", "54", "55", "56", "57", "58", "59", "60"],
  "WP Putrajaya": ["62"],
  "Negeri Sembilan": ["70", "71", "72", "73"],
  "Melaka": ["75", "76", "77", "78"],
  "Johor": ["79", "80", "81", "82", "83", "84", "85", "86"],
  "WP Labuan": ["87"],
  "Sabah": ["88", "89", "90", "91"],
  "Sarawak": ["93", "94", "95", "96", "97", "98"]
};

// Build reverse mapping: prefix -> state
const PREFIX_TO_STATE = {};
for (const [state, prefixes] of Object.entries(POSTAL_DATA)) {
  for (const prefix of prefixes) {
    PREFIX_TO_STATE[prefix] = state;
  }
}

// All unique states (for state-level mode)
const ALL_STATES = Object.keys(POSTAL_DATA);

// All prefixes (for prefix-level mode), sorted numerically
const ALL_PREFIXES = Object.values(POSTAL_DATA)
  .flat()
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

// State display names (for UI)
const STATE_DISPLAY_NAMES = {
  "WP Kuala Lumpur": "W.P. Kuala Lumpur",
  "WP Putrajaya": "W.P. Putrajaya",
  "WP Labuan": "W.P. Labuan",
  "Negeri Sembilan": "Negeri Sembilan"
};

function getDisplayName(state) {
  return STATE_DISPLAY_NAMES[state] || state;
}
