import {useQuery} from '@tanstack/react-query';
import {getFacodiCurriculum} from '@/entities/curriculum/curriculum.api';
import {curriculumKeys} from '@/entities/curriculum/curriculum.keys';
import {useAuth} from '@/features/auth/useAuth';
export function useFacodiCurriculum(){
  const {user,loading}=useAuth();
  return useQuery({queryKey:curriculumKeys.snapshot(user?.id??'signed-out'),queryFn:getFacodiCurriculum,enabled:!loading&&!!user,staleTime:60_000,retry:1});
}
