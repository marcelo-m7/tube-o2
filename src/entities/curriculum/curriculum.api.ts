import { invokeEdgeFunction, getEdgeFunctionErrorDetails } from '@/shared/api/supabase/edgeFunctions';
import type { CurriculumSnapshot } from './curriculum.types';

export async function getFacodiCurriculum():Promise<CurriculumSnapshot> {
  const {data,error}=await invokeEdgeFunction<CurriculumSnapshot>('facodi-curriculum');
  if(error){const info=await getEdgeFunctionErrorDetails(error);throw new Error(info.code||info.message);}
  if(!data||!Array.isArray(data.references)||!Array.isArray(data.units)||!Array.isArray(data.courses)||!Array.isArray(data.coverage)){
    throw new Error('invalid_curriculum_response');
  }
  return data;
}
