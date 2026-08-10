/** LOCAL ONLY — canonical geofence references from user-provided coordinates. */
const RAOS_GEOFENCE_REFERENCE = [
  { slug:'bandara-batam', name:'Bandara Batam', lat:1.1229474611566184, lng:104.11399999608159, radius_meters:1000, configured:true },
  { slug:'bandara-jambi', name:'Bandara Jambi', lat:-1.6315198788190148, lng:103.6438881064391, radius_meters:1000, configured:true },
  { slug:'bandara-balikpapan', name:'Bandara Balikpapan', lat:-1.2613140099073543, lng:116.89823585376726, radius_meters:1000, configured:true },
  { slug:'bandara-manado', name:'Bandara Manado', lat:1.5432943843910787, lng:124.92259315566997, radius_meters:1000, configured:true },
  { slug:'bandara-pekanbaru', name:'Bandara Pekanbaru', lat:0.46502090112651967, lng:101.44852194619506, radius_meters:1000, configured:true },
  { slug:'bandara-makassar', name:'Bandara Makassar', lat:-5.075667, lng:119.545000, radius_meters:1000, configured:true },
  { slug:'bandara-soekarno-hatta', name:'Bandara Soekarno-Hatta', lat:null, lng:null, radius_meters:1000, configured:false },
  { slug:'terminal-1', name:'Terminal 1', lat:null, lng:null, radius_meters:1000, configured:false },
  { slug:'terminal-2', name:'Terminal 2', lat:null, lng:null, radius_meters:1000, configured:false },
  { slug:'terminal-3', name:'Terminal 3', lat:null, lng:null, radius_meters:1000, configured:false },
  { slug:'rifim-batam-non-airport', name:'Rifim Batam (non-airport)', lat:null, lng:null, radius_meters:1000, configured:false },
  { slug:'rifim-jambi-luar', name:'Rifim Jambi Luar', lat:null, lng:null, radius_meters:1000, configured:false },
  { slug:'head-office', name:'Head Office', lat:null, lng:null, radius_meters:1000, configured:false }
]
if (typeof module !== 'undefined') module.exports = { RAOS_GEOFENCE_REFERENCE }
