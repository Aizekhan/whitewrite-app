// Canon entity enum values
// These are stored in Firestore as codes and translated in UI via i18n
// DO NOT store translated text in database — store enum code

// Character status (progress in arc)
const CHARACTER_STATUS = {
  DRAFT: 'draft',           // Чернетка / Draft
  DEVELOPING: 'developing', // Розвивається / Developing
  COMPLETE: 'complete'      // Завершено / Complete
};

// Character role type (already using enum, keeping for completeness)
const CHARACTER_ROLE = {
  LEAD: 'lead',       // Головний / Protagonist
  SUPPORT: 'support', // Другорядний / Supporting
  ANTA: 'anta'        // Антагоніст / Antagonist
};

// Location type
const LOCATION_TYPE = {
  CITY: 'city',           // Місто / City
  BUILDING: 'building',   // Будівля / Building
  ROOM: 'room',           // Кімната / Room
  NATURE: 'nature',       // Природа / Nature
  PLANET: 'planet',       // Планета / Planet
  STATION: 'station',     // Станція / Station
  SHIP: 'ship',           // Корабель / Ship
  VIRTUAL: 'virtual',     // Віртуальний / Virtual
  OTHER: 'other'          // Інше / Other
};

// Event type
const EVENT_TYPE = {
  BATTLE: 'battle',         // Битва / Battle
  MEETING: 'meeting',       // Зустріч / Meeting
  DISCOVERY: 'discovery',   // Відкриття / Discovery
  BETRAYAL: 'betrayal',     // Зрада / Betrayal
  LOSS: 'loss',             // Втрата / Loss
  VICTORY: 'victory',       // Перемога / Victory
  REVELATION: 'revelation', // Розкриття / Revelation
  RITUAL: 'ritual',         // Ритуал / Ritual
  OTHER: 'other'            // Інше / Other
};

// Faction alignment
const FACTION_ALIGNMENT = {
  HERO: 'hero',           // Герої / Heroes
  VILLAIN: 'villain',     // Лиходії / Villains
  NEUTRAL: 'neutral',     // Нейтральна / Neutral
  AMBIGUOUS: 'ambiguous'  // Неоднозначна / Ambiguous
};

// Artifact rarity
const ARTIFACT_RARITY = {
  COMMON: 'common',       // Звичайний / Common
  UNCOMMON: 'uncommon',   // Незвичайний / Uncommon
  RARE: 'rare',           // Рідкісний / Rare
  LEGENDARY: 'legendary', // Легендарний / Legendary
  UNIQUE: 'unique'        // Унікальний / Unique
};

// Artifact type
const ARTIFACT_TYPE = {
  WEAPON: 'weapon',       // Зброя / Weapon
  TOOL: 'tool',           // Інструмент / Tool
  DOCUMENT: 'document',   // Документ / Document
  JEWELRY: 'jewelry',     // Прикраса / Jewelry
  TECH: 'tech',           // Технологія / Technology
  MAGIC: 'magic',         // Магічний / Magical
  RELIC: 'relic',         // Реліквія / Relic
  OTHER: 'other'          // Інше / Other
};

// Legacy text-to-enum mapping (for existing projects with Ukrainian text)
// Maps old translated text to new enum codes
const LEGACY_MAPPING = {
  // Character status
  'Чернетка': CHARACTER_STATUS.DRAFT,
  'Draft': CHARACTER_STATUS.DRAFT,
  'Розвивається': CHARACTER_STATUS.DEVELOPING,
  'Developing': CHARACTER_STATUS.DEVELOPING,
  'Завершено': CHARACTER_STATUS.COMPLETE,
  'Complete': CHARACTER_STATUS.COMPLETE,

  // Character role
  'Головний': CHARACTER_ROLE.LEAD,
  'Protagonist': CHARACTER_ROLE.LEAD,
  'Другорядний': CHARACTER_ROLE.SUPPORT,
  'Supporting': CHARACTER_ROLE.SUPPORT,
  'Антагоніст': CHARACTER_ROLE.ANTA,
  'Antagonist': CHARACTER_ROLE.ANTA,

  // Location type
  'Місто': LOCATION_TYPE.CITY,
  'City': LOCATION_TYPE.CITY,
  'Будівля': LOCATION_TYPE.BUILDING,
  'Building': LOCATION_TYPE.BUILDING,
  'Кімната': LOCATION_TYPE.ROOM,
  'Room': LOCATION_TYPE.ROOM,
  'Природа': LOCATION_TYPE.NATURE,
  'Nature': LOCATION_TYPE.NATURE,
  'Планета': LOCATION_TYPE.PLANET,
  'Planet': LOCATION_TYPE.PLANET,
  'Станція': LOCATION_TYPE.STATION,
  'Station': LOCATION_TYPE.STATION,
  'Корабель': LOCATION_TYPE.SHIP,
  'Ship': LOCATION_TYPE.SHIP,
  'Віртуальний': LOCATION_TYPE.VIRTUAL,
  'Virtual': LOCATION_TYPE.VIRTUAL,
  'Інше': LOCATION_TYPE.OTHER,
  'Other': LOCATION_TYPE.OTHER,

  // Event type
  'Битва': EVENT_TYPE.BATTLE,
  'Battle': EVENT_TYPE.BATTLE,
  'Зустріч': EVENT_TYPE.MEETING,
  'Meeting': EVENT_TYPE.MEETING,
  'Відкриття': EVENT_TYPE.DISCOVERY,
  'Discovery': EVENT_TYPE.DISCOVERY,
  'Зрада': EVENT_TYPE.BETRAYAL,
  'Betrayal': EVENT_TYPE.BETRAYAL,
  'Втрата': EVENT_TYPE.LOSS,
  'Loss': EVENT_TYPE.LOSS,
  'Перемога': EVENT_TYPE.VICTORY,
  'Victory': EVENT_TYPE.VICTORY,
  'Розкриття': EVENT_TYPE.REVELATION,
  'Revelation': EVENT_TYPE.REVELATION,
  'Ритуал': EVENT_TYPE.RITUAL,
  'Ritual': EVENT_TYPE.RITUAL,

  // Faction alignment
  'Герої': FACTION_ALIGNMENT.HERO,
  'Heroes': FACTION_ALIGNMENT.HERO,
  'Лиходії': FACTION_ALIGNMENT.VILLAIN,
  'Villains': FACTION_ALIGNMENT.VILLAIN,
  'Нейтральна': FACTION_ALIGNMENT.NEUTRAL,
  'Neutral': FACTION_ALIGNMENT.NEUTRAL,
  'Неоднозначна': FACTION_ALIGNMENT.AMBIGUOUS,
  'Ambiguous': FACTION_ALIGNMENT.AMBIGUOUS,

  // Artifact rarity
  'Звичайний': ARTIFACT_RARITY.COMMON,
  'Common': ARTIFACT_RARITY.COMMON,
  'Незвичайний': ARTIFACT_RARITY.UNCOMMON,
  'Uncommon': ARTIFACT_RARITY.UNCOMMON,
  'Рідкісний': ARTIFACT_RARITY.RARE,
  'Rare': ARTIFACT_RARITY.RARE,
  'Легендарний': ARTIFACT_RARITY.LEGENDARY,
  'Legendary': ARTIFACT_RARITY.LEGENDARY,
  'Унікальний': ARTIFACT_RARITY.UNIQUE,
  'Unique': ARTIFACT_RARITY.UNIQUE,

  // Artifact type
  'Зброя': ARTIFACT_TYPE.WEAPON,
  'Weapon': ARTIFACT_TYPE.WEAPON,
  'Інструмент': ARTIFACT_TYPE.TOOL,
  'Tool': ARTIFACT_TYPE.TOOL,
  'Документ': ARTIFACT_TYPE.DOCUMENT,
  'Document': ARTIFACT_TYPE.DOCUMENT,
  'Прикраса': ARTIFACT_TYPE.JEWELRY,
  'Jewelry': ARTIFACT_TYPE.JEWELRY,
  'Технологія': ARTIFACT_TYPE.TECH,
  'Technology': ARTIFACT_TYPE.TECH,
  'Магічний': ARTIFACT_TYPE.MAGIC,
  'Magical': ARTIFACT_TYPE.MAGIC,
  'Реліквія': ARTIFACT_TYPE.RELIC,
  'Relic': ARTIFACT_TYPE.RELIC
};

// Helper: normalize value (convert legacy text to enum, or return as-is if already enum)
function normalizeEnumValue(value) {
  if (!value) return value;
  return LEGACY_MAPPING[value] || value;
}

// Export to window
window.__canonEnums = {
  CHARACTER_STATUS,
  CHARACTER_ROLE,
  LOCATION_TYPE,
  EVENT_TYPE,
  FACTION_ALIGNMENT,
  ARTIFACT_RARITY,
  ARTIFACT_TYPE,
  LEGACY_MAPPING,
  normalizeEnumValue
};
