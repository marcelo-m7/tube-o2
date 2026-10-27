export const curriculumKeys={all:['facodi','curriculum'] as const,snapshot:(userId:string)=>[...curriculumKeys.all,'published-snapshot',userId] as const};
