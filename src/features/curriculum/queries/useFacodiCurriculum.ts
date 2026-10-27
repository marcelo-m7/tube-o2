import {useQuery} from '@tanstack/react-query';
import {getFacodiCurriculum} from '@/entities/curriculum/curriculum.api';
import {curriculumKeys} from '@/entities/curriculum/curriculum.keys';
export function useFacodiCurriculum(){return useQuery({queryKey:curriculumKeys.snapshot(),queryFn:getFacodiCurriculum,staleTime:60_000,retry:1});}
