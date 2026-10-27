import {fireEvent,render,screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach,describe,expect,it,vi} from 'vitest';
import FacodiKnowledge from './FacodiKnowledge';

const auth=vi.hoisted(()=>({user:null as null|{id:string},loading:false}));
const curriculum=vi.hoisted(()=>({data:null as unknown,isPending:true,isError:false,refetch:vi.fn(),isFetching:false}));
vi.mock('@/features/auth/useAuth',()=>({useAuth:()=>auth}));
vi.mock('@/features/curriculum/queries/useFacodiCurriculum',()=>({useFacodiCurriculum:()=>curriculum}));
vi.mock('@/components/layout/MainLayout',()=>({MainLayout:({children}:{children:React.ReactNode})=><main>{children}</main>}));
vi.mock('react-i18next',()=>({useTranslation:()=>({t:(key:string)=>key})}));

function page(){return render(<MemoryRouter><FacodiKnowledge/></MemoryRouter>);}

describe('FACODI Atlas authentication and accessibility',()=>{
  beforeEach(()=>{localStorage.clear();auth.user=null;auth.loading=false;curriculum.data=null;curriculum.isPending=true;});
  it('shows a sign-in state and records the return location',()=>{
    page();
    expect(screen.getByText('facodiKnowledge.authentication.title')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link',{name:'facodiKnowledge.signIn'}));
    expect(localStorage.getItem('redirectAfterLogin')).toBe('/facodi/knowledge');
  });
  it('exposes selected programme state and a readable source link',()=>{
    auth.user={id:'alice'};
    curriculum.isPending=false;
    curriculum.data={references:[{id:1,institution:'Universidade do Algarve',programme:'LESTI',year:'2025',sourceUrl:'https://example.edu'}],units:[],courses:[],coverage:[]};
    page();
    expect(screen.getByRole('button',{name:'LESTI · 2025'})).toHaveAttribute('aria-pressed','true');
    expect(screen.getByRole('link',{name:'facodiKnowledge.officialSource'})).toHaveClass('text-foreground');
    const chart=screen.getByRole('img',{name:'facodiKnowledge.coverageChartLabel'});
    expect(chart.getAttribute('style')).toContain('hsl(var(--muted))');
  });
});
