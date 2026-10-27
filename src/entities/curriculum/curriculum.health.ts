import type {CurriculumCoverage,CurriculumSnapshot} from './curriculum.types';

export type CoverageHealth='covered'|'partial'|'missing';

export function classifyUnitCoverage(unitId:number,rows:CurriculumCoverage[]):CoverageHealth {
  const relevant=rows.filter(row=>row.unitId===unitId);
  if(relevant.some(row=>row.coverageType==='covers'||row.coverageType==='equivalent'))return 'covered';
  if(relevant.some(row=>row.coverageType==='partial'||row.coverageType==='supports'))return 'partial';
  return 'missing';
}

export function summarizeCurriculum(snapshot:CurriculumSnapshot,referenceId:number){
  const units=snapshot.units.filter(unit=>unit.referenceId===referenceId);
  const status=units.map(unit=>classifyUnitCoverage(unit.id,snapshot.coverage));
  return {total:units.length,covered:status.filter(item=>item==='covered').length,
    partial:status.filter(item=>item==='partial').length,missing:status.filter(item=>item==='missing').length};
}
