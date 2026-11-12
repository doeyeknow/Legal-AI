// ZIP -> county resolution + county court filing steps.
// v1 dataset: New Mexico (all 33 counties). Structured so a national
// dataset can drop in later: add states to STATE_FALLBACKS and ZIP maps
// per state. Filing-page links are best-effort public URLs.

export interface CountyCourt {
  county: string;
  state: 'NM';
  countySeat: string;
  district: string; // judicial district label
  districtCourt: string;
  /** Magistrate / metro court note (small claims & many evictions file here). */
  lowerCourt: string;
  filingUrl: string;
  selfHelpUrl: string;
}

const NM_SELF_HELP = 'https://www.nmcourts.gov/self-help/';
const NM_COURTS = 'https://www.nmcourts.gov';
const NM_CASE_LOOKUP = 'https://caselookup.nmcourts.gov';

function nm(
  county: string,
  seat: string,
  district: string,
  extra?: Partial<CountyCourt>
): CountyCourt {
  return {
    county,
    state: 'NM',
    countySeat: seat,
    district,
    districtCourt: `${district} Judicial District Court — ${county} County`,
    lowerCourt: `${county} County Magistrate Court (in ${seat})`,
    filingUrl: NM_COURTS,
    selfHelpUrl: NM_SELF_HELP,
    ...extra,
  };
}

export const NM_COUNTIES: CountyCourt[] = [
  nm('Bernalillo', 'Albuquerque', 'Second', {
    lowerCourt: 'Bernalillo County Metropolitan Court (in Albuquerque) — most small claims and many evictions file here',
    filingUrl: 'https://metro.nmcourts.gov',
  }),
  nm('Catron', 'Reserve', 'Seventh'),
  nm('Chaves', 'Roswell', 'Fifth'),
  nm('Cibola', 'Grants', 'Thirteenth'),
  nm('Colfax', 'Raton', 'Eighth'),
  nm('Curry', 'Clovis', 'Ninth'),
  nm('De Baca', 'Fort Sumner', 'Tenth'),
  nm('Doña Ana', 'Las Cruces', 'Third'),
  nm('Eddy', 'Carlsbad', 'Fifth'),
  nm('Grant', 'Silver City', 'Sixth'),
  nm('Guadalupe', 'Santa Rosa', 'Fourth'),
  nm('Harding', 'Mosquero', 'Tenth'),
  nm('Hidalgo', 'Lordsburg', 'Sixth'),
  nm('Lea', 'Lovington', 'Fifth'),
  nm('Lincoln', 'Carrizozo', 'Twelfth'),
  nm('Los Alamos', 'Los Alamos', 'First'),
  nm('Luna', 'Deming', 'Sixth'),
  nm('McKinley', 'Gallup', 'Eleventh'),
  nm('Mora', 'Mora', 'Fourth'),
  nm('Otero', 'Alamogordo', 'Twelfth'),
  nm('Quay', 'Tucumcari', 'Tenth'),
  nm('Rio Arriba', 'Tierra Amarilla', 'First'),
  nm('Roosevelt', 'Portales', 'Ninth'),
  nm('Sandoval', 'Bernalillo', 'Thirteenth'),
  nm('San Juan', 'Aztec', 'Eleventh'),
  nm('San Miguel', 'Las Vegas', 'Fourth'),
  nm('Santa Fe', 'Santa Fe', 'First'),
  nm('Sierra', 'Truth or Consequences', 'Seventh'),
  nm('Socorro', 'Socorro', 'Seventh'),
  nm('Taos', 'Taos', 'Eighth'),
  nm('Torrance', 'Estancia', 'Seventh'),
  nm('Union', 'Clayton', 'Eighth'),
  nm('Valencia', 'Los Lunas', 'Thirteenth'),
];

export const NM_BY_COUNTY: Record<string, CountyCourt> = Object.fromEntries(
  NM_COUNTIES.map((c) => [c.county.toLowerCase(), c])
);

// Specific NM ZIP -> county (county seats and main towns).
const NM_ZIP_EXACT: Record<string, string> = {
  '87571': 'Taos', '87529': 'Taos', '87556': 'Taos', '87558': 'Taos', '87553': 'Taos', '87525': 'Taos',
  '87501': 'Santa Fe', '87505': 'Santa Fe', '87506': 'Santa Fe', '87507': 'Santa Fe', '87508': 'Santa Fe', '87509': 'Santa Fe', '87592': 'Santa Fe',
  '87544': 'Los Alamos', '87547': 'Los Alamos',
  '87532': 'Rio Arriba', '87566': 'Rio Arriba', '87575': 'Rio Arriba',
  '87124': 'Sandoval', '87144': 'Sandoval', '87004': 'Sandoval', '87048': 'Sandoval',
  '87031': 'Valencia', '87002': 'Valencia', '87042': 'Valencia',
  '88001': 'Doña Ana', '88005': 'Doña Ana', '88011': 'Doña Ana', '88012': 'Doña Ana', '88021': 'Doña Ana', '88063': 'Doña Ana',
  '88030': 'Luna', '88031': 'Luna',
  '88045': 'Hidalgo',
  '88061': 'Grant', '88062': 'Grant',
  '88201': 'Chaves', '88203': 'Chaves', '88230': 'Chaves',
  '88220': 'Eddy', '88210': 'Eddy',
  '88240': 'Lea', '88260': 'Lea', '88242': 'Lea',
  '87401': 'San Juan', '87410': 'San Juan', '87413': 'San Juan', '87420': 'San Juan',
  '87301': 'McKinley', '87305': 'McKinley', '87313': 'McKinley',
  '88101': 'Curry', '88130': 'Roosevelt', '88119': 'De Baca',
  '88401': 'Quay', '88426': 'Quay', '88415': 'Union', '88435': 'Guadalupe',
  '88310': 'Otero', '88311': 'Otero', '88345': 'Lincoln', '88301': 'Lincoln', '88346': 'Lincoln',
  '87701': 'San Miguel', '87740': 'Colfax', '87731': 'Mora', '87733': 'Harding',
  '87020': 'Cibola', '87801': 'Socorro', '87901': 'Sierra', '87016': 'Torrance', '87830': 'Catron',
};

// 3-digit prefix fallback (approximate; the steps tell the user to confirm).
const NM_ZIP_PREFIX: Record<string, string> = {
  '871': 'Bernalillo',
  '873': 'McKinley',
  '874': 'San Juan',
  '880': 'Doña Ana',
  '881': 'Curry',
};

export interface ZipResolution {
  zip: string;
  state: string | null;
  county: CountyCourt | null;
  approximate: boolean;
  isNM: boolean;
}

export function resolveZip(zipRaw: string): ZipResolution {
  const zip = (zipRaw || '').trim().slice(0, 5);
  const exact = NM_ZIP_EXACT[zip];
  if (exact && NM_BY_COUNTY[exact.toLowerCase()]) {
    return { zip, state: 'NM', county: NM_BY_COUNTY[exact.toLowerCase()], approximate: false, isNM: true };
  }
  const prefix = NM_ZIP_PREFIX[zip.slice(0, 3)];
  if (prefix && NM_BY_COUNTY[prefix.toLowerCase()]) {
    return { zip, state: 'NM', county: NM_BY_COUNTY[prefix.toLowerCase()], approximate: true, isNM: true };
  }
  // NM ZIPs run 870xx–884xx; inside that range but unknown county.
  const n = parseInt(zip, 10);
  if (n >= 87001 && n <= 88499) {
    return { zip, state: 'NM', county: null, approximate: true, isNM: true };
  }
  return { zip, state: null, county: null, approximate: false, isNM: false };
}

export const STATE_FALLBACKS: Record<string, { name: string; judiciaryUrl: string }> = {
  NM: { name: 'New Mexico', judiciaryUrl: NM_SELF_HELP },
  AZ: { name: 'Arizona', judiciaryUrl: 'https://www.azcourts.gov/selfservicecenter' },
  CO: { name: 'Colorado', judiciaryUrl: 'https://www.coloradojudicial.gov' },
  TX: { name: 'Texas', judiciaryUrl: 'https://www.txcourts.gov' },
  OK: { name: 'Oklahoma', judiciaryUrl: 'https://www.oscn.net' },
};
