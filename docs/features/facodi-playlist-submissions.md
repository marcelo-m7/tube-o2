# FACODI — submissão de playlists YouTube no Supabase

## Objetivo e fronteiras

Mecanismo independente para o FACODI, inspirado na importação de playlists de `tube.open2.tech`, sem reutilizar a estrutura editorial do Tube.

- **`facodi.playlists`**: playlist académica, curso, UC, autor, playlist externa, estados de importação e de revisão.
- **`facodi.playlist_items`**: sequência de vídeos da playlist; `video_id` é FK opcional para `public.videos(id)` (vídeo ainda por importar = `NULL`).
- **`facodi.unit_videos`**: associação curricular resultante da **aprovação** da playlist.
- **`public.videos`**: catálogo canónico de vídeos partilhado. O endpoint pode adicionar vídeos novos ao catálogo após consultar o YouTube oEmbed. Estes vídeos podem ficar visíveis na experiência Tube; é uma consequência da partilha do catálogo de vídeos.
- **Não escrever** em `public.playlists`, `public.playlist_videos` ou `public.video_submissions`.
- **Sem integração com Odoo**. Auth é o serviço Supabase Auth, separado do schema FACODI.

## Migrações aplicadas

- `20261114145341_facodi_playlist_submission_workflow.sql`
- `20261114145431_facodi_playlist_owner_import_status_rls.sql`

A relação curso–UC é validada por FK composta `(course_id,curricular_unit_id)` e pela RPC. O vídeo é associado pelo YouTube ID e pela FK de `public.videos`. A revisão é protegida por RLS e por `facodi.is_facodi_editor()`, que consulta `app_metadata.role` do JWT.

## API de submissão

Edge Function **`facodi-submit-playlist`**: `POST /functions/v1/facodi-submit-playlist`. **JWT obrigatório** (`verify_jwt=true`).

Exemplo:

```json
{
  "course_id": "<course UUID in facodi.courses>",
  "curricular_unit_id": "<UC UUID belonging to that course>",
  "playlist_url": "https://www.youtube.com/playlist?list=PL0123456789012345",
  "title": "Aulas introdutórias de Programação",
  "description": "Seleção proposta para a UC",
  "language": "pt",
  "max_videos": 50
}
```

`title` e `description` são opcionais. `max_videos` varia entre 1 e 100 (50 por omissão). A função pode receber `youtube_video_ids` explícitos como alternativa à extração HTML, mas continua a exigir URL de playlist válida. A resposta indica `playlist_id`, estados, contagens de vídeos associados ou ainda pendentes de resolução e URL externa normalizada.

A função:
1. Verifica o JWT e a UC através da leitura autenticada do schema `facodi`.
2. Extrai os IDs da página YouTube (ou usa IDs explicitamente enviados).
3. Reutiliza vídeos existentes em `public.videos` e tenta importar os desconhecidos através de metadados YouTube oEmbed.
4. Chama `facodi.submit_playlist(...)` como **utilizador autenticado**, sem service role na escrita da FACODI. A RPC cria a playlist e os itens atomicamente.
5. Chama `facodi.reconcile_playlist_items(playlist_id)` para resolver vídeos pendentes.

A chave `service_role` existe apenas no runtime da Edge Function e é usada exclusivamente para acrescentar vídeos ao catálogo partilhado. O frontend usa apenas a chave publicável.

## Moderação

- Uma playlist começa em `status='pending'`; não é mostrada publicamente.
- `facodi.review_playlist(playlist_id,'approved'|'rejected',review_note)` está disponível **apenas para editor/admin**.
- Aprovação exige pelo menos um vídeo associado e **nenhum item não rejeitado com video_id nulo**.
- Ao aprovar, a RPC marca os itens como aprovados e integra os vídeos em `facodi.unit_videos` (com proveniência).
- Mesmo aprovada, a playlist só é pública se o **curso e a UC** estiverem `active`/`published`.
- A rejeição conserva o histórico; permite uma submissão futura de outra playlist.

É possível submeter para cursos em rascunho **como editor**; utilizadores comuns só podem submeter para cursos e UCs publicados. Uma proteção transacional limita autores comuns a 3 submissões/hora e 10/dia. Autores não podem aprovar, rejeitar ou mudar o curso/UC de uma playlist submetida.

## Interface

- `/facodi/playlists/submit` — formulário de curso → UC → URL, importação e retorno de estado.
- `/facodi/playlists/review` — fila editorial com leitura de vídeos, nota, aprovação e rejeição.
- O CTA da página `/facodi` aponta para a submissão académica, não para a submissão genérica do Tube.
- Traduções PT/EN/ES/FR.

## Verificações realizadas

Testes SQL de transação com `ROLLBACK` (sem dados de teste persistentes):
- criação e aprovação por perfil editor;
- recusa de submissão de utilizador comum a curso em rascunho;
- rejeição de UC que não pertence ao curso;
- bloqueio da aprovação com vídeos por resolver;
- submissão de perfil comum quando curso e UC estão publicados.

A Edge Function foi implantada com `verify_jwt=true`. **Ainda é necessário testar pelo navegador** uma playlist YouTube real com uma sessão de utilizador (incluindo disponibilidade do YouTube e importação oEmbed); a extração de HTML não é uma API oficial e pode devolver vídeos recomendados ou falhar com mudanças da página. Por isso, a revisão editorial nunca pode ser ignorada.

As playlists em `public` continuam inalteradas, e não foram criadas playlists de demonstração persistentes.
