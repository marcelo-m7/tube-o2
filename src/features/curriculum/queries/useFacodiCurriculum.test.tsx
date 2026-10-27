import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {renderHook,waitFor} from '@testing-library/react';
import {beforeEach,describe,expect,it,vi} from 'vitest';
import type {ReactNode} from 'react';
import {useFacodiCurriculum} from './useFacodiCurriculum';
import {curriculumKeys} from '@/entities/curriculum/curriculum.keys';

const auth=vi.hoisted(()=>({user:null as null|{id:string},loading:false}));
const getSnapshot=vi.hoisted(()=>vi.fn());
vi.mock('@/features/auth/useAuth',()=>({useAuth:()=>auth}));
vi.mock('@/entities/curriculum/curriculum.api',()=>({getFacodiCurriculum:getSnapshot}));

function wrapper({children}:{children:ReactNode}){
  return <QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>{children}</QueryClientProvider>;
}

describe('authenticated FACODI curriculum snapshots',()=>{
  beforeEach(()=>{auth.user=null;auth.loading=false;getSnapshot.mockReset().mockResolvedValue({references:[],units:[],courses:[],coverage:[]});});
  it('never calls the private endpoint while signed out or while auth resolves',async()=>{
    auth.loading=true;
    const {rerender}=renderHook(()=>useFacodiCurriculum(),{wrapper});
    await Promise.resolve();
    expect(getSnapshot).not.toHaveBeenCalled();
    auth.loading=false;
    rerender();
    await Promise.resolve();
    expect(getSnapshot).not.toHaveBeenCalled();
  });
  it('requests the snapshot only when signed in and partitions cache by user',async()=>{
    auth.user={id:'alice'};
    renderHook(()=>useFacodiCurriculum(),{wrapper});
    await waitFor(()=>expect(getSnapshot).toHaveBeenCalledOnce());
    expect(curriculumKeys.snapshot('alice')).not.toEqual(curriculumKeys.snapshot('bob'));
  });
});
