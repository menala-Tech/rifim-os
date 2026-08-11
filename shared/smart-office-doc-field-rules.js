(function (global) {
  'use strict'

  const EMPLOYEE_COMMON = [
    'employee_name',
    'employee_id',
    'employee_position',
    'employee_dept',
  ]

  const EMPLOYEE_DOC_CODES = new Set([
    'ST', 'SIZ', 'SKT', 'SP1', 'SP2', 'SP3', 'PKWT', 'SPG', 'SMT', 'PHK', 'PI'
  ])

  const HRIS_FIELD_MAPPING = Object.freeze({
    employee_name: 'full_name',
    employee_id: 'employee_id',
    employee_position: 'position',
    employee_dept: 'derived_department',
    salary: 'salary_base',
    join_date: 'join_date',
    employee_branch: 'branch',
    officer_name: 'full_name',
    officer_title: 'position',
  })

  const REQUIRED_MASTER_FIELDS_BY_DOC = Object.freeze({
    ST: ['employee_name', 'employee_id', 'employee_position', 'employee_dept'],
    SIZ: ['employee_name', 'employee_id', 'employee_position'],
    SKT: ['employee_name', 'employee_id', 'employee_position', 'employee_dept'],
    SP1: ['employee_name', 'employee_id', 'employee_position', 'employee_dept'],
    SP2: ['employee_name', 'employee_id', 'employee_position'],
    SP3: ['employee_name', 'employee_id', 'employee_position'],
    PKWT: ['employee_name', 'employee_id', 'employee_position', 'employee_dept', 'salary'],
    SPG: ['employee_name', 'employee_id', 'old_position', 'employee_dept'],
    SMT: ['employee_name', 'employee_id', 'employee_position'],
    PHK: ['employee_name', 'employee_id', 'employee_position', 'employee_dept', 'join_date'],
    PI: ['employee_name', 'employee_id', 'employee_position', 'employee_dept'],
    FCO: ['officer_name', 'officer_title'],
  })

  function isEmployeeDocument(code) {
    return EMPLOYEE_DOC_CODES.has(String(code || '').toUpperCase())
  }

  function requiredMasterFields(code) {
    return REQUIRED_MASTER_FIELDS_BY_DOC[String(code || '').toUpperCase()] || []
  }

  global.SmartOfficeDocFieldRules = {
    EMPLOYEE_COMMON,
    EMPLOYEE_DOC_CODES,
    HRIS_FIELD_MAPPING,
    REQUIRED_MASTER_FIELDS_BY_DOC,
    isEmployeeDocument,
    requiredMasterFields,
  }
})(window)
