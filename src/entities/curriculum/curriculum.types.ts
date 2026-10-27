export interface CurriculumReference {
  id:number;institution:string;programme:string;year:string;code:string;sourceUrl:string|null;
}
export interface CurriculumUnit {
  id:number;referenceId:number;name:string;code:string;year:number;period:string;credits:number;
}
export interface CurriculumCourse {id:number;name:string;url:string|null;}
export type CoverageType='covers'|'partial'|'supports'|'equivalent';
export interface CurriculumCoverage {unitId:number;courseId:number;coverageType:CoverageType;confidence:number;}
export interface CurriculumSnapshot {
  references:CurriculumReference[];units:CurriculumUnit[];courses:CurriculumCourse[];coverage:CurriculumCoverage[];
}
