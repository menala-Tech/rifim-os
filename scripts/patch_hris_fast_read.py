from pathlib import Path

# Existing canonical HRIS Vercel API: add employees read mode.
p = Path('api/internal/hris-v2.js')
s = p.read_text()
marker = 'async function attendance(req,p)'
if marker not in s:
    raise SystemExit('attendance marker missing')
employees = "async function employees(req,p){if(!canRead(p.role))throw new Error('Role tidak boleh melihat Karyawan');const company=String(req.query.company_code||'ALL'),status=String(req.query.status||'ALL');let path='/rest/v1/employees?select=*&order=full_name.asc&limit=500';if(company&&company!=='ALL')path+=`&company_code=eq.${q(company)}`;if(status&&status!=='ALL')path+=`&status=eq.${q(status)}`;let rows=await sbFetch(path);if(p.role==='koordinator'){const prof=await sbFetch(`/rest/v1/user_profiles?branch_id=eq.${q(p.branch_id||'')}&is_active=eq.true&select=staff_id`);const allowed=new Set((prof||[]).map(x=>String(x.staff_id||'').toUpperCase()).filter(Boolean));rows=(rows||[]).filter(x=>allowed.has(String(x.employee_id||'').toUpperCase()))}return rows}\n"
if 'async function employees(req,p)' not in s:
    s = s.replace(marker, employees + marker, 1)
old = "if(req.method==='GET'&&mode==='branches')return out(res,200,{success:true,rows:await branches(a.profile),scope:a.profile.role==='koordinator'?'own_branch':'global'});if(req.method==='GET'&&mode==='attendance')"
new = "if(req.method==='GET'&&mode==='branches')return out(res,200,{success:true,rows:await branches(a.profile),scope:a.profile.role==='koordinator'?'own_branch':'global'});if(req.method==='GET'&&mode==='employees')return out(res,200,{success:true,rows:await employees(req,a.profile),scope:a.profile.role==='koordinator'?'own_branch':'global'});if(req.method==='GET'&&mode==='attendance')"
if old not in s:
    raise SystemExit('handler route marker missing')
s = s.replace(old, new, 1)
p.write_text(s)

# Frontend: Vercel->Supabase primary, GAS fallback, stale-while-revalidate cache.
p = Path('modules/hris/index.html')
s = p.read_text()
marker = 'async function loadEmployees(opts) {'
if marker not in s:
    raise SystemExit('loadEmployees marker missing')
helper = r'''function _hrisCacheGetAny(key) {
  try {
    const raw = localStorage.getItem('hris_cache_' + key);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return obj && obj.data ? obj.data : null;
  } catch (e) { return null; }
}

async function _fetchEmployeesFast() {
  const token = getRaosSyncToken();
  if (token) {
    try {
      const qs = new URLSearchParams({ mode: 'employees', company_code: selectedCompany || 'ALL', status: 'ALL' });
      const r = await fetch('/api/internal/hris-v2?' + qs.toString(), {
        headers: { Authorization: 'Bearer ' + token },
        cache: 'no-store',
      });
      const j = await r.json();
      if (r.ok && j && j.success) return { success: true, employees: j.rows || [], source: 'vercel-supabase' };
      console.warn('[HRIS] Fast employee read ditolak, fallback GAS:', j && j.message);
    } catch (e) {
      console.warn('[HRIS] Fast employee read gagal, fallback GAS:', e.message);
    }
  }
  return gasGet({ action: 'hris_employees', company_code: selectedCompany, status: 'ALL' });
}

'''
if 'async function _fetchEmployeesFast()' not in s:
    s = s.replace(marker, helper + marker, 1)
needle = "  const cacheKey = 'employees_' + selectedCompany;\n\n  // Cache-first render"
replacement = """  const cacheKey = 'employees_' + selectedCompany;

  // Stale-while-revalidate: cache lama tetap tampil instan sambil refresh di belakang.
  if (!opts.forceRefresh) {
    const stale = _hrisCacheGetAny(cacheKey);
    const fresh = _hrisCacheGet(cacheKey);
    if (!fresh && stale && stale.employees) {
      allEmployees = stale.employees;
      _buildEmpDatalist();
      renderEmployees(allEmployees);
      updateEmpStats(allEmployees);
      _backgroundRefreshEmployees(cacheKey);
      return;
    }
  }

  // Cache-first render"""
if needle not in s:
    raise SystemExit('cache marker missing')
s = s.replace(needle, replacement, 1)
old_read = "gasGet({ action: 'hris_employees', company_code: selectedCompany, status: 'ALL' })"
count = s.count(old_read)
if count < 2:
    raise SystemExit(f'expected at least 2 employee GAS reads, got {count}')
s = s.replace(old_read, '_fetchEmployeesFast()')
p.write_text(s)
