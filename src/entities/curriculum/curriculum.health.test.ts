import {describe,expect,it} from 'vitest';
import {classifyUnitCoverage,summarizeCurriculum} from './curriculum.health';
import type {CurriculumSnapshot} from './curriculum.types';

const sample:CurriculumSnapshot={
  references:[{id:1,institution:'Universidade do Algarve',programme:'LESTI',year:'2026/27',code:'LESTI',sourceUrl:null}],
  units:[
    {id:11,referenceId:1,name:'Análise',code:'AM',year:1,period:'1',credits:6},
    {id:12,referenceId:1,name:'Machine Learning',code:'ML',year:2,period:'2',credits:6},
    {id:13,referenceId:1,name:'Física',code:'FIS',year:1,period:'1',credits:6},
  ],
  courses:[{id:91,name:'Pré-Cálculo',url:'https://facodi.com/slides/pre-calculo'}],
  coverage:[
    {unitId:11,courseId:91,coverageType:'covers',confidence:.9},
    {unitId:12,courseId:91,coverageType:'supports',confidence:.7},
  ],
};
describe('curriculum coverage summary',()=>{
  it('separates direct, supporting and uncovered curricular units',()=>{
    expect(classifyUnitCoverage(11,sample.coverage)).toBe('covered');
    expect(classifyUnitCoverage(12,sample.coverage)).toBe('partial');
    expect(classifyUnitCoverage(13,sample.coverage)).toBe('missing');
    expect(summarizeCurriculum(sample,1)).toEqual({total:3,covered:1,partial:1,missing:1});
  });
  it('does not count mapping suggestions as academic equivalence',()=>{
    expect(classifyUnitCoverage(12,[{unitId:12,courseId:91,coverageType:'equivalent',confidence:1}])).toBe('covered');
  });
});
